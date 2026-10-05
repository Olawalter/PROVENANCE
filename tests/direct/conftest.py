"""A `genlayer` the contract can be run against, where the validator is real.

The point of this harness is the part most contract test doubles leave out: when
the contract opens a consensus round, the leader function runs, and then the
validator function runs *again, separately*, against its own view of the web and
its own model answers. A test can therefore make the two nodes disagree -- about
what a page says, about what it is, about when it was published -- and watch the
round fail, which is the only way to test the thing that makes this a GenLayer
application rather than a database write.

Everything here is a stand-in for the runtime, never for the contract: no rule
in this file knows anything about claims, policies or verdicts.
"""
import importlib.util
import json
import os
import pathlib
import sys
import types

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTRACT = pathlib.Path(os.environ.get("PROVENANCE_CONTRACT",
                                       ROOT / "contracts" / "provenance.py"))

CONTRACT_ADDRESS = "0x00000000000000000000000000000000000c0DE1"


# -- the pieces of the runtime the contract touches ---------------------------

class Address(str):
    """An address. A string in this harness; a type on chain."""


class _Sized(int):
    """u256/u32 keep their own type so a test can tell a bare int from a
    deliberate on-chain amount."""


def u256(value=0):
    return _Sized(int(value))


def u32(value=0):
    return _Sized(int(value))


class TreeMap(dict):
    def get(self, key, default=None):
        return dict.get(self, key, default)


class DynArray(list):
    pass


def allow_storage(cls):
    return cls


class UserError(Exception):
    def __init__(self, message=""):
        super().__init__(message)
        self.message = message


class VMError(Exception):
    def __init__(self, message=""):
        super().__init__(message)
        self.message = message


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class _UserErrorResult:
    """What a validator receives when the leader raised."""

    def __init__(self, message):
        self.message = message


class _NoMajority(Exception):
    """The validator did not accept the leader's result.

    On chain this is not an exception at all -- the round simply writes nothing
    and the transaction is undetermined. Raising here is how a test observes
    the same outcome: nothing was written.
    """


# -- the harness --------------------------------------------------------------

class World:
    """What the nodes can see, and what they did.

    `documents` and `answers` are per role, so a test can hand the leader and
    the validator different views of the same URL. That is not a contrived
    case: two nodes fetching the same page seconds apart really can see
    different things, and the protocol has to survive it.
    """

    def __init__(self):
        self.now = "2026-09-28T16:00:00Z"
        self.sender = "0x1111111111111111111111111111111111111111"
        self.value = 0
        self.documents = {}            # url -> text, as both nodes see it
        self.role_documents = {}       # (role, url) -> text, overriding the above
        self.answers = {}              # url -> model answer
        self.role_answers = {}         # (role, url) -> model answer
        self.unreachable = set()
        self.role_unreachable = {}     # role -> set of urls
        self.model_raw = {}            # url -> raw string to return instead of JSON
        self.model_raises = set()
        self.payments = []             # (recipient, amount)
        self.scheduled = []            # (on, method, args) messages emitted
        self.role = "leader"
        self.prompts = []              # every prompt a node sent
        self.fetches = []              # (role, url)

    # what a node sees -------------------------------------------------------
    def document(self, url, text, role=None):
        if role:
            self.role_documents[(role, url)] = text
        else:
            self.documents[url] = text
        return self

    def says(self, url, position="SILENT", source_class="UNKNOWN", quote="",
             event_time="", publication_time="", note="read", role=None):
        answer = {"position": position, "source_class": source_class,
                  "quote": quote, "event_time": event_time,
                  "publication_time": publication_time, "note": note}
        if role:
            self.role_answers[(role, url)] = answer
        else:
            self.answers[url] = answer
        return self

    def down(self, url, role=None):
        if role:
            self.role_unreachable.setdefault(role, set()).add(url)
        else:
            self.unreachable.add(url)
        return self

    # what a node got --------------------------------------------------------
    def body_for(self, url):
        return self.role_documents.get((self.role, url), self.documents.get(url))

    def answer_for(self, url):
        return self.role_answers.get((self.role, url), self.answers.get(url))

    def is_down(self, url):
        return url in self.unreachable or \
            url in self.role_unreachable.get(self.role, set())


WORLD = World()


# -- the gl module ------------------------------------------------------------

def _make_gl():
    gl = types.SimpleNamespace()

    class _Message:
        @property
        def sender_address(self):
            return Address(WORLD.sender)

        @property
        def origin_address(self):
            return Address(WORLD.sender)

        @property
        def contract_address(self):
            return Address(CONTRACT_ADDRESS)

        @property
        def value(self):
            return u256(WORLD.value)

        @property
        def chain_id(self):
            return u256(61999)

    gl.message = _Message()

    class _Web:
        def render(self, url, mode="text"):
            WORLD.fetches.append((WORLD.role, url))
            if WORLD.is_down(url):
                raise RuntimeError("unreachable")
            body = WORLD.body_for(url)
            if body is None:
                raise RuntimeError("no such document")
            return body

        def get(self, url):
            WORLD.fetches.append((WORLD.role, url))
            if WORLD.is_down(url):
                raise RuntimeError("unreachable")
            body = WORLD.body_for(url)
            if body is None:
                raise RuntimeError("no such document")
            return types.SimpleNamespace(status=200, body=body.encode("utf-8"),
                                         headers={"content-type": "text/html"})

    def exec_prompt(prompt, response_format=None):
        WORLD.prompts.append((WORLD.role, prompt))
        url = ""
        marker = "<<<BEGIN DOCUMENT "
        if marker in prompt:
            url = prompt.split(marker, 1)[1].split(">>>", 1)[0].strip()
        if url in WORLD.model_raises:
            raise RuntimeError("the model is unavailable")
        if url in WORLD.model_raw:
            return WORLD.model_raw[url]
        answer = WORLD.answer_for(url)
        if answer is None:
            answer = {"position": "SILENT", "source_class": "UNKNOWN",
                      "quote": "", "event_time": "", "publication_time": "",
                      "note": "nothing here settles it"}
        return json.dumps(answer)

    gl.nondet = types.SimpleNamespace(web=_Web(), exec_prompt=exec_prompt)

    def run_nondet_unsafe(leader_fn, validator_fn):
        """The leader proposes; the validator does the work again and judges.

        Both halves really run. A validator that returns False stops the round
        and nothing is written, which is what the chain does with a round that
        has no majority.
        """
        WORLD.role = "leader"
        try:
            proposal = Return(leader_fn())
        except UserError as problem:
            proposal = _UserErrorResult(problem.message)
        WORLD.role = "validator"
        try:
            accepted = validator_fn(proposal)
        finally:
            WORLD.role = "leader"
        if not accepted:
            raise _NoMajority("the validators did not agree about this round")
        if isinstance(proposal, _UserErrorResult):
            # they agreed about a refusal: the contract sees the leader's error
            raise UserError(proposal.message)
        return proposal.calldata

    # Result is the annotation a validator's parameter carries, and it has to
    # exist for the contract to even define one.
    gl.vm = types.SimpleNamespace(
        UserError=UserError, VMError=VMError, Return=Return, Result=object,
        run_nondet_unsafe=run_nondet_unsafe)

    # decorators -------------------------------------------------------------
    def _identity(fn):
        return fn

    write = _identity
    write.payable = _identity
    gl.public = types.SimpleNamespace(view=_identity, write=write)

    def evm_contract_interface(cls):
        class _Proxy:
            def __init__(self, address):
                self.address = str(address)

            def emit_transfer(self, value=0):
                WORLD.payments.append((self.address, int(value)))

        return _Proxy

    def contract_interface(cls):
        class _Proxy:
            def __init__(self, address):
                self.address = str(address)

            def emit(self, on="finalized", value=None):
                recorded = self

                class _Emitter:
                    def __getattr__(self, name):
                        def send(*args, **kwargs):
                            WORLD.scheduled.append((on, name, args))
                        return send

                return _Emitter()

            def view(self):
                raise AssertionError("this build makes no cross-contract reads")

        return _Proxy

    gl.evm = types.SimpleNamespace(contract_interface=evm_contract_interface)
    gl.contract_interface = contract_interface

    class Contract:
        pass

    gl.Contract = Contract
    return gl


def _install():
    """Publish a `genlayer` module the contract can import with `import *`."""
    module = types.ModuleType("genlayer")
    gl = _make_gl()
    module.gl = gl
    module.Address = Address
    module.TreeMap = TreeMap
    module.DynArray = DynArray
    module.u256 = u256
    module.u32 = u32
    module.allow_storage = allow_storage
    module.__all__ = ["gl", "Address", "TreeMap", "DynArray", "u256", "u32",
                      "allow_storage"]
    module.message_raw = None
    sys.modules["genlayer"] = module

    class _Raw(dict):
        def __getitem__(self, key):
            if key == "datetime":
                return WORLD.now
            if key == "is_init":
                return False
            return dict.__getitem__(self, key)

    gl.message_raw = _Raw()
    return module


_install()

spec = importlib.util.spec_from_file_location("provenance_contract", CONTRACT)
provenance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provenance)


# -- what tests use -----------------------------------------------------------

def _fresh_storage(contract):
    """Give the instance the storage its annotations declare.

    On chain a class-level annotation *is* a storage slot, created empty before
    the constructor runs. Here the annotations are only annotations, so the
    harness does the same thing from the same declarations -- rather than a
    hand-written list that would quietly stop matching the contract.
    """
    for name, annotation in type(contract).__annotations__.items():
        origin = getattr(annotation, "__origin__", annotation)
        if origin is TreeMap:
            setattr(contract, name, TreeMap())
        elif origin is DynArray:
            setattr(contract, name, DynArray())
        elif annotation in (u256, u32):
            setattr(contract, name, u256(0))
        else:
            setattr(contract, name, "")
    return contract


class Harness:
    def __init__(self):
        self.module = provenance
        self.world = WORLD
        self.contract = _fresh_storage(provenance.Provenance.__new__(
            provenance.Provenance))
        self.contract.__init__()

    # identity and time ------------------------------------------------------
    def to(self, address):
        WORLD.sender = address
        return self

    def at(self, when):
        WORLD.now = when
        return self

    def sending(self, amount):
        WORLD.value = int(amount)
        return self

    # shorthands -------------------------------------------------------------
    @property
    def payments(self):
        return WORLD.payments

    @property
    def scheduled(self):
        return WORLD.scheduled

    def document(self, *args, **kwargs):
        return WORLD.document(*args, **kwargs)

    def says(self, *args, **kwargs):
        return WORLD.says(*args, **kwargs)

    def down(self, *args, **kwargs):
        return WORLD.down(*args, **kwargs)


@pytest.fixture
def h():
    """A fresh contract, a fresh world, every test."""
    global WORLD
    WORLD.__init__()
    harness = Harness()
    return harness


CREATOR = "0x1111111111111111111111111111111111111111"
FUNDER = "0x2222222222222222222222222222222222222222"
SUBMITTER = "0x3333333333333333333333333333333333333333"
STRANGER = "0x4444444444444444444444444444444444444444"


def expect_error(fragment=""):
    """A refusal of the given class, with the message available to assert on."""
    class _Expect:
        def __enter__(self):
            return self

        def __exit__(self, kind, problem, trace):
            assert kind is not None, "this was supposed to be refused"
            assert kind is UserError, f"refused with {kind.__name__}: {problem}"
            self.message = problem.message
            if fragment:
                assert fragment in problem.message, \
                    f"expected {fragment!r} in {problem.message!r}"
            return True

    return _Expect()


def expect_no_majority():
    class _Expect:
        def __enter__(self):
            return self

        def __exit__(self, kind, problem, trace):
            assert kind is _NoMajority, \
                f"expected the round to fail for want of a majority, got {kind}"
            return True

    return _Expect()

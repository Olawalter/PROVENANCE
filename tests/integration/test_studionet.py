"""Against the deployment itself, over the real network.

Nothing here asks for a consensus round or changes state: these are reads. What
they check is the part a Direct Mode suite structurally cannot -- that the
contract on chain is the contract in this repository, that its surface is the
one the console was wired against, and that what the published record claims is
what the deployment still answers through the views a reader would call.

    python -m pytest tests/integration -q

The consensus behaviour itself -- validators reading the live web, rounds that
write nothing, every verdict -- is exercised by `python scripts/live.py`, which
asserts and publishes its record. Repeating that here would spend somebody
else's shared network to prove the same thing twice.
"""
import hashlib
import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

DEPLOYMENT = ROOT / "docs" / "deployment.json"
LIVE = ROOT / "docs" / "live.json"
CONTRACT = ROOT / "contracts" / "provenance.py"

pytestmark = pytest.mark.skipif(not DEPLOYMENT.exists(),
                                reason="nothing has been deployed and recorded yet")

WRITES = ("declare_claim", "freeze_claim", "fund_bounty", "submit_evidence",
          "adjudicate", "settle", "cancel_claim", "recover_bounty", "supersede")
VIEWS = ("get_protocol", "get_claim", "list_claims", "get_evidence",
         "get_claim_evidence", "get_adjudication", "get_claim_adjudication",
         "get_custody")


@pytest.fixture(scope="module")
def record():
    return json.loads(DEPLOYMENT.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def client():
    import transport  # noqa: F401  (retries transport failures, nothing else)
    from eth_account import Account
    from genlayer_py import create_account, create_client
    from genlayer_py.chains import studionet
    return create_client(chain=studionet,
                         account=create_account(
                             account_private_key=Account.create().key.hex()))


def read(client, record, method, args=None):
    return client.read_contract(address=record["contract_address"],
                                function_name=method, args=args or [])


class TestTheChainHoldsThisSource:

    def test_the_deployed_bytes_are_this_repository_s_bytes(self, client, record):
        import base64
        answer = client.provider.make_request("gen_getContractCode",
                                              [record["contract_address"]])
        raw = answer.get("result", answer) if isinstance(answer, dict) else answer
        text = str(raw)
        onchain = bytes.fromhex(text[2:]) if text.startswith("0x") \
            else base64.b64decode(text)
        local = CONTRACT.read_bytes().replace(b"\r\n", b"\n")
        assert hashlib.sha256(onchain).hexdigest() == hashlib.sha256(local).hexdigest()

    def test_the_surface_is_the_one_the_console_was_wired_against(self, client, record):
        answer = client.provider.make_request("gen_getContractSchema",
                                              [record["contract_address"]])
        schema = answer.get("result", answer) if isinstance(answer, dict) else answer
        methods = schema["methods"]
        for name in WRITES + VIEWS:
            assert name in methods, f"the deployment has no {name}"
        assert methods["fund_bounty"].get("payable") is True
        for name in VIEWS:
            assert methods[name].get("readonly") is True, f"{name} is not a view"
        for name in WRITES:
            assert not methods[name].get("readonly"), f"{name} is a view"


class TestTheProtocolDescribesItself:

    def test_the_vocabulary_on_chain_is_the_documented_one(self, client, record):
        info = read(client, record, "get_protocol")
        assert info["verdicts"] == ["CONFIRMED", "REFUTED", "CONFLICTED",
                                    "INSUFFICIENT", "UNAVAILABLE"]
        assert info["rules"] == "provenance-adjudication-1"
        assert "Not proof" in info["scope"]

    def test_the_contract_holds_nothing_it_was_not_given(self, client, record):
        custody = read(client, record, "get_custody")
        assert custody["balanced"] is True
        assert custody["escrow_held"] == custody["sum_of_claims"]


@pytest.fixture(scope="module")
def live():
    return json.loads(LIVE.read_text(encoding="utf-8"))


@pytest.mark.skipif(not LIVE.exists(), reason="no live run recorded yet")
class TestThePublishedRecordIsStillWhatTheChainSays:

    def test_the_live_record_is_about_this_deployment(self, live, record):
        assert live["contract"].lower() == record["contract_address"].lower()

    def test_every_published_verdict_is_what_the_contract_still_answers(
            self, client, record, live):
        for name, claim in live["claims"].items():
            on_chain = read(client, record, "get_claim", [claim["claim_id"]])
            assert on_chain["verdict"] == claim["adjudication"]["verdict"], name
            # accepted, and the contract says so in its own words rather than
            # the report's
            assert on_chain["status"] in ("ACCEPTED", "SETTLED"), name

    def test_the_readings_behind_a_verdict_are_still_there(self, client, record, live):
        claim = live["claims"]["conflicted"]
        adjudication = read(client, record, "get_claim_adjudication",
                            [claim["claim_id"]])
        assert adjudication["verdict"] == "CONFLICTED"
        assert adjudication["supporting"] >= 1
        assert adjudication["contradicting"] >= 1
        # the digest is a digest, and it is the one the record published
        assert len(adjudication["decisive_digest"]) == 64
        assert adjudication["decisive_digest"] == \
            claim["adjudication"]["decisive_digest"]

    def test_the_hostile_page_is_recorded_as_contradicting(self, client, record, live):
        claim = live["claims"]["refuted"]
        evidence = read(client, record, "get_claim_evidence", [claim["claim_id"]])
        positions = [item["position"] for item in evidence["items"]]
        # it demanded SUPPORTS for everything. The chain holds CONTRADICTS.
        assert positions == ["CONTRADICTS"], positions

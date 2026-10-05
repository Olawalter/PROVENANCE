# What was verified before any of this was written

Phase 1 of the build specification: verify the current APIs, record the verified
versions, do not code against assumptions. This file is that record. Everything
below was read from the current documentation or proven against the network
during this build -- not recalled.

Verified 5 October 2026.

## Network and runner

| | |
| --- | --- |
| Network | GenLayer StudioNet, chain `61999` |
| Runner pin | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |
| Contract API | `from genlayer import *`, `class X(gl.Contract)` |

The runner is pinned, never `test` or `latest`: those are local development
aliases and no GenLayer network accepts them. The pin is per network -- a
contract pinned to the runner another network serves is refused outright with
`invalid_contract`, not a version warning -- so the deploy script reads the pin
out of the contract's own first line and refuses to send bytes the configured
chain cannot run.

## The contract APIs this build uses

| API | Verified from |
| --- | --- |
| `gl.message.sender_address`, `.value`, `.contract_address`, `.origin_address` | docs: Transaction Context |
| `gl.message_raw["datetime"]` | docs: Transaction Context -- the transaction clock, the only deterministic time |
| `gl.nondet.web.get(url)` / `.request(url, method=…)` / `.render(url, mode=…)` | docs: Web Access |
| `gl.nondet.exec_prompt(prompt, response_format="json")` | docs: LLM integration |
| `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` | docs: Equivalence Principle |
| `gl.vm.Return`, `gl.vm.UserError`, `gl.vm.VMError` | docs: Equivalence Principle |
| `TreeMap`, `DynArray`, `u256`, `u32`, `@allow_storage @dataclass` | docs: storage |
| `@gl.public.view`, `@gl.public.write`, `@gl.public.write.payable` | docs: Intelligent Contracts |
| `@gl.evm.contract_interface` empty proxy for paying a wallet | docs: Value Transfers |

Nothing here is invented. Where the response object differed between the
documentation (`status_code`) and what the runner on this network returns
(`status`), the contract reads whichever is present rather than guessing, and
the live run proves which one it was.

## Two architecture decisions, made from the documentation rather than taste

### One contract, not two

The specification prefers a registry contract and an adjudicator contract, *and*
says to use a single contract if the current documentation reveals that to be
safer. It does.

Contract-to-contract **writes are asynchronous**: `emit()` queues a call that
runs after the current transaction. With `on='accepted'` the documentation warns
the message "may be emitted again -- potentially multiple times across appeal
rounds" and cannot be recalled if the appeal changes the outcome.

So a split would mean the adjudicator reaching a result and then *messaging* the
registry to record it, after the transaction, possibly more than once. That
breaks two of this specification's own invariants: only an accepted result may
advance the adjudication state, and every payout must read a ledger that is
correct at the moment it is written. A synchronous `view()` cannot help -- it
reads, it does not write.

PROVENANCE is therefore one contract with the registry and the adjudicator as
separate internal modules, with no shared mutable state between them: the
adjudicator reads frozen claim state and returns a structured result, and only
deterministic registry code writes anything.

### Finality is the protocol's, not the application's

`emit()` defaults to `on='finalized'`, which runs **after the appeal window has
closed**, and `gl.message.contract_address` gives a contract its own address. So
the adjudication transaction schedules the settlement on itself:

```python
gl.get_contract_at(gl.message.contract_address).emit(on="finalized").settle(claim_id)
```

The money moves because the protocol finalized the adjudication, not because the
application declared it final. There is no application-level "finalize vote"
anywhere in this build, and `ACCEPTED` and `FINALIZED` stay two different facts
in the state, in the interface and in this documentation.

A manual `settle` exists as a recovery path only, and refuses until the recorded
finality grace has passed on the transaction clock.

## The Equivalence Principle, as the current documentation defines it

Read in full before the adjudicator was written. The two lines that shaped it:

> A validator that only checks `leader_result.calldata` for a valid JSON shape,
> allowed enum value, non-empty summary, or confidence in range is not
> performing consensus.

> Always extract before comparing. Raw web data varies between nodes.

So in PROVENANCE every validator fetches the evidence itself, reads it itself,
and compares only the fields a consequence depends on. What is compared, and why
that set and no other, is in [adjudication.md](adjudication.md).

## Tooling

| | |
| --- | --- |
| `genvm-lint` | `genvm-linter==0.11.1rc2` -- 0.11.0 cannot validate against a genvm-manager v0.6 bundle (it looks for a per-runner `.tar`; those bundles ship `.zip`), and a plain `pip install` silently keeps the old version |
| Deployment / live suite | `genlayer-js` |
| Console | Next.js 16 App Router, React 19, TypeScript, Tailwind, `genlayer-js`, injected EIP-1193 wallet |

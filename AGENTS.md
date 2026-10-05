# Working rules for this repository

Not style preferences. Each line below is here because breaking it produces a
build that looks finished and is not.

## GenLayer

- Do not invent a GenLayer API. Verify the current one first; what was verified
  for this build, and when, is in [docs/research.md](docs/research.md).
- The runner pin is per network. `test` and `latest` are local aliases that no
  network accepts, and a contract pinned to another network's runner is refused
  outright rather than warned about.
- Run `genvm-lint check contracts/provenance.py --json` after every change to
  the contract. Lint passing is not the same as validate passing; read both.
- Run the Direct Mode suite before anything that costs a consensus round.
- The contract stays pure ASCII. The toolchain reads it with the platform codec
  and one curly quote stops the linter dead.

## The consensus boundary

- Nothing is written to storage from inside a non-deterministic block, and no
  value leaves from inside one.
- A validator re-reads the sources itself and compares what it found. A
  validator that inspects the leader's answer for shape, enum membership or
  non-emptiness has verified nothing: that is leader-output-only validation and
  the documentation says so in as many words.
- Compare only fields a consequence depends on. Prose, exact timestamps and raw
  web responses are excluded deliberately, and the reason is in
  [docs/adjudication.md](docs/adjudication.md).
- A round the panel does not agree about writes nothing. That is a real
  outcome, not an error path, and the interface says so.
- No model names a verdict anywhere in this build. Code derives it.

## Evidence

- Public web content is untrusted input. It reaches a reader inside a fence it
  cannot close, after the protocol's own rules, and a run of angle brackets is
  replaced with a space rather than deleted.
- A decisive reading must quote the document it read.
- Authority comes from domains frozen with the claim, never from a model's
  opinion of a publisher.
- What was frozen cannot change. If a different interpretation is needed, that
  is a new claim.

## Accepted is not finalized

- `ACCEPTED` means consensus accepted the result. `FINALIZED` means the appeal
  window closed. They are different facts, stored differently, shown
  differently.
- There is no application-level finalize step anywhere in this build. The
  adjudication schedules settlement with `emit(on="finalized")`, so the
  protocol's own finality moves the money.
- Never label a submitted transaction finalized.

## Custody

- `gl.message.value` is the authoritative amount. Never a number from a caller.
- Record the actual depositor from the sender. The creator is not assumed to be
  the depositor anywhere.
- Terms and ledger are two fields: `bounty_wei` is what the claim says,
  `bounty_deposited` is what the contract holds. Payouts read the ledger.
- One transfer helper, `_send_gen`. Every payout goes through it.
- Zero the ledger, persist, then transfer. In that order, every path.
- A second payout must fail before it reaches the transfer.
- Escrow tests use three distinct accounts, because the mistakes worth catching
  hide when the creator, depositor and contributor are one address.

## The console

- Inspect the deployed schema before wiring any call. Never build a call from
  an assumption about a method name.
- No backend. The browser talks to GenLayer directly; an adjudicator you host
  is an adjudicator you can be asked to change.
- No mock data in a production build.
- Say what the record says. "AI verified", "AI confidence" and "AI proved"
  describe a trust model this product does not have.

## Reporting

- Published records are generated from run records, never typed by hand.
- If a test fails, say so with the output. A count of passing tests proves only
  that somebody tried.

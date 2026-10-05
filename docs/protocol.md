# The protocol

Claim, policy, evidence, adjudication, verdict, accepted, finalized,
superseded: what each one means, and the exact point at which each becomes
unchangeable.

## A claim

Not a sentence. A sentence is kept, because people read it, but nothing
adjudicates it.

```
subject            Acme Exchange
predicate          resumed_withdrawals
requested_value    true
relevant_time      2026-09-28T14:00:00Z
claim_type         EVENT_STATE
```

| Claim type | What it asserts |
| --- | --- |
| `EVENT_STATE` | something happened, and the state changed |
| `ENTITY_STATUS` | something is in a particular state |
| `PUBLIC_ANNOUNCEMENT` | something was announced publicly |
| `TEMPORAL_FACT` | something happened by a particular moment -- the one type where the event's own time is itself a condition |

## The lifecycle

```
DRAFT -- freeze --> REGISTERED / EVIDENCE_OPEN -- evidence --> EVIDENCE_SUBMITTED
                                                                     |
                                                              adjudicate
                                                                     v
                                                               ACCEPTED
                                                                     |
                                              the appeal window closes, and
                                              the protocol calls settlement
                                                                     v
                                                                SETTLED
```

| State | Means |
| --- | --- |
| `DRAFT` | declared; nothing frozen, no evidence accepted |
| `REGISTERED` | frozen, but the observation window has not opened yet |
| `EVIDENCE_OPEN` | frozen, and accepting sources |
| `EVIDENCE_SUBMITTED` | at least one source is on the record |
| `ADJUDICATION_PENDING` | the window has closed and nothing has been read yet |
| `ACCEPTED` | consensus accepted an adjudication |
| `SETTLED` | the bounty moved, after the decision was finalized |
| `SUPERSEDED` | a later claim carries the question now |
| `CANCELLED` | withdrawn before anybody did the work of finding a source |

`VERDICT_PROPOSED` is in the specification's lifecycle and is deliberately not
a state this contract stores: it is a fact about a **transaction**, which the
console reads from the receipt. Inventing a contract-side copy of it would be a
second consensus system pretending to be the first.

The failure classifications -- `INSUFFICIENT_EVIDENCE`, `CONFLICTED`,
`SOURCE_UNAVAILABLE` -- are recorded as the claim's `result`, alongside the
verdict, rather than as separate lifecycle states. A claim that could not be
established still reached a decision.

## Freezing

The act that makes a later verdict mean anything. These become immutable, for
everybody including the creator and including this contract:

- the evidence policy;
- the domains that carry official or regulatory authority;
- how many sources are required, and how many independent origins;
- the observation window;
- the claim's own structure and the moment it is about.

There is no method anywhere in this contract that changes them. If a different
interpretation is needed, that is a new claim, and the old record stays as it
is.

## Evidence

A reference and a time, and nothing about what it is worth.

```
source_url        the page
context           what the submitter says it is
submitted_by      the account that signed
submitted_at      the transaction clock
```

Anybody may submit. Nobody may declare their own source decisive, official, or
supporting: those are answers, and they are filled in when the source is read.

The same source cannot be submitted twice to one claim. Sameness is the scheme,
host and path without a fragment, so the same page reached by a different link
is one piece of evidence; the query string is kept, because for a great many
sites the query *is* the document.

## Verdicts

| Verdict | Reached when |
| --- | --- |
| `CONFIRMED` | the evidence satisfies the frozen conditions |
| `REFUTED` | the evidence establishes that the claim is not satisfied |
| `CONFLICTED` | relevant evidence materially disagrees and the frozen policy cannot rank the sources |
| `INSUFFICIENT` | evidence was read, and it does not establish the claim |
| `UNAVAILABLE` | the evidence could not be retrieved and assessed at all |

Two of these say the protocol cannot tell you. They exist because the
alternative is a product that always answers, including when it should not.

## Temporal provenance

Five times, never collapsed into one:

```
event_time          when the sources say the thing happened
publication_time    when a source says it was published
observation_time    when validators fetched and read it  (the transaction clock)
adjudication_time   when consensus accepted the result
settlement_time     when the bounty moved, after finality
```

A source published after an event does not mean the event happened after
publication. A page that changes next week does not rewrite what was observed
today. A page about an earlier state of the world is not a contradiction: the
stale report in the end-to-end run says withdrawals were halted, which was true
when it was written, and it is recorded as read and disregarded rather than as
a conflict.

`observation_time` is the transaction clock, which is the only time two nodes
cannot disagree about. Everything else is something a document claims.

## Accepted is not finalized

`ACCEPTED` means GenLayer consensus accepted the result. `FINALIZED` means the
appeal window has closed. They are different facts.

The contract records the first. The second is a fact about the transaction,
which a contract cannot observe about itself -- so the console asks the
finalized view directly and reports what it finds, and the adjudication
schedules its own settlement with `emit(on="finalized")` so that money moves
because the protocol finalized the decision.

There is no application-level finalize step anywhere in this build.

## Supersession

A later claim can take over the question. It does not rewrite anything: the old
verdict, its evidence, its readings and its times stay exactly as recorded,
because a record that changes when somebody disagrees with it later is not a
record.

## The bounty

Optional, and secondary. The product is evidence adjudication; the bounty is a
way to pay for the work of finding a source.

```
declare -> freeze -> fund (payable) -> evidence -> adjudicate
                                                      |
                                        the appeal window closes
                                                      v
                                        settle: the earliest contributor whose
                                        evidence carried the verdict, or the
                                        depositor if none did
```

The creator cannot collect their own bounty with their own evidence. Where
nothing established the claim, the bounty goes back to the account that
deposited it -- which is recorded from the transaction and never assumed to be
the creator.

## Error classes

The first token is the class. The console reads that rather than matching
prose, so wording can change without breaking anything that depends on the kind.

| Class | Raised when |
| --- | --- |
| `[EXPECTED]` | a rule of the protocol said no |
| `[EXTERNAL]` | an external source answered, and the answer was a refusal |
| `[TRANSIENT]` | something failed in a way that says nothing about the request |
| `[LLM_ERROR]` | the model returned something unusable |

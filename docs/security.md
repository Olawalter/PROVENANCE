# Security model

What PROVENANCE defends against, how, and -- more usefully -- what it does not
claim.

## Public web content is untrusted input

Every source is a page somebody chose to submit, and one of them may well
contain a line addressed to whoever is reading it.

| Property | How |
| --- | --- |
| A document is quoted, not followed | it reaches the reader inside named fences, after the protocol's own rules, and the prompt says in as many words that text telling the reader what to conclude is part of the document being read |
| A document cannot close its own fence | any run of three or more angle brackets is replaced **with a space** |
| Replaced, never deleted | deleting the marks would join whatever sat either side into a word nobody wrote, which puts a sentence in front of the reader that was never in the document |
| Fields cannot carry a fence either | a subject, statement, URL or context containing an angle-bracket run is refused when it is submitted, because those reach the prompt too |
| One document at a time | a reader is never shown another source's text, so a hostile page cannot address a reading of a different page |

This is exercised live, not only in a test double. One of the claims in the
end-to-end run is a page that says `IGNORE PREVIOUS INSTRUCTIONS`, demands
`SUPPORTS` for every question, and includes a forged fence terminator. It was
read as a document: what it actually says is that withdrawals did not resume,
and the claim is recorded `REFUTED`. It got the verdict its content earned.

## Grounding

A decisive reading must quote five consecutive words that really appear in the
document. Without this a reader can answer from how such announcements usually
go and be confidently wrong about this one -- the failure mode that matters
here, because it produces a well-formed, confident, wrong record.

An ungrounded reading is held at `SILENT` in **both** directions.

## The leader is not trusted

Every validator fetches each source itself, reads it itself, and compares only
the fields a consequence depends on. A leader whose proposal does not follow
from the evidence is rejected and the round writes nothing.

[adjudication.md](adjudication.md) lists exactly which fields are compared and
why prose and exact timestamps are excluded.

## Stale evidence

A page about an earlier state of the world is not a contradiction. The
observation window is frozen with the claim; a source published outside it is
recorded as read and disregarded, with its position visible, rather than
counted or hidden. For a `TEMPORAL_FACT`, an event outside the claimed moment
is excluded the same way.

Treating a true-at-the-time report as a contradiction would make every claim
about a changed state permanently conflicted.

## Source substitution and independence

Authority is a comparison against domains frozen before any evidence existed,
so a lookalike domain, a subdomain of somebody else's site, or a confident
reader cannot confer it. Independence is counted by origin: pages repeating one
announcement are one origin, and the protocol returns `INSUFFICIENT` rather
than pretending a corroboration requirement was met.

## Duplicate evidence

The same source cannot be submitted twice to one claim, however it is linked --
the comparison normalises scheme, host, path, `www.`, case, trailing slash and
fragment. Two different pages on one host are two sources, which is a question
for independence rather than for duplicate detection.

## Custody

| Invariant | Where |
| --- | --- |
| `gl.message.value` is the authoritative amount | `fund_bounty` takes no amount argument at all |
| the depositor is the account that sent it | recorded from the sender, never assumed to be the creator |
| terms and ledger are different fields | `bounty_wei` is what the claim says; `bounty_deposited` is what the contract holds, and payouts read the ledger |
| one transfer helper | every payout goes through `_send_gen`, so there is one piece of code to read when asking how money can move |
| zero, save, transfer | the ledger is zeroed and the record written before a unit moves |
| no second payout | a second attempt finds nothing to pay and fails before it reaches the transfer |
| a refused payable call returns its value | a call that raised with value attached would strand it |

Every payout path -- settlement, cancellation, recovery -- does all of this
independently. There are no others, and the escrow tests use three distinct
accounts because the mistakes worth catching hide when the creator, the
depositor and the contributor are one address.

A `get_custody` view publishes the invariant so it can be checked from outside:
the sum of every claim's deposited ledger equals the escrow total.

## Finality

Settlement is scheduled by the adjudication with `emit(on="finalized")`, which
runs after the appeal window closes. The money moves because the protocol
finalized the decision, not because this application decided to call it final.

A manual `settle` exists so funds cannot be stranded by a message that never
arrives. It refuses until the recorded finality grace has passed on the
transaction clock, so it is a recovery path and not a way around the wait.

## What a finalized result does not mean

It means: given these frozen conditions and this submitted evidence, GenLayer
reached a finalized consensus finding under the rules in
[adjudication.md](adjudication.md).

It is **not** evidence that:

- the named organisation published the page, or that a domain is theirs;
- a source is authentic, or was published when it says;
- the claim is true in the world beyond what the evidence shows;
- every relevant source was found. The protocol reads what was submitted.

A content reference is a reference. `CONFIRMED` means the frozen conditions
were satisfied by the evidence on the record -- not that nothing else exists.

## What has and has not been checked

138 Direct Mode tests against a harness where the validator genuinely runs,
including rounds where the leader and the validators read the same page
differently; a live run on StudioNet reaching all five verdicts with published
transaction hashes; and the adversarial cases above exercised in both.

None of that is an audit. Two of the defects fixed during this build were found
by the live network and the browser after the mocked suite had agreed with
itself, which is the honest argument for running both.

## Reporting

This is a build on a test network. If you find something wrong with it, open an
issue with the transaction hash or the test that shows it.

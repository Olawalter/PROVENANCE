# Adjudication

How a claim is read, who reads it, and exactly what has to agree before
anything is written.

## The boundary

```
DETERMINISTIC
  read the frozen claim, the frozen policy, the evidence references
        |
NON-DETERMINISTIC  (gl.vm.run_nondet_unsafe)
  fetch each source
  read each source against the frozen claim
  return one structured reading per source
        |
EQUIVALENCE PRINCIPLE
  leader proposes the readings
  every validator produces its own and compares the consequential fields
        |
DETERMINISTIC
  re-check the accepted answer
  derive the verdict under the frozen policy
  write storage, and only here
```

Nothing is written to storage from inside the non-deterministic block and no
value leaves from inside one. Different validators observe different
intermediate values in there; writing from inside would record whichever node
happened to run.

## What the model is asked, and what it is never asked

One source at a time, with the claim, and nothing else. It never sees the
other evidence on the claim, is never told what the policy is, and is never
asked for a verdict.

| Asked | Why it has to be a reading |
| --- | --- |
| `position` | does this document state the claim, contradict it, or not settle it |
| `source_class` | is this the announcement itself, or a report of one |
| `event_time` | when the document says the thing happened |
| `publication_time` | when the document says it was published |
| `quote` | the words that settle it |

Never asked, because deterministic code does it better and cannot be talked
out of it:

- **authority** -- a string comparison against domains frozen with the claim;
- **policy satisfaction** -- arithmetic over the readings;
- **independence** -- distinct origins, counted;
- **timeliness** -- the extracted times against the frozen window;
- **the verdict** -- derived, in ordinary Python, from everything above.

A model asked for a headline will reach for one. A model asked a narrow
question about one document usually answers it.

## Grounding

A `SUPPORTS` or `CONTRADICTS` reading must quote five consecutive words that
really appear in the document, compared after both sides have had their markup
and edge punctuation normalised away. A quotation almost always stops
mid-sentence, so `UTC.` and `UTC` have to be the same word; `error.code` and
`transaction_id` must survive intact, because a claim is usually about exactly
one named thing.

A reading that cannot be grounded becomes `SILENT` -- in both directions. An
ungrounded refutation is held exactly as an ungrounded confirmation is, because
a floor that caught only one direction would quietly favour whoever benefits
from the other.

## What validators compare

Every validator fetches every source itself, reads it itself, and compares
these fields and no others:

```
evidence_id
reachable
position
source_class
event_before_relevant      (not the timestamp: which side of the frozen moment)
published_in_window        (not the timestamp: inside the frozen window or not)
```

**Excluded deliberately:** the quote's wording, the note, the exact timestamps,
the HTTP status, the order things come back in.

Two honest readers never write the same sentence about the same page, and they
routinely extract a timestamp from different parts of it -- one reads the
dateline, one reads the byline. Making prose or exact times decisive would fail
every honest round while making nothing safer. What has a consequence is which
side of the frozen thresholds a time falls on, and that is what must agree.

```
leader SUPPORTS / PRIMARY / inside window      validator the same          agree
leader SUPPORTS                                validator CONTRADICTS        disagree
leader "resumed at 13:42"                      validator "13:42 UTC resume" agree
leader published 14:30 (inside)                validator 2025-01-01 (outside) disagree
```

A validator that checked the leader's JSON parsed, carried a known status and
had non-empty prose would have verified nothing -- it would have confirmed the
leader can format output. The current GenLayer documentation says exactly this,
and it is why every validator here does the work again.

## When the leader fails instead of answering

The validator does the work too, and compares failures rather than refusing
every leader failure on principle:

| The leader | This node | Outcome |
| --- | --- | --- |
| refused deterministically (`[EXPECTED]`, `[EXTERNAL]`) | the same refusal | agree, and the round fails with that reason |
| failed transiently (`[TRANSIENT]`) | also transient | agree: the network being unreachable twice is one fact |
| returned something unreadable (`[LLM_ERROR]`) | anything | disagree, so the round rotates to another leader |
| failed | reached an answer | disagree |

An unreadable model answer never agrees with anything, including another
unreadable answer. On chain that is a transaction that writes nothing and ends
undetermined, which is the right outcome: a reading nobody could check is not a
reading.

## After consensus

The accepted answer is checked again, deterministically, before a word is
stored: one reading per piece of evidence, no unknown or duplicate ids, nothing
outside the vocabulary. An answer that fails is rejected rather than repaired,
because a repaired answer is one nobody evaluated.

Then the verdict is derived:

```
nothing could be read                                  ->  UNAVAILABLE
relevant sources disagree and the policy cannot rank   ->  CONFLICTED
sources contradict it and none support it              ->  REFUTED
the policy is satisfied and sources support it         ->  CONFIRMED
anything else                                          ->  INSUFFICIENT
```

`INSUFFICIENT` is the default on purpose. A protocol that reaches for an answer
when the evidence does not support one is worse than useless, because it is
confident.

## Rounds that write nothing

A round the validators do not agree about writes nothing at all. The claim is
left exactly as it was and anybody may ask again. This is a real outcome, not
an error path: it is what the protocol does when a question is genuinely
contested, and the interface says so rather than showing a verdict.

The states a GenLayer transaction passes through and the states a claim passes
through are different things, and the console keeps them apart. A transaction
can be finalized while the claim it carried reads `INSUFFICIENT`.

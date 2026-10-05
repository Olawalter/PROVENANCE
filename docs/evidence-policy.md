# Evidence policy

Five policies. Each one is a different answer to the same question: what is
allowed to establish this claim at all.

The policy is chosen when a claim is frozen, before any evidence exists, and
nothing can change it afterwards. A model never selects it, never interprets
it, and is never told which one is in force.

## Five separate questions

The specification insists these be kept apart, and the contract does:

```
the source exists
the source is relevant
the source is authoritative
the source satisfies the policy
the source supports the claim
```

A page can exist, be relevant, be read correctly, and still not be allowed to
establish the claim. That is not a failure of the page; it is the policy doing
its job.

## Authority is frozen, not judged

Whoever registers a claim names the domains that count as the official source
and as the regulator. Authority is then a string comparison against that list:
an exact host, or a subdomain of one.

```
official_domains = ["acme-exchange.example"]

https://acme-exchange.example/status          OFFICIAL
https://status.acme-exchange.example/x        OFFICIAL   (a subdomain)
https://acme-exchange.example.evil.test/x     OTHER      (a different site)
https://daily-ledger.example/story            OTHER
```

Nothing a model says about a publisher's standing can widen this. A reader
calling a blog "the official announcement" changes nothing, and the end-to-end
run proves it on chain: a real page that is not the frozen official source is
read, and recorded with `qualifying: 0`.

## OFFICIAL_ONLY

Only a source on the frozen official domains can establish or refute the claim.

Reporting may well be accurate. It is not what was frozen, and the protocol
says `INSUFFICIENT` rather than quietly accepting a good substitute. A claim
frozen with this policy and no official domain is refused at freeze time,
because it would be unsatisfiable by construction and nothing later could
explain why.

Two official sources that disagree produce `CONFLICTED` with the conflict
recorded as `UNRESOLVED`: one class of source counts here and it disagrees with
itself, so nothing in the frozen policy can break the tie.

## REGULATORY

Only a regulator or public authority on the frozen regulator domains counts.
The subject's own announcement does not satisfy it, however clear that
announcement is.

## MULTI_SOURCE

Several sufficiently independent origins must support the claim.

Independence is counted by origin, not by URL. Three articles repeating one
announcement are one origin, not three, and a document that says it is
reporting somebody else's announcement does not count as an independent origin
at all. This is why `MULTI_SOURCE` can return `INSUFFICIENT` with four URLs
attached, and why that is the honest answer:

```
daily-ledger.example/acme-resume       SUPPORTS   secondary
daily-ledger.example/acme-follow-up    SUPPORTS   secondary
                                       ------------------------
supporting: 2     independent origins: 1     -> INSUFFICIENT
```

## PRIMARY_PLUS_CORROBORATION

At least one primary record -- the announcement, statement or register entry
itself -- plus at least one independent source corroborating it.

This is the policy where the frozen rules can rank sources, so a conflict
between the primary record and a report *of* that record is recorded as a
material conflict and resolved rather than left unresolved.

## OPEN_EVIDENCE

Any public source may be considered. Relevance, timeliness, grounding and
sufficiency are still assessed, and silence is still not a promise: a page that
does not settle the claim contributes nothing, whoever published it.

This is the right policy when the question is "what does the public record
show", and the wrong one when the question is "what did this organisation
actually say".

## What every policy still enforces

Whichever policy is frozen:

- a decisive reading must quote the document;
- a source published outside the observation window does not count;
- for a `TEMPORAL_FACT`, an event outside the claimed moment does not count;
- an unreachable source is recorded as unreachable rather than assumed hostile;
- nothing a contributor writes about their own source affects any of it.

## Choosing one

| If the question is | Freeze |
| --- | --- |
| what did this organisation officially say | `OFFICIAL_ONLY` |
| what has the authority confirmed | `REGULATORY` |
| is this widely and independently reported | `MULTI_SOURCE` |
| did it happen, with the record and a check on it | `PRIMARY_PLUS_CORROBORATION` |
| what does the public record show at all | `OPEN_EVIDENCE` |

A policy that is stricter than the question deserves produces `INSUFFICIENT`
answers about claims that are perfectly true. That is not a bug, and it is the
reason the policy is chosen before anybody knows what will turn up.

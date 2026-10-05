# Direct Mode

```bash
python -m pytest tests/direct -q
```

The harness in `conftest.py` is a stand-in for the GenVM runtime, never for the
contract: no rule in it knows what a claim, a policy or a verdict is.

What makes it worth having is the part most contract test doubles leave out.
When the contract opens a consensus round, the leader function runs, and then
the validator function runs **again, separately**, against its own view of the
web and its own model answers. So a test can make two nodes read the same page
differently -- about what it says, what kind of document it is, or when it was
published -- and watch the round write nothing.

```python
h.says(url, position="SUPPORTS", ..., role="leader")
h.says(url, position="CONTRADICTS", ..., role="validator")
with expect_no_majority():
    adjudicate(h, claim_id)
```

| File | Covers |
| --- | --- |
| `test_claims.py` | declaring, freezing, and what freezing makes permanent |
| `test_evidence.py` | submitting sources, duplicates, the observation window |
| `test_policies.py` | every source policy, authority, independence, conflict |
| `test_temporal.py` | five separate times, and the stale-source case |
| `test_security.py` | injection, grounding, leader manipulation, model failure |
| `test_bounty.py` | custody, with three distinct accounts |
| `test_lifecycle.py` | the state machine, supersession, custody across paths |

`support.py` holds the worked claim they share: the specification's own
example, which is fictional on purpose.

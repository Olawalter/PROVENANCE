# Fixtures

These are **controlled test fixtures**, not real statements by real
organisations. "Acme Exchange" and the "Markets Authority" do not exist; the
specification's own worked example uses them for exactly that reason.

They are here because the end-to-end run has to read something over the real
web, with real validators fetching it independently, and a live third-party
page would change under the run and prove nothing twice. Each file is served
from a commit-pinned URL, so the bytes a validator fetches today are the bytes
it fetched when the record below was written.

Nothing in this repository presents them as real evidence, and the end-to-end
report says the same thing where it reports the run.

| File | Stands for |
| --- | --- |
| `official-status.txt` | the exchange's own service status page |
| `regulator-notice.txt` | a public authority's market notice |
| `press-report.txt` | reporting of the announcement |
| `stale-report.txt` | a page about the earlier suspension, true when written |
| `hostile-page.txt` | a page that tells the reader what to conclude |

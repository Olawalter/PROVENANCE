# Deploying and verifying

What is deployed, how to deploy it again, how to check the chain holds this
source, and the traps this environment sets. Each trap below cost real time to
find; none of them is in any document you would read first.

## What is deployed now

The machine-readable record is [deployment.json](deployment.json), written by
the deploy script rather than typed. `docs/schema.json` is the schema read back
off the chain, which is what the console was wired against.

| | |
| --- | --- |
| Network | GenLayer StudioNet, chain `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Runner | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |

## Prerequisites

```bash
python -m pip install -r requirements-dev.txt
python -m pip install --user --force-reinstall --no-deps genvm-linter==0.11.1rc2
```

```bash
npm install
```

Python 3.11 or newer. Node 22.12 or newer.

## Lint, test, then deploy

```bash
genvm-lint check contracts/provenance.py --json
python -m pytest tests/direct -q
```

```bash
python scripts/deploy.py
```

The deploy script refuses to send bytes nobody can identify later: the contract
has to be committed and unmodified, and pinned to the runner this network
serves. Afterwards it reads the contract back with `gen_getContractCode` and
compares it byte for byte with the file it sent, then writes
`docs/deployment.json` naming the commit the bytes came from.

Nothing here depends on a key only the author holds. The deployer keeps
nothing: there is no owner field, no admin role and no upgrade path, so the
account that deploys the contract can do no more afterwards than anybody else.
Its key lives in `.data/` (gitignored) and is never printed.

## Verifying a deployment you did not do

```bash
python scripts/deploy.py --verify
genlayer code --address <address> --rpc https://studio.genlayer.com/api
genlayer schema --address <address> --rpc https://studio.genlayer.com/api
```

The first proves the deployed bytes hash to what this repository contains. The
last lists the methods the chain will actually answer, which is the honest way
to check that a console is not reading a contract that no longer exists.

## Driving it end to end

```bash
python scripts/live.py
```

Six claims and a set of refusals on the live network, asserted rather than
printed: a wrong verdict, a missing refusal or a source that qualified when the
policy excludes it fails the run. It writes `docs/live.json`, and
[END-TO-END.md](../END-TO-END.md) is generated from that record:

```bash
python scripts/report.py
```

It costs real consensus rounds on a shared network, so expect it to take a
while.

## The console

```bash
npm run dev
```

No setup step: `.env` is committed and already names the deployed contract.
Neither value in it is a secret. To point the console elsewhere, put the same
names in `.env.local` or set them as real environment variables; both take
precedence and neither is committed.

The address is read at **build** time, so a new contract means committing the
new default (or setting the variable in the host) and rebuilding. A redeploy
that skips the rebuild serves a console pointed at the previous contract, which
looks exactly like a working console answering about nothing.

## The traps

### The SDK version is per network

`genlayer-js@2.0.0-rc.1` encodes a call's method name under an **empty**
calldata key. StudioNet's runner refuses that with `execution failed` -- not a
version warning, a flat refusal that looks exactly like a contract bug.
`genlayer-js@1.1.8` encodes it under `method`, which this runner accepts, and
that is what the console is pinned to.

The reverse is also true elsewhere: the rc is the version a newer runner
generation needs. The pin belongs to the chain, not to the calendar.

A corollary that cost an hour: **a probe script has to live inside the
project.** A file in a temp directory resolves `node_modules` from its own
location, so it can silently load a different copy of the SDK and report that
everything works.

### genvm-lint and non-ASCII

The linter reads the contract with the platform's own codec, so a single curly
quote in the source stops it dead with a decode error rather than a lint
message. The contract is pure ASCII, and characters that need to be in a string
are written with `chr()`.

Also: `genvm-linter` 0.11.0 cannot validate against a genvm-manager v0.6 bundle
at all -- it looks for a per-runner `.tar` and those bundles ship `.zip`. A
plain `pip install` silently keeps the old version; it needs
`--force-reinstall --no-deps`.

### A character class with a lone backslash

`re.compile("[...\\]+")` with a bare backslash at the end of a character class
escapes the closing bracket, and the contract fails to load with "unterminated
character set". `genvm-lint`'s validate step catches this where the lint step
does not, which is the argument for reading both halves of its output.

### A Windows checkout deploys different bytes

Git converts line endings on checkout, so the same commit can produce CRLF on
one machine and LF on another, and the deployed bytes then hash differently
from the repository's. `.gitattributes` keeps every text file LF in the working
tree on every platform, and the deploy script normalises before it hashes or
sends anything.

### The hosted RPC drops connections

The public endpoint resets connections mid-flight, serves a CDN error page
instead of JSON, and rate-limits bursts. `scripts/transport.py` retries those
and **only** those: a real answer, including a refusal, is never retried.
Retrying until a contract agrees with you is not verification.

### Pinned fixtures have to be pushed first

The live suite pins every fixture URL to the current commit. If that commit is
not on GitHub yet, every URL 404s, every source reads `UNAVAILABLE`, and the
run looks like a protocol failure. The suite now checks the pinned URLs resolve
before the first write and says which problem it is.

## Networks

| Network | Chain | Notes |
| --- | --- | --- |
| StudioNet | `61999` | gasless; what this build targets |
| Asimov, Bradbury | public testnets | need funded accounts from the browser faucet at [testnet-faucet.genlayer.foundation](https://testnet-faucet.genlayer.foundation/), which cannot be automated |

A contract pinned to one network's runner is refused by another. The deploy
script reads the pin out of the contract's first line and refuses to send bytes
the configured chain cannot run.

## When a transaction fails

```bash
genlayer receipt <txHash> --stdout --stderr
genlayer schema <address>
genlayer code <address>
```

Read the state before changing code, then classify the failure honestly:
contract, schema, wallet, network, fee, non-deterministic execution,
Equivalence Principle, validator consensus, finality, or frontend integration.
Three of the defects fixed during this build looked like contract bugs and were
not.

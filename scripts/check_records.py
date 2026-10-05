#!/usr/bin/env python3
"""Hold the repository to the records it publishes.

    python scripts/check_records.py

The claims in README.md and END-TO-END.md are strong ones: these bytes are on
that chain, those hashes came from that run. A claim like that decays silently
-- the contract gets one more fix, the record keeps describing the version
before it, and nothing fails. This is what notices.

It touches no network. It only checks that the files agree with each other.
"""
import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def main():
    problems = []
    deployment = read("docs/deployment.json")

    source = (ROOT / deployment["source"]).read_bytes()
    if b"\r\n" in source:
        problems.append(
            f"{deployment['source']} has CRLF line endings in this checkout, so "
            f"it hashes differently from the LF bytes that were deployed. "
            f".gitattributes pins this; a working copy made before it was added "
            f"needs re-checking out")
    digest = hashlib.sha256(source).hexdigest()
    if digest != deployment["source_sha256"]:
        problems.append(
            f"{deployment['source']} hashes to {digest[:16]}..., but the "
            f"deployment record says {deployment['source_sha256'][:16]}...: the "
            f"contract has changed since it was deployed, so nothing may claim "
            f"the chain holds this source")
    if deployment["onchain_sha256"] != digest:
        problems.append("the deployment record's on-chain hash is not this source")
    if not deployment.get("byte_identical"):
        problems.append("the record itself says the deployment is not byte-identical")

    address = deployment["contract_address"]

    live = read("docs/live.json")
    if live["contract"].lower() != address.lower():
        problems.append(
            f"the live record is about {live['contract']}, but the deployed "
            f"contract is {address}: the published run did not exercise what is "
            f"deployed")
    if live.get("failed"):
        problems.append(f"the committed live record is a failed run: {live['failed']}")

    # the console ships pointed at the deployed contract, not at a previous one
    for name in (".env", ".env.example"):
        text = (ROOT / name).read_text(encoding="utf-8")
        if address not in text:
            problems.append(f"{name} does not carry {address}, so the console "
                            f"ships pointed at a different contract")

    # the README's headline address is the deployed one
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    addresses = set(re.findall(r"0x[0-9a-fA-F]{40}", readme))
    stale = {a for a in addresses if a.lower() != address.lower()}
    if stale:
        problems.append(f"README.md names {', '.join(sorted(stale))}, which is "
                        f"not the deployed contract")

    # the report is generated, never typed: a hash edited by hand in a published
    # report is exactly the kind of quiet falsehood this product is about
    drift = subprocess.run([sys.executable, str(ROOT / "scripts" / "report.py"),
                            "--check"], cwd=ROOT, capture_output=True, text=True)
    if drift.returncode != 0:
        problems.append(drift.stdout.strip()
                        or "END-TO-END.md has drifted from docs/live.json")

    for problem in problems:
        print(f"PROBLEM  {problem}")
    if problems:
        return 1
    print(f"the records agree: {deployment['source']} is byte-identical to "
          f"{address} on chain {deployment['chain_id']}, the published run "
          f"exercised it, and the report is generated from that run")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

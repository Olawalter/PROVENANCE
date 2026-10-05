#!/usr/bin/env python3
"""PROVENANCE end to end on StudioNet, asserted rather than printed.

    python scripts/live.py --address 0x...

Six claims against the deployed contract, chosen so that every verdict the
protocol can reach is reached by real validators reading real URLs over the
real web -- including the two verdicts a product like this is tempted to leave
out, because they are the ones that say "we cannot tell you".

Every evidence URL is commit-pinned, and the documents behind them are
controlled test fixtures that say so in their own text. The claim is the
specification's worked example, which is fictional on purpose.

The run writes docs/live.json. A hash typed by hand is a claim; a hash written
by the run is a record. It costs real consensus rounds on a shared network and
takes a while.
"""
import argparse
import json
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
RECORD = ROOT / "docs" / "live.json"

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import transport  # noqa: F401,E402

from eth_account import Account                                   # noqa: E402
from genlayer_py import create_account, create_client             # noqa: E402
from genlayer_py.chains import studionet                          # noqa: E402
from genlayer_py.types.transactions import TransactionHashVariant  # noqa: E402

EXPLORER = "https://explorer-studio.genlayer.com"
RAW = "https://raw.githubusercontent.com/Olawalter/PROVENANCE"
FIXTURE_HOST = "raw.githubusercontent.com"
# A real, stable page that is genuinely not the official source of anything
# about this claim. It is here to be excluded by a policy, which is a thing
# worth proving on chain rather than only in a test double.
OUTSIDE_SOURCE = "https://www.iana.org/help/example-domains"

SUBJECT = "Acme Exchange"
PREDICATE = "resumed_withdrawals"
VALUE = "true"
STATEMENT = ("Acme Exchange officially resumed withdrawals before 14:00 UTC on "
             "28 September 2026.")
RELEVANT = "2026-09-28T14:00:00Z"


def say(line=""):
    print(line, flush=True)


def git(*args) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                          text=True).stdout.strip()


class Failed(Exception):
    pass


def check(condition, message):
    if not condition:
        raise Failed(message)


class Run:
    """One live run, and the record it leaves behind."""

    def __init__(self, address, pin):
        self.address = address
        self.pin = pin
        self.record = {
            "network": "GenLayer StudioNet", "chain_id": studionet.id,
            "rpc": studionet.rpc_urls["default"]["http"][0],
            "contract": address, "fixtures_commit": pin,
            "fixtures_are_fixtures": (
                "Every evidence URL below is a commit-pinned controlled test "
                "fixture in this repository, except the IANA page, which is a "
                "real page included because it is genuinely not an official "
                "source for this claim. Acme Exchange does not exist."),
            "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "accounts": {}, "transactions": [], "claims": {}, "refusals": [],
            "custody": {},
        }
        self.accounts = {}

    # -- accounts -------------------------------------------------------------
    def account(self, label):
        if label not in self.accounts:
            key = Account.create()
            account = create_account(account_private_key=key.key.hex())
            self.accounts[label] = account
            self.record["accounts"][label] = account.address
        return self.accounts[label]

    def client(self, label):
        return create_client(chain=studionet, account=self.account(label))

    # -- calls ----------------------------------------------------------------
    def write(self, label, method, args, step=None, expect_refusal=False,
              value=None):
        client = self.client(label)
        kwargs = {"address": self.address, "function_name": method, "args": args}
        if value is not None:
            kwargs["value"] = value
        tx_hash = client.write_contract(**kwargs)
        receipt = client.wait_for_transaction_receipt(
            transaction_hash=tx_hash, status="ACCEPTED", interval=4000, retries=200)
        leader = ((receipt.get("consensus_data") or {}).get("leader_receipt")
                  or [{}])[0]
        execution = leader.get("execution_result")
        refused = execution is not None and execution != "SUCCESS"
        reason = ""
        if refused:
            payload = (leader.get("result") or {})
            reason = payload if isinstance(payload, str) else json.dumps(payload)[:300]
        entry = {
            "step": step or method, "method": method, "caller": label,
            "tx": str(tx_hash),
            "status": receipt.get("status_name") or str(receipt.get("status")),
            "consensus": receipt.get("result_name") or str(receipt.get("result", "")),
            "execution": execution, "refused": refused,
        }
        votes = (receipt.get("consensus_data") or {}).get("votes") or {}
        counts = {}
        for vote in votes.values():
            counts[str(vote)] = counts.get(str(vote), 0) + 1
        entry["votes"] = counts
        if refused:
            entry["refusal"] = reason
            self.record["refusals"].append(entry)
        self.record["transactions"].append(entry)
        say(f"  {entry['step'][:46]:46} {str(tx_hash)[:14]}...  "
            f"{entry['status']} {execution} {counts}"
            + (f"  REFUSED: {reason[:70]}" if refused else ""))
        if expect_refusal:
            check(refused, f"{entry['step']} was supposed to be refused")
        else:
            check(not refused, f"{entry['step']} was refused: {reason}")
        return entry

    def read(self, method, args=None, final=False):
        """A read, from an account that can do nothing.

        A reader account is needed to sign the call, not to be trusted with
        anything: every view on this contract is open, and a read that depended
        on who was asking would not be a public record."""
        client = self.client("reader")
        return client.read_contract(
            address=self.address, function_name=method, args=args or [],
            transaction_hash_variant=(TransactionHashVariant.LATEST_FINAL if final
                                      else TransactionHashVariant.LATEST_NONFINAL))

    # -- building blocks ------------------------------------------------------
    def claim(self, label, start, end, claim_type="EVENT_STATE", statement=STATEMENT):
        before = self.read("get_protocol")["counts"]["claims"]
        self.write("creator", "declare_claim",
                   [claim_type, SUBJECT, PREDICATE, VALUE, statement, RELEVANT,
                    start, end], step=f"declare {label}")
        listed = self.read("list_claims", [0, 1])
        claim_id = listed["items"][0]["claim_id"]
        check(self.read("get_protocol")["counts"]["claims"] == before + 1,
              "the claim count did not move")
        return claim_id

    def fixture(self, name):
        return f"{RAW}/{self.pin}/fixtures/{name}.txt"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--address", default="")
    args = parser.parse_args()

    address = args.address
    if not address:
        record = json.loads((ROOT / "docs" / "deployment.json").read_text())
        address = record["contract_address"]
    pin = git("rev-parse", "HEAD")

    run = Run(address, pin)
    say(f"PROVENANCE live run against {address}")
    say(f"fixtures pinned at {pin[:12]}")
    say()

    protocol = run.read("get_protocol")
    check(protocol["rules"] == "provenance-adjudication-1", "unexpected rules")
    say(f"protocol  {protocol['version']}  rules {protocol['rules']}")
    say()

    # -- 1. confirmed -------------------------------------------------------
    say("CLAIM 1  the official record says it happened")
    confirmed = run.claim("confirmed", "2026-09-28T00:00:00Z", "2030-01-01T00:00:00Z")
    run.write("creator", "freeze_claim",
              [confirmed, "OPEN_EVIDENCE", [FIXTURE_HOST], [], 1, 0],
              step="freeze confirmed")
    run.write("submitter", "submit_evidence",
              [confirmed, run.fixture("official-status"), "the status page"],
              step="submit official status")
    run.write("reader", "adjudicate", [confirmed], step="adjudicate confirmed")
    outcome = run.read("get_claim_adjudication", [confirmed])
    say(f"    -> {outcome['verdict']}  policy satisfied "
        f"{outcome['source_policy_satisfied']}  conflict {outcome['conflict_status']}")
    check(outcome["verdict"] == "CONFIRMED",
          f"expected CONFIRMED, got {outcome['verdict']}")
    run.record["claims"]["confirmed"] = {
        "claim_id": confirmed, "expected": "CONFIRMED", "adjudication": outcome,
        "evidence": run.read("get_claim_evidence", [confirmed])["items"]}

    # -- 2. refuted, by a page that tried to give orders ---------------------
    say("CLAIM 2  a document that tells the reader what to conclude")
    refuted = run.claim("refuted", "2026-09-28T00:00:00Z", "2030-01-01T00:00:00Z")
    run.write("creator", "freeze_claim",
              [refuted, "OPEN_EVIDENCE", [FIXTURE_HOST], [], 1, 0],
              step="freeze refuted")
    run.write("submitter", "submit_evidence",
              [refuted, run.fixture("hostile-page"), "a status page"],
              step="submit hostile page")
    run.write("reader", "adjudicate", [refuted], step="adjudicate refuted")
    outcome = run.read("get_claim_adjudication", [refuted])
    say(f"    -> {outcome['verdict']}")
    check(outcome["verdict"] == "REFUTED",
          f"the injected instruction demanded SUPPORTS; got {outcome['verdict']}")
    run.record["claims"]["refuted"] = {
        "claim_id": refuted, "expected": "REFUTED", "adjudication": outcome,
        "evidence": run.read("get_claim_evidence", [refuted])["items"]}

    # -- 3. conflicted -------------------------------------------------------
    say("CLAIM 3  two sources that disagree")
    conflicted = run.claim("conflicted", "2026-09-28T00:00:00Z", "2030-01-01T00:00:00Z")
    run.write("creator", "freeze_claim",
              [conflicted, "OPEN_EVIDENCE", [FIXTURE_HOST], [], 1, 0],
              step="freeze conflicted")
    run.write("submitter", "submit_evidence",
              [conflicted, run.fixture("official-status"), "the status page"],
              step="submit supporting source")
    run.write("other", "submit_evidence",
              [conflicted, run.fixture("hostile-page"), "another status page"],
              step="submit contradicting source")
    run.write("reader", "adjudicate", [conflicted], step="adjudicate conflicted")
    outcome = run.read("get_claim_adjudication", [conflicted])
    say(f"    -> {outcome['verdict']}  conflict {outcome['conflict_status']}")
    check(outcome["verdict"] == "CONFLICTED",
          f"expected CONFLICTED, got {outcome['verdict']}")
    run.record["claims"]["conflicted"] = {
        "claim_id": conflicted, "expected": "CONFLICTED", "adjudication": outcome,
        "evidence": run.read("get_claim_evidence", [conflicted])["items"]}

    # -- 4. insufficient, because the evidence is out of the window ----------
    say("CLAIM 4  a source that was true when it was written")
    stale = run.claim("stale", "2026-09-28T00:00:00Z", "2030-01-01T00:00:00Z")
    run.write("creator", "freeze_claim",
              [stale, "OPEN_EVIDENCE", [FIXTURE_HOST], [], 1, 0],
              step="freeze stale")
    run.write("submitter", "submit_evidence",
              [stale, run.fixture("stale-report"), "earlier coverage"],
              step="submit stale report")
    run.write("reader", "adjudicate", [stale], step="adjudicate stale")
    outcome = run.read("get_claim_adjudication", [stale])
    say(f"    -> {outcome['verdict']}  timely {outcome['timely']} of "
        f"{outcome['evidence_read']}")
    check(outcome["verdict"] in ("INSUFFICIENT", "REFUTED"),
          f"expected INSUFFICIENT, got {outcome['verdict']}")
    run.record["claims"]["stale"] = {
        "claim_id": stale, "expected": "INSUFFICIENT", "adjudication": outcome,
        "evidence": run.read("get_claim_evidence", [stale])["items"]}

    # -- 5. a policy that excludes the only source available -----------------
    say("CLAIM 5  a real page that is not the official source")
    outside = run.claim("outside", "2026-09-28T00:00:00Z", "2030-01-01T00:00:00Z")
    run.write("creator", "freeze_claim",
              [outside, "OFFICIAL_ONLY", [FIXTURE_HOST], [], 1, 0],
              step="freeze official-only")
    run.write("submitter", "submit_evidence",
              [outside, OUTSIDE_SOURCE, "a page from somewhere else"],
              step="submit a non-official source")
    run.write("reader", "adjudicate", [outside], step="adjudicate official-only")
    outcome = run.read("get_claim_adjudication", [outside])
    say(f"    -> {outcome['verdict']}  qualifying {outcome['qualifying']} of "
        f"{outcome['evidence_read']} read")
    check(outcome["verdict"] == "INSUFFICIENT",
          f"expected INSUFFICIENT, got {outcome['verdict']}")
    check(outcome["qualifying"] == 0,
          "a page outside the frozen official domain qualified anyway")
    run.record["claims"]["outside"] = {
        "claim_id": outside, "expected": "INSUFFICIENT", "adjudication": outcome,
        "evidence": run.read("get_claim_evidence", [outside])["items"]}

    # -- 6. unavailable ------------------------------------------------------
    say("CLAIM 6  a source that cannot be read")
    gone = run.claim("gone", "2026-09-28T00:00:00Z", "2030-01-01T00:00:00Z")
    run.write("creator", "freeze_claim",
              [gone, "OPEN_EVIDENCE", [FIXTURE_HOST], [], 1, 0], step="freeze gone")
    run.write("submitter", "submit_evidence",
              [gone, f"{RAW}/{pin}/fixtures/no-such-document.txt", "a dead link"],
              step="submit an unreachable source")
    run.write("reader", "adjudicate", [gone], step="adjudicate unavailable")
    outcome = run.read("get_claim_adjudication", [gone])
    say(f"    -> {outcome['verdict']}  unreachable {outcome['evidence_unreachable']}")
    check(outcome["verdict"] == "UNAVAILABLE",
          f"expected UNAVAILABLE, got {outcome['verdict']}")
    run.record["claims"]["gone"] = {
        "claim_id": gone, "expected": "UNAVAILABLE", "adjudication": outcome,
        "evidence": run.read("get_claim_evidence", [gone])["items"]}

    # -- what the contract refuses ------------------------------------------
    say()
    say("REFUSALS")
    draft = run.claim("draft", "2026-09-28T00:00:00Z", "2030-01-01T00:00:00Z")
    run.write("other", "freeze_claim",
              [draft, "OPEN_EVIDENCE", [FIXTURE_HOST], [], 1, 0],
              step="a stranger freezes a claim", expect_refusal=True)
    run.write("submitter", "submit_evidence",
              [draft, run.fixture("press-report"), "a report"],
              step="evidence before freezing", expect_refusal=True)
    run.write("reader", "adjudicate", [draft],
              step="adjudicate an unfrozen claim", expect_refusal=True)
    run.write("creator", "freeze_claim",
              [draft, "OPEN_EVIDENCE", [FIXTURE_HOST], [], 1, 0],
              step="freeze it properly")
    run.write("creator", "freeze_claim",
              [draft, "OFFICIAL_ONLY", [FIXTURE_HOST], [], 1, 0],
              step="change the policy after freezing", expect_refusal=True)
    run.write("submitter", "submit_evidence",
              [draft, run.fixture("press-report"), "a report"],
              step="submit a source")
    run.write("other", "submit_evidence",
              [draft, run.fixture("press-report"), "the same source again"],
              step="submit the same source twice", expect_refusal=True)
    run.write("creator", "cancel_claim", [draft],
              step="cancel a claim that has evidence", expect_refusal=True)

    # -- the record ----------------------------------------------------------
    run.record["custody"] = run.read("get_custody")
    run.record["protocol"] = run.read("get_protocol")
    run.record["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    RECORD.write_text(json.dumps(run.record, indent=2) + "\n", encoding="utf-8",
                      newline="")

    say()
    say(f"record    docs/live.json")
    say(f"explorer  {EXPLORER}/address/{address}")
    say(f"{len(run.record['transactions'])} transactions, "
        f"{len(run.record['refusals'])} refusals, "
        f"{len(run.record['claims'])} adjudications, every assertion passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Failed as problem:
        print(f"\nASSERTION FAILED: {problem}", flush=True)
        raise SystemExit(1)

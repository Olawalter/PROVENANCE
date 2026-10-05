#!/usr/bin/env python3
"""Deploy PROVENANCE to StudioNet, and prove the chain holds this source.

    python scripts/deploy.py              # deploy and record
    python scripts/deploy.py --verify     # check a recorded deployment, send nothing

It refuses to deploy bytes nobody can identify later: the contract has to be
committed and unmodified, and pinned to the runner this network actually
serves. After the transaction it reads the contract back off the chain with
gen_getContractCode and compares it byte for byte with the file it sent.

The deployer keeps nothing. PROVENANCE has no owner field, no admin role and no
upgrade path, so the account that deploys it can do no more afterwards than
anybody else. Its key lives in .data/ (gitignored) and is never printed.
"""
import argparse
import base64
import hashlib
import json
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "contracts" / "provenance.py"
RECORD = ROOT / "docs" / "deployment.json"
KEY_FILE = ROOT / ".data" / "deployer.json"
RUNNER = "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"
EXPLORER = "https://explorer-studio.genlayer.com"

from eth_account import Account                                   # noqa: E402
from genlayer_py import create_account, create_client             # noqa: E402
from genlayer_py.chains import studionet                          # noqa: E402

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import transport  # noqa: F401,E402  (patches the RPC transport on import)


def say(line):
    print(line, flush=True)


def source_bytes() -> bytes:
    """The committed source, with line endings normalised.

    A Windows checkout hands back the same commit with CRLF, which deploys
    bytes that hash differently from the ones in the repository -- so
    "byte-identical to the deployed bytes" would hold on the machine that
    deployed it and nowhere else.
    """
    return SOURCE.read_bytes().replace(b"\r\n", b"\n")


def git(*args) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                          text=True).stdout.strip()


def deployer():
    """A key that persists between runs, so the same account deploys and the
    file it lives in is never committed and never printed."""
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    if KEY_FILE.exists():
        stored = json.loads(KEY_FILE.read_text(encoding="utf-8"))
        return create_account(account_private_key=stored["private_key"])
    account = Account.create()
    KEY_FILE.write_text(json.dumps({"private_key": account.key.hex(),
                                    "address": account.address}, indent=2),
                        encoding="utf-8")
    return create_account(account_private_key=account.key.hex())


def onchain_bytes(client, address) -> bytes:
    answer = client.provider.make_request("gen_getContractCode", [address])
    raw = answer["result"] if isinstance(answer, dict) and "result" in answer else answer
    text = str(raw)
    if text.startswith("0x"):
        return bytes.fromhex(text[2:])
    return base64.b64decode(text)


def verify(client, address, code, digest) -> int:
    """Check an address without sending anything.

    This is the half of the claim that matters to a reader: the repository says
    the chain holds these bytes, and this is how that is checked rather than
    believed.
    """
    raw = onchain_bytes(client, address)
    live = hashlib.sha256(raw).hexdigest()
    identical = live == digest
    say(f"on-chain  {len(raw)} bytes  sha256 {live}")
    say(f"verdict   {'MATCH: the chain holds this source' if identical else 'DIFFERENT'}")
    schema = client.provider.make_request("gen_getContractSchema", [address])
    schema = schema.get("result", schema) if isinstance(schema, dict) else schema
    methods = sorted((schema or {}).get("methods", {}).keys())
    say(f"methods   {len(methods)}: {', '.join(methods)}")
    return 0 if identical else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify", action="store_true",
                        help="check the recorded deployment and send nothing")
    parser.add_argument("--address", default="")
    args = parser.parse_args()

    code_bytes = source_bytes()
    code = code_bytes.decode("utf-8")
    digest = hashlib.sha256(code_bytes).hexdigest()
    head = git("rev-parse", "HEAD")
    say(f"source    contracts/provenance.py @ {head[:12] or 'uncommitted'}  "
        f"{len(code_bytes)} bytes  sha256 {digest}")

    pinned = code.split('"')[3]
    if pinned != RUNNER:
        say(f"the contract pins {pinned}, which is not the runner this network "
            f"serves ({RUNNER}). A contract pinned to another network's runner "
            f"is refused outright, so this stops here.")
        return 1

    client = create_client(chain=studionet, account=deployer())

    if args.verify:
        address = args.address
        if not address and RECORD.exists():
            address = json.loads(RECORD.read_text(encoding="utf-8"))["contract_address"]
        if not address:
            say("pass --address 0x... or deploy first")
            return 1
        say(f"address   {address} (verifying only; nothing is deployed)")
        return verify(client, address, code, digest)

    dirty = git("status", "--porcelain", "contracts/provenance.py")
    if dirty or not head:
        say("the contract is uncommitted or modified. A deployment nobody can "
            "tie to a commit is a deployment nobody can check -- commit first.")
        return 1

    say("deploying (gasless on StudioNet; the deployer holds no privileges)")
    tx_hash = client.deploy_contract(code=code, args=[])
    say(f"submitted  {tx_hash}")
    # FINALIZED, not ACCEPTED: the record should say what was watched, and
    # waiting the appeal window out is the claim worth making
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash, status="FINALIZED", interval=4000, retries=200)
    tx_id = receipt.get("tx_id") or receipt.get("hash") or str(tx_hash)
    address = (receipt.get("data", {}) or {}).get("contract_address") \
        or receipt.get("contract_address")
    leader = ((receipt.get("consensus_data") or {}).get("leader_receipt") or [{}])[0]
    execution = leader.get("execution_result", "?")
    say(f"transaction {tx_id}")
    say(f"status     {receipt.get('status_name') or receipt.get('status')}  "
        f"execution {execution}")
    if execution != "SUCCESS" or not address:
        say("the deployment was refused; nothing was recorded")
        return 1
    say(f"address    {address}")

    raw = onchain_bytes(client, address)
    live = hashlib.sha256(raw).hexdigest()
    identical = live == digest
    say(f"on-chain   {len(raw)} bytes  sha256 {live}  "
        f"{'MATCH' if identical else 'DIFFERENT'}")

    schema = client.provider.make_request("gen_getContractSchema", [address])
    schema = schema.get("result", schema) if isinstance(schema, dict) else schema
    methods = sorted((schema or {}).get("methods", {}).keys())

    RECORD.parent.mkdir(parents=True, exist_ok=True)
    RECORD.write_text(json.dumps({
        "network": "GenLayer StudioNet",
        "chain_id": studionet.id,
        "rpc": studionet.rpc_urls["default"]["http"][0],
        "contract_address": address,
        "explorer": f"{EXPLORER}/address/{address}",
        "deploy_tx": tx_id,
        "deploy_status": receipt.get("status_name") or str(receipt.get("status")),
        "deploy_execution": execution,
        "source": "contracts/provenance.py",
        "source_commit": head,
        "source_sha256": digest,
        "source_bytes": len(code_bytes),
        "onchain_sha256": live,
        "byte_identical": identical,
        "genvm_runner": RUNNER,
        "methods": methods,
        "deployed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }, indent=2) + "\n", encoding="utf-8", newline="")
    say(f"record     docs/deployment.json")
    say("")
    say("console environment (.env.local):")
    say(f"NEXT_PUBLIC_CHAIN_ID={studionet.id}")
    say(f"NEXT_PUBLIC_PROVENANCE_CONTRACT={address}")
    return 0 if identical else 1


if __name__ == "__main__":
    raise SystemExit(main())

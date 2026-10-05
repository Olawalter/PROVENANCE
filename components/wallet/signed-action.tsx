"use client";

import { useCallback, useState } from "react";

import { contractAddress, walletClient } from "@/lib/genlayer/client";
import type { Call } from "@/lib/genlayer/contract";
import { initialTx, isRunning, send, type TxState } from "@/lib/genlayer/transaction";
import { useWallet } from "@/lib/wallet/wallet";
import { TxPanel } from "@/components/transactions/tx-panel";

/**
 * One wallet-signed call, with its whole lifecycle visible.
 *
 * Everything that changes state in this product goes through here, so there is
 * one place where a transaction's states are reported and one place to read
 * when asking whether the interface could ever call something final early.
 */
export function SignedAction(
  { call, label, busyLabel, onDone, disabled, children }: {
    call: () => Call;
    label: string;
    busyLabel?: string;
    onDone?: (state: TxState) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  },
) {
  const wallet = useWallet();
  const [state, setState] = useState<TxState>(initialTx);

  const run = useCallback(async () => {
    if (!wallet.provider || !wallet.address) {
      await wallet.connect();
      return;
    }
    const client = walletClient(
      wallet.address, wallet.provider) as unknown as Parameters<typeof send>[0];
    const finished = await send(client, call(), contractAddress(), setState);
    onDone?.(finished);
  }, [wallet, call, onDone]);

  return (
    <div className="grid gap-3">
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary"
                disabled={disabled || isRunning(state)}
                onClick={() => void run()}>
          {isRunning(state) ? (busyLabel ?? "Working") : label}
        </button>
        {!wallet.address ? (
          <span className="text-xs text-[var(--muted)]">
            A wallet signs this. Nothing is sent until it does.
          </span>
        ) : !wallet.onRightNetwork ? (
          <span className="text-xs text-[var(--conflict)]">
            The wallet is on another network.
          </span>
        ) : null}
      </div>
      <TxPanel state={state} />
    </div>
  );
}

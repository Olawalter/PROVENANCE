"use client";

import { useCallback } from "react";

import { writes } from "@/lib/genlayer/contract";
import type { TxState } from "@/lib/genlayer/transaction";
import { SignedAction } from "@/components/wallet/signed-action";

/**
 * Ask for an adjudication. Anybody may: a finding only its author could
 * request would be worth nothing to the people who depend on it.
 */
export function AdjudicateButton(
  { claimId, onDone }: { claimId: string; onDone?: (state: TxState) => void },
) {
  const call = useCallback(() => writes.adjudicate(claimId), [claimId]);
  return (
    <SignedAction call={call} label="Adjudicate this claim"
                  busyLabel="Validators are reading" onDone={onDone} />
  );
}

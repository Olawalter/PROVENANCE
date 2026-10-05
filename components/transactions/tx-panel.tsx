"use client";

import { explorerTx } from "@/lib/config/env";
import { LIFECYCLE_WORDS, words } from "@/lib/format/present";
import { isRunning, type TxState } from "@/lib/genlayer/transaction";

/**
 * What the transaction is doing, in the states the SDK actually reports.
 *
 * "Accepted" and "Finalized" are two different steps here and are never merged,
 * because they are two different facts about the network -- which is the whole
 * subject of this product.
 */
const STEPS: { phase: string; label: string }[] = [
  { phase: "wallet", label: "Signature" },
  { phase: "submitted", label: "Submitted" },
  { phase: "pending", label: "Validators deciding" },
  { phase: "accepted", label: "Accepted" },
  { phase: "finalized", label: "Finalized" },
];

const ORDER = ["idle", "preparing", "wallet", "submitted", "pending", "accepted",
               "finalizing", "finalized"];

export function TxPanel({ state }: { state: TxState }) {
  if (state.phase === "idle") return null;
  const reached = ORDER.indexOf(state.phase);

  return (
    <div className="panel grid gap-3 p-4" role="status" aria-live="polite">
      <p className="text-sm font-[540]">{words(LIFECYCLE_WORDS, state.phase)}</p>

      {state.phase !== "failed" ? (
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STEPS.map((step) => {
            const at = ORDER.indexOf(step.phase);
            const done = reached >= at;
            return (
              <li key={step.phase}
                  className={done ? "text-[var(--primary)]" : "text-[var(--muted)]"}>
                <span className="mono" aria-hidden>{done ? "+" : "·"}</span>{" "}
                {step.label}
              </li>
            );
          })}
        </ol>
      ) : null}

      {state.message ? (
        <p className={`text-xs ${state.phase === "failed"
          ? "text-[var(--refuted)]" : "text-[var(--muted)]"}`}>
          {state.message}
        </p>
      ) : null}

      {state.refusal ? (
        <p className="document text-[0.72rem]">{state.refusal}</p>
      ) : null}

      {state.votes && Object.keys(state.votes).length ? (
        <p className="text-xs text-[var(--muted)]">
          Validators:{" "}
          {Object.entries(state.votes)
            .map(([vote, count]) => `${count} ${vote.toLowerCase()}`)
            .join(", ")}
        </p>
      ) : null}

      {state.hash ? (
        <a className="mono text-xs underline decoration-dotted underline-offset-2"
           href={explorerTx(state.hash)} target="_blank" rel="noreferrer">
          {state.hash.slice(0, 18)}&hellip;
        </a>
      ) : null}

      {isRunning(state) ? (
        <p className="text-[0.7rem] text-[var(--muted)]">
          This takes a consensus round. Leaving the page does not stop it.
        </p>
      ) : null}
    </div>
  );
}

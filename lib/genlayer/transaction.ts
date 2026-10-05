/**
 * One write, and the states it really passes through.
 *
 * The states here map to things the SDK actually reports. There is no step
 * this console invents, and nothing is called finalized until the finalized
 * view says so -- that distinction is the whole point of the product, and a
 * progress bar that blurred it would undo it.
 */
import type { Call } from "@/lib/genlayer/contract";

export type TxPhase =
  | "idle" | "preparing" | "wallet" | "submitted" | "pending"
  | "accepted" | "finalizing" | "finalized" | "failed";

export type TxState = {
  phase: TxPhase;
  hash?: string;
  message?: string;
  refusal?: string;
  votes?: Record<string, number>;
  result?: string;
};

export const initialTx: TxState = { phase: "idle" };

export const isRunning = (state: TxState) =>
  !["idle", "finalized", "failed"].includes(state.phase);

type Receipt = {
  status?: string | number;
  status_name?: string;
  result_name?: string;
  consensus_data?: {
    votes?: Record<string, string>;
    leader_receipt?: { execution_result?: string; result?: unknown }[];
  };
};

type Client = {
  writeContract: (args: Record<string, unknown>) => Promise<string>;
  waitForTransactionReceipt: (args: Record<string, unknown>) => Promise<Receipt>;
};

export function votesOf(receipt: Receipt): Record<string, number> {
  const votes = Object.values(receipt?.consensus_data?.votes ?? {});
  return votes.reduce<Record<string, number>>(
    (seen, vote) => ({ ...seen, [vote]: (seen[vote] ?? 0) + 1 }), {});
}

/** The readable reason a refused transaction carries. */
export function refusalOf(receipt: Receipt): string {
  const leader = receipt?.consensus_data?.leader_receipt?.[0];
  const payload = (leader?.result ?? "") as unknown;
  const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? "");
  return text.slice(0, 300);
}

/**
 * Send one call and report each step as it happens.
 *
 * A refusal the validators agreed about is an outcome, not a transport
 * failure, and it is reported in those words: the contract said no, and the
 * network agreed that it said no.
 */
export async function send(
  client: Client,
  call: Call,
  address: string,
  onPhase: (state: TxState) => void,
): Promise<TxState> {
  let state: TxState = { phase: "preparing" };
  onPhase(state);

  try {
    state = { phase: "wallet" };
    onPhase(state);

    const hash = await client.writeContract({
      address, functionName: call.functionName, args: call.args,
      ...(call.value !== undefined ? { value: call.value } : {}),
    });

    state = { phase: "submitted", hash };
    onPhase(state);
    state = { phase: "pending", hash };
    onPhase(state);

    const accepted = await client.waitForTransactionReceipt({
      hash, status: "ACCEPTED", interval: 4000, retries: 300,
    });
    const execution = accepted?.consensus_data?.leader_receipt?.[0]?.execution_result;
    const votes = votesOf(accepted);

    if (execution && execution !== "SUCCESS") {
      state = { phase: "failed", hash, votes, refusal: refusalOf(accepted),
                message: "The contract refused this, and the validators agreed." };
      onPhase(state);
      return state;
    }

    state = { phase: "accepted", hash, votes };
    onPhase(state);

    state = { phase: "finalizing", hash, votes };
    onPhase(state);
    try {
      await client.waitForTransactionReceipt({
        hash, status: "FINALIZED", interval: 8000, retries: 150,
      });
      state = { phase: "finalized", hash, votes };
    } catch {
      // Not a failure. The decision stands and finality follows; saying
      // "finalized" here would be the one claim this product must not make.
      state = { phase: "accepted", hash, votes,
                message: "Accepted. Finality is still settling on the network." };
    }
    onPhase(state);
    return state;
  } catch (problem) {
    const text = String((problem as { message?: string })?.message ?? problem);
    const declined = /rejected|denied|4001/i.test(text);
    state = {
      phase: "failed",
      message: declined ? "The wallet declined this transaction."
                        : text.slice(0, 300),
    };
    onPhase(state);
    return state;
  }
}

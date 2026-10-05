"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { configResult } from "@/lib/config/env";
import { FINAL, NON_FINAL, contractAddress, readClient } from "@/lib/genlayer/client";
import type { Read } from "@/lib/genlayer/contract";

export type ReadState<T> = {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
};

/**
 * Skip a read only when the answer is already on the page and nobody is
 * looking. Never skip the first read of something: a page can change what it
 * is asking for while the tab is in the background, and a read skipped then
 * has nothing to trigger it again.
 */
export function skipRead(
  { key, loadedKey, hidden }: { key: string; loadedKey: string; hidden: boolean },
): boolean {
  return hidden && key !== "" && loadedKey === key;
}

/**
 * Read one thing from the contract.
 *
 * `final` decides which state is asked for, and the choice is never
 * incidental. Anything presented as settled is read finalized; a page
 * following something just submitted reads the newest state, because a write
 * is accepted long before it is final and the finalized view does not contain
 * it yet.
 */
export function useRead<T>(
  read: Read<T> | undefined,
  options: { final?: boolean; pollMs?: number } = {},
): ReadState<T> {
  const { final = false, pollMs = 0 } = options;
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [settled, setSettled] = useState("");
  const [nonce, setNonce] = useState(0);
  const loadedKey = useRef("");

  const key = read ? `${read.functionName}:${JSON.stringify(read.args)}:${final}` : "";
  const loading = Boolean(read) && configResult.ok && settled !== key;

  useEffect(() => {
    if (!read || !configResult.ok) return;
    let cancelled = false;

    const load = async () => {
      if (skipRead({ key, loadedKey: loadedKey.current,
                     hidden: typeof document !== "undefined" && document.hidden })) {
        return;
      }
      try {
        const answer = await readClient().readContract({
          address: contractAddress(),
          functionName: read.functionName,
          args: read.args,
          transactionHashVariant: final ? FINAL : NON_FINAL,
        } as never);
        if (cancelled) return;
        const parsed = read.schema.safeParse(answer);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          const where = first?.path?.join(".") || "the answer";
          setError(`The contract answered in a shape this console does not `
                   + `recognise (${where}: ${first?.message ?? "unexpected"}). It `
                   + `may be a different deployment than this console was built for.`);
        } else {
          setData(parsed.data);
          setError(undefined);
        }
      } catch (problem) {
        if (!cancelled) {
          setError(String((problem as { message?: string })?.message ?? problem)
            .slice(0, 300));
        }
      } finally {
        if (!cancelled) {
          loadedKey.current = key;
          setSettled(key);
        }
      }
    };

    void load();
    if (!pollMs) return () => { cancelled = true; };
    const timer = setInterval(load, pollMs);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, pollMs, final]);

  return { data, error, loading, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

export const SLOW_POLL = 60_000;

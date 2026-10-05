"use client";

import Link from "next/link";

import { configResult } from "@/lib/config/env";
import { reads } from "@/lib/genlayer/contract";
import { SLOW_POLL, useRead } from "@/lib/genlayer/hooks";
import { claimLabel } from "@/lib/format/present";
import { ConfigProblem, Loading, Nothing, Problem } from "@/components/shell/empty";
import { StateChip, VerdictChip } from "@/components/shell/status";

/**
 * Where evidence can be submitted, which is a different question from where
 * evidence exists: a claim stops accepting sources the moment its window
 * closes or it is decided, and saying so here saves a wasted transaction.
 */
export default function EvidencePage() {
  const claims = useRead(reads.claims(0, 50), { pollMs: SLOW_POLL });

  if (!configResult.ok) return <ConfigProblem />;
  if (claims.error) return <Problem message={claims.error} />;
  if (claims.loading) return <Loading what="the registry" />;

  const all = claims.data?.items ?? [];
  const open = all.filter((c) => ["EVIDENCE_OPEN", "EVIDENCE_SUBMITTED"]
    .includes(c.status));
  const closed = all.filter((c) => !open.includes(c) && c.evidence_count > 0);

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <p className="label">Evidence</p>
        <h1>Claims that are collecting sources</h1>
        <p className="lede max-w-2xl">
          Anybody may submit a public source. What a source turns out to be --
          official or not, primary or a report of one, decisive or disregarded --
          is decided when it is read, not when it is submitted.
        </p>
      </header>

      <section className="grid gap-3" aria-labelledby="open">
        <h2 id="open" className="label">Open for evidence</h2>
        {open.length === 0 ? (
          <Nothing title="No claim is collecting evidence"
                   detail="Every claim has either not been frozen yet, or has closed its observation window." />
        ) : (
          <ul className="panel divide-y divide-[var(--border)]">
            {open.map((claim) => (
              <li key={claim.claim_id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <Link href={`/claims/${claim.claim_id}`}
                        className="block text-[0.92rem] font-[540] underline
                                   decoration-dotted underline-offset-2">
                    {claim.subject}
                  </Link>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {claim.statement}
                  </span>
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {claim.evidence_count} submitted
                </span>
                <StateChip state={claim.status} />
                <Link href={`/evidence/submit?claim=${claim.claim_id}`}
                      className="btn text-xs">
                  Submit a source
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closed.length ? (
        <section className="grid gap-3" aria-labelledby="closed">
          <h2 id="closed" className="label">Closed, with evidence on the record</h2>
          <ul className="panel divide-y divide-[var(--border)]">
            {closed.map((claim) => (
              <li key={claim.claim_id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link href={`/claims/${claim.claim_id}`}
                      className="min-w-0 flex-1 text-[0.9rem] underline
                                 decoration-dotted underline-offset-2">
                  {claim.subject}
                  <span className="mono ml-2 text-[0.68rem] text-[var(--muted)]">
                    {claimLabel(claim.claim_id)}
                  </span>
                </Link>
                <span className="text-xs text-[var(--muted)]">
                  {claim.evidence_count} sources
                </span>
                <VerdictChip verdict={claim.verdict} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

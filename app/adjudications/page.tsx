"use client";

import Link from "next/link";

import { configResult } from "@/lib/config/env";
import { reads } from "@/lib/genlayer/contract";
import { SLOW_POLL, useRead } from "@/lib/genlayer/hooks";
import { formatTime } from "@/lib/format/present";
import { ConfigProblem, Loading, Nothing, Problem } from "@/components/shell/empty";
import { VerdictChip } from "@/components/shell/status";

/**
 * What GenLayer has adjudicated. A round with no majority wrote nothing and
 * does not appear here, which is why this list can be shorter than the number
 * of times somebody asked.
 */
export default function AdjudicationsPage() {
  const claims = useRead(reads.claims(0, 50), { pollMs: SLOW_POLL });

  if (!configResult.ok) return <ConfigProblem />;
  if (claims.error) return <Problem message={claims.error} />;
  if (claims.loading) return <Loading what="the record" />;

  const decided = (claims.data?.items ?? []).filter((c) => c.adjudication_id);

  return (
    <div className="grid gap-5">
      <header className="grid gap-2">
        <p className="label">Adjudications</p>
        <h1>What GenLayer has decided</h1>
        <p className="lede max-w-2xl">
          Each of these is a round in which every validator read the sources
          against the conditions frozen with the claim and had to agree about
          everything that has a consequence.
        </p>
      </header>

      {decided.length === 0 ? (
        <Nothing title="Nothing has been adjudicated yet"
                 detail="A claim needs frozen conditions and at least one source before it can be read." />
      ) : (
        <ul className="panel divide-y divide-[var(--border)]">
          {decided.map((claim) => (
            <li key={claim.claim_id}>
              <Link href={`/claims/${claim.claim_id}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3
                               transition-colors hover:bg-[var(--light)]/40">
                <span className="mono text-xs text-[var(--muted)]">
                  {claim.adjudication_id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.92rem] font-[540]">{claim.subject}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {claim.statement}
                  </span>
                </span>
                <VerdictChip verdict={claim.verdict} />
                <span className="text-xs text-[var(--muted)]">
                  {formatTime(claim.adjudicated_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

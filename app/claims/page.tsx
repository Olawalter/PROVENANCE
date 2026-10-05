"use client";

import Link from "next/link";
import { useState } from "react";

import { configResult } from "@/lib/config/env";
import { reads, VERDICTS } from "@/lib/genlayer/contract";
import { SLOW_POLL, useRead } from "@/lib/genlayer/hooks";
import { VERDICT_WORDS, claimLabel, formatTime, words } from "@/lib/format/present";
import { ConfigProblem, Loading, Nothing, Problem } from "@/components/shell/empty";
import { StateChip, VerdictChip } from "@/components/shell/status";

/**
 * The claim explorer: an information table, not a card wall. Status, subject,
 * claim, verdict, updated -- which is what somebody scanning for a particular
 * record actually needs.
 */
export default function ClaimsPage() {
  const [filter, setFilter] = useState<string>("ALL");
  const claims = useRead(reads.claims(0, 50), { pollMs: SLOW_POLL });

  if (!configResult.ok) return <ConfigProblem />;

  const all = claims.data?.items ?? [];
  const items = filter === "ALL" ? all : all.filter((c) => c.verdict === filter);

  return (
    <div className="grid gap-5">
      <header className="grid gap-2">
        <p className="label">Registry</p>
        <h1>Claims on this contract</h1>
        <p className="lede max-w-2xl">
          Every claim, its frozen conditions and what the evidence came to. Read
          from the deployment each time this page loads.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-1.5" role="group"
           aria-label="Filter by verdict">
        {["ALL", ...VERDICTS].map((value) => (
          <button key={value} type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`chip ${filter === value ? "tone-confirmed" : "tone-neutral"}`}>
            {value === "ALL" ? "All" : words(VERDICT_WORDS, value)}
          </button>
        ))}
        <Link href="/create" className="btn btn-primary ml-auto">Register a claim</Link>
      </div>

      {claims.error ? <Problem message={claims.error} />
        : claims.loading ? <Loading what="the registry" />
        : items.length === 0 ? (
          <Nothing title="Nothing here yet"
                   detail={filter === "ALL"
                     ? "No claims have been registered on this contract."
                     : "No claim has reached that verdict yet."} />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="text-sm">
              <caption className="sr-only">Claims registered on this contract</caption>
              <thead>
                <tr className="label border-b border-[var(--border)]">
                  <th scope="col" className="px-4 py-2.5 font-normal">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-normal">Subject</th>
                  <th scope="col" className="px-4 py-2.5 font-normal">Claim</th>
                  <th scope="col" className="px-4 py-2.5 font-normal">Verdict</th>
                  <th scope="col" className="px-4 py-2.5 font-normal">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((claim) => (
                  <tr key={claim.claim_id}
                      className="border-b border-[var(--border)] last:border-0
                                 transition-colors hover:bg-[var(--light)]/40">
                    <td className="px-4 py-3 align-top">
                      <StateChip state={claim.status} />
                    </td>
                    <td className="px-4 py-3 align-top font-[540]">
                      <Link href={`/claims/${claim.claim_id}`}
                            className="underline decoration-dotted underline-offset-2">
                        {claim.subject}
                      </Link>
                      <span className="mono block text-[0.68rem] text-[var(--muted)]">
                        {claimLabel(claim.claim_id)}
                      </span>
                    </td>
                    <td className="max-w-sm px-4 py-3 align-top text-[var(--muted)]">
                      {claim.statement}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {claim.verdict ? <VerdictChip verdict={claim.verdict} />
                        : <span className="text-xs text-[var(--muted)]">Not yet read</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[var(--muted)]">
                      {formatTime(claim.adjudicated_at || claim.frozen_at
                                  || claim.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

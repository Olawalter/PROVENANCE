"use client";

import Link from "next/link";

import { configResult } from "@/lib/config/env";
import { reads } from "@/lib/genlayer/contract";
import { SLOW_POLL, useRead } from "@/lib/genlayer/hooks";
import { formatTime, numberWord } from "@/lib/format/present";
import { ConfigProblem, Loading, Problem } from "@/components/shell/empty";
import { VerdictChip } from "@/components/shell/status";

/**
 * The overview. Restrained on purpose: four counts and the most recent
 * record, because this is a protocol for evidence and not a dashboard about
 * volume.
 */
export default function OverviewPage() {
  const protocol = useRead(reads.protocol, { pollMs: SLOW_POLL });
  const claims = useRead(reads.claims(0, 6), { pollMs: SLOW_POLL });

  if (!configResult.ok) return <ConfigProblem />;

  const items = claims.data?.items ?? [];
  const finalized = items.filter((c) => c.status === "ACCEPTED"
    || c.status === "SETTLED").length;
  const active = items.filter((c) => ["EVIDENCE_OPEN", "EVIDENCE_SUBMITTED",
    "REGISTERED", "ADJUDICATION_PENDING"].includes(c.status)).length;
  const superseded = items.filter((c) => c.status === "SUPERSEDED").length;

  return (
    <div className="grid gap-9">
      <header className="grid gap-4">
        <p className="label">Semantic change adjudication</p>
        <h1 className="editorial max-w-2xl">Evidence becomes state.</h1>
        <p className="lede max-w-2xl">
          PROVENANCE turns public evidence into independently adjudicated,
          time-bound semantic state finalized on GenLayer. The conditions are
          frozen before the evidence is collected, every validator reads the
          sources itself, and the verdict is derived in the contract from what
          they agreed.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/create" className="btn btn-primary">Register a claim</Link>
          <Link href="/claims" className="btn">Explore claims</Link>
        </div>
      </header>

      <section aria-labelledby="counts" className="grid gap-3">
        <h2 id="counts" className="label">On this contract</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Count label="Claims" value={protocol.data?.counts?.claims} />
          <Count label="Adjudicated" value={protocol.data?.counts?.adjudications} />
          <Count label="Open" value={claims.loading ? undefined : active} />
          <Count label="Superseded" value={claims.loading ? undefined : superseded} />
        </dl>
        <p className="text-xs text-[var(--muted)]">
          Read from the deployment each time this page loads. Nothing is indexed
          anywhere else, so what is shown is what the chain holds.
        </p>
      </section>

      <section aria-labelledby="recent" className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="recent" className="label">Most recent claims</h2>
          <Link href="/claims" className="text-xs underline decoration-dotted
                                          underline-offset-2">
            All claims
          </Link>
        </div>

        {claims.error ? <Problem message={claims.error} />
          : claims.loading ? <Loading what="the registry" />
          : items.length === 0 ? (
            <div className="panel p-6">
              <h3 className="text-[0.95rem]">No claims yet</h3>
              <p className="lede mt-1">
                A claim is a subject, a predicate and the moment it is about,
                frozen before anybody looks for evidence.
              </p>
            </div>
          ) : (
            <ul className="panel divide-y divide-[var(--border)]">
              {items.map((claim) => (
                <li key={claim.claim_id}>
                  <Link href={`/claims/${claim.claim_id}`}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4
                                   py-3 transition-colors hover:bg-[var(--light)]/40">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.92rem] font-[540]">
                        {claim.subject}
                      </span>
                      <span className="block truncate text-xs text-[var(--muted)]">
                        {claim.statement}
                      </span>
                    </span>
                    <VerdictChip verdict={claim.verdict} />
                    <span className="text-xs text-[var(--muted)]">
                      {formatTime(claim.adjudicated_at || claim.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section aria-labelledby="how" className="grid gap-3">
        <h2 id="how" className="label">How a claim becomes state</h2>
        <ol className="panel grid gap-0 divide-y divide-[var(--border)] text-sm">
          {[
            ["Declare", "A claim as structure: a subject, a predicate, the value "
              + "asserted and the moment it is about."],
            ["Freeze", "The evidence policy, the authoritative domains and the "
              + "observation window become immutable, before any evidence exists."],
            ["Collect", "Anybody submits public sources. Nobody gets to declare "
              + "their own source decisive."],
            ["Adjudicate", "Every validator fetches each source, reads it against "
              + "the frozen claim, and they must agree about what has a consequence."],
            ["Accept", "GenLayer consensus accepts the result, and the contract "
              + "derives the verdict from the agreed readings."],
            ["Finalize", "The appeal window closes. Only then is the decision "
              + "final, and only then does any bounty settle."],
          ].map(([step, detail], index) => (
            <li key={step} className="flex gap-3 p-4">
              <span className="mono text-xs text-[var(--muted)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="font-[540]">{step}</span>
                <span className="block text-[var(--muted)]">{detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="panel px-4 py-3">
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 text-2xl font-[520] tabular-nums">
        {value === undefined ? <span className="text-[var(--muted)]">&mdash;</span>
          : value}
      </dd>
      {value !== undefined && value <= 12 ? (
        <dd className="text-[0.7rem] text-[var(--muted)]">{numberWord(value)}</dd>
      ) : null}
    </div>
  );
}

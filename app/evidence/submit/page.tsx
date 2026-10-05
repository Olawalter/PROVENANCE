"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { configResult } from "@/lib/config/env";
import { reads, writes } from "@/lib/genlayer/contract";
import { useRead } from "@/lib/genlayer/hooks";
import { claimLabel, formatTime } from "@/lib/format/present";
import { ConfigProblem, Loading, Problem } from "@/components/shell/empty";
import { SignedAction } from "@/components/wallet/signed-action";
import { policyWords } from "@/components/shell/status";

export default function SubmitEvidencePage() {
  return (
    <Suspense fallback={<Loading what="this claim" />}>
      <SubmitEvidence />
    </Suspense>
  );
}

function SubmitEvidence() {
  const params = useSearchParams();
  const claimId = params.get("claim") ?? "";
  const claim = useRead(claimId ? reads.claim(claimId) : undefined);
  const [url, setUrl] = useState("");
  const [context, setContext] = useState("");
  const [done, setDone] = useState(false);

  const call = useCallback(() => writes.submitEvidence(claimId, url.trim(),
                                                       context.trim()),
                           [claimId, url, context]);

  if (!configResult.ok) return <ConfigProblem />;
  if (!claimId) return <Problem message="No claim was named." />;
  if (claim.error) return <Problem message={claim.error} />;
  if (claim.loading || !claim.data) return <Loading what="this claim" />;

  const record = claim.data;
  const wellFormed = /^https:\/\/[^\s<>]+$/.test(url.trim());
  const open = ["EVIDENCE_OPEN", "EVIDENCE_SUBMITTED"].includes(record.status);

  return (
    <div className="grid max-w-2xl gap-6">
      <header className="grid gap-2">
        <p className="label">Evidence</p>
        <h1>Submit a source</h1>
        <p className="lede">
          For <Link href={`/claims/${record.claim_id}`}
                    className="underline decoration-dotted underline-offset-2">
            {record.subject}
          </Link>{" "}
          &mdash; {record.statement}
        </p>
      </header>

      <section className="panel grid gap-2 p-4 text-sm">
        <p className="label">What this claim was frozen with</p>
        <p>{policyWords(record.source_policy)}</p>
        <p className="text-xs text-[var(--muted)]">
          Evidence must have been published between{" "}
          {formatTime(record.observation_start)} and{" "}
          {formatTime(record.observation_end)} to count.
          {record.official_domains.length ? (
            <> The official source for this claim is{" "}
              <span className="mono">{record.official_domains.join(", ")}</span>.</>
          ) : null}
        </p>
      </section>

      {!open ? (
        <p className="panel p-4 text-sm">
          This claim is not accepting evidence: it is{" "}
          <span className="font-[540]">{record.status.toLowerCase().replace(/_/g, " ")}</span>.
        </p>
      ) : done ? (
        <div className="panel grid gap-2 p-4">
          <p className="text-sm font-[540]">Recorded.</p>
          <p className="lede">
            The source is on the claim. What it turns out to be is decided when
            it is read, by validators, not here.
          </p>
          <Link className="btn" href={`/claims/${record.claim_id}`}>
            Back to the claim
          </Link>
        </div>
      ) : (
        <SignedAction call={call} label="Submit this source"
                      busyLabel="Recording"
                      disabled={!wellFormed}
                      onDone={(state) => {
                        if (state.phase === "accepted" || state.phase === "finalized") {
                          setDone(true);
                        }
                      }}>
          <div className="grid gap-4">
            <label className="grid gap-1">
              <span className="label">Source URL</span>
              <input className="field mono" value={url} inputMode="url"
                     placeholder="https://"
                     onChange={(event) => setUrl(event.target.value)} />
              <span className="text-xs text-[var(--muted)]">
                Must be https, and must be a page a validator can fetch. Each
                source can be submitted to a claim once.
              </span>
            </label>

            <label className="grid gap-1">
              <span className="label">Context (optional)</span>
              <input className="field" value={context} maxLength={300}
                     placeholder="what this page is"
                     onChange={(event) => setContext(event.target.value)} />
              <span className="text-xs text-[var(--muted)]">
                A note for people reading the record. It does not influence the
                adjudication: calling your own source decisive here changes
                nothing.
              </span>
            </label>
          </div>
        </SignedAction>
      )}
    </div>
  );
}

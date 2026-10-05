"use client";

import Link from "next/link";
import { use, useState } from "react";

import { configResult, explorerAddress } from "@/lib/config/env";
import { reads, type Claim, type Evidence } from "@/lib/genlayer/contract";
import { useRead } from "@/lib/genlayer/hooks";
import {
  CLAIM_TYPE_WORDS, claimLabel, evidenceLabel, formatGen, formatTime,
  shortAddress, shortDigest, words,
} from "@/lib/format/present";
import { ConfigProblem, Loading, Problem } from "@/components/shell/empty";
import {
  AuthorityChip, PositionChip, RoleChip, StateChip, VerdictChip,
  conflictWords, evidenceStatusWords, policyWords, sourceClassWords,
} from "@/components/shell/status";
import { Timeline, type Moment } from "@/components/evidence/timeline";
import { WhyThisVerdict } from "@/components/adjudication/why";
import { AdjudicateButton } from "@/components/adjudication/adjudicate-button";

/**
 * The claim. Everything needed to reconstruct the decision, in the order a
 * reader needs it: what was claimed, what was frozen, what was observed and
 * when, which sources disagreed, what was adjudicated, what GenLayer accepted,
 * and whether it is final yet.
 */
export default function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const claim = useRead(reads.claim(id), { final: false });
  // Whether the finalized view answers IS the finality: the contract cannot
  // record the status of the transaction that wrote it, and this is the honest
  // way to ask.
  const settled = useRead(reads.claim(id), { final: true });
  const evidence = useRead(reads.claimEvidence(id), { final: false });
  const adjudication = useRead(
    claim.data?.adjudication_id ? reads.claimAdjudication(id) : undefined,
    { final: false });

  if (!configResult.ok) return <ConfigProblem />;
  if (claim.error) return <Problem message={claim.error} />;
  if (claim.loading || !claim.data) return <Loading what="this claim" />;

  const record = claim.data;
  const items = evidence.data?.items ?? [];
  const finalized = Boolean(settled.data?.adjudication_id)
    && settled.data?.adjudication_id === record.adjudication_id;

  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono text-xs text-[var(--muted)]">
            {claimLabel(record.claim_id)}
          </span>
          <StateChip state={record.status} />
          {record.verdict ? <VerdictChip verdict={record.verdict} /> : null}
          {record.adjudication_id ? (
            <FinalityChip finalized={finalized} checking={settled.loading} />
          ) : null}
        </div>

        <h1 className="max-w-3xl">{record.subject}</h1>
        <p className="lede max-w-3xl">{record.statement}</p>

        <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--muted)]">
          <Pair term="Type">{words(CLAIM_TYPE_WORDS, record.claim_type)}</Pair>
          <Pair term="Predicate"><span className="mono">{record.predicate}</span></Pair>
          <Pair term="Asserted"><span className="mono">{record.requested_value}</span></Pair>
          <Pair term="Declared by">
            <span className="mono">{shortAddress(record.creator)}</span>
          </Pair>
          {record.superseded_by ? (
            <Pair term="Superseded by">
              <Link className="underline decoration-dotted underline-offset-2"
                    href={`/claims/${record.superseded_by}`}>
                {claimLabel(record.superseded_by)}
              </Link>
            </Pair>
          ) : null}
        </dl>
      </header>

      {record.superseded_by ? (
        <p className="panel p-3 text-xs text-[var(--muted)]">
          A later claim now carries this question. Nothing below has been
          rewritten: this is what was recorded, and it stays what was recorded.
        </p>
      ) : null}

      {/* -- frozen conditions ------------------------------------------- */}
      <section className="grid gap-3" aria-labelledby="frozen">
        <h2 id="frozen" className="label">What was frozen, before any evidence</h2>
        <div className="panel grid gap-3 p-4 text-sm">
          <Row label="Evidence policy">
            {record.source_policy ? policyWords(record.source_policy)
              : "not frozen yet"}
          </Row>
          {record.official_domains.length ? (
            <Row label="Official source">
              <span className="mono">{record.official_domains.join(", ")}</span>
            </Row>
          ) : null}
          {record.regulator_domains.length ? (
            <Row label="Regulator">
              <span className="mono">{record.regulator_domains.join(", ")}</span>
            </Row>
          ) : null}
          <Row label="Sources required">
            {record.min_sources}
            {record.min_independent > 0
              ? `, of which ${record.min_independent} independent` : ""}
          </Row>
          <Row label="Observation window">
            {formatTime(record.observation_start)} to {formatTime(record.observation_end)}
          </Row>
          <Row label="Frozen at">
            {record.frozen_at ? formatTime(record.frozen_at) : "not frozen yet"}
          </Row>
          {Number(record.bounty_deposited) > 0 ? (
            <Row label="Evidence bounty">
              {formatGen(record.bounty_deposited)}
              <span className="text-[var(--muted)]">
                {" "}&mdash; paid where evidence materially carried the verdict
              </span>
            </Row>
          ) : null}
        </div>
        <p className="text-xs text-[var(--muted)]">
          These conditions became immutable when the claim was frozen. Nobody,
          including the account that declared it, can change them now.
        </p>
      </section>

      {/* -- the timeline -------------------------------------------------- */}
      <section className="grid gap-3" aria-labelledby="times">
        <h2 id="times" className="label">When each thing happened</h2>
        <div className="panel p-4">
          <Timeline moments={momentsOf(record, items)} />
        </div>
      </section>

      {/* -- evidence ------------------------------------------------------ */}
      <section className="grid gap-3" aria-labelledby="evidence">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="evidence" className="label">The sources that were read</h2>
          {["EVIDENCE_OPEN", "EVIDENCE_SUBMITTED"].includes(record.status) ? (
            <Link href={`/evidence/submit?claim=${record.claim_id}`}
                  className="btn btn-quiet text-xs">
              Submit a source
            </Link>
          ) : null}
        </div>

        {evidence.loading ? <Loading what="the evidence" />
          : items.length === 0 ? (
            <div className="panel p-5">
              <p className="text-sm">No sources have been submitted yet.</p>
              <p className="lede mt-1">
                Anybody may submit one. Nobody gets to declare their own source
                decisive -- that is an answer, and it comes later.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3">
              {items.map((item) => (
                <li key={item.evidence_id}>
                  <EvidenceCard evidence={item} />
                </li>
              ))}
            </ul>
          )}
      </section>

      {/* -- adjudication -------------------------------------------------- */}
      {adjudication.data ? (
        <>
          <section className="grid gap-3" aria-labelledby="adjudication">
            <h2 id="adjudication" className="label">Adjudication</h2>
            <div className="panel grid gap-3 p-4 text-sm sm:grid-cols-2">
              <Row label="Sources evaluated">
                {adjudication.data.evidence_read + adjudication.data.evidence_unreachable}
              </Row>
              <Row label="Satisfying the policy">{adjudication.data.qualifying}</Row>
              <Row label="Inside the window">{adjudication.data.timely}</Row>
              <Row label="Supporting / contradicting">
                {adjudication.data.supporting} / {adjudication.data.contradicting}
              </Row>
              <Row label="Independent origins">
                {adjudication.data.independent_supporting}
              </Row>
              <Row label="Conflict">
                {conflictWords(adjudication.data.conflict_status)}
              </Row>
            </div>
          </section>

          <WhyThisVerdict claim={record} adjudication={adjudication.data}
                          finalized={finalized} />

          <section className="grid gap-2" aria-labelledby="checking">
            <h2 id="checking" className="label">Checking this</h2>
            <div className="panel grid gap-2 p-4 text-xs">
              <Row label="Adjudication">
                <span className="mono">{adjudication.data.adjudication_id}</span>
              </Row>
              <Row label="What the validators agreed">
                <span className="mono break-all">
                  {adjudication.data.decisive_digest}
                </span>
              </Row>
              <Row label="Rules"><span className="mono">{adjudication.data.rules}</span></Row>
              <Row label="Contract">
                <a className="mono underline decoration-dotted underline-offset-2"
                   href={explorerAddress(configResult.config.contract)}
                   target="_blank" rel="noreferrer">
                  {configResult.config.contract}
                </a>
              </Row>
            </div>
          </section>
        </>
      ) : items.length > 0 ? (
        <section className="panel grid gap-3 p-5">
          <h2 className="text-[0.95rem]">Not adjudicated yet</h2>
          <p className="lede">
            Anybody can ask for this. One consensus round reads every source
            above against the conditions frozen with the claim; a round the
            validators do not agree about writes nothing, and can be asked again.
          </p>
          <AdjudicateButton claimId={record.claim_id} onDone={() => {
            claim.reload(); evidence.reload(); adjudication.reload();
          }} />
        </section>
      ) : null}
    </div>
  );
}

function momentsOf(claim: Claim, items: Evidence[]): Moment[] {
  const read = items.filter((item) => item.status === "READ");
  const earliest = (values: string[]) =>
    values.filter(Boolean).sort()[0] ?? "";

  return [
    {
      label: "Event",
      iso: earliest(read.map((item) => item.event_time)),
      detail: "when the sources say the thing itself happened",
      strong: true,
    },
    {
      label: "Publication",
      iso: earliest(read.map((item) => item.publication_time)),
      detail: "when the earliest source says it was published",
    },
    {
      label: "Claim frozen",
      iso: claim.frozen_at,
      detail: "the conditions became immutable, before the evidence was collected",
      strong: true,
    },
    {
      label: "Observation",
      iso: earliest(read.map((item) => item.observation_time)),
      detail: "when validators fetched and read the sources",
    },
    {
      label: "Adjudication",
      iso: claim.adjudicated_at,
      detail: "when consensus accepted the result",
      strong: true,
    },
    {
      label: "Settlement",
      iso: claim.settled_at,
      detail: "when the bounty moved, after the decision became final",
    },
  ];
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="panel">
      <div className="panel-head flex flex-wrap items-center gap-2">
        <span className="mono text-xs">{evidenceLabel(evidence.evidence_id)}</span>
        {evidence.authority ? <AuthorityChip authority={evidence.authority} /> : null}
        {evidence.source_class ? (
          <span className="chip tone-neutral">
            {sourceClassWords(evidence.source_class)}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          {evidence.position ? <PositionChip position={evidence.position} /> : null}
          {evidence.role ? <RoleChip role={evidence.role} /> : null}
        </span>
      </div>

      <div className="grid gap-3 p-4 text-sm">
        <div>
          <p className="label">Source</p>
          <a href={evidence.source_url} target="_blank" rel="noreferrer noopener"
             className="mono mt-0.5 block break-all text-xs underline
                        decoration-dotted underline-offset-2">
            {evidence.source_url}
          </a>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {evidenceStatusWords(evidence.status)}
            {evidence.submitted_by
              ? ` · submitted by ${shortAddress(evidence.submitted_by)}` : ""}
          </p>
        </div>

        {evidence.quote ? (
          <div>
            <p className="label">Quoted from the source</p>
            <blockquote className="mt-1 border-l-2 border-[var(--border)] pl-3
                                   text-[var(--text)]">
              {evidence.quote}
            </blockquote>
          </div>
        ) : evidence.status === "READ" ? (
          <p className="text-[var(--muted)]">
            Nothing in this source settles the claim either way.
          </p>
        ) : null}

        {evidence.note ? (
          <div>
            <button type="button" className="btn btn-quiet px-0 text-xs"
                    aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? "Hide the reading" : "Why those words settle it"}
            </button>
            {open ? (
              <p className="mt-1 text-[var(--muted)]">{evidence.note}</p>
            ) : null}
          </div>
        ) : null}

        {(evidence.event_time || evidence.publication_time) ? (
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--muted)]">
            {evidence.event_time ? (
              <Pair term="Event">{formatTime(evidence.event_time)}</Pair>
            ) : null}
            {evidence.publication_time ? (
              <Pair term="Published">{formatTime(evidence.publication_time)}</Pair>
            ) : null}
            {evidence.observation_time ? (
              <Pair term="Observed">{formatTime(evidence.observation_time)}</Pair>
            ) : null}
          </dl>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Accepted and finalized are two different facts, so they get two different
 * words. Nothing here calls a decision permanent while the network is still
 * settling it.
 */
function FinalityChip({ finalized, checking }: { finalized: boolean; checking: boolean }) {
  if (checking) return <span className="chip tone-neutral">Checking finality</span>;
  return finalized
    ? <span className="chip tone-confirmed"
            title="Present in the finalized state on the network">Finalized</span>
    : <span className="chip tone-conflict"
            title="The decision exists and can be read; the appeal window has not closed">
        Accepted, not yet final
      </span>;
}

function Pair({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt>{term}</dt>
      <dd className="text-[var(--text)]">{children}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      <span className="min-w-44 text-[var(--muted)]">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

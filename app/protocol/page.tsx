"use client";

import { configResult, explorerAddress } from "@/lib/config/env";
import { reads } from "@/lib/genlayer/contract";
import { useRead } from "@/lib/genlayer/hooks";
import {
  POLICY_WORDS, STATE_WORDS, VERDICT_MEANING, VERDICT_WORDS, formatGen, words,
} from "@/lib/format/present";
import { ConfigProblem, Loading, Problem } from "@/components/shell/empty";
import { VerdictChip } from "@/components/shell/status";

/**
 * The protocol as the deployed contract describes itself.
 *
 * Read off the chain rather than written here, so this page cannot drift away
 * from the contract it documents.
 */
export default function ProtocolPage() {
  const protocol = useRead(reads.protocol);
  const custody = useRead(reads.custody);

  if (!configResult.ok) return <ConfigProblem />;
  if (protocol.error) return <Problem message={protocol.error} />;
  if (protocol.loading || !protocol.data) return <Loading what="the protocol" />;

  const info = protocol.data;

  return (
    <div className="grid gap-7">
      <header className="grid gap-2">
        <p className="label">Protocol</p>
        <h1>What this contract will and will not say</h1>
        <p className="lede max-w-2xl">
          Everything on this page is read from the deployed contract, not
          written into this console, so it cannot drift away from what is
          actually running.
        </p>
      </header>

      <section className="panel grid gap-2 p-4 text-sm" aria-labelledby="scope">
        <h2 id="scope" className="label">Scope</h2>
        <p>{info.scope}</p>
      </section>

      <section className="grid gap-3" aria-labelledby="verdicts">
        <h2 id="verdicts" className="label">The verdicts it can reach</h2>
        <ul className="panel divide-y divide-[var(--border)]">
          {info.verdicts.map((verdict) => (
            <li key={verdict} className="flex flex-wrap items-baseline gap-3 p-4">
              <VerdictChip verdict={verdict} />
              <span className="min-w-0 flex-1 text-sm text-[var(--muted)]">
                {VERDICT_MEANING[verdict] ?? ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[var(--muted)]">
          Two of these say the protocol cannot tell you. They exist because the
          alternative is a product that always answers, including when it should
          not.
        </p>
      </section>

      <section className="grid gap-3" aria-labelledby="policies">
        <h2 id="policies" className="label">Evidence policies</h2>
        <dl className="panel divide-y divide-[var(--border)] text-sm">
          {info.source_policies.map((policy) => (
            <div key={policy} className="grid gap-1 p-4">
              <dt className="font-[540]">{words(POLICY_WORDS, policy)}</dt>
              <dd className="text-[var(--muted)]">{POLICY_DETAIL[policy] ?? ""}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-3" aria-labelledby="states">
        <h2 id="states" className="label">The states a claim can hold</h2>
        <div className="panel flex flex-wrap gap-2 p-4">
          {info.states.map((state) => (
            <span key={state} className="chip tone-neutral">
              {words(STATE_WORDS, state)}
            </span>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">
          Accepted means consensus accepted the result. Finalized means the
          appeal window has closed. They are different facts, and this console
          asks the finalized view directly rather than inferring one from the
          other.
        </p>
      </section>

      <section className="grid gap-3" aria-labelledby="custody">
        <h2 id="custody" className="label">Custody</h2>
        <div className="panel grid gap-2 p-4 text-sm">
          <Row label="Held in escrow">{formatGen(info.escrow_held)}</Row>
          {custody.data ? (
            <>
              <Row label="Sum of every claim's ledger">
                {formatGen(custody.data.sum_of_claims)}
              </Row>
              <Row label="Balanced">
                {custody.data.balanced ? "yes" : "no"}
              </Row>
              <Row label="Settlements">{custody.data.settlements}</Row>
            </>
          ) : null}
          <p className="text-xs text-[var(--muted)]">
            Published as a view so the invariant can be checked from outside
            rather than taken on trust: the sum of every claim&apos;s deposited
            ledger is the escrow total, always.
          </p>
        </div>
      </section>

      <section className="grid gap-2" aria-labelledby="deployment">
        <h2 id="deployment" className="label">This deployment</h2>
        <div className="panel grid gap-2 p-4 text-xs">
          <Row label="Contract">
            <a className="mono underline decoration-dotted underline-offset-2"
               href={explorerAddress(configResult.config.contract)}
               target="_blank" rel="noreferrer">
              {configResult.config.contract}
            </a>
          </Row>
          <Row label="Version"><span className="mono">{info.version}</span></Row>
          <Row label="Rules"><span className="mono">{info.rules}</span></Row>
          <Row label="Chain">
            <span className="mono">{configResult.config.chainId}</span>
          </Row>
        </div>
      </section>
    </div>
  );
}

const POLICY_DETAIL: Record<string, string> = {
  OFFICIAL_ONLY: "Only a source on the domains frozen as official can establish "
    + "or refute the claim. Reporting may well be right; it is not what was frozen.",
  REGULATORY: "Only a regulator or public authority on the frozen domains counts.",
  MULTI_SOURCE: "Several sufficiently independent origins must support it. "
    + "Pages repeating one announcement are one origin, however many there are.",
  PRIMARY_PLUS_CORROBORATION: "The primary record, plus at least one independent "
    + "source corroborating it.",
  OPEN_EVIDENCE: "Any public source may be considered, and relevance, timeliness "
    + "and sufficiency are still assessed.",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3">
      <span className="min-w-52 text-[var(--muted)]">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

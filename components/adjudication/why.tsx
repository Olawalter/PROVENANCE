"use client";

import type { Adjudication, Claim } from "@/lib/genlayer/contract";
import { VERDICT_MEANING, VERDICT_WORDS, words } from "@/lib/format/present";
import { conflictWords, policyWords } from "@/components/shell/status";

/**
 * Why this claim reached the verdict it did.
 *
 * Every line is a fact from the record with the answer the protocol gave,
 * including the lines where the answer is no. There is no confidence score
 * here and there will not be one: a percentage would describe a trust model
 * this product does not have.
 */
export function WhyThisVerdict(
  { claim, adjudication, finalized }:
  { claim: Claim; adjudication: Adjudication; finalized: boolean },
) {
  const checks: { met: boolean | null; text: string }[] = [
    {
      met: adjudication.evidence_read > 0,
      text: adjudication.evidence_read > 0
        ? `${adjudication.evidence_read} of `
          + `${adjudication.evidence_read + adjudication.evidence_unreachable} `
          + `sources could be read`
        : "no source could be retrieved",
    },
    {
      met: adjudication.qualifying > 0,
      text: adjudication.qualifying > 0
        ? `${adjudication.qualifying} of them satisfy the frozen source policy `
          + `(${policyWords(adjudication.source_policy)})`
        : `none of them satisfies the frozen source policy `
          + `(${policyWords(adjudication.source_policy)})`,
    },
    {
      met: adjudication.temporal_condition_satisfied,
      text: adjudication.temporal_condition_satisfied
        ? `${adjudication.timely} fall inside the observation window frozen with `
          + `the claim`
        : "none falls inside the observation window frozen with the claim",
    },
    {
      met: adjudication.source_policy_satisfied,
      text: adjudication.source_policy_satisfied
        ? "the evidence requirement the claim was frozen with is met"
        : "the evidence requirement the claim was frozen with is not met",
    },
    {
      met: adjudication.conflict_status === "NONE"
        ? true
        : adjudication.verdict === "CONFLICTED" ? false : null,
      text: adjudication.conflict_status === "NONE"
        ? "no relevant source contradicts another"
        : adjudication.verdict === "CONFLICTED"
          ? `${adjudication.supporting} relevant source(s) support the claim and `
            + `${adjudication.contradicting} contradict it, and the frozen policy `
            + `cannot rank them`
          : `relevant sources disagree, and the frozen policy ranks them: `
            + `${conflictWords(adjudication.conflict_status)}`,
    },
    {
      met: true,
      text: "GenLayer validators each read the sources and agreed about every "
            + "answer that has a consequence",
    },
    {
      met: finalized ? true : null,
      text: finalized
        ? "the appeal window has closed and this is final"
        : "accepted by consensus; the appeal window has not closed yet",
    },
  ];

  return (
    <section className="panel" aria-labelledby="why">
      <div className="panel-head">
        <h2 id="why" className="label">
          Why this claim reads {words(VERDICT_WORDS, adjudication.verdict)}
        </h2>
      </div>
      <div className="grid gap-3 p-4">
        <p className="text-sm">
          <span className="font-[540]">
            {words(VERDICT_WORDS, adjudication.verdict)}
          </span>
          <span className="text-[var(--muted)]">
            {" "}&mdash; {VERDICT_MEANING[adjudication.verdict] ?? ""}.
          </span>
        </p>
        <ul className="grid gap-1.5 text-sm">
          {checks.map((check) => (
            <li key={check.text} className="flex gap-2.5">
              <span aria-hidden className={`mono mt-0.5 text-xs ${
                check.met === null ? "text-[var(--muted)]"
                  : check.met ? "text-[var(--primary)]" : "text-[var(--refuted)]"}`}>
                {check.met === null ? "·" : check.met ? "+" : "x"}
              </span>
              <span className="sr-only">
                {check.met === null ? "pending: " : check.met ? "yes: " : "no: "}
              </span>
              <span className={check.met === false ? "text-[var(--refuted)]" : ""}>
                {check.text}
              </span>
            </li>
          ))}
        </ul>
        <p className="rounded-[3px] border border-dashed border-[var(--border)] p-3
                      text-xs text-[var(--muted)]">
          The verdict is derived in the contract from the readings the validators
          agreed about, under the rules named{" "}
          <span className="mono">{adjudication.rules}</span>. No model named it.
          Reloading this page reads it back from the chain rather than from
          anything this browser kept.
        </p>
      </div>
    </section>
  );
}

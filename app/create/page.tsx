"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { configResult } from "@/lib/config/env";
import { CLAIM_TYPES, POLICIES, writes } from "@/lib/genlayer/contract";
import { CLAIM_TYPE_WORDS, POLICY_WORDS, formatTime, words } from "@/lib/format/present";
import { ConfigProblem } from "@/components/shell/empty";
import { SignedAction } from "@/components/wallet/signed-action";

/**
 * Declare, then freeze. Two transactions on purpose, and the review step shows
 * exactly what the second one makes permanent.
 */
const STEPS = ["Define", "Evidence policy", "Time conditions", "Review and register"];

export default function CreateClaimPage() {
  const [step, setStep] = useState(0);
  const [claimType, setClaimType] = useState<string>("EVENT_STATE");
  const [subject, setSubject] = useState("");
  const [predicate, setPredicate] = useState("");
  const [value, setValue] = useState("true");
  const [statement, setStatement] = useState("");
  const [policy, setPolicy] = useState<string>("PRIMARY_PLUS_CORROBORATION");
  const [officialDomains, setOfficialDomains] = useState("");
  const [regulatorDomains, setRegulatorDomains] = useState("");
  const [minSources, setMinSources] = useState(1);
  const [minIndependent, setMinIndependent] = useState(0);
  const [relevant, setRelevant] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [claimId, setClaimId] = useState("");
  const [frozen, setFrozen] = useState(false);

  const domains = (text: string) =>
    text.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

  const iso = (local: string) => (local ? `${local}:00Z`.replace(" ", "T") : "");

  const defined = subject.trim() && predicate.trim() && value.trim()
    && statement.trim();
  const timed = relevant && start && end;
  const policyReady = policy !== "OFFICIAL_ONLY" || domains(officialDomains).length > 0;

  const declareCall = useCallback(() => writes.declareClaim(
    claimType, subject.trim(), predicate.trim(), value.trim(), statement.trim(),
    iso(relevant), iso(start), iso(end)),
    [claimType, subject, predicate, value, statement, relevant, start, end]);

  const freezeCall = useCallback(() => writes.freezeClaim(
    claimId, policy, domains(officialDomains), domains(regulatorDomains),
    minSources, minIndependent),
    [claimId, policy, officialDomains, regulatorDomains, minSources, minIndependent]);

  const summary = useMemo(() => [
    ["Type", words(CLAIM_TYPE_WORDS, claimType)],
    ["Subject", subject],
    ["Predicate", predicate],
    ["Asserted value", value],
    ["As at", formatTime(iso(relevant))],
    ["Evidence policy", words(POLICY_WORDS, policy)],
    ["Official source", domains(officialDomains).join(", ") || "none named"],
    ["Regulator", domains(regulatorDomains).join(", ") || "none named"],
    ["Sources required", `${minSources}${minIndependent
      ? `, of which ${minIndependent} independent` : ""}`],
    ["Observation window", `${formatTime(iso(start))} to ${formatTime(iso(end))}`],
  ], [claimType, subject, predicate, value, relevant, policy, officialDomains,
      regulatorDomains, minSources, minIndependent, start, end]);

  if (!configResult.ok) return <ConfigProblem />;

  return (
    <div className="grid max-w-2xl gap-6">
      <header className="grid gap-2">
        <p className="label">Register a claim</p>
        <h1>{STEPS[step]}</h1>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STEPS.map((name, index) => (
            <li key={name} className={index === step ? "font-[540]"
              : index < step ? "text-[var(--primary)]" : "text-[var(--muted)]"}>
              <span className="mono" aria-hidden>{index < step ? "+" : index + 1}</span>{" "}
              {name}
            </li>
          ))}
        </ol>
      </header>

      {step === 0 ? (
        <section className="grid gap-4">
          <Field label="Claim type"
                 help="What kind of thing is being claimed. It decides which temporal rule applies.">
            <select className="field" value={claimType}
                    onChange={(e) => setClaimType(e.target.value)}>
              {CLAIM_TYPES.map((type) => (
                <option key={type} value={type}>{words(CLAIM_TYPE_WORDS, type)}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject" help="Who or what the claim is about.">
            <input className="field" value={subject} maxLength={120}
                   onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Predicate"
                 help="What is asserted about the subject, as one machine-readable name.">
            <input className="field mono" value={predicate} maxLength={80}
                   placeholder="resumed_withdrawals"
                   onChange={(e) => setPredicate(e.target.value)} />
          </Field>
          <Field label="Asserted value" help="The value the claim asserts.">
            <input className="field mono" value={value} maxLength={80}
                   onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Stated as"
                 help="The claim in a sentence. People read this; the fields above are what gets adjudicated.">
            <textarea className="field" rows={2} value={statement} maxLength={400}
                      onChange={(e) => setStatement(e.target.value)} />
          </Field>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="grid gap-4">
          <Field label="Evidence policy"
                 help="Which sources are allowed to establish this claim at all.">
            <select className="field" value={policy}
                    onChange={(e) => setPolicy(e.target.value)}>
              {POLICIES.map((name) => (
                <option key={name} value={name}>{words(POLICY_WORDS, name)}</option>
              ))}
            </select>
          </Field>
          <Field label="Official source domains"
                 help="Comma separated. Authority is a string comparison against these, frozen now, so no reader's opinion of a publisher can widen it.">
            <input className="field mono" value={officialDomains}
                   placeholder="acme-exchange.example"
                   onChange={(e) => setOfficialDomains(e.target.value)} />
          </Field>
          <Field label="Regulator domains" help="Comma separated. Optional unless the policy requires a regulator.">
            <input className="field mono" value={regulatorDomains}
                   placeholder="markets-authority.example"
                   onChange={(e) => setRegulatorDomains(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sources required" help="At least this many must support it.">
              <input className="field" type="number" min={1} max={12}
                     value={minSources}
                     onChange={(e) => setMinSources(Number(e.target.value))} />
            </Field>
            <Field label="Independent origins"
                   help="Repeating one announcement is one source, however many pages carry it.">
              <input className="field" type="number" min={0} max={minSources}
                     value={minIndependent}
                     onChange={(e) => setMinIndependent(Number(e.target.value))} />
            </Field>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-4">
          <Field label="The moment the claim is about"
                 help="UTC. For a temporal fact, evidence must place the event at or before this.">
            <input className="field" type="datetime-local" value={relevant}
                   onChange={(e) => setRelevant(e.target.value)} />
          </Field>
          <Field label="Observation window opens"
                 help="Evidence published before this does not count, however true it was.">
            <input className="field" type="datetime-local" value={start}
                   onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Observation window closes"
                 help="After this, evidence can no longer be submitted.">
            <input className="field" type="datetime-local" value={end}
                   onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="grid gap-4">
          <div className="panel">
            <div className="panel-head">
              <p className="label">What becomes immutable</p>
            </div>
            <dl className="grid gap-2 p-4 text-sm">
              {summary.map(([term, detail]) => (
                <div key={term} className="flex flex-wrap gap-x-3">
                  <dt className="min-w-44 text-[var(--muted)]">{term}</dt>
                  <dd className="min-w-0 break-words">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="panel p-3 text-sm">
            <span className="font-[540]">
              These conditions become immutable once the claim is registered.
            </span>{" "}
            <span className="text-[var(--muted)]">
              Not editable by you, by anybody, or by this contract. If a
              different interpretation is needed later, that is a new claim, and
              this record stays as it is.
            </span>
          </p>

          {!claimId ? (
            <SignedAction call={declareCall} label="Declare this claim"
                          busyLabel="Declaring"
                          disabled={!defined || !timed}
                          onDone={(state) => {
                            if (state.phase === "accepted" || state.phase === "finalized") {
                              setClaimId("pending");
                            }
                          }} />
          ) : claimId === "pending" ? (
            <div className="panel grid gap-2 p-4 text-sm">
              <p className="font-[540]">Declared.</p>
              <p className="lede">
                The claim exists as a draft. Nothing is frozen until the next
                transaction, and no evidence can be submitted before it.
              </p>
              <Link className="btn" href="/claims">
                Find it in the registry to freeze it
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex items-center gap-2">
        <button type="button" className="btn" disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Back
        </button>
        <button type="button" className="btn btn-primary"
                disabled={step === 3
                  || (step === 0 && !defined)
                  || (step === 1 && !policyReady)
                  || (step === 2 && !timed)}
                onClick={() => setStep((s) => Math.min(3, s + 1))}>
          Continue
        </button>
      </div>
    </div>
  );
}

function Field({ label, help, children }: {
  label: string; help: string; children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="label">{label}</span>
      {children}
      <span className="text-xs text-[var(--muted)]">{help}</span>
    </label>
  );
}

"use client";

import {
  AUTHORITY_WORDS, CONFLICT_WORDS, EVIDENCE_STATUS_WORDS, POLICY_WORDS,
  POSITION_WORDS, ROLE_WORDS, SOURCE_CLASS_WORDS, STATE_WORDS, VERDICT_GLYPH,
  VERDICT_WORDS, positionTone, verdictTone, words,
} from "@/lib/format/present";

/**
 * The protocol's vocabulary, as a person reads it.
 *
 * A glyph goes with every verdict, so the outcome survives being read by
 * somebody who cannot tell the washes apart or who prints the page in black
 * and white.
 */

export function VerdictChip({ verdict }: { verdict: string }) {
  if (!verdict) return null;
  return (
    <span className={`chip ${verdictTone(verdict)}`}>
      <span className="glyph" aria-hidden>{VERDICT_GLYPH[verdict] ?? "-"}</span>
      {words(VERDICT_WORDS, verdict)}
    </span>
  );
}

export function StateChip({ state }: { state: string }) {
  if (!state) return null;
  return <span className="chip tone-neutral">{words(STATE_WORDS, state)}</span>;
}

export function PositionChip({ position }: { position: string }) {
  if (!position) return null;
  return (
    <span className={`chip ${positionTone(position)}`}>
      {words(POSITION_WORDS, position)}
    </span>
  );
}

export function RoleChip({ role }: { role: string }) {
  if (!role) return null;
  const tone = role === "CONTRADICTORY" ? "tone-refuted"
    : role === "DISREGARDED" ? "tone-neutral" : "tone-confirmed";
  return <span className={`chip ${tone}`}>{words(ROLE_WORDS, role)}</span>;
}

export function AuthorityChip({ authority }: { authority: string }) {
  if (!authority) return null;
  const tone = authority === "OTHER" ? "tone-neutral" : "tone-confirmed";
  return <span className={`chip ${tone}`}>{words(AUTHORITY_WORDS, authority)}</span>;
}

export function Plain({ table, value }: { table: Record<string, string>; value: string }) {
  return <>{words(table, value)}</>;
}

export const policyWords = (value: string) => words(POLICY_WORDS, value);
export const conflictWords = (value: string) => words(CONFLICT_WORDS, value);
export const sourceClassWords = (value: string) => words(SOURCE_CLASS_WORDS, value);
export const evidenceStatusWords = (value: string) =>
  words(EVIDENCE_STATUS_WORDS, value);

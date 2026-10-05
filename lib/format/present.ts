/**
 * Every value a person reads passes through here.
 *
 * Nothing in the interface prints a raw enum, a bare address or an ISO
 * timestamp. Identifiers and digests do appear, but only where they are the
 * point -- a verification view where somebody is checking one against a chain
 * -- and never as the label on something.
 */

export const VERDICT_WORDS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  REFUTED: "Refuted",
  CONFLICTED: "Conflicted",
  INSUFFICIENT: "Insufficient evidence",
  UNAVAILABLE: "Evidence unavailable",
};

export const VERDICT_MEANING: Record<string, string> = {
  CONFIRMED: "the evidence satisfies the conditions frozen with this claim",
  REFUTED: "the evidence establishes that the claim is not satisfied",
  CONFLICTED: "relevant evidence materially disagrees and the frozen policy cannot resolve it",
  INSUFFICIENT: "evidence was read, and it does not establish the claim",
  UNAVAILABLE: "the required evidence could not be retrieved and assessed",
};

export const STATE_WORDS: Record<string, string> = {
  DRAFT: "Draft",
  REGISTERED: "Frozen, window not open",
  EVIDENCE_OPEN: "Open for evidence",
  EVIDENCE_SUBMITTED: "Evidence submitted",
  ADJUDICATION_PENDING: "Awaiting adjudication",
  ACCEPTED: "Accepted",
  SETTLED: "Settled",
  SUPERSEDED: "Superseded",
  CANCELLED: "Cancelled",
};

export const POLICY_WORDS: Record<string, string> = {
  OFFICIAL_ONLY: "Official source only",
  REGULATORY: "Regulator or public authority",
  MULTI_SOURCE: "Multiple independent sources",
  PRIMARY_PLUS_CORROBORATION: "Primary source plus corroboration",
  OPEN_EVIDENCE: "Open evidence",
};

export const CLAIM_TYPE_WORDS: Record<string, string> = {
  EVENT_STATE: "Event state",
  ENTITY_STATUS: "Entity status",
  PUBLIC_ANNOUNCEMENT: "Public announcement",
  TEMPORAL_FACT: "Temporal fact",
};

export const POSITION_WORDS: Record<string, string> = {
  SUPPORTS: "Supports",
  CONTRADICTS: "Contradicts",
  SILENT: "Does not settle it",
};

export const ROLE_WORDS: Record<string, string> = {
  DECISIVE: "Decisive",
  CORROBORATING: "Corroborating",
  CONTRADICTORY: "Contradictory",
  DISREGARDED: "Disregarded",
};

export const AUTHORITY_WORDS: Record<string, string> = {
  OFFICIAL: "Official source",
  REGULATOR: "Regulator",
  OTHER: "Other source",
};

export const SOURCE_CLASS_WORDS: Record<string, string> = {
  PRIMARY: "Primary",
  SECONDARY: "Secondary",
  UNKNOWN: "Unclear",
};

export const CONFLICT_WORDS: Record<string, string> = {
  NONE: "None",
  MATERIAL_CONFLICT: "Sources materially disagree",
  UNRESOLVED: "Sources disagree, and the frozen policy cannot rank them",
};

export const EVIDENCE_STATUS_WORDS: Record<string, string> = {
  RECORDED: "Not yet read",
  READ: "Read",
  UNREACHABLE: "Could not be read",
};

/**
 * What the transaction is doing, as distinct from what the claim says. Merging
 * these two is how a console ends up calling a submitted transaction final.
 */
export const LIFECYCLE_WORDS: Record<string, string> = {
  idle: "Ready",
  preparing: "Preparing",
  wallet: "Waiting for the wallet",
  submitted: "Submitted",
  pending: "Validators are deciding",
  accepted: "Accepted, not yet final",
  finalizing: "Waiting for finality",
  finalized: "Finalized",
  failed: "Failed",
};

export const words = (table: Record<string, string>, key: string) =>
  table[key] ?? (key ? key.toLowerCase().replace(/_/g, " ") : "");

export const shortAddress = (value: string) =>
  value && value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value || "";

export const shortDigest = (value: string) => (value ? `${value.slice(0, 12)}...` : "");

export const claimLabel = (id: string) => `Claim ${id.replace(/^C-0*/, "")}`;
export const evidenceLabel = (id: string) => `Source ${id.replace(/^E-0*/, "")}`;

/** A time somebody can read, in their own zone, never a raw ISO string. */
export function formatTime(iso: string): string {
  if (!iso) return "";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  // UTC, and it says so. A page that mixes the reader's zone with the
  // protocol's own timestamps makes two different moments look like one, which
  // is the exact mistake this product exists to avoid.
  return `${when.toLocaleString(undefined, {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false,
  })} UTC`;
}

/** Just the clock part, for the timeline where the date is already given. */
export function formatClock(iso: string): string {
  if (!iso) return "";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  return `${when.toISOString().slice(11, 16)} UTC`;
}

export function formatDay(iso: string): string {
  if (!iso) return "";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  return when.toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function relativeTime(iso: string, now: number): string {
  const when = new Date(iso).getTime();
  if (Number.isNaN(when)) return "";
  const seconds = Math.round((when - now) / 1000);
  const past = seconds < 0;
  const n = Math.abs(seconds);
  const [value, unit] =
    n < 90 ? [n, "second"]
    : n < 5400 ? [Math.round(n / 60), "minute"]
    : n < 129600 ? [Math.round(n / 3600), "hour"]
    : [Math.round(n / 86400), "day"];
  const plural = value === 1 ? unit : `${unit}s`;
  return past ? `${value} ${plural} ago` : `in ${value} ${plural}`;
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven",
                      "eight", "nine", "ten", "eleven", "twelve"];

export const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** GEN, from the smallest unit, without pretending to more precision. */
export function formatGen(wei: string): string {
  let value: bigint;
  try {
    value = BigInt(wei || "0");
  } catch {
    return "0 GEN";
  }
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n) / 10n ** 14n;   // four places
  const tail = fraction === 0n ? "" : `.${fraction.toString().padStart(4, "0")}`
    .replace(/0+$/, "");
  return `${whole}${tail} GEN`;
}

export function verdictTone(verdict: string): string {
  if (verdict === "CONFIRMED") return "tone-confirmed";
  if (verdict === "REFUTED") return "tone-refuted";
  if (verdict === "CONFLICTED") return "tone-conflict";
  return "tone-neutral";
}

export function positionTone(position: string): string {
  if (position === "SUPPORTS") return "tone-confirmed";
  if (position === "CONTRADICTS") return "tone-refuted";
  return "tone-neutral";
}

/** A glyph for every outcome, so colour is never the only signal. */
export const VERDICT_GLYPH: Record<string, string> = {
  CONFIRMED: "+",
  REFUTED: "x",
  CONFLICTED: "!",
  INSUFFICIENT: "-",
  UNAVAILABLE: "?",
};

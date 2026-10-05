/**
 * Every call this console makes, and the shape it expects back.
 *
 * Written against the schema read off the deployed contract, not against a
 * memory of the Python. The schemas are not documentation: they run, so a
 * contract that answers with something else fails here, with the field named,
 * rather than leaving a page rendering "undefined" in a product about what the
 * record says.
 */
import { z } from "zod";

const count = z.union([z.number(), z.string()]).transform((v) => Number(v));

export const VERDICTS = ["CONFIRMED", "REFUTED", "CONFLICTED", "INSUFFICIENT",
                         "UNAVAILABLE"] as const;
export const STATES = ["DRAFT", "REGISTERED", "EVIDENCE_OPEN", "EVIDENCE_SUBMITTED",
                       "ADJUDICATION_PENDING", "ACCEPTED", "SETTLED", "SUPERSEDED",
                       "CANCELLED"] as const;
export const POLICIES = ["OFFICIAL_ONLY", "REGULATORY", "MULTI_SOURCE",
                         "PRIMARY_PLUS_CORROBORATION", "OPEN_EVIDENCE"] as const;
export const CLAIM_TYPES = ["EVENT_STATE", "ENTITY_STATUS", "PUBLIC_ANNOUNCEMENT",
                            "TEMPORAL_FACT"] as const;
export const POSITIONS = ["SUPPORTS", "CONTRADICTS", "SILENT"] as const;
export const ROLES = ["DECISIVE", "CORROBORATING", "CONTRADICTORY",
                      "DISREGARDED"] as const;
export const AUTHORITIES = ["OFFICIAL", "REGULATOR", "OTHER"] as const;
export const SOURCE_CLASSES = ["PRIMARY", "SECONDARY", "UNKNOWN"] as const;
export const CONFLICTS = ["NONE", "MATERIAL_CONFLICT", "UNRESOLVED"] as const;

export type Verdict = (typeof VERDICTS)[number];
export type Policy = (typeof POLICIES)[number];
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const claimSchema = z.object({
  claim_id: z.string(),
  creator: z.string(),
  claim_type: z.string(),
  subject: z.string(),
  predicate: z.string(),
  requested_value: z.string(),
  statement: z.string(),
  relevant_time: z.string(),
  observation_start: z.string(),
  observation_end: z.string(),
  source_policy: z.string(),
  official_domains: z.array(z.string()),
  regulator_domains: z.array(z.string()),
  min_sources: count,
  min_independent: count,
  status: z.string(),
  result: z.string(),
  verdict: z.string(),
  created_at: z.string(),
  frozen_at: z.string(),
  adjudicated_at: z.string(),
  settled_at: z.string(),
  evidence_ids: z.array(z.string()),
  evidence_count: count,
  adjudication_id: z.string(),
  bounty_wei: z.string(),
  bounty_deposited: z.string(),
  bounty_depositor: z.string(),
  supersedes: z.string(),
  superseded_by: z.string(),
});

export const evidenceSchema = z.object({
  evidence_id: z.string(),
  claim_id: z.string(),
  submitted_by: z.string(),
  source_url: z.string(),
  source_host: z.string(),
  context: z.string(),
  submitted_at: z.string(),
  observation_time: z.string(),
  status: z.string(),
  authority: z.string(),
  source_class: z.string(),
  position: z.string(),
  role: z.string(),
  event_time: z.string(),
  publication_time: z.string(),
  quote: z.string(),
  note: z.string(),
  http_status: count,
});

export const readingSchema = z.object({
  evidence_id: z.string(),
  reachable: z.boolean(),
  position: z.string(),
  source_class: z.string(),
  event_time: z.string(),
  publication_time: z.string(),
  quote: z.string(),
  note: z.string(),
});

export const adjudicationSchema = z.object({
  adjudication_id: z.string(),
  claim_id: z.string(),
  rules: z.string(),
  schema: count,
  verdict: z.string(),
  result: z.string(),
  source_policy: z.string(),
  source_policy_satisfied: z.boolean(),
  temporal_condition_satisfied: z.boolean(),
  evidence_sufficiency: z.string(),
  conflict_status: z.string(),
  evidence_read: count,
  evidence_unreachable: count,
  qualifying: count,
  timely: count,
  supporting: count,
  contradicting: count,
  independent_supporting: count,
  roles: z.record(z.string(), z.string()),
  decisive_digest: z.string(),
  adjudicated_at: z.string(),
  readings: z.array(readingSchema),
});

export const protocolSchema = z.object({
  version: z.string(),
  schema: count,
  rules: z.string(),
  claim_types: z.array(z.string()),
  source_policies: z.array(z.string()),
  states: z.array(z.string()),
  verdicts: z.array(z.string()),
  positions: z.array(z.string()),
  authorities: z.array(z.string()),
  source_classes: z.array(z.string()),
  roles: z.array(z.string()),
  conflict_states: z.array(z.string()),
  scope: z.string(),
  limits: z.record(z.string(), z.unknown()),
  counts: z.record(z.string(), count),
  escrow_held: z.string(),
});

export const custodySchema = z.object({
  escrow_held: z.string(),
  sum_of_claims: z.string(),
  funded_claims: count,
  settlements: count,
  balanced: z.boolean(),
});

export type Claim = z.infer<typeof claimSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Adjudication = z.infer<typeof adjudicationSchema>;
export type Protocol = z.infer<typeof protocolSchema>;

export type Read<T> = {
  functionName: string;
  args: (string | number)[];
  schema: z.ZodType<T>;
};

/** Every read, named and shaped in one place, matching the deployed schema. */
export const reads = {
  protocol: {
    functionName: "get_protocol", args: [], schema: protocolSchema,
  } as Read<Protocol>,
  custody: {
    functionName: "get_custody", args: [], schema: custodySchema,
  } as Read<z.infer<typeof custodySchema>>,
  claims: (offset: number, limit: number): Read<{
    items: Claim[]; total: number; offset: number; limit: number;
  }> => ({
    functionName: "list_claims", args: [offset, limit],
    schema: z.object({
      items: z.array(claimSchema), total: count, offset: count, limit: count,
    }),
  }),
  claim: (id: string): Read<Claim> => ({
    functionName: "get_claim", args: [id], schema: claimSchema,
  }),
  claimEvidence: (id: string): Read<{ claim_id: string; items: Evidence[]; total: number }> => ({
    functionName: "get_claim_evidence", args: [id],
    schema: z.object({
      claim_id: z.string(), items: z.array(evidenceSchema), total: count,
    }),
  }),
  claimAdjudication: (id: string): Read<Adjudication> => ({
    functionName: "get_claim_adjudication", args: [id], schema: adjudicationSchema,
  }),
};

export type Call = { functionName: string; args: unknown[]; value?: bigint };

/** Every write a wallet will be asked to sign. */
export const writes = {
  declareClaim: (claimType: string, subject: string, predicate: string,
                 requestedValue: string, statement: string, relevantTime: string,
                 observationStart: string, observationEnd: string): Call => ({
    functionName: "declare_claim",
    args: [claimType, subject, predicate, requestedValue, statement, relevantTime,
           observationStart, observationEnd],
  }),
  freezeClaim: (claimId: string, policy: string, officialDomains: string[],
                regulatorDomains: string[], minSources: number,
                minIndependent: number): Call => ({
    functionName: "freeze_claim",
    args: [claimId, policy, officialDomains, regulatorDomains, minSources,
           minIndependent],
  }),
  submitEvidence: (claimId: string, sourceUrl: string, context: string): Call => ({
    functionName: "submit_evidence", args: [claimId, sourceUrl, context],
  }),
  adjudicate: (claimId: string): Call => ({
    functionName: "adjudicate", args: [claimId],
  }),
  fundBounty: (claimId: string, amount: bigint): Call => ({
    functionName: "fund_bounty", args: [claimId], value: amount,
  }),
  settle: (claimId: string): Call => ({ functionName: "settle", args: [claimId] }),
  cancelClaim: (claimId: string): Call => ({
    functionName: "cancel_claim", args: [claimId],
  }),
  recoverBounty: (claimId: string): Call => ({
    functionName: "recover_bounty", args: [claimId],
  }),
};

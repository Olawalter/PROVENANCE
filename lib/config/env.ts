/**
 * Where this console is pointed, checked once at startup.
 *
 * Two values decide what every page shows. If one is missing or malformed the
 * console says which, rather than quietly reading somebody else's contract or
 * rendering "undefined" into a product about what the record says.
 */
import { z } from "zod";

const schema = z.object({
  chainId: z.coerce.number().int().positive(),
  contract: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a contract address"),
});

export type Config = z.infer<typeof schema>;

export type ConfigResult =
  | { ok: true; config: Config }
  | { ok: false; problems: { variable: string; expected: string; found: string }[] };

const RAW = {
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  contract: process.env.NEXT_PUBLIC_PROVENANCE_CONTRACT,
};

const VARIABLE: Record<string, string> = {
  chainId: "NEXT_PUBLIC_CHAIN_ID",
  contract: "NEXT_PUBLIC_PROVENANCE_CONTRACT",
};

const EXPECTED: Record<string, string> = {
  chainId: "the chain id, 61999 for StudioNet",
  contract: "a 0x address, 40 hex characters",
};

function read(): ConfigResult {
  const parsed = schema.safeParse(RAW);
  if (parsed.success) return { ok: true, config: parsed.data };
  const problems = parsed.error.issues.map((issue) => {
    const key = String(issue.path[0] ?? "");
    const found = RAW[key as keyof typeof RAW];
    return {
      variable: VARIABLE[key] ?? key,
      expected: EXPECTED[key] ?? "a value",
      found: found === undefined || found === "" ? "not set" : String(found),
    };
  });
  return { ok: false, problems };
}

export const configResult = read();

export const NETWORK_NAME = "StudioNet";
export const EXPLORER = "https://explorer-studio.genlayer.com";
export const explorerTx = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER}/address/${address}`;

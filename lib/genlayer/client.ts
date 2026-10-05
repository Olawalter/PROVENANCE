/**
 * The browser's connection to GenLayer.
 *
 * There is no server in this application and no API route that could become
 * the adjudicator: the page talks to the chain directly, and everything it
 * shows can be recovered by reloading it against the chain.
 */
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { configResult } from "@/lib/config/env";

export const FINAL = "latest-final" as const;
export const NON_FINAL = "latest-nonfinal" as const;

export function contractAddress(): `0x${string}` {
  if (!configResult.ok) throw new Error("this console is not pointed at a contract");
  return configResult.config.contract as `0x${string}`;
}

export function chain() {
  if (!configResult.ok) throw new Error("this console is not pointed at a contract");
  return { ...studionet, id: configResult.config.chainId };
}

/** A client for reading. It signs nothing and holds nothing. */
export function readClient() {
  return createClient({ chain: chain() });
}

/**
 * A client bound to the connected wallet, for calls the person signs.
 *
 * The account has to be the **address**, with the injected provider passed
 * alongside it. The SDK routes signing methods to the provider only when the
 * account is not an object -- hand it an object and it looks for a local key
 * instead, and the wallet is never asked. That is not guessable from the
 * types; it is in the transport's own branch.
 */
export function walletClient(address: string, provider: unknown) {
  return createClient({
    chain: chain(),
    account: address as `0x${string}`,
    provider,
  } as never);
}

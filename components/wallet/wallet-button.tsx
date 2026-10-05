"use client";

import { useState } from "react";

import { NETWORK_NAME } from "@/lib/config/env";
import { shortAddress } from "@/lib/format/present";
import { useWallet } from "@/lib/wallet/wallet";

/**
 * Connect, and say plainly when the wallet is on the wrong network.
 *
 * Wrong network is never silent: a console that reads one chain while the
 * wallet signs for another produces transactions that vanish, and the person
 * is left guessing.
 */
export function WalletButton() {
  const wallet = useWallet();
  const [choosing, setChoosing] = useState(false);

  if (!wallet.address) {
    return (
      <div className="relative">
        <button type="button" className="btn"
                disabled={wallet.connecting}
                onClick={() => {
                  if (wallet.providers.length > 1) setChoosing((v) => !v);
                  else void wallet.connect();
                }}>
          {wallet.connecting ? "Connecting" : "Connect a wallet"}
        </button>

        {choosing && wallet.providers.length > 1 ? (
          <div className="panel absolute right-0 z-30 mt-1 w-56 p-1"
               role="menu" aria-label="Wallets">
            {wallet.providers.map((provider) => (
              <button key={provider.uuid} type="button" role="menuitem"
                      className="btn btn-quiet w-full justify-start"
                      onClick={() => { setChoosing(false); void wallet.connect(provider.uuid); }}>
                {provider.name}
              </button>
            ))}
          </div>
        ) : null}

        {wallet.problem ? (
          <p role="alert"
             className="absolute right-0 mt-1 w-64 text-[0.72rem] text-[var(--refuted)]">
            {wallet.problem}
          </p>
        ) : null}
      </div>
    );
  }

  if (!wallet.onRightNetwork) {
    return (
      <button type="button" className="chip tone-conflict"
              onClick={() => void wallet.switchNetwork()}>
        <span className="glyph" aria-hidden>!</span>
        Wrong network &mdash; switch to {NETWORK_NAME}
      </button>
    );
  }

  return (
    <button type="button" className="btn btn-quiet mono text-[0.78rem]"
            title="Forget this account in the console"
            onClick={wallet.disconnect}>
      {shortAddress(wallet.address)}
    </button>
  );
}

"use client";

/**
 * An injected wallet, and nothing custodial.
 *
 * Providers are discovered through EIP-6963 where the wallet announces itself,
 * falling back to `window.ethereum` for wallets that do not. The person's keys
 * stay in their wallet; this console asks for a signature and never for a
 * secret.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState }
  from "react";

import { configResult } from "@/lib/config/env";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

type Announced = { info: { uuid: string; name: string; icon: string }; provider: Eip1193 };

export type WalletState = {
  providers: { name: string; uuid: string; icon: string }[];
  address: string | undefined;
  chainId: number | undefined;
  connecting: boolean;
  problem: string | undefined;
  connect: (uuid?: string) => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  provider: Eip1193 | undefined;
  onRightNetwork: boolean;
};

const WalletContext = createContext<WalletState | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [announced, setAnnounced] = useState<Announced[]>([]);
  const [provider, setProvider] = useState<Eip1193>();
  const [address, setAddress] = useState<string>();
  const [chainId, setChainId] = useState<number>();
  const [connecting, setConnecting] = useState(false);
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    const seen = new Map<string, Announced>();
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Announced>).detail;
      if (detail?.info?.uuid) {
        seen.set(detail.info.uuid, detail);
        setAnnounced(Array.from(seen.values()));
      }
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider",
                                            onAnnounce as EventListener);
  }, []);

  const pick = useCallback((uuid?: string): Eip1193 | undefined => {
    if (uuid) return announced.find((p) => p.info.uuid === uuid)?.provider;
    if (announced.length === 1) return announced[0].provider;
    const injected = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    return announced[0]?.provider ?? injected;
  }, [announced]);

  const connect = useCallback(async (uuid?: string) => {
    setProblem(undefined);
    const chosen = pick(uuid);
    if (!chosen) {
      setProblem("No injected wallet was found in this browser.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = await chosen.request({ method: "eth_requestAccounts" }) as string[];
      const current = await chosen.request({ method: "eth_chainId" }) as string;
      setProvider(chosen);
      setAddress(accounts?.[0]);
      setChainId(Number.parseInt(current, 16));
    } catch (failure) {
      const text = String((failure as { message?: string })?.message ?? failure);
      setProblem(/rejected|denied|4001/i.test(text)
        ? "The wallet declined the connection."
        : text.slice(0, 200));
    } finally {
      setConnecting(false);
    }
  }, [pick]);

  const disconnect = useCallback(() => {
    // The console forgets the account. A wallet connection is the wallet's to
    // revoke, and this does not pretend otherwise.
    setProvider(undefined);
    setAddress(undefined);
    setChainId(undefined);
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!provider || !configResult.ok) return;
    const target = `0x${configResult.config.chainId.toString(16)}`;
    try {
      await provider.request({ method: "wallet_switchEthereumChain",
                               params: [{ chainId: target }] });
      setChainId(configResult.config.chainId);
    } catch (failure) {
      setProblem(String((failure as { message?: string })?.message ?? failure)
        .slice(0, 200));
    }
  }, [provider]);

  useEffect(() => {
    if (!provider?.on) return;
    const onAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as string[];
      setAddress(accounts?.[0]);
      if (!accounts?.length) disconnect();
    };
    const onChain = (...args: never[]) => {
      setChainId(Number.parseInt(args[0] as unknown as string, 16));
    };
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider, disconnect]);

  const value = useMemo<WalletState>(() => ({
    providers: announced.map((p) => ({ name: p.info.name, uuid: p.info.uuid,
                                       icon: p.info.icon })),
    address, chainId, connecting, problem, connect, disconnect, switchNetwork,
    provider,
    onRightNetwork: Boolean(configResult.ok && chainId === configResult.config.chainId),
  }), [announced, address, chainId, connecting, problem, connect, disconnect,
       switchNetwork, provider]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}

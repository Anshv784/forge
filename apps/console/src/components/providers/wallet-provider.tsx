"use client";

import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo } from "react";
import { useCluster } from "./cluster-provider";

import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * No explicit adapters are registered here on purpose: every wallet worth
 * supporting today (Phantom, Solflare, Backpack, Coinbase Wallet, ...)
 * implements the Wallet Standard and auto-registers itself with
 * `@solana/wallet-adapter-react` — the old pattern of importing one adapter
 * class per wallet is no longer necessary for browser extension wallets.
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { cluster } = useCluster();
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={cluster.endpoint} key={cluster.id}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

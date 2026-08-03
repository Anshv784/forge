"use client";

import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { useCarapaceProgram } from "./use-carapace-program";

export interface AllowlistEntryData {
  address: PublicKey;
  policy: PublicKey;
  destination: PublicKey;
}

const POLL_INTERVAL_MS = 15_000;

export function useAllowlist(policyAddress: PublicKey | null) {
  const program = useCarapaceProgram();
  const [entries, setEntries] = useState<AllowlistEntryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!policyAddress) return;
    setLoading(true);
    try {
      const accounts = await program.account.allowlistEntry.all([
        { memcmp: { offset: 8, bytes: policyAddress.toBase58() } },
      ]);
      const decoded: AllowlistEntryData[] = accounts.map(({ publicKey, account }) => {
        const a = account as unknown as Record<string, PublicKey>;
        return { address: publicKey, policy: a.policy, destination: a.destination };
      });
      setEntries(decoded);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [policyAddress, program]);

  useEffect(() => {
    if (!policyAddress) {
      setEntries([]);
      return;
    }
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyAddress?.toBase58()]);

  return { entries, loading, error, refresh };
}

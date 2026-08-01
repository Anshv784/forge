"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PROGRAM_ID } from "@/lib/config";
import { policyPda } from "@/lib/carapace/pda";
import { useCarapaceProgram } from "./use-carapace-program";

const POLL_INTERVAL_MS = 10_000;

export interface PolicyAccountData {
  owner: PublicKey;
  delegate: PublicKey;
  splMint: PublicKey;
  agentIndex: number;
  maxPerTxLamports: bigint;
  maxDailyLamports: bigint;
  spentTodayLamports: bigint;
  maxPerTxSpl: bigint;
  maxDailySpl: bigint;
  spentTodaySpl: bigint;
  windowStartTs: number;
  approvalThresholdLamports: bigint;
  approvalThresholdSpl: bigint;
  nextIntentNonce: bigint;
  totalExecutedCount: bigint;
  expiresAt: number;
  paused: boolean;
  createdAt: number;
}

export function usePolicy(owner: PublicKey | null, agentIndex = 0) {
  const program = useCarapaceProgram();
  const { connection } = useConnection();
  const [policy, setPolicy] = useState<PolicyAccountData | null>(null);
  const [solVaultBalance, setSolVaultBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const programId = useMemo(() => new PublicKey(PROGRAM_ID), []);
  const policyAddress = useMemo(
    () => (owner ? policyPda(programId, owner, agentIndex)[0] : null),
    [owner, agentIndex, programId]
  );

  const refresh = useCallback(async () => {
    if (!policyAddress) return;
    setLoading(true);
    try {
      const account = await program.account.policy.fetch(policyAddress);
      setPolicy(account as unknown as PolicyAccountData);
      setNotFound(false);
      setError(null);

      const [solVault] = (await import("@/lib/carapace/pda")).solVaultPda(programId, policyAddress);
      const balance = await connection.getBalance(solVault, "confirmed");
      setSolVaultBalance(balance);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.toLowerCase().includes("account does not exist")) {
        setNotFound(true);
        setPolicy(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [policyAddress, program, connection, programId]);

  useEffect(() => {
    if (!policyAddress) {
      setPolicy(null);
      return;
    }
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyAddress?.toBase58()]);

  return { policy, policyAddress, solVaultBalance, loading, error, notFound, refresh, programId };
}

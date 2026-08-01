"use client";

import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { useCarapaceProgram } from "./use-carapace-program";

export type IntentStatus = "pending" | "approved" | "denied" | "expired" | "executed";

export interface IntentAccountData {
  address: PublicKey;
  policy: PublicKey;
  nonce: bigint;
  asset: "sol" | "spl";
  amount: bigint;
  destination: PublicKey;
  actionHash: number[];
  status: IntentStatus;
  payer: PublicKey;
  createdAt: number;
  expiresAt: number;
  decidedAt: number;
}

const POLL_INTERVAL_MS = 10_000;

function decodeStatus(raw: unknown): IntentStatus {
  const key = Object.keys(raw as Record<string, unknown>)[0];
  return key as IntentStatus;
}

function decodeAsset(raw: unknown): "sol" | "spl" {
  const key = Object.keys(raw as Record<string, unknown>)[0];
  return key as "sol" | "spl";
}

export function useIntents(policyAddress: PublicKey | null) {
  const program = useCarapaceProgram();
  const [intents, setIntents] = useState<IntentAccountData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!policyAddress) return;
    setLoading(true);
    try {
      const accounts = await program.account.intent.all([
        { memcmp: { offset: 8, bytes: policyAddress.toBase58() } },
      ]);
      const decoded: IntentAccountData[] = accounts
        .map(({ publicKey, account }) => {
          const a = account as unknown as Record<string, unknown>;
          return {
            address: publicKey,
            policy: a.policy as PublicKey,
            nonce: BigInt((a.nonce as { toString(): string }).toString()),
            asset: decodeAsset(a.asset),
            amount: BigInt((a.amount as { toString(): string }).toString()),
            destination: a.destination as PublicKey,
            actionHash: a.actionHash as number[],
            status: decodeStatus(a.status),
            payer: a.payer as PublicKey,
            createdAt: Number(a.createdAt),
            expiresAt: Number(a.expiresAt),
            decidedAt: Number(a.decidedAt),
          };
        })
        .sort((x, y) => Number(y.nonce) - Number(x.nonce));
      setIntents(decoded);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [policyAddress, program]);

  useEffect(() => {
    if (!policyAddress) {
      setIntents([]);
      return;
    }
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyAddress?.toBase58()]);

  return { intents, loading, error, refresh };
}

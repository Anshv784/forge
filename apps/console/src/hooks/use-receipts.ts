"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { EventParser } from "@coral-xyz/anchor";
import { useCallback, useEffect, useState } from "react";
import { useCarapaceProgram } from "./use-carapace-program";

export interface ReceiptEvent {
  signature: string;
  blockTime: number | null;
  name: string;
  data: Record<string, unknown>;
}

const DEFAULT_LIMIT = 20;

export function useReceipts(policyAddress: PublicKey | null, limit = DEFAULT_LIMIT) {
  const program = useCarapaceProgram();
  const { connection } = useConnection();
  const [receipts, setReceipts] = useState<ReceiptEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!policyAddress) return;
    setLoading(true);
    try {
      const signatures = await connection.getSignaturesForAddress(policyAddress, { limit });
      const parser = new EventParser(program.programId, program.coder);

      const events: ReceiptEvent[] = [];
      for (const { signature, blockTime, err } of signatures) {
        if (err) continue;
        const tx = await connection.getTransaction(signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        const logs = tx?.meta?.logMessages;
        if (!logs) continue;
        for (const event of parser.parseLogs(logs)) {
          events.push({
            signature,
            blockTime: blockTime ?? null,
            name: event.name,
            data: event.data as Record<string, unknown>,
          });
        }
      }
      setReceipts(events);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [policyAddress, connection, program, limit]);

  useEffect(() => {
    if (!policyAddress) {
      setReceipts([]);
      return;
    }
    refresh();
    // Deliberately not on the same fast poll as policy/intents — this does
    // one getTransaction call per recent signature and is the most
    // expensive of the three hooks against a public RPC's rate limits.
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyAddress?.toBase58()]);

  return { receipts, loading, error, refresh };
}

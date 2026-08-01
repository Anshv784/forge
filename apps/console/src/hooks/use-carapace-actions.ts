"use client";

import { PublicKey } from "@solana/web3.js";
import { useCallback, useState } from "react";
import { useCarapaceProgram } from "./use-carapace-program";

/** Owner-signed mutations: approve/deny a pending Intent, and the pause
 * kill switch. Each returns a transaction signature on success; the caller
 * is expected to call the relevant `refresh()` from use-policy/use-intents
 * afterward (kept separate rather than baked in here, since different
 * callers want different refresh scopes). */
export function useCarapaceActions() {
  const program = useCarapaceProgram();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = useCallback(async (key: string, fn: () => Promise<string>) => {
    setPendingAction(key);
    setActionError(null);
    try {
      return await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setPendingAction(null);
    }
  }, []);

  const approveIntent = useCallback(
    (owner: PublicKey, policy: PublicKey, intent: PublicKey) =>
      run(`approve-${intent.toBase58()}`, () =>
        program.methods.approveIntent().accountsPartial({ owner, policy, intent }).rpc()
      ),
    [program, run]
  );

  const denyIntent = useCallback(
    (owner: PublicKey, policy: PublicKey, intent: PublicKey) =>
      run(`deny-${intent.toBase58()}`, () =>
        program.methods.denyIntent().accountsPartial({ owner, policy, intent }).rpc()
      ),
    [program, run]
  );

  const setPaused = useCallback(
    (owner: PublicKey, policy: PublicKey, paused: boolean) =>
      run("pause", () => program.methods.setPaused(paused).accountsPartial({ owner, policy }).rpc()),
    [program, run]
  );

  return { approveIntent, denyIntent, setPaused, pendingAction, actionError, setActionError };
}

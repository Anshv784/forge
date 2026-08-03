"use client";

import { PublicKey, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { useCallback, useState } from "react";
import { useCarapaceProgram } from "./use-carapace-program";
import {
  allowlistEntryPda,
  policyPda,
  solVaultPda,
  tokenVaultAuthorityPda,
} from "@/lib/carapace/pda";

export interface LimitsParams {
  maxPerTxLamports: bigint;
  maxDailyLamports: bigint;
  approvalThresholdLamports: bigint;
  maxPerTxSpl: bigint;
  maxDailySpl: bigint;
  approvalThresholdSpl: bigint;
}

export interface InitPolicyParams extends LimitsParams {
  agentIndex: number;
  delegate: PublicKey;
  splMint: PublicKey;
  expiresAt: bigint;
}

/** Owner-signed (or, where the program allows it, permissionless)
 * mutations against a Policy. Each returns a transaction signature on
 * success; the caller is expected to call the relevant `refresh()` from
 * use-policy/use-intents/etc. afterward (kept separate rather than baked
 * in here, since different callers want different refresh scopes). */
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

  const addAllowlistEntry = useCallback(
    (owner: PublicKey, policy: PublicKey, destination: PublicKey) =>
      run("allowlist-add", () => {
        const [allowlistEntry] = allowlistEntryPda(program.programId, policy, destination);
        return program.methods
          .addAllowlistEntry(destination)
          .accountsPartial({ owner, policy, allowlistEntry, systemProgram: SystemProgram.programId })
          .rpc();
      }),
    [program, run]
  );

  const removeAllowlistEntry = useCallback(
    (owner: PublicKey, policy: PublicKey, destination: PublicKey) =>
      run(`allowlist-remove-${destination.toBase58()}`, () => {
        const [allowlistEntry] = allowlistEntryPda(program.programId, policy, destination);
        return program.methods.removeAllowlistEntry().accountsPartial({ owner, policy, allowlistEntry }).rpc();
      }),
    [program, run]
  );

  const updateLimits = useCallback(
    (owner: PublicKey, policy: PublicKey, params: LimitsParams) =>
      run("update-limits", () =>
        program.methods
          .updateLimits({
            maxPerTxLamports: new BN(params.maxPerTxLamports.toString()),
            maxDailyLamports: new BN(params.maxDailyLamports.toString()),
            approvalThresholdLamports: new BN(params.approvalThresholdLamports.toString()),
            maxPerTxSpl: new BN(params.maxPerTxSpl.toString()),
            maxDailySpl: new BN(params.maxDailySpl.toString()),
            approvalThresholdSpl: new BN(params.approvalThresholdSpl.toString()),
          })
          .accountsPartial({ owner, policy })
          .rpc()
      ),
    [program, run]
  );

  const rotateDelegate = useCallback(
    (owner: PublicKey, policy: PublicKey, newDelegate: PublicKey) =>
      run("rotate-delegate", () =>
        program.methods.rotateDelegate(newDelegate).accountsPartial({ owner, policy }).rpc()
      ),
    [program, run]
  );

  const depositSol = useCallback(
    (depositor: PublicKey, policy: PublicKey, amountLamports: bigint) =>
      run("deposit-sol", () => {
        const [solVault] = solVaultPda(program.programId, policy);
        return program.methods
          .depositSol(new BN(amountLamports.toString()))
          .accountsPartial({ depositor, policy, solVault, systemProgram: SystemProgram.programId })
          .rpc();
      }),
    [program, run]
  );

  const depositSpl = useCallback(
    (depositor: PublicKey, policy: PublicKey, splMint: PublicKey, amountBaseUnits: bigint) =>
      run("deposit-spl", () => {
        const [tokenVaultAuthority] = tokenVaultAuthorityPda(program.programId, policy);
        const depositorTokenAccount = getAssociatedTokenAddressSync(splMint, depositor);
        const tokenVault = getAssociatedTokenAddressSync(splMint, tokenVaultAuthority, true);
        return program.methods
          .depositSpl(new BN(amountBaseUnits.toString()))
          .accountsPartial({
            depositor,
            policy,
            splMint,
            depositorTokenAccount,
            tokenVaultAuthority,
            tokenVault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      }),
    [program, run]
  );

  const withdrawSol = useCallback(
    (owner: PublicKey, policy: PublicKey, destination: PublicKey, amountLamports: bigint) =>
      run("withdraw-sol", () => {
        const [solVault] = solVaultPda(program.programId, policy);
        return program.methods
          .withdrawSol(new BN(amountLamports.toString()))
          .accountsPartial({ owner, policy, solVault, destination, systemProgram: SystemProgram.programId })
          .rpc();
      }),
    [program, run]
  );

  const withdrawSpl = useCallback(
    (owner: PublicKey, policy: PublicKey, splMint: PublicKey, destinationTokenAccount: PublicKey, amountBaseUnits: bigint) =>
      run("withdraw-spl", () => {
        const [tokenVaultAuthority] = tokenVaultAuthorityPda(program.programId, policy);
        const tokenVault = getAssociatedTokenAddressSync(splMint, tokenVaultAuthority, true);
        return program.methods
          .withdrawSpl(new BN(amountBaseUnits.toString()))
          .accountsPartial({
            owner,
            policy,
            splMint,
            tokenVaultAuthority,
            tokenVault,
            destinationTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      }),
    [program, run]
  );

  const initializePolicy = useCallback(
    (owner: PublicKey, params: InitPolicyParams) =>
      run("initialize-policy", () => {
        const [policy] = policyPda(program.programId, owner, params.agentIndex);
        const [solVault] = solVaultPda(program.programId, policy);
        const [tokenVaultAuthority] = tokenVaultAuthorityPda(program.programId, policy);
        const tokenVault = getAssociatedTokenAddressSync(params.splMint, tokenVaultAuthority, true);
        return program.methods
          .initializePolicy({
            agentIndex: params.agentIndex,
            delegate: params.delegate,
            maxPerTxLamports: new BN(params.maxPerTxLamports.toString()),
            maxDailyLamports: new BN(params.maxDailyLamports.toString()),
            approvalThresholdLamports: new BN(params.approvalThresholdLamports.toString()),
            maxPerTxSpl: new BN(params.maxPerTxSpl.toString()),
            maxDailySpl: new BN(params.maxDailySpl.toString()),
            approvalThresholdSpl: new BN(params.approvalThresholdSpl.toString()),
            expiresAt: new BN(params.expiresAt.toString()),
          })
          .accountsPartial({
            owner,
            policy,
            solVault,
            tokenVaultAuthority,
            splMint: params.splMint,
            tokenVault,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      }),
    [program, run]
  );

  const expireIntent = useCallback(
    (policy: PublicKey, intent: PublicKey) =>
      run(`expire-${intent.toBase58()}`, () => program.methods.expireIntent().accountsPartial({ policy, intent }).rpc()),
    [program, run]
  );

  const closeIntent = useCallback(
    (policy: PublicKey, intent: PublicKey, payer: PublicKey) =>
      run(`close-${intent.toBase58()}`, () => program.methods.closeIntent().accountsPartial({ policy, intent, payer }).rpc()),
    [program, run]
  );

  return {
    approveIntent,
    denyIntent,
    setPaused,
    addAllowlistEntry,
    removeAllowlistEntry,
    updateLimits,
    rotateDelegate,
    depositSol,
    depositSpl,
    withdrawSol,
    withdrawSpl,
    initializePolicy,
    expireIntent,
    closeIntent,
    pendingAction,
    actionError,
    setActionError,
  };
}

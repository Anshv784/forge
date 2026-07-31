import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccount,
  createMint,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import type { Carapace } from "../target/types/carapace";

const SOL_VAULT_SEED = Buffer.from("sol-vault");
const TOKEN_VAULT_AUTHORITY_SEED = Buffer.from("tv-auth");
const POLICY_SEED = Buffer.from("policy");
const ALLOWLIST_SEED = Buffer.from("allow");
const INTENT_SEED = Buffer.from("intent");

describe("carapace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Carapace as Program<Carapace>;
  const connection = provider.connection;

  const owner = (provider.wallet as anchor.Wallet).payer;
  const delegate = Keypair.generate();
  const strangerDelegate = Keypair.generate();
  const allowedDest = Keypair.generate();
  const notAllowedDest = Keypair.generate();

  let mint: PublicKey;
  let ownerTokenAccount: PublicKey;
  let allowedDestTokenAccount: PublicKey;

  const agentIndex = 0;
  let policy: PublicKey;
  let solVault: PublicKey;
  let tokenVaultAuthority: PublicKey;
  let tokenVault: PublicKey;
  let allowlistEntry: PublicKey;

  const nonceSeed = (n: number | anchor.BN) => new BN(n).toArrayLike(Buffer, "le", 8);

  before(async () => {
    for (const kp of [delegate, strangerDelegate, allowedDest, notAllowedDest]) {
      const sig = await connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
    }

    mint = await createMint(connection, owner, owner.publicKey, null, 6);
    ownerTokenAccount = await createAssociatedTokenAccount(connection, owner, mint, owner.publicKey);
    await mintTo(connection, owner, mint, ownerTokenAccount, owner, 1_000_000_000);

    [policy] = PublicKey.findProgramAddressSync(
      [POLICY_SEED, owner.publicKey.toBuffer(), Buffer.from([agentIndex, 0])],
      program.programId
    );
    [solVault] = PublicKey.findProgramAddressSync([SOL_VAULT_SEED, policy.toBuffer()], program.programId);
    [tokenVaultAuthority] = PublicKey.findProgramAddressSync(
      [TOKEN_VAULT_AUTHORITY_SEED, policy.toBuffer()],
      program.programId
    );
    tokenVault = getAssociatedTokenAddressSync(mint, tokenVaultAuthority, true);
    allowedDestTokenAccount = await createAssociatedTokenAccount(connection, owner, mint, allowedDest.publicKey);
    [allowlistEntry] = PublicKey.findProgramAddressSync(
      [ALLOWLIST_SEED, policy.toBuffer(), allowedDest.publicKey.toBuffer()],
      program.programId
    );
  });

  const intentPda = (nonce: number | anchor.BN) =>
    PublicKey.findProgramAddressSync([INTENT_SEED, policy.toBuffer(), nonceSeed(nonce)], program.programId)[0];

  it("initializes a policy with SOL + SPL vaults", async () => {
    await program.methods
      .initializePolicy({
        agentIndex,
        delegate: delegate.publicKey,
        maxPerTxLamports: new BN(0.5 * LAMPORTS_PER_SOL),
        maxDailyLamports: new BN(1 * LAMPORTS_PER_SOL),
        approvalThresholdLamports: new BN(0.2 * LAMPORTS_PER_SOL),
        maxPerTxSpl: new BN(500_000),
        maxDailySpl: new BN(1_000_000),
        approvalThresholdSpl: new BN(200_000),
        expiresAt: new BN(0),
      })
      .accountsPartial({
        owner: owner.publicKey,
        policy,
        solVault,
        tokenVaultAuthority,
        splMint: mint,
        tokenVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.policy.fetch(policy);
    expect(account.owner.toBase58()).to.eq(owner.publicKey.toBase58());
    expect(account.delegate.toBase58()).to.eq(delegate.publicKey.toBase58());
    expect(account.paused).to.eq(false);
  });

  it("funds the SOL and SPL vaults", async () => {
    await program.methods
      .depositSol(new BN(2 * LAMPORTS_PER_SOL))
      .accountsPartial({ depositor: owner.publicKey, policy, solVault, systemProgram: SystemProgram.programId })
      .rpc();

    await program.methods
      .depositSpl(new BN(5_000_000))
      .accountsPartial({
        depositor: owner.publicKey,
        policy,
        splMint: mint,
        depositorTokenAccount: ownerTokenAccount,
        tokenVaultAuthority,
        tokenVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const vaultBalance = await connection.getBalance(solVault);
    expect(vaultBalance).to.be.greaterThan(1.9 * LAMPORTS_PER_SOL);
  });

  it("adds an allow-list entry for the approved destination", async () => {
    await program.methods
      .addAllowlistEntry(allowedDest.publicKey)
      .accountsPartial({ owner: owner.publicKey, policy, allowlistEntry, systemProgram: SystemProgram.programId })
      .rpc();
  });

  it("rejects a transfer to a destination that isn't allow-listed", async () => {
    const [badEntry] = PublicKey.findProgramAddressSync(
      [ALLOWLIST_SEED, policy.toBuffer(), notAllowedDest.publicKey.toBuffer()],
      program.programId
    );
    try {
      await program.methods
        .executeTransferSol(new BN(0.01 * LAMPORTS_PER_SOL))
        .accountsPartial({
          delegate: delegate.publicKey,
          policy,
          solVault,
          destination: notAllowedDest.publicKey,
          allowlistEntry: badEntry,
          intent: program.programId,
          systemProgram: SystemProgram.programId,
        })
        .signers([delegate])
        .rpc();
      expect.fail("expected transfer to a non-allow-listed destination to fail");
    } catch (err) {
      expect(String(err)).to.match(/AccountNotInitialized|AccountOwnedByWrongProgram|does not exist/i);
    }
  });

  it("executes a below-threshold transfer without an Intent", async () => {
    const before = await program.account.policy.fetch(policy);
    await program.methods
      .executeTransferSol(new BN(0.05 * LAMPORTS_PER_SOL))
      .accountsPartial({
        delegate: delegate.publicKey,
        policy,
        solVault,
        destination: allowedDest.publicKey,
        allowlistEntry,
        intent: program.programId,
        systemProgram: SystemProgram.programId,
      })
      .signers([delegate])
      .rpc();
    const after = await program.account.policy.fetch(policy);
    expect(after.spentTodayLamports.sub(before.spentTodayLamports).toNumber()).to.eq(0.05 * LAMPORTS_PER_SOL);
  });

  it("rejects a transfer above the per-tx cap", async () => {
    try {
      await program.methods
        .executeTransferSol(new BN(0.9 * LAMPORTS_PER_SOL))
        .accountsPartial({
          delegate: delegate.publicKey,
          policy,
          solVault,
          destination: allowedDest.publicKey,
          allowlistEntry,
          intent: program.programId,
          systemProgram: SystemProgram.programId,
        })
        .signers([delegate])
        .rpc();
      expect.fail("expected per-tx cap to reject");
    } catch (err) {
      expect(String(err)).to.include("PerTxCapExceeded");
    }
  });

  it("rejects a transfer from a signer who isn't the policy delegate", async () => {
    try {
      await program.methods
        .executeTransferSol(new BN(0.01 * LAMPORTS_PER_SOL))
        .accountsPartial({
          delegate: strangerDelegate.publicKey,
          policy,
          solVault,
          destination: allowedDest.publicKey,
          allowlistEntry,
          intent: program.programId,
          systemProgram: SystemProgram.programId,
        })
        .signers([strangerDelegate])
        .rpc();
      expect.fail("expected unauthorized delegate to be rejected");
    } catch (err) {
      expect(String(err)).to.match(/UnauthorizedDelegate|ConstraintHasOne/);
    }
  });

  it("requires an approved Intent above the approval threshold, and rejects a mismatched one", async () => {
    const policyBefore = await program.account.policy.fetch(policy);
    const nonce = policyBefore.nextIntentNonce;
    const intent = intentPda(nonce);
    const actionHash = new Uint8Array(32).fill(7);

    try {
      await program.methods
        .executeTransferSol(new BN(0.3 * LAMPORTS_PER_SOL))
        .accountsPartial({
          delegate: delegate.publicKey,
          policy,
          solVault,
          destination: allowedDest.publicKey,
          allowlistEntry,
          intent: program.programId,
          systemProgram: SystemProgram.programId,
        })
        .signers([delegate])
        .rpc();
      expect.fail("expected ApprovalRequired");
    } catch (err) {
      expect(String(err)).to.include("ApprovalRequired");
    }

    await program.methods
      .proposeIntent({
        asset: { sol: {} },
        amount: new BN(0.3 * LAMPORTS_PER_SOL),
        destination: allowedDest.publicKey,
        actionHash: Array.from(actionHash),
        ttlSeconds: new BN(3600),
      })
      .accountsPartial({ delegate: delegate.publicKey, policy, intent, systemProgram: SystemProgram.programId })
      .signers([delegate])
      .rpc();

    // Wrong amount must not slip through even with an Approved intent present.
    await program.methods.approveIntent().accountsPartial({ owner: owner.publicKey, policy, intent }).rpc();
    try {
      await program.methods
        .executeTransferSol(new BN(0.25 * LAMPORTS_PER_SOL))
        .accountsPartial({
          delegate: delegate.publicKey,
          policy,
          solVault,
          destination: allowedDest.publicKey,
          allowlistEntry,
          intent,
          systemProgram: SystemProgram.programId,
        })
        .signers([delegate])
        .rpc();
      expect.fail("expected IntentMismatch on amount bait-and-switch");
    } catch (err) {
      expect(String(err)).to.include("IntentMismatch");
    }

    // Exact match succeeds and marks the intent Executed (single-use).
    await program.methods
      .executeTransferSol(new BN(0.3 * LAMPORTS_PER_SOL))
      .accountsPartial({
        delegate: delegate.publicKey,
        policy,
        solVault,
        destination: allowedDest.publicKey,
        allowlistEntry,
        intent,
        systemProgram: SystemProgram.programId,
      })
      .signers([delegate])
      .rpc();

    const decided = await program.account.intent.fetch(intent);
    expect(Object.keys(decided.status)[0]).to.eq("executed");

    // Replay must fail: the intent is no longer Approved.
    try {
      await program.methods
        .executeTransferSol(new BN(0.3 * LAMPORTS_PER_SOL))
        .accountsPartial({
          delegate: delegate.publicKey,
          policy,
          solVault,
          destination: allowedDest.publicKey,
          allowlistEntry,
          intent,
          systemProgram: SystemProgram.programId,
        })
        .signers([delegate])
        .rpc();
      expect.fail("expected replay to fail");
    } catch (err) {
      expect(String(err)).to.include("IntentNotApproved");
    }
  });

  it("enforces the daily cap across multiple transfers", async () => {
    const policyBefore = await program.account.policy.fetch(policy);
    const remainingBefore = policyBefore.maxDailyLamports.sub(policyBefore.spentTodayLamports);
    // Spend as much of the remaining daily budget as the per-tx cap allows.
    // This chunk is at/above the approval threshold, so — same as any other
    // above-threshold spend — it has to go through a proposed + approved
    // Intent first.
    const chunk = BN.min(remainingBefore, new BN(0.5 * LAMPORTS_PER_SOL));
    const remainingAfter = remainingBefore.sub(chunk);

    const nonce = policyBefore.nextIntentNonce;
    const intent = intentPda(nonce);
    await program.methods
      .proposeIntent({
        asset: { sol: {} },
        amount: chunk,
        destination: allowedDest.publicKey,
        actionHash: Array.from(new Uint8Array(32).fill(9)),
        ttlSeconds: new BN(3600),
      })
      .accountsPartial({ delegate: delegate.publicKey, policy, intent, systemProgram: SystemProgram.programId })
      .signers([delegate])
      .rpc();
    await program.methods.approveIntent().accountsPartial({ owner: owner.publicKey, policy, intent }).rpc();
    await program.methods
      .executeTransferSol(chunk)
      .accountsPartial({
        delegate: delegate.publicKey,
        policy,
        solVault,
        destination: allowedDest.publicKey,
        allowlistEntry,
        intent,
        systemProgram: SystemProgram.programId,
      })
      .signers([delegate])
      .rpc();

    // Whatever daily headroom is left, ask for strictly more of it — but
    // stay under the approval threshold so this fails on the daily cap
    // specifically, not on ApprovalRequired.
    const overAsk = BN.min(
      remainingAfter.add(new BN(0.01 * LAMPORTS_PER_SOL)),
      new BN(0.19 * LAMPORTS_PER_SOL)
    );
    try {
      await program.methods
        .executeTransferSol(overAsk)
        .accountsPartial({
          delegate: delegate.publicKey,
          policy,
          solVault,
          destination: allowedDest.publicKey,
          allowlistEntry,
          intent: program.programId,
          systemProgram: SystemProgram.programId,
        })
        .signers([delegate])
        .rpc();
      expect.fail("expected daily cap to reject");
    } catch (err) {
      expect(String(err)).to.include("DailyCapExceeded");
    }
  });

  it("lets the owner pause the policy and blocks delegate execution while paused", async () => {
    await program.methods.setPaused(true).accountsPartial({ owner: owner.publicKey, policy }).rpc();

    try {
      await program.methods
        .executeTransferSol(new BN(0.001 * LAMPORTS_PER_SOL))
        .accountsPartial({
          delegate: delegate.publicKey,
          policy,
          solVault,
          destination: allowedDest.publicKey,
          allowlistEntry,
          intent: program.programId,
          systemProgram: SystemProgram.programId,
        })
        .signers([delegate])
        .rpc();
      expect.fail("expected PolicyPaused to reject");
    } catch (err) {
      expect(String(err)).to.include("PolicyPaused");
    }

    await program.methods.setPaused(false).accountsPartial({ owner: owner.publicKey, policy }).rpc();
  });

  it("lets the owner withdraw directly regardless of delegate caps", async () => {
    const before = await connection.getBalance(owner.publicKey);
    await program.methods
      .withdrawSol(new BN(0.1 * LAMPORTS_PER_SOL))
      .accountsPartial({ owner: owner.publicKey, policy, solVault, destination: owner.publicKey, systemProgram: SystemProgram.programId })
      .rpc();
    const after = await connection.getBalance(owner.publicKey);
    expect(after).to.be.greaterThan(before);
  });

  it("removes an allow-list entry and then rejects transfers to it", async () => {
    await program.methods
      .removeAllowlistEntry()
      .accountsPartial({ owner: owner.publicKey, policy, allowlistEntry })
      .rpc();

    try {
      await program.methods
        .executeTransferSol(new BN(0.001 * LAMPORTS_PER_SOL))
        .accountsPartial({
          delegate: delegate.publicKey,
          policy,
          solVault,
          destination: allowedDest.publicKey,
          allowlistEntry,
          intent: program.programId,
          systemProgram: SystemProgram.programId,
        })
        .signers([delegate])
        .rpc();
      expect.fail("expected removed allow-list entry to reject the transfer");
    } catch (err) {
      expect(String(err)).to.match(/AccountNotInitialized|does not exist/i);
    }
  });
});

import { PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

/**
 * Mirrors `programs/carapace/programs/carapace/src/constants.rs` byte for
 * byte — these seed prefixes and the derivations below must stay in sync
 * with the on-chain program.
 */
const SEED = {
  POLICY: Buffer.from("policy"),
  SOL_VAULT: Buffer.from("sol-vault"),
  TOKEN_VAULT_AUTHORITY: Buffer.from("tv-auth"),
  ALLOWLIST: Buffer.from("allow"),
  INTENT: Buffer.from("intent"),
};

function u16LE(value: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value, 0);
  return buf;
}

function u64LE(value: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value), 0);
  return buf;
}

export function policyPda(programId: PublicKey, owner: PublicKey, agentIndex: number) {
  return PublicKey.findProgramAddressSync(
    [SEED.POLICY, owner.toBuffer(), u16LE(agentIndex)],
    programId
  );
}

export function solVaultPda(programId: PublicKey, policy: PublicKey) {
  return PublicKey.findProgramAddressSync([SEED.SOL_VAULT, policy.toBuffer()], programId);
}

export function tokenVaultAuthorityPda(programId: PublicKey, policy: PublicKey) {
  return PublicKey.findProgramAddressSync([SEED.TOKEN_VAULT_AUTHORITY, policy.toBuffer()], programId);
}

export function allowlistEntryPda(programId: PublicKey, policy: PublicKey, destination: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [SEED.ALLOWLIST, policy.toBuffer(), destination.toBuffer()],
    programId
  );
}

export function intentPda(programId: PublicKey, policy: PublicKey, nonce: number | bigint) {
  return PublicKey.findProgramAddressSync([SEED.INTENT, policy.toBuffer(), u64LE(nonce)], programId);
}

export function associatedTokenAddress(owner: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

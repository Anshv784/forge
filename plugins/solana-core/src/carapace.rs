//! Carapace-program-specific PDA derivation, account layouts, and
//! instruction builders. Field order in every `Borsh`-derived struct here
//! must mirror the Rust structs in `programs/carapace/programs/carapace/src`
//! exactly — Borsh serializes in declaration order, so this is a hand-kept
//! mirror, not a generated one. Cross-checked in `tests/cross_check.rs`.

use borsh::{BorshDeserialize, BorshSerialize};

use crate::discriminator::instruction_discriminator;
use crate::instruction::{AccountMeta, Instruction};
use crate::pubkey::Pubkey;

pub const SYSTEM_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0u8; 32]);

// Well-known, network-wide constant program IDs (never redeployed, so
// hardcoding is standard practice — every Solana client library does this).
pub const TOKEN_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133, 237,
    95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
]);
pub const ASSOCIATED_TOKEN_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153, 218,
    255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89,
]);

pub mod seeds {
    pub const POLICY: &[u8] = b"policy";
    pub const SOL_VAULT: &[u8] = b"sol-vault";
    pub const TOKEN_VAULT_AUTHORITY: &[u8] = b"tv-auth";
    pub const ALLOWLIST: &[u8] = b"allow";
    pub const INTENT: &[u8] = b"intent";
}

pub fn policy_pda(program_id: &Pubkey, owner: &Pubkey, agent_index: u16) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[seeds::POLICY, &owner.to_bytes(), &agent_index.to_le_bytes()], program_id)
}

pub fn sol_vault_pda(program_id: &Pubkey, policy: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[seeds::SOL_VAULT, &policy.to_bytes()], program_id)
}

pub fn token_vault_authority_pda(program_id: &Pubkey, policy: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[seeds::TOKEN_VAULT_AUTHORITY, &policy.to_bytes()], program_id)
}

pub fn allowlist_entry_pda(program_id: &Pubkey, policy: &Pubkey, destination: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[seeds::ALLOWLIST, &policy.to_bytes(), &destination.to_bytes()],
        program_id,
    )
}

pub fn intent_pda(program_id: &Pubkey, policy: &Pubkey, nonce: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[seeds::INTENT, &policy.to_bytes(), &nonce.to_le_bytes()], program_id)
}

/// Derives an Associated Token Account address, reimplementing
/// `spl_associated_token_account::get_associated_token_address` from the
/// same primitive (`find_program_address`) so the full `spl-token`/
/// `spl-associated-token-account` crates aren't needed on wasm32-wasip2.
pub fn associated_token_address(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[&owner.to_bytes(), &TOKEN_PROGRAM_ID.to_bytes(), &mint.to_bytes()],
        &ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    .0
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, BorshSerialize, BorshDeserialize)]
#[borsh(use_discriminant = true)]
pub enum AssetKind {
    Sol = 0,
    Spl = 1,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, BorshSerialize, BorshDeserialize)]
#[borsh(use_discriminant = true)]
pub enum IntentStatus {
    Pending = 0,
    Approved = 1,
    Denied = 2,
    Expired = 3,
    Executed = 4,
}

/// Mirrors `state::Policy`. Deserialize with `decode_account` after stripping
/// the 8-byte discriminator (`rpc::decode_account_data` already does this).
#[derive(Clone, Debug, BorshDeserialize)]
pub struct Policy {
    pub owner: Pubkey,
    pub delegate: Pubkey,
    pub spl_mint: Pubkey,
    pub agent_index: u16,
    pub sol_vault_bump: u8,
    pub token_vault_authority_bump: u8,
    pub bump: u8,
    pub max_per_tx_lamports: u64,
    pub max_daily_lamports: u64,
    pub spent_today_lamports: u64,
    pub max_per_tx_spl: u64,
    pub max_daily_spl: u64,
    pub spent_today_spl: u64,
    pub window_start_ts: i64,
    pub approval_threshold_lamports: u64,
    pub approval_threshold_spl: u64,
    pub next_intent_nonce: u64,
    pub total_executed_count: u64,
    pub expires_at: i64,
    pub paused: bool,
    pub reentrancy_lock: bool,
    pub created_at: i64,
}

/// Mirrors `state::Intent`.
#[derive(Clone, Debug, BorshDeserialize)]
pub struct Intent {
    pub policy: Pubkey,
    pub nonce: u64,
    pub asset: AssetKind,
    pub amount: u64,
    pub destination: Pubkey,
    pub action_hash: [u8; 32],
    pub status: IntentStatus,
    pub payer: Pubkey,
    pub created_at: i64,
    pub expires_at: i64,
    pub decided_at: i64,
    pub bump: u8,
}

/// Mirrors `instructions::intent::ProposeIntentParams`.
#[derive(Clone, BorshSerialize)]
pub struct ProposeIntentParams {
    pub asset: AssetKind,
    pub amount: u64,
    pub destination: Pubkey,
    pub action_hash: [u8; 32],
    pub ttl_seconds: i64,
}

fn ix_data<T: BorshSerialize>(ix_name: &str, args: &T) -> Vec<u8> {
    let mut data = instruction_discriminator(ix_name).to_vec();
    args.serialize(&mut data).expect("borsh serialization is infallible for owned in-memory buffers");
    data
}

/// `None` maps to Anchor's documented sentinel for an omitted optional
/// account: the program's own address.
fn intent_account_or_sentinel(program_id: &Pubkey, intent: Option<&Pubkey>) -> Pubkey {
    *intent.unwrap_or(program_id)
}

pub fn propose_intent_instruction(
    program_id: &Pubkey,
    delegate: &Pubkey,
    policy: &Pubkey,
    intent: &Pubkey,
    params: ProposeIntentParams,
) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*delegate, true),
            AccountMeta::new(*policy, false),
            AccountMeta::new(*intent, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: ix_data("propose_intent", &params),
    }
}

#[allow(clippy::too_many_arguments)]
pub fn execute_transfer_sol_instruction(
    program_id: &Pubkey,
    delegate: &Pubkey,
    policy: &Pubkey,
    sol_vault: &Pubkey,
    destination: &Pubkey,
    allowlist_entry: &Pubkey,
    intent: Option<&Pubkey>,
    amount: u64,
) -> Instruction {
    #[derive(BorshSerialize)]
    struct Args {
        amount: u64,
    }
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(*delegate, true),
            AccountMeta::new(*policy, false),
            AccountMeta::new(*sol_vault, false),
            AccountMeta::new(*destination, false),
            AccountMeta::new_readonly(*allowlist_entry, false),
            AccountMeta::new(intent_account_or_sentinel(program_id, intent), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: ix_data("execute_transfer_sol", &Args { amount }),
    }
}

#[allow(clippy::too_many_arguments)]
pub fn execute_transfer_spl_instruction(
    program_id: &Pubkey,
    delegate: &Pubkey,
    policy: &Pubkey,
    spl_mint: &Pubkey,
    token_vault_authority: &Pubkey,
    token_vault: &Pubkey,
    destination_token_account: &Pubkey,
    allowlist_entry: &Pubkey,
    intent: Option<&Pubkey>,
    amount: u64,
) -> Instruction {
    #[derive(BorshSerialize)]
    struct Args {
        amount: u64,
    }
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(*delegate, true),
            AccountMeta::new(*policy, false),
            AccountMeta::new_readonly(*spl_mint, false),
            AccountMeta::new_readonly(*token_vault_authority, false),
            AccountMeta::new(*token_vault, false),
            AccountMeta::new(*destination_token_account, false),
            AccountMeta::new_readonly(*allowlist_entry, false),
            AccountMeta::new(intent_account_or_sentinel(program_id, intent), false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: ix_data("execute_transfer_spl", &Args { amount }),
    }
}

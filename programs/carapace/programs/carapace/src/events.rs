//! On-chain audit trail. Carapace deliberately does not store a receipt
//! account per action (that would mean either unbounded rent growth or a
//! rent-refund bookkeeping problem for a high-frequency write path). Instead
//! every state change emits a log-level event via `emit!`, which lands in
//! the transaction's logs permanently and is queryable via
//! `getSignaturesForAddress` + log parsing (what the dashboard's receipts
//! feed does) or a Helius webhook. This is what turns ZeroClaw's own local
//! "cryptographic tool receipt" concept into something a third party can
//! verify without trusting the agent operator's machine at all.

use crate::state::AssetKind;
use anchor_lang::prelude::*;

#[event]
pub struct PolicyInitialized {
    pub policy: Pubkey,
    pub owner: Pubkey,
    pub delegate: Pubkey,
    pub spl_mint: Pubkey,
    pub agent_index: u16,
}

#[event]
pub struct DelegateRotated {
    pub policy: Pubkey,
    pub old_delegate: Pubkey,
    pub new_delegate: Pubkey,
}

#[event]
pub struct PausedSet {
    pub policy: Pubkey,
    pub paused: bool,
}

#[event]
pub struct LimitsUpdated {
    pub policy: Pubkey,
    pub max_per_tx_lamports: u64,
    pub max_daily_lamports: u64,
    pub max_per_tx_spl: u64,
    pub max_daily_spl: u64,
    pub approval_threshold_lamports: u64,
    pub approval_threshold_spl: u64,
}

#[event]
pub struct AllowlistEntryAdded {
    pub policy: Pubkey,
    pub destination: Pubkey,
}

#[event]
pub struct AllowlistEntryRemoved {
    pub policy: Pubkey,
    pub destination: Pubkey,
}

#[event]
pub struct Deposited {
    pub policy: Pubkey,
    pub asset: AssetKind,
    pub amount: u64,
    pub depositor: Pubkey,
}

#[event]
pub struct Withdrawn {
    pub policy: Pubkey,
    pub asset: AssetKind,
    pub amount: u64,
    pub destination: Pubkey,
}

#[event]
pub struct IntentProposed {
    pub policy: Pubkey,
    pub intent: Pubkey,
    pub nonce: u64,
    pub asset: AssetKind,
    pub amount: u64,
    pub destination: Pubkey,
    pub action_hash: [u8; 32],
    pub expires_at: i64,
}

#[event]
pub struct IntentApproved {
    pub policy: Pubkey,
    pub intent: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct IntentDenied {
    pub policy: Pubkey,
    pub intent: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct IntentExpiredEvent {
    pub policy: Pubkey,
    pub intent: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct IntentClosed {
    pub policy: Pubkey,
    pub intent: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct TransferExecuted {
    pub policy: Pubkey,
    pub asset: AssetKind,
    pub amount: u64,
    pub destination: Pubkey,
    pub intent: Option<Pubkey>,
    pub spent_today: u64,
    pub total_executed_count: u64,
}

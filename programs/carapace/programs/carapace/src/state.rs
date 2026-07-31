use anchor_lang::prelude::*;

/// The trust boundary for one autonomous agent's wallet.
///
/// Funds never sit in a key the `delegate` independently controls — they sit
/// in `SolVault`/the SPL vault ATA, both PDAs whose only way to move is
/// through this program's own instruction logic (see `instructions::execute`).
/// The `delegate` can only ever *ask* this program to move funds; whether
/// that ask succeeds is entirely determined by the checks below.
#[account]
#[derive(InitSpace)]
pub struct Policy {
    /// The human (or Squads multisig, in a future extension) who controls
    /// this policy. Only this key can change limits, pause, rotate the
    /// delegate, approve/deny Intents, or withdraw.
    pub owner: Pubkey,
    /// The agent's own ephemeral session pubkey. Can request transfers and
    /// propose Intents, but can never independently move funds outside of
    /// what `execute_transfer` allows.
    pub delegate: Pubkey,
    /// The single SPL mint this policy tracks a vault + caps for.
    pub spl_mint: Pubkey,
    /// Lets one owner run multiple independent agents, each with its own
    /// Policy PDA (seeds include this index).
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

    /// Shared fixed-reset window for both asset classes. Not a true sliding
    /// window — see docs/SECURITY.md.
    pub window_start_ts: i64,

    /// Transfers at or above this amount require an `Approved` Intent.
    /// Set to 0 to require approval on every transfer of that asset; set to
    /// `u64::MAX` to never require approval (delegate is fully autonomous up
    /// to the per-tx/daily caps).
    pub approval_threshold_lamports: u64,
    pub approval_threshold_spl: u64,

    /// Monotonic counter used to derive collision-free Intent PDAs.
    pub next_intent_nonce: u64,
    pub total_executed_count: u64,

    /// 0 means the policy never expires.
    pub expires_at: i64,
    /// Owner-controlled kill switch. When true, the delegate cannot execute
    /// or propose anything; the owner can still withdraw.
    pub paused: bool,
    /// Defense-in-depth against reentrancy into `execute_*`. The Solana
    /// runtime already rejects A->B->A CPI reentrancy, so this is a belt
    /// against future runtime changes and instruction-ordering bugs, not the
    /// primary guarantee.
    pub reentrancy_lock: bool,
    pub created_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum AssetKind {
    Sol,
    Spl,
}

/// One allow-listed destination for a policy's delegate-initiated transfers.
/// Existence of this PDA is the allow-list check; there is no on/off flag.
#[account]
#[derive(InitSpace)]
pub struct AllowlistEntry {
    pub policy: Pubkey,
    pub destination: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum IntentStatus {
    Pending,
    Approved,
    Denied,
    Expired,
    Executed,
}

/// A specific, human-approvable proposed action. `execute_transfer` checks
/// every field below against the transfer it is about to perform — matching
/// only on "an approved intent exists somewhere" would let a delegate get a
/// small amount approved and then execute a much larger one.
#[account]
#[derive(InitSpace)]
pub struct Intent {
    pub policy: Pubkey,
    pub nonce: u64,
    pub asset: AssetKind,
    pub amount: u64,
    pub destination: Pubkey,
    /// Hash of a human-readable description of the action (kept off-chain /
    /// in program logs via `emit!`, not stored in full on-chain, to keep
    /// this account small and cheap to rent).
    pub action_hash: [u8; 32],
    pub status: IntentStatus,
    /// Whoever paid to create this account — refunded on `close_intent`,
    /// never an arbitrary caller-supplied destination.
    pub payer: Pubkey,
    pub created_at: i64,
    pub expires_at: i64,
    pub decided_at: i64,
    pub bump: u8,
}

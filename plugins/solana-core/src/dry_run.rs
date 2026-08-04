//! Pure, read-only re-evaluation of `programs/carapace/.../instructions/execute.rs`'s
//! `validate_spend` — used by `carapace_dry_run` to answer "would this
//! transfer succeed right now?" without submitting anything.
//!
//! This is a **second implementation** of the on-chain check sequence, not a
//! call into the program, so it can disagree with reality. Every place it can
//! disagree is enumerated in the doc comment on [`evaluate`] and in
//! `plugins/carapace_dry_run/README.md`. Keep this in exact lockstep with
//! `validate_spend` whenever that function changes.

use crate::carapace::{AssetKind, Policy};

/// Which check produced the verdict, in the exact order the on-chain program
/// evaluates them. Stable string identifiers (not the Rust variant names) so
/// the shaped tool output doesn't churn if this enum is refactored.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecisiveCheck {
    /// The `allowlist_entry` PDA doesn't exist. On-chain this is enforced by
    /// Anchor account resolution *before* the instruction handler runs at
    /// all — it happens first here too, for the same reason.
    NotAllowlisted,
    Paused,
    PolicyExpired,
    PerTxCapExceeded,
    DailyCapExceeded,
    /// Not a hard refusal: `execute_transfer` called with no `intent_nonce`
    /// (which is what a dry run is implicitly asking about) fails with
    /// `ApprovalRequired` whenever the amount is at/above the threshold.
    ApprovalRequired,
    /// Every check passed; `execute_transfer` with no intent would succeed.
    WouldSucceed,
}

impl DecisiveCheck {
    pub fn as_str(self) -> &'static str {
        match self {
            DecisiveCheck::NotAllowlisted => "not_allowlisted",
            DecisiveCheck::Paused => "paused",
            DecisiveCheck::PolicyExpired => "policy_expired",
            DecisiveCheck::PerTxCapExceeded => "per_tx_cap_exceeded",
            DecisiveCheck::DailyCapExceeded => "daily_cap_exceeded",
            DecisiveCheck::ApprovalRequired => "approval_required",
            DecisiveCheck::WouldSucceed => "would_succeed",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct DryRunVerdict {
    pub allowed: bool,
    pub decisive_check: DecisiveCheck,
    pub above_threshold: bool,
    /// What `spent_today` effectively is *right now*, accounting for the
    /// fixed-reset window the same way `validate_spend` does (i.e. treated
    /// as 0 if `window_start_ts + 86400s` has already passed).
    pub effective_spent_today: u64,
    pub remaining_today: u64,
    pub max_per_tx: u64,
    pub max_daily: u64,
    pub approval_threshold: u64,
}

/// Mirrors `validate_spend` field-for-field and check-for-check, with one
/// structural difference: the allow-list check is a parameter here
/// (`is_allowlisted`) because it requires a *second* account read
/// (`getAccountInfo` on the `allowlist_entry` PDA) that the caller must do
/// itself — see `plugins/carapace_dry_run/README.md` for why this can't be
/// folded into a single RPC call.
///
/// **Where this can disagree with the real `execute_transfer` call**, in
/// order of how likely they are to matter:
/// 1. **Time-of-check/time-of-use.** Between this read and an actual
///    `execute_transfer`, another transfer against the same policy could
///    land and consume budget, or the owner could pause/update limits. A
///    dry run five seconds ago proves nothing about right now under
///    concurrent use. This is the big one — treat the verdict as advisory,
///    not a guarantee, exactly the way a bank's "you have sufficient funds"
///    check before initiating a wire isn't a guarantee either.
/// 2. **Clock source.** The real check uses `Clock::get()?.unix_timestamp`
///    (the *cluster's* clock, from the slot the transaction lands in). This
///    function takes `now` as a plain parameter — if the caller sources it
///    from local wall-clock time instead of a fresh `getLatestBlockhash`
///    call's implied slot or an actual on-chain read, it can be off by
///    however much local/cluster clocks disagree (normally sub-second, but
///    not guaranteed). This only matters within a second or two of the
///    daily-window reset or an Intent's `expires_at`.
/// 3. **`reentrancy_lock` is not modeled at all.** It's `true` only for the
///    literal duration of another in-flight `execute_transfer` CPI against
///    the *same* policy in the *same* transaction — a window measured in
///    compute units, not wall-clock time. Reading it from a standalone RPC
///    call essentially never observes it as `true`; treating it as always
///    `false` here does not create a realistic false-positive.
/// 4. **This function never re-derives the allow-list PDA itself** — it
///    trusts `is_allowlisted` from the caller. If the caller derives that
///    PDA with a different `destination` than the one it evaluates here
///    (e.g. an SPL token *account* address instead of its *owner*, which is
///    what the real program keys the allow-list on for SPL — see
///    `execute.rs`'s `ExecuteTransferSpl` accounts), the verdict is simply
///    wrong. `carapace_dry_run`'s plugin code derives both from the same
///    resolved owner pubkey to rule this out; a from-scratch caller must do
///    the same.
#[allow(clippy::too_many_arguments)]
pub fn evaluate(
    policy: &Policy,
    is_allowlisted: bool,
    now: i64,
    asset: AssetKind,
    amount: u64,
) -> DryRunVerdict {
    let (max_per_tx, max_daily, spent_today, approval_threshold) = match asset {
        AssetKind::Sol => (
            policy.max_per_tx_lamports,
            policy.max_daily_lamports,
            policy.spent_today_lamports,
            policy.approval_threshold_lamports,
        ),
        AssetKind::Spl => (
            policy.max_per_tx_spl,
            policy.max_daily_spl,
            policy.spent_today_spl,
            policy.approval_threshold_spl,
        ),
    };

    const SECONDS_PER_DAY: i64 = 86_400;
    let window_expired = now >= policy.window_start_ts.saturating_add(SECONDS_PER_DAY);
    let effective_spent = if window_expired { 0 } else { spent_today };
    let remaining_today = max_daily.saturating_sub(effective_spent);
    let above_threshold = amount >= approval_threshold;

    let mut verdict = DryRunVerdict {
        allowed: false,
        decisive_check: DecisiveCheck::WouldSucceed,
        above_threshold,
        effective_spent_today: effective_spent,
        remaining_today,
        max_per_tx,
        max_daily,
        approval_threshold,
    };

    // Same order as validate_spend / Anchor's own account resolution.
    if !is_allowlisted {
        verdict.decisive_check = DecisiveCheck::NotAllowlisted;
        return verdict;
    }
    if policy.paused {
        verdict.decisive_check = DecisiveCheck::Paused;
        return verdict;
    }
    if policy.expires_at != 0 && now >= policy.expires_at {
        verdict.decisive_check = DecisiveCheck::PolicyExpired;
        return verdict;
    }
    if amount > max_per_tx {
        verdict.decisive_check = DecisiveCheck::PerTxCapExceeded;
        return verdict;
    }
    let new_spent = effective_spent.saturating_add(amount);
    if new_spent > max_daily {
        verdict.decisive_check = DecisiveCheck::DailyCapExceeded;
        return verdict;
    }
    if above_threshold {
        verdict.decisive_check = DecisiveCheck::ApprovalRequired;
        return verdict;
    }

    verdict.allowed = true;
    verdict.decisive_check = DecisiveCheck::WouldSucceed;
    verdict
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pubkey::Pubkey;

    fn base_policy() -> Policy {
        let zero = Pubkey::new_from_array([0u8; 32]);
        Policy {
            owner: zero,
            delegate: zero,
            spl_mint: zero,
            agent_index: 0,
            sol_vault_bump: 0,
            token_vault_authority_bump: 0,
            bump: 0,
            max_per_tx_lamports: 500_000_000,
            max_daily_lamports: 2_000_000_000,
            spent_today_lamports: 0,
            max_per_tx_spl: 500_000,
            max_daily_spl: 2_000_000,
            spent_today_spl: 0,
            window_start_ts: 1_000_000,
            approval_threshold_lamports: 100_000_000,
            approval_threshold_spl: 200_000,
            next_intent_nonce: 0,
            total_executed_count: 0,
            expires_at: 0,
            paused: false,
            reentrancy_lock: false,
            created_at: 0,
        }
    }

    #[test]
    fn not_allowlisted_wins_over_everything_else() {
        let mut policy = base_policy();
        policy.paused = true; // would also fail, but allowlist is checked first
        let v = evaluate(&policy, false, 1_000_500, AssetKind::Sol, 10);
        assert!(!v.allowed);
        assert_eq!(v.decisive_check, DecisiveCheck::NotAllowlisted);
    }

    #[test]
    fn paused_refuses_even_a_tiny_amount() {
        let mut policy = base_policy();
        policy.paused = true;
        let v = evaluate(&policy, true, 1_000_500, AssetKind::Sol, 1);
        assert_eq!(v.decisive_check, DecisiveCheck::Paused);
    }

    #[test]
    fn expired_policy_refuses() {
        let mut policy = base_policy();
        policy.expires_at = 1_000_100;
        let v = evaluate(&policy, true, 1_000_500, AssetKind::Sol, 1);
        assert_eq!(v.decisive_check, DecisiveCheck::PolicyExpired);
    }

    #[test]
    fn non_expiring_policy_expires_at_zero_never_refuses_on_time() {
        let policy = base_policy(); // expires_at = 0
        let v = evaluate(&policy, true, i64::MAX / 2, AssetKind::Sol, 1);
        assert!(v.allowed);
    }

    #[test]
    fn per_tx_cap_exceeded() {
        let policy = base_policy();
        let v = evaluate(&policy, true, 1_000_500, AssetKind::Sol, 600_000_000);
        assert_eq!(v.decisive_check, DecisiveCheck::PerTxCapExceeded);
    }

    #[test]
    fn amount_exactly_at_per_tx_cap_does_not_trip_the_cap() {
        // validate_spend uses `amount <= max_per_tx` — the boundary itself is fine.
        let policy = base_policy();
        let v = evaluate(&policy, true, 1_000_500, AssetKind::Sol, 500_000_000);
        assert_ne!(v.decisive_check, DecisiveCheck::PerTxCapExceeded);
    }

    #[test]
    fn daily_cap_exceeded_uses_effective_spent_today() {
        let mut policy = base_policy();
        policy.spent_today_lamports = 1_900_000_000;
        let v = evaluate(&policy, true, 1_000_500, AssetKind::Sol, 150_000_000);
        assert_eq!(v.decisive_check, DecisiveCheck::DailyCapExceeded);
    }

    #[test]
    fn daily_cap_resets_after_window_expires() {
        let mut policy = base_policy();
        policy.spent_today_lamports = 1_900_000_000;
        policy.window_start_ts = 0;
        // now is well past window_start_ts + 86_400
        let v = evaluate(&policy, true, 200_000, AssetKind::Sol, 150_000_000);
        assert_eq!(v.effective_spent_today, 0);
        assert_eq!(v.decisive_check, DecisiveCheck::ApprovalRequired); // still above threshold
    }

    #[test]
    fn above_threshold_with_no_intent_is_approval_required_not_allowed() {
        let policy = base_policy();
        let v = evaluate(&policy, true, 1_000_500, AssetKind::Sol, 150_000_000);
        assert!(!v.allowed);
        assert!(v.above_threshold);
        assert_eq!(v.decisive_check, DecisiveCheck::ApprovalRequired);
    }

    #[test]
    fn below_threshold_within_caps_and_allowlisted_would_succeed() {
        let policy = base_policy();
        let v = evaluate(&policy, true, 1_000_500, AssetKind::Sol, 50_000_000);
        assert!(v.allowed);
        assert!(!v.above_threshold);
        assert_eq!(v.decisive_check, DecisiveCheck::WouldSucceed);
        assert_eq!(v.remaining_today, 2_000_000_000);
    }

    #[test]
    fn spl_uses_spl_fields_not_sol_fields() {
        let mut policy = base_policy();
        policy.max_per_tx_spl = 10;
        let v = evaluate(&policy, true, 1_000_500, AssetKind::Spl, 20);
        assert_eq!(v.decisive_check, DecisiveCheck::PerTxCapExceeded);
    }

    #[test]
    fn zero_approval_threshold_means_everything_needs_approval() {
        let mut policy = base_policy();
        policy.approval_threshold_lamports = 0;
        let v = evaluate(&policy, true, 1_000_500, AssetKind::Sol, 1);
        assert!(v.above_threshold);
        assert_eq!(v.decisive_check, DecisiveCheck::ApprovalRequired);
    }

    #[test]
    fn max_threshold_means_delegate_is_fully_autonomous_up_to_caps() {
        let mut policy = base_policy();
        policy.approval_threshold_lamports = u64::MAX;
        let v = evaluate(&policy, true, 1_000_500, AssetKind::Sol, 499_999_999);
        assert!(v.allowed);
        assert!(!v.above_threshold);
    }
}

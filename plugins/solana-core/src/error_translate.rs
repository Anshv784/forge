//! Turns a failed `sendTransaction` RPC response into one fixed,
//! human-readable sentence instead of the raw JSON-RPC error blob.
//!
//! Anchor logs an `AnchorError` line in one of three shapes (from
//! `anchor-lang-error`'s `AnchorError::log`, verified against the vendored
//! crate source rather than assumed):
//!
//! - `AnchorError occurred. Error Code: {name}. Error Number: {n}. Error Message: {msg}.`
//!   — a plain `require!`/`require_eq!`/etc. failure with no account context.
//!   Every `CarapaceError` variant this program's own instruction handlers
//!   raise (`PerTxCapExceeded`, `ApprovalRequired`, ...) logs this shape.
//! - `AnchorError thrown in {file}:{line}. Error Code: {name}. ...`
//! - `AnchorError caused by account: {account}. Error Code: {name}. ...`
//!   — an account **constraint** failure (`has_one`, `seeds`, or the account
//!   simply not existing). Critically, **the allow-list check is one of
//!   these**: `execute.rs` doesn't `require!` it, it's enforced structurally
//!   by the `allowlist_entry` account's `seeds` constraint, so a
//!   non-allow-listed destination surfaces as `AccountNotInitialized` (3012)
//!   or `ConstraintSeeds` (2006) *on the `allowlist_entry` account*, not as
//!   `CarapaceError::TargetNotAllowlisted` — that variant is defined but
//!   never actually thrown anywhere in the program. Confirmed by grepping
//!   the program source, not assumed from the error name.
//!
//! Anchor's own framework codes (2000-3999 range) were extracted from
//! `anchor-lang-error 1.1.2`'s source directly, not from memory — see this
//! crate's `Cargo.lock` for the pinned version. If the program's Anchor
//! version changes, re-verify these numbers.

use serde_json::Value;

/// Account name + Anchor error code name extracted from a failed
/// transaction's logs.
#[derive(Debug, Clone, PartialEq, Eq)]
struct AnchorLogError {
    account_name: Option<String>,
    error_name: String,
}

/// Scans logs for the last line matching one of Anchor's three
/// `AnchorError` log shapes. Last, not first, in case a CPI'd program (the
/// System or Token program) happens to log something matching first — this
/// program's own error is always the one that aborts the transaction, so it
/// is always the last such line to appear.
fn parse_anchor_log_error(logs: &[String]) -> Option<AnchorLogError> {
    for line in logs.iter().rev() {
        let msg = line.strip_prefix("Program log: ").unwrap_or(line);

        if let Some(rest) = msg.strip_prefix("AnchorError caused by account: ") {
            let (account, rest) = rest.split_once(". Error Code: ")?;
            let (name, _) = rest.split_once('.')?;
            return Some(AnchorLogError {
                account_name: Some(account.to_string()),
                error_name: name.to_string(),
            });
        }
        if let Some(rest) = msg.strip_prefix("AnchorError occurred. Error Code: ") {
            let (name, _) = rest.split_once('.')?;
            return Some(AnchorLogError { account_name: None, error_name: name.to_string() });
        }
        if let Some(rest) = msg.strip_prefix("AnchorError thrown in ") {
            let (_, rest) = rest.split_once(". Error Code: ")?;
            let (name, _) = rest.split_once('.')?;
            return Some(AnchorLogError { account_name: None, error_name: name.to_string() });
        }
    }
    None
}

/// The plain-English mapping. Order matters: `(account, error)` pairs are
/// checked before the account-agnostic fallback table, since the same
/// Anchor framework error name (e.g. `AccountNotInitialized`) means
/// something completely different depending on which account triggered it.
fn account_specific_message(account: &str, error_name: &str) -> Option<&'static str> {
    match (account, error_name) {
        ("allowlist_entry", "AccountNotInitialized" | "ConstraintSeeds") => Some(
            "I can't pay that address — it's not on the allow-list. The owner can add it from the dashboard or the Blink link.",
        ),
        ("policy", "AccountNotInitialized") => {
            Some("There's no Carapace policy set up yet for this owner and agent index.")
        }
        ("delegate", "ConstraintHasOne") => {
            Some("This agent's signing key doesn't match the one configured on the policy — this is an operator setup problem, not something a retry will fix.")
        }
        ("spl_mint", "ConstraintHasOne" | "ConstraintTokenMint") => {
            Some("This policy is configured for a different SPL token than the one requested.")
        }
        ("destination_token_account", "AccountNotInitialized" | "ConstraintTokenMint") => {
            Some("That destination doesn't have a token account for this asset yet — they'd need to create one before receiving it.")
        }
        ("intent", "ConstraintAccountIsNone" | "AccountNotInitialized") => {
            Some("That Intent doesn't exist — check the nonce, or propose it again.")
        }
        _ => None,
    }
}

/// Account-agnostic fallback: every `CarapaceError` this program's own
/// `require!` calls can raise, keyed by exact variant name (see
/// `programs/carapace/programs/carapace/src/errors.rs` — this list must be
/// kept in sync with it by hand, there is no shared source of truth across
/// the Rust-on-chain / Rust-in-plugin boundary).
fn carapace_error_message(error_name: &str) -> Option<&'static str> {
    match error_name {
        "PerTxCapExceeded" => Some("That's above the per-transaction limit for this policy. Even with approval, a single transfer can't exceed it — try a smaller amount, or ask the owner to raise the limit."),
        "DailyCapExceeded" => Some("That would go over today's spending limit. It resets on a rolling daily window — try again later, or ask the owner to raise the daily cap."),
        "MathOverflow" => Some("That amount is too large to process (arithmetic overflow) — it's not a realistic amount for this policy."),
        "ApprovalRequired" => Some("That amount needs a human's approval first — it's at or above this policy's approval threshold. Call carapace_propose_intent, then retry once the owner approves it."),
        "IntentMismatch" => Some("The approved Intent doesn't exactly match this transfer's asset, amount, or destination, so it can't be used for it. Propose a new Intent for this exact transfer."),
        "IntentNotPending" => Some("That Intent isn't waiting for a decision anymore — it's already been approved, denied, or executed."),
        "IntentNotApproved" => Some("That Intent hasn't been approved by the owner yet."),
        "IntentExpired" => Some("That Intent expired before it could be used. Propose a new one."),
        "IntentNotExpired" => Some("That Intent hasn't expired yet, so it can't be cleaned up."),
        "IntentStillPending" => Some("That Intent is still awaiting a decision, so it can't be closed yet."),
        "TargetNotAllowlisted" => Some("I can't pay that address — it's not on the allow-list. The owner can add it from the dashboard."),
        "PolicyPaused" => Some("This agent is paused right now. The owner needs to resume it before I can do anything on-chain."),
        "ReentrancyLocked" => Some("Another transfer against this same policy is already in progress — try again in a moment."),
        "UnauthorizedDelegate" => Some("This isn't the delegate key configured on this policy — an operator setup problem, not something a retry will fix."),
        "UnauthorizedOwner" => Some("Only the policy owner can do that, and this key isn't it."),
        "PolicyExpired" => Some("This policy has expired. Only the owner can withdraw from it now."),
        "ZeroAmount" => Some("The amount has to be greater than zero."),
        "TtlTooLong" => Some("That approval window is longer than this policy allows — ask for a shorter one."),
        "PayerMismatch" => Some("Only whoever originally paid to create that Intent can close it."),
        "MintMismatch" => Some("That's not the SPL token this policy is configured for."),
        "DelegateUnchanged" => Some("That's already the current delegate — nothing to rotate."),
        _ => None,
    }
}

/// Translates a failed `sendTransaction` RPC error (the `Err` string
/// produced by `rpc::parse_result`, which is `serde_json::Value::to_string()`
/// on the RPC's `error` field) into one plain sentence.
///
/// Falls back to a short, bounded generic message — never the raw JSON —
/// for anything not in the tables above, so an unmapped error still can't
/// blow up the model's context, but *is* visibly generic enough that it
/// should prompt adding a real mapping rather than being mistaken for a
/// known, well-explained refusal.
pub fn translate_send_transaction_error(raw_error: &str) -> String {
    let Ok(parsed) = serde_json::from_str::<Value>(raw_error) else {
        return truncate_fallback(raw_error);
    };

    let logs = parsed
        .get("data")
        .and_then(|d| d.get("logs"))
        .and_then(|l| l.as_array());

    let Some(logs) = logs else {
        return truncate_fallback(raw_error);
    };

    let logs: Vec<String> = logs.iter().filter_map(|v| v.as_str().map(str::to_string)).collect();
    let Some(parsed_error) = parse_anchor_log_error(&logs) else {
        return truncate_fallback(raw_error);
    };

    if let Some(account) = &parsed_error.account_name {
        if let Some(msg) = account_specific_message(account, &parsed_error.error_name) {
            return msg.to_string();
        }
    }
    if let Some(msg) = carapace_error_message(&parsed_error.error_name) {
        return msg.to_string();
    }

    format!(
        "The transfer was rejected on-chain ({}{}) — this is an error this dashboard doesn't have a plain-English explanation for yet.",
        parsed_error.error_name,
        parsed_error
            .account_name
            .map(|a| format!(", account: {a}"))
            .unwrap_or_default()
    )
}

fn truncate_fallback(raw_error: &str) -> String {
    const MAX_CHARS: usize = 220;
    if raw_error.chars().count() <= MAX_CHARS {
        format!("The transfer failed: {raw_error}")
    } else {
        let truncated: String = raw_error.chars().take(MAX_CHARS).collect();
        format!("The transfer failed: {truncated}…")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn error_json(logs: &[&str]) -> String {
        serde_json::json!({
            "code": -32002,
            "message": "Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1773",
            "data": { "logs": logs }
        })
        .to_string()
    }

    #[test]
    fn maps_approval_required_plain_require_error() {
        let raw = error_json(&[
            "Program GuZ6yoSDkTcYh2PKAeoDdb51ZhP9i7pRhL6MGrZXST8L invoke [1]",
            "Program log: Instruction: ExecuteTransferSol",
            "Program log: AnchorError occurred. Error Code: ApprovalRequired. Error Number: 6003. Error Message: This amount requires an approved Intent before it can execute.",
            "Program GuZ6yoSDkTcYh2PKAeoDdb51ZhP9i7pRhL6MGrZXST8L failed: custom program error: 0x1773",
        ]);
        let msg = translate_send_transaction_error(&raw);
        assert!(msg.contains("needs a human's approval"), "got: {msg}");
    }

    #[test]
    fn maps_not_allowlisted_from_account_constraint_error_not_the_dead_custom_variant() {
        let raw = error_json(&[
            "Program log: AnchorError caused by account: allowlist_entry. Error Code: AccountNotInitialized. Error Number: 3012. Error Message: The program expected this account to be already initialized.",
        ]);
        let msg = translate_send_transaction_error(&raw);
        assert!(msg.contains("not on the allow-list"), "got: {msg}");
    }

    #[test]
    fn allowlist_constraint_seeds_variant_also_maps_to_not_allowlisted() {
        let raw = error_json(&[
            "Program log: AnchorError caused by account: allowlist_entry. Error Code: ConstraintSeeds. Error Number: 2006. Error Message: A seeds constraint was violated.",
        ]);
        let msg = translate_send_transaction_error(&raw);
        assert!(msg.contains("not on the allow-list"), "got: {msg}");
    }

    #[test]
    fn same_error_code_on_a_different_account_gives_a_different_message() {
        let raw = error_json(&[
            "Program log: AnchorError caused by account: policy. Error Code: AccountNotInitialized. Error Number: 3012. Error Message: The program expected this account to be already initialized.",
        ]);
        let msg = translate_send_transaction_error(&raw);
        assert!(msg.contains("no Carapace policy set up"), "got: {msg}");
        assert!(!msg.contains("allow-list"));
    }

    #[test]
    fn maps_per_tx_cap_exceeded() {
        let raw = error_json(&[
            "Program log: AnchorError occurred. Error Code: PerTxCapExceeded. Error Number: 6000. Error Message: Per-transaction spend cap exceeded.",
        ]);
        let msg = translate_send_transaction_error(&raw);
        assert!(msg.contains("per-transaction limit"), "got: {msg}");
    }

    #[test]
    fn maps_daily_cap_exceeded() {
        let raw = error_json(&[
            "Program log: AnchorError occurred. Error Code: DailyCapExceeded. Error Number: 6001. Error Message: Daily spend cap exceeded.",
        ]);
        let msg = translate_send_transaction_error(&raw);
        assert!(msg.contains("spending limit"), "got: {msg}");
    }

    #[test]
    fn unrecognized_error_name_falls_back_to_bounded_generic_message_not_raw_json() {
        let raw = error_json(&[
            "Program log: AnchorError occurred. Error Code: SomeFutureErrorNobodyMappedYet. Error Number: 6099. Error Message: made up for this test.",
        ]);
        let msg = translate_send_transaction_error(&raw);
        assert!(msg.contains("SomeFutureErrorNobodyMappedYet"));
        assert!(!msg.contains('{'), "must not leak raw JSON: {msg}");
    }

    #[test]
    fn completely_unparseable_input_still_returns_a_bounded_string() {
        let raw = "not json at all, just a network timeout string of arbitrary length ".repeat(20);
        let msg = translate_send_transaction_error(&raw);
        assert!(msg.chars().count() < raw.chars().count());
        assert!(msg.starts_with("The transfer failed:"));
    }

    #[test]
    fn missing_logs_field_falls_back_gracefully() {
        let raw = serde_json::json!({"code": -32602, "message": "invalid params"}).to_string();
        let msg = translate_send_transaction_error(&raw);
        assert!(msg.contains("invalid params"));
    }
}

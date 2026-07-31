use anchor_lang::prelude::*;

#[error_code]
pub enum CarapaceError {
    #[msg("Per-transaction spend cap exceeded")]
    PerTxCapExceeded,
    #[msg("Daily spend cap exceeded")]
    DailyCapExceeded,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("This amount requires an approved Intent before it can execute")]
    ApprovalRequired,
    #[msg("The provided Intent does not match the action being executed")]
    IntentMismatch,
    #[msg("Intent is not in Pending status")]
    IntentNotPending,
    #[msg("Intent is not in Approved status")]
    IntentNotApproved,
    #[msg("Intent has expired")]
    IntentExpired,
    #[msg("Intent has not yet expired")]
    IntentNotExpired,
    #[msg("Intent is still Pending and cannot be closed")]
    IntentStillPending,
    #[msg("Destination is not on the policy allow-list")]
    TargetNotAllowlisted,
    #[msg("Policy is paused")]
    PolicyPaused,
    #[msg("Reentrant call into a locked policy")]
    ReentrancyLocked,
    #[msg("Signer is not the policy delegate")]
    UnauthorizedDelegate,
    #[msg("Signer is not the policy owner")]
    UnauthorizedOwner,
    #[msg("Policy has expired")]
    PolicyExpired,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Requested TTL exceeds the maximum allowed intent lifetime")]
    TtlTooLong,
    #[msg("Rent payer does not match the intent's stored payer")]
    PayerMismatch,
    #[msg("Mint does not match this policy's configured SPL token")]
    MintMismatch,
    #[msg("New delegate must differ from the current delegate")]
    DelegateUnchanged,
}

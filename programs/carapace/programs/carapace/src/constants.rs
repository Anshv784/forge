/// PDA seed prefixes. Keep short — every byte here is paid for on every
/// derivation and every account the runtime has to hash.
pub mod seeds {
    pub const POLICY: &[u8] = b"policy";
    pub const SOL_VAULT: &[u8] = b"sol-vault";
    pub const TOKEN_VAULT_AUTHORITY: &[u8] = b"tv-auth";
    pub const ALLOWLIST: &[u8] = b"allow";
    pub const INTENT: &[u8] = b"intent";
}

/// The daily spend cap resets on the first transaction on/after this many
/// seconds have elapsed since `window_start_ts`. This is a fixed-reset
/// bucket, not a true sliding window — see docs/SECURITY.md for the
/// implication (spending the cap right before and right after a reset is
/// possible; this is a documented, deliberate simplification).
pub const SECONDS_PER_DAY: i64 = 86_400;

/// Longest lifetime a proposed Intent may request before it must be approved
/// or executed, in seconds. Keeps stale approval requests from lingering
/// indefinitely and being approved long after the human forgot about them.
pub const MAX_INTENT_TTL_SECONDS: i64 = 7 * SECONDS_PER_DAY;

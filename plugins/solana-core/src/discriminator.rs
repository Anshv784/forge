use sha2::{Digest, Sha256};

/// Anchor's 8-byte discriminator scheme: `sha256("<namespace>:<name>")[0..8]`.
/// Used for instruction sighashes (`namespace = "global"`), account
/// discriminators (`namespace = "account"`), and event discriminators
/// (`namespace = "event"`). Reimplemented here rather than depending on
/// `anchor-lang` (far too heavy for a wasm32-wasip2 guest) — verified
/// against real Carapace IDL discriminators in `tests/cross_check.rs`.
pub fn anchor_discriminator(namespace: &str, name: &str) -> [u8; 8] {
    let preimage = format!("{namespace}:{name}");
    let hash = Sha256::digest(preimage.as_bytes());
    let mut out = [0u8; 8];
    out.copy_from_slice(&hash[..8]);
    out
}

pub fn instruction_discriminator(ix_name: &str) -> [u8; 8] {
    anchor_discriminator("global", ix_name)
}

pub fn account_discriminator(account_name: &str) -> [u8; 8] {
    anchor_discriminator("account", account_name)
}

pub fn event_discriminator(event_name: &str) -> [u8; 8] {
    anchor_discriminator("event", event_name)
}

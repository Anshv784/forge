//! Day-0 spike: prove that the pure-compute Solana primitives Carapace's WASM
//! tool plugins depend on (deterministic Ed25519 signing + PDA derivation)
//! behave identically on `wasm32-wasip2` and on a native target. No RNG, no
//! network, no filesystem — only primitives that must survive the sandbox.
//!
//! Run natively:   cargo run -p wasm-signing-spike
//! Run under wasm: cargo build -p wasm-signing-spike --release --target wasm32-wasip2
//!                 wasmtime run target/wasm32-wasip2/release/spike.wasm
//! The two runs must print byte-identical output.

use curve25519_dalek::edwards::CompressedEdwardsY;
use ed25519_dalek::{Signer, SigningKey};
use sha2::{Digest, Sha256};

/// Fixed 32-byte seed so native and wasm runs are directly comparable.
/// Not a real key — spike-only.
const TEST_SEED: [u8; 32] = [
    7, 20, 33, 46, 59, 72, 85, 98, 111, 124, 137, 150, 163, 176, 189, 202, 215, 228, 241, 254, 11,
    24, 37, 50, 63, 76, 89, 102, 115, 128, 141, 154,
];

const CARAPACE_PROGRAM_ID: [u8; 32] = [9u8; 32];

fn find_program_address(seeds: &[&[u8]], program_id: &[u8; 32]) -> ([u8; 32], u8) {
    for bump in (0..=u8::MAX).rev() {
        let mut hasher = Sha256::new();
        for seed in seeds {
            hasher.update(seed);
        }
        hasher.update([bump]);
        hasher.update(program_id);
        hasher.update(b"ProgramDerivedAddress");
        let hash: [u8; 32] = hasher.finalize().into();

        // A valid PDA must be a hash that is NOT a point on the ed25519 curve
        // (i.e. it has no corresponding private key). If decompression
        // succeeds, this candidate IS on the curve, so it's rejected.
        if CompressedEdwardsY::from_slice(&hash)
            .expect("sha256 output is always 32 bytes")
            .decompress()
            .is_none()
        {
            return (hash, bump);
        }
    }
    panic!("no off-curve PDA found in 256 bump attempts (astronomically unlikely)");
}

fn main() {
    // 1. Deterministic Ed25519 signing (no RNG at signing time).
    let signing_key = SigningKey::from_bytes(&TEST_SEED);
    let message = b"carapace:policy:approve_intent:nonce=1:amount=1000000";
    let signature = signing_key.sign(message);

    println!("pubkey={}", bs58::encode(signing_key.verifying_key().to_bytes()).into_string());
    println!("signature={}", bs58::encode(signature.to_bytes()).into_string());

    // Signature must verify, and must be deterministic (RFC 8032) so the same
    // key+message always produces the same bytes on any target.
    signing_key
        .verifying_key()
        .verify_strict(message, &signature)
        .expect("self-verification must succeed");

    // 2. PDA derivation identical to solana-program's `find_program_address`,
    // reimplemented from primitives (sha2 + curve25519-dalek) since we
    // deliberately exclude the full solana-sdk/solana-program dependency
    // tree from the wasm32-wasip2 build.
    let owner = signing_key.verifying_key().to_bytes();
    let (pda, bump) = find_program_address(&[b"policy", &owner, &[0u8, 0u8]], &CARAPACE_PROGRAM_ID);
    println!("policy_pda={}", bs58::encode(pda).into_string());
    println!("policy_bump={bump}");

    println!("spike=ok");
}

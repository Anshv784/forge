use crate::pubkey::Pubkey;
use ed25519_dalek::{Signer, SigningKey};

/// Deterministic Ed25519 signing only — this crate never generates keypairs
/// (that needs an RNG and happens once, externally, at provisioning time).
/// Verified byte-for-byte identical between native and wasm32-wasip2 in
/// `spikes/wasm-signing-spike`.
pub struct Keypair {
    signing_key: SigningKey,
}

impl Keypair {
    pub fn from_secret_bytes(secret: &[u8; 32]) -> Self {
        Self {
            signing_key: SigningKey::from_bytes(secret),
        }
    }

    pub fn pubkey(&self) -> Pubkey {
        Pubkey::new_from_array(self.signing_key.verifying_key().to_bytes())
    }

    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        self.signing_key.sign(message).to_bytes()
    }
}

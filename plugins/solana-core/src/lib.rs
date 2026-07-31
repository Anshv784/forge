//! Minimal, dependency-light Solana primitives portable to `wasm32-wasip2`.
//!
//! Deliberately excludes `solana-sdk`/`solana-client`/`reqwest`/`tokio` —
//! see `docs/SPIKES.md` in the repo root for why. Everything here is either
//! pure computation (signing, PDA derivation, transaction serialization) or
//! transport-agnostic (RPC request/response shapes; the actual HTTP call is
//! made by each caller — WASI HTTP inside a WASM tool component, anything
//! else natively).

pub mod carapace;
pub mod discriminator;
pub mod instruction;
pub mod keypair;
pub mod message;
pub mod pubkey;
pub mod rpc;
pub mod short_vec;
pub mod transaction;

pub use instruction::{AccountMeta, Instruction};
pub use keypair::Keypair;
pub use pubkey::Pubkey;
pub use transaction::{build_and_sign_transaction, Transaction};

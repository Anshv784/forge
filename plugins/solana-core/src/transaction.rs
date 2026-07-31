use crate::instruction::Instruction;
use crate::keypair::Keypair;
use crate::message::{compile_message, CompiledMessage};
use crate::pubkey::Pubkey;
use crate::short_vec;
use base64::Engine;

pub struct Transaction {
    pub signatures: Vec<[u8; 64]>,
    pub message: CompiledMessage,
}

/// Compiles `instructions` into a `Message` and signs it with every provided
/// keypair whose pubkey appears in the message's required-signature set.
/// Signature slots are filled in `account_keys` order, matching the wire
/// format's requirement that `signatures[i]` correspond to
/// `message.account_keys[i]`.
pub fn build_and_sign_transaction(
    payer: Pubkey,
    instructions: &[Instruction],
    recent_blockhash: [u8; 32],
    signers: &[&Keypair],
) -> Transaction {
    let message = compile_message(payer, instructions, recent_blockhash);
    let num_sigs = message.header.num_required_signatures as usize;
    let mut signatures = vec![[0u8; 64]; num_sigs];

    for signer in signers {
        let pubkey = signer.pubkey();
        if let Some(pos) = message.account_keys.iter().position(|k| *k == pubkey) {
            if pos < num_sigs {
                signatures[pos] = signer.sign(&message.bytes);
            }
        }
    }

    Transaction { signatures, message }
}

impl Transaction {
    pub fn to_wire_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::new();
        short_vec::encode(self.signatures.len() as u16, &mut bytes);
        for sig in &self.signatures {
            bytes.extend_from_slice(sig);
        }
        bytes.extend_from_slice(&self.message.bytes);
        bytes
    }

    pub fn to_base64(&self) -> String {
        base64::engine::general_purpose::STANDARD.encode(self.to_wire_bytes())
    }

    /// True if every required signer actually signed. A partially-signed
    /// transaction (an all-zero signature slot) will be rejected by the
    /// cluster — callers should check this before submitting rather than
    /// relying on the RPC error alone.
    pub fn is_fully_signed(&self) -> bool {
        self.signatures.iter().all(|s| *s != [0u8; 64])
    }
}

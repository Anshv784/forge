use crate::instruction::Instruction;
use crate::pubkey::Pubkey;
use crate::short_vec;

pub struct MessageHeader {
    pub num_required_signatures: u8,
    pub num_readonly_signed_accounts: u8,
    pub num_readonly_unsigned_accounts: u8,
}

pub struct CompiledMessage {
    pub bytes: Vec<u8>,
    pub account_keys: Vec<Pubkey>,
    pub header: MessageHeader,
}

struct MergedAccount {
    pubkey: Pubkey,
    is_signer: bool,
    is_writable: bool,
}

/// Compiles instructions into Solana's legacy `Message` wire format,
/// reimplementing `solana_sdk::message::Message::new`'s account-ordering and
/// short-vec-length-prefixed serialization from scratch (see `short_vec.rs`
/// for why this can't just be `bincode::serialize`d). Verified byte-for-byte
/// against `solana-sdk` in `tests/cross_check.rs`.
pub fn compile_message(
    payer: Pubkey,
    instructions: &[Instruction],
    recent_blockhash: [u8; 32],
) -> CompiledMessage {
    let mut merged: Vec<MergedAccount> = Vec::new();
    let upsert = |pubkey: Pubkey, is_signer: bool, is_writable: bool, merged: &mut Vec<MergedAccount>| {
        if let Some(existing) = merged.iter_mut().find(|a| a.pubkey == pubkey) {
            existing.is_signer |= is_signer;
            existing.is_writable |= is_writable;
        } else {
            merged.push(MergedAccount {
                pubkey,
                is_signer,
                is_writable,
            });
        }
    };

    // The fee payer is always the first writable signer.
    upsert(payer, true, true, &mut merged);
    for ix in instructions {
        upsert(ix.program_id, false, false, &mut merged);
        for meta in &ix.accounts {
            upsert(meta.pubkey, meta.is_signer, meta.is_writable, &mut merged);
        }
    }

    // Partition into the 4 canonical buckets Solana requires, preserving
    // first-seen order within each bucket (the payer, inserted first, lands
    // at index 0 as required).
    let mut writable_signers = Vec::new();
    let mut readonly_signers = Vec::new();
    let mut writable_nonsigners = Vec::new();
    let mut readonly_nonsigners = Vec::new();
    for a in merged {
        match (a.is_signer, a.is_writable) {
            (true, true) => writable_signers.push(a.pubkey),
            (true, false) => readonly_signers.push(a.pubkey),
            (false, true) => writable_nonsigners.push(a.pubkey),
            (false, false) => readonly_nonsigners.push(a.pubkey),
        }
    }

    let header = MessageHeader {
        num_required_signatures: (writable_signers.len() + readonly_signers.len()) as u8,
        num_readonly_signed_accounts: readonly_signers.len() as u8,
        num_readonly_unsigned_accounts: readonly_nonsigners.len() as u8,
    };

    let mut account_keys = Vec::with_capacity(
        writable_signers.len() + readonly_signers.len() + writable_nonsigners.len() + readonly_nonsigners.len(),
    );
    account_keys.extend(writable_signers);
    account_keys.extend(readonly_signers);
    account_keys.extend(writable_nonsigners);
    account_keys.extend(readonly_nonsigners);

    let index_of = |account_keys: &[Pubkey], key: &Pubkey| -> u8 {
        account_keys
            .iter()
            .position(|k| k == key)
            .expect("account key missing from compiled account list") as u8
    };

    let mut bytes = Vec::new();
    bytes.push(header.num_required_signatures);
    bytes.push(header.num_readonly_signed_accounts);
    bytes.push(header.num_readonly_unsigned_accounts);

    short_vec::encode(account_keys.len() as u16, &mut bytes);
    for key in &account_keys {
        bytes.extend_from_slice(&key.to_bytes());
    }

    bytes.extend_from_slice(&recent_blockhash);

    short_vec::encode(instructions.len() as u16, &mut bytes);
    for ix in instructions {
        bytes.push(index_of(&account_keys, &ix.program_id));
        short_vec::encode(ix.accounts.len() as u16, &mut bytes);
        for meta in &ix.accounts {
            bytes.push(index_of(&account_keys, &meta.pubkey));
        }
        short_vec::encode(ix.data.len() as u16, &mut bytes);
        bytes.extend_from_slice(&ix.data);
    }

    CompiledMessage {
        bytes,
        account_keys,
        header,
    }
}

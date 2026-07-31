//! Cross-checks this crate's hand-rolled primitives against `solana-sdk`
//! (native-only dev-dependency, never pulled into the wasm32-wasip2 build)
//! and against the real discriminators from the built Carapace IDL, so the
//! wasm-portable reimplementation is verified rather than merely plausible.

use solana_core::carapace::{execute_transfer_sol_instruction, propose_intent_instruction, AssetKind, ProposeIntentParams};
use solana_core::discriminator::{account_discriminator, event_discriminator, instruction_discriminator};
use solana_core::pubkey::Pubkey;
use solana_core::{build_and_sign_transaction, Keypair};

// Ground truth, extracted directly from `programs/carapace/target/idl/carapace.json`
// (`anchor build`'s own IDL generator), not recomputed by hand.
#[test]
fn instruction_discriminators_match_real_idl() {
    assert_eq!(
        instruction_discriminator("propose_intent"),
        [235, 187, 3, 3, 160, 187, 162, 226]
    );
    assert_eq!(
        instruction_discriminator("execute_transfer_sol"),
        [39, 236, 8, 21, 147, 246, 127, 155]
    );
    assert_eq!(
        instruction_discriminator("execute_transfer_spl"),
        [190, 46, 226, 209, 109, 254, 225, 187]
    );
}

#[test]
fn account_discriminators_match_real_idl() {
    assert_eq!(account_discriminator("Policy"), [222, 135, 7, 163, 235, 177, 33, 68]);
    assert_eq!(account_discriminator("Intent"), [247, 162, 35, 165, 254, 111, 129, 109]);
}

#[test]
fn event_discriminators_match_real_idl() {
    assert_eq!(
        event_discriminator("IntentProposed"),
        [249, 245, 19, 13, 26, 73, 164, 131]
    );
    assert_eq!(
        event_discriminator("TransferExecuted"),
        [8, 128, 224, 132, 112, 216, 192, 35]
    );
}

fn to_sdk_pubkey(p: Pubkey) -> solana_sdk::pubkey::Pubkey {
    solana_sdk::pubkey::Pubkey::new_from_array(p.to_bytes())
}

#[test]
fn find_program_address_matches_solana_sdk() {
    let program_id = Pubkey::new_from_array([7u8; 32]);
    let owner = Pubkey::new_from_array([42u8; 32]);
    let seeds: &[&[u8]] = &[b"policy", &owner.to_bytes(), &0u16.to_le_bytes()];

    let (ours, our_bump) = Pubkey::find_program_address(seeds, &program_id);

    let sdk_program_id = to_sdk_pubkey(program_id);
    let (theirs, their_bump) = solana_sdk::pubkey::Pubkey::find_program_address(seeds, &sdk_program_id);

    assert_eq!(our_bump, their_bump);
    assert_eq!(ours.to_bytes(), theirs.to_bytes());
}

#[test]
fn find_program_address_matches_solana_sdk_for_several_seed_sets() {
    let program_id = Pubkey::new_from_array([99u8; 32]);
    let sdk_program_id = to_sdk_pubkey(program_id);

    for i in 0u64..20 {
        let seed_bytes = i.to_le_bytes();
        let seeds: &[&[u8]] = &[b"intent", &seed_bytes];
        let (ours, our_bump) = Pubkey::find_program_address(seeds, &program_id);
        let (theirs, their_bump) = solana_sdk::pubkey::Pubkey::find_program_address(seeds, &sdk_program_id);
        assert_eq!(our_bump, their_bump, "bump mismatch at i={i}");
        assert_eq!(ours.to_bytes(), theirs.to_bytes(), "pda mismatch at i={i}");
    }
}

/// Builds an equivalent single-instruction (system transfer) transaction
/// with both this crate and `solana-sdk`, from the same keys/blockhash, and
/// asserts the fully-serialized wire bytes are byte-for-byte identical —
/// the strongest possible check on `short_vec` encoding and the
/// signer/writable account-ordering logic in `message.rs`.
#[test]
fn transfer_transaction_wire_bytes_match_solana_sdk() {
    let payer_secret = [11u8; 32];
    let dest_secret = [22u8; 32];
    let our_payer = Keypair::from_secret_bytes(&payer_secret);
    let blockhash = [55u8; 32];

    let system_program = Pubkey::new_from_array([0u8; 32]);
    let dest_pubkey = solana_core::keypair::Keypair::from_secret_bytes(&dest_secret).pubkey();

    let ix = solana_core::Instruction {
        program_id: system_program,
        accounts: vec![
            solana_core::AccountMeta::new(our_payer.pubkey(), true),
            solana_core::AccountMeta::new(dest_pubkey, false),
        ],
        // SystemInstruction::Transfer { lamports: u64 } = variant index 2 (u32 LE) + amount (u64 LE).
        data: {
            let mut d = 2u32.to_le_bytes().to_vec();
            d.extend_from_slice(&1_000_000u64.to_le_bytes());
            d
        },
    };

    let our_tx = build_and_sign_transaction(our_payer.pubkey(), &[ix], blockhash, &[&our_payer]);
    let our_bytes = our_tx.to_wire_bytes();

    use solana_sdk::signature::Signer;
    let sdk_payer = solana_sdk::signature::Keypair::new_from_array(payer_secret);
    let sdk_ix = solana_system_interface::instruction::transfer(&sdk_payer.pubkey(), &to_sdk_pubkey(dest_pubkey), 1_000_000);
    let sdk_message = solana_sdk::message::Message::new(&[sdk_ix], Some(&sdk_payer.pubkey()));
    let sdk_tx = solana_sdk::transaction::Transaction::new(
        &[&sdk_payer],
        sdk_message,
        solana_sdk::hash::Hash::new_from_array(blockhash),
    );
    let sdk_bytes = bincode::serialize(&sdk_tx).expect("solana-sdk transaction serializes");

    assert_eq!(our_bytes, sdk_bytes, "wire bytes must match solana-sdk exactly");
}

#[test]
fn propose_intent_instruction_shape() {
    let program_id = Pubkey::new_from_array([1u8; 32]);
    let delegate = Pubkey::new_from_array([2u8; 32]);
    let policy = Pubkey::new_from_array([3u8; 32]);
    let intent = Pubkey::new_from_array([4u8; 32]);
    let destination = Pubkey::new_from_array([5u8; 32]);

    let ix = propose_intent_instruction(
        &program_id,
        &delegate,
        &policy,
        &intent,
        ProposeIntentParams {
            asset: AssetKind::Sol,
            amount: 1_000,
            destination,
            action_hash: [9u8; 32],
            ttl_seconds: 3600,
        },
    );

    assert_eq!(ix.accounts.len(), 4);
    assert_eq!(ix.accounts[0].pubkey, delegate);
    assert!(ix.accounts[0].is_signer && ix.accounts[0].is_writable);
    assert_eq!(&ix.data[..8], &instruction_discriminator("propose_intent"));
}

#[test]
fn execute_transfer_sol_none_intent_uses_program_id_sentinel() {
    let program_id = Pubkey::new_from_array([1u8; 32]);
    let ix = execute_transfer_sol_instruction(
        &program_id,
        &Pubkey::new_from_array([2u8; 32]),
        &Pubkey::new_from_array([3u8; 32]),
        &Pubkey::new_from_array([4u8; 32]),
        &Pubkey::new_from_array([5u8; 32]),
        &Pubkey::new_from_array([6u8; 32]),
        None,
        1_000,
    );
    // intent slot (index 5) must be the program id sentinel when omitted.
    assert_eq!(ix.accounts[5].pubkey, program_id);
}

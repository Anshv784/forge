//! Decodes Carapace's on-chain audit-trail events from transaction logs.
//! Anchor's `emit!` writes events via the `sol_log_data` syscall, which
//! shows up in `getTransaction`'s log lines as `"Program data: <base64>"`.
//! Field order mirrors `programs/carapace/programs/carapace/src/events.rs`
//! exactly (Borsh serializes in declaration order).

use borsh::BorshDeserialize;
use serde::Serialize;
use serde_json::Value;

use crate::carapace::AssetKind;
use crate::discriminator::event_discriminator;
use crate::pubkey::Pubkey;

const PROGRAM_DATA_PREFIX: &str = "Program data: ";

#[derive(BorshDeserialize, Serialize)]
pub struct IntentProposed {
    pub policy: Pubkey,
    pub intent: Pubkey,
    pub nonce: u64,
    pub asset: AssetKind,
    pub amount: u64,
    pub destination: Pubkey,
    pub action_hash: [u8; 32],
    pub expires_at: i64,
}

#[derive(BorshDeserialize, Serialize)]
pub struct IntentApproved {
    pub policy: Pubkey,
    pub intent: Pubkey,
    pub nonce: u64,
}

#[derive(BorshDeserialize, Serialize)]
pub struct IntentDenied {
    pub policy: Pubkey,
    pub intent: Pubkey,
    pub nonce: u64,
}

#[derive(BorshDeserialize, Serialize)]
pub struct TransferExecuted {
    pub policy: Pubkey,
    pub asset: AssetKind,
    pub amount: u64,
    pub destination: Pubkey,
    pub intent: Option<Pubkey>,
    pub spent_today: u64,
    pub total_executed_count: u64,
}

/// Scans one transaction's log lines for known Carapace events, returning
/// each as a `{"type": "...", ...fields}` JSON value tagged with the
/// signature it came from. Unknown discriminators (events this decoder
/// doesn't know about, or another program's logs mixed into the same tx)
/// are silently skipped rather than treated as errors.
pub fn decode_events_from_logs(signature: &str, block_time: Option<i64>, logs: &[String]) -> Vec<Value> {
    let mut out = Vec::new();
    for line in logs {
        let Some(b64) = line.strip_prefix(PROGRAM_DATA_PREFIX) else {
            continue;
        };
        use base64::Engine;
        let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64.trim()) else {
            continue;
        };
        if bytes.len() < 8 {
            continue;
        }
        let (discriminator, mut data) = bytes.split_at(8);
        let mut value = if discriminator == event_discriminator("TransferExecuted") {
            TransferExecuted::deserialize(&mut data).ok().map(|e| {
                let mut v = serde_json::to_value(e).unwrap_or(Value::Null);
                tag(&mut v, "TransferExecuted");
                v
            })
        } else if discriminator == event_discriminator("IntentProposed") {
            IntentProposed::deserialize(&mut data).ok().map(|e| {
                let mut v = serde_json::to_value(e).unwrap_or(Value::Null);
                tag(&mut v, "IntentProposed");
                v
            })
        } else if discriminator == event_discriminator("IntentApproved") {
            IntentApproved::deserialize(&mut data).ok().map(|e| {
                let mut v = serde_json::to_value(e).unwrap_or(Value::Null);
                tag(&mut v, "IntentApproved");
                v
            })
        } else if discriminator == event_discriminator("IntentDenied") {
            IntentDenied::deserialize(&mut data).ok().map(|e| {
                let mut v = serde_json::to_value(e).unwrap_or(Value::Null);
                tag(&mut v, "IntentDenied");
                v
            })
        } else {
            None
        };
        if let Some(v) = value.take() {
            let mut v = v;
            if let Value::Object(map) = &mut v {
                map.insert("signature".to_string(), Value::String(signature.to_string()));
                map.insert(
                    "block_time".to_string(),
                    block_time.map(Value::from).unwrap_or(Value::Null),
                );
            }
            out.push(v);
        }
    }
    out
}

fn tag(value: &mut Value, type_name: &str) {
    if let Value::Object(map) = value {
        map.insert("type".to_string(), Value::String(type_name.to_string()));
    }
}

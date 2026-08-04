//! JSON-RPC request builders and response parsing. Deliberately
//! transport-agnostic — no `reqwest`/`tokio` — so the same code works
//! whether the actual HTTP call is made over WASI HTTP (in a wasm32-wasip2
//! tool component) or a native client (in tests/tooling).

use serde_json::{json, Value};

pub fn get_account_info(id: u64, pubkey_b58: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "getAccountInfo",
        "params": [pubkey_b58, {"encoding": "base64", "commitment": "confirmed"}]
    })
}

pub fn get_latest_blockhash(id: u64) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "getLatestBlockhash",
        "params": [{"commitment": "confirmed"}]
    })
}

pub fn send_transaction(id: u64, tx_base64: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "sendTransaction",
        "params": [tx_base64, {"encoding": "base64", "skipPreflight": false, "preflightCommitment": "confirmed"}]
    })
}

pub fn get_signatures_for_address(id: u64, address_b58: &str, limit: u32) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "getSignaturesForAddress",
        "params": [address_b58, {"limit": limit, "commitment": "confirmed"}]
    })
}

pub fn get_transaction(id: u64, signature: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "getTransaction",
        "params": [signature, {"encoding": "json", "commitment": "confirmed", "maxSupportedTransactionVersion": 0}]
    })
}

/// `getProgramAccounts` with one or more `memcmp` filters (offset into the
/// account's raw data, and the exact bytes expected there). Callers combine
/// an 8-byte account discriminator filter (offset 0) with a field filter
/// (e.g. the `policy` pubkey at offset 8) to scope to one account type
/// belonging to one policy — matching the account layout, not guessing it.
pub fn get_program_accounts_with_memcmp(id: u64, program_id_b58: &str, filters: &[(usize, &[u8])]) -> Value {
    let filter_values: Vec<Value> = filters
        .iter()
        .map(|(offset, bytes)| json!({"memcmp": {"offset": offset, "bytes": bs58::encode(*bytes).into_string()}}))
        .collect();
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "getProgramAccounts",
        "params": [program_id_b58, {"encoding": "base64", "commitment": "confirmed", "filters": filter_values}]
    })
}

/// Decodes one entry of a `getProgramAccounts` result array (`{"pubkey":
/// ..., "account": {"data": [b64, "base64"], ...}}`), stripping the 8-byte
/// discriminator the same way `decode_account_data` does for a single
/// `getAccountInfo` result.
pub fn decode_program_account_entry(entry: &Value) -> Result<(String, Vec<u8>), String> {
    let pubkey = entry.get("pubkey").and_then(|p| p.as_str()).ok_or("missing pubkey")?.to_string();
    let data_b64 = entry
        .get("account")
        .and_then(|a| a.get("data"))
        .and_then(|d| d.get(0))
        .and_then(|d| d.as_str())
        .ok_or("missing account data")?;
    use base64::Engine;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(data_b64)
        .map_err(|e| e.to_string())?;
    if raw.len() < 8 {
        return Err("account data shorter than the 8-byte discriminator".to_string());
    }
    Ok((pubkey, raw[8..].to_vec()))
}

/// Unwraps the `{"result": ...}` / `{"error": ...}` JSON-RPC envelope.
pub fn parse_result(response: &Value) -> Result<&Value, String> {
    if let Some(err) = response.get("error") {
        return Err(err.to_string());
    }
    response
        .get("result")
        .ok_or_else(|| "RPC response missing both `result` and `error`".to_string())
}

/// Decodes the base64 account data from a `getAccountInfo` result's
/// `value.data` field (a `[base64_string, "base64"]` tuple per the JSON-RPC
/// spec), stripping the leading 8-byte Anchor account discriminator.
pub fn decode_account_data(get_account_info_result: &Value) -> Result<Vec<u8>, String> {
    let value = get_account_info_result
        .get("value")
        .filter(|v| !v.is_null())
        .ok_or("account does not exist")?;
    let data_b64 = value
        .get("data")
        .and_then(|d| d.get(0))
        .and_then(|d| d.as_str())
        .ok_or("missing account data")?;
    use base64::Engine;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(data_b64)
        .map_err(|e| e.to_string())?;
    if raw.len() < 8 {
        return Err("account data shorter than the 8-byte discriminator".to_string());
    }
    Ok(raw[8..].to_vec())
}

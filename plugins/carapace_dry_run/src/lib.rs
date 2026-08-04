#[allow(warnings)]
mod bindings;

use bindings::exports::zeroclaw::plugin::plugin_info::Guest as PluginInfoGuest;
use bindings::exports::zeroclaw::plugin::tool::{Guest as ToolGuest, ToolResult};
use bindings::wasi::http::outgoing_handler;
use bindings::wasi::http::types::{Fields, Method, OutgoingBody, OutgoingRequest, Scheme};
use borsh::BorshDeserialize;
use serde::Deserialize;
use serde_json::json;
use solana_core::carapace::{allowlist_entry_pda, policy_pda, AssetKind};
use solana_core::dry_run::evaluate;
use solana_core::pubkey::Pubkey;
use solana_core::rpc;
use std::time::{SystemTime, UNIX_EPOCH};

struct Component;

#[derive(Deserialize)]
struct Args {
    rpc_url: String,
    program_id: String,
    owner: String,
    #[serde(default)]
    agent_index: u16,
    /// "sol" or "spl".
    asset: String,
    amount: u64,
    /// The recipient **wallet** address — not a token account. For SPL,
    /// the on-chain allow-list is keyed on the token account's *owner* (see
    /// `execute.rs`'s `ExecuteTransferSpl` accounts), so this must match
    /// exactly what `carapace_execute_transfer` would resolve, or the
    /// verdict is evaluating the wrong destination.
    destination: String,
}

fn split_url(url: &str) -> Result<(Scheme, String, String), String> {
    let (scheme, rest) = if let Some(rest) = url.strip_prefix("https://") {
        (Scheme::Https, rest)
    } else if let Some(rest) = url.strip_prefix("http://") {
        (Scheme::Http, rest)
    } else {
        return Err("rpc_url must start with http:// or https://".to_string());
    };
    match rest.find('/') {
        Some(idx) => Ok((scheme, rest[..idx].to_string(), rest[idx..].to_string())),
        None => Ok((scheme, rest.to_string(), "/".to_string())),
    }
}

fn http_post_json(scheme: &Scheme, authority: &str, path: &str, body: &[u8]) -> Result<Vec<u8>, String> {
    let headers = Fields::new();
    headers
        .append("content-type", &b"application/json".to_vec())
        .map_err(|e| format!("set content-type header failed: {e:?}"))?;

    let request = OutgoingRequest::new(headers);
    request.set_method(&Method::Post).map_err(|_| "set_method failed")?;
    request.set_scheme(Some(scheme)).map_err(|_| "set_scheme failed")?;
    request.set_authority(Some(authority)).map_err(|_| "set_authority failed")?;
    request
        .set_path_with_query(Some(path))
        .map_err(|_| "set_path_with_query failed")?;

    let outgoing_body = request.body().map_err(|_| "request body already taken")?;
    {
        let stream = outgoing_body.write().map_err(|_| "output stream already taken")?;
        stream
            .blocking_write_and_flush(body)
            .map_err(|e| format!("writing request body failed: {e:?}"))?;
    }
    OutgoingBody::finish(outgoing_body, None).map_err(|e| format!("finishing request body failed: {e:?}"))?;

    let future_response =
        outgoing_handler::handle(request, None).map_err(|e| format!("handle failed: {e:?}"))?;
    if future_response.get().is_none() {
        future_response.subscribe().block();
    }
    let response = future_response
        .get()
        .ok_or("future still not ready after blocking")?
        .map_err(|_| "future-incoming-response consumed twice".to_string())?
        .map_err(|e| format!("request error: {e:?}"))?;

    let status = response.status();
    let incoming_body = response.consume().map_err(|_| "consuming response body failed")?;
    let mut data = Vec::new();
    {
        let stream = incoming_body.stream().map_err(|_| "response stream already taken")?;
        loop {
            match stream.blocking_read(64 * 1024) {
                Ok(chunk) if chunk.is_empty() => break,
                Ok(chunk) => data.extend_from_slice(&chunk),
                Err(_) => break,
            }
        }
    }

    if status >= 300 {
        return Err(format!("RPC endpoint returned HTTP {status}: {}", String::from_utf8_lossy(&data)));
    }
    Ok(data)
}

fn rpc_call(scheme: &Scheme, authority: &str, path: &str, request_body: &serde_json::Value) -> Result<serde_json::Value, String> {
    let response_bytes = http_post_json(scheme, authority, path, request_body.to_string().as_bytes())?;
    let response: serde_json::Value =
        serde_json::from_slice(&response_bytes).map_err(|e| format!("invalid RPC response JSON: {e}"))?;
    rpc::parse_result(&response).map(|v| v.clone())
}

/// Does a `getAccountInfo` result's `value` field represent an existing
/// account? (Existence, not full deserialization, is all the allow-list
/// check needs — see `state.rs`'s doc comment: "Existence of this PDA is
/// the allow-list check; there is no on/off flag.")
fn account_exists(get_account_info_result: &serde_json::Value) -> bool {
    get_account_info_result.get("value").is_some_and(|v| !v.is_null())
}

fn run(args_json: &str) -> Result<String, String> {
    let args: Args = serde_json::from_str(args_json).map_err(|e| format!("invalid arguments: {e}"))?;
    let (scheme, authority, path) = split_url(&args.rpc_url)?;

    let program_id = Pubkey::from_base58(&args.program_id).map_err(|_| "invalid program_id".to_string())?;
    let owner = Pubkey::from_base58(&args.owner).map_err(|_| "invalid owner".to_string())?;
    let destination = Pubkey::from_base58(&args.destination).map_err(|_| "invalid destination".to_string())?;
    let asset = match args.asset.to_lowercase().as_str() {
        "sol" => AssetKind::Sol,
        "spl" => AssetKind::Spl,
        other => return Err(format!("asset must be \"sol\" or \"spl\", got {other:?}")),
    };

    let (policy_address, _bump) = policy_pda(&program_id, &owner, args.agent_index);
    let (allowlist_entry, _bump) = allowlist_entry_pda(&program_id, &policy_address, &destination);

    let policy_result = rpc_call(&scheme, &authority, &path, &rpc::get_account_info(1, &policy_address.to_base58()))?;
    let policy_data = rpc::decode_account_data(&policy_result)
        .map_err(|e| format!("failed to read Policy account (wrong address, or not yet initialized?): {e}"))?;
    let policy = solana_core::carapace::Policy::try_from_slice(&policy_data)
        .map_err(|e| format!("failed to decode Policy account: {e}"))?;

    let allowlist_result = rpc_call(&scheme, &authority, &path, &rpc::get_account_info(2, &allowlist_entry.to_base58()))?;
    let is_allowlisted = account_exists(&allowlist_result);

    // See dry_run.rs's doc comment on `evaluate` for exactly how this can
    // diverge from the cluster's own `Clock::get()` — local wall-clock time,
    // not a chain read. Sub-second skew only matters within a second or two
    // of the daily-reset boundary or an Intent's expiry, which this tool
    // doesn't evaluate anyway (dry runs don't take an intent_nonce).
    let now: i64 = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    let verdict = evaluate(&policy, is_allowlisted, now, asset, args.amount);

    let (max_daily_field, remaining_field, threshold_field) = match asset {
        AssetKind::Sol => ("max_daily_lamports", "remaining_today_lamports", "approval_threshold_lamports"),
        AssetKind::Spl => ("max_daily_base_units", "remaining_today_base_units", "approval_threshold_base_units"),
    };

    let reason = match verdict.decisive_check {
        solana_core::dry_run::DecisiveCheck::NotAllowlisted => {
            "That address isn't on the allow-list. The owner needs to add it before any transfer to it can succeed, at any amount."
        }
        solana_core::dry_run::DecisiveCheck::Paused => {
            "This agent is paused. The owner needs to resume it first."
        }
        solana_core::dry_run::DecisiveCheck::PolicyExpired => {
            "This policy has expired. Only the owner can withdraw from it now."
        }
        solana_core::dry_run::DecisiveCheck::PerTxCapExceeded => {
            "That's above the per-transaction cap for this policy, regardless of approval."
        }
        solana_core::dry_run::DecisiveCheck::DailyCapExceeded => {
            "That would exceed what's left of today's spending cap."
        }
        solana_core::dry_run::DecisiveCheck::ApprovalRequired => {
            "That amount is at or above the approval threshold. Call carapace_propose_intent first, then retry with the resulting intent_nonce once the owner approves it."
        }
        solana_core::dry_run::DecisiveCheck::WouldSucceed => {
            "Within every cap, allow-listed, and below the approval threshold — carapace_execute_transfer should succeed immediately."
        }
    };

    let mut output = serde_json::Map::new();
    output.insert("allowed".to_string(), json!(verdict.allowed));
    output.insert("decisive_check".to_string(), json!(verdict.decisive_check.as_str()));
    output.insert("above_approval_threshold".to_string(), json!(verdict.above_threshold));
    output.insert(threshold_field.to_string(), json!(verdict.approval_threshold));
    output.insert(remaining_field.to_string(), json!(verdict.remaining_today));
    output.insert(max_daily_field.to_string(), json!(verdict.max_daily));
    output.insert("max_per_tx".to_string(), json!(verdict.max_per_tx));
    output.insert("reason".to_string(), json!(reason));

    Ok(serde_json::Value::Object(output).to_string())
}

impl PluginInfoGuest for Component {
    fn plugin_name() -> String {
        "carapace_dry_run".to_string()
    }
    fn plugin_version() -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}

impl ToolGuest for Component {
    fn name() -> String {
        "carapace_dry_run".to_string()
    }

    fn description() -> String {
        "Checks whether a SOL or SPL transfer WOULD succeed right now, without submitting \
         anything — no transaction, no state change. Returns which specific on-chain check \
         would decide it (allow-list, pause, per-tx cap, daily cap, or approval threshold), \
         plus the remaining daily budget. Call this before proposing or executing anything you \
         aren't already confident about, since it costs nothing and can't fail destructively. \
         Not a guarantee: on-chain state can change between this call and a real execute (see \
         its own docs) — treat it as advisory, not a lock."
            .to_string()
    }

    fn parameters_schema() -> String {
        json!({
            "type": "object",
            "properties": {
                "rpc_url": {"type": "string"},
                "program_id": {"type": "string"},
                "owner": {"type": "string", "description": "The policy owner's wallet address (base58)"},
                "agent_index": {"type": "integer", "default": 0},
                "asset": {"type": "string", "enum": ["sol", "spl"]},
                "amount": {"type": "integer", "description": "Base units: lamports for SOL, smallest unit for SPL"},
                "destination": {"type": "string", "description": "Recipient WALLET address (base58) — not a token account, even for SPL"}
            },
            "required": ["rpc_url", "program_id", "owner", "asset", "amount", "destination"]
        })
        .to_string()
    }

    fn execute(args: String) -> Result<ToolResult, String> {
        match run(&args) {
            Ok(output) => Ok(ToolResult { success: true, output, error: None }),
            Err(e) => Ok(ToolResult { success: false, output: String::new(), error: Some(e) }),
        }
    }
}

bindings::export!(Component with_types_in bindings);

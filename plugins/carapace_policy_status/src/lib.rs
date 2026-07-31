#[allow(warnings)]
mod bindings;

use bindings::exports::zeroclaw::plugin::plugin_info::Guest as PluginInfoGuest;
use bindings::exports::zeroclaw::plugin::tool::{Guest as ToolGuest, ToolResult};
use bindings::wasi::http::outgoing_handler;
use bindings::wasi::http::types::{Fields, Method, OutgoingBody, OutgoingRequest, Scheme};
use borsh::BorshDeserialize;
use serde::Deserialize;
use serde_json::json;
use solana_core::carapace::policy_pda;
use solana_core::pubkey::Pubkey;
use solana_core::rpc;

struct Component;

#[derive(Deserialize)]
struct Args {
    rpc_url: String,
    program_id: String,
    owner: String,
    #[serde(default)]
    agent_index: u16,
}

/// Splits a `https://host[:port]/path` URL into (authority, path) for the
/// WASI HTTP request builder, which wants scheme/authority/path separately.
fn split_url(url: &str) -> Result<(String, String), String> {
    let rest = url.strip_prefix("https://").ok_or("only https:// RPC URLs are supported")?;
    match rest.find('/') {
        Some(idx) => Ok((rest[..idx].to_string(), rest[idx..].to_string())),
        None => Ok((rest.to_string(), "/".to_string())),
    }
}

fn http_post_json(authority: &str, path: &str, body: &[u8]) -> Result<Vec<u8>, String> {
    let headers = Fields::new();
    headers
        .append("content-type", &b"application/json".to_vec())
        .map_err(|e| format!("set content-type header failed: {e:?}"))?;

    let request = OutgoingRequest::new(headers);
    request.set_method(&Method::Post).map_err(|_| "set_method failed")?;
    request.set_scheme(Some(&Scheme::Https)).map_err(|_| "set_scheme failed")?;
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
        return Err(format!(
            "RPC endpoint returned HTTP {status}: {}",
            String::from_utf8_lossy(&data)
        ));
    }
    Ok(data)
}

fn run(args_json: &str) -> Result<String, String> {
    let args: Args = serde_json::from_str(args_json).map_err(|e| format!("invalid arguments: {e}"))?;
    let (authority, path) = split_url(&args.rpc_url)?;

    let program_id = Pubkey::from_base58(&args.program_id).map_err(|_| "invalid program_id".to_string())?;
    let owner = Pubkey::from_base58(&args.owner).map_err(|_| "invalid owner".to_string())?;
    let (policy_address, _bump) = policy_pda(&program_id, &owner, args.agent_index);

    let request_body = rpc::get_account_info(1, &policy_address.to_base58());
    let response_bytes = http_post_json(&authority, &path, request_body.to_string().as_bytes())?;
    let response: serde_json::Value =
        serde_json::from_slice(&response_bytes).map_err(|e| format!("invalid RPC response JSON: {e}"))?;
    let result = rpc::parse_result(&response)?;
    let account_data = rpc::decode_account_data(result)?;

    let policy = solana_core::carapace::Policy::try_from_slice(&account_data)
        .map_err(|e| format!("failed to decode Policy account (wrong address, or account not yet initialized?): {e}"))?;

    Ok(json!({
        "policy_address": policy_address.to_base58(),
        "owner": policy.owner.to_base58(),
        "delegate": policy.delegate.to_base58(),
        "spl_mint": policy.spl_mint.to_base58(),
        "paused": policy.paused,
        "sol": {
            "max_per_tx_lamports": policy.max_per_tx_lamports,
            "max_daily_lamports": policy.max_daily_lamports,
            "spent_today_lamports": policy.spent_today_lamports,
            "remaining_today_lamports": policy.max_daily_lamports.saturating_sub(policy.spent_today_lamports),
            "approval_threshold_lamports": policy.approval_threshold_lamports,
        },
        "spl": {
            "max_per_tx_base_units": policy.max_per_tx_spl,
            "max_daily_base_units": policy.max_daily_spl,
            "spent_today_base_units": policy.spent_today_spl,
            "remaining_today_base_units": policy.max_daily_spl.saturating_sub(policy.spent_today_spl),
            "approval_threshold_base_units": policy.approval_threshold_spl,
        },
        "next_intent_nonce": policy.next_intent_nonce,
        "total_executed_count": policy.total_executed_count,
        "expires_at": policy.expires_at,
    })
    .to_string())
}

impl PluginInfoGuest for Component {
    fn plugin_name() -> String {
        "carapace_policy_status".to_string()
    }

    fn plugin_version() -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}

impl ToolGuest for Component {
    fn name() -> String {
        "carapace_policy_status".to_string()
    }

    fn description() -> String {
        "Reads a Carapace Policy account on Solana and returns its current spending \
         caps, remaining daily allowance, and pause state as JSON. Always call this \
         before proposing or executing a transfer so you know whether the amount \
         needs an approved Intent first."
            .to_string()
    }

    fn parameters_schema() -> String {
        json!({
            "type": "object",
            "properties": {
                "rpc_url": {"type": "string", "description": "Solana JSON-RPC HTTPS endpoint, e.g. https://api.devnet.solana.com"},
                "program_id": {"type": "string", "description": "Carapace program address (base58)"},
                "owner": {"type": "string", "description": "The policy owner's wallet address (base58)"},
                "agent_index": {"type": "integer", "description": "Which of the owner's agents to look up (default 0)", "default": 0}
            },
            "required": ["rpc_url", "program_id", "owner"]
        })
        .to_string()
    }

    fn execute(args: String) -> Result<ToolResult, String> {
        match run(&args) {
            Ok(output) => Ok(ToolResult {
                success: true,
                output,
                error: None,
            }),
            Err(e) => Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some(e),
            }),
        }
    }
}

bindings::export!(Component with_types_in bindings);

#[allow(warnings)]
mod bindings;

use bindings::exports::zeroclaw::plugin::plugin_info::Guest as PluginInfoGuest;
use bindings::exports::zeroclaw::plugin::tool::{Guest as ToolGuest, ToolResult};
use bindings::wasi::http::outgoing_handler;
use bindings::wasi::http::types::{Fields, Method, OutgoingBody, OutgoingRequest, Scheme};
use serde::Deserialize;
use serde_json::{json, Value};
use solana_core::carapace::policy_pda;
use solana_core::events::decode_events_from_logs;
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
    #[serde(default = "default_limit")]
    limit: u32,
}

fn default_limit() -> u32 {
    5
}

/// `http://` is only meant for pointing at a local validator
/// (surfpool/solana-test-validator) during development.
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
        return Err(format!(
            "RPC endpoint returned HTTP {status}: {}",
            String::from_utf8_lossy(&data)
        ));
    }
    Ok(data)
}

fn rpc_call(scheme: &Scheme, authority: &str, path: &str, request_body: &Value) -> Result<Value, String> {
    let response_bytes = http_post_json(scheme, authority, path, request_body.to_string().as_bytes())?;
    let response: Value =
        serde_json::from_slice(&response_bytes).map_err(|e| format!("invalid RPC response JSON: {e}"))?;
    rpc::parse_result(&response).map(|v| v.clone())
}

fn run(args_json: &str) -> Result<String, String> {
    let args: Args = serde_json::from_str(args_json).map_err(|e| format!("invalid arguments: {e}"))?;
    let (scheme, authority, path) = split_url(&args.rpc_url)?;

    let program_id = Pubkey::from_base58(&args.program_id).map_err(|_| "invalid program_id".to_string())?;
    let owner = Pubkey::from_base58(&args.owner).map_err(|_| "invalid owner".to_string())?;
    let (policy_address, _bump) = policy_pda(&program_id, &owner, args.agent_index);
    let limit = args.limit.clamp(1, 25);

    let signatures_result = rpc_call(&scheme, &authority, &path, &rpc::get_signatures_for_address(1, &policy_address.to_base58(), limit))?;
    let signatures = signatures_result.as_array().cloned().unwrap_or_default();

    let mut events = Vec::new();
    for (i, entry) in signatures.iter().enumerate() {
        let Some(signature) = entry.get("signature").and_then(|s| s.as_str()) else {
            continue;
        };
        if entry.get("err").map(|e| !e.is_null()).unwrap_or(false) {
            continue; // skip failed transactions — nothing executed on-chain to report
        }
        let block_time = entry.get("blockTime").and_then(|t| t.as_i64());

        let tx_result = rpc_call(&scheme, &authority, &path, &rpc::get_transaction(2 + i as u64, signature))?;
        let logs: Vec<String> = tx_result
            .get("meta")
            .and_then(|m| m.get("logMessages"))
            .and_then(|l| l.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        events.extend(decode_events_from_logs(signature, block_time, &logs));
    }

    Ok(json!({
        "policy_address": policy_address.to_base58(),
        "receipts": events,
    })
    .to_string())
}

impl PluginInfoGuest for Component {
    fn plugin_name() -> String {
        "carapace_list_receipts".to_string()
    }

    fn plugin_version() -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}

impl ToolGuest for Component {
    fn name() -> String {
        "carapace_list_receipts".to_string()
    }

    fn description() -> String {
        "Lists recent on-chain receipts (executed transfers, proposed/approved/denied Intents) \
         for a Carapace policy, decoded from Solana transaction logs. Use this to show the human \
         a verifiable audit trail, or to check whether a specific Intent was approved before \
         trying to execute it."
            .to_string()
    }

    fn parameters_schema() -> String {
        json!({
            "type": "object",
            "properties": {
                "rpc_url": {"type": "string", "description": "Solana JSON-RPC HTTPS endpoint"},
                "program_id": {"type": "string", "description": "Carapace program address (base58)"},
                "owner": {"type": "string", "description": "The policy owner's wallet address (base58)"},
                "agent_index": {"type": "integer", "description": "Which of the owner's agents to look up (default 0)", "default": 0},
                "limit": {"type": "integer", "description": "How many recent transactions to scan for events (1-25, default 5)", "default": 5}
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

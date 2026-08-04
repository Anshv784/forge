#[allow(warnings)]
mod bindings;

use bindings::exports::zeroclaw::plugin::plugin_info::Guest as PluginInfoGuest;
use bindings::exports::zeroclaw::plugin::tool::{Guest as ToolGuest, ToolResult};
use bindings::wasi::http::outgoing_handler;
use bindings::wasi::http::types::{Fields, Method, OutgoingBody, OutgoingRequest, Scheme};
use borsh::BorshDeserialize;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use solana_core::carapace::{intent_pda, policy_pda, propose_intent_instruction, AssetKind, ProposeIntentParams};
use solana_core::pubkey::Pubkey;
use solana_core::{build_and_sign_transaction, rpc, Keypair};

struct Component;

/// Injected by ZeroClaw's host, never by the caller: when this plugin's
/// manifest requests the `config_read` permission, the host merges the
/// plugin's resolved (encrypted-at-rest) config section into the arguments
/// under this reserved key, stripping any value the caller/LLM tried to
/// supply itself first — see `crates/zeroclaw-plugins/src/runtime.rs`'s
/// `inject_config` in ZeroClaw's own source. The agent's session key never
/// appears in the LLM's tool-call arguments or context this way.
#[derive(Deserialize)]
struct PluginConfig {
    delegate_secret_key: String,
}

#[derive(Deserialize)]
struct Args {
    rpc_url: String,
    program_id: String,
    owner: String,
    #[serde(default)]
    agent_index: u16,
    #[serde(rename = "__config")]
    config: PluginConfig,
    /// "sol" or "spl".
    asset: String,
    /// Base units: lamports for SOL, the mint's smallest unit for SPL.
    amount: u64,
    /// The destination wallet (must already be on the policy's allow-list).
    destination: String,
    /// Human-readable description of the action, e.g. "pay invoice #42 to
    /// Acme for 12 USDC". Hashed (sha256) into the on-chain Intent; the full
    /// text is returned in this tool's own output so the calling agent can
    /// relay it to the human verbatim (e.g. in the approval notification).
    action_description: String,
    #[serde(default = "default_ttl")]
    ttl_seconds: i64,
}

fn default_ttl() -> i64 {
    3600
}

/// Splits an `http(s)://host[:port][/path]` URL into (scheme, authority,
/// path). `http://` is only meant for pointing at a local validator
/// (surfpool/solana-test-validator) during development — a real deployment
/// should always use `https://`.
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

fn rpc_call(scheme: &Scheme, authority: &str, path: &str, request_body: &Value) -> Result<Value, String> {
    let response_bytes = http_post_json(scheme, authority, path, request_body.to_string().as_bytes())?;
    let response: Value =
        serde_json::from_slice(&response_bytes).map_err(|e| format!("invalid RPC response JSON: {e}"))?;
    rpc::parse_result(&response).map(|v| v.clone())
}

fn hex_decode_32(s: &str) -> Result<[u8; 32], String> {
    let s = s.trim().strip_prefix("0x").unwrap_or(s.trim());
    if s.len() != 64 {
        return Err("delegate_secret_key must be a 32-byte hex string (64 hex characters)".to_string());
    }
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).map_err(|_| "invalid hex in delegate_secret_key")?;
    }
    Ok(out)
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
    let delegate = Keypair::from_secret_bytes(&hex_decode_32(&args.config.delegate_secret_key)?);

    let (policy_address, _bump) = policy_pda(&program_id, &owner, args.agent_index);

    let policy_account = rpc_call(&scheme, &authority, &path, &rpc::get_account_info(1, &policy_address.to_base58()))?;
    let policy_data = rpc::decode_account_data(&policy_account)?;
    let policy = solana_core::carapace::Policy::try_from_slice(&policy_data)
        .map_err(|e| format!("failed to decode Policy account: {e}"))?;

    if policy.delegate != delegate.pubkey() {
        return Err("delegate_secret_key does not match this policy's configured delegate".to_string());
    }

    let (intent_address, _intent_bump) = intent_pda(&program_id, &policy_address, policy.next_intent_nonce);

    let blockhash_result = rpc_call(&scheme, &authority, &path, &rpc::get_latest_blockhash(2))?;
    let blockhash_b58 = blockhash_result
        .get("value")
        .and_then(|v| v.get("blockhash"))
        .and_then(|b| b.as_str())
        .ok_or("missing blockhash in RPC response")?;
    let blockhash_bytes = Pubkey::from_base58(blockhash_b58).map_err(|_| "invalid blockhash")?.to_bytes();

    let action_hash: [u8; 32] = Sha256::digest(args.action_description.as_bytes()).into();

    let instruction = propose_intent_instruction(
        &program_id,
        &delegate.pubkey(),
        &policy_address,
        &intent_address,
        ProposeIntentParams {
            asset,
            amount: args.amount,
            destination,
            action_hash,
            ttl_seconds: args.ttl_seconds,
        },
    );

    let tx = build_and_sign_transaction(delegate.pubkey(), &[instruction], blockhash_bytes, &[&delegate]);
    if !tx.is_fully_signed() {
        return Err("internal error: transaction is missing a required signature".to_string());
    }

    let send_result = rpc_call(&scheme, &authority, &path, &rpc::send_transaction(3, &tx.to_base64()))
        .map_err(|raw| solana_core::error_translate::translate_send_transaction_error(&raw))?;
    let signature = send_result.as_str().unwrap_or_default().to_string();

    Ok(json!({
        "intent_address": intent_address.to_base58(),
        "nonce": policy.next_intent_nonce,
        "signature": signature,
        "asset": args.asset,
        "amount": args.amount,
        "destination": args.destination,
        "action_description": args.action_description,
        "expires_in_seconds": args.ttl_seconds,
        "next_step": "This Intent is Pending. Tell the human what you're proposing and why, and that they need to approve it (via the Carapace Console or the Blink link) before you can execute it.",
    })
    .to_string())
}

impl PluginInfoGuest for Component {
    fn plugin_name() -> String {
        "carapace_propose_intent".to_string()
    }
    fn plugin_version() -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}

impl ToolGuest for Component {
    fn name() -> String {
        "carapace_propose_intent".to_string()
    }

    fn description() -> String {
        "Proposes a transfer above the policy's approval threshold as a Pending on-chain \
         Intent that a human must approve before it can be executed. Call \
         carapace_policy_status first to check whether the amount actually needs approval — \
         amounts below the threshold can go straight to carapace_execute_transfer."
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
                "destination": {"type": "string", "description": "Recipient wallet address (base58); must already be allow-listed"},
                "action_description": {"type": "string", "description": "Human-readable reason for this payment, shown to the approver"},
                "ttl_seconds": {"type": "integer", "default": 3600, "description": "How long the approval window stays open"}
            },
            "required": ["rpc_url", "program_id", "owner", "asset", "amount", "destination", "action_description"]
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

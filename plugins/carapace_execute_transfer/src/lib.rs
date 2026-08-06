#[allow(warnings)]
mod bindings;

use bindings::exports::zeroclaw::plugin::plugin_info::Guest as PluginInfoGuest;
use bindings::exports::zeroclaw::plugin::tool::{Guest as ToolGuest, ToolResult};
use bindings::wasi::http::outgoing_handler;
use bindings::wasi::http::types::{Fields, Method, OutgoingBody, OutgoingRequest, Scheme};
use borsh::BorshDeserialize;
use serde::Deserialize;
use serde_json::{json, Value};
use solana_core::carapace::{
    allowlist_entry_pda, associated_token_address, execute_transfer_sol_instruction,
    execute_transfer_spl_instruction, intent_pda, policy_pda, sol_vault_pda, token_vault_authority_pda,
};
use solana_core::format::parse_amount;
use solana_core::pubkey::Pubkey;
use solana_core::{build_and_sign_transaction, rpc, Keypair};

struct Component;

/// Injected by ZeroClaw's host from this plugin's encrypted-at-rest config
/// section (requires the `config_read` permission) — never supplied by the
/// caller/LLM. See `carapace_propose_intent`'s matching doc comment.
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
    /// Decimal amount in human units — SOL for `asset: "sol"`, whole tokens
    /// for `asset: "spl"` (e.g. `"1"`, `"0.5"`) — NOT lamports or base
    /// units. Must match whatever amount was used in the corresponding
    /// carapace_propose_intent call when intent_nonce is set, since the
    /// on-chain program checks the executed amount against the Intent
    /// exactly.
    amount: String,
    destination: String,
    /// Required when this amount is at/above the policy's approval
    /// threshold — the nonce of a previously proposed, now-Approved Intent
    /// whose asset/amount/destination match exactly. Omit for
    /// below-threshold transfers.
    #[serde(default)]
    intent_nonce: Option<u64>,
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
    let decimals = match args.asset.to_lowercase().as_str() {
        "sol" => 9,
        "spl" => 6,
        other => return Err(format!("asset must be \"sol\" or \"spl\", got {other:?}")),
    };
    let amount = parse_amount(&args.amount, decimals)?;
    let delegate = Keypair::from_secret_bytes(&hex_decode_32(&args.config.delegate_secret_key)?);

    let (policy_address, _bump) = policy_pda(&program_id, &owner, args.agent_index);
    let policy_account = rpc_call(&scheme, &authority, &path, &rpc::get_account_info(1, &policy_address.to_base58()))?;
    let policy_data = rpc::decode_account_data(&policy_account)?;
    let policy = solana_core::carapace::Policy::try_from_slice(&policy_data)
        .map_err(|e| format!("failed to decode Policy account: {e}"))?;

    if policy.delegate != delegate.pubkey() {
        return Err("delegate_secret_key does not match this policy's configured delegate".to_string());
    }

    let intent_address = args.intent_nonce.map(|nonce| intent_pda(&program_id, &policy_address, nonce).0);
    let (allowlist_entry, _) = allowlist_entry_pda(&program_id, &policy_address, &destination);

    let blockhash_result = rpc_call(&scheme, &authority, &path, &rpc::get_latest_blockhash(2))?;
    let blockhash_b58 = blockhash_result
        .get("value")
        .and_then(|v| v.get("blockhash"))
        .and_then(|b| b.as_str())
        .ok_or("missing blockhash in RPC response")?;
    let blockhash_bytes = Pubkey::from_base58(blockhash_b58).map_err(|_| "invalid blockhash")?.to_bytes();

    let instruction = match args.asset.to_lowercase().as_str() {
        "sol" => {
            let (sol_vault, _) = sol_vault_pda(&program_id, &policy_address);
            execute_transfer_sol_instruction(
                &program_id,
                &delegate.pubkey(),
                &policy_address,
                &sol_vault,
                &destination,
                &allowlist_entry,
                intent_address.as_ref(),
                amount,
            )
        }
        "spl" => {
            let (token_vault_authority, _) = token_vault_authority_pda(&program_id, &policy_address);
            let token_vault = associated_token_address(&token_vault_authority, &policy.spl_mint);
            let destination_token_account = associated_token_address(&destination, &policy.spl_mint);
            execute_transfer_spl_instruction(
                &program_id,
                &delegate.pubkey(),
                &policy_address,
                &policy.spl_mint,
                &token_vault_authority,
                &token_vault,
                &destination_token_account,
                &allowlist_entry,
                intent_address.as_ref(),
                amount,
            )
        }
        _ => unreachable!("asset already validated to be \"sol\" or \"spl\" above"),
    };

    // The delegate is also the transaction fee payer here — unlike
    // propose_intent, execute_transfer doesn't create any new account, so
    // this only costs the delegate the base network fee (~5000 lamports),
    // not rent.
    let tx = build_and_sign_transaction(delegate.pubkey(), &[instruction], blockhash_bytes, &[&delegate]);
    if !tx.is_fully_signed() {
        return Err("internal error: transaction is missing a required signature".to_string());
    }

    let send_result = rpc_call(&scheme, &authority, &path, &rpc::send_transaction(3, &tx.to_base64()))
        .map_err(|raw| solana_core::error_translate::translate_send_transaction_error(&raw))?;
    let signature = send_result.as_str().unwrap_or_default().to_string();

    Ok(json!({
        "signature": signature,
        "asset": args.asset,
        "amount": args.amount,
        "amount_base_units": amount,
        "destination": args.destination,
        "used_intent_nonce": args.intent_nonce,
    })
    .to_string())
}

impl PluginInfoGuest for Component {
    fn plugin_name() -> String {
        "carapace_execute_transfer".to_string()
    }
    fn plugin_version() -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}

impl ToolGuest for Component {
    fn name() -> String {
        "carapace_execute_transfer".to_string()
    }

    fn description() -> String {
        "Executes a SOL or SPL token transfer from a Carapace vault, subject to the on-chain \
         policy's per-transaction cap, daily cap, and destination allow-list. If the amount is \
         at or above the policy's approval threshold, you must pass intent_nonce for a matching, \
         already-Approved Intent (see carapace_propose_intent) — the on-chain program checks the \
         asset, amount, and destination match exactly and will reject the transaction otherwise."
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
                "amount": {"type": "string", "description": "Decimal amount in SOL (for asset=\"sol\") or whole tokens (for asset=\"spl\"), e.g. \"1\" or \"0.5\" — NOT lamports or base units, do not convert it yourself"},
                "destination": {"type": "string", "description": "Recipient wallet address (base58); must already be allow-listed"},
                "intent_nonce": {"type": "integer", "description": "Nonce of a matching, Approved Intent — required above the approval threshold"}
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

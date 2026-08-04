# Carapace ZeroClaw plugins

Real WASM Component Model tool plugins targeting ZeroClaw's own experimental
`zeroclaw:plugin@0.1.0` `tool-plugin` world (`wit/v0/tool.wit` in the
[zeroclaw-labs/zeroclaw](https://github.com/zeroclaw-labs/zeroclaw) repo) —
not a generic MCP wrapper. Each plugin is a single-tool `wasm32-wasip2`
component, matching the WIT contract's "one component = one tool" design.

## Layout

```
solana-core/            Shared Rust crate: signing, PDA derivation, transaction
                         building, JSON-RPC request/response shapes. Portable to
                         wasm32-wasip2; verified against solana-sdk and the real
                         built Carapace IDL in its own test suite.
wit-deps/                Vendored wasi:{http,io,clocks,random,filesystem,cli,sockets}
                         WIT packages, pinned to the exact version wasmtime-wasi-http
                         27.0.0 bundles — see docs/SPIKES.md for why version-pinning
                         these (rather than resolving from a live registry) matters.
carapace_policy_status/  Tool: reads a Policy account, returns caps/allowance/pause
                         state as JSON. Read-only, no secrets.
carapace_list_receipts/  Tool: decodes on-chain events (transfers, Intent
                         approvals/denials) from transaction logs into a
                         verifiable audit trail. Read-only, no secrets.
carapace_propose_intent/ Tool: builds, signs, and submits a propose_intent
                         transaction for an above-threshold transfer.
carapace_execute_transfer/ Tool: builds, signs, and submits execute_transfer_sol
                         or execute_transfer_spl, with or without an approved
                         Intent.
bundle/                  The assembled, installable output: one directory per
                         plugin, each with manifest.toml (Ed25519-signed) + the
                         built .wasm + SKILL.md.
```

## Status

| Tool | Status | Needs signing key? |
|---|---|---|
| `carapace_policy_status` | ✅ built, signed, verified end-to-end against live devnet RPC | No |
| `carapace_list_receipts` | ✅ built, signed, verified end-to-end against live devnet RPC | No |
| `carapace_propose_intent` | ✅ built, signed, verified end-to-end (local validator: real sign+submit) | Yes (delegate session key) |
| `carapace_execute_transfer` | ✅ built, signed, verified end-to-end incl. replay rejection | Yes (delegate session key) |
| `carapace_dry_run` | ✅ built, signed, verified end-to-end against live devnet RPC | No |

`carapace_dry_run` re-implements `execute.rs`'s `validate_spend` check order
client-side (`solana-core::dry_run::evaluate`) to answer "would this
transfer succeed right now?" with no transaction and no state change. It is
a **second implementation** of that logic, not a call into the program, so
it can disagree with reality — see the doc comment on `evaluate` in
`plugins/solana-core/src/dry_run.rs` for the specific ways it can (mainly:
time-of-check/time-of-use against concurrent transfers). Treat its verdict
as advisory.

All five tools are complete and were run against a real running validator —
see "Verified integration test" below for the full propose → approve →
execute → replay-rejected sequence, executed by these exact `.wasm` binaries
through `wasmtime`, not mocked.

**The delegate's session key never reaches the LLM.** Both signing tools
declare the `config_read` permission and read `delegate_secret_key` from the
reserved `__config` object ZeroClaw's host injects into the arguments at
call time — confirmed directly from their source
(`crates/zeroclaw-plugins/src/runtime.rs`'s `inject_config`): the host merges
the plugin's resolved config section (encrypted at rest, per
`PluginEntryConfig`'s `#[secret]` field in `crates/zeroclaw-config/src/schema.rs`)
under `__config`, **stripping any value the caller/LLM tried to supply
itself first** — so a compromised prompt cannot forge or read the signing
key even in principle. The key isn't in the tool's parameter schema at all
(the agent doesn't need to know it exists), and it never appears in the
LLM's context or tool-call arguments. Configure it per-agent via:

```toml
[plugins]
enabled = true

[[plugins.entries]]
name = "carapace_propose_intent"

  [plugins.entries.config]
  delegate_secret_key = "<32-byte hex seed>"

[[plugins.entries]]
name = "carapace_execute_transfer"

  [plugins.entries.config]
  delegate_secret_key = "<the same 32-byte hex seed>"
```

## Installing a built plugin into ZeroClaw

```bash
cp -r plugins/bundle/carapace_policy_status ~/.zeroclaw/workspace/plugins/
```

Recommended `~/.zeroclaw/config.toml` addition (strict signature verification
— a plugin from an untrusted publisher key will not load at all):

```toml
[plugins]
signature_mode = "strict"
trusted_publisher_keys = ["d67e375ed163d6ae4b67ec55b2822bb97e657d4dbb723cc9abcd060fb4aac86a"]
```

That's this submission's actual publisher key (see
`scripts/sign-plugin-manifest`, which re-implements ZeroClaw's own
`canonical_manifest_bytes`/`sign_manifest` scheme from
`crates/zeroclaw-plugins/src/signature.rs` byte-for-byte, verified by reading
their source directly). The private signing key is deliberately not
committed to this repo (see `.gitignore`'s `.secrets/`/`*.pkcs8` rules).

## Verified integration test

The full agent lifecycle was run against a real Surfpool validator, through
these exact compiled `.wasm` components via `tool_harness` — not mocked, not
simulated in a unit test:

1. `carapace_propose_intent` — proposed a 0.2 SOL transfer (above the 0.1 SOL
   approval threshold). Real signed transaction, real signature, `Intent`
   created on-chain with `status: Pending`.
2. `carapace_execute_transfer` — executed a 0.01 SOL transfer (below
   threshold, no Intent needed). Succeeded; `spent_today` updated on-chain.
3. Owner approved the Intent from step 1 (`approve_intent`, standing in for
   the dashboard/Blink approval this bounty's UI implements).
4. `carapace_execute_transfer` — executed the 0.2 SOL transfer referencing
   the now-`Approved` Intent. Succeeded; `total_executed_count: 2`.
5. `carapace_execute_transfer` — **replayed** the same Intent. Rejected
   on-chain: `AnchorError ... Error Code: IntentNotApproved` (its status was
   already flipped to `Executed` in step 4 — single-use, as designed).
6. `carapace_list_receipts` — returned all four events
   (`IntentProposed`, `TransferExecuted` ×2, `IntentApproved`) decoded
   straight from transaction logs, in the correct order, with the correct
   amounts/nonces.

This is the complete security story working end to end: on-chain caps,
allow-listing, human-approval gating, and replay protection, all exercised
through real WASM components ZeroClaw's own plugin host would load.

## Testing without a full ZeroClaw build

`spikes/component-harness`'s `tool_harness` binary loads and invokes any
`tool-plugin`-shaped component directly via `wasmtime`, exactly mirroring how
ZeroClaw's own `wasm_tool.rs` host does it — no need to compile the full
ZeroClaw workspace to test a plugin end-to-end:

```bash
cargo build -p component-harness --bin tool_harness
./target/debug/tool_harness plugins/bundle/carapace_policy_status/carapace_policy_status.wasm \
  '{"rpc_url":"https://api.devnet.solana.com","program_id":"<program id>","owner":"<owner pubkey>","agent_index":0}'
```

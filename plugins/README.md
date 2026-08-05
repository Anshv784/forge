# Carapace WASM tool plugins

Real WASM Component Model tool plugins targeting ZeroClaw's own experimental
`zeroclaw:plugin@0.1.0` `tool-plugin` world (`wit/v0/tool.wit` in the
[zeroclaw-labs/zeroclaw](https://github.com/zeroclaw-labs/zeroclaw) repo) —
not a generic MCP wrapper. Each plugin is a single-tool `wasm32-wasip2`
component, matching the WIT contract's "one component = one tool" design.

## Layout

```
solana-core/                Shared Rust crate: signing, PDA derivation,
                             transaction building, JSON-RPC shapes, dry-run
                             evaluation logic, Anchor-error translation.
                             Portable to wasm32-wasip2; cross-checked
                             byte-for-byte against solana-sdk and the real
                             built Carapace IDL in its own test suite.
wit-deps/                    Vendored wasi:{http,io,clocks,random,filesystem,
                             cli,sockets} WIT packages, pinned to the exact
                             version wasmtime-wasi-http 27.0.0 bundles —
                             see docs/SPIKES.md for why.
carapace_policy_status/      Reads a Policy account: caps, allowance, pause
                             state. Read-only, no secrets.
carapace_list_receipts/      Decodes on-chain events (transfers, Intent
                             lifecycle) into a verifiable audit trail, plus
                             recent on-chain-recorded failures and every
                             still-pending Intent. Read-only, no secrets.
carapace_dry_run/            Answers "would this transfer succeed right now?"
                             with no transaction and no state change.
                             Read-only, no secrets.
carapace_propose_intent/     Signs and submits propose_intent for an
                             above-threshold transfer.
carapace_execute_transfer/   Signs and submits execute_transfer_sol or
                             execute_transfer_spl, with or without an
                             approved Intent.
bundle/                      Assembled, installable output: one directory
                             per plugin, each with an Ed25519-signed
                             manifest.toml + the built .wasm.
```

## Status

| Tool | Needs signing key? |
|---|---|
| `carapace_policy_status` | No |
| `carapace_list_receipts` | No |
| `carapace_dry_run` | No |
| `carapace_propose_intent` | Yes (delegate session key) |
| `carapace_execute_transfer` | Yes (delegate session key) |

All five are built, signed, and were run against a real, running validator —
not mocked — through these exact compiled `.wasm` binaries via `wasmtime`.
See "Verified integration test" below.

`carapace_dry_run` re-implements `execute.rs`'s on-chain check order
client-side (`solana_core::dry_run::evaluate`). It's a **second
implementation**, not a call into the program, so it can disagree with
reality — mainly time-of-check/time-of-use against a concurrent transfer.
See the doc comment on `evaluate` for the full list. Treat its verdict as
advisory.

`carapace_list_receipts`'s `recent_failures` field will usually be empty:
both signing plugins call `sendTransaction` with the default
`skipPreflight=false`, so most refusals are caught by RPC-side simulation
and never actually reach the chain as a recorded transaction. An empty list
means "no refusal survived long enough to leave a permanent record," not
"nothing was ever refused."

## The delegate's session key never reaches the LLM

Both signing tools declare the `config_read` permission and read
`delegate_secret_key` from the reserved `__config` object ZeroClaw's host
injects into the arguments at call time — confirmed directly from ZeroClaw's
own source (`crates/zeroclaw-plugins/src/runtime.rs`'s `inject_config`): the
host merges the plugin's resolved config section (encrypted at rest, per
`PluginEntryConfig`'s `#[secret]` field) under `__config`, **stripping any
value the caller/LLM tried to supply itself first** — so a compromised
prompt cannot forge or read the signing key even in principle. The key
isn't in the tool's parameter schema at all, and it never appears in the
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

Recommended `~/.zeroclaw/config.toml` addition (strict signature
verification — a plugin from an untrusted publisher key won't load at all):

```toml
[plugins]
signature_mode = "strict"
trusted_publisher_keys = ["d67e375ed163d6ae4b67ec55b2822bb97e657d4dbb723cc9abcd060fb4aac86a"]
```

That's this submission's real publisher key — see
`scripts/sign-plugin-manifest`, which re-implements ZeroClaw's own
`canonical_manifest_bytes`/`sign_manifest` scheme
(`crates/zeroclaw-plugins/src/signature.rs`) byte-for-byte, verified against
their source directly. The private signing key is deliberately not
committed (see `.gitignore`'s `.secrets/`/`*.pkcs8` rules).

## Verified integration test

The full agent lifecycle, run against a real Surfpool validator through
these exact compiled `.wasm` components via `tool_harness` — not mocked, not
a unit test:

1. `carapace_propose_intent` proposes a 0.2 SOL transfer (above the 0.1 SOL
   approval threshold). Real signed transaction; `Intent` created on-chain
   with `status: Pending`.
2. `carapace_execute_transfer` executes a 0.01 SOL transfer (below
   threshold, no Intent needed). Succeeds; `spent_today` updates on-chain.
3. Owner approves the Intent from step 1 (`approve_intent`).
4. `carapace_execute_transfer` executes the 0.2 SOL transfer referencing the
   now-`Approved` Intent. Succeeds; `total_executed_count: 2`.
5. `carapace_execute_transfer` **replays** the same Intent. Rejected
   on-chain (`IntentNotApproved` — its status already flipped to `Executed`
   in step 4; single-use, as designed).
6. `carapace_list_receipts` returns all four events
   (`IntentProposed`, `TransferExecuted` ×2, `IntentApproved`) decoded
   straight from transaction logs, in order, with correct amounts/nonces.

The complete security story — caps, allow-listing, human-approval gating,
replay protection — exercised end to end through real WASM components
ZeroClaw's own plugin host would load.

## Testing without a full ZeroClaw build

`spikes/component-harness`'s `tool_harness` binary loads and invokes any
`tool-plugin`-shaped component directly via `wasmtime`, mirroring exactly how
ZeroClaw's own `wasm_tool.rs` host does it — no need to compile the full
ZeroClaw workspace to test a plugin end to end:

```bash
cargo build -p component-harness --bin tool_harness
./target/debug/tool_harness plugins/bundle/carapace_policy_status/carapace_policy_status.wasm \
  '{"rpc_url":"https://api.devnet.solana.com","program_id":"<program id>","owner":"<owner pubkey>","agent_index":0}'
```

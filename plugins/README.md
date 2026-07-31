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
bundle/                  The assembled, installable output: one directory per
                         plugin, each with manifest.toml (Ed25519-signed) + the
                         built .wasm + SKILL.md.
```

## Status

| Tool | Status | Needs signing key? |
|---|---|---|
| `carapace_policy_status` | ✅ built, signed, verified end-to-end against live devnet RPC | No |
| `carapace_list_receipts` | 🔜 planned | No |
| `carapace_propose_intent` | 🔜 planned | Yes (delegate session key) |
| `carapace_execute_transfer` | 🔜 planned | Yes (delegate session key) |

The two read-only tools need no secrets and were always the low-risk case
(see `docs/SPIKES.md`'s go/no-go). The two signing tools are real, working
`solana-core` instruction builders already (see
`plugins/solana-core/src/carapace.rs` and its cross-checked test suite) — what
remains is wrapping them as components and deciding how the delegate's
session key reaches the sandbox. The leading hypothesis, based on
`wasmtime run -S help` showing a `config[=y|n]` WASI option and ZeroClaw's own
`PluginPermission::ConfigRead` variant, is that ZeroClaw bridges its
per-plugin config section through the standardized `wasi:config/store`
interface — this needs to be confirmed against ZeroClaw's actual host code
before committing to it, since building against a wrong guess would be worse
than not building it yet.

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

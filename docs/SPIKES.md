# Day-0 spikes

Before committing to the full build, two independent unknowns were de-risked
in parallel, per the project plan. Both are now resolved with working,
reproducible code under `spikes/`.

## Spike 1 — `wasm32-wasip2` signing + PDA derivation

**Question:** can the pure-compute Solana primitives a Carapace WASM tool
plugin needs (Ed25519 signing, PDA derivation) actually run correctly inside
a `wasm32-wasip2` Component Model sandbox, given nobody has a well-known
precedent for running `solana-sdk`-style code on this exact target (most
Solana/wasm work targets `wasm32-unknown-unknown` via `wasm-bindgen` for
browsers, a different target and ABI)?

**Location:** `spikes/wasm-signing-spike/`

**Result: GO.** `cargo build --target wasm32-wasip2 --release` compiles
cleanly with zero landmines from the excluded dependency set (no
`solana-client`, no full `solana-sdk`, no `reqwest`/`tokio`) using only:
`ed25519-dalek` (signing), `curve25519-dalek` (the on-curve check
`find_program_address` needs), `sha2`, `bs58`, `serde`/`serde_json`.

Running the compiled `.wasm` under `wasmtime run` produces **byte-identical
output** to a native (`cargo run`) control build for:
- an Ed25519 signature over a fixed message (deterministic — RFC 8032 needs
  no RNG at signing time, only key *generation* would, and Carapace never
  generates keys inside the sandbox — session keys are provisioned
  externally and only ever loaded for `sign()`)
- a PDA derived from `[b"policy", owner, agent_index]` against the real
  Carapace program ID, reimplemented from `sha2` + `curve25519-dalek`
  (the same algorithm `solana-program::pubkey::Pubkey::find_program_address`
  uses) since the heavier `solana-program`/`solana-sdk` crates are
  deliberately excluded from the wasm build.

```
$ cargo run -p wasm-signing-spike            $ wasmtime run target/wasm32-wasip2/release/spike.wasm
pubkey=8EefmsH8ootWP4G8xxoFUVDegW1f3kShr5QzAsWw69Mw   pubkey=8EefmsH8ootWP4G8xxoFUVDegW1f3kShr5QzAsWw69Mw
signature=fAwy6tjr...FCaGuVY                          signature=fAwy6tjr...FCaGuVY
policy_pda=GC1rn3x3gZpz24JpsKq4KR9N6Mh1nwyburscJiS5abKj    policy_pda=GC1rn3x3gZpz24JpsKq4KR9N6Mh1nwyburscJiS5abKj
policy_bump=253                                       policy_bump=253
```

## Spike 2 — outbound WASI HTTP from a component

**Question:** can a WASM tool component actually make outbound network calls
under the exact mechanism ZeroClaw's plugin host uses — WASI HTTP, gated by
the manifest's `http_client` permission?

**Location:** `spikes/wasm-http-spike/` (the component) +
`spikes/component-harness/` (a standalone `wasmtime`-crate host, ~80 lines,
that loads and invokes a component directly — no full ZeroClaw build
required; this harness is reused in M3 to test the real Carapace tool
components)

**Result: GO**, with one real toolchain wrinkle worth documenting: WASI 0.2's
WIT packages are versioned per dot-release (`wasi:http@0.2.2`,
`@0.2.12`, ...) and different tools in the chain pin different exact
versions — `cargo component`'s live registry resolved `wasi:http@0.2.12` at
build time, while `wasmtime-wasi-http 27.0.0`'s bundled host definitions are
`wasi:http@0.2.2`. WASI 0.2 guarantees ABI stability within the 0.2 line, so
these interoperate at the binary level, but naive `bindgen!` textual world
merging does not know that on its own. The fix: vendor one consistent copy of
the `wasi:{http,io,clocks,...}` WIT deps (taken directly from
`wasmtime-wasi-http`'s own bundled copy) and point *both* the component build
and the host harness at the exact same files, eliminating the version-skew
question entirely rather than trying to reconcile two registries.

The other real wrinkle: a "reactor"-style component (the shape a single-tool
`tool.wit` plugin actually is — no `main()`, just exported functions) still
pulls in a handful of baseline WASI CLI imports (`wasi:cli/environment`,
etc.) from its adapter regardless of whether the guest code uses them, and
`wasmtime-wasi-http::add_to_linker_async` cannot be combined with the general
`wasmtime_wasi::add_to_linker_async` (both try to register overlapping
`wasi:clocks` interfaces → `map entry defined twice`). The fix is
`wasmtime_wasi_http::add_only_http_to_linker_async`, which registers only the
HTTP-specific interfaces and composes cleanly with the general WASI linker.

End-to-end proof, a real outbound HTTPS request from inside the sandbox:

```
$ cargo build -p component-harness
$ ./target/debug/component-harness target/wasm32-wasip1/release/wasm_http_spike.wasm
spike=ok status=200
```

## Go/no-go decision

Both spikes passed. Per the plan, this means:
- `carapace_policy_status` and `carapace_list_receipts` ship as real WASM
  tool components (read-only, no secrets — always the safe case).
- `carapace_propose_intent` and `carapace_execute_transfer` **also** ship as
  real WASM tool components rather than falling back to the `kind = "mcp"`
  path, since signing was proven deterministic-and-portable and HTTP was
  proven reachable under the exact `http_client` permission mechanism.

## Spike 3 — ZeroClaw plugin host itself

Rather than building ZeroClaw's entire multi-app workspace (channels,
hardware, gateway, dashboard, ...) just to reach one crate, the actual
plugin-host crate was checked in isolation against its real feature flags:

```
$ cargo check -p zeroclaw-plugins --features plugins-wasmtime
   Checking wasmtime-wasi-http v45.0.3
   Checking zeroclaw-plugins v0.8.3 (.../crates/zeroclaw-plugins)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 4m 55s
```

**Result: clean compile, zero errors**, against ZeroClaw's actual current
plugin-host code (v0.8.3) and its real `wasmtime = "45.0.3"` /
`wasmtime-wasi-http = "45.0.3"` dependency pins — confirming the
`PluginManifest`/`PluginPermission`/`SignatureMode` types and the
`tool.wit`-based loading path this project targets are read correctly from
source, not guessed from docs.

One honest gap: this project's own spikes (1 and 2 above) were run against
`wasmtime 27.0.0` — whatever `wasmtime-cli`'s install script offered — not
ZeroClaw's pinned `45.0.3`. WASI 0.2's ABI-stability guarantee (the same
property that let spike 2 vendor `wasi:http@0.2.2` WIT files and interoperate
with a component built against a resolver-picked `@0.2.12`) makes this a low
risk, but it is not zero risk, and re-running `component-harness` against
wasmtime 45 is the natural next hardening step before treating the WASM
plugin bundle (M3) as fully proven end-to-end inside a *real* ZeroClaw
instance rather than a faithful standalone harness.

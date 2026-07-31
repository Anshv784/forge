# Setup

Status: this covers the Anchor program (`programs/carapace`) and the Day-0
spikes (`spikes/`), which are complete. The WASM plugin bundle, dashboard,
and Blinks endpoint are tracked in the main README's roadmap and will extend
this file as they land.

## 1. Toolchain (one-time)

```bash
# Rust + the wasm32-wasip2 target used by the WASM tool plugins
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-wasip2

# Solana CLI (Agave) — provides solana, solana-keygen, cargo-build-sbf, solana-test-validator
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Anchor CLI (this project pins the 1.x line, published under solana-foundation/anchor's
# stewardship — NOT the classic 0.3x @coral-xyz line; see docs/SPIKES.md for why)
cargo install anchor-cli --locked --force

# Surfpool — the local validator `anchor test`/`anchor localnet` now shell out to by default
curl -sSL https://raw.githubusercontent.com/solana-foundation/surfpool/main/install.sh | bash

# cargo-component + wasmtime — only needed once you're building/testing the WASM plugin bundle
cargo install cargo-component --locked
curl https://wasmtime.dev/install.sh -sSf | bash

# Node.js 20+ (for the Anchor TS test suite and, later, the dashboard)
```

Verify:

```bash
rustc --version && solana --version && anchor --version && surfpool --version && node --version
```

## 2. Wallet

Anchor's default provider wallet is `~/.config/solana/id.json`. If you don't
have one:

```bash
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json
```

This is the `owner` key in every example below — the human who controls
policy limits, approvals, and withdrawals. **Do not reuse a mainnet wallet
for devnet testing.**

## 3. Local development loop (no real funds needed)

```bash
cd programs/carapace
npm install
anchor test
```

`Anchor.toml`'s `[provider] cluster` is set to `localnet`, so `anchor test`
spins up a fresh Surfpool validator, deploys the program, runs
`tests/carapace.spec.ts` (12 tests covering the full cap/allow-list/approval
security model — see `docs/SECURITY.md`), and tears the validator down. No
devnet SOL required for this loop.

## 4. Devnet deployment (real, judge-visible deployment)

Requires devnet SOL for the owner wallet — program deployment for this
binary (~360KB) costs a few SOL in rent-exempt reserve.

```bash
solana airdrop 2 --url devnet   # retry later if rate-limited; public faucet is shared/IP-limited
solana balance --url devnet
```

If the public faucet is exhausted (common on shared/cloud IPs — this
happened during development of this project), fund the wallet another way:
transfer devnet SOL from another wallet you control, or use
`https://faucet.solana.com` from a browser.

Once funded:

```bash
cd programs/carapace
anchor deploy --provider.cluster devnet
```

This deploys to the program ID already declared in `Anchor.toml` and
`programs/carapace/src/lib.rs`'s `declare_id!` (generated for this project;
**generate and substitute your own program keypair** — `target/deploy/
carapace-keypair.json` — before deploying your own instance, since deploying
with someone else's committed keypair is not meaningful/possible without
also holding that private key, and it is intentionally not committed to this
repo):

```bash
solana-keygen new -o programs/carapace/target/deploy/carapace-keypair.json --force
solana-keygen pubkey programs/carapace/target/deploy/carapace-keypair.json
# paste the printed pubkey into Anchor.toml's [programs.*] section and
# declare_id!() in src/lib.rs, then `anchor build && anchor deploy --provider.cluster devnet`
```

## 5. Initializing a policy (once deployed)

There is no CLI script for this yet (tracked for the dashboard milestone);
in the meantime, call `initializePolicy` directly via the generated TS client
(`target/types/carapace.ts`) or Anchor's `ts-node` REPL, supplying:
- `delegate`: the agent's own ephemeral session keypair's public key —
  generate one with `solana-keygen new` and keep the secret key wherever the
  agent-facing plugin will read it from (this is the ZeroClaw
  per-plugin-config secret the WASM tool components read via the
  `config_read` permission — see the plugin bundle's own docs once that
  milestone lands).
- `spl_mint`: any existing SPL mint (devnet USDC, or a test mint you create
  with `spl-token create-token`).
- Caps and the approval threshold, in the mint's/lamports' base units.

Then `deposit_sol`/`deposit_spl` to fund the vault, and `add_allowlist_entry`
for every destination the agent should be allowed to pay.

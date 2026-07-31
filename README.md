# Carapace

**On-chain enforced spending guardrails and human-approval gate for autonomous [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw) agents.**

Built for Superteam Brasil's ["Build Solana-native plugins for ZeroClaw"](https://superteam.fun/earn/listing/zeroclaw) bounty.

## The problem

ZeroClaw already ships real security primitives for autonomous agents:
autonomy levels, an approval-gate system, a "Verifiable Intent" subsystem for
commerce-gated actions, and cryptographic tool receipts. All of it is
enforced and stored **locally, on the agent's own host.** A compromised host
or a jailbroken prompt can forge a receipt, rubber-stamp its own approval
gate, or ignore an in-process spend limit — because nothing *outside* that
machine is checking it. That's the real, unsolved blocker to letting an
autonomous agent hold and move real money.

## What Carapace does

Carapace makes Solana that external trust anchor:

1. **An Anchor program custodies the agent's funds in a program-owned vault**
   — not the agent's own wallet — so a compromised host can't just sign
   around the limits. Every transfer is checked, atomically, against a
   per-transaction cap, a daily cap, a destination allow-list, and (above a
   configurable threshold) a human-approved `Intent`, enforced by the Solana
   runtime itself.
2. **A native ZeroClaw WASM Component plugin bundle** — built against
   ZeroClaw's own experimental `tool.wit` plugin architecture, not a generic
   MCP wrapper — lets the agent check its policy, propose actions, and
   execute transfers.
3. **A dashboard + Solana Actions (Blink)** lets the human approve or deny a
   pending action from any wallet, on any device, in one tap — because a
   human-in-the-loop approval gate is only as good as how fast a human can
   actually respond to it.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full request
lifecycle and [`docs/SECURITY.md`](docs/SECURITY.md) for the threat model.

## Status

| Milestone | Status |
|---|---|
| Day-0 spikes (`wasm32-wasip2` signing/HTTP, ZeroClaw plugin-host contract) | ✅ done — [`docs/SPIKES.md`](docs/SPIKES.md) |
| Anchor program (policy, vaults, allow-list, Intent lifecycle, execute) | ✅ done, 12/12 tests passing — [`programs/carapace`](programs/carapace) |
| Devnet deployment | ⏳ blocked on faucet funding in the dev environment — see [`docs/SETUP.md`](docs/SETUP.md#4-devnet-deployment-real-judge-visible-deployment) |
| `solana-core` shared Rust crate | 🔜 next |
| WASM tool-plugin bundle | 🔜 next |
| Carapace Console (Next.js dashboard) | 🔜 planned |
| Solana Actions/Blinks approval endpoint | 🔜 planned |
| Stretch: Jupiter swap, Pyth USD caps, Squads multisig owner, Helius webhooks | 🔜 stretch |

## Repo layout

```
programs/carapace/     Anchor program: Policy/Intent/AllowlistEntry accounts,
                        vault-custodied transfers, tests (surfpool + ts-mocha)
plugins/                solana-core shared crate + WASM tool components (WIP)
apps/console/           Next.js dashboard + Blinks endpoint (WIP)
spikes/                 Day-0 feasibility spikes (signing, WASI HTTP, harness)
docs/                   Architecture, security model, setup guide, spike notes
```

## Quickstart

```bash
cd programs/carapace
npm install
anchor test        # spins up a local validator (surfpool), no funds needed
```

Full setup (toolchain install, wallet, devnet deploy) in
[`docs/SETUP.md`](docs/SETUP.md).

## License

Dual-licensed under MIT or Apache-2.0, matching ZeroClaw's own licensing.

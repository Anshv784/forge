# Demo: Carapace × ZeroClaw, live

The real, running use case for the bounty showcase: a Discord-resident
ZeroClaw agent that proposes and executes Solana payments through Carapace's
on-chain enforced guardrails, backed by a real Carapace program on Solana
devnet, with the human owner approving above-threshold transfers on-chain
from their own wallet.

This directory holds only the demo-specific ZeroClaw config and setup
scripts. The plugin code lives in [`../plugins/`](../plugins/), the on-chain
program in [`../programs/carapace/`](../programs/carapace/).

## Two ways to run this

**Already have a policy set up?**

```bash
./run.sh
```

Starts the real ZeroClaw daemon, connected to Discord, with all five
Carapace plugins loaded. Reads secrets from `.secrets/demo-credentials.env`
at the repo root (gitignored, never committed).

**Starting from scratch?**

```bash
./quickstart.sh
```

Interactive, idempotent setup: creates a Solana wallet if you don't have
one, creates your own on-chain policy (reusing the Carapace program already
deployed on devnet — no redeploy needed), generates a personal ZeroClaw
config, and writes a personal `run.sh` for you outside this repo, in
`~/.carapace-zeroclaw/`.

## What's in this directory

```
.zeroclaw-config/   The live daemon's config.toml, cron SOP, and skill
                     (plugins/, data/, state/ subdirectories are gitignored
                     runtime state — installed plugin copies + ephemeral
                     session/memory data, not source)
run.sh               Start the daemon with secrets injected as env vars
quickstart.sh         One-command setup for a brand-new operator
```

## Proof, not just claims

[`../docs/SHOWCASE.md`](../docs/SHOWCASE.md) has the full write-up: the
custody-tier justification, the threat model, a real prompt-injection test
transcript, and every on-chain transaction signature from three live tests
against this exact setup — linked on Solscan, independently verifiable.

# Carapace × ZeroClaw demo

The real, running use case for the bounty showcase: a Discord-resident
ZeroClaw agent that proposes and executes Solana payments through Carapace's
on-chain enforced guardrails, running against a real Carapace program on
Solana devnet, with the human owner approving above-threshold transfers
on-chain from their own wallet.

This directory holds the demo-specific config and setup notes — the actual
plugin code lives in `../plugins/`, the on-chain program in
`../programs/carapace/`.

See [`../docs/SHOWCASE.md`](../docs/SHOWCASE.md) for the full write-up: what
was demonstrated, the custody tier and threat model, the prompt-injection
test transcript, and every on-chain transaction signature as proof.

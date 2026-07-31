---
name: carapace-list-receipts
description: Fetch the verifiable on-chain audit trail (executed transfers, Intent approvals/denials) for a Carapace policy.
license: MIT OR Apache-2.0
author: Carapace
version: 0.1.0
category: finance
tags: [solana, payments, guardrails, carapace, audit]
---

# Carapace: list receipts

Call `carapace_list_receipts` when:

- The human asks "what has this agent actually spent?" or "show me a receipt."
- You proposed an Intent and want to confirm whether it's been approved yet
  before calling `carapace_execute_transfer` (look for an `IntentApproved`
  entry with a matching `nonce`).
- You want to show a skeptical human that an action really happened and was
  within policy — every entry here comes from the Solana transaction itself,
  not from anything this ZeroClaw instance's own logs claim.

Each receipt has a `type` (`TransferExecuted`, `IntentProposed`,
`IntentApproved`, or `IntentDenied`), a `signature` you can hand to the human
as a Solscan link (`https://solscan.io/tx/<signature>?cluster=devnet`), and a
`block_time`. Results are newest-first and limited (default 5, max 25) —
raise `limit` if the human wants more history, but prefer showing the
Solscan link over paging through everything yourself.

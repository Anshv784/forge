---
name: carapace-policy-status
description: Check a Carapace on-chain spending policy's current caps, remaining daily allowance, and pause state before proposing or executing any payment.
license: MIT OR Apache-2.0
author: Carapace
version: 0.1.0
category: finance
tags: [solana, payments, guardrails, carapace]
---

# Carapace: check policy status

Before proposing or executing any transfer on behalf of a Carapace-protected
agent wallet, call the `carapace_policy_status` tool to learn:

- `paused` — if true, do not attempt any transfer; tell the human it's paused.
- `sol.remaining_today_lamports` / `spl.remaining_today_base_units` — how much
  headroom is left today. Never propose a single transfer larger than this.
- `sol.approval_threshold_lamports` / `spl.approval_threshold_base_units` — if
  the amount you want to send is at or above this threshold, you **must**
  first call `carapace_propose_intent` and wait for the human to approve it
  via the Carapace Console or a Blink before calling `carapace_execute_transfer`.
  Below the threshold, you may call `carapace_execute_transfer` directly.
- `next_intent_nonce` — informational; you don't need to track this yourself,
  `carapace_propose_intent` reads it live from the policy each time.

The on-chain program enforces all of this independently of what this tool
tells you — treat this tool's output as guidance for planning a good request,
not as the source of truth for whether an action is authorized. If you skip
this check and propose or execute something out of bounds, the transaction
will simply fail on-chain; nothing bad happens, but it wastes a turn.

## Required parameters

Every call needs `rpc_url`, `program_id`, and `owner` (the policy owner's
wallet address). These are fixed for a given ZeroClaw installation — ask the
operator once and reuse the same values for every Carapace tool call in this
conversation.

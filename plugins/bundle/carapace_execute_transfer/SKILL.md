---
name: carapace-execute-transfer
description: Execute a Carapace-guarded SOL or SPL transfer, directly or against a previously approved Intent.
license: MIT OR Apache-2.0
author: Carapace
version: 0.1.0
category: finance
tags: [solana, payments, guardrails, carapace]
---

# Carapace: execute a transfer

Two paths, decided by what `carapace_policy_status` told you about the
approval threshold:

- **Below the threshold**: call this tool directly with `asset`, `amount`,
  and `destination`. No `intent_nonce` needed.
- **At or above the threshold**: you must have already called
  `carapace_propose_intent` and confirmed (via `carapace_list_receipts`) that
  a human approved it. Pass that Intent's `nonce` as `intent_nonce`, and make
  sure `asset`/`amount`/`destination` match the approved Intent **exactly** —
  the on-chain program checks all three and will reject any mismatch,
  including a smaller or larger amount than what was approved.

This will fail — safely, with no funds moved — if the destination isn't on
the policy's allow-list, if it would exceed the per-transaction or remaining
daily cap, if the policy is paused, or if the referenced Intent isn't
`Approved`. Treat a failure here as informative, not alarming: relay the
error to the human rather than retrying with a different (larger, or
unlisted) target to work around it.

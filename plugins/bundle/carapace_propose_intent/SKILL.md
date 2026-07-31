---
name: carapace-propose-intent
description: Propose an on-chain Intent for a Carapace payment that requires human approval before it can be sent.
license: MIT OR Apache-2.0
author: Carapace
version: 0.1.0
category: finance
tags: [solana, payments, guardrails, carapace]
---

# Carapace: propose an Intent

Use `carapace_propose_intent` only when `carapace_policy_status` told you the
amount you want to send is at or above the policy's approval threshold for
that asset. Below the threshold, skip straight to `carapace_execute_transfer`
— proposing an Intent for a small amount just adds an unnecessary approval
step.

Write `action_description` as if you're explaining the payment to the human
approving it — it's what they'll see on the Carapace Console or the approval
Blink. Be specific: "pay contractor invoice #7, 0.2 SOL" is useful; "transfer
funds" is not.

After this call succeeds, **stop and tell the human** what you proposed and
why, and that it needs their approval. Do not call `carapace_execute_transfer`
in the same turn — the Intent is `Pending` until a human signs an
`approve_intent` transaction, which this tool cannot do on their behalf. Check
back later with `carapace_list_receipts` (look for an `IntentApproved` entry
with the same nonce) before attempting to execute.

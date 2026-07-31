# Security model

## Threat model

**What Carapace defends against:** a compromised ZeroClaw host, a jailbroken
or manipulated LLM prompt, or a buggy agent loop that tries to move more
value, more often, or to a different destination than a human ever approved
— *without* requiring the counterparty (a human, an auditor, a Solana
program) to trust that host's local state at all.

**What Carapace does not defend against:** a compromised `owner` keypair (the
human's own wallet) — the owner can always pause, rotate the delegate, or
withdraw everything, by design, so a stolen owner key is equivalent to a
stolen wallet elsewhere; a malicious or buggy *destination* program the owner
themselves allow-listed; or protocol-level Solana outages/censorship.

## Why the vault design is load-bearing

An agent's operating funds are held in `SolVault` (a System-Program-owned
PDA) and per-mint associated token accounts owned by `TokenVaultAuthority`
(an authority-only PDA) — **never** in a wallet the `delegate` key
independently controls. The `delegate` signer can only ever ask this program
to move the vault via `execute_transfer_sol`/`execute_transfer_spl`; only the
program's own `invoke_signed` (using the vault's own seeds) can actually move
lamports or tokens out. This is deliberate: if the vault were just "the
agent's own wallet, with a client-side/off-chain check," a compromised host
would simply skip Carapace and sign a direct `SystemProgram::transfer`
instead. The cap/allow-list/approval logic below only means anything because
of this custodial structure.

## On-chain constraints enforced by `execute_transfer_{sol,spl}`

Checked in `programs/carapace/programs/carapace/src/instructions/execute.rs`,
in order, on every execution:

1. `!policy.paused` — the owner's kill switch.
2. `!policy.reentrancy_lock` — defense-in-depth (see below).
3. `policy.expires_at == 0 || now < policy.expires_at`.
4. `amount <= max_per_tx_{lamports,spl}`.
5. Daily cap: `spent_today + amount <= max_daily_{lamports,spl}` via
   `checked_add`, using a **fixed-reset bucket** — see the sliding-window
   caveat below.
6. Destination allow-listed: enforced structurally, not by an `if` — the
   `allowlist_entry` account's `seeds` constraint binds it to
   `[ALLOWLIST, policy, destination]`, so the instruction fails during
   Anchor's own account validation (before the handler runs at all) unless
   the exact destination has a corresponding `AllowlistEntry` PDA.
7. Above `approval_threshold_{lamports,spl}`: a supplied `Intent` account
   must have `status == Approved`, `now <= intent.expires_at`, and
   `intent.{asset,amount,destination}` **exactly equal** to the transfer
   being executed. Matching is exact-field, not "some approved intent
   exists" — this is what stops a bait-and-switch where a small amount gets
   approved and a larger or different one gets executed. The Intent is
   consumed (`status = Executed`) in the same instruction, making replay
   impossible.

All arithmetic uses `checked_add`/`checked_sub` with typed errors
(`PerTxCapExceeded`, `DailyCapExceeded`, `MathOverflow`, ...) — see
`errors.rs`.

## Known, deliberate limitations

- **Fixed-reset daily bucket, not a true sliding window.** `spent_today`
  resets to 0 on the first transaction at/after `window_start_ts + 86400s`.
  This means spending the full daily cap right before a reset and again
  right after is possible (~2x the daily cap within a short span around the
  boundary). A true sliding window needs a timestamped ledger and a
  trailing-sum query, which isn't worth the account/compute budget for this
  project. Documented here rather than oversold as "rolling."
- **`Intent.action_hash` is a hash, not the full description.** The
  human-readable text (what an approver actually reads before approving)
  lives off-chain / in the dashboard and Blink UI; only its hash is on
  chain. This keeps `Intent` accounts small and cheap, at the cost of the
  on-chain record alone not being self-describing — the hash is only
  meaningful together with whatever description produced it.
- **No receipt accounts.** Every state change (`TransferExecuted`,
  `IntentApproved`, ...) is an `emit!` event in the transaction's logs, not a
  standalone account. This avoids a rent-refund bookkeeping problem for a
  high-frequency write path, but means "the audit trail" is the union of
  program logs across many transactions, reconstructed via
  `getSignaturesForAddress` + log parsing (or a Helius webhook), not a single
  queryable account.
- **Classic SPL Token only, one configured mint per policy.** Token-2022 is
  explicitly out of scope for now: a mint with the `TransferHook` extension
  enabled can force an arbitrary CPI on every transfer of that mint, which
  would be a direct hole through the allow-list model if such a mint were
  ever allow-listed. Multi-mint support and Token-2022 (with an explicit
  transfer-hook check before allow-listing a mint) are natural follow-ups.

## CPI safety (for the Jupiter-swap stretch goal)

Not yet implemented, but designed for: a swap instruction must (a) validate
the *resolved* CPI target account's own key against a hardcoded/allow-listed
program id — never a client-supplied flag — and (b) read the vault's/
destination token account's balance immediately before and after the CPI and
assert the actual delta stayed within the requested bounds, because Jupiter's
internal routing is opaque past the top-level CPI and allow-listing the
program id alone does not bound what happens inside it.

## Plugin supply-chain security (ZeroClaw side)

The WASM tool plugins (`plugins/`) ship as Ed25519-signed `manifest.toml`
files, matching ZeroClaw's own `SignatureMode`/`trusted_publisher_keys`
mechanism (`crates/zeroclaw-plugins/src/signature.rs`,
`crates/zeroclaw-plugins/src/host.rs`). The example install config recommends
`signature_mode = "strict"` — plugins from an untrusted publisher key will
not load at all, not just warn.

## Reproducing the test coverage

`programs/carapace/tests/carapace.spec.ts` exercises: per-tx cap rejection,
daily cap rejection at the boundary, allow-list rejection (both "never
listed" and "removed after being listed"), the full propose → approve →
execute → replay-rejected Intent lifecycle, a mismatched-amount
bait-and-switch rejection, unauthorized-delegate rejection, the pause kill
switch, and owner withdrawal independent of delegate caps. Run with
`anchor test` (see `docs/SETUP.md`).

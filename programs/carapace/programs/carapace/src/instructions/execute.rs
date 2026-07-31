use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::{seeds, SECONDS_PER_DAY};
use crate::errors::CarapaceError;
use crate::events::*;
use crate::state::{AllowlistEntry, AssetKind, Intent, IntentStatus, Policy};

/// Checks every on-chain constraint for a proposed spend and returns the
/// `spent_today` value the caller should persist if it commits to the spend.
/// Pure function over already-loaded account data — no CPI, no mutation —
/// so both the SOL and SPL execute handlers share exactly one copy of the
/// cap/allowlist/approval logic instead of two copies that could drift.
///
/// Allow-listing itself is NOT re-checked here: by the time this runs,
/// Anchor has already refused the instruction unless a valid
/// `AllowlistEntry` PDA for the exact destination was supplied (see the
/// `seeds` constraint on `allowlist_entry` in both `Accounts` structs below).
fn validate_spend(
    policy: &Policy,
    now: i64,
    asset: AssetKind,
    amount: u64,
    approved_intent: Option<&Intent>,
    destination: Pubkey,
) -> Result<u64> {
    require!(!policy.paused, CarapaceError::PolicyPaused);
    require!(!policy.reentrancy_lock, CarapaceError::ReentrancyLocked);
    if policy.expires_at != 0 {
        require!(now < policy.expires_at, CarapaceError::PolicyExpired);
    }

    let (max_per_tx, max_daily, spent_today, approval_threshold) = match asset {
        AssetKind::Sol => (
            policy.max_per_tx_lamports,
            policy.max_daily_lamports,
            policy.spent_today_lamports,
            policy.approval_threshold_lamports,
        ),
        AssetKind::Spl => (
            policy.max_per_tx_spl,
            policy.max_daily_spl,
            policy.spent_today_spl,
            policy.approval_threshold_spl,
        ),
    };

    require!(amount <= max_per_tx, CarapaceError::PerTxCapExceeded);

    // Fixed-reset bucket, not a true sliding window: see docs/SECURITY.md.
    let window_expired = now >= policy.window_start_ts.saturating_add(SECONDS_PER_DAY);
    let effective_spent = if window_expired { 0 } else { spent_today };
    let new_spent = effective_spent
        .checked_add(amount)
        .ok_or(CarapaceError::MathOverflow)?;
    require!(new_spent <= max_daily, CarapaceError::DailyCapExceeded);

    if amount >= approval_threshold {
        let intent = approved_intent.ok_or(CarapaceError::ApprovalRequired)?;
        require!(intent.status == IntentStatus::Approved, CarapaceError::IntentNotApproved);
        require!(now <= intent.expires_at, CarapaceError::IntentExpired);
        require!(intent.asset == asset, CarapaceError::IntentMismatch);
        require!(intent.amount == amount, CarapaceError::IntentMismatch);
        require!(intent.destination == destination, CarapaceError::IntentMismatch);
    }

    Ok(new_spent)
}

#[derive(Accounts)]
pub struct ExecuteTransferSol<'info> {
    pub delegate: Signer<'info>,

    #[account(mut, has_one = delegate @ CarapaceError::UnauthorizedDelegate)]
    pub policy: Account<'info, Policy>,

    #[account(
        mut,
        seeds = [seeds::SOL_VAULT, policy.key().as_ref()],
        bump = policy.sol_vault_bump,
    )]
    pub sol_vault: SystemAccount<'info>,

    /// CHECK: transfer recipient; bound to the allow-list via
    /// `allowlist_entry`'s seeds below, not by any check on this account.
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,

    #[account(
        seeds = [seeds::ALLOWLIST, policy.key().as_ref(), destination.key().as_ref()],
        bump = allowlist_entry.bump,
    )]
    pub allowlist_entry: Account<'info, AllowlistEntry>,

    /// Required (and validated against `policy`, `amount`, and
    /// `destination`) whenever `amount >= policy.approval_threshold_lamports`.
    /// To omit it, the client must pass this program's own address as a
    /// `None` sentinel per Anchor's `Option<Account>` convention.
    #[account(mut)]
    pub intent: Option<Account<'info, Intent>>,

    pub system_program: Program<'info, System>,
}

pub fn execute_transfer_sol(ctx: Context<ExecuteTransferSol>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let destination_key = ctx.accounts.destination.key();

    if let Some(intent) = ctx.accounts.intent.as_ref() {
        // An Intent's `policy` field can only ever have been set once, by
        // `propose_intent`'s `init` — so this equality is sufficient proof
        // the Intent genuinely belongs to this policy (see instructions/execute.rs
        // module docs in docs/SECURITY.md for why re-deriving the PDA by hand
        // isn't necessary on top of this).
        require!(intent.policy == ctx.accounts.policy.key(), CarapaceError::IntentMismatch);
    }

    let new_spent = validate_spend(
        &ctx.accounts.policy,
        now,
        AssetKind::Sol,
        amount,
        ctx.accounts.intent.as_deref(),
        destination_key,
    )?;

    // Effects before interactions.
    let window_expired = now >= ctx.accounts.policy.window_start_ts.saturating_add(SECONDS_PER_DAY);
    {
        let policy = &mut ctx.accounts.policy;
        policy.reentrancy_lock = true;
        if window_expired {
            policy.window_start_ts = now;
        }
        policy.spent_today_lamports = new_spent;
        policy.total_executed_count = policy
            .total_executed_count
            .checked_add(1)
            .ok_or(CarapaceError::MathOverflow)?;
    }
    if let Some(intent) = ctx.accounts.intent.as_mut() {
        intent.status = IntentStatus::Executed;
        intent.decided_at = now;
    }

    // Interaction.
    let policy_key = ctx.accounts.policy.key();
    let bump = ctx.accounts.policy.sol_vault_bump;
    let signer_seeds: &[&[&[u8]]] = &[&[seeds::SOL_VAULT, policy_key.as_ref(), &[bump]]];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.key(),
        system_program::Transfer {
            from: ctx.accounts.sol_vault.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
        },
        signer_seeds,
    );
    system_program::transfer(cpi_ctx, amount)?;

    ctx.accounts.policy.reentrancy_lock = false;

    emit!(TransferExecuted {
        policy: policy_key,
        asset: AssetKind::Sol,
        amount,
        destination: destination_key,
        intent: ctx.accounts.intent.as_ref().map(|i| i.key()),
        spent_today: ctx.accounts.policy.spent_today_lamports,
        total_executed_count: ctx.accounts.policy.total_executed_count,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ExecuteTransferSpl<'info> {
    pub delegate: Signer<'info>,

    #[account(
        mut,
        has_one = delegate @ CarapaceError::UnauthorizedDelegate,
        has_one = spl_mint @ CarapaceError::MintMismatch,
    )]
    pub policy: Account<'info, Policy>,

    pub spl_mint: Box<Account<'info, Mint>>,

    /// CHECK: pure PDA authority for the token vault.
    #[account(
        seeds = [seeds::TOKEN_VAULT_AUTHORITY, policy.key().as_ref()],
        bump = policy.token_vault_authority_bump,
    )]
    pub token_vault_authority: SystemAccount<'info>,

    #[account(
        mut,
        associated_token::mint = spl_mint,
        associated_token::authority = token_vault_authority,
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, token::mint = spl_mint)]
    pub destination_token_account: Box<Account<'info, TokenAccount>>,

    /// The allow-list tracks *wallets* (the token account's owner), not
    /// specific token accounts, since token accounts can be closed/recreated
    /// but the human/entity behind them is what the policy actually cares
    /// about restricting.
    #[account(
        seeds = [seeds::ALLOWLIST, policy.key().as_ref(), destination_token_account.owner.as_ref()],
        bump = allowlist_entry.bump,
    )]
    pub allowlist_entry: Account<'info, AllowlistEntry>,

    #[account(mut)]
    pub intent: Option<Account<'info, Intent>>,

    pub token_program: Program<'info, Token>,
}

pub fn execute_transfer_spl(ctx: Context<ExecuteTransferSpl>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let destination_owner = ctx.accounts.destination_token_account.owner;

    if let Some(intent) = ctx.accounts.intent.as_ref() {
        require!(intent.policy == ctx.accounts.policy.key(), CarapaceError::IntentMismatch);
    }

    let new_spent = validate_spend(
        &ctx.accounts.policy,
        now,
        AssetKind::Spl,
        amount,
        ctx.accounts.intent.as_deref(),
        destination_owner,
    )?;

    let window_expired = now >= ctx.accounts.policy.window_start_ts.saturating_add(SECONDS_PER_DAY);
    {
        let policy = &mut ctx.accounts.policy;
        policy.reentrancy_lock = true;
        if window_expired {
            policy.window_start_ts = now;
        }
        policy.spent_today_spl = new_spent;
        policy.total_executed_count = policy
            .total_executed_count
            .checked_add(1)
            .ok_or(CarapaceError::MathOverflow)?;
    }
    if let Some(intent) = ctx.accounts.intent.as_mut() {
        intent.status = IntentStatus::Executed;
        intent.decided_at = now;
    }

    let policy_key = ctx.accounts.policy.key();
    let bump = ctx.accounts.policy.token_vault_authority_bump;
    let signer_seeds: &[&[&[u8]]] = &[&[seeds::TOKEN_VAULT_AUTHORITY, policy_key.as_ref(), &[bump]]];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        TransferChecked {
            from: ctx.accounts.token_vault.to_account_info(),
            mint: ctx.accounts.spl_mint.to_account_info(),
            to: ctx.accounts.destination_token_account.to_account_info(),
            authority: ctx.accounts.token_vault_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer_checked(cpi_ctx, amount, ctx.accounts.spl_mint.decimals)?;

    ctx.accounts.policy.reentrancy_lock = false;

    emit!(TransferExecuted {
        policy: policy_key,
        asset: AssetKind::Spl,
        amount,
        destination: destination_owner,
        intent: ctx.accounts.intent.as_ref().map(|i| i.key()),
        spent_today: ctx.accounts.policy.spent_today_spl,
        total_executed_count: ctx.accounts.policy.total_executed_count,
    });

    Ok(())
}

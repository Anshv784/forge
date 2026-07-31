use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::seeds;
use crate::errors::CarapaceError;
use crate::events::*;
use crate::state::{AllowlistEntry, AssetKind, Policy};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitPolicyParams {
    pub agent_index: u16,
    pub delegate: Pubkey,
    pub max_per_tx_lamports: u64,
    pub max_daily_lamports: u64,
    pub approval_threshold_lamports: u64,
    pub max_per_tx_spl: u64,
    pub max_daily_spl: u64,
    pub approval_threshold_spl: u64,
    /// Unix timestamp after which the policy can no longer propose or
    /// execute anything (owner can still withdraw). 0 = never expires.
    pub expires_at: i64,
}

#[derive(Accounts)]
#[instruction(params: InitPolicyParams)]
pub struct InitializePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Policy::INIT_SPACE,
        seeds = [seeds::POLICY, owner.key().as_ref(), &params.agent_index.to_le_bytes()],
        bump,
    )]
    pub policy: Account<'info, Policy>,

    /// CHECK: pure PDA, never allocated. Only ever touched by
    /// `system_program::transfer` CPIs signed via its own seeds; a
    /// never-assigned address is implicitly System-Program-owned, so no
    /// `init` is needed here.
    #[account(
        seeds = [seeds::SOL_VAULT, policy.key().as_ref()],
        bump,
    )]
    pub sol_vault: SystemAccount<'info>,

    /// CHECK: pure PDA authority for the SPL vault ATA below; never holds
    /// data or lamports of its own, exists only to be a CPI signer.
    #[account(
        seeds = [seeds::TOKEN_VAULT_AUTHORITY, policy.key().as_ref()],
        bump,
    )]
    pub token_vault_authority: SystemAccount<'info>,

    pub spl_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = owner,
        associated_token::mint = spl_mint,
        associated_token::authority = token_vault_authority,
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_policy(ctx: Context<InitializePolicy>, params: InitPolicyParams) -> Result<()> {
    require!(
        params.max_per_tx_lamports <= params.max_daily_lamports,
        CarapaceError::PerTxCapExceeded
    );
    require!(
        params.max_per_tx_spl <= params.max_daily_spl,
        CarapaceError::PerTxCapExceeded
    );

    let now = Clock::get()?.unix_timestamp;
    let policy = &mut ctx.accounts.policy;

    policy.owner = ctx.accounts.owner.key();
    policy.delegate = params.delegate;
    policy.spl_mint = ctx.accounts.spl_mint.key();
    policy.agent_index = params.agent_index;
    policy.sol_vault_bump = ctx.bumps.sol_vault;
    policy.token_vault_authority_bump = ctx.bumps.token_vault_authority;
    policy.bump = ctx.bumps.policy;

    policy.max_per_tx_lamports = params.max_per_tx_lamports;
    policy.max_daily_lamports = params.max_daily_lamports;
    policy.spent_today_lamports = 0;

    policy.max_per_tx_spl = params.max_per_tx_spl;
    policy.max_daily_spl = params.max_daily_spl;
    policy.spent_today_spl = 0;

    policy.window_start_ts = now;
    policy.approval_threshold_lamports = params.approval_threshold_lamports;
    policy.approval_threshold_spl = params.approval_threshold_spl;

    policy.next_intent_nonce = 0;
    policy.total_executed_count = 0;
    policy.expires_at = params.expires_at;
    policy.paused = false;
    policy.reentrancy_lock = false;
    policy.created_at = now;

    emit!(PolicyInitialized {
        policy: policy.key(),
        owner: policy.owner,
        delegate: policy.delegate,
        spl_mint: policy.spl_mint,
        agent_index: policy.agent_index,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RotateDelegate<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ CarapaceError::UnauthorizedOwner)]
    pub policy: Account<'info, Policy>,
}

pub fn rotate_delegate(ctx: Context<RotateDelegate>, new_delegate: Pubkey) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    require_keys_neq!(policy.delegate, new_delegate, CarapaceError::DelegateUnchanged);
    let old_delegate = policy.delegate;
    policy.delegate = new_delegate;
    emit!(DelegateRotated {
        policy: policy.key(),
        old_delegate,
        new_delegate,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ CarapaceError::UnauthorizedOwner)]
    pub policy: Account<'info, Policy>,
}

pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    ctx.accounts.policy.paused = paused;
    emit!(PausedSet {
        policy: ctx.accounts.policy.key(),
        paused,
    });
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateLimitsParams {
    pub max_per_tx_lamports: u64,
    pub max_daily_lamports: u64,
    pub approval_threshold_lamports: u64,
    pub max_per_tx_spl: u64,
    pub max_daily_spl: u64,
    pub approval_threshold_spl: u64,
}

#[derive(Accounts)]
pub struct UpdateLimits<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ CarapaceError::UnauthorizedOwner)]
    pub policy: Account<'info, Policy>,
}

pub fn update_limits(ctx: Context<UpdateLimits>, params: UpdateLimitsParams) -> Result<()> {
    require!(
        params.max_per_tx_lamports <= params.max_daily_lamports,
        CarapaceError::PerTxCapExceeded
    );
    require!(
        params.max_per_tx_spl <= params.max_daily_spl,
        CarapaceError::PerTxCapExceeded
    );

    let policy = &mut ctx.accounts.policy;
    policy.max_per_tx_lamports = params.max_per_tx_lamports;
    policy.max_daily_lamports = params.max_daily_lamports;
    policy.approval_threshold_lamports = params.approval_threshold_lamports;
    policy.max_per_tx_spl = params.max_per_tx_spl;
    policy.max_daily_spl = params.max_daily_spl;
    policy.approval_threshold_spl = params.approval_threshold_spl;

    emit!(LimitsUpdated {
        policy: policy.key(),
        max_per_tx_lamports: params.max_per_tx_lamports,
        max_daily_lamports: params.max_daily_lamports,
        max_per_tx_spl: params.max_per_tx_spl,
        max_daily_spl: params.max_daily_spl,
        approval_threshold_lamports: params.approval_threshold_lamports,
        approval_threshold_spl: params.approval_threshold_spl,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(destination: Pubkey)]
pub struct AddAllowlistEntry<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(has_one = owner @ CarapaceError::UnauthorizedOwner)]
    pub policy: Account<'info, Policy>,
    #[account(
        init,
        payer = owner,
        space = 8 + AllowlistEntry::INIT_SPACE,
        seeds = [seeds::ALLOWLIST, policy.key().as_ref(), destination.as_ref()],
        bump,
    )]
    pub allowlist_entry: Account<'info, AllowlistEntry>,
    pub system_program: Program<'info, System>,
}

pub fn add_allowlist_entry(ctx: Context<AddAllowlistEntry>, destination: Pubkey) -> Result<()> {
    let entry = &mut ctx.accounts.allowlist_entry;
    entry.policy = ctx.accounts.policy.key();
    entry.destination = destination;
    entry.bump = ctx.bumps.allowlist_entry;
    emit!(AllowlistEntryAdded {
        policy: entry.policy,
        destination,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveAllowlistEntry<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(has_one = owner @ CarapaceError::UnauthorizedOwner)]
    pub policy: Account<'info, Policy>,
    #[account(
        mut,
        close = owner,
        seeds = [seeds::ALLOWLIST, policy.key().as_ref(), allowlist_entry.destination.as_ref()],
        bump = allowlist_entry.bump,
    )]
    pub allowlist_entry: Account<'info, AllowlistEntry>,
}

pub fn remove_allowlist_entry(ctx: Context<RemoveAllowlistEntry>) -> Result<()> {
    emit!(AllowlistEntryRemoved {
        policy: ctx.accounts.policy.key(),
        destination: ctx.accounts.allowlist_entry.destination,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub policy: Account<'info, Policy>,
    #[account(
        mut,
        seeds = [seeds::SOL_VAULT, policy.key().as_ref()],
        bump = policy.sol_vault_bump,
    )]
    pub sol_vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    require_gt!(amount, 0, CarapaceError::ZeroAmount);
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.key(),
        system_program::Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.sol_vault.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, amount)?;
    emit!(Deposited {
        policy: ctx.accounts.policy.key(),
        asset: AssetKind::Sol,
        amount,
        depositor: ctx.accounts.depositor.key(),
    });
    Ok(())
}

#[derive(Accounts)]
pub struct DepositSpl<'info> {
    pub depositor: Signer<'info>,
    #[account(has_one = spl_mint @ CarapaceError::MintMismatch)]
    pub policy: Account<'info, Policy>,
    pub spl_mint: Box<Account<'info, Mint>>,
    #[account(mut, token::mint = spl_mint, token::authority = depositor)]
    pub depositor_token_account: Box<Account<'info, TokenAccount>>,
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
    pub token_program: Program<'info, Token>,
}

pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
    require_gt!(amount, 0, CarapaceError::ZeroAmount);
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.key(),
        TransferChecked {
            from: ctx.accounts.depositor_token_account.to_account_info(),
            mint: ctx.accounts.spl_mint.to_account_info(),
            to: ctx.accounts.token_vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    );
    token::transfer_checked(cpi_ctx, amount, ctx.accounts.spl_mint.decimals)?;
    emit!(Deposited {
        policy: ctx.accounts.policy.key(),
        asset: AssetKind::Spl,
        amount,
        depositor: ctx.accounts.depositor.key(),
    });
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    pub owner: Signer<'info>,
    #[account(has_one = owner @ CarapaceError::UnauthorizedOwner)]
    pub policy: Account<'info, Policy>,
    #[account(
        mut,
        seeds = [seeds::SOL_VAULT, policy.key().as_ref()],
        bump = policy.sol_vault_bump,
    )]
    pub sol_vault: SystemAccount<'info>,
    /// CHECK: arbitrary destination; the owner authorizes this explicitly by
    /// signing the withdrawal, so no further constraint is needed.
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
    require_gt!(amount, 0, CarapaceError::ZeroAmount);
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
    emit!(Withdrawn {
        policy: policy_key,
        asset: AssetKind::Sol,
        amount,
        destination: ctx.accounts.destination.key(),
    });
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawSpl<'info> {
    pub owner: Signer<'info>,
    #[account(has_one = owner @ CarapaceError::UnauthorizedOwner, has_one = spl_mint @ CarapaceError::MintMismatch)]
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
    pub token_program: Program<'info, Token>,
}

pub fn withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
    require_gt!(amount, 0, CarapaceError::ZeroAmount);
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
    emit!(Withdrawn {
        policy: policy_key,
        asset: AssetKind::Spl,
        amount,
        destination: ctx.accounts.destination_token_account.key(),
    });
    Ok(())
}

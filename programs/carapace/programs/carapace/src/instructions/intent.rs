use anchor_lang::prelude::*;

use crate::constants::{seeds, MAX_INTENT_TTL_SECONDS};
use crate::errors::CarapaceError;
use crate::events::*;
use crate::state::{AssetKind, Intent, IntentStatus, Policy};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProposeIntentParams {
    pub asset: AssetKind,
    pub amount: u64,
    /// Wallet the funds would go to (for SPL, the token account's *owner*,
    /// not the token account address itself).
    pub destination: Pubkey,
    /// Hash of an off-chain, human-readable description of the action (e.g.
    /// sha256 of "pay invoice #42 to Acme for 12 USDC"). Kept as a hash
    /// on-chain to keep this account small; the full text travels via the
    /// dashboard/Blink UI and is bound to the execution by this hash.
    pub action_hash: [u8; 32],
    pub ttl_seconds: i64,
}

#[derive(Accounts)]
pub struct ProposeIntent<'info> {
    #[account(mut)]
    pub delegate: Signer<'info>,
    #[account(mut, has_one = delegate @ CarapaceError::UnauthorizedDelegate)]
    pub policy: Account<'info, Policy>,
    #[account(
        init,
        payer = delegate,
        space = 8 + Intent::INIT_SPACE,
        seeds = [seeds::INTENT, policy.key().as_ref(), &policy.next_intent_nonce.to_le_bytes()],
        bump,
    )]
    pub intent: Account<'info, Intent>,
    pub system_program: Program<'info, System>,
}

pub fn propose_intent(ctx: Context<ProposeIntent>, params: ProposeIntentParams) -> Result<()> {
    require_gt!(params.amount, 0, CarapaceError::ZeroAmount);
    require!(
        params.ttl_seconds > 0 && params.ttl_seconds <= MAX_INTENT_TTL_SECONDS,
        CarapaceError::TtlTooLong
    );

    let now = Clock::get()?.unix_timestamp;
    let policy = &mut ctx.accounts.policy;
    require!(!policy.paused, CarapaceError::PolicyPaused);
    if policy.expires_at != 0 {
        require!(now < policy.expires_at, CarapaceError::PolicyExpired);
    }

    let nonce = policy.next_intent_nonce;
    policy.next_intent_nonce = policy
        .next_intent_nonce
        .checked_add(1)
        .ok_or(CarapaceError::MathOverflow)?;
    let policy_key = policy.key();

    let intent = &mut ctx.accounts.intent;
    intent.policy = policy_key;
    intent.nonce = nonce;
    intent.asset = params.asset;
    intent.amount = params.amount;
    intent.destination = params.destination;
    intent.action_hash = params.action_hash;
    intent.status = IntentStatus::Pending;
    intent.payer = ctx.accounts.delegate.key();
    intent.created_at = now;
    intent.expires_at = now
        .checked_add(params.ttl_seconds)
        .ok_or(CarapaceError::MathOverflow)?;
    intent.decided_at = 0;
    intent.bump = ctx.bumps.intent;

    emit!(IntentProposed {
        policy: policy_key,
        intent: intent.key(),
        nonce,
        asset: intent.asset,
        amount: intent.amount,
        destination: intent.destination,
        action_hash: intent.action_hash,
        expires_at: intent.expires_at,
    });
    Ok(())
}

/// Shared account shape for `approve_intent`/`deny_intent`: only the
/// `Policy.owner` can decide a pending Intent. This is the instruction the
/// dashboard's approve button and the Blinks endpoint both build.
#[derive(Accounts)]
pub struct DecideIntent<'info> {
    pub owner: Signer<'info>,
    #[account(has_one = owner @ CarapaceError::UnauthorizedOwner)]
    pub policy: Account<'info, Policy>,
    #[account(
        mut,
        seeds = [seeds::INTENT, policy.key().as_ref(), &intent.nonce.to_le_bytes()],
        bump = intent.bump,
    )]
    pub intent: Account<'info, Intent>,
}

pub fn approve_intent(ctx: Context<DecideIntent>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let intent = &mut ctx.accounts.intent;
    require!(intent.status == IntentStatus::Pending, CarapaceError::IntentNotPending);
    require!(now <= intent.expires_at, CarapaceError::IntentExpired);
    intent.status = IntentStatus::Approved;
    intent.decided_at = now;
    emit!(IntentApproved {
        policy: intent.policy,
        intent: intent.key(),
        nonce: intent.nonce,
    });
    Ok(())
}

pub fn deny_intent(ctx: Context<DecideIntent>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let intent = &mut ctx.accounts.intent;
    require!(intent.status == IntentStatus::Pending, CarapaceError::IntentNotPending);
    intent.status = IntentStatus::Denied;
    intent.decided_at = now;
    emit!(IntentDenied {
        policy: intent.policy,
        intent: intent.key(),
        nonce: intent.nonce,
    });
    Ok(())
}

/// Permissionless: anyone can flip a stale `Pending` Intent to `Expired` once
/// its TTL has passed, so rent can be reclaimed via `close_intent` even if
/// the owner never responds.
#[derive(Accounts)]
pub struct ExpireIntent<'info> {
    pub policy: Account<'info, Policy>,
    #[account(
        mut,
        seeds = [seeds::INTENT, policy.key().as_ref(), &intent.nonce.to_le_bytes()],
        bump = intent.bump,
    )]
    pub intent: Account<'info, Intent>,
}

pub fn expire_intent(ctx: Context<ExpireIntent>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let intent = &mut ctx.accounts.intent;
    require!(intent.status == IntentStatus::Pending, CarapaceError::IntentNotPending);
    require!(now > intent.expires_at, CarapaceError::IntentNotExpired);
    intent.status = IntentStatus::Expired;
    intent.decided_at = now;
    emit!(IntentExpiredEvent {
        policy: intent.policy,
        intent: intent.key(),
        nonce: intent.nonce,
    });
    Ok(())
}

/// Reclaims rent once an Intent is done being useful (Approved-and-executed,
/// Denied, or Expired — never while still `Pending`). Refunds the address
/// stored in `intent.payer` at proposal time, never an arbitrary
/// caller-supplied account.
#[derive(Accounts)]
pub struct CloseIntent<'info> {
    pub policy: Account<'info, Policy>,
    #[account(
        mut,
        seeds = [seeds::INTENT, policy.key().as_ref(), &intent.nonce.to_le_bytes()],
        bump = intent.bump,
        close = payer,
        constraint = intent.payer == payer.key() @ CarapaceError::PayerMismatch,
    )]
    pub intent: Account<'info, Intent>,
    /// CHECK: must equal `intent.payer`, enforced by the constraint above;
    /// used only as the rent-refund destination.
    #[account(mut)]
    pub payer: UncheckedAccount<'info>,
}

pub fn close_intent(ctx: Context<CloseIntent>) -> Result<()> {
    require!(
        ctx.accounts.intent.status != IntentStatus::Pending,
        CarapaceError::IntentStillPending
    );
    emit!(IntentClosed {
        policy: ctx.accounts.intent.policy,
        intent: ctx.accounts.intent.key(),
        nonce: ctx.accounts.intent.nonce,
    });
    Ok(())
}

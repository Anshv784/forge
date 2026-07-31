//! Carapace: on-chain enforced spending guardrails for autonomous agent
//! wallets.
//!
//! An agent's operating funds are custodied in this program's own PDA
//! vaults, never in a key the agent's own delegate signer independently
//! controls. The delegate can only *ask* this program to move funds; whether
//! that ask succeeds is entirely determined by the per-tx cap, daily cap,
//! destination allow-list, and — above a configurable threshold — a matching
//! `Intent` account that the policy owner has approved by signing a
//! transaction of their own. See docs/SECURITY.md for the full threat model.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("GuZ6yoSDkTcYh2PKAeoDdb51ZhP9i7pRhL6MGrZXST8L");

#[program]
pub mod carapace {
    use super::*;

    pub fn initialize_policy(ctx: Context<InitializePolicy>, params: InitPolicyParams) -> Result<()> {
        instructions::initialize_policy(ctx, params)
    }

    pub fn rotate_delegate(ctx: Context<RotateDelegate>, new_delegate: Pubkey) -> Result<()> {
        instructions::rotate_delegate(ctx, new_delegate)
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::set_paused(ctx, paused)
    }

    pub fn update_limits(ctx: Context<UpdateLimits>, params: UpdateLimitsParams) -> Result<()> {
        instructions::update_limits(ctx, params)
    }

    pub fn add_allowlist_entry(ctx: Context<AddAllowlistEntry>, destination: Pubkey) -> Result<()> {
        instructions::add_allowlist_entry(ctx, destination)
    }

    pub fn remove_allowlist_entry(ctx: Context<RemoveAllowlistEntry>) -> Result<()> {
        instructions::remove_allowlist_entry(ctx)
    }

    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        instructions::deposit_sol(ctx, amount)
    }

    pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
        instructions::deposit_spl(ctx, amount)
    }

    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        instructions::withdraw_sol(ctx, amount)
    }

    pub fn withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
        instructions::withdraw_spl(ctx, amount)
    }

    pub fn propose_intent(ctx: Context<ProposeIntent>, params: ProposeIntentParams) -> Result<()> {
        instructions::propose_intent(ctx, params)
    }

    pub fn approve_intent(ctx: Context<DecideIntent>) -> Result<()> {
        instructions::approve_intent(ctx)
    }

    pub fn deny_intent(ctx: Context<DecideIntent>) -> Result<()> {
        instructions::deny_intent(ctx)
    }

    pub fn expire_intent(ctx: Context<ExpireIntent>) -> Result<()> {
        instructions::expire_intent(ctx)
    }

    pub fn close_intent(ctx: Context<CloseIntent>) -> Result<()> {
        instructions::close_intent(ctx)
    }

    pub fn execute_transfer_sol(ctx: Context<ExecuteTransferSol>, amount: u64) -> Result<()> {
        instructions::execute_transfer_sol(ctx, amount)
    }

    pub fn execute_transfer_spl(ctx: Context<ExecuteTransferSpl>, amount: u64) -> Result<()> {
        instructions::execute_transfer_spl(ctx, amount)
    }
}

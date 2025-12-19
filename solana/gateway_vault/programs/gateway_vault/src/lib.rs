use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("6iKSqqM82HpiNP7VzLNfEppqzfLPFAhY2DWmz7gmQQTs");

/// Sonic Hub Chain Endpoint ID (LayerZero)
pub const SONIC_HUB_EID: u32 = 30332;

/// Message types for cross-chain communication
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MessageType {
    Deposit,
    Withdraw,
    Swap,
    LinkToken,
    RevertSwap,
}

/// Asset structure for cross-chain transfers
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Asset {
    pub token_address: [u8; 32],
    pub token_amount: u64,
}

#[program]
pub mod gateway_vault {
    use super::*;

    /// Initialize the Gateway Vault
    pub fn initialize(
        ctx: Context<Initialize>,
        hub_eid: u32,
        hub_address: [u8; 32],
    ) -> Result<()> {
        let vault_config = &mut ctx.accounts.vault_config;
        vault_config.authority = ctx.accounts.authority.key();
        vault_config.hub_eid = hub_eid;
        vault_config.hub_address = hub_address;
        vault_config.is_paused = false;
        vault_config.token_count = 0;
        vault_config.bump = ctx.bumps.vault_config;
        
        msg!("Gateway Vault initialized!");
        msg!("Hub EID: {}", hub_eid);
        Ok(())
    }

    /// Register a token for bridging
    pub fn register_token(
        ctx: Context<RegisterToken>,
        synthetic_token_address: [u8; 32],
        decimals_delta: i8,
        min_bridge_amount: u64,
    ) -> Result<()> {
        let token_config = &mut ctx.accounts.token_config;
        token_config.mint = ctx.accounts.mint.key();
        token_config.vault = ctx.accounts.token_vault.key();
        token_config.synthetic_token_address = synthetic_token_address;
        token_config.decimals_delta = decimals_delta;
        token_config.min_bridge_amount = min_bridge_amount;
        token_config.is_paused = false;
        token_config.total_deposited = 0;
        token_config.decimals = ctx.accounts.mint.decimals;
        token_config.bump = ctx.bumps.token_config;
        token_config.vault_bump = ctx.bumps.token_vault;
        
        let vault_config = &mut ctx.accounts.vault_config;
        vault_config.token_count += 1;
        
        msg!("Token registered: {}", ctx.accounts.mint.key());
        Ok(())
    }

    /// Deposit tokens to bridge to Sonic Hub
    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
        recipient: [u8; 32],
    ) -> Result<()> {
        let token_config = &mut ctx.accounts.token_config;
        
        require!(
            amount >= token_config.min_bridge_amount,
            GatewayError::AmountTooSmall
        );
        require!(!token_config.is_paused, GatewayError::TokenPaused);
        require!(!ctx.accounts.vault_config.is_paused, GatewayError::VaultPaused);
        
        // Transfer tokens from user to vault
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.token_vault.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;
        
        token_config.total_deposited = token_config
            .total_deposited
            .checked_add(amount)
            .ok_or(GatewayError::Overflow)?;
        
        emit!(DepositEvent {
            message_type: MessageType::Deposit,
            user: ctx.accounts.user.key(),
            recipient,
            token: ctx.accounts.mint.key(),
            synthetic_token: token_config.synthetic_token_address,
            amount,
            hub_eid: ctx.accounts.vault_config.hub_eid,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        msg!("Deposited {} tokens", amount);
        Ok(())
    }

    /// Process withdrawal from Sonic Hub
    pub fn withdraw(
        ctx: Context<Withdraw>,
        amount: u64,
        _message_guid: [u8; 32],
    ) -> Result<()> {
        let mint_key = ctx.accounts.mint.key();
        let vault_bump = ctx.accounts.token_config.vault_bump;
        let decimals = ctx.accounts.token_config.decimals;
        
        let seeds = &[
            b"token_vault",
            mint_key.as_ref(),
            &[vault_bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.token_vault.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.token_vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token_interface::transfer_checked(cpi_ctx, amount, decimals)?;
        
        let token_config = &mut ctx.accounts.token_config;
        token_config.total_deposited = token_config
            .total_deposited
            .checked_sub(amount)
            .ok_or(GatewayError::Underflow)?;
        
        emit!(WithdrawEvent {
            message_type: MessageType::Withdraw,
            recipient: ctx.accounts.recipient.key(),
            token: ctx.accounts.mint.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        msg!("Withdrawn {} tokens", amount);
        Ok(())
    }

    /// Pause/unpause a specific token
    pub fn set_token_pause(ctx: Context<AdminAction>, paused: bool) -> Result<()> {
        ctx.accounts.token_config.is_paused = paused;
        msg!("Token paused: {}", paused);
        Ok(())
    }

    /// Pause/unpause entire vault
    pub fn set_vault_pause(ctx: Context<VaultAdminAction>, paused: bool) -> Result<()> {
        ctx.accounts.vault_config.is_paused = paused;
        msg!("Vault paused: {}", paused);
        Ok(())
    }
}

// ============ Account Structures ============

#[account]
pub struct VaultConfig {
    pub authority: Pubkey,
    pub hub_eid: u32,
    pub hub_address: [u8; 32],
    pub is_paused: bool,
    pub token_count: u32,
    pub bump: u8,
}

impl VaultConfig {
    pub const LEN: usize = 8 + 32 + 4 + 32 + 1 + 4 + 1;
}

#[account]
pub struct TokenConfig {
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub synthetic_token_address: [u8; 32],
    pub decimals_delta: i8,
    pub min_bridge_amount: u64,
    pub is_paused: bool,
    pub total_deposited: u64,
    pub decimals: u8,
    pub bump: u8,
    pub vault_bump: u8,
}

impl TokenConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 1 + 8 + 1 + 8 + 1 + 1 + 1;
}

// ============ Contexts ============

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = VaultConfig::LEN,
        seeds = [b"vault_config"],
        bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterToken<'info> {
    #[account(
        mut,
        seeds = [b"vault_config"],
        bump = vault_config.bump,
        has_one = authority
    )]
    pub vault_config: Account<'info, VaultConfig>,
    
    #[account(
        init,
        payer = authority,
        space = TokenConfig::LEN,
        seeds = [b"token_config", mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,
    
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = token_vault,
        seeds = [b"token_vault", mint.key().as_ref()],
        bump
    )]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,
    
    pub mint: InterfaceAccount<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [b"vault_config"],
        bump = vault_config.bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    
    #[account(
        mut,
        seeds = [b"token_config", mint.key().as_ref()],
        bump = token_config.bump
    )]
    pub token_config: Account<'info, TokenConfig>,
    
    #[account(
        mut,
        seeds = [b"token_vault", mint.key().as_ref()],
        bump = token_config.vault_bump
    )]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,
    
    pub mint: InterfaceAccount<'info, Mint>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [b"vault_config"],
        bump = vault_config.bump,
        has_one = authority
    )]
    pub vault_config: Account<'info, VaultConfig>,
    
    #[account(
        mut,
        seeds = [b"token_config", mint.key().as_ref()],
        bump = token_config.bump
    )]
    pub token_config: Account<'info, TokenConfig>,
    
    #[account(
        mut,
        seeds = [b"token_vault", mint.key().as_ref()],
        bump = token_config.vault_bump
    )]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,
    
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// CHECK: Recipient validated by associated token constraint
    pub recipient: UncheckedAccount<'info>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = recipient,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(
        seeds = [b"vault_config"],
        bump = vault_config.bump,
        has_one = authority
    )]
    pub vault_config: Account<'info, VaultConfig>,
    
    #[account(mut)]
    pub token_config: Account<'info, TokenConfig>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct VaultAdminAction<'info> {
    #[account(
        mut,
        seeds = [b"vault_config"],
        bump = vault_config.bump,
        has_one = authority
    )]
    pub vault_config: Account<'info, VaultConfig>,
    
    pub authority: Signer<'info>,
}

// ============ Events ============

#[event]
pub struct DepositEvent {
    pub message_type: MessageType,
    pub user: Pubkey,
    pub recipient: [u8; 32],
    pub token: Pubkey,
    pub synthetic_token: [u8; 32],
    pub amount: u64,
    pub hub_eid: u32,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawEvent {
    pub message_type: MessageType,
    pub recipient: Pubkey,
    pub token: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// ============ Errors ============

#[error_code]
pub enum GatewayError {
    #[msg("Amount is below minimum bridge amount")]
    AmountTooSmall,
    #[msg("Token is paused")]
    TokenPaused,
    #[msg("Vault is paused")]
    VaultPaused,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,
}

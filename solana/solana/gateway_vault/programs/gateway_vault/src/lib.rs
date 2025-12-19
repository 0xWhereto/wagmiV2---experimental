use anchor_lang::prelude::*;

declare_id!("6ztRNxnTcSxwpy5wULHDvXLHnm72xRiuCGrX9ttk9pHj");

#[program]
pub mod gateway_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

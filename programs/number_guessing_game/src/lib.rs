use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("H2QtoCz4CcjVZsHrFxzngLJ8z4rQatMnAspT9w3q12LE");

#[program]
pub mod guessing_game {
    use super::*;

    // Initializes the game and sets a random number
    pub fn initialize(ctx: Context<Initialize>, random_number: u8) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.random_number = random_number;
        game.pot = 0; // Initialize the pot to 0
        Ok(())
    }

    // Allows players to make a guess
    pub fn guess(ctx: Context<Guess>, user_guess: u8) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player = &mut ctx.accounts.player;

        // Define the participation fee
        let fee = (100.0 * anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL as f64) as u64;

        // Check if the player has enough funds
        let player_balance = player.to_account_info().lamports();
        if player_balance < fee {
            return Err(GameError::InsufficientFunds.into());
        }

        // Transfer fee from player to game pot
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: player.to_account_info(),
                to: game.to_account_info(),
            },
        );

        // Attempt to transfer the fee
        system_program::transfer(cpi_context, fee)?;

        // Game pot update
        game.pot += fee;

        // Check the guessed number
        if user_guess == game.random_number {
            
            let pot = game.pot; // Store the amount of the pot
            game.pot = 0; // Reset the pot before transfer

            // Transfer the pot from game to player
            game.sub_lamports(pot)?;
            player.add_lamports(pot)?;

            msg!("Correct guess! {} wins the pot of {} lamports!", player.key(), pot);
        } 
        else if user_guess < game.random_number {
            msg!("Your guess is too low.");
        } 
        else {
            msg!("Your guess is too high.");
        }

        Ok(())
    }
}

// Definition of accounts
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    
    #[account(init, payer = signer, space = 8 + 1 + 8)] // Adjusted space for Game account
    pub game: Account<'info, Game>,
    pub system_program: Program<'info, System>,
}   

#[derive(Accounts)]
pub struct Guess<'info> {
    #[account(mut)]
    pub player: Signer<'info>, // Ensure it's a signer
    
    #[account(mut)]
    pub game: Account<'info, Game>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Game {
    pub random_number: u8,
    pub pot: u64,
}

// Define a custom error
#[error_code]
pub enum GameError {
    #[msg("Insufficient funds in the player's account.")]
    InsufficientFunds,
}
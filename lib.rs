use anchor_lang::{prelude::*, solana_program::clock::Clock};
use anchor_lang::solana_program::keccak::hash;
use anchor_lang::solana_program::{system_instruction, program::invoke};
use anchor_lang::system_program;

declare_id!("3aoJ7CfsFPQP7MVFVDZtQ3xAGr5R7ZSsDHybvscaWtd6");

const RENT_COST: u64 = 50_000_000;

/// An empty account for the vault.
/// This account will only hold lamports and no other data.
#[account]
pub struct Vault {}

#[program]
pub mod truth_network {
    use super::*;

    pub fn hello_world(_ctx: Context<HelloWorld>) -> Result<()> {
        msg!("Hello, World!");
        Ok(())
    }

    pub fn join_network(ctx: Context<JoinNetwork>) -> Result<()> {
        // Define deposit amount: 0.5 SOL in lamports.
        let deposit_amount: u64 = 500_000_000;
    
        // Transfer 0.5 SOL from the user's account to the vault.
        // (The user's account is system owned, so this transfer is allowed even if
        // the vault is program-owned.)
        invoke(
            &system_instruction::transfer(
                &ctx.accounts.user.key,
                &ctx.accounts.vault.to_account_info().key,
                deposit_amount,
            ),
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    
        // After deposit, add the user to the voter list.
        let voter_list = &mut ctx.accounts.voter_list;
        let new_voter = Voter {
            address: *ctx.accounts.user.key,
            reputation: 0, // Default reputation.
        };
    
        require!(
            !voter_list.voters.contains(&new_voter),
            VotingError::AlreadyJoined
        );
    
        voter_list.voters.push(new_voter);
        Ok(())
    }
    
    pub fn leave_network(ctx: Context<LeaveNetwork>) -> Result<()> {
        // Remove the user from the voter list.
        {
            let voter_list = &mut ctx.accounts.voter_list;
            let user_pubkey = *ctx.accounts.user.key;
            if let Some(pos) = voter_list.voters.iter().position(|v| v.address == user_pubkey) {
                voter_list.voters.swap_remove(pos);
            } else {
                return Err(VotingError::NotJoined.into());
            }
        }
    
        // No manual lamport transfer is needed.
        // The `close = user` attribute on the vault account automatically transfers all its lamports
        // to the user and closes the account.
        Ok(())
    }

    pub fn create_question(
        ctx: Context<CreateQuestion>,
        question_text: String,
        reward: u64,
        commit_end_time: i64,
        reveal_end_time: i64,
    ) -> Result<()> {
        let question_counter = &mut ctx.accounts.question_counter;
        let question_key = ctx.accounts.question.key();
    
        // Ensure commit and reveal times are valid
        require!(Clock::get()?.unix_timestamp < commit_end_time, VotingError::VotingEnded);
        require!(commit_end_time < reveal_end_time, VotingError::InvalidTimeframe);
    
        // Transfer rent from asker to the question account
        invoke(
            &system_instruction::transfer(
                &ctx.accounts.asker.key(),
                &question_key,
                RENT_COST,
            ),
            &[
                ctx.accounts.asker.to_account_info(),
                ctx.accounts.question.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    
        let question = &mut ctx.accounts.question;
        question.id = question_counter.count;
        question.asker = *ctx.accounts.asker.key;
        question.question_text = question_text;
        question.option_1 = "True".to_string();
        question.option_2 = "False".to_string();
        question.reward = reward;
        question.commit_end_time = commit_end_time;
        question.reveal_end_time = reveal_end_time;
        question.rent_expiration = Clock::get()?.unix_timestamp + 86400;
        question.votes_option_1 = 0;
        question.votes_option_2 = 0;
        question.finalized = false;
        question.committed_voters = 0;
    
        question_counter.count += 1;
        let question_id = question_counter.count;
    
        msg!("Question Created: {}", question.id);
        Ok(())
    }

    pub fn update_reward(
        ctx: Context<UpdateReward>,
        new_reward: u64,
    ) -> Result<()> {
        let question = &mut ctx.accounts.question;
    
        // Ensure the question has not ended
        require!(
            Clock::get()?.unix_timestamp < question.commit_end_time,
            VotingError::VotingEnded
        );
    
        // Update the reward
        question.reward = new_reward;
    
        msg!("Reward Updated: {}", new_reward);
        Ok(())
    }        
     

    pub fn delete_expired_question(ctx: Context<DeleteExpiredQuestion>) -> Result<()> {
        let question = &ctx.accounts.question;
    
        // Ensure the rent period has expired
        require!(
            Clock::get()?.unix_timestamp >= question.rent_expiration,
            VotingError::RentNotExpired
        );
    
        msg!(
            "Expired question deleted. Rent refunded to {}",
            ctx.accounts.asker.key()
        );
    
        // Account will be automatically closed and rent refunded due to `close = asker`
        Ok(())
    }
    
    
    
    
    pub fn finalize_voting(ctx: Context<FinalizeVoting>) -> Result<()> {
        let question = &mut ctx.accounts.question;
    
        require!(Clock::get()?.unix_timestamp >= question.reveal_end_time, VotingError::VotingStillActive);
        require!(!question.finalized, VotingError::AlreadyFinalized);
    
        question.finalized = true;
    
        msg!(
            "Voting Finalized. Option 1: {}, Option 2: {}",
            question.votes_option_1,
            question.votes_option_2
        );
    
        Ok(())
    }

    pub fn initialize_counter(ctx: Context<InitializeCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.question_counter;
    
        // Ensure the counter is initialized only once.
        require!(counter.count == 0, VotingError::AlreadyInitialized);
    
        counter.asker = *ctx.accounts.asker.key;
        counter.count = 0;
        msg!("Initialized Question Counter");
        Ok(())
    }

    pub fn create_voter_record(ctx: Context<CreateVoterRecord>) -> Result<()> {
        let voter_record = &mut ctx.accounts.voter_record;
    
        // Ensure voter record is only initialized if it is empty.
        if voter_record.voter == Pubkey::default() {
            voter_record.question = ctx.accounts.question.key();
            voter_record.voter = ctx.accounts.voter.key();
            msg!("Voter Record Created: {:?}", voter_record.voter);
        } else {
            msg!("Voter Record already exists");
        }
    
        Ok(())
    }

    pub fn commit_vote(ctx: Context<CommitVote>, commitment: [u8; 32]) -> Result<()> {
        let question_key = ctx.accounts.question.key(); // Clone the key before borrowing.
    
        let voter_record = &mut ctx.accounts.voter_record;
        let question = &mut ctx.accounts.question;
    
        require!(!voter_record.revealed, VotingError::AlreadyRevealed);

        require!(Clock::get()?.unix_timestamp < question.commit_end_time, VotingError::CommitPhaseEnded);
    
        // Store precomputed hash from frontend.
        voter_record.commitment = commitment;
        voter_record.voter = *ctx.accounts.voter.key;
        voter_record.question = question_key; // Use the stored key.
    
        // Increment the committed voters count.
        question.committed_voters += 1;
    
        msg!(
            "Vote committed with hash: {:?}. Total committed voters: {}",
            commitment,
            question.committed_voters
        );
    
        Ok(())
    }
    
    pub fn reveal_vote(ctx: Context<RevealVote>, password: String) -> Result<()> {
        let voter_record = &mut ctx.accounts.voter_record;
        let question = &mut ctx.accounts.question;
    
        require!(!voter_record.revealed, VotingError::AlreadyRevealed);

        require!(Clock::get()?.unix_timestamp < question.reveal_end_time, VotingError::RevealPhaseEnded);
    
        // Try both vote options (1 and 2) to reconstruct the hash.
        let mut valid_vote: Option<u8> = None;
    
        for vote in 1..=2 {
            let vote_string = vote.to_string();
            let input_data = format!("{}{}", vote_string, password);
            let computed_hash = hash(input_data.as_bytes());
    
            if computed_hash.0 == voter_record.commitment {
                valid_vote = Some(vote);
                break;
            }
        }
    
        // If no valid vote is found, return an error.
        let vote = valid_vote.ok_or(VotingError::InvalidReveal)?;
    
        // Count the vote.
        if vote == 1 {
            question.votes_option_1 += 1;
        } else {
            question.votes_option_2 += 1;
        }
    
        // Mark vote as revealed.
        voter_record.revealed = true;
    
        msg!("Vote Revealed Successfully! Option {}", vote);
        Ok(())
    }
}

#[account]
pub struct Question {
    pub id: u64,
    pub asker: Pubkey,
    pub question_text: String,
    pub option_1: String,
    pub option_2: String,
    pub reward: u64,
    pub commit_end_time: i64,
    pub reveal_end_time: i64,
    pub rent_expiration: i64,
    pub votes_option_1: u64,
    pub votes_option_2: u64,
    pub finalized: bool,
    pub committed_voters: u64,
}


#[derive(Accounts)]
#[instruction(question_text: String)]
pub struct CreateQuestion<'info> {
    #[account(
        mut,
        seeds = [b"question_counter", asker.key().as_ref()],
        bump,
        has_one = asker
    )]
    pub question_counter: Account<'info, QuestionCounter>,

    #[account(
        init,
        payer = asker,
        space = 800,
        seeds = [b"question", asker.key().as_ref(), &question_counter.count.to_le_bytes()],
        bump
    )]
    pub question: Account<'info, Question>, 

    #[account(mut)]
    pub asker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateReward<'info> {
    #[account(mut)]
    pub question: Account<'info, Question>,
    #[account(mut)]
    pub updater: Signer<'info>,
}


#[derive(Accounts)]
pub struct DeleteExpiredQuestion<'info> {
    #[account(
        mut,
        seeds = [b"question", asker.key().as_ref(), &question.id.to_le_bytes()],
        bump,
        close = asker
    )]
    pub question: Account<'info, Question>,

    #[account(mut)]
    pub asker: Signer<'info>,

    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct JoinNetwork<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 2000, // for voter_list
        seeds = [b"voter_list"],
        bump
    )]
    pub voter_list: Account<'info, VoterList>,

    // The vault account is now defined as a typed account.
    #[account(
        init_if_needed,
        payer = user,
        space = 8,  // Minimal space for Vault (only the 8-byte discriminator).
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut, signer)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LeaveNetwork<'info> {
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump,
        close = user
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut, signer)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub voter_list: Account<'info, VoterList>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(
        init,
        payer = asker,
        space = 8 + 40,
        seeds = [b"question_counter", asker.key().as_ref()],
        bump
    )]
    pub question_counter: Account<'info, QuestionCounter>,

    #[account(mut)]
    pub asker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct QuestionCounter {
    pub asker: Pubkey,
    pub count: u64,
}

#[derive(Accounts)]
pub struct CreateVoterRecord<'info> {
    #[account(mut)]
    pub question: Account<'info, Question>,

    #[account(
        init_if_needed,
        payer = voter, 
        space = 8 + 128,
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()],
        bump
    )]
    pub voter_record: Account<'info, VoterRecord>, 

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct VoterList {
    pub voters: Vec<Voter>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub struct Voter {
    pub address: Pubkey,
    pub reputation: u8,
}

#[account]
pub struct VoterRecord {
    pub question: Pubkey,
    pub voter: Pubkey,
    pub commitment: [u8; 32],
    pub revealed: bool,
}

#[derive(Accounts)]
pub struct CommitVote<'info> {
    #[account(mut)]
    pub question: Account<'info, Question>,

    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + 128,
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()],
        bump
    )]
    pub voter_record: Account<'info, VoterRecord>, 

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealVote<'info> {
    #[account(mut)]
    pub question: Account<'info, Question>,

    #[account(
        mut,
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()],
        bump
    )]
    pub voter_record: Account<'info, VoterRecord>, 

    #[account(mut)]
    pub voter: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeVoting<'info> {
    #[account(mut)]
    pub question: Account<'info, Question>,
}

#[derive(Accounts)]
pub struct HelloWorld<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
}

#[error_code]
pub enum VotingError {
    #[msg("Voting period has ended.")]
    VotingEnded,
    #[msg("Voting is still active.")]
    VotingStillActive,
    #[msg("Voting has already been finalized.")]
    AlreadyFinalized,
    #[msg("You have already joined the network.")]
    AlreadyJoined,
    #[msg("Question counter already exists.")]
    AlreadyInitialized,
    #[msg("You have already voted on this question.")]
    AlreadyVoted,
    #[msg("You have already revealed your vote.")]
    AlreadyRevealed,
    #[msg("Invalid voting reveal.")]
    InvalidReveal,
    #[msg("You have already leaved the network.")]
    NotJoined,
    #[msg("Rent period has not expired yet.")]
    RentNotExpired,
    #[msg("Invalid timeframe.")]
    InvalidTimeframe,
    #[msg("Commit phase ended.")]
    CommitPhaseEnded,
    #[msg("Reveal phase ended.")]
    RevealPhaseEnded
}


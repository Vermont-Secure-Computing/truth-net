use anchor_lang::prelude::*;

declare_id!("HgSmSrv53KqXTNmM1MtLKAQLbbyr9sVSc5KG23YK1jzE");

#[program]
pub mod truth_network {
    use super::*;

    pub fn hello_world(_ctx: Context<HelloWorld>) -> Result<()> {
        msg!("Hello, World!");
        Ok(())
    }

    pub fn create_question(
        ctx: Context<CreateQuestion>,
        question_text: String,
        option_1: String,
        option_2: String,
        reward: u64,
        end_time: i64,
    ) -> Result<()> {
        let question_counter = &mut ctx.accounts.question_counter;
        let question = &mut ctx.accounts.question;
    
        // Ensure the end time is in the future
        require!(Clock::get()?.unix_timestamp < end_time, VotingError::VotingEnded);
    
        // Increment counter before using it
        question_counter.count += 1;
        let question_id = question_counter.count;  // Assigning ID
    
        // Set the question details
        question.id = question_id;
        question.asker = *ctx.accounts.asker.key;
        question.question_text = question_text;
        question.option_1 = option_1;
        question.option_2 = option_2;
        question.reward = reward;
        question.end_time = end_time;
        question.votes_option_1 = 0;
        question.votes_option_2 = 0;
        question.finalized = false;
    
        msg!("Question Created: {}", question.id);
        Ok(())
    }

    pub fn submit_vote(ctx: Context<SubmitVote>, selected_option: u8) -> Result<()> {
        let question = &mut ctx.accounts.question;
        let voter_record = &mut ctx.accounts.voter_record;
    
        // Ensure voting is still open
        require!(Clock::get()?.unix_timestamp < question.end_time, VotingError::VotingEnded);
        require!(!question.finalized, VotingError::AlreadyFinalized);
    
        // Ensure voter record is correctly initialized before checking
        if voter_record.voter == Pubkey::default() {
            voter_record.question = question.key();
            voter_record.voter = *ctx.accounts.voter.key;
            msg!("New voter record created.");
        } else {
            // Prevent double voting
            require!(voter_record.voter != ctx.accounts.voter.key(), VotingError::AlreadyVoted);
        }
    
        // Register the vote
        if selected_option == 1 {
            question.votes_option_1 += 1;
        } else if selected_option == 2 {
            question.votes_option_2 += 1;
        } else {
            return Err(ProgramError::InvalidArgument.into());
        }
    
        msg!(
            "Vote Recorded. Option 1: {}, Option 2: {}",
            question.votes_option_1,
            question.votes_option_2
        );
    
        Ok(())
    }
    
    
    pub fn finalize_voting(ctx: Context<FinalizeVoting>) -> Result<()> {
        let question = &mut ctx.accounts.question;

        require!(Clock::get()?.unix_timestamp >= question.end_time, VotingError::VotingStillActive);
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
    
        // Ensure the counter is initialized only once
        require!(counter.count == 0, VotingError::AlreadyInitialized);
    
        counter.asker = *ctx.accounts.asker.key;
        counter.count = 0;
        msg!("Initialized Question Counter");
        Ok(())
    }

    pub fn create_voter_record(ctx: Context<CreateVoterRecord>) -> Result<()> {
        let voter_record = &mut ctx.accounts.voter_record;
    
        // Ensure voter record is only initialized if it is empty
        if voter_record.voter == Pubkey::default() {
            voter_record.question = ctx.accounts.question.key();
            voter_record.voter = ctx.accounts.voter.key();
            msg!("Voter Record Created: {:?}", voter_record.voter);
        } else {
            msg!("Voter Record already exists");
        }
    
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
    pub end_time: i64,
    pub votes_option_1: u64,
    pub votes_option_2: u64,
    pub finalized: bool,
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
        space = 1024,
        seeds = [b"question", asker.key().as_ref(), &question_counter.count.to_le_bytes()], 
        bump
    )]
    pub question: Account<'info, Question>, 

    #[account(mut)]
    pub asker: Signer<'info>,

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
        space = 8 + 32 + 32,
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()], 
        bump
    )]
    pub voter_record: Account<'info, VoterRecord>, 

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct SubmitVote<'info> {
    #[account(mut)]
    pub question: Account<'info, Question>,

    #[account(
        init_if_needed,
        payer = voter, 
        space = 64, 
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()], 
        bump
    )]
    pub voter_record: Account<'info, VoterRecord>, 

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}




#[account]
pub struct VoterRecord {
    pub question: Pubkey,
    pub voter: Pubkey,
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
    #[msg("Question counter already exists.")]
    AlreadyInitialized,
    #[msg("You have already voted on this question.")]
    AlreadyVoted,
}

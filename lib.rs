use anchor_lang::{prelude::*, solana_program::clock::Clock};
use anchor_lang::solana_program::keccak::hash;
use anchor_lang::solana_program::{system_instruction, program::invoke};
use anchor_lang::solana_program::rent::Rent;
use anchor_lang::AccountDeserialize;

pub const FEE_RECEIVER_ADDRESS: &str = "7qfdvYGEKnM2zrMYATbwtAdzagRGQUUCXxU3hhgG3V2u";


declare_id!("3c1dWoc2AegksbJegy3hsiikJowZFfKkXWfwxidDxWyD");


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
            total_earnings: 0,
            total_revealed_votes: 0,
            total_correct_votes: 0,
            selected_option: 255,
        };        
    
        require!(
            !voter_list.voters.contains(&new_voter),
            VotingError::AlreadyJoined
        );
    
        voter_list.voters.push(new_voter);
        Ok(())
    }
    
    pub fn leave_network(ctx: Context<LeaveNetwork>) -> Result<()> {
        let voter_list = &mut ctx.accounts.voter_list;
        let user_pubkey = *ctx.accounts.user.key;
    
        // Find and reset the voter's data if they exist
        if let Some(voter) = voter_list.voters.iter_mut().find(|v| v.address == user_pubkey) {
            voter.reputation = 0;
            voter.total_earnings = 0;
            voter.total_revealed_votes = 0;
            voter.total_correct_votes = 0;

            msg!("Voter data for user {} has been reset.", user_pubkey);
        } else {
            return Err(VotingError::NotJoined.into());
        }

        // Remove the voter from the voter list using retain
        voter_list.voters.retain(|v| v.address != user_pubkey);
        msg!("User {} has been removed from the voter list.", user_pubkey);
    
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

        // Minimum length check for question text
        require!(
            question_text.len() >= 10,
            VotingError::QuestionTooShort
        );
        
        // Ensure commit and reveal times are valid.
        require!(Clock::get()?.unix_timestamp < commit_end_time, VotingError::VotingEnded);
        require!(commit_end_time < reveal_end_time, VotingError::InvalidTimeframe);
        
        // Require reward to be at least 0.05 SOL (in lamports)
        const MIN_REWARD_LAMPORTS: u64 = 50_000_000; // 0.05 SOL
        require!(
            reward >= MIN_REWARD_LAMPORTS,
            VotingError::RewardTooSmall
        );

        // Transfer reward from asker to vault
        invoke(
            &system_instruction::transfer(
                &ctx.accounts.asker.key(),
                &ctx.accounts.vault.key(),
                reward,
            ),
            &[
                ctx.accounts.asker.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Initialize the question account.
        let question = &mut ctx.accounts.question;
        question.id = question_counter.count;
        question.asker = *ctx.accounts.asker.key;
        question.question_text = question_text;
        question.option_1 = "True".to_string();
        question.option_2 = "False".to_string();
        // question.reward = total_transfer;
        question.commit_end_time = commit_end_time;
        question.reveal_end_time = reveal_end_time;
        question.rent_expiration = Clock::get()?.unix_timestamp; //+ 86400;
        question.votes_option_1 = 0;
        question.votes_option_2 = 0;
        question.finalized = false;
        question.committed_voters = 0;
        question.question_key = question_key;
        question.winning_option = 255;
        // For clarity, store the vault address in a dedicated field.
        question.vault_address = ctx.accounts.vault.key();
        question.claimed_weight = 0;
        
        // Derive the bump for the question PDA.
        let (_derived_pubkey, bump) = Pubkey::find_program_address(
            &[b"question", ctx.accounts.asker.key.as_ref(), &question_counter.count.to_le_bytes()],
            ctx.program_id,
        );
        question.bump = bump;
        
        question_counter.count += 1;
        
        msg!("Question Created: {}", question.id);
        msg!("Vault PDA: {}", ctx.accounts.vault.key());
        Ok(())
    }
    
            

    // pub fn update_reward(
    //     ctx: Context<UpdateReward>,
    //     new_reward: u64,
    // ) -> Result<()> {
    //     let question = &mut ctx.accounts.question;
    
    //     // Ensure the question has not ended
    //     require!(
    //         Clock::get()?.unix_timestamp < question.commit_end_time,
    //         VotingError::VotingEnded
    //     );
    
    //     // Update the reward
    //     question.reward += new_reward;
    
    //     msg!("Reward Updated: {}", new_reward);
    //     Ok(())
    // }              

    pub fn delete_expired_question(ctx: Context<DeleteExpiredQuestion>) -> Result<()> {
        let question = &ctx.accounts.question;
        let vault_info = ctx.accounts.vault.to_account_info();
        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(vault_info.data_len());
        let vault_balance = **vault_info.lamports.borrow();
    
        let now = Clock::get()?.unix_timestamp;

        // Rent must have expired
        require!(
            now >= question.rent_expiration,
            VotingError::RentNotExpired
        );

        // Case 1: No one committed and commit phase is over
        let no_one_committed = question.committed_voters == 0 && now >= question.commit_end_time;

        // Case 2: Reveal is over, but no one revealed or claimed
        let reveal_over = now >= question.reveal_end_time;
        let no_votes_revealed = question.votes_option_1 == 0 && question.votes_option_2 == 0;
        let all_rewards_claimed = question.total_distributed >= question.snapshot_reward;
        let all_rent_reclaimed = question.voter_records_closed == question.voter_records_count;

        let can_delete = no_one_committed || (reveal_over && no_votes_revealed) || (reveal_over && all_rewards_claimed && all_rent_reclaimed);


        require!(can_delete, VotingError::CannotDeleteQuestion);       
    
        // Prevent deletion if there is still any reward left in the vault (besides rent exemption)
        require!(
            vault_balance <= min_balance,
            VotingError::RemainingRewardExists
        );
    
        msg!(
            "Expired question deleted. Rent refunded to {}",
            ctx.accounts.asker.key()
        );
    
        Ok(())
    }    
    
    
    
    pub fn finalize_voting(ctx: Context<FinalizeVoting>, question_id: u64) -> Result<()> {
        let question = &mut ctx.accounts.question;
        
        // Verify that the passed question_id matches the one stored on the account.
        require!(question.id == question_id, VotingError::QuestionIdMismatch);
        
        require!(
            Clock::get()?.unix_timestamp >= question.reveal_end_time,
            VotingError::VotingStillActive
        );
        require!(!question.finalized, VotingError::AlreadyFinalized);
        
        
        let total_votes = question.votes_option_1 + question.votes_option_2;
        
        // Calculate percentage for each option
        let option1_percent = if total_votes > 0 {
            (question.votes_option_1 as f64 / total_votes as f64) * 100.0
        } else {
            0.0
        };
        let option2_percent = if total_votes > 0 {
            (question.votes_option_2 as f64 / total_votes as f64) * 100.0
        } else {
            0.0
        };

        // Determine winning option and percentage
        let (winning_option, winning_percent) = if question.votes_option_1 >= question.votes_option_2 {
            (1, option1_percent)
        } else {
            (2, option2_percent)
        };
        
        
        // Set eligible voters to the winning votes count
        question.eligible_voters = if winning_option == 1 {
            question.votes_option_1
        } else {
            question.votes_option_2
        };
    
        

        // Store winning_option and winning_percent in the Question struct
        question.winning_option = winning_option;
        question.winning_percent = winning_percent;
        question.finalized = true;
    
        
        msg!(
            "Voting Finalized. Total Votes: {}. Option 1: {} votes, Option 2: {} votes. Winning Option: {} with {:.0}% votes",
            total_votes,
            question.votes_option_1,
            question.votes_option_2,
            winning_option,
            winning_percent,
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
        let voter_list = &ctx.accounts.voter_list;

        // Check if the voter is in the voter list
        require!(
            voter_list.voters.iter().any(|v| v.address == *ctx.accounts.voter.key),
            VotingError::NotPartOfVoterList
        );

        require!(!voter_record.revealed, VotingError::AlreadyRevealed);

        require!(Clock::get()?.unix_timestamp < question.commit_end_time, VotingError::CommitPhaseEnded);
    
        // Store precomputed hash from frontend.
        voter_record.commitment = commitment;
        voter_record.voter = *ctx.accounts.voter.key;
        voter_record.question = question_key; // Use the stored key.
    
        // Increment the committed voters count.
        question.committed_voters += 1;
        question.voter_records_count += 1;
    
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
        let voter_list = &mut ctx.accounts.voter_list;
        let voter_pubkey = ctx.accounts.voter.key();
    
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
    
        let reputation = voter_list
            .voters
            .iter()
            .find(|v| v.address == voter_pubkey)
            .map(|v| v.reputation as u64)
            .unwrap_or(0);

        let vote_weight = if reputation == 0 {
            1
        } else {
            reputation
        };
            

        // Count the vote with weighted value
        if vote == 1 {
            question.votes_option_1 += vote_weight;
        } else {
            question.votes_option_2 += vote_weight;
        }
    
        // Mark vote as revealed.
        voter_record.revealed = true;

        // **Set the revealed vote in plaintext.**
        voter_record.selected_option = vote;

        let vote_weight = if reputation == 0 { 1 } else { reputation };

        voter_record.vote_weight = vote_weight;

        if let Some(voter) = voter_list.voters.iter_mut().find(|v| v.address == voter_pubkey) {
            voter.total_revealed_votes += 1;
            voter.selected_option = vote;
            voter.reputation = calculate_reputation(
                voter.total_revealed_votes,
                voter.total_correct_votes,
            );
        }
        
    
        msg!("Vote Revealed Successfully! Option {}", vote);
        Ok(())
    }

    

    pub fn claim_reward(ctx: Context<ClaimReward>, tx_id: String) -> Result<()> {
        let question = &mut ctx.accounts.question;
        let voter_record = &mut ctx.accounts.voter_record;
        let voter_info = ctx.accounts.voter.to_account_info();
        let vault_info = ctx.accounts.vault.to_account_info();
        let fee_receiver_info = ctx.accounts.fee_receiver.to_account_info();
    
        require!(!voter_record.claimed, VotingError::AlreadyClaimed);
    
        if question.winning_option == 255 {
            require!(
                Clock::get()?.unix_timestamp > question.reveal_end_time,
                VotingError::RevealPhaseNotOver
            );
    
            question.winning_option = if question.votes_option_1 == question.votes_option_2 {
                0
            } else if question.votes_option_1 > question.votes_option_2 {
                1
            } else {
                2
            };
        }
    
        let winning_option = question.winning_option;
        let is_tie = winning_option == 0;
    
        if !is_tie {
            require!(
                voter_record.selected_option == winning_option,
                VotingError::NotEligible
            );
        }
    
        if question.revealed_correct_voters == 0 {
            let mut count = 0u64;
    
            for acc_info in ctx.remaining_accounts.iter() {
                let mut data: &[u8] = &acc_info.data.borrow();
                if let Ok(record) = VoterRecord::try_deserialize(&mut data) {
                    if record.revealed && (is_tie || record.selected_option == winning_option) {
                        count += 1;
                    }
                }
            }
    
            question.revealed_correct_voters = count;
    
            msg!(
                "Snapshot: {} revealed and picked winning option",
                question.revealed_correct_voters
            );
        }
    
        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(vault_info.data_len());
        let vault_balance = **vault_info.lamports.borrow();
    
        if !question.reward_fee_taken {
            let available_reward = vault_balance.saturating_sub(min_balance);
            let fee = available_reward * 2 / 100;
            let snapshot = available_reward.saturating_sub(fee);
    
            **vault_info.try_borrow_mut_lamports()? -= fee;
            **fee_receiver_info.try_borrow_mut_lamports()? += fee;
    
            question.original_reward = available_reward;
            question.snapshot_reward = snapshot;
            question.snapshot_total_weight = if is_tie {
                question.votes_option_1 + question.votes_option_2
            } else if winning_option == 1 {
                question.votes_option_1
            } else {
                question.votes_option_2
            };
    
            question.claimed_weight = 0;
            question.claimed_voters_count = 0;
            question.claimed_remainder_count = 0;
            question.total_distributed = 0;
            question.reward_fee_taken = true;
    
            msg!(
                "Snapshot taken. Total weight: {}",
                question.snapshot_total_weight
            );
        }
    
        let voter_weight = voter_record.vote_weight;
    
        let total_snapshot_reward = question.snapshot_reward;
        let total_weight = question.snapshot_total_weight;
    
        require!(total_weight > 0, VotingError::NoEligibleVoters);
    
        let is_last_claimer = question.claimed_weight + voter_weight == total_weight;
    
        let base_share = (total_snapshot_reward * voter_weight) / total_weight;
    
        let mut voter_share = base_share;
        
        let available = vault_balance.saturating_sub(min_balance);
        if is_last_claimer {
            let remaining = total_snapshot_reward.saturating_sub(question.total_distributed);
            voter_share = remaining.min(available);
        } else {
            require!(
                question.total_distributed + voter_share <= total_snapshot_reward,
                VotingError::InsufficientFunds
            );
            voter_share = voter_share.min(available);
        }
    
        question.total_distributed += voter_share;
        question.claimed_weight += voter_weight;
        question.claimed_voters_count += 1;
        question.voter_records_closed += 1;
    
        voter_record.claimed = true;
    
        **vault_info.try_borrow_mut_lamports()? -= voter_share;
        **voter_info.try_borrow_mut_lamports()? += voter_share;
    
        let tx_id_bytes = tx_id.as_bytes();
        let len = tx_id_bytes.len().min(64);
        voter_record.claim_tx_id[..len].copy_from_slice(&tx_id_bytes[..len]);
        for i in len..64 {
            voter_record.claim_tx_id[i] = 0;
        }

        if let Some(voter) = ctx.accounts.voter_list.voters.iter_mut().find(|v| v.address == *voter_info.key) {
            // Update total earnings
            voter.total_earnings = voter
                .total_earnings
                .checked_add(voter_share)
                .ok_or(VotingError::Overflow)?;
        
            // Only increment correct vote count if not a tie and voter picked the winning option
            if !is_tie && voter_record.selected_option == winning_option {
                voter.total_correct_votes += 1;
            }
        
        }        
    
        Ok(())
    }      

    pub fn drain_unclaimed_reward(ctx: Context<DrainUnclaimedReward>) -> Result<()> {
        let question = &ctx.accounts.question;
        let vault = &ctx.accounts.vault;
        let fee_receiver = &ctx.accounts.fee_receiver;
    
        let now = Clock::get()?.unix_timestamp;
    
        // Allow draining if commit phase ended and no commits
        let can_drain_due_to_no_commit = now >= question.commit_end_time && question.committed_voters == 0;
    
        // Or if reveal phase ended and no one revealed
        let no_votes_revealed = question.votes_option_1 == 0 && question.votes_option_2 == 0;
        let can_drain_due_to_no_reveal = now >= question.reveal_end_time && no_votes_revealed;
    
        require!(
            can_drain_due_to_no_commit || can_drain_due_to_no_reveal,
            VotingError::CannotDrainReward
        );
    
        let rent = Rent::get()?.minimum_balance(vault.to_account_info().data_len());
        let vault_balance = **vault.to_account_info().lamports.borrow();
        let transferable = vault_balance.saturating_sub(rent);
        require!(transferable > 0, VotingError::InsufficientFunds);
    
        **vault.to_account_info().try_borrow_mut_lamports()? -= transferable;
        **fee_receiver.to_account_info().try_borrow_mut_lamports()? += transferable;
    
        msg!(
            "Unclaimed reward of {} lamports sent to fee receiver: {}",
            transferable,
            fee_receiver.key()
        );
    
        Ok(())
    }

    pub fn reclaim_commit_or_loser_rent(ctx: Context<ReclaimCommitOrLoserRent>) -> Result<()> {
        let question = &mut ctx.accounts.question;
        let voter_record = &ctx.accounts.voter_record;

        let now = Clock::get()?.unix_timestamp;

        // Must be after reveal phase
        require!(now >= question.reveal_end_time, VotingError::RevealPhaseNotOver);

        // Must not have claimed
        require!(!voter_record.claimed, VotingError::AlreadyClaimed);

        let winning_option = question.winning_option;
        let selected_option = voter_record.selected_option;
        let revealed = voter_record.revealed;

        // Either: not revealed, or revealed but voted incorrectly or tie
        let can_reclaim = 
            !revealed ||
            winning_option == 0 || // tie case
            selected_option != winning_option;

        require!(can_reclaim, VotingError::AlreadyEligibleOrWinner);

        question.voter_records_closed += 1;

        msg!(
            "Voter {} reclaiming rent due to unrevealed or incorrect vote.",
            ctx.accounts.voter.key()
        );

        Ok(())
    }
                                           
        
}

fn calculate_reputation(revealed: u64, correct: u64) -> u8 {
    let sum = revealed + correct;

    match sum {
        0 | 1 => 1,
        2 => 2,
        3 => 3,
        4 => 4,
        5 => 5,
        6 => 6,
        7..=9 => 7,
        10..=12 => 8,
        13..=17 => 9,
        18..=25 => 10,
        26..=34 => 11,
        35..=46 => 12,
        47..=62 => 13,
        63..=87 => 14,
        88..=118 => 15,
        119..=163 => 16,
        164..=224 => 17,
        225..=308 => 18,
        _ => 19,
    }
}

#[account]
pub struct Question {
    pub id: u64,
    pub asker: Pubkey,
    pub question_key: Pubkey,
    pub vault_address: Pubkey,
    pub question_text: String,
    pub option_1: String,
    pub option_2: String,
    pub commit_end_time: i64,
    pub reveal_end_time: i64,
    pub rent_expiration: i64,
    pub votes_option_1: u64,
    pub votes_option_2: u64,
    pub finalized: bool,
    pub committed_voters: u64,
    pub eligible_voters: u64,
    pub winning_option: u8,
    pub winning_percent: f64,
    pub reward_fee_taken: bool,
    pub snapshot_reward: u64,
    pub original_reward: u64,
    pub claimed_remainder_count: u64,
    pub snapshot_total_weight: u64,
    pub total_distributed: u64,
    pub claimed_voters_count: u64,
    pub claimed_weight: u64,
    pub voter_records_count: u64,
    pub voter_records_closed: u64,
    pub revealed_correct_voters: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WinnerResult {
    pub total_votes: u64,
    pub votes_option1: u64,
    pub votes_option2: u64,
    pub winning_option: u8,
    pub winning_percent: f64,
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

    // Change vault from UncheckedAccount to Account<Vault>
    #[account(
        init,
        payer = asker,
        space = 8,  // Minimal space for Vault (only the 8-byte discriminator).
        seeds = [b"vault", question.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub asker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DrainUnclaimedReward<'info> {
    #[account(
        mut,
        seeds = [b"question", question.asker.as_ref(), &question.id.to_le_bytes()],
        bump = question.bump
    )]
    pub question: Account<'info, Question>,

    #[account(
        mut,
        seeds = [b"vault", question.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: Constant public key
    #[account(mut, address = FEE_RECEIVER_ADDRESS.parse::<Pubkey>().unwrap())]
    pub fee_receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}



// #[derive(Accounts)]
// pub struct UpdateReward<'info> {
//     #[account(mut)]
//     pub question: Account<'info, Question>,
//     /// CHECK: This account is not required to sign; its authorization is managed by the caller.
//     pub updater: UncheckedAccount<'info>,
// }


#[derive(Accounts)]
pub struct DeleteExpiredQuestion<'info> {
    #[account(
        mut,
        seeds = [b"question", asker.key().as_ref(), &question.id.to_le_bytes()],
        bump,
        close = asker
    )]
    pub question: Account<'info, Question>,

    #[account(
        mut,
        seeds = [b"vault", question.key().as_ref()],
        bump,
        close = asker
    )]
    /// CHECK: This is a PDA with no data except discriminator, verified via seeds and bump
    pub vault: Account<'info, Vault>,

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
        space = 8 + 200,
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
    pub total_earnings: u64,
    pub total_revealed_votes: u64,
    pub total_correct_votes: u64,
    pub selected_option: u8,
}


#[account]
pub struct VoterRecord {
    pub question: Pubkey,
    pub voter: Pubkey,
    pub selected_option: u8,
    pub commitment: [u8; 32],
    pub revealed: bool,
    pub claimed: bool,
    pub claim_tx_id: [u8; 64],
    pub vote_weight: u64,
}

#[derive(Accounts)]
pub struct CommitVote<'info> {
    #[account(mut)]
    pub question: Account<'info, Question>,

    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + 200,
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()],
        bump
    )]
    pub voter_record: Account<'info, VoterRecord>,

    #[account(mut)]
    pub voter_list: Account<'info, VoterList>, 

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

    #[account(mut)]
    pub voter_list: Account<'info, VoterList>,
}

#[derive(Accounts)]
pub struct FinalizeVoting<'info> {
    #[account(mut)]
    pub question: Account<'info, Question>,
}


#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(mut, has_one = voter, close = voter)]
    pub voter_record: Account<'info, VoterRecord>,
    #[account(
        mut,
        seeds = [b"question", question.asker.as_ref(), &question.id.to_le_bytes()],
        bump = question.bump,
    )]
    pub question: Account<'info, Question>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"voter_list"],
        bump
    )]
    pub voter_list: Account<'info, VoterList>,
    /// CHECK: This is a fixed known address for the fee receiver, no need for ownership verification.
    #[account(mut, address = FEE_RECEIVER_ADDRESS.parse::<Pubkey>().unwrap())]
    pub fee_receiver: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}



#[derive(Accounts)]
pub struct HelloWorld<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReclaimCommitOrLoserRent<'info> {
    #[account(
        mut,
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()],
        bump,
        close = voter
    )]
    pub voter_record: Account<'info, VoterRecord>,

    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"question", question.asker.as_ref(), &question.id.to_le_bytes()],
        bump = question.bump
    )]
    pub question: Account<'info, Question>,
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
    #[msg("Rent period has not expired or votes have been committed.")]
    RentNotExpiredOrVotesExist,
    #[msg("Invalid timeframe.")]
    InvalidTimeframe,
    #[msg("Commit phase ended.")]
    CommitPhaseEnded,
    #[msg("Reveal phase ended.")]
    RevealPhaseEnded,
    #[msg("Voting is not finalize yet.")]
    VotingNotFinalized,
    #[msg("You're not eligible")]
    NotEligible,
    #[msg("Already claimed.")]
    AlreadyClaimed,
    #[msg("No eligible voters.")]
    NoEligibleVoters,
    #[msg("Invalid vault account")]
    InvalidVaultAccount,
    #[msg("Insufficient funds.")]
    InsufficientFunds,
    #[msg("Overflow")]
    Overflow,
    #[msg("Winning votes do not meet the required 51% majority.")]
    InsufficientMajority,
    #[msg("Question ID mismatch.")]
    QuestionIdMismatch,
    #[msg("Not a part of the voters list.")]
    NotPartOfVoterList,
    #[msg("Remaining reward exists, cannot delete.")]
    RemainingRewardExists,
    #[msg("Question must be at least 10 characters long.")]
    QuestionTooShort,
    #[msg("Reward must be at least 0.05 SOL.")]
    RewardTooSmall,
    #[msg("Reveal phase is not yet over.")]
    RevealPhaseNotOver,
    #[msg("Cannot drain: commits or reveals exist or phases not ended.")]
    CannotDrainReward,
    #[msg("Cannot delete: question still has active or unclaimed participation.")]
    CannotDeleteQuestion,
    #[msg("Rent has not yet expired.")]
    RentNotExpired,
    #[msg("You were a winner or already eligible for reward.")]
    AlreadyEligibleOrWinner,
}


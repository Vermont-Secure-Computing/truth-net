use anchor_lang::{prelude::*, solana_program::clock::Clock};
use anchor_lang::solana_program::keccak::hashv;
use anchor_lang::solana_program::{system_instruction, program::invoke};
use anchor_lang::solana_program::rent::Rent;
use anchor_lang::AccountDeserialize;

pub const FEE_RECEIVER_PUBKEY: Pubkey = Pubkey::new_from_array([
    2, 236, 12, 165, 146, 38, 247, 217,
    125, 178, 209, 199, 181, 40, 192, 253,
    47, 12, 147, 34, 41, 1, 63, 2,
    102, 250, 134, 97, 98, 61, 247, 241
]);


// IMPORTANT: this is the OLD immutable program ID. Before the new deployment,
// replace/sync this with the NEW program keypair's public key.
declare_id!("jQkyaTq7X9YphoWizETjJf1c1mAZzQPV5iR7afHk5s1");

/// Unclaimed finalized rewards may be swept after 30 days.
pub const CLAIM_EXPIRY_SECS: i64 = 30 * 24 * 60 * 60;


/// An empty account for the vault.
/// This account will only hold lamports and no other data.
#[account]
pub struct Vault {}


#[program]
pub mod truth_network {
    use super::*;

    pub fn join_network(ctx: Context<JoinNetwork>) -> Result<()> {
        let user_record = &mut ctx.accounts.user_record;
        let membership_record = &mut ctx.accounts.membership_record;
        let user = &ctx.accounts.user;
        let global_state = &mut ctx.accounts.global_state;

        require!(
            user_record.user == Pubkey::default(),
            VotingError::AlreadyJoined
        );

        // First-ever join: consume one of the 33 bootstrap slots, or require an invite.
        // Re-joining after a voluntary leave does not consume another bootstrap slot.
        if !membership_record.ever_joined {
            if global_state.truth_provider_count < 33 {
                global_state.truth_provider_count = global_state
                    .truth_provider_count
                    .checked_add(1)
                    .ok_or(VotingError::Overflow)?;
                msg!("User joined as initial truth provider: {}", user.key());
            } else {
                let invite_info = ctx
                    .accounts
                    .invite
                    .as_ref()
                    .ok_or(VotingError::NotInvited)?;

                require_keys_eq!(
                    *invite_info.owner,
                    *ctx.program_id,
                    VotingError::InvalidInviter
                );

                let (expected_pda, _) = Pubkey::find_program_address(
                    &[b"invite", user.key().as_ref()],
                    ctx.program_id,
                );

                require_keys_eq!(
                    invite_info.key(),
                    expected_pda,
                    VotingError::InvalidInviter
                );

                let invite = Invite::try_deserialize(
                    &mut &invite_info.data.borrow()[..]
                )?;

                require_keys_eq!(
                    invite.invitee,
                    user.key(),
                    VotingError::InvalidInvitee
                );

                msg!(
                    "User {} joined via invitation from {}",
                    user.key(),
                    invite.inviter
                );
            }

            membership_record.user = user.key();
            membership_record.ever_joined = true;
        } else {
            require_keys_eq!(
                membership_record.user,
                user.key(),
                VotingError::NotEligible
            );
            msg!("Returning member rejoined: {}", user.key());
        }

        user_record.user = user.key();
        user_record.reputation = 0;
        user_record.total_earnings = 0;
        user_record.total_revealed_votes = 0;
        user_record.total_correct_votes = 0;
        user_record.invite_tokens = 0;
        user_record.invite_correct_votes = 0;
        user_record.created_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    pub fn leave_network(ctx: Context<LeaveNetwork>) -> Result<()> {
        msg!(
            "UserRecord closed successfully. Goodbye, {}!",
            ctx.accounts.user.key()
        );
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

        // Maximum length check for question text
        require!(
            question_text.len() <= 150,
            VotingError::QuestionTooLong
        );
        
        // Ensure commit and reveal times are valid.
        let now = Clock::get()?.unix_timestamp;
        require!(now < commit_end_time, VotingError::VotingEnded);
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
        question.created_at = now;
        question.commit_end_time = commit_end_time;
        question.reveal_end_time = reveal_end_time;
        question.votes_option_1 = 0;
        question.votes_option_2 = 0;
        question.finalized = false;
        question.committed_voters = 0;
        question.question_key = question_key;
        question.winning_option = 255;
        // For clarity, store the vault address in a dedicated field.
        question.vault_address = ctx.accounts.vault.key();
        question.reward_fee_taken = false;
        question.snapshot_reward = 0;
        question.original_reward = 0;
        question.claimed_remainder_count = 0;
        question.snapshot_total_weight = 0;
        question.total_distributed = 0;
        question.claimed_voters_count = 0;
        question.claimed_weight = 0;
        question.voter_records_count = 0;
        question.voter_records_closed = 0;
        question.revealed_voters_count = 0;
        question.eligible_voters = 0;
        question.winning_percent = 0.0;
        question.reward_drained = false;
        question.action_in_progress = false;
        
        // Derive the bump for the question PDA.
        let (_derived_pubkey, bump) = Pubkey::find_program_address(
            &[b"question", ctx.accounts.asker.key.as_ref(), &question_counter.count.to_le_bytes()],
            ctx.program_id,
        );
        question.bump = bump;
        
        question_counter.count = question_counter
            .count
            .checked_add(1)
            .ok_or(VotingError::Overflow)?;
        
        msg!("Question Created: {}", question.id);
        msg!("Vault PDA: {}", ctx.accounts.vault.key());
        Ok(())
    }
    
                        

    pub fn delete_expired_question(ctx: Context<DeleteExpiredQuestion>) -> Result<()> {
        let question = &ctx.accounts.question;
        let now = Clock::get()?.unix_timestamp;

        let no_one_committed =
            question.committed_voters == 0 && now >= question.commit_end_time;

        let reveal_over = now >= question.reveal_end_time;
        let no_votes_revealed =
            question.votes_option_1 == 0 && question.votes_option_2 == 0;

        let rewards_fully_distributed =
            question.reward_fee_taken &&
            question.total_distributed >= question.snapshot_reward;

        let reward_settled =
            question.reward_drained || rewards_fully_distributed;

        let all_records_closed =
            question.voter_records_closed == question.voter_records_count;

        let no_participation_case =
            (no_one_committed || (reveal_over && no_votes_revealed)) &&
            question.reward_drained &&
            all_records_closed;

        let normal_settled_case =
            reveal_over && reward_settled && all_records_closed;

        require!(
            no_participation_case || normal_settled_case,
            VotingError::CannotDeleteQuestion
        );

        // Do not use the raw vault balance as the settlement invariant. Anyone can
        // dust a public address. Anchor's `close = asker` will return all remaining
        // lamports (including unsolicited dust) to the asker.
        msg!(
            "Question deleted. Remaining account lamports refunded to {}",
            ctx.accounts.asker.key()
        );

        Ok(())
    }

    pub fn finalize_voting(
        ctx: Context<FinalizeVoting>,
        question_id: u64,
    ) -> Result<()> {
        let question = &mut ctx.accounts.question;
    
        require!(
            question.id == question_id,
            VotingError::QuestionIdMismatch
        );
    
        if question.finalized {
            require!(
                question.winning_option != 255,
                VotingError::VotingNotFinalized
            );
        
            msg!(
                "Voting already finalized. Winning option: {}",
                question.winning_option
            );
        
            return Ok(());
        }
    
        ensure_question_finalized(question)?;
    
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

    pub fn commit_vote(ctx: Context<CommitVote>, commitment: [u8; 32]) -> Result<()> {
        let question = &mut ctx.accounts.question;
        let voter_record = &mut ctx.accounts.voter_record;
        let now = Clock::get()?.unix_timestamp;

        require!(
            !question.finalized,
            VotingError::AlreadyFinalized
        );

        require!(
            now < question.commit_end_time,
            VotingError::CommitPhaseEnded
        );

        require!(
            commitment != [0u8; 32],
            VotingError::InvalidReveal
        );

        require!(
            voter_record.voter == Pubkey::default()
                || voter_record.voter == ctx.accounts.voter.key(),
            VotingError::InvalidVoterRecord
        );
    
        require!(
            voter_record.question == Pubkey::default()
                || voter_record.question == question.key(),
            VotingError::InvalidVoterRecord
        );

        require!(
            voter_record.commitment == [0u8; 32],
            VotingError::AlreadyVoted
        );

        require_keys_eq!(
            ctx.accounts.user_record.user,
            ctx.accounts.voter.key(),
            VotingError::NotEligible
        );

        voter_record.commitment = commitment;
        voter_record.voter = ctx.accounts.voter.key();
        voter_record.question = question.key();
        voter_record.user_record_join_time = now;

        question.committed_voters = question
            .committed_voters
            .checked_add(1)
            .ok_or(VotingError::Overflow)?;

        question.voter_records_count = question
            .voter_records_count
            .checked_add(1)
            .ok_or(VotingError::Overflow)?;

        msg!("Vote committed by {}", voter_record.voter);
        Ok(())
    }

    pub fn reveal_vote(ctx: Context<RevealVote>, password: String) -> Result<()> {
        let question = &mut ctx.accounts.question;
        let voter_record = &mut ctx.accounts.voter_record;
        let user_record = &mut ctx.accounts.user_record;
        let now = Clock::get()?.unix_timestamp;

        require!(
            now >= question.commit_end_time,
            VotingError::CommitPhaseStillActive
        );

        require!(
            now < question.reveal_end_time,
            VotingError::RevealPhaseEnded
        );

        require!(
            !question.finalized,
            VotingError::AlreadyFinalized
        );

        require_keys_eq!(
            voter_record.question,
            question.key(),
            VotingError::QuestionIdMismatch
        );

        require_keys_eq!(
            voter_record.voter,
            ctx.accounts.voter.key(),
            VotingError::NotEligible
        );

        require_keys_eq!(
            user_record.user,
            ctx.accounts.voter.key(),
            VotingError::NotEligible
        );

        require!(
            voter_record.commitment != [0u8; 32],
            VotingError::InvalidReveal
        );

        require!(
            user_record.created_at <= voter_record.user_record_join_time,
            VotingError::RejoinedAfterCommit
        );

        require!(
            !voter_record.revealed,
            VotingError::AlreadyRevealed
        );

        let mut valid_vote: Option<u8> = None;
        let question_key = question.key();
        let voter_key = ctx.accounts.voter.key();

        for vote in 1..=2 {
            let vote_byte = [vote];

            // Vote hash pda
            let computed_hash = hashv(&[
                b"truth-vote-v1",
                question_key.as_ref(),
                voter_key.as_ref(),
                &vote_byte,
                password.as_bytes(),
            ]);

            if computed_hash.0 == voter_record.commitment {
                valid_vote = Some(vote);
                break;
            }
        }

        let vote = valid_vote.ok_or(VotingError::InvalidReveal)?;
        let vote_weight = if user_record.reputation == 0 {
            1
        } else {
            user_record.reputation as u64
        };

        voter_record.revealed = true;
        voter_record.selected_option = vote;
        voter_record.vote_weight = vote_weight;

        if vote == 1 {
            question.votes_option_1 = question
                .votes_option_1
                .checked_add(vote_weight)
                .ok_or(VotingError::Overflow)?;
        } else {
            question.votes_option_2 = question
                .votes_option_2
                .checked_add(vote_weight)
                .ok_or(VotingError::Overflow)?;
        }

        question.revealed_voters_count = question
            .revealed_voters_count
            .checked_add(1)
            .ok_or(VotingError::Overflow)?;

        msg!("Vote Revealed Successfully! Option {}", vote);
        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>, tx_id: String) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let voter_key = ctx.accounts.voter.key();
        let question_key = ctx.accounts.question.key();
        let vault_key = ctx.accounts.vault.key();

        let voter_record = &mut ctx.accounts.voter_record;
        let question = &mut ctx.accounts.question;
        let user_record = &mut ctx.accounts.user_record;

        require!(
            now >= question.reveal_end_time,
            VotingError::VotingStillActive
        );
        
        ensure_question_finalized(question)?;
        
        require!(
            question.winning_option != 255,
            VotingError::VotingNotFinalized
        );

        require!(
            !question.reward_drained,
            VotingError::AlreadyDrained
        );

        require!(
            !voter_record.claimed,
            VotingError::AlreadyClaimed
        );

        require!(
            voter_record.revealed,
            VotingError::NotEligible
        );

        require_keys_eq!(
            voter_record.question,
            question_key,
            VotingError::QuestionIdMismatch
        );

        require_keys_eq!(
            voter_record.voter,
            voter_key,
            VotingError::NotEligible
        );

        require_keys_eq!(
            user_record.user,
            voter_key,
            VotingError::NotEligible
        );

        require_keys_eq!(
            question.vault_address,
            vault_key,
            VotingError::InvalidVaultAccount
        );

        let winning_option = question.winning_option;
        let is_tie = winning_option == 0;

        if !is_tie {
            require!(
                winning_option == 1 || winning_option == 2,
                VotingError::InvalidWinningOption
            );

            require!(
                voter_record.selected_option == winning_option,
                VotingError::NotEligible
            );
        }

        let vault_info = ctx.accounts.vault.to_account_info();
        let voter_info = ctx.accounts.voter.to_account_info();
        let fee_receiver_info = ctx.accounts.fee_receiver.to_account_info();

        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(vault_info.data_len());

        if !question.reward_fee_taken {
            let vault_balance = **vault_info.lamports.borrow();
            let available_reward = vault_balance
                .checked_sub(min_balance)
                .ok_or(VotingError::InsufficientFunds)?;

            require!(
                available_reward > 0,
                VotingError::InsufficientFunds
            );

            let fee = available_reward
                .checked_mul(2)
                .ok_or(VotingError::Overflow)?
                .checked_div(100)
                .ok_or(VotingError::Overflow)?;

            let snapshot = available_reward
                .checked_sub(fee)
                .ok_or(VotingError::Overflow)?;

            let snapshot_total_weight = if is_tie {
                question.votes_option_1
                    .checked_add(question.votes_option_2)
                    .ok_or(VotingError::Overflow)?
            } else if winning_option == 1 {
                question.votes_option_1
            } else {
                question.votes_option_2
            };

            require!(
                snapshot_total_weight > 0,
                VotingError::NoEligibleVoters
            );

            **vault_info.try_borrow_mut_lamports()? = vault_info
                .lamports()
                .checked_sub(fee)
                .ok_or(VotingError::InsufficientFunds)?;

            **fee_receiver_info.try_borrow_mut_lamports()? = fee_receiver_info
                .lamports()
                .checked_add(fee)
                .ok_or(VotingError::Overflow)?;

            question.original_reward = available_reward;
            question.snapshot_reward = snapshot;
            question.snapshot_total_weight = snapshot_total_weight;
            question.claimed_weight = 0;
            question.claimed_voters_count = 0;
            question.claimed_remainder_count = 0;
            question.total_distributed = 0;
            question.reward_fee_taken = true;

            msg!(
                "Reward snapshot initialized. Total weight: {}",
                snapshot_total_weight
            );
        }

        let voter_weight = voter_record.vote_weight;
        require!(voter_weight > 0, VotingError::NotEligible);

        let total_weight = question.snapshot_total_weight;
        require!(total_weight > 0, VotingError::NoEligibleVoters);

        let new_claimed_weight = question
            .claimed_weight
            .checked_add(voter_weight)
            .ok_or(VotingError::Overflow)?;

        require!(
            new_claimed_weight <= total_weight,
            VotingError::InvalidClaimWeight
        );

        let total_snapshot_reward = question.snapshot_reward;

        let base_share_u128 = (total_snapshot_reward as u128)
            .checked_mul(voter_weight as u128)
            .ok_or(VotingError::Overflow)?
            .checked_div(total_weight as u128)
            .ok_or(VotingError::Overflow)?;

        let base_share = u64::try_from(base_share_u128)
            .map_err(|_| VotingError::Overflow)?;

        let is_last_claimer = new_claimed_weight == total_weight;
        let current_vault_balance = **vault_info.lamports.borrow();
        let available = current_vault_balance.saturating_sub(min_balance);

        let voter_share = if is_last_claimer {
            let remaining = total_snapshot_reward
                .checked_sub(question.total_distributed)
                .ok_or(VotingError::Overflow)?;
            remaining.min(available)
        } else {
            let projected_distribution = question
                .total_distributed
                .checked_add(base_share)
                .ok_or(VotingError::Overflow)?;

            require!(
                projected_distribution <= total_snapshot_reward,
                VotingError::InsufficientFunds
            );

            base_share.min(available)
        };

        require!(voter_share > 0, VotingError::InsufficientFunds);

        voter_record.claimed = true;

        question.total_distributed = question
            .total_distributed
            .checked_add(voter_share)
            .ok_or(VotingError::Overflow)?;

        question.claimed_weight = new_claimed_weight;
        question.claimed_voters_count = question
            .claimed_voters_count
            .checked_add(1)
            .ok_or(VotingError::Overflow)?;

        question.voter_records_closed = question
            .voter_records_closed
            .checked_add(1)
            .ok_or(VotingError::Overflow)?;

        **vault_info.try_borrow_mut_lamports()? = vault_info
            .lamports()
            .checked_sub(voter_share)
            .ok_or(VotingError::InsufficientFunds)?;

        **voter_info.try_borrow_mut_lamports()? = voter_info
            .lamports()
            .checked_add(voter_share)
            .ok_or(VotingError::Overflow)?;

        // Caller-provided reference only. Do not treat this as an authenticated
        // Solana transaction signature.
        let tx_id_bytes = tx_id.as_bytes();
        let len = tx_id_bytes.len().min(64);
        voter_record.claim_tx_id = [0u8; 64];
        voter_record.claim_tx_id[..len]
            .copy_from_slice(&tx_id_bytes[..len]);

        user_record.total_earnings = user_record
            .total_earnings
            .checked_add(voter_share)
            .ok_or(VotingError::Overflow)?;

        if !is_tie && voter_record.selected_option == winning_option {
            const MIN_VOTERS: u64 = 3;
            const MIN_DURATION_SECS: i64 = 86_400;
        
            let event_duration = question
                .reveal_end_time
                .checked_sub(question.created_at)
                .ok_or(VotingError::Overflow)?;
        
            let meets_conditions =
                question.revealed_voters_count >= MIN_VOTERS &&
                event_duration >= MIN_DURATION_SECS;
        
            if meets_conditions {
                // Equivalent on reveal_vote
                user_record.total_revealed_votes = user_record
                    .total_revealed_votes
                    .checked_add(1)
                    .ok_or(VotingError::Overflow)?;
        
                // Correct vote if voter is a winner
                user_record.total_correct_votes = user_record
                    .total_correct_votes
                    .checked_add(1)
                    .ok_or(VotingError::Overflow)?;
        
                user_record.reputation = calculate_reputation(
                    user_record.total_revealed_votes,
                    user_record.total_correct_votes,
                );
        
                user_record.invite_correct_votes = user_record
                    .invite_correct_votes
                    .checked_add(1)
                    .ok_or(VotingError::Overflow)?;
        
                if user_record.invite_correct_votes >= 3 &&
                    user_record.invite_tokens == 0
                {
                    user_record.invite_tokens = 1;
                    user_record.invite_correct_votes = 0;
                    msg!("User earned a new invite token.");
                }
        
                msg!(
                    "Qualifying vote counted. New reputation: {}",
                    user_record.reputation
                );
            } else {
                msg!("Vote did not qualify for reputation.");
            }
        }

        msg!(
            "Reward claimed successfully! Earned: {} lamports",
            voter_share
        );

        Ok(())
    }

    pub fn drain_unclaimed_reward(ctx: Context<DrainUnclaimedReward>) -> Result<()> {
        let question = &mut ctx.accounts.question;
        let vault = &ctx.accounts.vault;
        let fee_receiver = &ctx.accounts.fee_receiver;

        require!(
            !question.reward_drained,
            VotingError::AlreadyDrained
        );

        require_keys_eq!(
            question.vault_address,
            vault.key(),
            VotingError::InvalidVaultAccount
        );

        let now = Clock::get()?.unix_timestamp;

        let no_commit =
            now >= question.commit_end_time &&
            question.committed_voters == 0;

            let no_votes_revealed =
            question.votes_option_1 == 0 &&
            question.votes_option_2 == 0;
        
        let reveal_over =
            now >= question.reveal_end_time;
        
        let no_reveal =
            reveal_over && no_votes_revealed;
        
        // If there were revealed votes but nobody ever claimed/reclaimed/finalized,
        // allow the expiry path to finalize the immutable result first.
        if reveal_over &&
            !no_votes_revealed &&
            !question.finalized
        {
            ensure_question_finalized(question)?;
        }
        
        let claim_expired =
            question.finalized &&
            now >= question
                .reveal_end_time
                .saturating_add(CLAIM_EXPIRY_SECS);

        require!(
            no_commit || no_reveal || claim_expired,
            VotingError::CannotDrainReward
        );

        let rent = Rent::get()?
            .minimum_balance(vault.to_account_info().data_len());
        let vault_balance = **vault.to_account_info().lamports.borrow();
        let transferable = vault_balance.saturating_sub(rent);

        require!(
            transferable > 0,
            VotingError::InsufficientFunds
        );

        **vault.to_account_info().try_borrow_mut_lamports()? -= transferable;
        **fee_receiver.to_account_info().try_borrow_mut_lamports()? += transferable;

        question.reward_drained = true;

        msg!(
            "Remaining reward of {} lamports drained.",
            transferable
        );

        Ok(())
    }

    pub fn reclaim_commit_or_loser_rent(
        ctx: Context<ReclaimCommitOrLoserRent>
    ) -> Result<()> {
        let question = &mut ctx.accounts.question;
        let voter_record = &ctx.accounts.voter_record;
        let user_record = &mut ctx.accounts.user_record;
        let now = Clock::get()?.unix_timestamp;
    
        require!(
            now >= question.reveal_end_time,
            VotingError::RevealPhaseNotOver
        );
    
        ensure_question_finalized(question)?;
    
        require!(
            !voter_record.claimed,
            VotingError::AlreadyClaimed
        );
    
        require_keys_eq!(
            voter_record.question,
            question.key(),
            VotingError::QuestionIdMismatch
        );
    
        require_keys_eq!(
            voter_record.voter,
            ctx.accounts.voter.key(),
            VotingError::NotEligible
        );
    
        require_keys_eq!(
            user_record.user,
            ctx.accounts.voter.key(),
            VotingError::NotEligible
        );
    
        let can_reclaim = if !voter_record.revealed {
            // Nag-commit pero hindi nag-reveal.
            true
        } else if question.winning_option == 0 {
            // Tie: revealed voters are reward-eligible.
            false
        } else {
            // Revealed pero natalo.
            voter_record.selected_option != question.winning_option
        };
    
        require!(
            can_reclaim,
            VotingError::AlreadyEligibleOrWinner
        );
    
        // Reputation is only affected by a properly revealed vote.
        // Non-revealers reclaim rent but get no reputation change.
        if voter_record.revealed {
            const MIN_VOTERS: u64 = 3;
            const MIN_DURATION_SECS: i64 = 86_400;
    
            let event_duration = question
                .reveal_end_time
                .checked_sub(question.created_at)
                .ok_or(VotingError::Overflow)?;
    
            let meets_conditions =
                question.revealed_voters_count >= MIN_VOTERS &&
                event_duration >= MIN_DURATION_SECS;
    
            if meets_conditions {
                // Count the qualifying revealed vote.
                // Do NOT increment total_correct_votes because this voter lost.
                user_record.total_revealed_votes = user_record
                    .total_revealed_votes
                    .checked_add(1)
                    .ok_or(VotingError::Overflow)?;
    
                user_record.reputation = calculate_reputation(
                    user_record.total_revealed_votes,
                    user_record.total_correct_votes,
                );
    
                msg!(
                    "Qualifying losing vote counted. New reputation: {}",
                    user_record.reputation
                );
            } else {
                msg!(
                    "Losing vote did not qualify for reputation."
                );
            }
        }
    
        question.voter_records_closed = question
            .voter_records_closed
            .checked_add(1)
            .ok_or(VotingError::Overflow)?;
    
        msg!(
            "Voter {} reclaiming rent.",
            ctx.accounts.voter.key()
        );
    
        Ok(())
    }

    pub fn cleanup_expired_voter_record(
        ctx: Context<CleanupExpiredVoterRecord>,
        voter_key: Pubkey,
    ) -> Result<()> {
        let question = &mut ctx.accounts.question;
        let voter_record = &ctx.accounts.voter_record;
        let now = Clock::get()?.unix_timestamp;

        require_keys_eq!(
            ctx.accounts.voter.key(),
            voter_key,
            VotingError::NotEligible
        );

        require!(
            now >= question.reveal_end_time,
            VotingError::RevealPhaseNotOver
        );

        ensure_question_finalized(question)?;

        require!(
            !voter_record.claimed,
            VotingError::AlreadyClaimed
        );

        require_keys_eq!(
            voter_record.voter,
            voter_key,
            VotingError::NotEligible
        );

        let immediate_cleanup_allowed = if !voter_record.revealed {
            true
        } else if question.winning_option == 0 {
            false
        } else {
            voter_record.selected_option != question.winning_option
        };

        let claim_window_expired = now >= question
            .reveal_end_time
            .saturating_add(CLAIM_EXPIRY_SECS);

        require!(
            immediate_cleanup_allowed || claim_window_expired,
            VotingError::ClaimWindowStillActive
        );

        question.voter_records_closed = question
            .voter_records_closed
            .checked_add(1)
            .ok_or(VotingError::Overflow)?;

        msg!(
            "Expired voter record cleaned up. Rent returned to {}",
            ctx.accounts.voter.key()
        );

        Ok(())
    }

    pub fn nominate_invitee(ctx: Context<NominateInvitee>, nominee: Pubkey) -> Result<()> {
        let invite = &mut ctx.accounts.invite;
        let user_record = &mut ctx.accounts.user_record;
        let inviter = ctx.accounts.inviter.key();
    
        // Verify that inviter owns this user record
        require!(user_record.user == inviter, VotingError::NotEligible);
        require!(user_record.invite_tokens > 0, VotingError::NoInviteTokens);
    
        // Ensure nominee is not the default Pubkey
        require!(nominee != Pubkey::default(), VotingError::InvalidInvitee);
    
        // Ensure nominee is not the inviter themselves
        require!(nominee != inviter, VotingError::InvalidInvitee);
    
        // Set invite data
        invite.invitee = nominee;
        invite.inviter = inviter;
        invite.created_at = Clock::get()?.unix_timestamp;
    
        // Decrement inviter's tokens
        user_record.invite_tokens = user_record
            .invite_tokens
            .checked_sub(1)
            .ok_or(VotingError::NoInviteTokens)?;
    
        msg!("Invite created for {}", nominee);
    
        Ok(())
    }
    
    
    
    
    pub fn initialize_global_state(ctx: Context<InitializeGlobalState>) -> Result<()> {
        ctx.accounts.global_state.truth_provider_count = 0;
        Ok(())
    }

    pub fn delete_invite(ctx: Context<DeleteInvite>) -> Result<()> {
        msg!(
            "Invite closed by inviter {} for invitee {}",
            ctx.accounts.inviter.key(),
            ctx.accounts.invite.invitee
        );
        Ok(())
    }
    
     
}

fn ensure_question_finalized(
    question: &mut Account<'_, Question>,
) -> Result<()> {
    // Already finalized = nothing else to do.
    if question.finalized {
        return Ok(());
    }

    let now = Clock::get()?.unix_timestamp;

    // Result must never be determined while reveals are still allowed.
    require!(
        now >= question.reveal_end_time,
        VotingError::VotingStillActive
    );

    let total_votes = question
        .votes_option_1
        .checked_add(question.votes_option_2)
        .ok_or(VotingError::Overflow)?;

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

    let (winning_option, winning_percent) =
        if total_votes == 0 {
            (0, 0.0)
        } else if question.votes_option_1 == question.votes_option_2 {
            (0, 50.0)
        } else if question.votes_option_1 > question.votes_option_2 {
            (1, option1_percent)
        } else {
            (2, option2_percent)
        };

    question.eligible_voters = match winning_option {
        0 => total_votes,
        1 => question.votes_option_1,
        2 => question.votes_option_2,
        _ => 0,
    };

    question.winning_option = winning_option;
    question.winning_percent = winning_percent;
    question.finalized = true;

    msg!(
        "Voting finalized. Total votes: {}. Option 1: {}. Option 2: {}. Winning option: {} with {:.2}%",
        total_votes,
        question.votes_option_1,
        question.votes_option_2,
        winning_option,
        winning_percent
    );

    Ok(())
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
    pub created_at: i64,
    pub commit_end_time: i64,
    pub reveal_end_time: i64,
    pub votes_option_1: u64,
    pub votes_option_2: u64,
    pub finalized: bool,
    pub committed_voters: u64,
    pub revealed_voters_count: u64,
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
    pub reward_drained: bool,
    pub action_in_progress: bool,
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
        space = 450,
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
        bump,
        constraint = question.vault_address == vault.key() @ VotingError::InvalidVaultAccount
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: Constant public key
    #[account(mut, address = FEE_RECEIVER_PUBKEY)]
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
        constraint = question.vault_address == vault.key() @ VotingError::InvalidVaultAccount,
        close = asker
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub asker: Signer<'info>,

    pub system_program: Program<'info, System>,
}



#[derive(Accounts)]
pub struct JoinNetwork<'info> {
    #[account(
        mut,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        init,
        payer = user,
        space = 8 + 80,
        seeds = [b"user_record", user.key().as_ref()],
        bump
    )]
    pub user_record: Account<'info, UserRecord>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 1,
        seeds = [b"membership", user.key().as_ref()],
        bump
    )]
    pub membership_record: Account<'info, MembershipRecord>,

    /// CHECK: Optional invite. Owner, PDA and invitee are validated in join_network.
    pub invite: Option<AccountInfo<'info>>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct LeaveNetwork<'info> {
    
    #[account(
        mut,
        seeds = [b"user_record", user.key().as_ref()],
        bump,
        close = user
    )]
    pub user_record: Account<'info, UserRecord>,

    #[account(mut, signer)]
    pub user: Signer<'info>,

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


#[account]
pub struct UserRecord {
   pub user: Pubkey,
   pub reputation: u8,
   pub total_earnings: u64,
   pub total_revealed_votes: u64,
   pub total_correct_votes: u64,
   pub invite_correct_votes: u64,
   pub invite_tokens: u8,
   pub created_at: i64,
}


#[account]
pub struct MembershipRecord {
    pub user: Pubkey,
    pub ever_joined: bool,
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
    pub user_record_join_time: i64,
}

#[derive(Accounts)]
pub struct CommitVote<'info> {
    #[account(
        mut,
        seeds = [b"question", question.asker.as_ref(), &question.id.to_le_bytes()],
        bump = question.bump
    )]
    pub question: Account<'info, Question>,

    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + 200,
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()],
        bump
    )]
    pub voter_record: Account<'info, VoterRecord>,

    #[account(
        seeds = [b"user_record", voter.key().as_ref()],
        bump,
        constraint = user_record.user == voter.key() @ VotingError::NotEligible
    )]
    pub user_record: Account<'info, UserRecord>,

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct RevealVote<'info> {
    #[account(
        mut,
        seeds = [b"question", question.asker.as_ref(), &question.id.to_le_bytes()],
        bump = question.bump
    )]
    pub question: Account<'info, Question>,

    #[account(
        mut,
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()],
        bump,
        constraint = voter_record.voter == voter.key() @ VotingError::NotEligible,
        constraint = voter_record.question == question.key() @ VotingError::QuestionIdMismatch
    )]
    pub voter_record: Account<'info, VoterRecord>,

    #[account(
        mut,
        seeds = [b"user_record", voter.key().as_ref()],
        bump,
        constraint = user_record.user == voter.key() @ VotingError::NotEligible
    )]
    pub user_record: Account<'info, UserRecord>,

    #[account(mut)]
    pub voter: Signer<'info>,
}


#[derive(Accounts)]
pub struct FinalizeVoting<'info> {
    #[account(
        mut,
        seeds = [b"question", question.asker.as_ref(), &question.id.to_le_bytes()],
        bump = question.bump
    )]
    pub question: Account<'info, Question>,
}


#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()],
        bump,
        constraint = voter_record.voter == voter.key() @ VotingError::NotEligible,
        constraint = voter_record.question == question.key() @ VotingError::QuestionIdMismatch,
        close = voter
    )]
    pub voter_record: Account<'info, VoterRecord>,

    #[account(
        mut,
        seeds = [b"question", question.asker.as_ref(), &question.id.to_le_bytes()],
        bump = question.bump
    )]
    pub question: Account<'info, Question>,

    #[account(
        mut,
        seeds = [b"user_record", voter.key().as_ref()],
        bump,
        constraint = user_record.user == voter.key() @ VotingError::NotEligible
    )]
    pub user_record: Account<'info, UserRecord>,

    #[account(
        mut,
        seeds = [b"vault", question.key().as_ref()],
        bump,
        constraint = question.vault_address == vault.key() @ VotingError::InvalidVaultAccount
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: Fixed known fee receiver.
    #[account(mut, address = FEE_RECEIVER_PUBKEY)]
    pub fee_receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct ReclaimCommitOrLoserRent<'info> {
    #[account(
        mut,
        seeds = [b"vote", voter.key().as_ref(), question.key().as_ref()],
        bump,
        constraint = voter_record.voter == voter.key() @ VotingError::NotEligible,
        constraint = voter_record.question == question.key() @ VotingError::QuestionIdMismatch,
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

    #[account(
        mut,
        seeds = [b"user_record", voter.key().as_ref()],
        bump,
        constraint = user_record.user == voter.key() @ VotingError::NotEligible
    )]
    pub user_record: Account<'info, UserRecord>,
}


#[derive(Accounts)]
#[instruction(voter_key: Pubkey)]
pub struct CleanupExpiredVoterRecord<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"question",
            question.asker.as_ref(),
            &question.id.to_le_bytes()
        ],
        bump = question.bump
    )]
    pub question: Account<'info, Question>,

    #[account(
        mut,
        seeds = [
            b"vote",
            voter_key.as_ref(),
            question.key().as_ref()
        ],
        bump,
        constraint = voter_record.voter == voter_key
            @ VotingError::NotEligible,
        constraint = voter_record.question == question.key()
            @ VotingError::QuestionIdMismatch,
        close = voter
    )]
    pub voter_record: Account<'info, VoterRecord>,

    /// CHECK:
    /// Verified against voter_key inside the instruction.
    #[account(mut)]
    pub voter: UncheckedAccount<'info>,
}


#[derive(Accounts)]
pub struct SnapshotWinningOption<'info> {
    #[account(
        mut,
        seeds = [b"question", question.asker.as_ref(), &question.id.to_le_bytes()],
        bump = question.bump
    )]
    pub question: Account<'info, Question>,
}

#[account]
pub struct Invite {
    pub invitee: Pubkey,
    pub inviter: Pubkey,
    pub created_at: i64,
}


#[derive(Accounts)]
#[instruction(nominee: Pubkey)]
pub struct NominateInvitee<'info> {
    #[account(
        init,
        payer = inviter,
        space = 8 + 32 + 32 + 8, // discriminator + invitee + inviter + created_at
        seeds = [b"invite", nominee.key().as_ref()],
        bump
    )]
    pub invite: Account<'info, Invite>,

    #[account(
        mut,
        seeds = [b"user_record", inviter.key().as_ref()],
        bump
    )]
    pub user_record: Account<'info, UserRecord>,

    #[account(mut, signer)]
    pub inviter: Signer<'info>,

    pub system_program: Program<'info, System>,
}



#[account]
pub struct GlobalState {
    pub truth_provider_count: u64,
}

#[derive(Accounts)]
pub struct InitializeGlobalState<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 8,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeleteInvite<'info> {
    #[account(
        mut,
        seeds = [b"invite", invite.invitee.as_ref()],
        bump,
        constraint = invite.inviter == inviter.key() @ VotingError::InvalidInviter,
        close = inviter
    )]
    pub invite: Account<'info, Invite>,

    #[account(mut)]
    pub inviter: Signer<'info>,
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
    #[msg("You have already revealed your vote.")]
    AlreadyRevealed,
    #[msg("Invalid voting reveal.")]
    InvalidReveal,
    #[msg("You have already left the network.")]
    NotJoined,
    #[msg("Rent period has not expired or votes have been committed.")]
    RentNotExpiredOrVotesExist,
    #[msg("Invalid timeframe.")]
    InvalidTimeframe,
    #[msg("Commit phase ended.")]
    CommitPhaseEnded,
    #[msg("Reveal phase ended.")]
    RevealPhaseEnded,
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
    #[msg("You were already eligible for a reward or were a winner.")]
    AlreadyEligibleOrWinner,
    #[msg("Vault is already drained.")]
    AlreadyDrained,
    #[msg("The question is too long.")]
    QuestionTooLong,
    #[msg("You rejoined after committing. You can't reveal this vote.")]
    RejoinedAfterCommit,
    #[msg("This address has already joined the network.")]
    AlreadyJoined,
    #[msg("You are not in the list of pending joiners.")]
    NotInvited,
    #[msg("Invalid invite address.")]
    InvalidInviter,
    #[msg("You have no invite tokens remaining.")]
    NoInviteTokens,
    #[msg("This address has already invited.")]
    AlreadyInvited,
    #[msg("Invite limit reached. Please wait for pending invites to be used.")]
    InviteLimitReached,
    #[msg("Another action is already in progress.")]
    ActionInProgress,
    #[msg("Invalid invitee address.")]
    InvalidInvitee,
    #[msg("Commit phase is still active.")]
    CommitPhaseStillActive,
    #[msg("Voting has not been finalized.")]
    VotingNotFinalized,
    #[msg("Invalid winning option.")]
    InvalidWinningOption,
    #[msg("Claim weight exceeds eligible total weight.")]
    InvalidClaimWeight,
    #[msg("The reward claim window is still active.")]
    ClaimWindowStillActive,
    #[msg("Voter record does not belong to this voter or question.")]
    InvalidVoterRecord,
}

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
name: "Truit.it",
project_url: "https://truth.it.com/",
contacts: "mailto:office@vtscc.org,https://vtscc.org/contact.html",
policy: "https://truth.it.com/security-policy",

// Optional Fields
preferred_languages: "en",
source_code: "https://github.com/Vermont-Secure-Computing/truth-net",
source_revision: "new-secured-deployment",
source_release: "",
encryption: "",
auditors: "vtscc.org",
acknowledgements: "Truth Network"
}
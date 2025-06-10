# truth-net
Distributed Truth Network, No Cap.
Truth-net is a simple tokenless binary oracle on the Solana network.  

Earn money as a truth provider ...  
....  or use this network to provide truth about real world events for your smart contracts.   


Truth providers:  

    Deposit 1/2 a Solana to join the network.  Your deposit is redeemable any time you choose to leave the network.  
    You can rejoin the network at any time.  This is to prevent Sybil attacks.  

    Select an event from the list in the Commit stage, and submit your vote with a password.  
    During the reveal stage, enter your password and reveal your vote to the network.  
    Collect your reward if you voted with the consensus.

    Increase your reputation by revealing votes and voting with the consensus.
    Your reputation is a multiplier which multiplies your voice and your reward.  

Smart Contract Developers:  

    Events can be added to the network any time using the front end here (by hand) or programatically (see e.g. solbetx.com).
    Rewards to the network participants for an event can be added at any time by sending solana to the event program ID.  
    

See whitepaper in repo.   

devnet.truth.it.com
truth.it.com

---

## Creating a Question (Programmatically)

You can create questions directly from a dApp or script using Anchor. Here's a full example (used in SolbetX):

```ts
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "bn.js";

// Assume truthNetworkProgram is your Anchor program instance
// Assume publicKey is the connected wallet's public key

const [questionCounterPDA] = await PublicKey.findProgramAddress(
  [Buffer.from("question_counter"), publicKey.toBuffer()],
  TRUTH_NETWORK_PROGRAM_ID
);

let questionCounter = await truthNetworkProgram.account.questionCounter
  .fetch(questionCounterPDA)
  .catch(() => null);

if (!questionCounter) {
  await truthNetworkProgram.methods
    .initializeCounter()
    .accounts({
      questionCounter: questionCounterPDA,
      asker: publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  questionCounter = await truthNetworkProgram.account.questionCounter.fetch(questionCounterPDA);
}

const questionIndex = questionCounter.count;
const questionIdBuffer = new BN(questionIndex).toArrayLike(Buffer, "le", 8);

const [questionPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("question"), publicKey.toBuffer(), questionIdBuffer],
  TRUTH_NETWORK_PROGRAM_ID
);

const commitEndTimestamp = new BN(Math.floor(new Date(commitEndTime).getTime() / 1000));
const revealEndTimestamp = new BN(Math.floor(new Date(revealEndTime).getTime() / 1000));
const rewardLamports = new BN(100_000_000); // 0.1 SOL

const [vaultPDA] = await PublicKey.findProgramAddress(
  [Buffer.from("vault"), questionPDA.toBuffer()],
  TRUTH_NETWORK_PROGRAM_ID
);

await truthNetworkProgram.methods
  .createQuestion(questionText, rewardLamports, commitEndTimestamp, revealEndTimestamp)
  .accounts({
    asker: publicKey,
    questionCounter: questionCounterPDA,
    question: questionPDA,
    vault: vaultPDA,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

console.log("Created question:", questionPDA.toBase58());
```

## Using `declare_program!()` with IDL Files

To use the `declare_program!()` macro, you need the **IDL file** for the target program.

The IDL file must be placed in a directory named `/idls` within your project. The `/idls` directory can be located at **any level** in your project structure.

For example, your project directory could look like this:

```bash
my-project/
├── idls/
│ └── truth_network.json
├── programs/
│ └── example-cpi/
│ ├── src/
│ │ └── lib.rs
│ └── Cargo.toml
```


### Sample Usage in `lib.rs`

Once the IDL is in place, you can import the program using:

```rust
// Import the truth_network program
declare_program!(truth_network);

use truth_network::{ 
    program::TruthNetwork,
    cpi::accounts::{FinalizeVoting, DeleteExpiredQuestion},
    cpi::{finalize_voting, delete_expired_question},
};
```



## Fetching Winner (On-Chain CPI from Another Program)

Smart contracts (e.g., betting markets) can fetch results from the Truth Network using a Cross-Program Invocation (CPI).  
This allows your program to finalize the question and read the winning result from the Truth Network’s `Question` account.

```rust
pub fn fetch_and_store_winner(ctx: Context<FetchAndStoreWinner>, question_id: u64) -> Result<()> {
    let betting_question = &mut ctx.accounts.betting_question;
    let truth_network_question = &ctx.accounts.truth_network_question;

    let current_time = Clock::get()?.unix_timestamp;
    require!(current_time > betting_question.close_date, BettingError::BettingActive);

    // Step 1: Call finalize_voting via CPI
    let cpi_accounts = FinalizeVoting {
        question: truth_network_question.to_account_info(),
    };

    let cpi_context = CpiContext::new(ctx.accounts.truth_network_program.to_account_info(), cpi_accounts);
    finalize_voting(cpi_context, question_id)?;

    // Step 2: Read updated account data
    let mut data = truth_network_question.to_account_info().try_borrow_mut_data()?;
    let truth_data: Question = Question::try_deserialize(&mut data.as_ref())?;

    let winner = truth_data.winning_option;
    let percent = truth_data.winning_percent;

    require!(winner == 1 || winner == 2, BettingError::InvalidWinner);

    // Step 3: Save result
    betting_question.winner = winner;
    betting_question.winning_percentage = percent;
    betting_question.status = "close".to_string();

    Ok(())
}

```

## Fetching Winner (Frontend TypeScript)

You can also finalize and fetch the result from the frontend using `@coral-xyz/anchor` and a connected wallet.

```ts
import { Program, AnchorProvider, BN, web3 } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

async function fetchWinner({ wallet, questionPDA }) {
  const connection = new web3.Connection("https://api.devnet.solana.com");
  const provider = new AnchorProvider(connection, wallet, {});
  
  // Load IDL (adjust path based on your project structure)
  const idl = await fetch("/idl/truth_network.json").then(res => res.json());

  const program = new Program(idl, TRUTH_NETWORK_PROGRAM_ID, provider);

  // Step 1: Finalize voting
  try {
    const tx = await program.methods
      .finalizeVoting(new BN(0)) // optional argument, depends on IDL
      .accounts({ question: questionPDA })
      .rpc();

    console.log("Voting finalized:", tx);
  } catch (e) {
    console.warn("⚠️ Already finalized or failed to finalize:", e);
  }

  // Step 2: Fetch question data
  const question = await program.account.question.fetch(questionPDA);
  return {
    winner: question.winningOption,
    percent: question.winningPercent.toNumber(),
  };
}
```

## IDL Files

Use these to integrate the Truth Network with any frontend or backend:

- [Devnet IDL JSON](https://github.com/Vermont-Secure-Computing/truth-net/blob/main/truth-network-frontend/src/idl/idl.devnet.json)
- [Mainnet IDL JSON](https://github.com/Vermont-Secure-Computing/truth-net/blob/main/truth-network-frontend/src/idl/idl.mainnet.json)




audit by: vtscc.org
Thank you to all our contributors!  




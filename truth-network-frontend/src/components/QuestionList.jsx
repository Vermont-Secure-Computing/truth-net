import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";
import VotingComponent from "./VotingComponent";
import CommitReveal from "./CommitReveal";

const PROGRAM_ID = new PublicKey("Af4GKPVNrHLHuYAgqkT4KiFFL2aJFyfRThrMrC2wjshf");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const QuestionsList = () => {
  const { connection: walletConnection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [voterListPDA, setVoterListPDA] = useState(null);

  const wallet = {
    publicKey,
    signTransaction,
    signAllTransactions,
  };

  const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
  const program = new Program(idl, provider);

  useEffect(() => {
    fetchQuestions();
    fetchVoterListPDA();

    const handleQuestionCreated = () => {
      fetchQuestions();
    };
    window.addEventListener("questionCreated", handleQuestionCreated);

    return () => {
      window.removeEventListener("questionCreated", handleQuestionCreated);
    };
  }, [walletConnection, publicKey]);

  const fetchVoterListPDA = async () => {
    try {
      const [voterListAddress] = await PublicKey.findProgramAddressSync(
        [Buffer.from("voter_list")],
        PROGRAM_ID
      );
      setVoterListPDA(voterListAddress.toString());
      console.log("Voter List PDA:", voterListAddress.toString());
    } catch (error) {
      console.error("Error fetching Voter List PDA:", error);
    }
  };

  const fetchQuestions = async () => {
    try {
      console.log("Fetching questions...");
      const accounts = await program.account.question.all();
      console.log("Accounts: ", accounts);

      const parsedQuestions = await Promise.all(
        accounts.map(async ({ publicKey: questionPubKey, account }) => {
          const questionObj = {
            id: questionPubKey.toString(),
            questionText: account.questionText,
            option1: account.option1,
            option2: account.option2,
            votesOption1: account.votesOption1.toNumber(),
            votesOption2: account.votesOption2.toNumber(),
            committedVoters: account.committedVoters.toNumber(),
            commitEndTime: account.commitEndTime.toNumber(),
            revealEndTime: account.revealEndTime.toNumber(),
            finalized: account.finalized,
            asker: account.asker.toString(),
            userVoterRecord: null, // Default to null
          };

          // If the user is connected, attempt to fetch their voter record for this question.
          if (publicKey) {
            try {
              const [voterRecordPDA] = await PublicKey.findProgramAddress(
                [
                  Buffer.from("vote"),
                  publicKey.toBuffer(),
                  questionPubKey.toBuffer(),
                ],
                PROGRAM_ID
              );
              const voterRecordAccount = await program.account.voterRecord.fetch(voterRecordPDA);
              console.log("voterRecordAccount: ", voterRecordAccount)
              // Attach selected fields to the question object.
              questionObj.userVoterRecord = {
                selected_option: voterRecordAccount.selectedOption,
                claimed: voterRecordAccount.claimed,
                revealed: voterRecordAccount.revealed,
                voterRecordPDA: voterRecordPDA.toString(),
              };
            } catch (error) {
              console.log("No voter record for question", questionObj.id);
            }
          }
          console.log("questionObj: ", questionObj)
          return questionObj;
        })
      );

      console.log("Fetched Questions:", parsedQuestions);
      setQuestions(parsedQuestions);
    } catch (error) {
      console.error("Error fetching questions:", error);
    }
  };

  const claimReward = async (questionId) => {
    if (!publicKey) {
      alert("Please connect your wallet.");
      return;
    }
    try {
      console.log("Claiming reward for question ID:", questionId);
      const questionPublicKey = new PublicKey(questionId);
  
      // Derive the PDA for the voter's record.
      const [voterRecordPDA] = await PublicKey.findProgramAddress(
        [
          Buffer.from("vote"),
          publicKey.toBuffer(),
          questionPublicKey.toBuffer(),
        ],
        PROGRAM_ID
      );
  
      // Derive the vault PDA using the question PDA.
      const [vaultPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), questionPublicKey.toBuffer()],
        PROGRAM_ID
      );
  
      const tx = await program.methods
        .claimReward()
        .accounts({
          question: questionPublicKey,
          voter: publicKey,
          voterRecord: voterRecordPDA,
          vault: vaultPDA, // Now we pass the vault PDA.
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
  
      console.log("Reward claimed, transaction signature:", tx);
      fetchQuestions();
    } catch (error) {
      console.error("Error claiming reward:", error);
    }
  };
  

  const finalizeVoting = async (questionId) => {
    if (!publicKey) {
      alert("Please connect your wallet.");
      return;
    }
    try {
      console.log("Finalizing voting for question ID:", questionId);
      const questionPublicKey = new PublicKey(questionId);

      const tx = await program.methods
        .finalizeVoting()
        .accounts({
          question: questionPublicKey,
          asker: publicKey,
        })
        .rpc();

      console.log("Voting finalized, transaction signature:", tx);
      fetchQuestions();
    } catch (error) {
      console.error("Error finalizing voting:", error);
    }
  };

  return (
    <div>
      <h2>All Questions</h2>
      {questions.length === 0 ? (
        <p>No questions found.</p>
      ) : (
        <ul>
          {questions.map((q) => {
            // Calculate the winning option based on on-chain vote counts.
            const winningOption = q.votesOption1 >= q.votesOption2 ? 1 : 2;
            // Safely check if the current user is eligible to claim their reward.
            const eligibleToClaim =
              q.finalized &&
              q.userVoterRecord &&
              q.userVoterRecord.selected_option === winningOption &&
              !q.userVoterRecord.claimed;

            return (
              <li
                key={q.id}
                style={{
                  marginBottom: "20px",
                  borderBottom: "1px solid #ccc",
                  paddingBottom: "10px",
                }}
              >
                <strong>{q.questionText}</strong>
                <br />
                <span>
                  <strong>Question PDA:</strong>{" "}
                  <a
                    href={`https://explorer.solana.com/address/${q.id}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#007bff", textDecoration: "underline" }}
                  >
                    {q.id}
                  </a>
                </span>
                <br />
                <strong>Number of Committed Voters:</strong> {q.committedVoters}
                <br />
                Commit Phase Ends: {new Date(q.commitEndTime * 1000).toLocaleString()}
                <br />
                Reveal Phase Ends: {new Date(q.revealEndTime * 1000).toLocaleString()}
                <br />
                {q.revealEndTime > Date.now() / 1000 ? (
                  <button onClick={() => setSelectedQuestion(q)}>Vote</button>
                ) : (
                  <p className="text-green-600">Voting Period Ended</p>
                )}
                {!q.finalized && q.revealEndTime <= Date.now() / 1000 && (
                  <button onClick={() => finalizeVoting(q.id)}>Finalize</button>
                )}
                {/* Show "Claim Reward" button if eligible */}
                {eligibleToClaim && (
                  <button onClick={() => claimReward(q.id)}>Claim Reward</button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selectedQuestion && (
        <CommitReveal
          question={selectedQuestion}
          onClose={() => {
            setSelectedQuestion(null);
            fetchQuestions();
          }}
          refreshQuestions={fetchQuestions}
        />
      )}
    </div>
  );
};

export default QuestionsList;

import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";
import CommitReveal from "./CommitReveal";

const PROGRAM_ID = new PublicKey("9PBFznkpYBp1FHCEvm2VyrYxW1Ro737vpxwmuSCw9Wpg");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const QuestionsList = () => {
    const { connection: walletConnection } = useConnection();
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [questions, setQuestions] = useState([]);
    const [voterListPDA, setVoterListPDA] = useState(null);
    const [userInVoterList, setUserInVoterList] = useState(false);
    const [selectedQuestionId, setSelectedQuestionId] = useState(null); // Stores the ID of the question with an open modal

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
        fetchVoterList();

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

    const fetchVoterList = async () => {
        if (!publicKey) return;

        try {
            const [voterListAddress] = await PublicKey.findProgramAddressSync(
                [Buffer.from("voter_list")],
                PROGRAM_ID
            );

            const voterListAccount = await program.account.voterList.fetch(voterListAddress);

            const isVoter = voterListAccount.voters.some(voter => voter.address.toString() === publicKey.toString());

            setUserInVoterList(isVoter);
            console.log("User in Voter List:", isVoter);
        } catch (error) {
            console.error("Error fetching voter list:", error);
        }
    };

    const fetchQuestions = async () => {
      try {
          console.log("Fetching questions...");
          const accounts = await program.account.question.all();
          console.log("Accounts: ", accounts);
  
          const parsedQuestions = await Promise.all(
              accounts.map(async ({ publicKey: questionPubKey, account }) => {
                  const solReward = (account.reward.toNumber() / 1_000_000_000).toFixed(1); // Convert to SOL
  
                  const revealEnded = account.revealEndTime.toNumber() <= Date.now() / 1000;
  
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
                      reward: parseFloat(solReward), // Store as a number for sorting
                      asker: account.asker.toString(),
                      revealEnded: revealEnded, // Flag to check if voting ended
                      userVoterRecord: null, // Default to null
                  };
  
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
                          console.log("voterRecordAccount: ", voterRecordAccount);
  
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
  
                  console.log("questionObj: ", questionObj);
                  return questionObj;
              })
          );
  
          // Separate active and expired questions
          const activeQuestions = parsedQuestions.filter(q => !q.revealEnded || (q.userVoterRecord && !q.userVoterRecord.claimed));
          const endedQuestions = parsedQuestions.filter(q => q.revealEnded && (!q.userVoterRecord || q.userVoterRecord.claimed));
  
          // Sort active questions by highest reward first
          activeQuestions.sort((a, b) => b.reward - a.reward);
  
          // Combine sorted active and ended questions (active first)
          const sortedQuestions = [...activeQuestions, ...endedQuestions];
  
          console.log("Sorted Questions:", sortedQuestions);
          setQuestions(sortedQuestions);
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
  

    return (
        <div>
            <h2>All Questions</h2>
            {questions.length === 0 ? (
                <p>No questions found.</p>
            ) : (
                <ul>
                    {questions.map((q) => {
                        const totalVotes = q.votesOption1 + q.votesOption2;
                        const winningOption = q.votesOption1 >= q.votesOption2 ? 1 : 2;
                        const winningVotes = winningOption === 1 ? q.votesOption1 : q.votesOption2;
                        const winningPercentage = totalVotes > 0 ? (winningVotes / totalVotes) * 100 : 0;
                        const revealEnded = q.revealEndTime <= Date.now() / 1000;

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
                                <strong>Reward:</strong> {q.reward} SOL
                                <br />
                                <strong>Number of Committed Voters:</strong> {q.committedVoters}
                                <br />
                                Commit Phase Ends: {new Date(q.commitEndTime * 1000).toLocaleString()}
                                <br />
                                Reveal Phase Ends: {new Date(q.revealEndTime * 1000).toLocaleString()}
                                <br />
                                {q.revealEndTime > Date.now() / 1000 ? (
                                    userInVoterList && selectedQuestionId !== q.id ? (
                                        <button onClick={() => setSelectedQuestionId(q.id)}>Vote</button>
                                    ) : null
                                ) : (
                                    <p className="text-green-600">Voting Period Ended</p>
                                )}

                                {selectedQuestionId === q.id && (
                                    <CommitReveal
                                        question={q}
                                        onClose={() => setSelectedQuestionId(null)}
                                        refreshQuestions={fetchQuestions}
                                    />
                                )}

                                {q.revealEndTime <= Date.now() / 1000 && // Reveal phase ended
                                    q.userVoterRecord && // User voted
                                    q.userVoterRecord.selected_option === (q.votesOption1 >= q.votesOption2 ? 1 : 2) && // User picked winning option
                                    !q.userVoterRecord.claimed && // User hasn't claimed reward yet
                                    (q.votesOption1 + q.votesOption2 > 0) && // Ensure votes exist
                                    (q.votesOption1 >= q.votesOption2 ? q.votesOption1 : q.votesOption2) / (q.votesOption1 + q.votesOption2) >= 0.51 && ( // Ensure 51% majority
                                        <button onClick={() => claimReward(q.id)} className="bg-blue-500 text-white px-4 py-2 rounded">
                                            Claim Reward
                                        </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default QuestionsList;

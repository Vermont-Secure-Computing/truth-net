import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";
import CommitReveal from "./CommitReveal";

const PROGRAM_ID = new PublicKey("4z8w5yvsZP8XpDVD7uuYWTy6AidoeMGpDM5qeXgA69t2");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const QuestionsList = () => {
    const { connection: walletConnection } = useConnection();
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [questions, setQuestions] = useState([]);
    const [voterListPDA, setVoterListPDA] = useState(null);
    const [userInVoterList, setUserInVoterList] = useState(false);
    const [selectedQuestionId, setSelectedQuestionId] = useState(null); // Stores the ID of the question with an open modal
    const [sortOrder, setSortOrder] = useState("highest");

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
    }, [walletConnection, publicKey, sortOrder]);

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
                  const solReward = (account.reward.toNumber() / 1_000_000_000).toFixed(7); // Convert to SOL
  
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
          activeQuestions.sort((a, b) => sortOrder === "highest" ? b.reward - a.reward : a.reward - b.reward);
  
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
        <div className="container mx-auto px-6 py-6">
                <h2 className="text-2xl font-bold mb-4">All Questions</h2>

                {/* Sort Button */}
                <button 
                    onClick={() => setSortOrder(sortOrder === "highest" ? "lowest" : "highest")} 
                    className="bg-blue-500 text-white px-4 py-2 rounded mb-6 hover:bg-blue-600 transition duration-300"
                >
                    Sort by {sortOrder === "highest" ? "Lowest" : "Highest"} Reward
                </button>

                {/* Check for Empty Questions */}
                {questions.length === 0 ? (
                    <p className="text-gray-600 text-center">No questions found.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {questions.map((q) => {
                            const totalVotes = q.votesOption1 + q.votesOption2;
                            const winningOption = q.votesOption1 >= q.votesOption2 ? 1 : 2;
                            const winningVotes = winningOption === 1 ? q.votesOption1 : q.votesOption2;
                            const winningPercentage = totalVotes > 0 ? (winningVotes / totalVotes) * 100 : 0;
                            const revealEnded = q.revealEndTime <= Date.now() / 1000;

                            return (
                                <div key={q.id} className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
                                    <h3 className="text-lg font-semibold mb-2">{q.questionText}</h3>
                                    <p className="text-gray-700"><strong>Reward:</strong> {q.reward} SOL</p>

                                    {/* Reveal Results (After Reveal Ends) */}
                                    {revealEnded && (
                                        <>
                                            <p className="text-gray-700"><strong>Winning Vote:</strong> {winningOption === 1 ? q.option1 : q.option2}</p>
                                            <p className="text-gray-700"><strong>Winning Percentage:</strong> {winningPercentage.toFixed(2)}%</p>
                                        </>
                                    )}

                                    <p className="text-gray-700"><strong>Committed Voters:</strong> {q.committedVoters}</p>
                                    <p className="text-gray-500 text-sm">Commit Ends: {new Date(q.commitEndTime * 1000).toLocaleString()}</p>
                                    <p className="text-gray-500 text-sm">Reveal Ends: {new Date(q.revealEndTime * 1000).toLocaleString()}</p>

                                    {/* Vote Button */}
                                    {q.revealEndTime > Date.now() / 1000 ? (
                                        userInVoterList && selectedQuestionId !== q.id ? (
                                            <button 
                                                onClick={() => setSelectedQuestionId(q.id)}
                                                className="mt-3 bg-blue-500 text-white px-4 py-2 rounded w-full hover:bg-blue-600 transition duration-300"
                                            >
                                                Vote
                                            </button>
                                        ) : null
                                    ) : (
                                        <p className="text-green-600 mt-2">Voting Period Ended</p>
                                    )}

                                    {/* Voting Modal */}
                                    {selectedQuestionId === q.id && (
                                        <CommitReveal
                                            question={q}
                                            onClose={() => setSelectedQuestionId(null)}
                                            refreshQuestions={fetchQuestions}
                                        />
                                    )}

                                    {/* Claim Reward Button */}
                                    {q.revealEndTime <= Date.now() / 1000 && 
                                        q.userVoterRecord &&
                                        q.userVoterRecord.selected_option === (q.votesOption1 >= q.votesOption2 ? 1 : 2) &&
                                        !q.userVoterRecord.claimed &&
                                        (q.votesOption1 + q.votesOption2 > 0) &&
                                        (q.votesOption1 >= q.votesOption2 ? q.votesOption1 : q.votesOption2) / (q.votesOption1 + q.votesOption2) >= 0.51 && (
                                            <button 
                                                onClick={() => claimReward(q.id)} 
                                                className="mt-3 bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600 transition duration-300"
                                            >
                                                Claim Reward
                                            </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
    );
};

export default QuestionsList;

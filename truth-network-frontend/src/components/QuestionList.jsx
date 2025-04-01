import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import idl from "../idl.json";

const PROGRAM_ID = new PublicKey("7Xu5CjLJ731EpCMeYTk288oPHMqdV6pPXRDuvMDnf4ui");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const QuestionsList = ({ questions, fetchQuestions }) => {
    // const { publicKey } = useWallet();
    // const [questions, setQuestions] = useState([]);
    const [sortOrder, setSortOrder] = useState("highest");
    const navigate = useNavigate();

    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const wallet = {
        publicKey,
        signTransaction,
        signAllTransactions,
    };
    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
    const program = new Program(idl, provider);


    useEffect(() => {
        fetchQuestions();
    }, [publicKey]);
    

    const claimReward = async (questionId) => {
        if (!publicKey) {
            toast.warn("Please connect your wallet.", { position: "top-center" });
            return;
        }
    
        try {
            toast.info("Processing reward claim...", { position: "top-center" });
            
            const questionPublicKey = new PublicKey(questionId);
    
            const [voterRecordPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );
    
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
                    vault: vaultPDA,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
    
            toast.success(`Reward claimed! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
                position: "top-center",
                autoClose: 5000,
                onClick: () => window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
            });
    
            fetchQuestions(); // Refresh the list
        } catch (error) {
            toast.error(`Error claiming reward : ${error.message}`, {
                position: "top-center",
                autoClose: 5000,
            });
        }
    };

    return (
        <div className="container mx-auto px-6 py-6">
            <h2 className="text-2xl font-bold mb-4">All Events</h2>

            <button 
                onClick={() => setSortOrder(sortOrder === "highest" ? "lowest" : "highest")} 
                className="bg-blue-500 text-white px-4 py-2 rounded mb-6 hover:bg-blue-600 transition duration-300"
            >
                Sort by {sortOrder === "highest" ? "Lowest" : "Highest"} Reward
            </button>

            {questions.length === 0 ? (
                <p className="text-gray-600 text-center">No events found.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {questions.map((q) => {
                        const totalVotes = q.votesOption1 + q.votesOption2;
                        const winningOption = q.votesOption1 >= q.votesOption2 ? 1 : 2;
                        const winningVotes = winningOption === 1 ? q.votesOption1 : q.votesOption2;
                        const winningPercentage = totalVotes > 0 ? (winningVotes / totalVotes) * 100 : 0;

                        const isEligibleToClaim =
                            q.revealEnded &&
                            q.userVoterRecord &&
                            q.userVoterRecord.selectedOption === winningOption &&
                            !q.userVoterRecord.claimed &&
                            totalVotes > 0 &&
                            winningPercentage >= 51;
                            const currentTime = new Date().getTime() / 1000;

                            const userCanReveal =
                                q?.commitEndTime < currentTime && // Commit phase is over
                                q?.revealEndTime > currentTime && // Reveal phase is still active
                                q.userVoterRecord?.committed === true && // User has committed a vote
                                q.userVoterRecord?.revealed === false; // User has NOT revealed the vote
                        return (
                            <div 
                                key={q.id} 
                                className="bg-white shadow-md rounded-lg p-6 border border-gray-200 cursor-pointer hover:shadow-lg transition"
                                onClick={() => navigate(`/question/${q.id}`)}
                            >
                                <h3 className="text-lg font-semibold mb-2">{q.questionText}</h3>
                                <p className="text-gray-700"><strong>Reward:</strong> {q.reward} SOL</p>
                                <p className="text-gray-700"><strong>Commit End Time:</strong> {new Date(q.commitEndTime * 1000).toLocaleString()}</p>
                                <p className="text-gray-700"><strong>Reveal End Time:</strong> {new Date(q.revealEndTime * 1000).toLocaleString()}</p>

                                {/* Reveal Results */}
                                {q.revealEnded ? (
                                    <>
                                        <p className="text-red-600 mt-2 font-semibold">Voting Period Ended</p>
                                        <p className="text-gray-700"><strong>Winning Vote:</strong> {winningOption === 1 ? "Option 1" : "Option 2"}</p>
                                        <p className="text-gray-700"><strong>Winning Percentage:</strong> {winningPercentage.toFixed(2)}%</p>
                                    </>
                                ) : new Date().getTime() / 1000 < q.commitEndTime ? (
                                    <div className="flex items-center text-green-600">
                                        <span className="text-lg">✔</span>
                                        <p className="ml-2">Commit Period Active</p>
                                    </div>
                                ) : q.committedVoters === 0 ? (
                                    <div className="flex items-center text-gray-500">
                                        <span className="text-lg">ℹ</span>
                                        <p className="ml-2">No votes committed</p>
                                    </div>
                                ) : (
                                    <div className="flex items-center text-green-600">
                                        <span className="text-lg">✔</span>
                                        <p className="ml-2">Reveal Period Active</p>
                                    </div>
                                )}


                                {/* Claim Reward Button */}
                                {isEligibleToClaim && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent navigating when clicking the button
                                            claimReward(q.id);
                                        }}
                                        className="mt-3 bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600 transition duration-300"
                                    >
                                        Claim Reward
                                    </button>
                                )}

                                {/* Show "You can reveal your vote" if applicable */}
                                {userCanReveal && (
                                    <p className="text-green-600 font-semibold mt-2">You can reveal your vote</p>
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

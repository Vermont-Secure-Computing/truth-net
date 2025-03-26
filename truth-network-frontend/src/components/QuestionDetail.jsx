import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CommitReveal from "./CommitReveal";
import idl from "../idl.json";

const PROGRAM_ID = new PublicKey("5CmM5VFJWKDozFLZ27mWEJ2a1dK7ctXVMCwWteKbW2jT");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const QuestionDetail = () => {
    const { id } = useParams();
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [question, setQuestion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showCommitReveal, setShowCommitReveal] = useState(false);
    const [userVoterRecord, setUserVoterRecord] = useState(null);
    const [isEligibleToClaim, setIsEligibleToClaim] = useState(false);
    const [claiming, setClaiming] = useState(false);

    const wallet = { publicKey, signTransaction, signAllTransactions };
    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
    const program = new Program(idl, provider);

    useEffect(() => {
        fetchQuestion();
    }, [id, publicKey]);

    // ✅ Fetch Question Details & User Voter Record
    const fetchQuestion = async () => {
        try {
            const questionPublicKey = new PublicKey(id);
            const account = await program.account.question.fetch(questionPublicKey);

            const solReward = (account.reward.toNumber() / 1_000_000_000).toFixed(7);
            const revealEnded = account.revealEndTime.toNumber() <= Date.now() / 1000;

            const newQuestion = {
                id,
                questionText: account.questionText,
                reward: parseFloat(solReward),
                commitEndTime: account.commitEndTime.toNumber(),
                revealEndTime: account.revealEndTime.toNumber(),
                votesOption1: account.votesOption1.toNumber(),
                votesOption2: account.votesOption2.toNumber(),
                option1: account.option1,
                option2: account.option2,
                revealEnded,
                vaultAddress: account.vaultAddress.toString(),
            };

            setQuestion(newQuestion);

            if (publicKey) {
                await fetchUserVoterRecord(questionPublicKey, newQuestion);
            }

            setShowCommitReveal(!newQuestion.revealEnded);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching question:", error);
            if (error.message.includes("Account does not exist")) {
                if (publicKey) {
                  localStorage.removeItem(`claim_tx_${id}_${publicKey.toString()}`);
                }
                setQuestionDeleted(true);
              }
        }
    };

    // ✅ Fetch User's Voter Record
    const fetchUserVoterRecord = async (questionPublicKey, questionData) => {
        try {
            const [voterRecordPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );
            const voterRecordAccount = await program.account.voterRecord.fetch(voterRecordPDA);

            const userVoterData = {
                selectedOption: voterRecordAccount.selectedOption,
                claimed: voterRecordAccount.claimed,
                revealed: voterRecordAccount.revealed,
            };

            setUserVoterRecord(userVoterData);

            const totalVotes = questionData.votesOption1 + questionData.votesOption2;
            const winningOption = questionData.votesOption1 >= questionData.votesOption2 ? 1 : 2;
            const winningPercentage =
                totalVotes > 0 ? (Math.max(questionData.votesOption1, questionData.votesOption2) / totalVotes) * 100 : 0;

            const isTie = questionData.votesOption1 === questionData.votesOption2;

            const eligibleToClaim =
                questionData.revealEnded &&
                userVoterData.selectedOption !== undefined &&
                userVoterData.claimed === false &&
                totalVotes > 0 &&
                (isTie || userVoterData.selectedOption === winningOption);
                

            setIsEligibleToClaim(eligibleToClaim);
        } catch (error) {
            console.log("No voter record found.");
        }
    };

    // ✅ Claim Reward Function
    const claimReward = async () => {
        if (!publicKey) {
            toast.warn("Please connect your wallet.", { position: "top-center" });
            return;
        }
    
        try {
            setClaiming(true);
            toast.info("⏳ Processing reward claim...", { position: "top-center" });
    
            const questionPublicKey = new PublicKey(id);
            const [voterRecordPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );

            const [voterListPDA] = web3.PublicKey.findProgramAddressSync(
                [Buffer.from("voter_list")],
                PROGRAM_ID
            );
    
            const [vaultPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vault"), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );
    
            const txSig = web3.Keypair.generate().publicKey.toBase58();

            const tx = await program.methods
                .claimReward(txSig)
                .accounts({
                    question: questionPublicKey,
                    voter: publicKey,
                    voterRecord: voterRecordPDA,
                    vault: vaultPDA,
                    voterList: voterListPDA,
                    feeReceiver: new PublicKey("7qfdvYGEKnM2zrMYATbwtAdzagRGQUUCXxU3hhgG3V2u"),
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
    
            toast.success(`🎉 Reward claimed! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
                position: "top-center",
                autoClose: 5000,
                onClick: () =>
                    window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
            });
    
            // Persist tx ID to localStorage so we can use it even on reload
            localStorage.setItem(`claim_tx_${id}_${publicKey.toString()}`, tx);
    
            fetchQuestion(); // Refresh UI
        } catch (error) {
            toast.error(`❌ Error claiming reward: ${error.message}`, {
                position: "top-center",
                autoClose: 5000,
            });
        } finally {
            setClaiming(false);
        }
    };
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(question.vaultAddress);
        toast.info("Vault Address copied to clipboard!", { position: "top-center" });
    };

    if (loading) return <p className="text-center text-gray-600">Loading...</p>;

    const txId = publicKey
        ? localStorage.getItem(`claim_tx_${id}_${publicKey.toString()}`)
        : null;

    return (
        <div className="container mx-auto px-6 py-6 flex justify-center">
            <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200 max-w-lg w-full text-center">
                <h2 className="text-2xl font-bold mb-4">{question.questionText}</h2>
                <p className="text-gray-700"><strong>Reward:</strong> {question.reward} SOL</p>

                {/* ✅ Commit End Time & Reveal End Time */}
                <p className="text-gray-700 mt-2"><strong>Commit End Time:</strong> {new Date(question.commitEndTime * 1000).toLocaleString()}</p>
                <p className="text-gray-700"><strong>Reveal End Time:</strong> {new Date(question.revealEndTime * 1000).toLocaleString()}</p>

                {/* ✅ Vault Address with QR Code */}
                <div className="mt-4 mb-6">
                    <p className="text-gray-700 font-semibold">Vault Address:</p>
                    <div className="flex items-center justify-center space-x-2">
                        <QRCodeCanvas value={question.vaultAddress} size={50} />
                        <button
                            onClick={() => setShowModal(true)}
                            className="text-blue-600 break-all hover:underline"
                        >
                            {question.vaultAddress.slice(0, 12)}...{question.vaultAddress.slice(-12)}
                        </button>
                    </div>
                </div>
                {/* ✅ Commit & Reveal Component */}
                {showCommitReveal && (
                    <CommitReveal 
                        question={question}
                        onClose={() => setShowCommitReveal(false)}
                        refreshQuestions={fetchQuestion}
                    />
                )}

                {/* ✅ Claim Reward Button */}
                {isEligibleToClaim && (
                    <button
                        onClick={claimReward}
                        disabled={claiming}
                        className="mt-3 bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600 transition duration-300 disabled:bg-gray-400"
                    >
                        {claiming ? (
                            <span className="flex items-center justify-center">
                                Claiming<span className="dot-animate">.</span>
                                <span className="dot-animate dot2">.</span>
                                <span className="dot-animate dot3">.</span>
                            </span>
                        ) : (
                            "Claim Reward"
                        )}
                    </button>
                )}
                
                {txId && (
                    <p className="text-green-700 font-semibold mt-4">
                        Rewards claimed!{" "}
                        <a
                        href={`https://explorer.solana.com/tx/${txId}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                        >
                        View Transaction
                        </a>
                    </p>
                )}
            </div>
            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-md max-w-lg w-full">
                        <h3 className="text-lg font-bold mb-4">Vault Address</h3>

                        <div className="flex justify-center mb-4">
                            <QRCodeCanvas value={question.vaultAddress} size={200} />
                        </div>

                        <p className="text-gray-700 break-all text-center">{question.vaultAddress}</p>
                        <button
                            onClick={copyToClipboard}
                            className="mt-3 bg-blue-500 text-white px-4 py-2 rounded w-full hover:bg-blue-600 transition duration-300"
                        >
                            Copy Address
                        </button>

                        <button
                            onClick={() => setShowModal(false)}
                            className="mt-3 bg-gray-400 text-white px-4 py-2 rounded w-full hover:bg-gray-500 transition duration-300"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuestionDetail;

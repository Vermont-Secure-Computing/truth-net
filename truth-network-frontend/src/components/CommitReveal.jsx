import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import idl from "../idl.json";
import { keccak256 } from "js-sha3";

const PROGRAM_ID = new PublicKey("FALibc4uYqiUd6hasYN7VaPX2oXdd13HeprenWp3wLpf");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const CommitReveal = ({ question, onClose, refreshQuestions }) => {
    if (!question) {
        return <p>Error: Question data is missing.</p>;
    }

    const questionId = question.id;
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [selectedOption, setSelectedOption] = useState(1);
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [hasCommitted, setHasCommitted] = useState(false);
    const [hasCheckedCommitment, setHasCheckedCommitment] = useState(false);
    const [canReveal, setCanReveal] = useState(false);

    const walletAdapter = publicKey && signTransaction ? { publicKey, signTransaction, signAllTransactions } : null;
    const provider = walletAdapter ? new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" }) : null;
    const program = provider ? new Program(idl, provider) : null;

    useEffect(() => {
        if (publicKey && program && !hasCheckedCommitment) {
            checkCommitment();
            setHasCheckedCommitment(true);
        }
    }, [publicKey, program]);

    const checkCommitment = async () => {
        if (!publicKey || !program) return;

        try {
            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );

            const voterRecordAccount = await program.account.voterRecord.fetch(voterRecordPDA).catch(() => null);

            if (voterRecordAccount) {
                toast.info("You have already committed your vote.", { position: "top-center" });
                setHasCommitted(true);
                setCanReveal(!voterRecordAccount.revealed);
            } else {
                toast.info("You have not committed a vote yet.", { position: "top-center" });
                setHasCommitted(false);
            }
        } catch (error) {
            toast.error(`Error checking commitment: ${error.message}`, { position: "top-center", autoClose: 5000 });
        }
    };

    const commitVote = async () => {
        if (!publicKey || !program) {
            toast.warn("Please connect your wallet.", { position: "top-center" });
            return;
        }
        if (!password) {
            toast.warn("Enter a password to commit your vote.", { position: "top-center" });
            return;
        }

        try {
            toast.info("Committing your vote...", { position: "top-center" });

            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );

            setLoading(true);

            const voteString = selectedOption.toString();
            const commitmentHex = keccak256(voteString + password);
            const commitmentBytes = Buffer.from(commitmentHex, "hex");

            const [voterListPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("voter_list")],
                PROGRAM_ID
            );

            const tx = await program.methods
                .commitVote(commitmentBytes)
                .accounts({
                    voter: publicKey,
                    question: questionPubKey,
                    voterRecord: voterRecordPDA,
                    voterList: voterListPDA,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();

            toast.success(`Vote Committed! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
                position: "top-center",
                autoClose: 5000,
                onClick: () => window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
            });

            setHasCommitted(true);
            setCanReveal(true);
            if (refreshQuestions) refreshQuestions();
        } catch (error) {
            toast.error(`Failed to commit vote: ${error.message}`, { position: "top-center", autoClose: 5000 });
        } finally {
            setLoading(false);
            setPassword("");
        }
    };

    const revealVote = async () => {
        if (!publicKey || !program) {
            toast.warn("Please connect your wallet.", { position: "top-center" });
            return;
        }
        if (!password) {
            toast.warn("Enter your password to reveal your vote.", { position: "top-center" });
            return;
        }

        try {
            toast.info("Revealing your vote...", { position: "top-center" });

            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );

            const [voterListPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("voter_list")],
                PROGRAM_ID
            );

            setLoading(true);

            const tx = await program.methods
                .revealVote(password)
                .accounts({
                    voter: publicKey,
                    question: questionPubKey,
                    voterRecord: voterRecordPDA,
                    voterList: voterListPDA,
                })
                .rpc();

            toast.success(`Vote Revealed! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
                position: "top-center",
                autoClose: 5000,
                onClick: () => window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
            });

            setCanReveal(false);
        } catch (error) {
            toast.error(`Failed to reveal vote: ${error.message}`, { position: "top-center", autoClose: 5000 });
        } finally {
            setLoading(false);
            setPassword("");
        }
    };

    const isCommitTimeOver = new Date().getTime() / 1000 > question.commitEndTime;

    return (
        <div className="modal bg-white p-6 max-w-md mx-auto text-center border-t border-b border-gray-300">
            {/* ✅ Styled Title */}
            {/* <h2 className="text-xl font-semibold mb-4">{question.questionText}</h2> */}
            
            {/* ✅ Updated Section Header */}
            <p className="text-gray-700 font-medium mb-4">{isCommitTimeOver ? "Reveal Vote" : "Commit Vote"}</p>

            {/* ✅ Show Commit Options Only Before Reveal Phase */}
            {!isCommitTimeOver && (
                <div className="flex justify-center space-x-4 mb-4">
                    <label className="flex items-center space-x-2">
                        <input
                            type="radio"
                            name="commitOption"
                            value="1"
                            checked={selectedOption === "1"}
                            onChange={(e) => setSelectedOption(e.target.value)}
                            disabled={hasCommitted}
                            className="form-radio text-blue-500"
                        />
                        <span>True</span>
                    </label>

                    <label className="flex items-center space-x-2">
                        <input
                            type="radio"
                            name="commitOption"
                            value="2"
                            checked={selectedOption === "2"}
                            onChange={(e) => setSelectedOption(e.target.value)}
                            disabled={hasCommitted}
                            className="form-radio text-blue-500"
                        />
                        <span>False</span>
                    </label>
                </div>
            )}

            {/* ✅ Password Input Field */}
            {( 
                (!hasCommitted && new Date().getTime() / 1000 < question.commitEndTime) ||
                (hasCommitted && new Date().getTime() / 1000 > question.commitEndTime && new Date().getTime() / 1000 < question.revealEndTime)
            ) && (
                <input
                    type="password"
                    placeholder={isCommitTimeOver ? "Enter password to reveal" : "Enter password to commit"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border border-gray-300 rounded-lg p-2 w-full mb-4 focus:ring focus:ring-blue-200"
                />
            )}

            {/* ✅ Commit Vote Button */}
            {!hasCommitted && new Date().getTime() / 1000 < question.commitEndTime && (
                <button 
                    onClick={commitVote} 
                    disabled={loading}
                    className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-300 disabled:bg-gray-400"
                >
                    {loading ? (
                    <span className="flex items-center justify-center">
                        Submitting<span className="dot-animate">.</span>
                        <span className="dot-animate dot2">.</span>
                        <span className="dot-animate dot3">.</span>
                    </span>
                    ) : (
                    "Commit Vote"
                    )}
                </button>
            )}

            {/* ✅ Reveal Vote Button */}
            {canReveal && new Date().getTime() / 1000 > question.commitEndTime &&
                new Date().getTime() / 1000 < question.revealEndTime && (
                <button 
                    onClick={revealVote} 
                    disabled={loading}
                    className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-300 disabled:bg-gray-400"
                >
                    {loading ? (
                    <span className="flex items-center justify-center">
                        Revealing<span className="dot-animate">.</span>
                        <span className="dot-animate dot2">.</span>
                        <span className="dot-animate dot3">.</span>
                    </span>
                    ) : (
                    "Reveal Vote"
                    )}
                </button>
            )}
        </div>

    );
};

export default CommitReveal;

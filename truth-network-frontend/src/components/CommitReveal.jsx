import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { keccak256 } from "js-sha3";
import idl from "../idl.json";
import { PROGRAM_ID } from "../constant";

const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const CommitReveal = ({ question, onClose, refreshQuestions }) => {
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [selectedOption, setSelectedOption] = useState("1");
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
        try {
            const questionPubKey = new PublicKey(question.id);
            const [voterRecordPDA] = PublicKey.findProgramAddressSync([
                Buffer.from("vote"),
                publicKey.toBuffer(),
                questionPubKey.toBuffer(),
            ], PROGRAM_ID);

            const record = await program.account.voterRecord.fetch(voterRecordPDA).catch(() => null);
            if (record) {
                setHasCommitted(true);
                setCanReveal(!record.revealed);
            }
        } catch (err) {
            toast.error("Failed to check commitment.");
        }
    };

    const commitVote = async () => {
        if (!publicKey || !password || !program) return;

        try {
            setLoading(true);
            const commitment = Buffer.from(keccak256(selectedOption + password), "hex");
            const questionPubKey = new PublicKey(question.id);

            const [voterRecordPDA] = PublicKey.findProgramAddressSync([
                Buffer.from("vote"),
                publicKey.toBuffer(),
                questionPubKey.toBuffer(),
            ], PROGRAM_ID);

            const [userRecordPDA] = PublicKey.findProgramAddressSync([
                Buffer.from("user_record"),
                publicKey.toBuffer(),
            ], PROGRAM_ID);

            const tx = await program.methods.commitVote(commitment).accounts({
                voter: publicKey,
                question: questionPubKey,
                voterRecord: voterRecordPDA,
                userRecord: userRecordPDA,
                systemProgram: web3.SystemProgram.programId,
            }).rpc();

            toast.success("Vote committed!");
            setHasCommitted(true);
            setCanReveal(true);
            if (refreshQuestions) refreshQuestions();
        } catch (e) {
            toast.error("Commit failed: " + e.message);
        } finally {
            setLoading(false);
            setPassword("");
        }
    };

    const revealVote = async () => {
        if (!publicKey || !password || !program) return;

        try {
            setLoading(true);
            const questionPubKey = new PublicKey(question.id);

            const [voterRecordPDA] = PublicKey.findProgramAddressSync([
                Buffer.from("vote"),
                publicKey.toBuffer(),
                questionPubKey.toBuffer(),
            ], PROGRAM_ID);

            const [userRecordPDA] = PublicKey.findProgramAddressSync([
                Buffer.from("user_record"),
                publicKey.toBuffer(),
            ], PROGRAM_ID);

            const tx = await program.methods.revealVote(password).accounts({
                voter: publicKey,
                question: questionPubKey,
                voterRecord: voterRecordPDA,
                userRecord: userRecordPDA,
            }).rpc();

            toast.success("Vote revealed!");
            setCanReveal(false);
        } catch (e) {
            toast.error("Reveal failed: " + e.message);
        } finally {
            setLoading(false);
            setPassword("");
        }
    };

    const now = Date.now() / 1000;
    const isCommitTimeOver = now > question.commitEndTime;
    const isRevealTime = now > question.commitEndTime && now < question.revealEndTime;

    return (
        <div className="modal bg-white p-6 rounded-lg shadow max-w-md mx-auto">
            <p className="text-lg font-semibold mb-4">{isCommitTimeOver ? "Reveal Vote" : "Commit Vote"}</p>

            {!isCommitTimeOver && (
                <div className="flex justify-center gap-4 mb-4">
                    {["1", "2"].map((opt) => (
                        <label key={opt} className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="vote"
                                value={opt}
                                checked={selectedOption === opt}
                                onChange={(e) => setSelectedOption(e.target.value)}
                                disabled={hasCommitted}
                            />
                            {opt === "1" ? "True" : "False"}
                        </label>
                    ))}
                </div>
            )}

            {(isRevealTime || !hasCommitted) && (
                <input
                    type="password"
                    placeholder={isCommitTimeOver ? "Enter password to reveal" : "Enter password to commit"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border rounded p-2 w-full mb-4"
                />
            )}

            {!hasCommitted && !isCommitTimeOver && (
                <button onClick={commitVote} disabled={loading} className="w-full bg-blue-500 text-white py-2 rounded">
                    {loading ? "Submitting..." : "Commit Vote"}
                </button>
            )}

            {canReveal && isRevealTime && (
                <button onClick={revealVote} disabled={loading} className="w-full bg-green-500 text-white py-2 rounded">
                    {loading ? "Revealing..." : "Reveal Vote"}
                </button>
            )}
        </div>
    );
};

export default CommitReveal;

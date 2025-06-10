import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { keccak256 } from "js-sha3";
import { getConstants, getIDL } from "../constants";

const { PROGRAM_ID, getRpcUrl, getExplorerTxUrl } = getConstants();


const CommitReveal = ({ question, onClose, refreshQuestions }) => {
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [selectedOption, setSelectedOption] = useState("1");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [hasCommitted, setHasCommitted] = useState(false);
    const [hasCheckedCommitment, setHasCheckedCommitment] = useState(false);
    const [canReveal, setCanReveal] = useState(false);
    const [blockedReveal, setBlockedReveal] = useState(false);
    const [connection] = useState(() => new web3.Connection(getRpcUrl(), "confirmed"));
    const [program, setProgram] = useState(null);

    useEffect(() => {
        const setupProgram = async () => {
            try {
                const idl = await getIDL();
                const walletAdapter = { publicKey, signTransaction, signAllTransactions };
                const provider = new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" });
                const programInstance = new Program(idl, provider);
                setProgram(programInstance);
            } catch (err) {
                console.error("Failed to setup program:", err);
            }
        };

        if (publicKey) {
            setupProgram();
        }
    }, [publicKey]);

    useEffect(() => {
        if (publicKey && program && !hasCheckedCommitment) {
            checkCommitment();
            setHasCheckedCommitment(true);
        }
    }, [publicKey, program]);

    const checkCommitment = async () => {
        try {
            const questionPubKey = new PublicKey(question.id);
    
            const [voterRecordPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );
    
            const [userRecordPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("user_record"), publicKey.toBuffer()],
                PROGRAM_ID
            );
    
            const [voterRecord, userRecord] = await Promise.all([
                program.account.voterRecord.fetch(voterRecordPDA).catch(() => null),
                program.account.userRecord.fetch(userRecordPDA).catch(() => null),
            ]);
    
            if (voterRecord) {
                setHasCommitted(true);
                const rejoinedAfterCommit =
                    userRecord && userRecord.createdAt.toNumber() > voterRecord.userRecordJoinTime.toNumber();
    
                if (rejoinedAfterCommit) {
                    setBlockedReveal(true);
                    setCanReveal(false);
                } else {
                    setCanReveal(!voterRecord.revealed);
                    setBlockedReveal(false);
                }
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

            toast.success(
                <div>
                  Vote committed!{" "}
                  <a
                    href={getExplorerTxUrl(tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-500"
                  >
                    View on Explorer
                  </a>
                </div>
              );
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

            toast.success(
                <div>
                  Vote committed!{" "}
                  <a
                    href={getExplorerTxUrl(tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-500"
                  >
                    View on Explorer
                  </a>
                </div>
              );
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
                <button 
                    onClick={commitVote} 
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-lg transition duration-300 ${
                    loading 
                        ? "bg-gray-400 cursor-not-allowed" 
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    }`}
                >
                    {loading ? (
                    <span className="flex items-center justify-center">
                        Committing<span className="dot-animate">.</span>
                        <span className="dot-animate dot2">.</span>
                        <span className="dot-animate dot3">.</span>
                    </span>
                    ) : (
                    "Commit Vote"
                    )}
                </button>
            )}

            {isRevealTime && (
                blockedReveal ? (
                    <p className="text-red-600 text-center font-medium">
                    You rejoined after committing. You can't reveal this vote.
                    </p>
                ) : canReveal && (
                    <button
                    onClick={revealVote}
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-lg transition duration-300 ${
                        loading 
                        ? "bg-gray-400 cursor-not-allowed" 
                        : "bg-green-500 text-white hover:bg-green-600"
                    }`}
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
                )
            )}


        </div>
    );
};

export default CommitReveal;

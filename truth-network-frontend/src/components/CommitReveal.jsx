import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";
import { keccak256 } from "js-sha3"; // Import hashing library

const PROGRAM_ID = new PublicKey("CaKtVz5bhapzdaxr8r5Sx6Jq8ZnanXFNTwY6oCCCVuFP");
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
    const [canReveal, setCanReveal] = useState(false);

    const walletAdapter = publicKey && signTransaction ? { publicKey, signTransaction, signAllTransactions } : null;
    const provider = walletAdapter ? new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" }) : null;
    const program = provider ? new Program(idl, provider) : null;

    useEffect(() => {
        if (publicKey && program) {
            checkCommitment();
        }
    }, [question]);

    // **Check if the user has already committed a vote**
    const checkCommitment = async () => {
        if (!publicKey || !program) return;

        try {
            console.log("Checking if user has committed a vote...");

            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );

            const voterRecordAccount = await program.account.voterRecord.fetch(voterRecordPDA).catch(() => null);

            if (voterRecordAccount) {
                console.log("User has committed a vote.");
                setHasCommitted(true);
                setCanReveal(!voterRecordAccount.revealed); // Reveal only if not revealed yet
            } else {
                console.log("User has not committed a vote.");
                setHasCommitted(false);
            }
        } catch (error) {
            console.error("Error checking commitment:", error);
        }
    };

   
    // **Commit Vote**
    const commitVote = async () => {
        if (!publicKey || !program) return alert("Please connect your wallet");
        if (!password) return alert("Enter a password to commit your vote");

        try {
            console.log("Committing vote for question:", questionId);

            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );

            setLoading(true);

            // ✅ Hash (vote + password) in frontend
            const voteString = selectedOption.toString(); // Convert vote option to string
            const commitmentHex = keccak256(voteString + password);
            const commitmentBytes = Buffer.from(commitmentHex, "hex"); // Convert to byte array

            const tx = await program.methods
                .commitVote(commitmentBytes) // Send precomputed hash
                .accounts({
                    voter: publicKey,
                    question: questionPubKey,
                    voterRecord: voterRecordPDA,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();

            console.log("Vote Committed! Transaction:", tx);
            alert("Vote Committed Successfully!");

            setHasCommitted(true);
            setCanReveal(true);

            if (refreshQuestions) {
                refreshQuestions();
            }
        } catch (error) {
            console.error("Failed to commit vote:", error);
            alert(`Failed to commit vote. Error: ${error.message}`);
        } finally {
            setLoading(false);
            setPassword(""); // Clear password field
        }
    };

    // **Reveal Vote**
    const revealVote = async () => {
        if (!publicKey || !program) return alert("Please connect your wallet");
        if (!password) return alert("Enter your password to reveal your vote");
    
        try {
            console.log("Revealing vote...");
    
            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );
    
            setLoading(true);
    
            // Send only the password
            const tx = await program.methods
                .revealVote(password) // Send only the password
                .accounts({
                    voter: publicKey,
                    question: questionPubKey,
                    voterRecord: voterRecordPDA,
                })
                .rpc();
    
            console.log("Vote Revealed! Transaction:", tx);
            alert("Vote Revealed Successfully!");
    
            setCanReveal(false);
        } catch (error) {
            console.error("Failed to reveal vote:", error);
            alert(`Failed to reveal vote. Error: ${error.message}`);
        } finally {
            setLoading(false);
            setPassword(""); // Clear password field
        }
    };

    return (
        <div className="modal">
            <h2>{question.questionText}</h2>
            <p>Choose an option:</p>
            <select onChange={(e) => setSelectedOption(parseInt(e.target.value, 10))} disabled={hasCommitted}>
                <option value={1}>{question.option1}</option>
                <option value={2}>{question.option2}</option>
            </select>
            <br />

            {/* Password Input for Both Commit & Reveal */}
            {!hasCommitted && new Date().getTime() / 1000 < question.commitEndTime && (
                <input
                type="password"
                placeholder="Enter password to commit"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                />
            )}

            {hasCommitted &&
                new Date().getTime() / 1000 > question.commitEndTime &&
                new Date().getTime() / 1000 < question.revealEndTime && (
                <input
                    type="password"
                    placeholder="Enter password to reveal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            )}
            <br />

            {/* Conditionally show Commit Button based on commit end time */}
            {!hasCommitted && (
                new Date().getTime() / 1000 < question.commitEndTime ? (
                <button onClick={commitVote} disabled={loading}>
                    {loading ? "Submitting..." : "Commit Vote"}
                </button>
                ) : (
                <div>Voting commit ended</div>
                )
            )}

            {/* Reveal Button (Only show if user has committed) */}
            {canReveal && (
                new Date().getTime() / 1000 > question.commitEndTime &&
                new Date().getTime() / 1000 < question.revealEndTime ? (
                    <button onClick={revealVote} disabled={loading}>
                    {loading ? "Revealing..." : "Reveal Vote"}
                    </button>
                ) : (
                    <div>
                    {new Date().getTime() / 1000 <= question.commitEndTime
                        ? "Commit phase is still active"
                        : "Voting reveal ended"}
                    </div>
                )
            )}

            <button onClick={onClose}>Close</button>
        </div>
    );
};

export default CommitReveal;

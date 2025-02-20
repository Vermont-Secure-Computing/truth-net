import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";
import { keccak256 } from "js-sha3"; // Import hashing library

const PROGRAM_ID = new PublicKey("ENCscDg3Cq5JN9ManW5RBGXdh4wgATN1HebF2ojWRKjn");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const CommitReveal = ({ question, onClose }) => {
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
            console.log("Fetching commitment hash for validation...");

            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );

            setLoading(true);

            // ✅ Fetch stored commitment hash from contract
            const voterRecord = await program.account.voterRecord.fetch(voterRecordPDA);
            const storedCommitmentHex = Buffer.from(voterRecord.commitment).toString("hex");

            // ✅ Try both vote options (1 and 2) to find the match
            let decryptedVote = null;
            for (let i = 1; i <= 2; i++) {
                const computedHashHex = keccak256(i.toString() + password);
                if (computedHashHex === storedCommitmentHex) {
                    decryptedVote = i;
                    break;
                }
            }

            if (decryptedVote === null) {
                alert("Invalid password! Vote reveal failed.");
                return;
            }

            console.log("Vote decrypted:", decryptedVote);

            // ✅ Send the decrypted vote option to the smart contract
            const tx = await program.methods
                .revealVote(decryptedVote) // Send vote option only
                .accounts({
                    voter: publicKey,
                    question: questionPubKey,
                    voterRecord: voterRecordPDA,
                })
                .rpc();

            console.log("Vote Revealed! Transaction:", tx);
            alert(`Vote Revealed Successfully! Option ${decryptedVote}`);

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
            <input
                type="password"
                placeholder={hasCommitted ? "Enter password to reveal" : "Enter password to commit"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <br />

            {/* Commit Button (If not committed yet) */}
            {!hasCommitted && (
                <button onClick={commitVote} disabled={loading}>
                    {loading ? "Submitting..." : "Commit Vote"}
                </button>
            )}

            {/* Reveal Button (Only show if user has committed) */}
            {canReveal && (
                <button onClick={revealVote} disabled={loading}>
                    {loading ? "Revealing..." : "Reveal Vote"}
                </button>
            )}

            <button onClick={onClose}>Close</button>
        </div>
    );
};

export default CommitReveal;

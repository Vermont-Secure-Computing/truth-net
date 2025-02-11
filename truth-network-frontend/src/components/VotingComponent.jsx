import React, { useState } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import idl from "../idl.json";

const PROGRAM_ID = new PublicKey("HgSmSrv53KqXTNmM1MtLKAQLbbyr9sVSc5KG23YK1jzE");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const VotingComponent = ({ question, onClose }) => {
    console.log("question: ", question)
    const questionId = question.id
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [selectedOption, setSelectedOption] = useState(1);
    const [loading, setLoading] = useState(false);

    const walletAdapter = {
        publicKey,
        signTransaction,
        signAllTransactions,
    };

    const provider = new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" });
    const program = new Program(idl, provider);

    const createVoterRecord = async (questionPubKey) => {
        try {
            const [voterRecordAddress] = await PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );
    
            console.log("Checking if voter record exists...");
    
            const accountInfo = await connection.getAccountInfo(voterRecordAddress);
            if (!accountInfo) {
                console.log("Voter record does not exist. Creating...");
    
                await program.methods
                    .createVoterRecord()
                    .accounts({
                        voter: publicKey,
                        question: questionPubKey,
                        voterRecord: voterRecordAddress,
                        systemProgram: web3.SystemProgram.programId,
                    })
                    .rpc();
    
                console.log("Voter record created!");
            } else {
                console.log("Voter record already exists.");
            }
    
            return voterRecordAddress;
        } catch (error) {
            console.error("Error creating voter record:", error);
            throw error;
        }
    };
    

    const submitVote = async () => {
        if (!publicKey) return alert("Please connect your wallet");
    
        try {
            console.log("Submitting vote for question:", questionId);
    
            const questionPubKey = new PublicKey(questionId);
    
            // Ensure voter record exists before voting
            const voterRecordAddress = await createVoterRecord(questionPubKey);
    
            // submit the vote
            const tx = await program.methods
                .submitVote(selectedOption)
                .accounts({
                    voter: publicKey,
                    question: questionPubKey,
                    voterRecord: voterRecordAddress,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
    
            console.log("Vote Submitted! Transaction:", tx);
            alert("Vote Submitted Successfully!");
        } catch (error) {
            console.error("Failed to submit vote:", error);
            alert(`Failed to submit vote. Error: ${error.message}`);
        }
    };
    
    
    

    return (
        <div className="modal">
            <h2>{question.questionText}</h2>
            <p>Choose an option:</p>
            <select onChange={(e) => setSelectedOption(parseInt(e.target.value, 10))}>
                <option value={1}>{question.option1}</option>
                <option value={2}>{question.option2}</option>
            </select>
            <br />
            <button onClick={submitVote} disabled={loading}>
                {loading ? "Submitting..." : "Submit Vote"}
            </button>
            <button onClick={onClose}>Close</button>
        </div>
    );
};

export default VotingComponent;

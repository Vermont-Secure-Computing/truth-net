import React, { useState } from "react";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import idl from "../idl.json"; // Import the IDL file
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";

const PROGRAM_ID = new web3.PublicKey("HgSmSrv53KqXTNmM1MtLKAQLbbyr9sVSc5KG23YK1jzE");
const connection = new web3.Connection(clusterApiUrl("devnet"), "confirmed");

const QuestionForm = () => {
    const { publicKey, signTransaction, signAllTransactions } = useWallet(); 

    const [questionText, setQuestionText] = useState("");
    const [option1, setOption1] = useState("");
    const [option2, setOption2] = useState("");
    const [reward, setReward] = useState("");
    const [endTime, setEndTime] = useState("");

    
    const walletAdapter = {
        publicKey,
        signTransaction,
        signAllTransactions,
    };

    
    const provider = new AnchorProvider(connection, walletAdapter, {
        preflightCommitment: "processed",
    });

    const program = new Program(idl, provider);

    const initializeCounter = async () => {
        try {
            // Derive counter address
            const [counterAddress] = await PublicKey.findProgramAddress(
                [Buffer.from("question_counter"), publicKey.toBuffer()],
                PROGRAM_ID
            );
    
            // Check if counter already exists
            const accountInfo = await connection.getAccountInfo(counterAddress);
            if (accountInfo) {
                console.log("Question counter already exists.");
                return; //Exit function, counter already exists
            }
    
            // If account doesn't exist, initialize it
            const tx = await program.methods
                .initializeCounter()
                .accounts({
                    questionCounter: counterAddress,
                    asker: publicKey,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
    
            console.log("Question counter initialized:", tx);
        } catch (error) {
            console.error("Error initializing question counter:", error);
        }
    };
    
    

    const createQuestion = async () => {
        if (!publicKey) return alert("Please connect your wallet");
        if (!questionText || !option1 || !option2 || !reward || !endTime) return alert("All fields are required");
    
        console.log("Creating question...");
        console.log("Public Key:", publicKey.toString());
    
        const rewardLamports = new BN(parseFloat(reward) * 1_000_000_000);
        const endTimeTimestamp = new BN(Math.floor(new Date(endTime).getTime() / 1000));
    
        try {
            //Check if counter exists first
            await initializeCounter();
    
            //Now create the question
            const tx = await program.methods
                .createQuestion(
                    questionText,
                    option1,
                    option2,
                    rewardLamports,
                    endTimeTimestamp
                )
                .accounts({
                    asker: publicKey,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
    
            console.log("Transaction Signature:", tx);
            alert("Question Created Successfully!");
        } catch (error) {
            console.error("Transaction failed:", error);
            alert(`Failed to create question. Error: ${error.message}`);
        }
    };
    

    return (
        <div>
            <h2>Create a Question</h2>
            <input type="text" placeholder="Enter your question" value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
            <input type="text" placeholder="Option 1" value={option1} onChange={(e) => setOption1(e.target.value)} />
            <input type="text" placeholder="Option 2" value={option2} onChange={(e) => setOption2(e.target.value)} />
            <input type="number" placeholder="Reward (SOL)" value={reward} onChange={(e) => setReward(e.target.value)} />
            <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            <button onClick={createQuestion}>Submit Question</button>
        </div>
    );
};

export default QuestionForm;

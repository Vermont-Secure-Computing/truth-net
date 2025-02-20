import React, { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";

const PROGRAM_ID = new PublicKey("ENCscDg3Cq5JN9ManW5RBGXdh4wgATN1HebF2ojWRKjn");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const JoinNetwork = () => {
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [loading, setLoading] = useState(false);

    if (!publicKey) {
        return <p>Please connect your wallet first.</p>;
    }

    // Find the Voter List PDA
    const getVoterListPDA = async () => {
        const [pda] = await PublicKey.findProgramAddress(
            [Buffer.from("voter_list")],
            PROGRAM_ID
        );
        return pda;
    };

    // Initialize Anchor Provider
    const getProvider = () => {
        if (!publicKey || !signTransaction) return null;

        const provider = new AnchorProvider(connection, { publicKey, signTransaction }, { commitment: "confirmed" });
        return provider;
    };

    const joinNetwork = async () => {
        if (!publicKey) return alert("Please connect your wallet");
    
        try {
            setLoading(true);

            const provider = getProvider();
            if (!provider) throw new Error("Failed to initialize provider");

            // Initialize the Anchor program
            const program = new Program(idl, provider);

            // Derive PDA for voter list
            const [voterListPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("voter_list")],
                PROGRAM_ID
            );
    
            const tx = await program.methods.joinNetwork().accounts({
                user: publicKey,
                voterList: voterListPDA,
                systemProgram: web3.SystemProgram.programId,
            }).rpc();
    
            console.log("Joined Truth Network! Tx:", tx);
            alert("Successfully joined the Truth Network!");
            setLoading(false);
        } catch (error) {
            console.error("Failed to join:", error);
            alert("Failed to join the network.");
        }
    };

    return (
        <div>
            <h2>Join the Truth Network</h2>
            <p>Deposit 0.5 SOL to participate in the decentralized truth network.</p>
            <button onClick={joinNetwork} disabled={loading}>
                {loading ? "Joining..." : "Join Truth Network"}
            </button>
        </div>
    );
};

export default JoinNetwork;

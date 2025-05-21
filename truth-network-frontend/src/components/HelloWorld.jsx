import idl from "../idl.json";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";

const PROGRAM_ID = new web3.PublicKey("4z8w5yvsZP8XpDVD7uuYWTy6AidoeMGpDM5qeXgA69t2");
const connection = new web3.Connection(web3.clusterApiUrl("mainnet-beta"), "confirmed");

const HelloWorld = () => {
    const { publicKey, wallet, signTransaction } = useWallet();

    const callHelloWorld = async () => {
        if (!publicKey) return alert("Please connect your wallet");

        console.log("Calling Hello World...");
        console.log("Using Program ID:", PROGRAM_ID.toString());

        
        const walletAdapter = {
            publicKey,
            signTransaction,
            signAllTransactions: wallet?.signAllTransactions, 
        };

        const provider = new AnchorProvider(
            connection,
            walletAdapter,
            { preflightCommitment: "processed" }
        );

        console.log("Provider initialized:", provider);

        const program = new Program(idl, provider);

        console.log("Loaded Program:", program);

        try {
            const userPublicKey = new web3.PublicKey(publicKey.toString());

            const tx = await program.methods
                .helloWorld()
                .accounts({
                    user: userPublicKey,
                })
                .rpc();

            console.log("Transaction Signature:", tx);
            alert("Hello World function executed successfully!");
        } catch (error) {
            console.error("Transaction failed:", error);
            alert(`Failed to call Hello World. Error: ${error.message}`);
        }
    };

    return (
        <div>
            <h2>Test Smart Contract Connection</h2>
            <button onClick={callHelloWorld}>Call Hello World</button>
        </div>
    );
};

export default HelloWorld;

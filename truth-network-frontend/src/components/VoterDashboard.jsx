import { useEffect, useState } from "react";
import idl from "../idl.json";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";

const PROGRAM_ID = new web3.PublicKey("4z8w5yvsZP8XpDVD7uuYWTy6AidoeMGpDM5qeXgA69t2");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const VoterDashboard = () => {
    const { publicKey, wallet, signTransaction } = useWallet();
    const [questions, setQuestions] = useState([]);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [totalRevealedVotes, setTotalRevealedVotes] = useState(0);
    const [totalCorrectVotes, setTotalCorrectVotes] = useState(0);

    useEffect(() => {
        if (!publicKey) return;
    
        const fetchData = async () => {
            try {
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
    
                const program = new Program(idl, provider);
    
                console.log("Fetching voter stats...");
                const stats = await getVoterStats(program, publicKey);
                console.log("Voter Stats:", stats);
    
                setTotalEarnings(stats.totalEarnings);
                setTotalRevealedVotes(stats.totalRevealedVotes);
                setTotalCorrectVotes(stats.totalCorrectVotes);
            } catch (error) {
                console.error("Error fetching voter data:", error);
            }
        };
    
        fetchData();
    }, [publicKey, wallet]);
    

    async function getVoterStats(program, voterPubkey) {
        console.log("Fetching voter list...");
    
        // Derive the correct PDA
        const [voterListPDA] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from("voter_list")],
            PROGRAM_ID
        );
    
        try {
            const voterList = await program.account.voterList.fetch(voterListPDA);
            console.log("Voter List:", voterList);
    
            // Find the voter inside the list
            const voter = voterList.voters.find(v => v.address.toBase58() === voterPubkey.toBase58());
    
            if (!voter) {
                console.log("Voter not found in the network.");
                return { totalEarnings: 0, totalRevealedVotes: 0, totalCorrectVotes: 0 };
            }
    
            return {
                totalEarnings: (voter.totalEarnings?.toNumber() || 0) / web3.LAMPORTS_PER_SOL,
                totalRevealedVotes: voter.totalRevealedVotes?.toNumber() || 0,
                totalCorrectVotes: voter.totalCorrectVotes?.toNumber() || 0,
            };
        } catch (error) {
            console.error("Error fetching voter list:", error);
            return { totalEarnings: 0, totalRevealedVotes: 0, totalCorrectVotes: 0 };
        }
    }
    
    

    return (
        <div>
            <h2>Voter Dashboard</h2>
            <h3>Total Earnings: {totalEarnings} SOL</h3>
            <h3>Total Revealed Votes: {totalRevealedVotes}</h3>
            <h3>Total Correct Votes: {totalCorrectVotes}</h3>
            
            <h3>Voted Questions:</h3>
            {questions.length > 0 ? (
                questions.map((q) => (
                    <div key={q.id}>
                        <h4>{q.questionText}</h4>
                        <p>Votes: {q.votesOption1} - {q.votesOption2}</p>
                        <p>Finalized: {q.finalized ? "Yes" : "No"}</p>
                    </div>
                ))
            ) : (
                <p>No voted questions found.</p>
            )}
        </div>
    );
};

export default VoterDashboard;

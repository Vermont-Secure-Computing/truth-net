import { useEffect, useState } from "react";
import idl from "../idl.json";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";

const PROGRAM_ID = new web3.PublicKey("7mhm8nAhLY3rSvsbMfMRuRaBT3aUUcB9Wk3c4Dpzbigg");
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
                console.log("Fetching voter stats...");
    
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
    
                // Remove PROGRAM_ID (Let Anchor detect it)
                const program = new Program(idl, provider);
    
                // Fetch voter stats (Total Earnings, Total Revealed Votes, Total Correct Votes)
                const stats = await getVoterStats(program, publicKey);
                console.log("Voter Stats:", stats);
                setTotalEarnings(stats.totalEarnings);
                setTotalRevealedVotes(stats.totalRevealedVotes);
                setTotalCorrectVotes(stats.totalCorrectVotes);
    
                console.log("Fetching voter records...");
    
                // Fetch all voter records
                const voterRecords = await program.account.voterRecord.all();
                console.log("Voter Records:", voterRecords);
    
                // Filter records where the user is the voter
                const userVoterRecords = voterRecords.filter(
                    record => record.account.voter.toBase58() === publicKey.toBase58()
                );
                console.log("User Voter Records:", userVoterRecords);
    
                if (userVoterRecords.length === 0) {
                    console.warn("No voter records found for this user.");
                    setQuestions([]); // Clear the state to reflect "No voted questions found"
                    return;
                }
    
                // Get public keys of voted questions
                const questionPubkeys = userVoterRecords.map(record => record.account.question);
                console.log("Fetching questions:", questionPubkeys);
    
                // Fetch question details
                const questionsData = await Promise.all(
                    questionPubkeys.map(async (pubkey) => {
                        try {
                            return await program.account.question.fetch(pubkey);
                        } catch (error) {
                            console.error("Error fetching question:", pubkey.toBase58(), error);
                            return null; // Handle potential fetch errors
                        }
                    })
                );
    
                // Filter out null values (failed fetches)
                const validQuestions = questionsData.filter(q => q !== null);
                console.log("Voted Questions:", validQuestions);
    
                // Update state with fetched questions
                setQuestions(validQuestions);
    
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
        <div className="container mx-auto px-6 py-6">
            <h2>Voter Dashboard</h2>
            <h3>Total Earnings: {totalEarnings} SOL</h3>
            <h3>Total Revealed Votes: {totalRevealedVotes}</h3>
            <h3>Total Correct Votes: {totalCorrectVotes}</h3>
            
            <h3>Voted Questions:</h3>
            {questions.length > 0 ? (
                questions.map((q, index) => (
                    <div key={index}> {/* ✅ Use array index as fallback key */}
                        <h4>{q.questionText}</h4>
                        <p><strong>Question:</strong> {q.questionText}</p>
                        <p><strong>Votes:</strong> {q.votesOption1.toNumber()} - {q.votesOption2.toNumber()}</p> {/* ✅ Convert BN to number */}
                    </div>
                ))
            ) : (
                <p>No voted questions found.</p>
            )}

        </div>
    );
};

export default VoterDashboard;

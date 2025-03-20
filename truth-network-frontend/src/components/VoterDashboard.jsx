import { useEffect, useState } from "react";
import idl from "../idl.json";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const PROGRAM_ID = new web3.PublicKey("7mhm8nAhLY3rSvsbMfMRuRaBT3aUUcB9Wk3c4Dpzbigg");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const VoterDashboard = () => {
    const { publicKey, wallet, signTransaction } = useWallet();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [totalRevealedVotes, setTotalRevealedVotes] = useState(0);
    const [totalCorrectVotes, setTotalCorrectVotes] = useState(0);
    const [voterReputation, setVoterReputation] = useState(0);

    useEffect(() => {
        if (!publicKey) return;

        const fetchData = async () => {
            try {
                const walletAdapter = { publicKey, signTransaction, signAllTransactions: wallet?.signAllTransactions };
                const provider = new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" });
                const program = new Program(idl, provider);

                const stats = await getVoterStats(program, publicKey);
                setTotalEarnings(stats.totalEarnings);
                setTotalRevealedVotes(stats.totalRevealedVotes);
                setTotalCorrectVotes(stats.totalCorrectVotes);
                setVoterReputation(stats.voterReputation);

                const voterRecords = await program.account.voterRecord.all();
                const userVoterRecords = voterRecords.filter(
                    record => record.account.voter.toBase58() === publicKey.toBase58()
                );

                if (userVoterRecords.length === 0) {
                    setQuestions([]);
                    return;
                }

                const questionPubkeys = userVoterRecords.map(record => record.account.question);
                const questionsData = await Promise.all(
                    questionPubkeys.map(async (pubkey) => {
                        try {
                            const question = await program.account.question.fetch(pubkey);
                            return {
                                idque:pubkey.toBase58(),
                                ...question
                            };
                        } catch (error) {
                            console.error("Error fetching question:", pubkey.toBase58(), error);
                            return null;
                        }
                    })
                );
                
                setQuestions(questionsData.filter(q => q !== null));                               
            } catch (error) {
                console.error("Error fetching voter data:", error);
            }
        };

        fetchData();
    }, [publicKey, wallet]);

    async function getVoterStats(program, voterPubkey) {
        console.log("Fetching voter reputation...");
    
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
                return { totalEarnings: 0, totalRevealedVotes: 0, totalCorrectVotes: 0, voterReputation: 0 };
            }

            return {
                totalEarnings: (voter.totalEarnings?.toNumber() || 0) / web3.LAMPORTS_PER_SOL,
                totalRevealedVotes: voter.totalRevealedVotes?.toNumber() || 0,
                totalCorrectVotes: voter.totalCorrectVotes?.toNumber() || 0,
                voterReputation: voter.reputation || 0,
            };
        } catch (error) {
            console.error("Error fetching voter reputation:", error);
            return { totalEarnings: 0, totalRevealedVotes: 0, totalCorrectVotes: 0, voterReputation: 0 };
        }
    }

    const claimReward = async (questionId) => {
        if (!publicKey) {
            toast.warn("Please connect your wallet.", { position: "top-center" });
            return;
        }

        try {
            toast.info("Processing reward claim...", { position: "top-center" });

            const questionPublicKey = new web3.PublicKey(questionId);

            const [voterRecordPDA] = await web3.PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );

            const [vaultPDA] = await web3.PublicKey.findProgramAddress(
                [Buffer.from("vault"), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );

            const walletAdapter = { publicKey, signTransaction, signAllTransactions: wallet?.signAllTransactions };
            const provider = new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" });
            const program = new Program(idl, provider);

            const tx = await program.methods
                .claimReward()
                .accounts({
                    question: questionPublicKey,
                    voter: publicKey,
                    voterRecord: voterRecordPDA,
                    vault: vaultPDA,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();

            toast.success(`Reward claimed! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
                position: "top-center",
                autoClose: 5000,
                onClick: () => window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
            });

            fetchData(); // Refresh the list
        } catch (error) {
            toast.error(`Error claiming reward: ${error.message}`, { position: "top-center", autoClose: 5000 });
        }
    };

    return (
        <div className="container mx-auto px-6 py-6">
            <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-300 pb-2">
                Voter Dashboard
            </h2>
            <div className="mb-6">
                <h3 className="text-lg">Total Earnings: <span className="font-bold">{totalEarnings} SOL</span></h3>
                <h3 className="text-lg">Total Revealed Votes: <span className="font-bold">{totalRevealedVotes}</span></h3>
                <h3 className="text-lg">Total Correct Votes: <span className="font-bold">{totalCorrectVotes}</span></h3>
            </div>

            <h3 className="text-green-600 font-semibold mt-2">Voter Reputation: {voterReputation}</h3>

            <h3 className="text-xl font-semibold mb-4">Voted Questions:</h3>
            {questions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {questions.map((q, index) => {
                        const totalVotes = q.votesOption1.toNumber() + q.votesOption2.toNumber();
                        const winningOption = q.votesOption1.toNumber() > q.votesOption2.toNumber() ? 1 : 2;
                        const winningPercentage = (Math.max(q.votesOption1.toNumber(), q.votesOption2.toNumber()) / totalVotes) * 100;
                        
                        const isEligibleToClaim =
                            q.revealEnded &&
                            q.userVoterRecord &&
                            q.userVoterRecord.selectedOption !== undefined && // Ensure selectedOption exists
                            q.userVoterRecord.selectedOption === winningOption && // Compare correctly
                            !q.userVoterRecord.claimed && // Ensure not already claimed
                            totalVotes > 0 &&
                            winningPercentage >= 51;


                            const currentTime = new Date().getTime() / 1000;

                            const userCanReveal =
                                q?.commitEndTime < currentTime && // Commit phase is over
                                q?.revealEndTime > currentTime && // Reveal phase is still active
                                q.userVoterRecord?.committed === true && // User has committed a vote
                                q.userVoterRecord?.revealed === false; // User has NOT revealed the vote
                        return (
                            <div 
                                key={index} 
                                className="bg-white shadow-md rounded-lg p-6 border border-gray-200 cursor-pointer hover:shadow-lg transition"
                                onClick={() => {
                                    console.log("Navigating to question:", q.idque, "Type:", typeof q.idque);
                                
                                    if (!q.idque || typeof q.idque !== "string" || q.idque.length !== 44) {
                                        console.error("Invalid question ID:", q.idque);
                                        toast.error("Error: Invalid question ID.");
                                        return;
                                    }
                                
                                    navigate(`/question/${q.idque}`);
                                }}                                                               
                            >
                                <h4 className="text-lg font-semibold mb-2">{q.questionText}</h4>
                                <p className="text-sm text-gray-700">
                                    <strong>Votes:</strong> {q.votesOption1.toNumber()} - {q.votesOption2.toNumber()}
                                </p>

                                {isEligibleToClaim && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            claimReward(q.idque);
                                        }}
                                        className="mt-3 bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600 transition duration-300"
                                    >
                                        Claim Reward
                                    </button>
                                )}

                                {userCanReveal && (
                                    <p className="text-green-600 font-semibold mt-2">You can reveal your vote</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-gray-500">No voted questions found.</p>
            )}
        </div>
    );
};

export default VoterDashboard;

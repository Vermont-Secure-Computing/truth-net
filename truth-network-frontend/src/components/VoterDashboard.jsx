import { useEffect, useState } from "react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import idl from "../idl.json";
import { PROGRAM_ID, getRpcUrl } from "../constant";



const VoterDashboard = () => {
    const { publicKey, wallet, signTransaction } = useWallet();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [totalRevealedVotes, setTotalRevealedVotes] = useState(0);
    const [totalCorrectVotes, setTotalCorrectVotes] = useState(0);
    const [voterReputation, setVoterReputation] = useState(0);
    const [connection] = useState(() => new web3.Connection(getRpcUrl(), "confirmed"));

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
            const voterRecordMap = {};
            const userVoterRecords = voterRecords.filter(
                record => record.account.voter.toBase58() === publicKey.toBase58()
            );

            userVoterRecords.forEach(record => {
                const questionKey = record.account.question.toBase58();
                voterRecordMap[questionKey] = record.account;
            });

            if (userVoterRecords.length === 0) {
                setQuestions([]);
                return;
            }

            const questionPubkeys = userVoterRecords.map(record => record.account.question);
            const questionsData = await Promise.all(
                questionPubkeys.map(async (pubkey) => {
                    try {
                        const question = await program.account.question.fetch(pubkey);
                        const [vaultPDA] = await web3.PublicKey.findProgramAddress(
                            [Buffer.from("vault"), pubkey.toBuffer()],
                            PROGRAM_ID
                        );

                        const vaultAccountInfo = await connection.getAccountInfo(vaultPDA);
                        const rentExemption = await connection.getMinimumBalanceForRentExemption(8);
                        const vaultBalance = vaultAccountInfo?.lamports ?? 0;
                        const rewardLamports = Math.max(vaultBalance - rentExemption, 0);
                        const solReward = rewardLamports / web3.LAMPORTS_PER_SOL;

                        return {
                            idque: pubkey.toBase58(),
                            ...question,
                            committedVoters: question.committedVoters?.toNumber?.() || 0,
                            originalReward: question.originalReward?.toNumber?.() || 0,
                            reward: parseFloat(solReward.toFixed(4)),
                            userVoterRecord: voterRecordMap[pubkey.toBase58()] || null,
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

    useEffect(() => {
        if (!publicKey) return;
        fetchData();
    }, [publicKey, wallet]);

    async function getVoterStats(program, voterPubkey) {
        const [userRecordPDA] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), voterPubkey.toBuffer()],
            PROGRAM_ID
        );

        try {
            const record = await program.account.userRecord.fetch(userRecordPDA);
    
            return {
                totalEarnings: (record.totalEarnings?.toNumber() || 0) / web3.LAMPORTS_PER_SOL,
                totalRevealedVotes: record.totalRevealedVotes?.toNumber() || 0,
                totalCorrectVotes: record.totalCorrectVotes?.toNumber() || 0,
                voterReputation: record.reputation || 0,
            };
        } catch (err) {
            console.warn("UserRecord not found. Defaulting to 0 stats.");
            return {
                totalEarnings: 0,
                totalRevealedVotes: 0,
                totalCorrectVotes: 0,
                voterReputation: 0,
            };
        }
    }

    return (
        <div className="container mx-auto px-6 py-6">
            <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-300 pb-2">
                Truth Provider Dashboard
            </h2>
            <div className="mb-6">
                <h3 className="text-lg">Total Earnings: <span className="font-bold">{totalEarnings} SOL</span></h3>
                <h3 className="text-lg">Total Revealed Votes: <span className="font-bold">{totalRevealedVotes}</span></h3>
                <h3 className="text-lg">Total Correct Votes: <span className="font-bold">{totalCorrectVotes}</span></h3>
                <h3 className="text-green-600 font-semibold mt-2">Reputation: {voterReputation}</h3>
            </div>
            <h3 className="text-xl font-semibold mb-4">Voted Events:</h3>
            {questions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {questions.map((q, index) => {
                        const totalVotes = q.votesOption1.toNumber() + q.votesOption2.toNumber();
                        const winningOption = q.votesOption1.toNumber() > q.votesOption2.toNumber() ? 1 : 2;
                        const winningPercentage = (Math.max(q.votesOption1.toNumber(), q.votesOption2.toNumber()) / totalVotes) * 100;
                        
                        
                        const currentTime = new Date().getTime() / 1000;

                        const commitEnd = q.commitEndTime?.toNumber?.() || 0;
                        const revealEnd = q.revealEndTime?.toNumber?.() || 0;

                        const isEligibleToClaim =
                            revealEnd < currentTime &&
                            q.userVoterRecord &&
                            q.userVoterRecord.selectedOption !== undefined &&
                            q.userVoterRecord.selectedOption === winningOption &&
                            !q.userVoterRecord.claimed &&
                            totalVotes > 0 &&
                            winningPercentage >= 51;


                        const userCanReveal =
                            commitEnd < currentTime &&
                            revealEnd > currentTime &&
                            Array.isArray(q.userVoterRecord?.commitment) &&
                            q.userVoterRecord?.commitment.length > 0 &&
                            q.userVoterRecord?.revealed === false;

                        const selectedOption = q.userVoterRecord?.selectedOption;
                        const revealed = q.userVoterRecord?.revealed;
                        const claimed = q.userVoterRecord?.claimed;
                        const isTie = q.votesOption1.toNumber() === q.votesOption2.toNumber();
                        
                        const userCanReclaimRent =
                            revealEnd < currentTime &&
                            !claimed &&
                            (
                                revealed === false || 
                                (!isTie && revealed === true && selectedOption !== winningOption)
                            );


                        const displayRewardLamports = q.originalReward > 0 
                            ? q.originalReward
                            : q.reward * web3.LAMPORTS_PER_SOL;
                        
                        const displayReward = (displayRewardLamports / web3.LAMPORTS_PER_SOL).toFixed(4);

                        
                        return (
                            <div 
                                key={index} 
                                className="bg-white shadow-md rounded-lg p-6 border border-gray-200 cursor-pointer hover:shadow-lg transition"
                                onClick={() => {
                                
                                    if (!q.idque || typeof q.idque !== "string" || q.idque.length !== 44) {
                                        console.error("Invalid question ID:", q.idque);
                                        toast.error("Error: Invalid question ID.");
                                        return;
                                    }
                                
                                    navigate(`/question/${q.idque}`);
                                }}                                                               
                            >
                                <h4 className="text-lg font-semibold mb-2">{q.questionText}</h4>
                                <p className="text-gray-700"><strong>Reward:</strong> {displayReward} SOL</p>
                                <p className="text-gray-700"><strong>Voters Committed:</strong> {q.committedVoters}</p>
                                <p className="text-gray-700"><strong>Commit End Time:</strong> {new Date(q.commitEndTime * 1000).toLocaleString()}</p>
                                <p className="text-gray-700"><strong>Reveal End Time:</strong> {new Date(q.revealEndTime * 1000).toLocaleString()}</p>
                                {/* <p className="text-sm text-gray-700">
                                    <strong>Votes:</strong> {q.votesOption1.toNumber()} - {q.votesOption2.toNumber()}
                                </p> */}
                                
                                {isEligibleToClaim && (
                                    <p className="mt-3 text-green-600 font-semibold">
                                        You can now claim your reward
                                    </p>
                                )}

                                {userCanReclaimRent && (
                                    <p className="text-yellow-600 font-semibold mt-2">You can now reclaim your rent</p>
                                )}

                                {userCanReveal && (
                                    <p className="text-green-600 font-semibold mt-2">You can now reveal your vote</p>
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
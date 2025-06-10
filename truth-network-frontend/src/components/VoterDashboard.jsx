import { useEffect, useState } from "react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getConstants, getIDL } from "../constants";

const { PROGRAM_ID, getRpcUrl } = getConstants();



const VoterDashboard = () => {
    const { publicKey, wallet, signTransaction } = useWallet();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [totalRevealedVotes, setTotalRevealedVotes] = useState(0);
    const [totalCorrectVotes, setTotalCorrectVotes] = useState(0);
    const [voterReputation, setVoterReputation] = useState(0);
    const [connection] = useState(() => new web3.Connection(getRpcUrl(), "confirmed"));
    const [program, setProgram] = useState(null);

    useEffect(() => {
        const setupProgramAndFetch = async () => {
            try {
                const idl = await getIDL();
                const walletAdapter = { publicKey, signTransaction, signAllTransactions: wallet?.signAllTransactions };
                const provider = new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" });
                const programInstance = new Program(idl, provider);
                setProgram(programInstance);
            } catch (err) {
                console.error("Failed to setup program:", err);
            }
        };

        if (publicKey) {
            setupProgramAndFetch();
        }
    }, [publicKey, wallet]);

    useEffect(() => {
        if (program && publicKey) {
            fetchData();
        }
    }, [program]);

    const fetchData = async () => {
        if (!program || !publicKey) {
            console.warn("Program or publicKey not ready. Skipping fetch.");
            return;
        }
        try {
            console.log("Before getVoterStats()");
            const stats = await getVoterStats(program, publicKey, connection);
            console.log("Got voter stats:", stats);
            setTotalEarnings(stats.totalEarnings);
            setTotalRevealedVotes(stats.totalRevealedVotes);
            setTotalCorrectVotes(stats.totalCorrectVotes);
            setVoterReputation(stats.voterReputation);

            console.log("typeof program.account.VoterRecord?.all:", typeof program.account?.VoterRecord?.all);
            console.log("typeof program.account.voterRecord?.all:", typeof program.account?.voterRecord?.all);
            
            let allVoterRecords = [];
            try {
                const fetched = await program.account.voterRecord.all();
                if (Array.isArray(fetched)) {
                    allVoterRecords = fetched;
                } else {
                    console.error("Fetched voterRecord.all() is not an array:", fetched);
                    return;
                }
            } catch (e) {
                console.error("Error fetching all voterRecord accounts:", e);
                return;
            }
            if (!Array.isArray(allVoterRecords)) {
                console.error("Invalid voterRecord list received:", allVoterRecords);
                return;
            }
              
            const cleanedVoterRecords = (allVoterRecords || []).filter(r => r && r.account);

            const rawVoterRecords = cleanedVoterRecords.filter((r, i) => {
                if (!r.account.voter) {
                    console.warn(`Skipping malformed voterRecord at index ${i}:`, r);
                    return false;
                }
                return r.account.voter.equals(publicKey);
            });
              
            console.log("Filtering by:", publicKey.toBase58());
            console.log("Fetching all voterRecord accounts...");
            const voterRecordMap = {};
            const voterRecords = [];
            (rawVoterRecords || []).forEach((record, idx) => {
                try {
                    if (
                        record &&
                        record.account &&
                        record.account.voter &&
                        record.account.question &&
                        typeof record.account.voter.toBase58 === "function"
                    ) {
                        if (record.account.voter.toBase58() === publicKey.toBase58()) {
                            voterRecords.push(record);
                            const questionKey = record.account.question.toBase58();
                            voterRecordMap[questionKey] = record.account;
                        }
                    } else {
                        console.warn(`Skipping malformed record at index ${idx}:`, record);
                    }
                } catch (e) {
                    console.error("Exception during voterRecord parse:", idx, record, e);
                }
            });

            const userVoterRecords = voterRecords;

            if (userVoterRecords.length === 0) {
                setQuestions([]);
                return;
            }
            console.log("userVoterRecords before mapping:", userVoterRecords);
            try {
                const questionPubkeys = (userVoterRecords || [])
                    .filter((record, i) => {
                        if (!record) {
                        console.warn(`Record at index ${i} is null`);
                        return false;
                        }
                        if (!record.account) {
                        console.warn(`Record at index ${i} has no account`, record);
                        return false;
                        }
                        if (!record.account.question) {
                        console.warn(`Record at index ${i} missing question`, record);
                        return false;
                        }
                        return true;
                    })
                    .map(record => record.account.question);

                if (!Array.isArray(questionPubkeys) || questionPubkeys.length === 0) {
                    console.warn("No valid question pubkeys found");
                    return;
                }

                const questionsData = await Promise.all(
                    questionPubkeys
                        .filter((pubkey) => pubkey)
                        .map(async (pubkey) => {
                        try {
                            const question = await program.account.question.fetch(pubkey);
                            if (!question) {
                                console.warn("Question fetch returned null:", pubkey.toBase58());
                                return null;
                            }
                            const [vaultPDA] = await web3.PublicKey.findProgramAddressSync(
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
            } catch (e) {
                console.error("Full error during voter dashboard question fetch:", e);
            }
        } catch (error) {
            console.error("Error fetching voter data:", error);
        }
    };

    useEffect(() => {
        if (!publicKey) return;
        fetchData();
    }, [publicKey, wallet]);

    async function getVoterStats(program, voterPubkey, connection) {
        const [userRecordPDA] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), voterPubkey.toBuffer()],
            PROGRAM_ID
        );
    
        try {
            const info = await connection.getAccountInfo(userRecordPDA);
            if (!info) {
                console.warn("UserRecord account does not exist at PDA:", userRecordPDA.toBase58());
                return {
                    totalEarnings: 0,
                    totalRevealedVotes: 0,
                    totalCorrectVotes: 0,
                    voterReputation: 0,
                };
            }
            console.log("Fetching userRecord for PDA:", userRecordPDA.toBase58());
            const record = await program.account.userRecord.fetch(userRecordPDA);
            console.log("Fetched userRecord:", record);
            return {
                totalEarnings: (record.totalEarnings?.toNumber() || 0) / web3.LAMPORTS_PER_SOL,
                totalRevealedVotes: record.totalRevealedVotes?.toNumber() || 0,
                totalCorrectVotes: record.totalCorrectVotes?.toNumber() || 0,
                voterReputation: record.reputation || 0,
            };
        } catch (err) {
            console.warn("UserRecord fetch failed:", err);
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
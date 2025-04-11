import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CommitReveal from "./CommitReveal";
import idl from "../idl.json";
import { FEE_RECEIVER, PROGRAM_ID } from "../constant";

const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const QuestionDetail = () => {
    const { id } = useParams();
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [question, setQuestion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showCommitReveal, setShowCommitReveal] = useState(false);
    const [userVoterRecord, setUserVoterRecord] = useState(null);
    const [isEligibleToClaim, setIsEligibleToClaim] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [isMember, setIsMember] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [draining, setDraining] = useState(false);
    const [hasDrained, setHasDrained] = useState(false);
    const [hasReclaimed, setHasReclaimed] = useState(false);
    const [reclaiming, setReclaiming] = useState(false);
    

    const wallet = { publicKey, signTransaction, signAllTransactions };
    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
    const program = new Program(idl, provider);
    const navigate = useNavigate();
    const now = Math.floor(Date.now() / 1000);

    const checkMembership = async () => {
        try {
            const [voterListPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("voter_list")],
                PROGRAM_ID
            );
    
            const voterListAccount = await program.account.voterList.fetch(voterListPDA);
            const member = voterListAccount.voters.some(
                (voter) => voter.address.toString() === publicKey.toString()
            );
    
            setIsMember(member);
        } catch (error) {
            console.warn("Membership check failed or voter list not initialized");
            setIsMember(false);
        }
    };

    useEffect(() => {
        fetchQuestion();

        if (publicKey) {
            checkMembership();
        }
    }, [id, publicKey]);

    // Fetch Question Details & User Voter Record
    const fetchQuestion = async () => {
        try {
            const questionPublicKey = new PublicKey(id);
            const account = await program.account.question.fetch(questionPublicKey);

            const vaultPubkey = new PublicKey(account.vaultAddress);
            const vaultAccountInfo = await connection.getAccountInfo(vaultPubkey);
            const rentExemption = await connection.getMinimumBalanceForRentExemption(8);
            const vaultBalance = vaultAccountInfo?.lamports ?? 0;
            const rewardLamports = Math.max(vaultBalance - rentExemption, 0);
            const solReward = (rewardLamports / web3.LAMPORTS_PER_SOL).toFixed(4);
            const revealEnded = account.revealEndTime.toNumber() <= Date.now() / 1000;
            const noOneCommitted = account.committedVoters.toNumber() === 0;
            const commitPhaseOver = account.commitEndTime.toNumber() <= now;
            
            const noOneRevealed =
                account.votesOption1.toNumber() === 0 &&
                account.votesOption2.toNumber() === 0;
            const revealPhaseOver = account.revealEndTime.toNumber() <= now;

            const canDrainReward =
                vaultBalance > rentExemption &&
                (
                    (commitPhaseOver && noOneCommitted) ||
                    (revealPhaseOver && noOneRevealed)
                );

            const vaultOnlyHasRent = (vaultBalance - rentExemption) < 1000;

            const rentExpired = account.rentExpiration.toNumber() <= now;

            console.log("hasDrained?", hasDrained);

            console.log({
                canDrainReward,
                vaultBalance,
                rentExemption,
                rewardLamports,
                noOneCommitted,
                noOneRevealed,
                commitPhaseOver,
                revealPhaseOver
            });

            const newQuestion = {
                id,
                questionText: account.questionText,
                reward: parseFloat(solReward),
                commitEndTime: account.commitEndTime.toNumber(),
                revealEndTime: account.revealEndTime.toNumber(),
                votesOption1: account.votesOption1.toNumber(),
                votesOption2: account.votesOption2.toNumber(),
                committedVoters: account.committedVoters?.toNumber?.() || 0,
                option1: account.option1,
                option2: account.option2,
                originalReward: account.originalReward?.toNumber?.() || 0,
                totalDistributed: account.totalDistributed?.toNumber?.() || 0,
                revealEnded,
                vaultAddress: account.vaultAddress.toString(),
                asker: account.asker.toString(),
                idNumber: account.id.toNumber(),
                canDrainReward,
                vaultOnlyHasRent,
                rentExpired,
                voterRecordsCount: account.voterRecordsCount?.toNumber?.() || 0,
                voterRecordsClosed: account.voterRecordsClosed?.toNumber?.() || 0,
                snapshotReward: account.snapshotReward?.toNumber?.() || 0,
            };

            setQuestion(newQuestion);

            if (publicKey) {
                await fetchUserVoterRecord(questionPublicKey, newQuestion);
            }

            setShowCommitReveal(!newQuestion.revealEnded);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching question:", error);
            if (error.message.includes("Account does not exist")) {
                if (publicKey) {
                  localStorage.removeItem(`claim_tx_${id}_${publicKey.toString()}`);
                }
                setQuestionDeleted(true);
              }
        }
    };

    // Fetch User's Voter Record
    const fetchUserVoterRecord = async (questionPublicKey, questionData) => {
        try {
            const [voterRecordPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );
            const voterRecordAccount = await program.account.voterRecord.fetch(voterRecordPDA);

            const userVoterData = {
                selectedOption: voterRecordAccount.selectedOption,
                claimed: voterRecordAccount.claimed,
                revealed: voterRecordAccount.revealed,
            };

            setUserVoterRecord(userVoterData);

            const totalVotes = questionData.votesOption1 + questionData.votesOption2;
            const winningOption = questionData.votesOption1 >= questionData.votesOption2 ? 1 : 2;
            const winningPercentage =
                totalVotes > 0 ? (Math.max(questionData.votesOption1, questionData.votesOption2) / totalVotes) * 100 : 0;

            const isTie = questionData.votesOption1 === questionData.votesOption2;

            const eligibleToClaim =
                questionData.revealEnded &&
                userVoterData.selectedOption !== undefined &&
                userVoterData.claimed === false &&
                totalVotes > 0 &&
                (isTie || userVoterData.selectedOption === winningOption);
                

            setIsEligibleToClaim(eligibleToClaim);
        } catch (error) {
            if (error.message.includes("Account does not exist")) {
                console.log("Voter record was closed. Marking as reclaimed.");
                setUserVoterRecord(null);
                setHasReclaimed(true); // ✅ voter record gone = reclaimed
            } else {
                console.log("Error loading voter record:", error);
            }
        }
    };

    // Claim Reward Function
    const claimReward = async () => {
        if (!publicKey) {
            toast.warn("Please connect your wallet.", { position: "top-center" });
            return;
        }
    
        try {
            setClaiming(true);
            toast.info("Processing reward claim...", { position: "top-center" });
    
            const questionPublicKey = new PublicKey(id);
            const [voterRecordPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );
    
            const [voterListPDA] = web3.PublicKey.findProgramAddressSync(
                [Buffer.from("voter_list")],
                PROGRAM_ID
            );
    
            const [vaultPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vault"), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );
    
            const txSig = web3.Keypair.generate().publicKey.toBase58();
    
            const tx = await program.methods
                .claimReward(txSig)
                .accounts({
                    question: questionPublicKey,
                    voter: publicKey,
                    voterRecord: voterRecordPDA,
                    vault: vaultPDA,
                    voterList: voterListPDA,
                    feeReceiver: new PublicKey("7qfdvYGEKnM2zrMYATbwtAdzagRGQUUCXxU3hhgG3V2u"),
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
    
            toast.success(`Reward claimed! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
                position: "top-center",
                autoClose: 5000,
                onClick: () =>
                    window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
            });
    
            // Manually update state to avoid waiting for fetch
            setUserVoterRecord((prev) => ({
                ...prev,
                claimed: true,
            }));
            setIsEligibleToClaim(false);
    
            // Persist tx ID
            localStorage.setItem(`claim_tx_${id}_${publicKey.toString()}`, tx);
    
            // Optionally: refresh everything
            fetchQuestion();
        } catch (error) {
            toast.error(`Error claiming reward: ${error.message}`, {
                position: "top-center",
                autoClose: 5000,
            });
        } finally {
            setClaiming(false);
        }
    };
    

    const handleDeleteQuestion = async () => {
        try {
            if (!publicKey) {
                toast.warning("Connect wallet first.");
                return;
            }
    
            setDeleting(true);
    
            const questionPublicKey = new PublicKey(id);
            const [vaultPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vault"), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );
            const questionIdNumber = question.idNumber;
            const questionIdBuffer = Buffer.alloc(8);
            questionIdBuffer.writeBigUInt64LE(BigInt(questionIdNumber));
            const [questionPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("question"), publicKey.toBuffer(), questionIdBuffer],
                PROGRAM_ID
            );
    
            const tx = await program.methods
                .deleteExpiredQuestion()
                .accounts({
                    question: questionPDA,
                    vault: vaultPDA,
                    asker: publicKey,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
    
            toast.success(`Question deleted! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
                onClick: () =>
                    window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
            });
    
            // Redirect after a short delay
            setTimeout(() => {
                navigate("/");
            }, 2000);
        } catch (error) {
            console.error("Delete failed:", error);
            toast.error(`Delete failed: ${error.message}`);
        } finally {
            setDeleting(false);
        }
    };
    
    const handleDrainUnclaimedReward = async () => {
        try {
            setDraining(true);
            const questionPublicKey = new PublicKey(id);
            const questionIdBuffer = Buffer.alloc(8);
            questionIdBuffer.writeBigUInt64LE(BigInt(question.idNumber));
    
            const [questionPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("question"), new PublicKey(question.asker).toBuffer(), questionIdBuffer],
                PROGRAM_ID
            );
    
            const [vaultPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vault"), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );
    
            const tx = await program.methods
                .drainUnclaimedReward()
                .accounts({
                    question: questionPDA,
                    vault: vaultPDA,
                    feeReceiver: FEE_RECEIVER,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
    
            toast.success(`Reward drained! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
                onClick: () => window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
            });
            setHasDrained(true);
            fetchQuestion();
        } catch (error) {
            console.error("Drain failed:", error);
            toast.error(`Drain failed: ${error.message}`);
        } finally {
            setDraining(false);
        }
    };
    
    const handleReclaimRent = async () => {
        try {
            if (!publicKey) {
                toast.warn("Please connect your wallet.");
                return;
            }
    
            setReclaiming(true);
    
            const questionPublicKey = new PublicKey(id);
            const [voterRecordPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPublicKey.toBuffer()],
                PROGRAM_ID
            );
    
            const questionIdBuffer = Buffer.alloc(8);
            questionIdBuffer.writeBigUInt64LE(BigInt(question.idNumber));
            const [questionPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("question"), new PublicKey(question.asker).toBuffer(), questionIdBuffer],
                PROGRAM_ID
            );
    
            const tx = await program.methods
                .reclaimCommitOrLoserRent()
                .accounts({
                    voter: publicKey,
                    voterRecord: voterRecordPDA,
                    question: questionPDA,
                })
                .rpc();
    
            toast.success(`Rent reclaimed! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
                onClick: () =>
                    window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
            });
    
            // ⏳ Optional: Wait for confirmation before refresh
            await connection.confirmTransaction(tx, "confirmed");
    
            // ✅ Delay state refresh just slightly to give chain time to update
            setTimeout(() => {
                fetchQuestion(); // properly refetch after confirmed reclaim
            }, 500); // You can tweak this delay if needed
    
        } catch (error) {
            console.error("Reclaim failed:", error);
            toast.error(`Reclaim failed: ${error.message}`);
        } finally {
            setReclaiming(false);
        }
    };    
        
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(question.vaultAddress);
        toast.info("Vault Address copied to clipboard!", { position: "top-center" });
    };

    if (loading) return <p className="text-center text-gray-600">Loading...</p>;

    console.log("Connected wallet:", publicKey?.toString());
    console.log("Asker:", question.asker);
    console.log("showCommitReveal:", showCommitReveal);
    console.log("isMember:", isMember);
    console.log("RevealEnd:", new Date(question.revealEndTime * 1000));
    console.log("Now:", new Date(now * 1000));
    console.log("question distributed reward: ", question.totalDistributed)
    console.log("question snapshot reward: ", question.snapshotReward)
    
    const txId = publicKey
        ? localStorage.getItem(`claim_tx_${id}_${publicKey.toString()}`)
        : null;
        
    const displayRewardLamports = question.originalReward > 0 
        ? question.originalReward
        : question.reward * web3.LAMPORTS_PER_SOL;
    
    const displayReward = (displayRewardLamports / web3.LAMPORTS_PER_SOL).toFixed(4);
    return (
        <div className="container mx-auto px-6 py-6 flex justify-center">
            <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200 max-w-lg w-full text-center">
                <h2 className="text-2xl font-bold mb-4">{question.questionText}</h2>
                <p className="text-gray-700"><strong>Reward:</strong> {displayReward} SOL</p>
                <p className="text-gray-700"><strong>Voters Committed:</strong> {question.committedVoters}</p>
                {/* Commit End Time & Reveal End Time */}
                <p className="text-gray-700 mt-2"><strong>Commit End Time:</strong> {new Date(question.commitEndTime * 1000).toLocaleString()}</p>
                <p className="text-gray-700"><strong>Reveal End Time:</strong> {new Date(question.revealEndTime * 1000).toLocaleString()}</p>

                {/* Vault Address with QR Code */}
                <div className="mt-4 mb-6">
                    <p className="text-gray-700 font-semibold">Vault Address:</p>
                    <div className="flex items-center justify-center space-x-2">
                        <QRCodeCanvas value={question.vaultAddress} size={50} />
                        <button
                            onClick={() => setShowModal(true)}
                            className="text-blue-600 break-all hover:underline"
                        >
                            {question.vaultAddress.slice(0, 12)}...{question.vaultAddress.slice(-12)}
                        </button>
                    </div>
                </div>
                {/* Commit & Reveal Component */}
                {showCommitReveal && isMember && (
                    <CommitReveal 
                        question={question}
                        onClose={() => setShowCommitReveal(false)}
                        refreshQuestions={fetchQuestion}
                    />
                )}

                {/* Claim Reward Button */}
                {isEligibleToClaim && (
                    <button
                        onClick={claimReward}
                        disabled={claiming}
                        className="mt-3 bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600 transition duration-300 disabled:bg-gray-400"
                    >
                        {claiming ? (
                            <span className="flex items-center justify-center">
                                Claiming<span className="dot-animate">.</span>
                                <span className="dot-animate dot2">.</span>
                                <span className="dot-animate dot3">.</span>
                            </span>
                        ) : (
                            "Claim Reward"
                        )}
                    </button>
                )}

                {userVoterRecord &&
                    question.revealEnded &&
                    !userVoterRecord.claimed &&
                    (!hasReclaimed || reclaiming) &&
                    (
                        (!userVoterRecord.revealed) ||
                        (
                            userVoterRecord.revealed &&
                            (
                                question.votesOption1 !== question.votesOption2 &&
                                userVoterRecord.selectedOption !==
                                (question.votesOption1 >= question.votesOption2 ? 1 : 2)
                            )
                        )
                    ) && (
                        <button
                            onClick={handleReclaimRent}
                            disabled={reclaiming}
                            className="mt-3 bg-yellow-500 text-white px-4 py-2 rounded w-full hover:bg-yellow-600 transition duration-300 disabled:bg-gray-400"
                        >
                            {reclaiming ? (
                                <span className="flex items-center justify-center">
                                    Reclaiming<span className="dot-animate">.</span>
                                    <span className="dot-animate dot2">.</span>
                                    <span className="dot-animate dot3">.</span>
                                </span>
                            ) : (
                                "Reclaim Rent"
                            )}
                        </button>
                    )
                }

                {txId && (
                    <p className="text-green-700 font-semibold mt-4">
                        Rewards claimed!{" "}
                        <a
                        href={`https://explorer.solana.com/tx/${txId}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                        >
                        View Transaction
                        </a>
                    </p>
                )}
                {question.canDrainReward && !hasDrained && (
                    <button
                        onClick={handleDrainUnclaimedReward}
                        disabled={draining}
                        className="mt-3 bg-yellow-500 text-white px-4 py-2 rounded w-full hover:bg-yellow-600 transition duration-300 disabled:bg-gray-400"
                    >
                        {draining ? (
                            <span className="flex items-center justify-center">
                                Draining<span className="dot-animate">.</span>
                                <span className="dot-animate dot2">.</span>
                                <span className="dot-animate dot3">.</span>
                            </span>
                        ) : (
                            "Send Unclaimed Reward to Fee Receiver"
                        )}
                    </button>
                )}

                {publicKey &&
                question.revealEnded &&
                question.vaultOnlyHasRent &&
                question.rentExpired &&
                publicKey.toString() === question.asker &&
                (
                // Allow delete if either:
                // no one committed
                question.committedVoters === 0 ||
                // all rent + rewards are cleaned
                (
                    question.voterRecordsCount === 0 || question.voterRecordsClosed === question.voterRecordsCount
                ) &&
                (
                    question.totalDistributed >= question.snapshotReward || question.originalReward === 0
                )                
                ) && (
                <button
                    onClick={handleDeleteQuestion}
                    disabled={deleting}
                    className="mt-3 bg-red-500 text-white px-4 py-2 rounded w-full hover:bg-red-600 transition duration-300 disabled:bg-gray-400"
                >
                    {deleting ? (
                    <span className="flex items-center justify-center">
                        Deleting<span className="dot-animate">.</span>
                        <span className="dot-animate dot2">.</span>
                        <span className="dot-animate dot3">.</span>
                    </span>
                    ) : (
                    "Delete Question"
                    )}
                </button>
                )}


<pre className="text-left text-sm text-gray-600">
{JSON.stringify({
  vaultOnlyHasRent: question.vaultOnlyHasRent,
  rentExpired: question.rentExpired,
  voterRecordsCount: question.voterRecordsCount,
  voterRecordsClosed: question.voterRecordsClosed,
  totalDistributed: question.totalDistributed,
  originalReward: question.originalReward,
  canDelete: (
    question.revealEnded &&
    question.vaultOnlyHasRent &&
    question.rentExpired &&
    publicKey.toString() === question.asker &&
    (question.voterRecordsCount === 0 || question.voterRecordsClosed === question.voterRecordsCount) &&
    (question.totalDistributed === question.originalReward || question.originalReward === 0)
  ),
  snapshotReward: question.snapshotReward
}, null, 2)}
</pre>

            </div>
            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}>
                    <div className="bg-white p-6 rounded-lg shadow-md max-w-lg w-full">
                        <h3 className="text-lg font-bold mb-4">Vault Address</h3>

                        <div className="flex justify-center mb-4">
                            <QRCodeCanvas value={question.vaultAddress} size={200} />
                        </div>

                        <p className="text-gray-700 break-all text-center">{question.vaultAddress}</p>
                        <button
                            onClick={copyToClipboard}
                            className="mt-3 bg-blue-500 text-white px-4 py-2 rounded w-full hover:bg-blue-600 transition duration-300"
                        >
                            Copy Address
                        </button>

                        <button
                            onClick={() => setShowModal(false)}
                            className="mt-3 bg-gray-400 text-white px-4 py-2 rounded w-full hover:bg-gray-500 transition duration-300"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuestionDetail;

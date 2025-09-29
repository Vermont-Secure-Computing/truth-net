import React, { useState, useEffect, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { keccak256 } from "js-sha3";
import { getConstants } from "../constants";
import { getIdls } from "../idl";
import { confirmTransactionOnAllRpcs } from "../utils/confirmWithFallback";

const { PROGRAM_ID, getWorkingRpcUrl, getExplorerTxUrl } = getConstants();

const CommitReveal = ({ question, onClose, refreshQuestions }) => {
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [selectedOption, setSelectedOption] = useState("1");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [hasCommitted, setHasCommitted] = useState(false);
    const [hasCheckedCommitment, setHasCheckedCommitment] = useState(false);
    const [canReveal, setCanReveal] = useState(false);
    const [blockedReveal, setBlockedReveal] = useState(false);
    const [connection, setConnection] = useState(null);
    const { truthNetworkIDL } = getIdls();
    const wallet = { publicKey, signTransaction, signAllTransactions };

    const provider = useMemo(() => {
        if (!connection) return null;
        return new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
    }, [connection, wallet]);

    const program = useMemo(() => {
        if (!provider) return null;
        return new Program(truthNetworkIDL, provider);
    }, [truthNetworkIDL, provider]);

    useEffect(() => {
        (async () => {
            const rpc = await getWorkingRpcUrl();
            const conn = new web3.Connection(rpc, "confirmed");
            setConnection(conn);
        })();
    }, []);

    useEffect(() => {
        if (publicKey && program && !hasCheckedCommitment) {
            checkCommitment();
            setHasCheckedCommitment(true);
        }
    }, [publicKey, program]);

    const checkCommitment = async () => {
        try {
            const questionPubKey = new PublicKey(question.id);

            const [voterRecordPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );

            const [userRecordPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("user_record"), publicKey.toBuffer()],
                PROGRAM_ID
            );

            const [voterRecord, userRecord] = await Promise.all([
                program.account.voterRecord.fetch(voterRecordPDA).catch(() => null),
                program.account.userRecord.fetch(userRecordPDA).catch(() => null),
            ]);

            if (voterRecord) {
                setHasCommitted(true);
                const rejoinedAfterCommit =
                    userRecord && userRecord.createdAt.toNumber() > voterRecord.userRecordJoinTime.toNumber();

                if (rejoinedAfterCommit) {
                    setBlockedReveal(true);
                    setCanReveal(false);
                } else {
                    setCanReveal(!voterRecord.revealed);
                    setBlockedReveal(false);
                }
            }
        } catch (err) {
            toast.error("Failed to check commitment.");
        }
    };

    const commitVote = async () => {
        if (!publicKey || !password || !program) return;
      
        let sig = null;
      
        try {
          setLoading(true);
          const commitment = Buffer.from(keccak256(selectedOption + password), "hex");
          const questionPubKey = new PublicKey(question.id);
      
          const [voterRecordPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
            PROGRAM_ID
          );
      
          const [userRecordPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), publicKey.toBuffer()],
            PROGRAM_ID
          );
      
          // --- Build tx ---
          const tx = await program.methods
            .commitVote(commitment)
            .accounts({
              voter: publicKey,
              question: questionPubKey,
              voterRecord: voterRecordPDA,
              userRecord: userRecordPDA,
              systemProgram: web3.SystemProgram.programId,
            })
            .transaction();
      
          // Add blockhash + fee payer
          tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          tx.feePayer = publicKey;
      
          // Sign & send
          const signedTx = await signTransaction(tx);
          sig = await connection.sendRawTransaction(signedTx.serialize());
      
          // Confirm
          const confirmed = await confirmTransactionOnAllRpcs(sig);
      
          if (confirmed) {
            toast.success(
              <div>
                Vote committed!{" "}
                <a
                  href={getExplorerTxUrl(sig)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-500"
                >
                  View on Explorer
                </a>
              </div>,
              { position: "top-center", autoClose: 5000 }
            );
          } else {
            toast.warn(
              <div>
                Vote sent but not confirmed yet.{" "}
                <a
                  href={getExplorerTxUrl(sig)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-yellow-500"
                >
                  Check Explorer
                </a>
              </div>,
              { position: "top-center", autoClose: 8000 }
            );
          }
      
          setHasCommitted(true);
          setCanReveal(true);
          if (refreshQuestions) refreshQuestions();
        } catch (e) {
          console.error("Commit error:", e);
        
          // Map of known error strings → friendly messages
          const commitErrorMap = {
            "InvalidReveal": "Invalid vote commitment (cannot be empty).",
            "CommitPhaseEnded": "The commit phase has already ended for this question.",
            "AlreadyVoted": "You have already committed a vote for this question.",
            "already in use": "Vote record already exists (you may have already committed).",
            "failed to find vote": "Could not find vote record. Check if the account seeds are correct.",
          };
        
          let readable = "Unexpected error occurred";
        
          if (e?.message) {
            for (const key in commitErrorMap) {
              if (e.message.includes(key)) {
                readable = commitErrorMap[key];
                break;
              }
            }
            if (readable === "Unexpected error occurred") {
              readable = e.message;
            }
          }
        
          toast.error(`Commit failed: ${readable}`, { position: "top-center" });
        } finally {
          setTimeout(() => {
            setLoading(false);
            setPassword("");
          }, 500);
        }
    };      

    const revealVote = async () => {
        if (!publicKey || !password || !program) return;
      
        let sig = null;
      
        try {
          setLoading(true);
          const questionPubKey = new PublicKey(question.id);
      
          const [voterRecordPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
            PROGRAM_ID
          );
      
          const [userRecordPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), publicKey.toBuffer()],
            PROGRAM_ID
          );
      
          // --- Build tx ---
          const tx = await program.methods
            .revealVote(password)
            .accounts({
              voter: publicKey,
              question: questionPubKey,
              voterRecord: voterRecordPDA,
              userRecord: userRecordPDA,
            })
            .transaction();
      
          // Add blockhash + fee payer
          tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          tx.feePayer = publicKey;
      
          // Sign & send
          const signedTx = await signTransaction(tx);
          sig = await connection.sendRawTransaction(signedTx.serialize());
      
          // Confirm
          const confirmed = await confirmTransactionOnAllRpcs(sig);
      
          if (confirmed) {
            toast.success(
              <div>
                Vote revealed!{" "}
                <a
                  href={getExplorerTxUrl(sig)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-500"
                >
                  View on Explorer
                </a>
              </div>,
              { position: "top-center", autoClose: 5000 }
            );
          } else {
            toast.warn(
              <div>
                Transaction sent but not yet confirmed.{" "}
                <a
                  href={getExplorerTxUrl(sig)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-yellow-500"
                >
                  Check Explorer
                </a>
              </div>,
              { position: "top-center", autoClose: 8000 }
            );
          }
      
          setCanReveal(false);
        } catch (e) {
          console.error("Reveal error:", e);
        
          // Map of known errors → friendly messages
          const revealErrorMap = {
            "RejoinedAfterCommit": "You rejoined the network after committing. This vote cannot be revealed.",
            "AlreadyRevealed": "You have already revealed your vote for this question.",
            "RevealPhaseEnded": "The reveal phase has already ended for this question.",
            "InvalidReveal": "Wrong password. Try again.",
          };
        
          let readable = "Unexpected error occurred";
        
          if (e?.message) {
            for (const key in revealErrorMap) {
              if (e.message.includes(key)) {
                readable = revealErrorMap[key];
                break;
              }
            }
            if (readable === "Unexpected error occurred") {
              readable = e.message;
            }
          }
        
          const sig = e.signature || e.txid || null;
        
          if (sig) {
            toast.error(
              <div>
                Reveal failed: {readable}{" "}
                <a
                  href={getExplorerTxUrl(sig)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-red-500"
                >
                  View on Explorer
                </a>
              </div>,
              { position: "top-center" }
            );
          } else {
            toast.error(`Reveal failed: ${readable}`, { position: "top-center" });
          }
        } finally {
          setTimeout(() => {
            setLoading(false);
            setPassword("");
          }, 500);
        }
    };
      

    const now = Date.now() / 1000;
    const isCommitTimeOver = now > question.commitEndTime;
    const isRevealTime = now > question.commitEndTime && now < question.revealEndTime;

    return (
        <div className="modal bg-white p-6 rounded-lg shadow max-w-md mx-auto">
            <p className="text-lg font-semibold mb-4">{isCommitTimeOver ? "Reveal Vote" : "Commit Vote"}</p>

            {!isCommitTimeOver && (
                <div className="flex justify-center gap-4 mb-4">
                    {["1", "2"].map((opt) => (
                        <label key={opt} className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="vote"
                                value={opt}
                                checked={selectedOption === opt}
                                onChange={(e) => setSelectedOption(e.target.value)}
                                disabled={hasCommitted}
                            />
                            {opt === "1" ? "True" : "False"}
                        </label>
                    ))}
                </div>
            )}

            {(isRevealTime || !hasCommitted) && (
                <input
                    type="password"
                    placeholder={isCommitTimeOver ? "Enter password to reveal" : "Enter password to commit"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border rounded p-2 w-full mb-4"
                />
            )}

            {!hasCommitted && !isCommitTimeOver && (
                <button 
                    onClick={commitVote} 
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-lg transition duration-300 ${
                    loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"
                    }`}
                >
                    {loading ? (
                    <span className="flex items-center justify-center">
                        Committing<span className="dot-animate">.</span>
                        <span className="dot-animate dot2">.</span>
                        <span className="dot-animate dot3">.</span>
                    </span>
                    ) : (
                    "Commit Vote"
                    )}
                </button>
            )}

            {isRevealTime && (
                blockedReveal ? (
                    <p className="text-red-600 text-center font-medium">
                    You rejoined after committing. You can't reveal this vote.
                    </p>
                ) : canReveal && (
                    <button
                    onClick={revealVote}
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-lg transition duration-300 ${
                        loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                    >
                    {loading ? (
                        <span className="flex items-center justify-center">
                        Revealing<span className="dot-animate">.</span>
                        <span className="dot-animate dot2">.</span>
                        <span className="dot-animate dot3">.</span>
                        </span>
                    ) : (
                        "Reveal Vote"
                    )}
                    </button>
                )
            )}

        </div>
    );
};

export default CommitReveal;
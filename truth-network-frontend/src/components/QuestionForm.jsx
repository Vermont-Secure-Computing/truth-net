import React, { useState, useMemo, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getConstants } from "../constants";
import { getIdls } from "../idl";
import { confirmTransactionOnAllRpcs } from "../utils/confirmWithFallback";

const { PROGRAM_ID, getWorkingRpcUrl, getExplorerTxUrl } = getConstants();

const QuestionForm = ({ triggerRefresh, onClose }) => {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [questionText, setQuestionText] = useState("");
  const [reward, setReward] = useState("");
  const [commitEndTime, setCommitEndTime] = useState(null);
  const [revealEndTime, setRevealEndTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
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

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const rpc = await getWorkingRpcUrl();
      const conn = new web3.Connection(rpc, "confirmed", { wsEndpoint: null }); // disable WS
      setConnection(conn);
    })();
  }, []);

  const createQuestion = async () => {
    if (!publicKey) {
      toast.warn("Please connect your wallet.", { position: "top-center" });
      return;
    }
    if (!program) {
      toast.error("Program is not initialized yet.", { position: "top-center" });
      return;
    }
    if (!questionText || !reward || !commitEndTime || !revealEndTime) {
      toast.warn("All fields are required.", { position: "top-center" });
      return;
    }

    setLoading(true);

    const rewardLamports = new BN(parseFloat(reward) * 1_000_000_000);
    const commitEndTimeTimestamp = new BN(Math.floor(new Date(commitEndTime).getTime() / 1000));
    const revealEndTimeTimestamp = new BN(Math.floor(new Date(revealEndTime).getTime() / 1000));

    let sig = null;

    try {
      // --- Question Counter PDA ---
      const [questionCounterPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("question_counter"), publicKey.toBuffer()],
        PROGRAM_ID
      );

      let questionCounterAccount = await program.account.questionCounter
        .fetch(questionCounterPDA)
        .catch(() => null);

      // --- If no counter, initialize it ---
      if (!questionCounterAccount) {
        toast.info("Initializing question counter...", { position: "top-center" });

        const tx = await program.methods
          .initializeCounter()
          .accounts({
            questionCounter: questionCounterPDA,
            asker: publicKey,
            systemProgram: web3.SystemProgram.programId,
          })
          .transaction();

        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = publicKey;

        const signedTx = await signTransaction(tx);
        sig = await connection.sendRawTransaction(signedTx.serialize());
        await confirmTransactionOnAllRpcs(sig);

        questionCounterAccount = await program.account.questionCounter.fetch(questionCounterPDA);
      }

      const questionCount = questionCounterAccount.count;
      const questionCountBN = new BN(questionCount);
      const questionCountBuffer = questionCountBN.toArrayLike(Buffer, "le", 8);

      // --- Question PDA ---
      const [questionPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("question"), publicKey.toBuffer(), questionCountBuffer],
        PROGRAM_ID
      );

      // --- Vault PDA ---
      const [vaultPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), questionPDA.toBuffer()],
        PROGRAM_ID
      );

      // --- Build tx for createQuestion ---
      const tx = await program.methods
        .createQuestion(questionText, rewardLamports, commitEndTimeTimestamp, revealEndTimeTimestamp)
        .accounts({
          asker: publicKey,
          questionCounter: questionCounterPDA,
          question: questionPDA,
          vault: vaultPDA,
          systemProgram: web3.SystemProgram.programId,
        })
        .transaction();

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.feePayer = publicKey;

      const signedTx = await signTransaction(tx);
      sig = await connection.sendRawTransaction(signedTx.serialize());

      const confirmed = await confirmTransactionOnAllRpcs(sig);

      if (confirmed) {
        toast.success(
          <div>
            Event created!{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-500"
            >
              View on Explorer
            </a>
          </div>,
          { position: "top-center", autoClose: 6000 }
        );
      } else {
        toast.warning(
          <div>
            Transaction sent but not yet confirmed.{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-yellow-600"
            >
              Check Explorer
            </a>
          </div>,
          { position: "top-center", autoClose: 7000 }
        );
      }

      window.dispatchEvent(new CustomEvent("questionCreated"));
      triggerRefresh();

      setQuestionText("");
      setReward("");
      setCommitEndTime("");
      setRevealEndTime("");
      onClose?.();
      navigate("/");
    } catch (error) {
      console.error("Create question error:", error);
    
      // Map known program errors to human-readable messages
      const createErrorMap = {
        "QuestionTooShort":
          "Your question is too short. Please write at least 10 characters.",
        "QuestionTooLong":
          "Your question is too long. Please shorten it to 150 characters or less.",
        "VotingEnded":
          "The commit end time has already passed. Pick a future time.",
        "InvalidTimeframe":
          "The reveal end time must be after the commit end time.",
        "RewardTooSmall":
          "Reward must be at least 0.05 SOL.",
        "signature verification failed":
          "Transaction signature failed (did you reject in your wallet?).",
        "insufficient funds":
          "Not enough SOL to create the question and fund the vault.",
      };
    
      let readable = "Unexpected error occurred";
    
      if (error?.message) {
        for (const key in createErrorMap) {
          if (error.message.includes(key)) {
            readable = createErrorMap[key];
            break;
          }
        }
        if (readable === "Unexpected error occurred") {
          readable = error.message;
        }
      }
    
      const sig = error.signature || error.txid || null;
    
      if (sig) {
        toast.error(
          <div>
            Failed to create event: {readable}{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-red-500"
            >
              View on Explorer
            </a>
          </div>,
          { position: "top-center", autoClose: 5000 }
        );
      } else {
        toast.error(`Failed to create event: ${readable}`, {
          position: "top-center",
          autoClose: 5000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!questionText || !reward || !commitEndTime || !revealEndTime) {
      toast.warn("⚠ All fields are required.", { position: "top-center" });
      return;
    }
    if (questionText.trim().length < 10) {
      toast.warn("⚠ Event must be at least 10 characters.", { position: "top-center" });
      return;
    }
    setShowModal(true);
  };

  const getMinTime = (selectedDate) => {
    const now = new Date();
    if (!selectedDate) return now;
    const selected = new Date(selectedDate);
    if (
      selected.getFullYear() === now.getFullYear() &&
      selected.getMonth() === now.getMonth() &&
      selected.getDate() === now.getDate()
    ) {
      return now;
    } else {
      const startOfDay = new Date(selected);
      startOfDay.setHours(0, 0, 0, 0);
      return startOfDay;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex flex-col gap-4">
        {/* Inputs … */}
        <div className="flex flex-col gap-4">
          {/* Question Input */}
          <input 
            type="text" 
            placeholder="Enter your event statement" 
            value={questionText} 
            onChange={(e) => setQuestionText(e.target.value)} 
            className="p-3 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Reward Input */}
          <input 
            type="number" 
            placeholder="Reward (SOL)" 
            value={reward} 
            onChange={(e) => setReward(e.target.value)} 
            className="p-3 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Commit End Time */}
          <DatePicker
            selected={commitEndTime}
            onChange={(date) => setCommitEndTime(date)}
            showTimeSelect
            timeIntervals={1}
            minDate={new Date()}
            minTime={getMinTime(commitEndTime)}
            maxTime={new Date(new Date().setHours(23, 59, 59, 999))}
            timeCaption="Time"
            dateFormat="yyyy-MM-dd HH:mm"
            placeholderText="Select commit end time"
            className="p-3 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Reveal End Time */}
          <DatePicker
            selected={revealEndTime}
            onChange={(date) => setRevealEndTime(date)}
            showTimeSelect
            timeIntervals={1}
            minDate={new Date()}
            minTime={getMinTime(revealEndTime)}
            maxTime={new Date(new Date().setHours(23, 59, 59, 999))}
            timeCaption="Time"
            dateFormat="yyyy-MM-dd HH:mm"
            placeholderText="Select reveal end time"
            className="p-3 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Submit Button */}
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            className={`px-4 py-3 rounded-lg transition duration-300 ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>

      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}>
          <div className="bg-white p-6 rounded-lg shadow-lg text-center max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Review Your Event</h2>
            <p className="mb-6 text-gray-700">
              Make sure you are phrasing your event as a <strong>True or False</strong> statement.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowModal(false);
                  createQuestion();
                }}
                className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
              >
                Okay, Proceed
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionForm;
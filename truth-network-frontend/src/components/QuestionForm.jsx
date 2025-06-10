import React, { useState, useEffect } from "react";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { toast } from "react-toastify"; // Import toast
import "react-toastify/dist/ReactToastify.css"; // Import styles
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getConstants, getIDL } from "../constants";

const { PROGRAM_ID, getRpcUrl } = getConstants();



const QuestionForm = ({ triggerRefresh, onClose }) => {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [questionText, setQuestionText] = useState("");
  const [reward, setReward] = useState("");
  const [commitEndTime, setCommitEndTime] = useState(null);
  const [revealEndTime, setRevealEndTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [program, setProgram] = useState(null);
  const [connection] = useState(() => new web3.Connection(getRpcUrl(), "confirmed"));

  const walletAdapter = { publicKey, signTransaction, signAllTransactions };
  const provider = new AnchorProvider(connection, walletAdapter, {
    preflightCommitment: "processed",
  });
  // const program = new Program(idl, provider);
  const navigate = useNavigate();

  useEffect(() => {
    const setupProgram = async () => {
      try {
        if (!publicKey || !signTransaction || !signAllTransactions) return;
  
        const idl = await getIDL();
        const walletAdapter = { publicKey, signTransaction, signAllTransactions };
        const provider = new AnchorProvider(connection, walletAdapter, {
          preflightCommitment: "processed",
        });
  
        const programInstance = new Program(idl || idl, provider);
        setProgram(programInstance);
      } catch (error) {
        console.error("Failed to initialize program:", error);
        toast.error("Failed to initialize program.");
      }
    };
  
    setupProgram();
  }, [publicKey, signTransaction, signAllTransactions]);

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

    setLoading(true); // Start loading state

    const rewardLamports = new BN(parseFloat(reward) * 1_000_000_000);
    const commitEndTimeTimestamp = new BN(Math.floor(new Date(commitEndTime).getTime() / 1000));
    const revealEndTimeTimestamp = new BN(Math.floor(new Date(revealEndTime).getTime() / 1000));

    try {
      // Derive the question counter PDA.
      const [questionCounterPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("question_counter"), publicKey.toBuffer()],
        PROGRAM_ID
      );

      let questionCounterAccount = await program.account.questionCounter.fetch(questionCounterPDA).catch(() => null);

      if (!questionCounterAccount) {
        toast.info("Initializing question counter...", { position: "top-center" });

        const tx = await program.methods
          .initializeCounter()
          .accounts({
            questionCounter: questionCounterPDA,
            asker: publicKey,
            systemProgram: web3.SystemProgram.programId,
          })
          .rpc();

        questionCounterAccount = await program.account.questionCounter.fetch(questionCounterPDA);
      }

      const questionCount = questionCounterAccount.count;
      const questionCountBN = new BN(questionCount);
      const questionCountBuffer = questionCountBN.toArrayLike(Buffer, "le", 8);

      // Derive the question PDA.
      const [questionPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("question"), publicKey.toBuffer(), questionCountBuffer],
        PROGRAM_ID
      );

      // Derive the vault PDA.
      const [vaultPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), questionPDA.toBuffer()],
        PROGRAM_ID
      );


      const tx = await program.methods
        .createQuestion(questionText, rewardLamports, commitEndTimeTimestamp, revealEndTimeTimestamp)
        .accounts({
          asker: publicKey,
          questionCounter: questionCounterPDA,
          question: questionPDA,
          vault: vaultPDA,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      toast.success(`Event Created! `, {
        position: "top-center",
        autoClose: 5000,
        onClick: () => window.open(`https://explorer.solana.com/tx/${tx}?cluster=mainnet-beta`, "_blank"),
      });

      window.dispatchEvent(new CustomEvent("questionCreated"));

      triggerRefresh()

      // Reset form fields after success
      setQuestionText("");
      setReward("");
      setCommitEndTime("");
      setRevealEndTime("");
      onClose?.();
      navigate("/");
    } catch (error) {
      toast.error(`Failed to create event: ${error.message}`, {
        position: "top-center",
        autoClose: 5000,
      });
    } finally {
      setLoading(false); // Stop loading state
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
    if (!selectedDate) return now; // prevent error when date is null
  
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
        <div className="relative z-20 w-full">
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
            placeholderText="Select commit end time."
            wrapperClassName="w-full"
            className="p-3 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            popperPlacement="bottom-start"
            popperClassName="z-50"
            calendarClassName="custom-datepicker"
          />
        </div>

        {/* Reveal End Time */}
        <div className="relative z-20 w-full">
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
            placeholderText="Select reveal end time."
            wrapperClassName="w-full"
            className="p-3 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            popperPlacement="bottom-start"
            popperClassName="z-50"
            calendarClassName="custom-datepicker"
          />
        </div>

        {/* Submit Button */}
        <button 
          onClick={handleSubmit} 
          disabled={loading}
          className={`px-4 py-3 rounded-lg transition duration-300 ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              Submitting<span className="dot-animate">.</span>
              <span className="dot-animate dot2">.</span>
              <span className="dot-animate dot3">.</span>
            </span>
          ) : (
            "Submit"
          )}
        </button>
      </div>

      {/* Modal */}
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
                  setPendingCreate(true);
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

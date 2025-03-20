import React, { useState } from "react";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { toast } from "react-toastify"; // ✅ Import toast
import "react-toastify/dist/ReactToastify.css"; // ✅ Import styles
import idl from "../idl.json"; // Import the IDL file

const RENT_COST = 50_000_000;
const PROGRAM_ID = new web3.PublicKey("7mhm8nAhLY3rSvsbMfMRuRaBT3aUUcB9Wk3c4Dpzbigg");
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const QuestionForm = ({ fetchQuestions }) => {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [questionText, setQuestionText] = useState("");
  const [reward, setReward] = useState("");
  const [commitEndTime, setCommitEndTime] = useState("");
  const [revealEndTime, setRevealEndTime] = useState("");
  const [loading, setLoading] = useState(false); // ✅ Added loading state

  const walletAdapter = { publicKey, signTransaction, signAllTransactions };
  const provider = new AnchorProvider(connection, walletAdapter, {
    preflightCommitment: "processed",
  });
  const program = new Program(idl, provider);

  const createQuestion = async () => {
    if (!publicKey) {
      toast.warn("⚠ Please connect your wallet.", { position: "top-center" });
      return;
    }
    if (!questionText || !reward || !commitEndTime || !revealEndTime) {
      toast.warn("⚠ All fields are required.", { position: "top-center" });
      return;
    }

    setLoading(true); // ✅ Start loading state

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

      const totalTransferLamports = Number(RENT_COST) + Number(rewardLamports.toString());

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

      toast.success(`🎉 Question Created! ✅`, {
        position: "top-center",
        autoClose: 5000,
        onClick: () => window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
      });

      window.dispatchEvent(new CustomEvent("questionCreated"));

      fetchQuestions()

      // ✅ Reset form fields after success
      setQuestionText("");
      setReward("");
      setCommitEndTime("");
      setRevealEndTime("");
    } catch (error) {
      toast.error(`Failed to create question: ${error.message}`, {
        position: "top-center",
        autoClose: 5000,
      });
    } finally {
      setLoading(false); // ✅ Stop loading state
    }
  };

  return (
    <div className="container items-center bg-white mx-auto px-6 py-6">
        {/* Question Input */}
        <input 
            type="text" 
            placeholder="Enter your question" 
            value={questionText} 
            onChange={(e) => setQuestionText(e.target.value)} 
            className="p-3 border rounded-lg w-1/4 focus:outline-none focus:ring-2 focus:ring-blue-500 mx-2"
        />

        {/* Reward Input */}
        <input 
            type="number" 
            placeholder="Reward (SOL)" 
            value={reward} 
            onChange={(e) => setReward(e.target.value)} 
            className="p-3 border rounded-lg w-1/6 focus:outline-none focus:ring-2 focus:ring-blue-500 mx-2"
        />

        {/* Commit End Time */}
        <input 
            type="datetime-local" 
            value={commitEndTime} 
            onChange={(e) => setCommitEndTime(e.target.value)} 
            className="p-3 border rounded-lg w-1/5 focus:outline-none focus:ring-2 focus:ring-blue-500 mx-2"
        />

        {/* Reveal End Time */}
        <input 
            type="datetime-local" 
            value={revealEndTime} 
            onChange={(e) => setRevealEndTime(e.target.value)} 
            className="p-3 border rounded-lg w-1/5 focus:outline-none focus:ring-2 focus:ring-blue-500 mx-2"
        />

        {/* Submit Button */}
        <button 
            onClick={createQuestion} 
            disabled={loading} // ✅ Disable button during loading
            className={`px-4 py-3 rounded-lg transition duration-300 mx-2 ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
        >
            {loading ? "Submitting..." : "Submit"}
        </button>
    </div>
  );
};

export default QuestionForm;

import React, { useState } from "react";
import { PublicKey, Connection, clusterApiUrl, Transaction, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import idl from "../idl.json"; // Import the IDL file
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";



const RENT_COST = 50_000_000;
const SYS_ID = SystemProgram.programId;
const PROGRAM_ID = new web3.PublicKey("Af4GKPVNrHLHuYAgqkT4KiFFL2aJFyfRThrMrC2wjshf");
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const QuestionForm = () => {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  const [questionText, setQuestionText] = useState("");
  const [reward, setReward] = useState("");
  const [commitEndTime, setCommitEndTime] = useState("");
  const [revealEndTime, setRevealEndTime] = useState("");
  const [loading, setLoading] = useState(false);

  const walletAdapter = { publicKey, signTransaction, signAllTransactions };

  const provider = new AnchorProvider(connection, walletAdapter, {
    preflightCommitment: "processed",
  });

  const program = new Program(idl, provider);

  const createQuestion = async () => {
    if (!publicKey) return alert("Please connect your wallet");
    if (!questionText || !reward || !commitEndTime || !revealEndTime)
      return alert("All fields are required");

    console.log("Creating question...");
    console.log("Public Key:", publicKey.toString());

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
        console.log("Initializing question counter...");
        const tx = await program.methods
          .initializeCounter()
          .accounts({
            questionCounter: questionCounterPDA,
            asker: publicKey,
            systemProgram: web3.SystemProgram.programId,
          })
          .rpc();

        console.log("Question counter initialized: ", tx);
        questionCounterAccount = await program.account.questionCounter.fetch(questionCounterPDA);
      }

      const questionCount = questionCounterAccount.count;
      console.log("Question count:", questionCount);

      // Convert question count to an 8-byte Buffer (little-endian).
      const questionCountBN = new BN(questionCount);
      const questionCountBuffer = questionCountBN.toArrayLike(Buffer, "le", 8);

      // Derive the question PDA.
      const [questionPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("question"), publicKey.toBuffer(), questionCountBuffer],
        PROGRAM_ID
      );
      if (!questionPDA) throw new Error("Failed to derive question PDA");
      console.log("Derived question PDA:", questionPDA.toString());

      // Derive the vault PDA using the question PDA.
      const [vaultPDA, vaultBump] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), questionPDA.toBuffer()],
        PROGRAM_ID
      );
      if (!vaultPDA) throw new Error("Failed to derive vault PDA");
      console.log("Derived vault PDA:", vaultPDA.toString(), "with bump", vaultBump);

      // Calculate total lamports to fund the vault.
      const totalTransferLamports = Number(RENT_COST) + Number(rewardLamports.toString());
      console.log("Total lamports to transfer:", totalTransferLamports);

      // Instead of creating the vault here on the client using invoke_signed,
      // assume that the on-chain create_question instruction will create the vault.
      // So we simply pass the vault PDA to the instruction.

      const tx = await program.methods
        .createQuestion(questionText, rewardLamports, commitEndTimeTimestamp, revealEndTimeTimestamp)
        .accounts({
          asker: publicKey,
          questionCounter: questionCounterPDA,
          question: questionPDA,
          vault: vaultPDA, // Pass the derived vault PDA.
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Transaction Signature:", tx);
      alert("Question Created Successfully!");
      window.dispatchEvent(new CustomEvent("questionCreated"));

      setQuestionText("");
      setReward("");
      setCommitEndTime("");
      setRevealEndTime("");
      setLoading(false);
    } catch (error) {
      console.error("Transaction failed:", error);
      alert(`Failed to create question. Error: ${error.message}`);
    }
  };     

  return (
    <div>
      <h2>Create a Question</h2>
      <input type="text" placeholder="Enter your question" value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
      <input type="number" placeholder="Reward (SOL)" value={reward} onChange={(e) => setReward(e.target.value)} />
      <input type="datetime-local" value={commitEndTime} onChange={(e) => setCommitEndTime(e.target.value)} placeholder="Commit End Time" />
      <input type="datetime-local" value={revealEndTime} onChange={(e) => setRevealEndTime(e.target.value)} placeholder="Reveal End Time" />
      <button onClick={createQuestion}>Submit Question</button>
    </div>
  );
};

export default QuestionForm;

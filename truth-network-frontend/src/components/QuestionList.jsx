import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getConstants } from "../constants";
import { getIdls } from "../idl";

const { PROGRAM_ID, DEFAULT_RPC_URL } = getConstants();

const QuestionsList = ({ refreshKey }) => {
  const [questions, setQuestions] = useState([]);
  const [sortOrder, setSortOrder] = useState("highest");
  const [loading, setLoading] = useState(false);
  const [totalVaultBalance, setTotalVaultBalance] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const navigate = useNavigate();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [connection] = useState(() => new web3.Connection(DEFAULT_RPC_URL, "confirmed"));
  // const [program, setProgram] = useState(null);
  const { truthNetworkIDL } = getIdls();
  const wallet = useMemo(() => ({
    publicKey: publicKey || new PublicKey("11111111111111111111111111111111"),
    signAllTransactions: async (txs) => txs,
    signTransaction: async (tx) => tx,
  }), [publicKey]);
  const provider = useMemo(() => {
    return new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
  }, [connection, wallet]);
  const program = useMemo(() => {
    return new Program(truthNetworkIDL, provider);
  }, [truthNetworkIDL, provider]);

  
  useEffect(() => {
    if (!program) return;
  
    // Always fetch when refreshKey changes
    fetchQuestions();
  
  }, [refreshKey, program]);
  
  useEffect(() => {
    if (!program) return;
  
    // Set up polling only once
    const interval = setInterval(() => {
      fetchQuestions();
    }, 300000); // 5 minutes
  
    return () => clearInterval(interval);
  }, [program]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const accounts = await program.account.question.all();
      const rentExemption = await connection.getMinimumBalanceForRentExemption(8);
  
      // Get vault PDAs for all questions
      const vaultPDAs = await Promise.all(
        accounts.map(async ({ publicKey: questionPubKey }) => {
          const [vaultPDA] = await PublicKey.findProgramAddress(
            [Buffer.from("vault"), questionPubKey.toBuffer()],
            PROGRAM_ID
          );
          return vaultPDA;
        })
      );
  
      const vaultAccountInfos = await connection.getMultipleAccountsInfo(vaultPDAs);
      const totalLamports = vaultAccountInfos.reduce((sum, acct) => sum + (acct?.lamports || 0), 0);
      const totalRewardLamports = Math.max(totalLamports - rentExemption * vaultAccountInfos.length, 0);
      setTotalVaultBalance(totalRewardLamports / web3.LAMPORTS_PER_SOL);
  
      // Prepare voterRecord PDAs if publicKey is connected
      let voterRecordPDAs = [];
      if (publicKey) {
        voterRecordPDAs = await Promise.all(
          accounts.map(async ({ publicKey: questionPubKey }) => {
            const [voterRecordPDA] = await PublicKey.findProgramAddress(
              [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
              PROGRAM_ID
            );
            return voterRecordPDA;
          })
        );
      }
  
      // Batch fetch all voterRecord accounts if applicable
      const voterRecordInfos = publicKey && voterRecordPDAs.length > 0
        ? await connection.getMultipleAccountsInfo(voterRecordPDAs)
        : [];
  
      // Parse all questions
      const parsedQuestions = await Promise.all(
        accounts.map(async ({ publicKey: questionPubKey, account }, index) => {
          const vaultInfo = vaultAccountInfos[index];
          const vaultBalance = vaultInfo?.lamports ?? 0;
          const rewardLamports = Math.max(vaultBalance - rentExemption, 0);
          const solReward = rewardLamports / web3.LAMPORTS_PER_SOL;
  
          const commitEndTime = account.commitEndTime.toNumber();
          const revealEndTime = account.revealEndTime.toNumber();
          const revealEnded = revealEndTime <= Date.now() / 1000;
          const committedVoters = account.committedVoters ? account.committedVoters.toNumber() : 0;
  
          let userVoterRecord = null;
  
          // Parse voter record if available
          if (publicKey && voterRecordInfos[index]) {
            try {
              const voterRecordAccount = program.account.voterRecord.coder.accounts.decode(
                "VoterRecord",
                voterRecordInfos[index].data
              );
  
              userVoterRecord = {
                selectedOption: voterRecordAccount.selectedOption,
                claimed: voterRecordAccount.claimed,
                revealed: voterRecordAccount.revealed,
                committed: true,
                voterRecordPDA: voterRecordPDAs[index].toString(),
              };
            } catch (err) {
              // decoding failed (might not be initialized)
            }
          }
  
          return {
            id: questionPubKey.toString(),
            questionText: account.questionText,
            reward: parseFloat(solReward.toFixed(4)),
            commitEndTime,
            revealEndTime,
            committedVoters,
            votesOption1: account.votesOption1.toNumber(),
            votesOption2: account.votesOption2.toNumber(),
            originalReward: account.originalReward?.toNumber?.() || 0,
            revealEnded,
            userVoterRecord,
          };
        })
      );
  
      // Sort and categorize questions
      const activeQuestions = parsedQuestions.filter(
        (q) => !q.revealEnded || (q.userVoterRecord && !q.userVoterRecord.claimed)
      );
      const endedQuestions = parsedQuestions.filter(
        (q) => q.revealEnded && (!q.userVoterRecord || q.userVoterRecord.claimed)
      );
  
      activeQuestions.sort((a, b) =>
        sortOrder === "highest" ? b.reward - a.reward : a.reward - b.reward
      );
  
      setQuestions([...activeQuestions, ...endedQuestions]);
    } catch (err) {
      if (
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("fetch failed") ||
        err.message.includes("NetworkError") ||
        err.message.includes("Failed to fetch") ||
        err.message.includes("429")
      ) {
        toast.error(
          <>
            <div className="font-semibold">⚠ Solana RPC Connection Error</div>
            <div>{err.message}</div>
            <div className="mt-2">
              You can try switching to a different RPC endpoint.
              <br />
              • Public RPCs:{" "}
              <a
                href="https://www.comparenodes.com/library/public-endpoints/solana/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-500"
              >
                View Public Solana RPCs
              </a>
              <br />
              • Paid RPCs (faster):{" "}
              <a
                href="https://www.helius.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-500"
              >
                Helius
              </a>
            </div>
          </>,
          {
            position: "top-center",
            autoClose: 12000,
          }
        );
      } else {
        toast.error(`Error fetching questions: ${err.message}`, {
          position: "top-center",
          autoClose: 5000,
        });
      }
    } finally {
      setLoading(false);
    }
  };
  

  const paginatedQuestions = questions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(questions.length / pageSize);

  return (
    <div className="container mx-auto px-6 py-6">
      <h2 className="text-2xl font-bold mb-4">All Events</h2>

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() =>
            setSortOrder((prev) => (prev === "highest" ? "lowest" : "highest"))
          }
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
        >
          Sort by {sortOrder === "highest" ? "Lowest" : "Highest"} Reward
        </button>

        {loading && (
          <div className="flex items-center text-blue-500">
            <svg
              className="animate-spin h-5 w-5 mr-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            Refreshing...
          </div>
        )}
      </div>
      <div className="flex text-sm text-gray-700 mb-2">
        Total Vaults: <span className="ml-1 font-semibold">{totalVaultBalance.toFixed(4)} SOL</span>
      </div>

      {paginatedQuestions.length === 0 ? (
        <p className="text-gray-600 text-center">No events found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {paginatedQuestions.map((q) => {
            const totalVotes = q.votesOption1 + q.votesOption2;
            const winningOption = q.votesOption1 >= q.votesOption2 ? 1 : 2;
            const winningVotes = winningOption === 1 ? q.votesOption1 : q.votesOption2;
            const winningPercentage = totalVotes > 0 ? (winningVotes / totalVotes) * 100 : 0;

            const isEligibleToClaim =
              q.revealEnded &&
              q.userVoterRecord &&
              q.userVoterRecord.selectedOption === winningOption &&
              !q.userVoterRecord.claimed &&
              totalVotes > 0 &&
              winningPercentage >= 51;

            const currentTime = new Date().getTime() / 1000;
            const userCanReveal =
              q.commitEndTime < currentTime &&
              q.revealEndTime > currentTime &&
              q.userVoterRecord?.committed &&
              !q.userVoterRecord?.revealed;

            const displayRewardLamports =
              q.originalReward > 0
                ? q.originalReward
                : q.reward * web3.LAMPORTS_PER_SOL;

            const displayReward = (displayRewardLamports / web3.LAMPORTS_PER_SOL).toFixed(4);

            return (
              <div
                key={q.id}
                className="bg-white shadow-md rounded-lg p-6 border border-gray-200 cursor-pointer hover:shadow-lg transition"
                onClick={() => navigate(`/question/${q.id}`)}
              >
                <h3 className="text-lg font-semibold mb-2">{q.questionText}</h3>
                <p className="text-gray-700"><strong>Reward:</strong> {displayReward} SOL</p>
                <p className="text-gray-700"><strong>Voters Committed:</strong> {q.committedVoters}</p>
                <p className="text-gray-700"><strong>Commit End Time:</strong> {new Date(q.commitEndTime * 1000).toLocaleString()}</p>
                <p className="text-gray-700"><strong>Reveal End Time:</strong> {new Date(q.revealEndTime * 1000).toLocaleString()}</p>

                {q.revealEnded ? (
                  <>
                    <p className="text-red-600 mt-2 font-semibold">Voting Period Ended</p>
                    <p className="text-gray-700"><strong>Winning Vote:</strong> {winningOption === 1 ? "True" : "False"}</p>
                    <p className="text-sm text-gray-700">
                      <strong>Votes:</strong> {q.votesOption1} - {q.votesOption2}
                    </p>
                    <p className="text-gray-700"><strong>Winning Percentage:</strong> {winningPercentage.toFixed(2)}%</p>
                  </>
                ) : new Date().getTime() / 1000 < q.commitEndTime ? (
                  <div className="flex items-center text-green-600">
                    <span className="text-lg">✔</span>
                    <p className="ml-2">Commit Period Active</p>
                  </div>
                ) : q.committedVoters === 0 ? (
                  <div className="flex items-center text-gray-500">
                    <span className="text-lg">ℹ</span>
                    <p className="ml-2">No votes committed</p>
                  </div>
                ) : (
                  <div className="flex items-center text-green-600">
                    <span className="text-lg">✔</span>
                    <p className="ml-2">Reveal Period Active</p>
                  </div>
                )}

                {isEligibleToClaim && (
                  <p className="mt-3 text-green-600 font-semibold text-center">
                    You can now claim your reward
                  </p>
                )}

                {userCanReveal && (
                  <p className="text-green-600 font-semibold mt-2">You can reveal your vote</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {questions.length > pageSize && (
        <div className="flex justify-center mt-8 space-x-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 rounded text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                prev * pageSize < questions.length ? prev + 1 : prev
              )
            }
            disabled={currentPage * pageSize >= questions.length}
            className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestionsList;

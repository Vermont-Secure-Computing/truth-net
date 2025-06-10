import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getConstants, getIDL } from "../constants";

const { PROGRAM_ID, getRpcUrl } = getConstants();

const QuestionsList = ({ refreshKey }) => {
  const [questions, setQuestions] = useState([]);
  const [sortOrder, setSortOrder] = useState("highest");
  const [loading, setLoading] = useState(false);
  const [totalVaultBalance, setTotalVaultBalance] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const navigate = useNavigate();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [connection] = useState(() => new web3.Connection(getRpcUrl(), "confirmed"));
  const [program, setProgram] = useState(null);

  const wallet = { publicKey, signTransaction, signAllTransactions };

  const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });


  useEffect(() => {
    const setupProgram = async () => {
      try {
        const idl = await getIDL();
        const walletAdapter = { publicKey, signTransaction, signAllTransactions };
        const provider = new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" });
        const programInstance = new Program(idl, provider);
        setProgram(programInstance);
      } catch (err) {
        console.error("Failed to setup program:", err);
        toast.error("Error initializing program.");
      }
    };

    if (publicKey) {
      setupProgram();
    }
  }, [publicKey]);

  useEffect(() => {
    if (!program || !publicKey) return;

    fetchQuestions(); // immediate fetch

    const interval = setInterval(() => {
      console.log("Fetching questions")
      fetchQuestions();
    }, 300000); // every 5 minutes

    return () => clearInterval(interval);
  }, [program, publicKey, refreshKey]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const accounts = await program.account.question.all();
      const rentExemption = await connection.getMinimumBalanceForRentExemption(8);

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

      let parsedQuestions = await Promise.all(
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
          if (publicKey) {
            try {
              const [voterRecordPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
              );
              const voterRecordAccount = await program.account.voterRecord.fetch(voterRecordPDA);
              userVoterRecord = {
                selectedOption: voterRecordAccount.selectedOption,
                claimed: voterRecordAccount.claimed,
                revealed: voterRecordAccount.revealed,
                committed: true,
                voterRecordPDA: voterRecordPDA.toString(),
              };
            } catch (error) {
              // no voter record found
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

      const activeQuestions = parsedQuestions.filter(
        (q) => !q.revealEnded || (q.userVoterRecord && !q.userVoterRecord.claimed)
      );
      const endedQuestions = parsedQuestions.filter(
        (q) => q.revealEnded && (!q.userVoterRecord || q.userVoterRecord.claimed)
      );

      activeQuestions.sort((a, b) =>
        sortOrder === "highest" ? b.reward - a.reward : a.reward - b.reward
      );

      const sortedQuestions = [...activeQuestions, ...endedQuestions];
      setQuestions(sortedQuestions);
    } catch (err) {
      toast.error(`Error fetching questions: ${err.message}`, {
        position: "top-center",
        autoClose: 5000,
      });
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

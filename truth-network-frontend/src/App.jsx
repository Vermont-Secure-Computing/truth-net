import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { ToastContainer } from "react-toastify";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import QuestionForm from "./components/QuestionForm";
import QuestionsList from "./components/QuestionList";
import QuestionDetail from "./components/QuestionDetail";
import JoinNetwork from "./components/JoinNetwork";
import VoterDashboard from "./components/VoterDashboard";
import idl from "./idl.json";

const PROGRAM_ID = new web3.PublicKey("5CmM5VFJWKDozFLZ27mWEJ2a1dK7ctXVMCwWteKbW2jT");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const App = () => {
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const navigate = useNavigate(); // Used for button navigation
    const [questions, setQuestions] = useState([]);
    const [sortOrder, setSortOrder] = useState("highest");

    const wallet = { publicKey, signTransaction, signAllTransactions };
    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
    const program = new Program(idl, provider);

    useEffect(() => {
        fetchQuestions();
    }, [publicKey]);

    const fetchQuestions = async () => {
        try {
            const accounts = await program.account.question.all();
            let parsedQuestions = await Promise.all(
                accounts.map(async ({ publicKey: questionPubKey, account }) => {
                    const solReward = (account.reward.toNumber() / 1_000_000_000).toFixed(7);
                    const commitEndTime = account.commitEndTime.toNumber();
                    const revealEndTime = account.revealEndTime.toNumber();
                    const revealEnded = account.revealEndTime.toNumber() <= Date.now() / 1000;
                    const committedVoters = account.committedVoters ? account.committedVoters.toNumber() : 0;
    
                    let userVoterRecord = null;
                    if (publicKey) {
                        try {
                            const [voterRecordPDA] = await PublicKey.findProgramAddress(
                                [
                                    Buffer.from("vote"),
                                    publicKey.toBuffer(),
                                    questionPubKey.toBuffer(),
                                ],
                                PROGRAM_ID
                            );
                            const voterRecordAccount = await program.account.voterRecord.fetch(voterRecordPDA);
    
                            userVoterRecord = {
                                selectedOption: voterRecordAccount.selectedOption,
                                claimed: voterRecordAccount.claimed,
                                revealed: voterRecordAccount.revealed,
                                voterRecordPDA: voterRecordPDA.toString(),
                            };
                        } catch (error) {
                            console.log("No voter record for question", questionPubKey.toString());
                        }
                    }
    
                    return {
                        id: questionPubKey.toString(),
                        questionText: account.questionText,
                        reward: parseFloat(solReward),
                        commitEndTime,
                        revealEndTime,
                        committedVoters: committedVoters,
                        votesOption1: account.votesOption1.toNumber(),
                        votesOption2: account.votesOption2.toNumber(),
                        revealEnded,
                        userVoterRecord,
                    };
                })
            );
    
            // ✅ Separate active and expired questions
            const activeQuestions = parsedQuestions.filter(
                (q) => !q.revealEnded || (q.userVoterRecord && !q.userVoterRecord.claimed)
            );
            const endedQuestions = parsedQuestions.filter(
                (q) => q.revealEnded && (!q.userVoterRecord || q.userVoterRecord.claimed)
            );
    
            // ✅ Sort active questions by reward
            activeQuestions.sort((a, b) =>
                sortOrder === "highest" ? b.reward - a.reward : a.reward - b.reward
            );
    
            // ✅ Keep expired questions but push them to the end
            const sortedQuestions = [...activeQuestions, ...endedQuestions];
    
            console.log("Sorted Questions:", sortedQuestions);
            setQuestions(sortedQuestions);
        } catch (error) {
            toast.error(`Error fetching questions: ${error.message}`, {
                position: "top-center",
                autoClose: 5000,
            });
        }
    };

    return (
        <div className="w-full min-h-screen bg-white text-black flex flex-col">
            <ToastContainer position="top-center" autoClose={5000} />
            {/* Header */}
            <header className="flex justify-between items-center bg-white text-black px-6 py-4 shadow-md rounded-lg">
            <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold">Decentralized Truth Network</h1>
                <a
                    href="https://github.com/Vermont-Secure-Computing/truth-net"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-black"
                    aria-label="GitHub Repository"
                >
                    <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    >
                    <path d="M12 0C5.37 0 0 5.373 0 12c0 5.302 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.727-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.082-.729.082-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.495.997.108-.775.418-1.305.76-1.605-2.665-.303-5.466-1.332-5.466-5.932 0-1.31.467-2.38 1.235-3.22-.123-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23.957-.266 1.983-.399 3.003-.403 1.02.004 2.047.137 3.006.403 2.29-1.552 3.296-1.23 3.296-1.23.654 1.653.242 2.873.12 3.176.77.84 1.233 1.91 1.233 3.22 0 4.61-2.804 5.625-5.475 5.922.43.372.813 1.103.813 2.222 0 1.604-.015 2.898-.015 3.293 0 .32.217.694.825.576C20.565 21.796 24 17.298 24 12c0-6.627-5.373-12-12-12z"/>
                    </svg>
                </a>
            </div>
                <nav className="flex items-center space-x-4">
                    {/* Navigation Buttons */}
                    <button 
                        onClick={() => navigate("/")} 
                        className="px-4 py-2 rounded-md transition duration-200 bg-white hover:bg-gray-300"
                    >
                        Home
                    </button>

                    {publicKey && (
                        <button 
                            onClick={() => navigate("/dashboard")} 
                            className="px-4 py-2 rounded-md transition duration-200 bg-white hover:bg-gray-300"
                        >
                            Dashboard
                        </button>
                    )}

                    <WalletMultiButton className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition duration-200" />
                    <JoinNetwork />
                </nav>
            </header>

            {/* Question Form - Only on Home */}
            <Routes>
                <Route path="/" element={
                    <div className="mt-6 px-6">
                        <QuestionForm fetchQuestions={fetchQuestions} />
                        <QuestionsList questions={questions} fetchQuestions={fetchQuestions} />
                    </div>
                } />
                <Route path="/question/:id" element={<QuestionDetail />} />
                <Route path="/dashboard" element={<VoterDashboard />} />
            </Routes>
        </div>
    );
};

export default App;

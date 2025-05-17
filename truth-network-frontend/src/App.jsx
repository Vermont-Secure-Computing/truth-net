// Updated App.jsx
import React, { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import QuestionForm from "./components/QuestionForm";
import QuestionsList from "./components/QuestionList";
import QuestionDetail from "./components/QuestionDetail";
import JoinNetwork from "./components/JoinNetwork";
import VoterDashboard from "./components/VoterDashboard";
import VotersList from "./components/VotersList";
import Instruction from "./components/Instruction";
import { getRpcUrl, resetRpcUrl } from "./constant";

const App = () => {
    const { publicKey } = useWallet();
    const navigate = useNavigate();
    const [showQuestionForm, setShowQuestionForm] = useState(false);
    const [showRpcModal, setShowRpcModal] = useState(false);
    const [rpcUrl, setRpcUrl] = useState(() => getRpcUrl());
    const [refreshKey, setRefreshKey] = useState(0);
    const [isMember, setIsMember] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
    return (
      <div className="w-full min-h-screen bg-white text-black flex flex-col">
        <ToastContainer position="top-center" autoClose={5000} />
  
        <header className="bg-white text-black shadow-md w-full">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center relative">
            <div className="flex items-center space-x-2">
              <h1><img src="/logo.png" alt="My Logo" className="logo-img" /></h1>
              <a
                href="https://github.com/Vermont-Secure-Computing/truth-net"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
                >
                <img
                    src="/gittruth.png"
                    alt="GitHub Logo"
                    className="h-6 w-auto object-contain"
                />
            </a>
            </div>
  
            <nav className="hidden md:flex items-center space-x-4">
              <button onClick={() => navigate("/")} className="px-4 py-2 rounded-md bg-white hover:bg-gray-300">Home</button>
              {publicKey && <button onClick={() => navigate("/dashboard")} className="px-4 py-2 rounded-md bg-white hover:bg-gray-300">Dashboard</button>}
              <button onClick={() => navigate("/voters")} className="px-4 py-2 rounded-md bg-white hover:bg-gray-300">Voters</button>
              <button onClick={() => setShowRpcModal(true)} className="px-4 py-2 rounded-md bg-white hover:bg-gray-300">Change RPC</button>
              <button onClick={() => navigate("/instructions")} className="px-4 py-2 rounded-md bg-white hover:bg-gray-300">Instructions</button>
              <WalletMultiButton className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md" />
            </nav>
  
            <div className="md:hidden">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-blue-600 hover:text-blue-800" aria-label="Toggle menu">
                {mobileMenuOpen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
  
            {mobileMenuOpen && (
              <div className="absolute top-full left-0 w-full md:hidden px-6 py-4 space-y-2 bg-gray-100 border-b z-10">
                <button onClick={() => { navigate("/"); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-md bg-white hover:bg-gray-300">Home</button>
                {publicKey && <button onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-md bg-white hover:bg-gray-300">Dashboard</button>}
                <button onClick={() => { navigate("/voters"); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-md bg-white hover:bg-gray-300">Voters</button>
                <button onClick={() => { setShowRpcModal(true); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-md bg-white hover:bg-gray-300">Change RPC</button>
                <button onClick={() => { navigate("/instructions"); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-md bg-white hover:bg-gray-300">Instructions</button>
                <div className="pt-2">
                  <WalletMultiButton className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md" />
                </div>
              </div>
            )}
          </div>
        </header>
  
        <div className="px-6 mt-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-2">
              <h2 className="text-xl font-semibold mb-1">Truth Network Membership</h2>
              {!publicKey ? (
                <p className="text-gray-700">Please connect your wallet first.</p>
              ) : (
                <p className="text-gray-700">
                  {isMember ? "You are a Registered Truth Provider." : "You are not registered."}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <JoinNetwork compact updateIsMember={setIsMember} />
              <button onClick={() => setShowQuestionForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">Create a Truth Event</button>
            </div>
          </div>
        </div>
  
        {showQuestionForm && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}>
            <div className="bg-white pt-12 pb-6 px-6 rounded-lg w-full max-w-lg mx-auto shadow-xl relative">
              <button onClick={() => setShowQuestionForm(false)} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 text-xl">&times;</button>
              <QuestionForm onClose={() => setShowQuestionForm(false)} triggerRefresh={() => setRefreshKey(k => k + 1)} />
            </div>
          </div>
        )}
  
        {showRpcModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}>
            <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-lg relative">
              <button onClick={() => setShowRpcModal(false)} className="absolute top-2 right-3 text-gray-600 hover:text-gray-900 text-xl">&times;</button>
              <h2 className="text-lg font-semibold mb-4">Change Solana RPC URL</h2>
              <input type="text" value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} className="w-full border px-3 py-2 rounded" />
              <div className="mt-4 flex justify-end space-x-2">
                <button onClick={() => setShowRpcModal(false)} className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400">Cancel</button>
                <button onClick={() => { if (rpcUrl.startsWith("http")) { localStorage.setItem("solana_rpc_url", rpcUrl); window.location.reload(); } else { alert("Please enter a valid RPC URL."); } }} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Save & Reload</button>
                <button onClick={() => { resetRpcUrl(); window.location.reload(); }} className="px-4 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600">Reset to Default</button>
              </div>
            </div>
          </div>
        )}
  
        <Routes>
          <Route path="/" element={<QuestionsList refreshKey={refreshKey} />} />
          <Route path="/question/:id" element={<QuestionDetail />} />
          <Route path="/dashboard" element={<VoterDashboard />} />
          <Route path="/voters" element={<VotersList />} />
          <Route path="/instructions" element={<Instruction />} />
        </Routes>
      </div>
    );
  };

export default App;

import React, { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import QuestionForm from "./components/QuestionForm";
import QuestionsList from "./components/QuestionList";
import HelloWorld from "./components/HelloWorld";
import VotersList from "./components/VotersList";
import JoinNetwork from "./components/JoinNetwork";
import VoterDashboard from "./components/VoterDashboard";

const App = () => {
    const { publicKey } = useWallet();
    const [activeTab, setActiveTab] = useState("home");

    return (
        <div className="w-full min-h-screen bg-white text-black flex flex-col">
            {/* Header */}
            <header className="flex justify-between items-center bg-white text-black px-6 py-4 shadow-md rounded-lg">
                <h1 className="text-xl font-bold">Decentralized Truth Network</h1>
                <nav className="flex items-center space-x-4">
                    <button 
                        onClick={() => setActiveTab("home")} 
                        className={`px-4 py-2 rounded-md transition duration-200 ${
                            activeTab === "home" ? "bg-blue-500 text-white" : "bg-white hover:bg-gray-600"
                        }`}
                    >
                        Home
                    </button>
                    {publicKey && (
                        <button 
                            onClick={() => setActiveTab("dashboard")} 
                            className={`px-4 py-2 rounded-md transition duration-200 ${
                                activeTab === "dashboard" ? "bg-blue-500 text-white" : "bg-white hover:bg-gray-600"
                            }`}
                        >
                            Dashboard
                        </button>
                    )}
                    <WalletMultiButton className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition duration-200" />
                    <JoinNetwork />
                </nav>
            </header>

            {/* Content */}
            <main className="mt-6">
                {activeTab === "home" ? (
                    <>
                        <QuestionForm />
                        <QuestionsList />
                        <HelloWorld />
                        <VotersList />
                    </>
                ) : (
                    <VoterDashboard />
                )}
            </main>
        </div>
    );
};

export default App;

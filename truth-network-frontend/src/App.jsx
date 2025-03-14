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
        <div className="container">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '2px solid #ccc' }}>
                <h1 style={{ margin: 0 }}>Decentralized Truth Network</h1>
                <nav>
                    <button onClick={() => setActiveTab("home")} style={{ marginRight: "10px" }}>Home</button>
                    {publicKey && <button onClick={() => setActiveTab("dashboard")} style={{ marginRight: "10px" }}>Dashboard</button>}
                    <WalletMultiButton />
                    <JoinNetwork />
                </nav>
            </header>
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
        </div>
    );
};

export default App;

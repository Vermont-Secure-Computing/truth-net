import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import QuestionForm from "./components/QuestionForm";
import VotingComponent from "./components/VotingComponent";
import QuestionsList from "./components/QuestionList";
import HelloWorld from "./components/HelloWorld";
import VotersList from "./components/VotersList";
import JoinNetwork from "./components/JoinNetwork";


const App = () => {
    return (
        <div className="container">
            <h1>Decentralized Truth Network</h1>
            <WalletMultiButton />
            <JoinNetwork />
            <QuestionForm />
            {/* <VotingComponent /> */}
            <QuestionsList />
            <HelloWorld />
            <VotersList />
        </div>
    );
};

export default App;

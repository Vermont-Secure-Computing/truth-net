import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import QuestionForm from "./components/QuestionForm";
import VotingComponent from "./components/VotingComponent";
import QuestionsList from "./components/QuestionList";
import HelloWorld from "./components/HelloWorld";


const App = () => {
    return (
        <div className="container">
            <h1>Decentralized Truth Network</h1>
            <WalletMultiButton />
            <QuestionForm />
            {/* <VotingComponent /> */}
            <QuestionsList />
            <HelloWorld />
        </div>
    );
};

export default App;

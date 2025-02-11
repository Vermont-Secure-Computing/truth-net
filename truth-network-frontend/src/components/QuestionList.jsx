import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";
import VotingComponent from "./VotingComponent"; 

const PROGRAM_ID = new PublicKey("HgSmSrv53KqXTNmM1MtLKAQLbbyr9sVSc5KG23YK1jzE");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const QuestionsList = () => {
    const { connection } = useConnection();
    const [questions, setQuestions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState(null);

    // Setup Provider & Program
    const provider = new AnchorProvider(connection, { publicKey: null }, { preflightCommitment: "processed" });
    const program = new Program(idl, provider);

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        try {
            console.log("Fetching questions...");

            // Fetch all questions
            const accounts = await program.account.question.all();

            // Decode data properly
            const parsedQuestions = accounts.map(({ publicKey, account }) => ({
                id: publicKey.toString(),
                questionText: account.questionText,
                option1: account.option1,
                option2: account.option2,
                votesOption1: account.votesOption1.toNumber(),
                votesOption2: account.votesOption2.toNumber(),
                endTime: account.endTime.toNumber(),
                finalized: account.finalized,
            }));

            console.log("Fetched Questions:", parsedQuestions);
            setQuestions(parsedQuestions);
        } catch (error) {
            console.error("Error fetching questions:", error);
        }
    };

    return (
        <div>
            <h2>All Questions</h2>
            {questions.length === 0 ? (
                <p>No questions found.</p>
            ) : (
                <ul>
                    {questions.map((q) => (
                        <li key={q.id}>
                            <strong>{q.questionText}</strong>
                            <br />
                            Option 1: {q.option1} ({q.votesOption1} votes)
                            <br />
                            Option 2: {q.option2} ({q.votesOption2} votes)
                            <br />
                            Voting Ends: {new Date(q.endTime * 1000).toLocaleString()}
                            <br />
                            {!q.finalized && (
                                <button onClick={() => setSelectedQuestion(q)}>Vote</button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {selectedQuestion && (
                <VotingComponent
                    question={selectedQuestion}
                    onClose={() => {
                        setSelectedQuestion(null);
                        fetchQuestions();
                    }}
                />
            )}
        </div>
    );
};

export default QuestionsList;

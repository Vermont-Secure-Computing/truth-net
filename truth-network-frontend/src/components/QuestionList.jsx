import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";
import VotingComponent from "./VotingComponent";
import CommitReveal from "./CommitReveal";

const PROGRAM_ID = new PublicKey("3aoJ7CfsFPQP7MVFVDZtQ3xAGr5R7ZSsDHybvscaWtd6");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const QuestionsList = () => {
    const { connection: walletConnection } = useConnection();
    const [questions, setQuestions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [voterListPDA, setVoterListPDA] = useState(null);

    const provider = new AnchorProvider(connection, { publicKey: null }, { preflightCommitment: "processed" });
    const program = new Program(idl, provider);

    useEffect(() => {
        fetchQuestions();
        fetchVoterListPDA();

        const handleQuestionCreated = () => {
            fetchQuestions();
        };
        window.addEventListener("questionCreated", handleQuestionCreated);

        return () => {
            window.removeEventListener("questionCreated", handleQuestionCreated);
        };
    }, [walletConnection]);

    const fetchVoterListPDA = async () => {
        try {
            const [voterListAddress] = await PublicKey.findProgramAddressSync(
                [Buffer.from("voter_list")],
                PROGRAM_ID
            );
            setVoterListPDA(voterListAddress.toString());
            console.log("Voter List PDA:", voterListAddress.toString());
        } catch (error) {
            console.error("Error fetching Voter List PDA:", error);
        }
    };

    const fetchQuestions = async () => {
        try {
            console.log("Fetching questions...");
            const accounts = await program.account.question.all();
            console.log("Accounts: ", accounts);

            const parsedQuestions = accounts.map(({ publicKey, account }) => ({
                id: publicKey.toString(),
                questionText: account.questionText,
                option1: account.option1,
                option2: account.option2,
                votesOption1: account.votesOption1.toNumber(),
                votesOption2: account.votesOption2.toNumber(),
                committedVoters: account.committedVoters.toNumber(),
                commitEndTime: account.commitEndTime.toNumber(),
                revealEndTime: account.revealEndTime.toNumber(),
                finalized: account.finalized,
                asker: account.asker.toString(),
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
                        <li key={q.id} style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
                            <strong>{q.questionText}</strong>
                            <br />
                            <span>
                                <strong>Question PDA:</strong>{" "}
                                <a
                                    href={`https://explorer.solana.com/address/${q.id}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: "#007bff", textDecoration: "underline" }}
                                >
                                    {q.id}
                                </a>
                            </span>
                            <br />
                            <strong>Number of Committed Voters:</strong> {q.committedVoters}
                            <br />
                            Commit Phase Ends: {new Date(q.commitEndTime * 1000).toLocaleString()}
                            <br />
                            Reveal Phase Ends: {new Date(q.revealEndTime * 1000).toLocaleString()}
                            <br />
                            {q.revealEndTime > Date.now() / 1000 ? (
                                <button onClick={() => setSelectedQuestion(q)}>Vote</button>
                            ) : <p className="text-green-600">Voting Period Ended</p>}
                        </li>
                    ))}
                </ul>
            )}

            {selectedQuestion && (
                <CommitReveal
                    question={selectedQuestion}
                    onClose={() => {
                        setSelectedQuestion(null);
                        fetchQuestions();
                    }}
                    refreshQuestions={fetchQuestions}
                />
            )}
        </div>
    );
};

export default QuestionsList;

// import React, { useState, useEffect } from "react";
// import { PublicKey } from "@solana/web3.js";
// import { useConnection } from "@solana/wallet-adapter-react";
// import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
// import idl from "../idl.json";
// import VotingComponent from "./VotingComponent"; 

// const PROGRAM_ID = new PublicKey("DptmJmiZNi4wC6TbumzvkkoAyURYXwBTs5ehb9CkMJ3F");
// const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

// const QuestionsList = () => {
//     const { connection } = useConnection();
//     const [questions, setQuestions] = useState([]);
//     const [selectedQuestion, setSelectedQuestion] = useState(null);

//     // Setup Provider & Program
//     const provider = new AnchorProvider(connection, { publicKey: null }, { preflightCommitment: "processed" });
//     const program = new Program(idl, provider);

//     useEffect(() => {
//         fetchQuestions();
//     }, []);

//     const fetchQuestions = async () => {
//         try {
//             console.log("Fetching questions...");
//             const accounts = await program.account.question.all();
//             console.log("Accounts: ", accounts);

//             // Decode data properly
//             const parsedQuestions = accounts.map(({ publicKey, account }) => ({
//                 id: publicKey.toString(), // PDA of the question
//                 questionText: account.questionText,
//                 option1: account.option1,
//                 option2: account.option2,
//                 votesOption1: account.votesOption1.toNumber(),
//                 votesOption2: account.votesOption2.toNumber(),
//                 endTime: account.endTime.toNumber(),
//                 finalized: account.finalized,
//                 asker: account.asker.toString(),
//             }));

//             console.log("Fetched Questions:", parsedQuestions);
//             setQuestions(parsedQuestions);
//         } catch (error) {
//             console.error("Error fetching questions:", error);
//         }
//     };

//     return (
//         <div>
//             <h2>All Questions</h2>
//             {questions.length === 0 ? (
//                 <p>No questions found.</p>
//             ) : (
//                 <ul>
//                     {questions.map((q) => (
//                         <li key={q.id} style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
//                             <strong>{q.questionText}</strong>
//                             <br />
//                             <span>
//                                 <strong>Question PDA:</strong>{" "}
//                                 <a
//                                     href={`https://explorer.solana.com/address/${q.id}?cluster=devnet`}
//                                     target="_blank"
//                                     rel="noopener noreferrer"
//                                     style={{ color: "#007bff", textDecoration: "underline" }}
//                                 >
//                                     {q.id}
//                                 </a>
//                             </span>
//                             <br />
//                             <br />
//                             Option 1: {q.option1} ({q.votesOption1} votes)
//                             <br />
//                             Option 2: {q.option2} ({q.votesOption2} votes)
//                             <br />
//                             Voting Ends: {new Date(q.endTime * 1000).toLocaleString()}
//                             <br />
//                             {!q.finalized && (
//                                 <button onClick={() => setSelectedQuestion(q)}>Vote</button>
//                             )}
//                         </li>
//                     ))}
//                 </ul>
//             )}

//             {selectedQuestion && (
//                 <VotingComponent
//                     question={selectedQuestion}
//                     onClose={() => {
//                         setSelectedQuestion(null);
//                         fetchQuestions();
//                     }}
//                 />
//             )}
//         </div>
//     );
// };

// export default QuestionsList;


import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";
import VotingComponent from "./VotingComponent";
import CommitReveal from "./CommitReveal";

const PROGRAM_ID = new PublicKey("BpXZ9RDbqdRjpLNeG8SQTbD2MjyyNMNgKEngEZG9Fvdw");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const QuestionsList = () => {
    const { connection } = useConnection();
    const [questions, setQuestions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [voterListPDA, setVoterListPDA] = useState(null);

    // Setup Provider & Program
    const provider = new AnchorProvider(connection, { publicKey: null }, { preflightCommitment: "processed" });
    const program = new Program(idl, provider);

    useEffect(() => {
        fetchQuestions();
        fetchVoterListPDA();
    }, []);

    // **Fetch the Voter List PDA**
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

    // **Fetch Questions**
    const fetchQuestions = async () => {
        try {
            console.log("Fetching questions...");
            const accounts = await program.account.question.all();
            console.log("Accounts: ", accounts);

            // Decode data properly
            const parsedQuestions = accounts.map(({ publicKey, account }) => ({
                id: publicKey.toString(), // PDA of the question
                questionText: account.questionText,
                option1: account.option1,
                option2: account.option2,
                votesOption1: account.votesOption1.toNumber(),
                votesOption2: account.votesOption2.toNumber(),
                committedVoters: account.committedVoters.toNumber(),
                endTime: account.endTime.toNumber(),
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
            
            {/* Display Voter List PDA */}
            {/* {voterListPDA && (
                <p>
                    <strong>Voter List PDA:</strong>{" "}
                    <a
                        href={`https://explorer.solana.com/address/${voterListPDA}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#007bff", textDecoration: "underline" }}
                    >
                        {voterListPDA}
                    </a>
                </p>
            )} */}

            {questions.length === 0 ? (
                <p>No questions found.</p>
            ) : (
                <ul>
                    {questions.map((q) => (
                        <li key={q.id} style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
                            <strong>{q.questionText}</strong>
                            <br />
                            
                            {/* Display Question PDA */}
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

                            <br />
                            <strong>Number of Committed Voters:</strong> {q.committedVoters}
                            <br />
                            Voting Ends: {new Date(q.endTime * 1000).toLocaleString()}
                            <br />
                            {/* Check if the voting is still open */}
                            {q.endTime > Date.now() / 1000 ? (
                                <button onClick={() => setSelectedQuestion(q)}>Vote</button>
                            ): <p className="text-green-600">Voting Period Ends</p>} 
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


import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";

const PROGRAM_ID = new PublicKey("CaKtVz5bhapzdaxr8r5Sx6Jq8ZnanXFNTwY6oCCCVuFP");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const VotingComponent = ({ question, onClose }) => {
    if (!question) {
        return <p>Error: Question data is missing.</p>;
    }

    const questionId = question.id;
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [selectedOption, setSelectedOption] = useState(1);
    const [loading, setLoading] = useState(false);
    const [votes, setVotes] = useState([]);
    // const [isEligible, setIsEligible] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);

    const walletAdapter = publicKey && signTransaction ? { publicKey, signTransaction, signAllTransactions } : null;

    // Ensure a valid provider before creating a program instance
    const provider = walletAdapter ? new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" }) : null;
    const program = provider ? new Program(idl, provider) : null;

    useEffect(() => {
        if (publicKey && program) {
            // checkEligibility();
            checkIfVoted();
        }
    }, [question]);

    // **Check if the user is in the question's voter list**
    const checkEligibility = async () => {
        if (!publicKey || !program) {
            console.log("No publicKey or program")   
            return;
        }

        try {
            console.log("Checking voter eligibility...");

            // Ensure `questionId` is a valid PublicKey
            const questionPubKey = new PublicKey(questionId);

            // Fetch the question account
            const questionAccount = await program.account.question.fetch(questionPubKey);
            if (!questionAccount) {
                console.error("Question account not found.");
                return;
            }

            // Check if the user's wallet is in the `selected_voters` list
            const isMember = questionAccount.selectedVoters.some((voter) => voter.toString() === publicKey.toString());

            console.log("User eligibility:", isMember);
            // setIsEligible(isMember);
        } catch (error) {
            console.error("Error checking eligibility:", error);
        }
    };

    const checkIfVoted = async () => {
        if (!publicKey || ! program) return;

        try {
            console.log("Checking if user has already voted...");
    
            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );
    
            const voterRecordAccount = await program.account.voterRecord.fetch(voterRecordPDA).catch(() => null);
            console.log("voter record account ", voterRecordAccount)
            if (voterRecordAccount) {
                console.log("User has already voted.");
                setHasVoted(true);
            } else {
                console.log("User has not voted yet.");
                setHasVoted(false);
            }
    
        } catch (error) {
            console.error("Error checking vote status:", error);
        }
    }

    

    // **Fetch all votes for the question**
    const fetchVotes = async () => {
        if (!program) return;
    
        try {
            console.log("Fetching selected voters for question:", questionId);
    
            // Ensure `questionId` is a valid PublicKey
            const questionPubKey = new PublicKey(questionId);
    
            // Fetch the `Question` account to get `selected_voters`
            const questionAccount = await program.account.question.fetch(questionPubKey);
            if (!questionAccount) {
                console.error("Question account not found.");
                return;
            }
    
            console.log("Question data:", questionAccount);
    
            // Extract selected voters
            const selectedVoters = questionAccount.selectedVoters.map((voter) => ({
                voter: voter.toString(),
            }));

            // Check if the user has already voted (logic: if the user exists in votes)
            const userHasVoted = selectedVoters.includes(publicKey.toString()) && 
            (questionAccount.votes_option_1 > 0 || questionAccount.votes_option_2 > 0);
            console.log("user has voted: ", userHasVoted)
            setHasVoted(userHasVoted)
    
            console.log("Selected voters:", selectedVoters);
            setVotes(selectedVoters);
        } catch (error) {
            console.error("Error fetching votes:", error);
        }
    };
    

    // **Submit Vote**
    const submitVote = async () => {
        if (!publicKey || !program) return alert("Please connect your wallet");

        try {
            console.log("Submitting vote for question:", questionId);

            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );

            setLoading(true);

            // Submit the vote
            const tx = await program.methods
                .submitVote(selectedOption)
                .accounts({
                    voter: publicKey,
                    question: questionPubKey,
                    voterRecord: voterRecordPDA,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();

            console.log("Vote Submitted! Transaction:", tx);
            alert("Vote Submitted Successfully!");

            // Refresh votes after submitting
            //fetchVotes();
            checkIfVoted();
        } catch (error) {
            console.error("Failed to submit vote:", error);
            alert(`Failed to submit vote. Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <h2>{question.questionText}</h2>
            <p>Choose an option:</p>
            <select onChange={(e) => setSelectedOption(parseInt(e.target.value, 10))}>
                <option value={1}>{question.option1}</option>
                <option value={2}>{question.option2}</option>
            </select>
            <br />
            <button onClick={submitVote} disabled={hasVoted || loading}>
                {loading ? "Submitting..." : hasVoted ? "Already Voted" : "Submit Vote"}
            </button>
            <button onClick={onClose}>Close</button>

            <hr />
            <h3>Selected Voters</h3>
            {votes.length > 0 && (
                <ul>
                    {votes.map((vote, index) => (
                        <li key={index}>
                            <strong>Voter:</strong>{" "}
                            <a
                                href={`https://explorer.solana.com/address/${vote.voter}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#007bff", textDecoration: "underline" }}
                            >
                                {vote.voter}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default VotingComponent;

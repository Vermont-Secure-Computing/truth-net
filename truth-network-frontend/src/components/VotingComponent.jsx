import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import idl from "../idl.json";

const PROGRAM_ID = new PublicKey("E3791ATbxae3NKVRVD3quBAxav5acfTN7rTxUA6NNLsd");
const connection = new web3.Connection(web3.clusterApiUrl("mainnet-beta"), "confirmed");

const VotingComponent = ({ question, onClose }) => {
    if (!question) {
        return <p>Error: Question data is missing.</p>;
    }

    const questionId = question.id;
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [selectedOption, setSelectedOption] = useState(1);
    const [loading, setLoading] = useState(false);
    const [votes, setVotes] = useState([]);
    const [hasVoted, setHasVoted] = useState(false);

    const walletAdapter = publicKey && signTransaction ? { publicKey, signTransaction, signAllTransactions } : null;
    const provider = walletAdapter ? new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" }) : null;
    const program = provider ? new Program(idl, provider) : null;

    useEffect(() => {
        if (publicKey && program) {
            checkIfVoted();
        }
    }, [question]);

    const checkIfVoted = async () => {
        if (!publicKey || !program) return;

        try {
            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );

            const voterRecordAccount = await program.account.voterRecord.fetch(voterRecordPDA).catch(() => null);
            
            if (voterRecordAccount) {
                toast.info("You have already voted.", { position: "top-center" });
                setHasVoted(true);
            } else {
                toast.info("You have not voted yet.", { position: "top-center" });
                setHasVoted(false);
            }
        } catch (error) {
            toast.error(`Error checking vote status: ${error.message}`, { position: "top-center", autoClose: 5000 });
        }
    };

    const fetchVotes = async () => {
        if (!program) return;
    
        try {
            const questionPubKey = new PublicKey(questionId);
            const questionAccount = await program.account.question.fetch(questionPubKey);
            if (!questionAccount) {
                toast.error("Question account not found.", { position: "top-center" });
                return;
            }

            const selectedVoters = questionAccount.selectedVoters.map((voter) => ({
                voter: voter.toString(),
            }));

            const userHasVoted = selectedVoters.includes(publicKey.toString()) && 
                (questionAccount.votes_option_1 > 0 || questionAccount.votes_option_2 > 0);
            setHasVoted(userHasVoted);
            setVotes(selectedVoters);
        } catch (error) {
            toast.error(`Error fetching votes: ${error.message}`, { position: "top-center", autoClose: 5000 });
        }
    };

    const submitVote = async () => {
        if (!publicKey || !program) {
            toast.warn("Please connect your wallet.", { position: "top-center" });
            return;
        }

        try {
            toast.info("Submitting your vote...", { position: "top-center" });

            const questionPubKey = new PublicKey(questionId);
            const [voterRecordPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vote"), publicKey.toBuffer(), questionPubKey.toBuffer()],
                PROGRAM_ID
            );

            setLoading(true);

            const tx = await program.methods
                .submitVote(selectedOption)
                .accounts({
                    voter: publicKey,
                    question: questionPubKey,
                    voterRecord: voterRecordPDA,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();

            toast.success(`Vote Submitted Successfully! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
                position: "top-center",
                autoClose: 5000,
                onClick: () => window.open(`https://explorer.solana.com/tx/${tx}?cluster=mainnet-beta`, "_blank"),
            });

            checkIfVoted();
        } catch (error) {
            toast.error(`Failed to submit vote: ${error.message}`, { position: "top-center", autoClose: 5000 });
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
                                href={`https://explorer.solana.com/address/${vote.voter}?cluster=mainnet-beta`}
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

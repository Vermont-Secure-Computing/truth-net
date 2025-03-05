import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";

const PROGRAM_ID = new PublicKey("Af4GKPVNrHLHuYAgqkT4KiFFL2aJFyfRThrMrC2wjshf");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const VotersList = () => {
    const { connection } = useConnection();
    const [voters, setVoters] = useState([]);

    // Setup Provider & Program
    const provider = new AnchorProvider(connection, { publicKey: null }, { preflightCommitment: "processed" });
    const program = new Program(idl, provider);

    useEffect(() => {
        fetchVoters();
    }, []);

    const fetchVoters = async () => {
        try {
            console.log("Fetching registered voters...");

            // Fetch the Voter List account
            const [voterListPDA] = await PublicKey.findProgramAddressSync(
                [Buffer.from("voter_list")],
                PROGRAM_ID
            );

            const voterListAccount = await program.account.voterList.fetch(voterListPDA);
            console.log("Voter List Account:", voterListAccount);

            // Decode data properly
            const parsedVoters = voterListAccount.voters.map((voter, index) => ({
                index: index + 1,
                address: voter.address.toString(),
                reputation: voter.reputation,
            }));

            console.log("Fetched Voters:", parsedVoters);
            setVoters(parsedVoters);
        } catch (error) {
            console.error("Error fetching voters:", error);
        }
    };

    return (
        <div>
            <h2>Registered Voters</h2>
            {voters.length === 0 ? (
                <p>No voters found.</p>
            ) : (
                <table border="1" cellPadding="5">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Voter Address</th>
                            <th>Reputation</th>
                            <th>Explorer</th>
                        </tr>
                    </thead>
                    <tbody>
                        {voters.map((voter) => (
                            <tr key={voter.address}>
                                <td>{voter.index}</td>
                                <td>{voter.address}</td>
                                <td>{voter.reputation}</td>
                                <td>
                                    <a
                                        href={`https://explorer.solana.com/address/${voter.address}?cluster=devnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: "#007bff", textDecoration: "underline" }}
                                    >
                                        View on Solana Explorer
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default VotersList;

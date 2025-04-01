import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const PROGRAM_ID = new PublicKey("FU9yzzBojVdo9oX6nYmB7bE3upgfzSfznHuSCaY5ejmJ");
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

// toast.configure();

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
      toast.info("Fetching registered voters...");

      const [voterListPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("voter_list")],
        PROGRAM_ID
      );

      const voterListAccount = await program.account.voterList.fetch(voterListPDA);

      const parsedVoters = voterListAccount.voters.map((voter, index) => ({
        index: index + 1,
        address: voter.address.toString(),
        reputation: voter.reputation,
        totalEarnings: voter.totalEarnings.toString(),
        totalRevealedVotes: voter.totalRevealedVotes.toString(),
        totalCorrectVotes: voter.totalCorrectVotes.toString(),
      }));

      toast.success("Voters fetched successfully!");
      setVoters(parsedVoters);
    } catch (error) {
      toast.error("Error fetching voters: " + error.message);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Registered Voters</h2>
      {voters.length === 0 ? (
        <p>No voters found.</p>
      ) : (
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">#</th>
              <th className="p-2 border">Voter Address</th>
              <th className="p-2 border">Reputation</th>
              <th className="p-2 border">Total Earnings (Lamports)</th>
              <th className="p-2 border">Total Revealed Votes</th>
              <th className="p-2 border">Total Correct Votes</th>
              <th className="p-2 border">Explorer</th>
            </tr>
          </thead>
          <tbody>
            {voters.map((voter) => (
              <tr key={voter.address} className="hover:bg-gray-50">
                <td className="p-2 border">{voter.index}</td>
                <td className="p-2 border">{voter.address}</td>
                <td className="p-2 border">{voter.reputation}</td>
                <td className="p-2 border">{voter.totalEarnings}</td>
                <td className="p-2 border">{voter.totalRevealedVotes}</td>
                <td className="p-2 border">{voter.totalCorrectVotes}</td>
                <td className="p-2 border">
                  <a
                    href={`https://explorer.solana.com/address/${voter.address}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
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

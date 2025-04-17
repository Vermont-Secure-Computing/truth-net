import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import idl from "../idl.json";
import { PROGRAM_ID } from "../constant";

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
        <div className="space-y-4">
          {/* Table view for medium+ screens */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">#</th>
                  <th className="p-2 border">Voter Address</th>
                  <th className="p-2 border">Reputation</th>
                  <th className="p-2 border">Total Earnings</th>
                  <th className="p-2 border">Revealed Votes</th>
                  <th className="p-2 border">Correct Votes</th>
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
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card view for small screens */}
          <div className="md:hidden space-y-4">
            {voters.map((voter) => (
              <div key={voter.address} className="border rounded-md p-4 shadow-sm bg-white">
                <p><span className="font-semibold">#</span> {voter.index}</p>
                <p><span className="font-semibold">Address:</span> {voter.address}</p>
                <p><span className="font-semibold">Reputation:</span> {voter.reputation}</p>
                <p><span className="font-semibold">Total Earnings:</span> {voter.totalEarnings}</p>
                <p><span className="font-semibold">Revealed Votes:</span> {voter.totalRevealedVotes}</p>
                <p><span className="font-semibold">Correct Votes:</span> {voter.totalCorrectVotes}</p>
                <a
                  href={`https://explorer.solana.com/address/${voter.address}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline block mt-1"
                >
                  View on Explorer
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>


  );
};

export default VotersList;

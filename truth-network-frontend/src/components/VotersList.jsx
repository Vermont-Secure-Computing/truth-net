import React, { useState, useEffect } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { toast } from "react-toastify";
import { deserializeUnchecked } from "borsh";
import BN from "bn.js";
import { getConstants } from "../constants";
import "react-toastify/dist/ReactToastify.css";

const { PROGRAM_ID, getWorkingRpcUrl } = getConstants();
const clusterParam = import.meta.env.VITE_NETWORK === "mainnet" ? "" : "?cluster=devnet";
// Define UserRecord structure
class UserRecord {
  constructor(fields) {
    this.user = fields.user;
    this.reputation = fields.reputation;
    this.total_earnings = new BN(fields.total_earnings, 10);
    this.total_revealed_votes = new BN(fields.total_revealed_votes, 10);
    this.total_correct_votes = new BN(fields.total_correct_votes, 10);
  }
}

const USER_RECORD_SCHEMA = new Map([
  [
    UserRecord,
    {
      kind: "struct",
      fields: [
        ["user", [32]],
        ["reputation", "u8"],
        ["total_earnings", "u64"],
        ["total_revealed_votes", "u64"],
        ["total_correct_votes", "u64"],
      ],
    },
  ],
]);


const VotersList = () => {
  const [voters, setVoters] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const votersPerPage = 50;
  const [connection, setConnection] = useState(null);

  // const connection = new Connection(DEFAULT_RPC_URL, "confirmed");

  useEffect(() => {
      (async () => {
          const url = await getWorkingRpcUrl();
          const conn = new Connection(url, "confirmed");
          setConnection(conn);
      })();
  }, []);

  useEffect(() => {
    if (connection) {
      fetchVoters();
    }
  }, [connection]);

  const fetchVoters = async () => {
    try {
      toast.info("Fetching registered voters...");

      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: bs58.encode(Uint8Array.from([210, 252, 132, 218, 191, 85, 173, 167])),
            },
          },
          // Remove dataSize for now
        ],
      });

      const parsedVoters = accounts
      .map((account, index) => {
        const data = account.account.data.slice(8);
        try {
          const userRecord = deserializeUnchecked(USER_RECORD_SCHEMA, UserRecord, data);
          return {
            index: index + 1,
            address: new PublicKey(userRecord.user).toBase58(),
            reputation: userRecord.reputation,
            totalEarnings: userRecord.total_earnings.toString(),
            totalRevealedVotes: userRecord.total_revealed_votes.toString(),
            totalCorrectVotes: userRecord.total_correct_votes.toString(),
          };
        } catch (e) {
          console.warn("Skipping invalid voter record", account.pubkey.toBase58());
          return null; // Important: mark as null
        }
      })
      .filter(Boolean);

      setVoters(parsedVoters);
      setCurrentPage(1);
      toast.success("Voters fetched successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Error fetching voters: " + error.message);
    }
  };

  const indexOfLastVoter = currentPage * votersPerPage;
  const indexOfFirstVoter = indexOfLastVoter - votersPerPage;
  const currentVoters = voters.slice(indexOfFirstVoter, indexOfLastVoter);

  const totalPages = Math.ceil(voters.length / votersPerPage);

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
                {currentVoters.map((voter) => (
                  <tr key={voter.address} className="hover:bg-gray-50">
                    <td className="p-2 border">{voter.index}</td>
                    <td className="p-2 border">{voter.address}</td>
                    <td className="p-2 border">{voter.reputation}</td>
                    <td className="p-2 border">{voter.totalEarnings}</td>
                    <td className="p-2 border">{voter.totalRevealedVotes}</td>
                    <td className="p-2 border">{voter.totalCorrectVotes}</td>
                    <td className="p-2 border">
                      <a
                        href={`https://explorer.solana.com/address/${voter.address}${clusterParam}`}
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
                <p className="break-all">
                  <span className="font-semibold">Address:</span> {voter.address}
                </p>
                <p><span className="font-semibold">Reputation:</span> {voter.reputation}</p>
                <p><span className="font-semibold">Total Earnings:</span> {voter.totalEarnings}</p>
                <p><span className="font-semibold">Revealed Votes:</span> {voter.totalRevealedVotes}</p>
                <p><span className="font-semibold">Correct Votes:</span> {voter.totalCorrectVotes}</p>
                <a
                  href={`https://explorer.solana.com/address/${voter.address}${clusterParam}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline block mt-1"
                >
                  View on Explorer
                </a>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-4 space-x-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VotersList;
import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idl from "../idl.json";

const PROGRAM_ID = new web3.PublicKey(
  "8Vr6WGK4B8ZRnGL3991QEBhWGrJ6uZ92XRf6RFM1iq1E"
);
const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");

const JoinNetwork = () => {
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);

  // Always attempt to create a provider, even if publicKey is null.
  // If publicKey or signTransaction is missing, provider will be null.
  const provider =
    publicKey && signTransaction
      ? new AnchorProvider(connection, { publicKey, signTransaction }, { commitment: "confirmed" })
      : null;

  // Only create a program if the provider is available.
  const program = provider ? new Program(idl, provider) : null;

  // Fetch membership status (if program is ready)
  const fetchMembership = async () => {
    try {
      const [voterListPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("voter_list")],
        PROGRAM_ID
      );
      // Attempt to fetch the voter list account.
      const voterListAccount = await program.account.voterList.fetch(voterListPDA);
      // Check if the user is in the voters array
      const member = voterListAccount.voters.some(
        (voter) => voter.address.toString() === publicKey.toString()
      );
      setIsMember(member);
    } catch (error) {
      console.error("Error fetching membership:", error);
      setIsMember(false);
    }
  };

  useEffect(() => {
    if (program && publicKey) {
      fetchMembership();
    }
    // We want to refetch membership if program or publicKey changes.
  }, [program, publicKey]);

  // Handler to join the network (depositing 0.5 SOL into a dedicated vault)
  const joinNetworkHandler = async () => {
    try {
      setLoading(true);

      const [voterListPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("voter_list")],
        PROGRAM_ID
      );

      const [vaultPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), publicKey.toBuffer()],
        PROGRAM_ID
      );

      const tx = await program.methods.joinNetwork().accounts({
        user: publicKey,
        voterList: voterListPDA,
        vault: vaultPDA,
        systemProgram: web3.SystemProgram.programId,
      }).rpc();

      console.log("Joined network. Tx:", tx);
      alert("Successfully joined the Truth Network!");
      await fetchMembership();
      setLoading(false);
    } catch (error) {
      console.error("Failed to join network:", error);
      alert("Failed to join the network.");
      setLoading(false);
    }
  };

  // Handler to leave the network (removing the user and withdrawing their deposit)
  const leaveNetworkHandler = async () => {
    try {
      setLoading(true);

      const [vaultPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), publicKey.toBuffer()],
        PROGRAM_ID
      );

      const [voterListPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("voter_list")],
        PROGRAM_ID
      );

      const tx = await program.methods.leaveNetwork().accounts({
        user: publicKey,
        vault: vaultPDA,
        voterList: voterListPDA,
        systemProgram: web3.SystemProgram.programId,
      }).rpc();

      console.log("Left network. Tx:", tx);
      alert("Successfully left the Truth Network and withdrawn your deposit!");
      await fetchMembership();
      setLoading(false);
    } catch (error) {
      console.error("Failed to leave network:", error);
      alert("Failed to leave the network.");
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Truth Network Membership</h2>
      {/* Conditional UI rendering */}
      {!publicKey ? (
        <p>Please connect your wallet first.</p>
      ) : !program ? (
        <p>Loading provider...</p>
      ) : (
        <>
          <p>
            {isMember
              ? "You are currently a member of the Truth Network."
              : "You are not a member of the Truth Network."}
          </p>
          {isMember ? (
            <button onClick={leaveNetworkHandler} disabled={loading}>
              {loading ? "Processing..." : "Leave Truth Network"}
            </button>
          ) : (
            <button onClick={joinNetworkHandler} disabled={loading}>
              {loading ? "Joining..." : "Join Truth Network"}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default JoinNetwork;

import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import idl from "../idl.json";

const PROGRAM_ID = new web3.PublicKey(
  "FU9yzzBojVdo9oX6nYmB7bE3upgfzSfznHuSCaY5ejmJ"
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
  
      const voterListAccount = await program.account.voterList.fetch(voterListPDA);
      const member = voterListAccount.voters.some(
        (voter) => voter.address.toString() === publicKey.toString()
      );
      setIsMember(member);
      toast.dismiss();
      if (member) {
        toast.success("You are a Registered Truth Provider.", { position: "top-center" });
      } else {
        toast.info("You are not registered yet.", { position: "top-center" });
      }
    } catch (error) {
      if (error.message.includes("Account does not exist")) {
        toast.info("No voter list found. You are not registered yet.", { position: "top-center" });
      } else {
        toast.error(`Error fetching membership: ${error.message}`, { position: "top-center" });
      }
  
      // Still set false in either case
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

      toast.success(`Joined the network! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
        position: "top-center",
        autoClose: 6000,
        onClick: () =>
          window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
      });

      await fetchMembership();
    } catch (error) {
      toast.error(`Failed to join: ${error.message}`, { position: "top-center" });
      console.error("Failed to join network:", error);
    } finally {
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

      toast.success(`Left the network. Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
        position: "top-center",
        autoClose: 6000,
        onClick: () =>
          window.open(`https://explorer.solana.com/tx/${tx}?cluster=devnet`, "_blank"),
      });

      await fetchMembership();
    } catch (error) {
      toast.error(`Failed to leave: ${error.message}`, { position: "top-center" });
      console.error("Failed to leave network:", error);
    } finally {
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
              ? "You are a Registered Truth Provider."
              : "You are not registered."}
          </p>
          {isMember ? (
            <button onClick={leaveNetworkHandler} disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center">
                  Processing<span className="dot-animate">.</span>
                  <span className="dot-animate dot2">.</span>
                  <span className="dot-animate dot3">.</span>
                </span>
              ) : (
                "Leave Truth It Network"
              )}
            </button>
          ) : (
            <button onClick={joinNetworkHandler} disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center">
                  Joining<span className="dot-animate">.</span>
                  <span className="dot-animate dot2">.</span>
                  <span className="dot-animate dot3">.</span>
                </span>
              ) : (
                "Join Truth It Network"
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default JoinNetwork;

import React, { useState, useEffect, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getConstants } from "../constants";
import { getIdls } from "../idl";

const { PROGRAM_ID, DEFAULT_RPC_URL, getExplorerTxUrl } = getConstants();

const JoinNetwork = ({ compact = false, updateIsMember }) => {
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [connection] = useState(() => new web3.Connection(DEFAULT_RPC_URL, "confirmed"));
  // const [program, setProgram] = useState(null);

  // useEffect(() => {
  //   const setupProgram = async () => {
  //     try {
  //       const idl = await getIDL();
  //       const walletAdapter = { publicKey, signTransaction };
  //       const provider = new AnchorProvider(connection, walletAdapter, { commitment: "confirmed" });
  //       const programInstance = new Program(idl, provider);
  //       setProgram(programInstance);
  //     } catch (err) {
  //       console.error("Failed to setup program:", err);
  //     }
  //   };

  //   if (publicKey && signTransaction) {
  //     setupProgram();
  //   }
  // }, [publicKey, signTransaction]);
  const { truthNetworkIDL } = getIdls();
  const wallet = { publicKey, signTransaction };
  const provider = useMemo(() => {
    return new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
  }, [connection, wallet]);
  const program = useMemo(() => {
    return new Program(truthNetworkIDL, provider);
  }, [truthNetworkIDL, provider]);

  const fetchMembership = async () => {
    try {
      const [userRecordPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("user_record"), publicKey.toBuffer()],
        PROGRAM_ID
      );
  
      const userRecordAccount = await program.account.userRecord.fetch(userRecordPDA);
      const member = !!userRecordAccount; // If account exists, user is a member
      setIsMember(member);
      updateIsMember?.(member);
    } catch (error) {
      setIsMember(false);
      updateIsMember?.(false);
      if (error.message.includes("Account does not exist")) {
        console.log("User has not joined yet.");
      } else {
        console.error("Unexpected error while checking membership:", error);
      }
    }
  };
  

  useEffect(() => {
    if (program && publicKey) {
      fetchMembership();
    }
  }, [program, publicKey]);

  const joinNetworkHandler = async () => {
    try {
      setLoading(true);
  
      const [vaultPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), publicKey.toBuffer()],
        PROGRAM_ID
      );
  
      const [userRecordPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("user_record"), publicKey.toBuffer()],
        PROGRAM_ID
      );
  
      const tx = await program.methods.joinNetwork().accounts({
        user: publicKey,
        vault: vaultPDA,
        userRecord: userRecordPDA,
        systemProgram: web3.SystemProgram.programId,
      }).rpc();
  
      toast.success(`Joined the network! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
        position: "top-center",
        autoClose: 6000,
        onClick: () =>
        window.open(getExplorerTxUrl(tx), "_blank"),
      });
  
      await fetchMembership();
    } catch (error) {
      toast.error(`Failed to join: ${error.message}`, { position: "top-center" });
      console.error("Failed to join network:", error);
    } finally {
      setLoading(false);
    }
  };
  

  const leaveNetworkHandler = async () => {
    try {
      setLoading(true);
  
      const [vaultPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), publicKey.toBuffer()],
        PROGRAM_ID
      );
  
      const [userRecordPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("user_record"), publicKey.toBuffer()],
        PROGRAM_ID
      );
  
      const tx = await program.methods.leaveNetwork().accounts({
        user: publicKey,
        vault: vaultPDA,
        userRecord: userRecordPDA,
        systemProgram: web3.SystemProgram.programId,
      }).rpc();
  
      toast.success(`Left the network. Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
        position: "top-center",
        autoClose: 6000,
        onClick: () =>
        window.open(getExplorerTxUrl(tx), "_blank"),
      });
  
      await fetchMembership();
    } catch (error) {
      toast.error(`Failed to leave: ${error.message}`, { position: "top-center" });
      console.error("Failed to leave network:", error);
    } finally {
      setLoading(false);
    }
  };
  

  const renderButton = () =>
    isMember ? (
      <button
        onClick={leaveNetworkHandler}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
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
      <button
        onClick={joinNetworkHandler}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
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
    );

  return compact ? (
    renderButton()
  ) : (
    <div>
      <h2 className="text-xl font-semibold mb-2">Truth Network Membership</h2>
      {!publicKey ? (
        <p className="text-gray-700">Please connect your wallet first.</p>
      ) : !program ? (
        <p className="text-gray-700">Loading provider...</p>
      ) : (
        <>
          <p className="mb-4">
            {isMember
              ? "You are a Registered Truth Provider."
              : "You are not registered."}
          </p>
          {renderButton()}
        </>
      )}
    </div>
  );
};

export default JoinNetwork;


import React, { useState, useEffect, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getConstants } from "../constants";
import { getIdls } from "../idl";
import { confirmTransactionOnAllRpcs } from "../utils/confirmWithFallback";

const { PROGRAM_ID, getWorkingRpcUrl, getExplorerTxUrl } = getConstants();

const JoinNetwork = ({ compact = false, updateIsMember }) => {
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [connection, setConnection] = useState(null);
  const [providerCount, setProviderCount] = useState(0);
  const [statePDA] = useState(() =>
    PublicKey.findProgramAddressSync([Buffer.from("global_state")], PROGRAM_ID)[0]
  );


  const { truthNetworkIDL } = getIdls();
  const wallet = { publicKey, signTransaction };
  const provider = useMemo(() => {
    if (!connection || !publicKey || !signTransaction) return null;
    return new AnchorProvider(connection, { publicKey, signTransaction }, { preflightCommitment: "processed" });
  }, [connection, publicKey, signTransaction]);
  
  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(truthNetworkIDL, provider);
  }, [truthNetworkIDL, provider]);
  

  useEffect(() => {
    (async () => {
        const rpc = await getWorkingRpcUrl();
        const conn = new web3.Connection(rpc, "confirmed");
        setConnection(conn);
    })();
  }, []);

  const fetchState = async () => {
    if (!program || !connection) return;
    try {
      const stateAccount = await program.account.globalState.fetch(statePDA);
      stateAccount.pendingInvites.forEach((invite, index) => {
        console.log(
          `Invite #${index}:`,
          "Invitee =", invite.invitee.toBase58(),
          "Inviter =", invite.inviter.toBase58()
        );
      });
      setProviderCount(stateAccount.truthProviderCount.toNumber());
    } catch (error) {
      if (error.message.includes("Account does not exist")) {
        console.log("State account does not exist yet. No providers registered.");
        setProviderCount(0);
      } else {
        console.error("Failed to fetch state:", error);
      }
    }
  };
  

  const fetchMembership = async () => {
    if (!program || !publicKey) return;
    try {
      const [userRecordPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("user_record"), publicKey.toBuffer()],
        PROGRAM_ID
      );

      const userRecordAccount = await program.account.userRecord.fetch(userRecordPDA);
      const member = !!userRecordAccount;
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
    if (!program || !publicKey || !connection) return;
  
    const load = async () => {
      try {
        await fetchMembership();
        await fetchState();
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };
  
    load();
  }, [program, publicKey]);
  

  const joinNetworkHandler = async () => {
    await confirmJoin();
  };

  const confirmJoin = async () => {
    try {
      setLoading(true);
  
      const [userRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_record"), publicKey.toBuffer()],
        PROGRAM_ID
      );
  
      const [invitePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("invite"), publicKey.toBuffer()],
        PROGRAM_ID
      );
  
      let inviteExists = false;
      try {
        const inviteAccount = await program.account.invite.fetch(invitePDA);
        if (inviteAccount) {
          inviteExists = true;
          console.log("Invite found from inviter:", inviteAccount.inviter.toBase58());
        }
      } catch (err) {
        if (err.message.includes("Account does not exist")) {
          console.log("No invite account found (joining without invite).");
        } else {
          console.error("Error checking invite PDA:", err);
        }
      }
  
      const accounts = {
        globalState: statePDA,
        user: publicKey,
        userRecord: userRecordPDA,
        systemProgram: web3.SystemProgram.programId,
        invite: inviteExists ? invitePDA : null,
      };
  
      // --- Build tx manually instead of .rpc() ---
      const tx = await program.methods
        .joinNetwork()
        .accounts(accounts)
        .transaction();
  
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.feePayer = publicKey;
  
      const signedTx = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
  
      const confirmed = await confirmTransactionOnAllRpcs(sig);
  
      if (confirmed) {
        toast.success(
          <div>
            Successfully joined the network.{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-500"
            >
              View on Explorer
            </a>
          </div>,
          { position: "top-center", autoClose: 6000 }
        );
      } else {
        toast.warning(
          <div>
            Transaction sent but not yet confirmed.{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-yellow-600"
            >
              Check Explorer
            </a>
          </div>,
          { position: "top-center", autoClose: 6000 }
        );
      }
  
      await fetchMembership();
      await fetchState();
    } catch (error) {
      console.error("Join network error:", error);
    
      let readable = "Unexpected error occurred";
    
      const errorMap = {
        "AlreadyJoined": "You already joined the network.",
        "NotInvited": "You need an invite to join right now.",
        "InvalidInviter": "The invite provided is invalid or doesn’t match your account.",
        "Account does not exist": "No invite was found for your account.",
      };
    
      if (error.message) {
        for (const key in errorMap) {
          if (error.message.includes(key)) {
            readable = errorMap[key];
            break;
          }
        }
        if (readable === "Unexpected error occurred") {
          readable = error.message;
        }
      }
    
      // If the error object has a signature, attach Explorer link
      const sig = error.signature || error.txid || null;
    
      if (sig) {
        toast.error(
          <div>
            Failed to join: {readable}{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-red-500"
            >
              View on Explorer
            </a>
          </div>,
          { position: "top-center" }
        );
      } else {
        toast.error(`Failed to join: ${readable}`, { position: "top-center" });
      }
    } finally {
      setLoading(false);
    }
  };
  
  const leaveNetworkHandler = async () => {
    try {
      setLoading(true);
  
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), publicKey.toBuffer()],
        PROGRAM_ID
      );
  
      const [userRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_record"), publicKey.toBuffer()],
        PROGRAM_ID
      );
  
      // --- Build tx manually ---
      const tx = await program.methods
        .leaveNetwork()
        .accounts({
          user: publicKey,
          vault: vaultPDA,
          userRecord: userRecordPDA,
          systemProgram: web3.SystemProgram.programId,
        })
        .transaction();
  
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.feePayer = publicKey;
  
      const signedTx = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
  
      const confirmed = await confirmTransactionOnAllRpcs(sig);
  
      if (confirmed) {
        toast.success(
          <div>
            Successfully left the network.{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-500"
            >
              View on Explorer
            </a>
          </div>,
          { position: "top-center", autoClose: 6000 }
        );
      } else {
        toast.warning(
          <div>
            Transaction sent but not yet confirmed.{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-yellow-600"
            >
              Check Explorer
            </a>
          </div>,
          { position: "top-center", autoClose: 6000 }
        );
      }
  
      await fetchMembership();
    } catch (error) {
      console.error("Failed to leave network:", error);
    
      // Map of known error substrings → friendly messages
      const leaveErrorMap = {
        "Account does not exist": "You don’t have a membership record to leave.",
        "signature verification failed": "Transaction signature failed (did you reject in your wallet?).",
        "insufficient funds": "Not enough SOL to pay network fees.",
      };
    
      let readable = "Unexpected error occurred";
    
      if (error.message) {
        for (const key in leaveErrorMap) {
          if (error.message.toLowerCase().includes(key.toLowerCase())) {
            readable = leaveErrorMap[key];
            break;
          }
        }
    
        if (readable === "Unexpected error occurred") {
          readable = error.message;
        }
      }
    
      // Add Explorer link if a signature exists
      const sig = error.signature || error.txid || null;
    
      if (sig) {
        toast.error(
          <div>
            Failed to leave: {readable}{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-red-500"
            >
              View on Explorer
            </a>
          </div>,
          { position: "top-center" }
        );
      } else {
        toast.error(`Failed to leave: ${readable}`, { position: "top-center" });
      }
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

  return (
    <>
      {compact ? (
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
      )}
    </>
  );
};

export default JoinNetwork;
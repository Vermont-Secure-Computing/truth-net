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
  const [inviterModalOpen, setInviterModalOpen] = useState(false);
  const [inviterInput, setInviterInput] = useState("");
  const [connection] = useState(() => new web3.Connection(DEFAULT_RPC_URL, "confirmed"));
  const [providerCount, setProviderCount] = useState(0);
  const [statePDA] = useState(() =>
    PublicKey.findProgramAddressSync([Buffer.from("state")], PROGRAM_ID)[0]
  );


  const { truthNetworkIDL } = getIdls();
  const wallet = { publicKey, signTransaction };
  const provider = useMemo(() => {
    return new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
  }, [connection, wallet]);
  const program = useMemo(() => {
    return new Program(truthNetworkIDL, provider);
  }, [truthNetworkIDL, provider]);

  const fetchState = async () => {
    try {
      const stateAccount = await program.account.state.fetch(statePDA);
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
    if (program && publicKey) {
      fetchMembership();
      fetchState();
    }
  }, [program, publicKey]);

  const joinNetworkHandler = async () => {
    if (providerCount < 2) {
      // Directly join
      await confirmJoin();
    } else {
      // Show modal to require inviter
      setInviterModalOpen(true);
    }
  };

  const confirmJoin = async () => {
    try {
      setLoading(true);
  
      const [userRecordPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("user_record"), publicKey.toBuffer()],
        PROGRAM_ID
      );
  
      let inviterRecordPDA = null;
  
      if (inviterInput.trim() !== "") {
        try {
          const inviterPubkey = new PublicKey(inviterInput.trim());
          [inviterRecordPDA] = await PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), inviterPubkey.toBuffer()],
            PROGRAM_ID
          );
        } catch {
          toast.error("Invalid inviter address", { position: "top-center" });
          return;
        }
      }
  
      // if (providerCount >= 2 && !inviterRecordPDA) {
      //   toast.error("An inviter address is required.", { position: "top-center" });
      //   return;
      // }
  
      const accounts = {
        state: statePDA,
        user: publicKey,
        userRecord: userRecordPDA,
        systemProgram: web3.SystemProgram.programId,
      };
      
      if (inviterRecordPDA) {
        accounts.inviterRecord = inviterRecordPDA;
      }
      
      const tx = await program.methods
        .joinNetwork()
        .accounts(accounts)
        .rpc();
  
      toast.success(`Joined the network! Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
        position: "top-center",
        autoClose: 6000,
        onClick: () => window.open(getExplorerTxUrl(tx), "_blank"),
      });
  
      setInviterModalOpen(false);
      setInviterInput("");
      await fetchMembership();
      await fetchState();
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

      const tx = await program.methods
        .leaveNetwork()
        .accounts({
          user: publicKey,
          vault: vaultPDA,
          userRecord: userRecordPDA,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      toast.success(`Left the network. Tx: ${tx.slice(0, 6)}...${tx.slice(-6)}`, {
        position: "top-center",
        autoClose: 6000,
        onClick: () => window.open(getExplorerTxUrl(tx), "_blank"),
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

  return (
    <>
      {inviterModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}>
          <div className="bg-white rounded-md p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Join Truth It Network</h3>
            <label className="block mb-2 text-gray-700">
            {providerCount === 0
              ? "No members yet. You will be the first Truth Provider!"
              : providerCount < 2
              ? "Inviter Address (optional)"
              : "Inviter Address (required)"}
            </label>
            <input
              type="text"
              placeholder="Paste inviter address (or leave blank)"
              value={inviterInput}
              onChange={(e) => setInviterInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-md mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setInviterModalOpen(false)}
                className="px-4 py-2 bg-gray-300 rounded-md"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={confirmJoin}
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
                disabled={loading}
              >
                {loading ? "Joining..." : "Confirm Join"}
              </button>
            </div>
          </div>
        </div>
      )}
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

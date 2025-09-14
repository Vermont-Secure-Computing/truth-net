import { useEffect, useState, useMemo } from "react";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getConstants } from "../constants";
import { getIdls } from "../idl";
import { confirmTransactionOnAllRpcs } from "../utils/confirmWithFallback";

const { getWorkingRpcUrl, PROGRAM_ID, getExplorerTxUrl } = getConstants();



const VoterDashboard = () => {
    const { publicKey, wallet, signTransaction } = useWallet();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [totalRevealedVotes, setTotalRevealedVotes] = useState(0);
    const [totalCorrectVotes, setTotalCorrectVotes] = useState(0);
    const [voterReputation, setVoterReputation] = useState(0);
    const [connection, setConnection] = useState(null);
    const [nominateModalOpen, setNominateModalOpen] = useState(false);
    const [nomineeInput, setNomineeInput] = useState("");
    const [userRecord, setUserRecord] = useState(null);
    const [nomineeError, setNomineeError] = useState("");
    const [myInvites, setMyInvites] = useState([]);
    const [loadingInvites, setLoadingInvites] = useState(false);

    
    const { truthNetworkIDL } = getIdls();
    const walletAdapter = useMemo(() => {
        if (!wallet?.adapter || !publicKey) return undefined;
        return {
          publicKey,
          signTransaction: wallet.adapter.signTransaction,
          signAllTransactions: wallet.adapter.signAllTransactions,
        };
      }, [wallet, publicKey]);

    useEffect(() => {
        (async () => {
            const url = await getWorkingRpcUrl();
            const conn = new web3.Connection(url, "confirmed");
            setConnection(conn);
        })();               
    }, []);
    
    const provider = useMemo(() => {
        if (!wallet?.adapter || !publicKey || !connection) return null;
        return new AnchorProvider(connection, wallet.adapter, { preflightCommitment: "processed" });    
    }, [connection, wallet, publicKey]);
      
    const program = useMemo(() => {
        if (!provider) return null;
        return new Program(truthNetworkIDL, provider);
    }, [truthNetworkIDL, provider]);

    useEffect(() => {
        if (program && publicKey) {
          fetchData();
          fetchUserRecord();
          fetchMyInvites();
        }
      }, [program, publicKey]);

    const fetchData = async () => {
        if (!program || !publicKey) {
            console.warn("Program or publicKey not ready. Skipping fetch.");
            return;
        }
        try {
            const stats = await getVoterStats(program, publicKey, connection);
            setTotalEarnings(stats.totalEarnings);
            setTotalRevealedVotes(stats.totalRevealedVotes);
            setTotalCorrectVotes(stats.totalCorrectVotes);
            setVoterReputation(stats.voterReputation);

            
            let allVoterRecords = [];
            try {
                const fetched = await program.account.voterRecord.all();
                if (Array.isArray(fetched)) {
                    allVoterRecords = fetched;
                } else {
                    console.error("Fetched voterRecord.all() is not an array:", fetched);
                    return;
                }
            } catch (e) {
                console.error("Error fetching all voterRecord accounts:", e);
                return;
            }
            if (!Array.isArray(allVoterRecords)) {
                console.error("Invalid voterRecord list received:", allVoterRecords);
                return;
            }
              
            const cleanedVoterRecords = (allVoterRecords || []).filter(r => r && r.account);

            const rawVoterRecords = cleanedVoterRecords.filter((r, i) => {
                if (!r.account.voter) {
                    console.warn(`Skipping malformed voterRecord at index ${i}:`, r);
                    return false;
                }
                return r.account.voter.equals(publicKey);
            });
              
            const voterRecordMap = {};
            const voterRecords = [];
            (rawVoterRecords || []).forEach((record, idx) => {
                try {
                    if (
                        record &&
                        record.account &&
                        record.account.voter &&
                        record.account.question &&
                        typeof record.account.voter.toBase58 === "function"
                    ) {
                        if (record.account.voter.toBase58() === publicKey.toBase58()) {
                            voterRecords.push(record);
                            const questionKey = record.account.question.toBase58();
                            voterRecordMap[questionKey] = record.account;
                        }
                    } else {
                        console.warn(`Skipping malformed record at index ${idx}:`, record);
                    }
                } catch (e) {
                    console.error("Exception during voterRecord parse:", idx, record, e);
                }
            });

            const userVoterRecords = voterRecords;

            if (userVoterRecords.length === 0) {
                setQuestions([]);
                return;
            }

            try {
                const questionPubkeys = (userVoterRecords || [])
                    .filter((record, i) => {
                        if (!record) {
                        console.warn(`Record at index ${i} is null`);
                        return false;
                        }
                        if (!record.account) {
                        console.warn(`Record at index ${i} has no account`, record);
                        return false;
                        }
                        if (!record.account.question) {
                        console.warn(`Record at index ${i} missing question`, record);
                        return false;
                        }
                        return true;
                    })
                    .map(record => record.account.question);

                if (!Array.isArray(questionPubkeys) || questionPubkeys.length === 0) {
                    console.warn("No valid question pubkeys found");
                    return;
                }

                const questionsData = await Promise.all(
                    questionPubkeys
                        .filter((pubkey) => pubkey)
                        .map(async (pubkey) => {
                        try {
                            const question = await program.account.question.fetch(pubkey);
                            if (!question) {
                                console.warn("Question fetch returned null:", pubkey.toBase58());
                                return null;
                            }
                            const [vaultPDA] = await web3.PublicKey.findProgramAddressSync(
                                [Buffer.from("vault"), pubkey.toBuffer()],
                                PROGRAM_ID
                            );

                            const vaultAccountInfo = await connection.getAccountInfo(vaultPDA);
                            const rentExemption = await connection.getMinimumBalanceForRentExemption(8);
                            const vaultBalance = vaultAccountInfo?.lamports ?? 0;
                            const rewardLamports = Math.max(vaultBalance - rentExemption, 0);
                            const solReward = rewardLamports / web3.LAMPORTS_PER_SOL;

                            return {
                                idque: pubkey.toBase58(),
                                ...question,
                                committedVoters: question.committedVoters?.toNumber?.() || 0,
                                originalReward: question.originalReward?.toNumber?.() || 0,
                                reward: parseFloat(solReward.toFixed(4)),
                                userVoterRecord: voterRecordMap[pubkey.toBase58()] || null,
                            };
                        } catch (error) {
                            console.error("Error fetching question:", pubkey.toBase58(), error);
                            return null;
                        }
                    })
                );

                setQuestions(questionsData.filter(q => q !== null));
            } catch (e) {
                console.error("Full error during voter dashboard question fetch:", e);
            }
        } catch (error) {
            console.error("Error fetching voter data:", error);
        }
    };

    const fetchMyInvites = async () => {
        if (!program || !publicKey) return;
        setLoadingInvites(true);
      
        try {
          // Fetch all invite accounts
          const allInvites = await program.account.invite.all();
      
          // Filter invites you created
          const myCreatedInvites = allInvites.filter(
            (i) => i.account.inviter.toBase58() === publicKey.toBase58()
          );
      
          // For each invite, check if the user has joined
          const invitesWithUsage = await Promise.all(
            myCreatedInvites.map(async (invite) => {
              const [userRecordPDA] = web3.PublicKey.findProgramAddressSync(
                [Buffer.from("user_record"), invite.account.invitee.toBuffer()],
                PROGRAM_ID
              );
              const info = await connection.getAccountInfo(userRecordPDA);
              const hasJoined = !!info;
              return {
                invite,
                hasJoined,
              };
            })
          );
      
          setMyInvites(invitesWithUsage);
        } catch (err) {
          console.error("Failed to fetch invites", err);
        } finally {
          setLoadingInvites(false);
        }
    };
      

    const nominateInvitee = async () => {
        if (!nomineeInput.trim()) {
          toast.error("Please enter a wallet address.", { position: "top-center" });
          return;
        }
      
        try {
          const nomineePubkey = new web3.PublicKey(nomineeInput.trim());
      
          const [invitePDA] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from("invite"), nomineePubkey.toBuffer()],
            PROGRAM_ID
          );
      
          const [userRecordPDA] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), publicKey.toBuffer()],
            PROGRAM_ID
          );
      
          const tx = await program.methods
            .nominateInvitee(nomineePubkey)
            .accounts({
              invite: invitePDA,
              userRecord: userRecordPDA,
              inviter: publicKey,
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
                Invitee nominated.{" "}
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
                Transaction sent, not yet confirmed.{" "}
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
      
          setNominateModalOpen(false);
          setNomineeInput("");
        } catch (error) {
          toast.error(`Failed to nominate: ${error.message}`, {
            position: "top-center",
            autoClose: 6000,
          });
          console.error("Nominate error", error);
        }
    };
          

    const deleteInvite = async (inviteePubkey) => {
        if (!inviteePubkey) return;
      
        try {
          const [invitePDA] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from("invite"), inviteePubkey.toBuffer()],
            PROGRAM_ID
          );
      
          const tx = await program.methods
            .deleteInvite()
            .accounts({
              invite: invitePDA,
              inviter: publicKey,
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
                Invitation refund claimed.{" "}
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
                Transaction sent but not confirmed yet.{" "}
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
      
          fetchMyInvites(); // Refresh after success
        } catch (err) {
          console.error("Delete invite failed", err);
          toast.error(`Delete failed: ${err.message}`, {
            position: "top-center",
          });
        }
    };
      
    
    const fetchUserRecord = async () => {
        if (!program || !publicKey) return;
      
        try {
          const [userRecordPDA] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), publicKey.toBuffer()],
            PROGRAM_ID
          );
      
          const info = await connection.getAccountInfo(userRecordPDA);
          if (!info) {
            console.warn("UserRecord account does not exist at:", userRecordPDA.toBase58());
            setUserRecord(null);
            return;
          }
      
          const userRecordAccount = await program.account.userRecord.fetch(userRecordPDA);
          setUserRecord(userRecordAccount);
      
          if (userRecordAccount?.inviter) {
            console.log("userRecord.inviter:", userRecordAccount.inviter.toBase58());
          } else {
            console.log("userRecord has no inviter field.");
          }
        } catch (err) {
          console.error("Failed to fetch user record", err);
          setUserRecord(null);
        }
      };
      

    useEffect(() => {
        if (!publicKey) return;
        fetchData();
        fetchUserRecord()
    }, [publicKey, wallet]);

    async function getVoterStats(program, voterPubkey, connection) {
        const [userRecordPDA] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), voterPubkey.toBuffer()],
            PROGRAM_ID
        );
    
        try {
            const info = await connection.getAccountInfo(userRecordPDA);
            if (!info) {
                console.warn("UserRecord account does not exist at PDA:", userRecordPDA.toBase58());
                return {
                    totalEarnings: 0,
                    totalRevealedVotes: 0,
                    totalCorrectVotes: 0,
                    voterReputation: 0,
                };
            }
            
            const record = await program.account.userRecord.fetch(userRecordPDA);
            
            return {
                totalEarnings: (record.totalEarnings?.toNumber() || 0) / web3.LAMPORTS_PER_SOL,
                totalRevealedVotes: record.totalRevealedVotes?.toNumber() || 0,
                totalCorrectVotes: record.totalCorrectVotes?.toNumber() || 0,
                voterReputation: record.reputation || 0,
            };
        } catch (err) {
            console.warn("UserRecord fetch failed:", err);
            return {
                totalEarnings: 0,
                totalRevealedVotes: 0,
                totalCorrectVotes: 0,
                voterReputation: 0,
            };
        }
    }

    return (
      <>
        <div className="container mx-auto px-6 py-6">
            <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-300 pb-2">
                Truth Provider Dashboard
            </h2>
            <div className="mb-6">
                <h3 className="text-lg">Total Earnings: <span className="font-bold">{totalEarnings} SOL</span></h3>
                <h3 className="text-lg">Total Revealed Votes: <span className="font-bold">{totalRevealedVotes}</span></h3>
                <h3 className="text-lg">Total Correct Votes: <span className="font-bold">{totalCorrectVotes}</span></h3>
                <h3 className="text-green-600 font-semibold mt-2">Reputation: {voterReputation}</h3>
                {userRecord && (
                    <h3 className="text-blue-600 font-semibold mt-2">
                        Invite Tokens: {userRecord.inviteTokens}
                    </h3>
                )}
            </div>
            <div className="mb-6 flex justify-end">
                <button
                    onClick={() => setNominateModalOpen(true)}
                    disabled={!userRecord || userRecord.inviteTokens === 0}
                    className={`px-4 py-2 rounded-md transition duration-200 ${
                        !userRecord || userRecord.inviteTokens === 0
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-purple-600 text-white hover:bg-purple-700"
                    }`}
                    >
                    Nominate Invitee
                </button>

            </div>

            <div className="mt-6">
                <div className="space-y-3">
                    {myInvites
                    .filter(({ hasJoined }) => hasJoined)
                    .map(({ invite }, idx) => (
                        <button
                        key={idx}
                        onClick={() => deleteInvite(invite.account.invitee)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                        >
                        Claim Invitation Refund 
                        </button>
                    ))}
                </div>
            </div>


            <h3 className="text-xl font-semibold mb-4">Voted Events:</h3>
            {questions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {questions.map((q, index) => {
                        const totalVotes = q.votesOption1.toNumber() + q.votesOption2.toNumber();
                        const winningOption = q.votesOption1.toNumber() > q.votesOption2.toNumber() ? 1 : 2;
                        const winningPercentage = (Math.max(q.votesOption1.toNumber(), q.votesOption2.toNumber()) / totalVotes) * 100;
                        
                        
                        const currentTime = new Date().getTime() / 1000;

                        const commitEnd = q.commitEndTime?.toNumber?.() || 0;
                        const revealEnd = q.revealEndTime?.toNumber?.() || 0;

                        const isEligibleToClaim =
                            revealEnd < currentTime &&
                            q.userVoterRecord &&
                            q.userVoterRecord.selectedOption !== undefined &&
                            q.userVoterRecord.selectedOption === winningOption &&
                            !q.userVoterRecord.claimed &&
                            totalVotes > 0 &&
                            winningPercentage >= 51;


                        const userCanReveal =
                            commitEnd < currentTime &&
                            revealEnd > currentTime &&
                            Array.isArray(q.userVoterRecord?.commitment) &&
                            q.userVoterRecord?.commitment.length > 0 &&
                            q.userVoterRecord?.revealed === false;

                        const selectedOption = q.userVoterRecord?.selectedOption;
                        const revealed = q.userVoterRecord?.revealed;
                        const claimed = q.userVoterRecord?.claimed;
                        const isTie = q.votesOption1.toNumber() === q.votesOption2.toNumber();
                        
                        const userCanReclaimRent =
                            revealEnd < currentTime &&
                            !claimed &&
                            (
                                revealed === false || 
                                (!isTie && revealed === true && selectedOption !== winningOption)
                            );


                        const displayRewardLamports = q.originalReward > 0 
                            ? q.originalReward
                            : q.reward * web3.LAMPORTS_PER_SOL;
                        
                        const displayReward = (displayRewardLamports / web3.LAMPORTS_PER_SOL).toFixed(4);

                        
                        return (
                            <div 
                                key={index} 
                                className="bg-white shadow-md rounded-lg p-6 border border-gray-200 cursor-pointer hover:shadow-lg transition"
                                onClick={() => {
                                
                                    if (!q.idque || typeof q.idque !== "string" || q.idque.length !== 44) {
                                        console.error("Invalid question ID:", q.idque);
                                        toast.error("Error: Invalid question ID.");
                                        return;
                                    }
                                
                                    navigate(`/question/${q.idque}`);
                                }}                                                               
                            >
                                <h4 className="text-lg font-semibold mb-2">{q.questionText}</h4>
                                <p className="text-gray-700"><strong>Reward:</strong> {displayReward} SOL</p>
                                <p className="text-gray-700"><strong>Voters Committed:</strong> {q.committedVoters}</p>
                                <p className="text-gray-700"><strong>Commit End Time:</strong> {new Date(q.commitEndTime * 1000).toLocaleString()}</p>
                                <p className="text-gray-700"><strong>Reveal End Time:</strong> {new Date(q.revealEndTime * 1000).toLocaleString()}</p>
                                {/* <p className="text-sm text-gray-700">
                                    <strong>Votes:</strong> {q.votesOption1.toNumber()} - {q.votesOption2.toNumber()}
                                </p> */}
                                
                                {isEligibleToClaim && (
                                    <p className="mt-3 text-green-600 font-semibold">
                                        You can now claim your reward
                                    </p>
                                )}

                                {userCanReclaimRent && (
                                    <p className="text-yellow-600 font-semibold mt-2">You can now reclaim your rent</p>
                                )}

                                {userCanReveal && (
                                    <p className="text-green-600 font-semibold mt-2">You can now reveal your vote</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-gray-500">No voted questions found.</p>
            )}
        </div>
        {nominateModalOpen && (
            <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}>
                <div className="bg-white rounded-md p-6 w-full max-w-md shadow-lg">
                    <h3 className="text-lg font-semibold mb-4">Nominate Invitee</h3>
                    <input
                        type="text"
                        placeholder="Invitee wallet address"
                        value={nomineeInput}
                        onChange={(e) => {
                            const value = e.target.value.trim();
                            setNomineeInput(value);

                            if (!value) {
                            setNomineeError("");
                            return;
                            }

                            try {
                            new web3.PublicKey(value);
                            setNomineeError("");
                            } catch {
                            setNomineeError("Not a valid Solana address.");
                            }
                        }}
                        className="w-full px-3 py-2 border rounded-md mb-1"
                    />
                        {nomineeError && (
                            <p className="text-red-500 text-sm mb-2">{nomineeError}</p>
                        )}
                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={() => setNominateModalOpen(false)}
                            className="px-4 py-2 bg-gray-300 rounded-md"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={nominateInvitee}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md"
                        >
                            Nominate
                        </button>
                    </div>
                </div>
            </div>
        )}
      </>  
    );
};

export default VoterDashboard;
import { toast } from "react-toastify";
import { getConstants } from "../constants";
import { confirmTransactionOnAllRpcs } from "./confirmWithFallback";

const { getExplorerTxUrl } = getConstants();

/**
 * Send a signed tx with toast notifications
 * @param {web3.Connection} connection
 * @param {object} wallet - wallet from useWallet()
 * @param {Transaction} tx - Anchor/solana Transaction
 * @param {string} successMsg
 */
export async function sendTxWithToasts(connection, wallet, tx, successMsg) {
  if (!wallet || !wallet.publicKey) {
    toast.error("⚠ Wallet not connected");
    throw new Error("Wallet not connected");
  }
  if (typeof wallet.signTransaction !== "function") {
    toast.error("⚠ This wallet cannot sign transactions");
    throw new Error("Wallet does not support signing");
  }

  try {
    // Always fetch a fresh blockhash
    tx.recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signedTx.serialize());

    toast.info(
      <div>
        Transaction submitted…{" "}
        <a
          href={getExplorerTxUrl(sig)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-blue-500"
        >
          View on Explorer
        </a>
      </div>,
      { position: "top-center", autoClose: 4000 }
    );

    confirmTransactionOnAllRpcs(sig).then((confirmed) => {
      if (confirmed) {
        toast.success(
          <div>
            {successMsg}{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-500"
            >
              View on Explorer
            </a>
          </div>,
          { position: "top-center", autoClose: 5000 }
        );
      } else {
        toast.warning(
          <div>
            Tx sent but not confirmed yet.{" "}
            <a
              href={getExplorerTxUrl(sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-yellow-500"
            >
              Check Explorer
            </a>
          </div>,
          { position: "top-center", autoClose: 7000 }
        );
      }
    });

    return sig;
  } catch (err) {
    console.error("Transaction failed:", err);

    // ✅ Handle duplicate tx gracefully
    if (err.message?.includes("already been processed")) {
      const sigMatch = err.signature || err.txid || null; // some RPCs return this
      toast.info(
        <div>
          Transaction already processed.{" "}
          <a
            href={getExplorerTxUrl(sigMatch || "")}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-500"
          >
            View on Explorer
          </a>
        </div>,
        { position: "top-center", autoClose: 6000 }
      );
      return sigMatch; // return so caller knows it's processed
    }

    toast.error(`Transaction failed: ${err.message}`, {
      position: "top-center",
    });
    throw err;
  }
}

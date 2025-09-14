import { Connection } from "@solana/web3.js";
import { getConstants } from "../constants";

export async function confirmTransactionOnAllRpcs(signature, commitment = "confirmed") {
  const { RPC_LIST, getWorkingRpcUrl } = getConstants();

  // Prefer user RPC first
  const userRpcUrl = await getWorkingRpcUrl();
  const rpcCandidates = [userRpcUrl, ...RPC_LIST.filter((u) => u !== userRpcUrl)];

  for (const rpcUrl of rpcCandidates) {
    try {
      const conn = new Connection(rpcUrl, commitment);

      // --- Attempt WebSocket confirmation ---
      try {
        const result = await conn.confirmTransaction(signature, commitment);
        if (result?.value?.err === null) {
          console.log(`Confirmed via WebSocket: ${rpcUrl}`);
          return true;
        }
      } catch (wsErr) {
        console.warn(`WebSocket confirm failed on ${rpcUrl}: ${wsErr?.message || wsErr}`);
      }

      // --- Fallback: Polling with getTransaction ---
      for (let i = 0; i < 15; i++) { // ~30s @ 2s intervals
        const tx = await conn.getTransaction(signature, { commitment });
        if (tx) {
          console.log(`Confirmed via polling: ${rpcUrl}`);
          return true;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.warn(`Failed to confirm via ${rpcUrl}: ${err?.message || err}`);
    }
  }

  return false;
}

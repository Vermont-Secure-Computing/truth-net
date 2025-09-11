import { Connection } from "@solana/web3.js";
import { getConstants } from "../constants";

const { RPC_LIST } = getConstants();

export async function confirmTransactionOnAllRpcs(signature, commitment = "confirmed") {
  for (const rpcUrl of RPC_LIST) {
    try {
      const conn = new Connection(rpcUrl, commitment);
      const result = await conn.confirmTransaction(signature, commitment);
      if (result.value?.err === null) {
        console.log(`Confirmed via ${rpcUrl}`);
        return true;
      }
    } catch (err) {
      console.warn(`Failed to confirm via ${rpcUrl}:`, err.message);
    }
  }

  return false;
}

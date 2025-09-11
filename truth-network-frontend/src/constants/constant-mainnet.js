import { Connection, PublicKey } from "@solana/web3.js";

export const RPC_LIST = [
  "https://go.getblock.us/86aac42ad4484f3c813079afc201451c",
  "https://solana-rpc.publicnode.com",
  "https://solana.drpc.org/",
  "https://solana.rpc.grove.city/v1/01fdb492",
  "https://solana.leorpc.com/?api_key=FREE",
  "https://public.rpc.solanavibestation.com/",
  "https://solana.therpc.io",
  "https://api.blockeden.xyz/solana/KeCh6p22EX5AeRHxMSmc",
  "https://solana.api.onfinality.io/public"
];

// Default fallback
export const DEFAULT_RPC_URL =
  localStorage.getItem("solana_rpc_url") || RPC_LIST[0];

/**
 * Checks if a given RPC URL is healthy (responds with version).
 */
export const checkRpcHealth = async (rpcUrl) => {
  try {
    const conn = new Connection(rpcUrl, { commitment: "processed" });
    const version = await conn.getVersion();
    return !!version["solana-core"];
  } catch (err) {
    console.warn(`[RPC Health] ${rpcUrl} failed:`, err?.message || err);
    return false;
  }
};

/**
 * Returns a working RPC URL.
 * - Uses user-defined one if provided and healthy.
 * - Otherwise, rotates through known list using round-robin.
 */
export const getWorkingRpcUrl = async () => {
  const userDefined = localStorage.getItem("solana_rpc_url");

  // 1. User-defined but NOT in default list
  if (userDefined && !RPC_LIST.includes(userDefined)) {
    const healthy = await checkRpcHealth(userDefined);
    if (healthy) return userDefined;

    // If unhealthy, fallback to round-robin
    console.warn("[RPC] Custom user RPC unhealthy, removing...");
    localStorage.removeItem("solana_rpc_url");
  }

  // 2. Round-robin fallback among RPC_LIST
  const lastIndex = parseInt(localStorage.getItem("rpc_index") || "0", 10);
  const total = RPC_LIST.length;

  for (let i = 0; i < total; i++) {
    const index = (lastIndex + i) % total;
    const rpc = RPC_LIST[index];

    if (await checkRpcHealth(rpc)) {
      // Set next index for next round
      localStorage.setItem("rpc_index", ((index + 1) % total).toString());

      // Optional: save to localStorage only if not already user-defined
      localStorage.setItem("solana_rpc_url", rpc);

      return rpc;
    }
  }

  // 3. Fallback to the first RPC (even if unhealthy)
  console.warn("[RPC] No healthy RPC found. Using fallback.");
  return RPC_LIST[0];
};

/**
 * Clears custom user RPC (used for debug or refresh).
 */
export const resetRpcUrl = () => {
  localStorage.removeItem("solana_rpc_url");
  localStorage.removeItem("rpc_index");
};

export const FEE_RECEIVER = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

export const PROGRAM_ID = new PublicKey("FFL71XjBkjq5gce7EtpB7Wa5p8qnRNueLKSzM4tkEMoc");

export const getExplorerTxUrl = (tx) =>
  `https://explorer.solana.com/tx/${tx}?cluster=mainnet-beta`;

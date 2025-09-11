import { Connection, PublicKey } from "@solana/web3.js";

// Devnet RPC list with fallback
export const RPC_LIST = [
  "https://api.devnet.solana.com",
  "https://solana-devnet.api.onfinality.io/public",
  "https://solana-devnet.drpc.org",
  "https://rpc.ankr.com/solana_devnet",
  "https://solana-devnet.g.alchemy.com/public"
];

// Default (used before checking others)
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

  // 1. User-defined custom RPC (not in our round-robin list)
  if (userDefined && !RPC_LIST.includes(userDefined)) {
    const healthy = await checkRpcHealth(userDefined);
    if (healthy) return userDefined;

    console.warn("[RPC] Custom user RPC unhealthy, removing...");
    localStorage.removeItem("solana_rpc_url");
  }

  // 2. Reuse last working known RPC (even if from RPC_LIST)
  if (userDefined && RPC_LIST.includes(userDefined)) {
    const healthy = await checkRpcHealth(userDefined);
    if (healthy) return userDefined;

    console.warn(`[RPC] Previous working RPC unhealthy: ${userDefined}`);
  }

  // 3. Round-robin among RPC_LIST, starting from saved index
  const lastIndex = parseInt(localStorage.getItem("rpc_index") || "0", 10);
  const total = RPC_LIST.length;

  for (let i = 0; i < total; i++) {
    const index = (lastIndex + i) % total;
    const rpc = RPC_LIST[index];

    if (await checkRpcHealth(rpc)) {
      // Set next index for future attempts
      localStorage.setItem("rpc_index", ((index + 1) % total).toString());

      // Save as currently working RPC
      localStorage.setItem("solana_rpc_url", rpc);

      return rpc;
    }
  }

  // 4. All failed — fallback to first (even if unhealthy)
  console.error("[RPC] All RPC endpoints unhealthy, falling back to default");
  const fallback = RPC_LIST[0];
  localStorage.setItem("solana_rpc_url", fallback);
  return fallback;
};


// Optional: manual reset
export const resetRpcUrl = () => {
  localStorage.removeItem("solana_rpc_url");
};

// Constants
export const FEE_RECEIVER = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
export const PROGRAM_ID = new PublicKey("31wdq6EJgHKRjZotAjc6vkuJ7aRyQPauwmgadPiEm8EY");

// Explorer formatter
export const getExplorerTxUrl = (tx) =>
  `https://explorer.solana.com/tx/${tx}?cluster=devnet`;

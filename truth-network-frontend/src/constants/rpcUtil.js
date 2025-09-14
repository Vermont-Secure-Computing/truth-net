import { Connection } from "@solana/web3.js";

/**
 * Generic round-robin RPC health check and selection.
 */
export async function getHealthyRpcUrl({
  rpcList,
  storageKey = "solana_rpc_url",
  indexKey = "rpc_index",
}) {
  const userDefined = localStorage.getItem(storageKey);

  // 1. Custom RPC
  if (userDefined && !rpcList.includes(userDefined)) {
    if (await checkRpcHealth(userDefined)) return userDefined;
    localStorage.removeItem(storageKey);
  }

  // 2. Previously used RPC in the list
  if (userDefined && rpcList.includes(userDefined)) {
    if (await checkRpcHealth(userDefined)) return userDefined;
  }

  // 3. Round-robin rotation
  const lastIndex = parseInt(localStorage.getItem(indexKey) || "0", 10);
  const total = rpcList.length;

  for (let i = 0; i < total; i++) {
    const index = (lastIndex + i) % total;
    const rpc = rpcList[index];

    if (await checkRpcHealth(rpc)) {
      localStorage.setItem(indexKey, ((index + 1) % total).toString());
      localStorage.setItem(storageKey, rpc);
      return rpc;
    }
  }

  // 4. All failed
  console.error(`[RPC] All endpoints unhealthy, using fallback: ${rpcList[0]}`);
  localStorage.setItem(storageKey, rpcList[0]);
  return rpcList[0];
}

export async function checkRpcHealth(rpcUrl) {
  try {
    const conn = new Connection(rpcUrl, { commitment: "processed" });
    const version = await conn.getVersion();
    return !!version["solana-core"];
  } catch (err) {
    console.warn(`[RPC Health] ${rpcUrl} failed:`, err?.message || err);
    return false;
  }
}

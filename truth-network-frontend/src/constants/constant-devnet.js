import { Connection, PublicKey } from "@solana/web3.js";
import { getHealthyRpcUrl } from "./rpcUtil";

// Devnet RPC list with fallback
export const RPC_LIST = [
  "https://api.devnet.solana.com",
  "https://solana-devnet.api.onfinality.io/public",
  "https://solana-devnet.drpc.org",
  "https://rpc.ankr.com/solana_devnet",
  "https://solana-devnet.g.alchemy.com/public"
];

export const DEFAULT_RPC_URL =
  localStorage.getItem("solana_rpc_url") || RPC_LIST[0];

export const getWorkingRpcUrl = async () => {
  return getHealthyRpcUrl({
    rpcList: RPC_LIST,
    storageKey: "solana_rpc_url",
    indexKey: "rpc_index",
  });
};

export const resetRpcUrl = () => {
  localStorage.removeItem("solana_rpc_url");
  localStorage.removeItem("rpc_index");
};

// Constants
export const FEE_RECEIVER = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
export const PROGRAM_ID = new PublicKey("31wdq6EJgHKRjZotAjc6vkuJ7aRyQPauwmgadPiEm8EY");

// Explorer formatter
export const getExplorerTxUrl = (tx) =>
  `https://explorer.solana.com/tx/${tx}?cluster=devnet`;

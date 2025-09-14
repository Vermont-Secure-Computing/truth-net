import { Connection, PublicKey } from "@solana/web3.js";
import { getHealthyRpcUrl } from "./rpcUtil";

export const RPC_LIST = [
  "https://go.getblock.us/86aac42ad4484f3c813079afc201451c",
  "https://solana.rpc.grove.city/v1/01fdb492",
  "https://solana.leorpc.com/?api_key=FREE",
  "https://public.rpc.solanavibestation.com/",
  "https://solana.api.onfinality.io/public"
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

export const FEE_RECEIVER = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

export const PROGRAM_ID = new PublicKey("FFL71XjBkjq5gce7EtpB7Wa5p8qnRNueLKSzM4tkEMoc");

export const getExplorerTxUrl = (tx) =>
  `https://explorer.solana.com/tx/${tx}?cluster=mainnet-beta`;

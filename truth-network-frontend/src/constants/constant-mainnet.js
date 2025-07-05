import { PublicKey } from "@solana/web3.js";

// Fee receiver hardcoded on-chain
export const FEE_RECEIVER = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

// Program ID
export const PROGRAM_ID = new PublicKey("FFL71XjBkjq5gce7EtpB7Wa5p8qnRNueLKSzM4tkEMoc");

export const DEFAULT_RPC_URL = localStorage.getItem("solana_rpc_url") ||"https://solana-rpc.publicnode.com";


// Function to reset the RPC to default (optional, if you want a reset button later)
export const resetRpcUrl = () => {
  localStorage.removeItem("solana_rpc_url");
};


// Export explorer mainnet
export const getExplorerTxUrl = (tx) =>
  `https://explorer.solana.com/tx/${tx}?cluster=mainnet-beta`;
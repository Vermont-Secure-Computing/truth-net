import { PublicKey } from "@solana/web3.js";

// Fee receiver hardcoded on-chain
export const FEE_RECEIVER = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

// Program ID
export const PROGRAM_ID = new PublicKey("C26LU8DVw2c51gNWFLye1oAwH3hiRPGcGCA2crnER3mR");

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

// Function to get the current RPC URL
export const getRpcUrl = () => {
  return localStorage.getItem("solana_rpc_url") || DEFAULT_RPC_URL;
};

// Function to reset the RPC to default (optional, if you want a reset button later)
export const resetRpcUrl = () => {
  localStorage.removeItem("solana_rpc_url");
};

// Export the default for display/reference
export const DEFAULT_RPC = DEFAULT_RPC_URL;


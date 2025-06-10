import * as mainnet from "./constant-mainnet.js";
import * as devnet from "./constant-devnet.js";

export function getConstants() {
  return import.meta.env.VITE_SOLANA_NETWORK === "mainnet" ? mainnet : devnet;
}

export async function getIDL() {
  if (import.meta.env.VITE_SOLANA_NETWORK === "mainnet") {
    const idlModule = await import("../idl/idl.mainnet.json");
    return idlModule.default;
  } else {
    const idlModule = await import("../idl/idl.devnet.json");
    return idlModule.default;
  }
}
import * as mainnet from "./constant-mainnet.js";
import * as devnet from "./constant-devnet.js";

export function getConstants() {
  return import.meta.env.VITE_NETWORK === "mainnet" ? mainnet : devnet;
}

export async function getIDL() {
  const network = import.meta.env.VITE_NETWORK;

  console.log("📦 Loading IDL for network:", network);
  if (import.meta.env.VITE_NETWORK === "mainnet") {
    const idlModule = await import("../idl/idl.mainnet.json");
    return idlModule.default;
  } else {
    const idlModule = await import("../idl/idl.devnet.json");
    return idlModule.default;
  }
}
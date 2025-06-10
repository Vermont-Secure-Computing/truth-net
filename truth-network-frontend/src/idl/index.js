import truthIDLMainnet from './mainnet/idl.mainnet.json'
import truthIDLDevnet from './devnet/idl.devnet.json'

export function getIdls() {
    if (import.meta.env.VITE_NETWORK === "mainnet") {
      return {
        truthNetworkIDL: truthIDLMainnet
      };
    } else {
      return {
        truthNetworkIDL: truthIDLDevnet
      };
    }
  }
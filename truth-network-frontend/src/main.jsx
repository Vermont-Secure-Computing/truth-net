import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { Buffer } from 'buffer';
import App from "./App";
import "@solana/wallet-adapter-react-ui/styles.css";
import './index.css';

window.Buffer = Buffer;


const Root = () => {
    const network = clusterApiUrl("mainnet-beta");
    const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

    return (
        <ConnectionProvider endpoint={network}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    <BrowserRouter>
                        <App />
                    </BrowserRouter>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);

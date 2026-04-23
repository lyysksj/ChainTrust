"use client";

import { ReactNode, useMemo } from "react";
import {
  ConnectionProvider as _ConnectionProvider,
  WalletProvider as _WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider as _WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// Wallet-adapter's FC<Props> collides with React 18's stricter ReactNode in
// recent @types/react. Cast to any-typed components to restore JSX usage.
const ConnectionProvider = _ConnectionProvider as unknown as React.FC<{
  endpoint: string;
  children: ReactNode;
}>;
const WalletProvider = _WalletProvider as unknown as React.FC<{
  wallets: unknown[];
  autoConnect?: boolean;
  children: ReactNode;
}>;
const WalletModalProvider = _WalletModalProvider as unknown as React.FC<{
  children: ReactNode;
}>;

const RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "http://127.0.0.1:8899";

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => {
    if (RPC === "devnet") return clusterApiUrl("devnet");
    if (RPC === "mainnet-beta") return clusterApiUrl("mainnet-beta");
    return RPC;
  }, []);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

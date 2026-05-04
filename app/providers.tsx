"use client";

import { ReactNode, useMemo } from "react";
import {
  ConnectionProvider as _ConnectionProvider,
  WalletProvider as _WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider as _WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { LanguageProvider } from "@/lib/i18n";

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

// Resolution order:
//   1. NEXT_PUBLIC_HELIUS_RPC_URL — fully-formed Helius URL (preferred when set)
//   2. NEXT_PUBLIC_SOLANA_RPC / NEXT_PUBLIC_RPC_URL — explicit override
//   3. fallback to public devnet
//
// The Helius URL embeds the API key in the query string. That key is
// browser-visible by design — restrict it on the Helius dashboard with
// referer + IP allowlists. Don't share the same key with the server-side
// HELIUS_API_KEY (which has webhook-mgmt permissions).
const RPC =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "devnet";

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
    <LanguageProvider>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </LanguageProvider>
  );
}

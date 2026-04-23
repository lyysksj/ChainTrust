"use client";

import dynamic from "next/dynamic";

// Wallet modal button ships with its own DOM; disable SSR to avoid hydration
// mismatches on connection state.
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (m) => m.WalletMultiButton,
    ),
  { ssr: false },
);

export function WalletButton() {
  return <WalletMultiButton />;
}

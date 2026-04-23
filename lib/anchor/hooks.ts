"use client";

import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { buildProgram, buildProvider } from "./client";

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  return useMemo(() => {
    if (!wallet) return null;
    const provider = buildProvider(connection, wallet);
    return buildProgram(provider);
  }, [connection, wallet]);
}

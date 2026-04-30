"use client";

import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import {
  buildProgram,
  buildProvider,
  buildReadonlyProvider,
} from "./client";

/**
 * Returns an Anchor Program. NEVER null — when no wallet is connected, the
 * program is bound to a read-only provider that can still do account
 * fetches. Write paths (`.rpc()`) will throw if used without a real wallet,
 * which is the correct guard.
 *
 * Pages should treat the program as always available for reads. Only the
 * write call sites should additionally check `useWallet().publicKey`.
 */
export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  return useMemo(() => {
    const provider = wallet
      ? buildProvider(connection, wallet)
      : buildReadonlyProvider(connection);
    return buildProgram(provider);
  }, [connection, wallet]);
}

/**
 * Explicit read-only program for components that never write. Identical to
 * useProgram() in read behavior; provided for intent clarity.
 */
export function useReadonlyProgram() {
  const { connection } = useConnection();
  return useMemo(() => {
    const provider = buildReadonlyProvider(connection);
    return buildProgram(provider);
  }, [connection]);
}

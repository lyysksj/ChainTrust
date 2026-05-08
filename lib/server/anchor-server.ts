/**
 * Server-side Anchor provider that signs with the registry admin keypair.
 *
 * Used by routes that need to call admin-only program instructions
 * (currently `attest_human_proof`).
 */
import { AnchorProvider, Program, type Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import idlJson from "@/lib/anchor/idl/chaintrust.json";
import type { Chaintrust } from "@/lib/anchor/idl/chaintrust";
import { heliusRpcUrl } from "@/lib/helius/client";

function buildAdminWallet(kp: Keypair): Wallet {
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      tx: T,
    ): Promise<T> => {
      if ("partialSign" in tx) {
        (tx as Transaction).partialSign(kp);
      } else {
        (tx as VersionedTransaction).sign([kp]);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[],
    ): Promise<T[]> => {
      for (const tx of txs) {
        if ("partialSign" in tx) {
          (tx as Transaction).partialSign(kp);
        } else {
          (tx as VersionedTransaction).sign([kp]);
        }
      }
      return txs;
    },
  };
}

export function buildAdminProgram(
  admin: Keypair,
  rpcUrl: string,
): { program: Program<Chaintrust>; provider: AnchorProvider } {
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = buildAdminWallet(admin);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const program = new Program(idlJson as Chaintrust, provider);
  return { program, provider };
}

/**
 * Read-only program handle for endpoints that only fetch account state
 * (e.g. /api/worldid/check). Uses a throwaway keypair so we don't pull in
 * REGISTRY_ADMIN_KEYPAIR_JSON for plain reads — useful when the admin key
 * isn't configured yet but we still want the route to function.
 */
export function buildReadonlyProgram(
  rpcUrl: string,
): { program: Program<Chaintrust>; provider: AnchorProvider } {
  return buildAdminProgram(Keypair.generate(), rpcUrl);
}

export function defaultRpcUrl(): string {
  // Prefer Helius when configured — its rate limits and reliability are
  // strictly better than the public devnet endpoint, and the URL already
  // carries the auth.
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    heliusRpcUrl() ||
    "http://127.0.0.1:8899"
  );
}

export { PublicKey };

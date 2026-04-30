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

export function defaultRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "http://127.0.0.1:8899"
  );
}

export { PublicKey };

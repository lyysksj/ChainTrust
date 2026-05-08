/**
 * Dump all registered ChainTrust users from the deployed program.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register \
 *     scripts/list-users.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  AnchorProvider,
  Program,
  type Wallet,
} from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import idlJson from "@/lib/anchor/idl/chaintrust.json";
import type { Chaintrust } from "@/lib/anchor/idl/chaintrust";

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

async function main() {
  loadEnvLocal();
  // Prefer the server-side SOLANA_RPC_URL because the public NEXT_PUBLIC_*
  // keys may be locked by Allowed Domains and reject Node scripts that have
  // no Origin header.
  const rpc =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    "https://api.devnet.solana.com";

  const conn = new Connection(rpc, "confirmed");
  const dummy = Keypair.generate();
  const wallet: Wallet = {
    publicKey: dummy.publicKey,
    payer: dummy,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
  const provider = new AnchorProvider(conn, wallet, { commitment: "confirmed" });
  const program = new Program(idlJson as Chaintrust, provider);

  const users = await program.account.userProfile.all();
  users.sort(
    (a, b) =>
      Number((b.account as any).registeredAt) -
      Number((a.account as any).registeredAt),
  );

  console.log(`Total registered users: ${users.length}\n`);
  for (const u of users) {
    const a = u.account as any;
    const ts = Number(a.registeredAt);
    const date = ts > 0 ? new Date(ts * 1000).toISOString() : "(unknown)";
    console.log(`wallet:    ${a.wallet.toBase58()}`);
    console.log(`username:  ${a.username}`);
    console.log(`registered: ${date}`);
    console.log(`metadata:  ${a.metadataUri || "(none)"}`);
    console.log(`pda:       ${u.publicKey.toBase58()}`);
    console.log("---");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

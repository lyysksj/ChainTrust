/**
 * Pitch-deck traction snapshot.
 *
 * Reads live counts from the deployed program on whatever cluster the
 * configured RPC points at (devnet by default).
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register \
 *     scripts/traction-snapshot.ts
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
  const rpc =
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    process.env.SOLANA_RPC_URL ||
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

  const [entities, issuers, rels, users, projects, comments, humanproofs] =
    await Promise.all([
      program.account.entity.all(),
      program.account.issuer.all(),
      program.account.relationship.all(),
      program.account.userProfile.all(),
      program.account.project.all(),
      program.account.commentRecord.all(),
      program.account.humanProof.all(),
    ]);

  const tier1 = issuers.filter((i) => (i.account as any).trustTier === 1).length;
  const tier2 = issuers.filter((i) => (i.account as any).trustTier === 2).length;
  const tier3 = issuers.filter((i) => (i.account as any).trustTier === 3).length;

  const claimedEntities = entities.filter(
    (e) => (e.account as any).isClaimed,
  ).length;

  const out = {
    cluster_rpc: rpc.replace(/api-key=[^&]+/, "api-key=<redacted>"),
    timestamp_iso: new Date().toISOString(),
    program_id: "HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt",
    counts: {
      entities: entities.length,
      entities_claimed: claimedEntities,
      relationships: rels.length,
      issuers_total: issuers.length,
      issuers_tier1: tier1,
      issuers_tier2: tier2,
      issuers_tier3: tier3,
      users: users.length,
      humanproofs: humanproofs.length,
      projects: projects.length,
      comments: comments.length,
    },
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

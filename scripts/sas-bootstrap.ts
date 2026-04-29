/**
 * One-time SAS bootstrap for ChainTrust.
 *
 * What it does:
 *   1. Creates the platform Credential PDA seeded by the runner's wallet.
 *   2. Creates 9 Schema PDAs under that Credential (one per RelKind).
 *   3. Optionally accepts `--add-signers <pubkey,pubkey,...>` to seed the
 *      authorized_signers list of the Credential. Default: just the runner.
 *
 * Run:
 *   npx ts-node scripts/sas-bootstrap.ts \
 *     --rpc https://api.devnet.solana.com \
 *     --keypair ~/.config/solana/id.json \
 *     [--add-signers SIGNER1,SIGNER2]
 *
 * After it succeeds, set in your .env.local:
 *   NEXT_PUBLIC_SAS_DUAL_WRITE=true
 *   NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY=<the runner's wallet pubkey>
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  SAS_CREDENTIAL_NAME,
  SAS_SCHEMA_NAMES,
} from "@/lib/sas/config";
import {
  sasCredentialPda,
  sasSchemaPda,
} from "@/lib/sas/pdas";
import {
  CHAINTRUST_SCHEMA_FIELD_NAMES,
  CHAINTRUST_SCHEMA_LAYOUT,
  buildCreateCredentialIx,
  buildCreateSchemaIx,
} from "@/lib/sas/instructions";

type Args = {
  rpc: string;
  keypair: string;
  addSigners: PublicKey[];
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    rpc: get("--rpc") ?? "https://api.devnet.solana.com",
    keypair:
      get("--keypair") ??
      path.join(os.homedir(), ".config", "solana", "id.json"),
    addSigners: (get("--add-signers") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => new PublicKey(s)),
  };
}

function loadKeypair(p: string): Keypair {
  const expanded = p.startsWith("~") ? p.replace("~", os.homedir()) : p;
  const raw = JSON.parse(fs.readFileSync(expanded, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const args = parseArgs();
  const conn = new Connection(args.rpc, "confirmed");
  const payer = loadKeypair(args.keypair);

  console.log("SAS bootstrap");
  console.log("  RPC:       ", args.rpc);
  console.log("  Authority: ", payer.publicKey.toBase58());

  const credential = sasCredentialPda(payer.publicKey);
  console.log("  Credential PDA:", credential.toBase58());

  const signers = [payer.publicKey, ...args.addSigners];
  const dedupe = Array.from(new Set(signers.map((s) => s.toBase58()))).map(
    (s) => new PublicKey(s),
  );

  // ---- 1. Create Credential (skip if exists) ----
  const credInfo = await conn.getAccountInfo(credential);
  if (credInfo) {
    console.log("  ✓ Credential already exists, skipping create");
  } else {
    const ix = buildCreateCredentialIx({
      payer: payer.publicKey,
      credential,
      authority: payer.publicKey,
      name: SAS_CREDENTIAL_NAME,
      signers: dedupe,
    });
    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(conn, tx, [payer]);
    console.log("  ✓ Credential created:", sig);
  }

  // ---- 2. Create one Schema per RelKind ----
  for (const [kindStr, name] of Object.entries(SAS_SCHEMA_NAMES)) {
    const kind = Number(kindStr);
    const schema = sasSchemaPda(credential, kind);
    const info = await conn.getAccountInfo(schema);
    if (info) {
      console.log(`  ✓ Schema [${name}] already exists, skipping`);
      continue;
    }
    const ix = buildCreateSchemaIx({
      payer: payer.publicKey,
      authority: payer.publicKey,
      credential,
      schema,
      name,
      description: `ChainTrust ${name} attestation. Payload is a 121-byte fixed record: entity(32) | kind(1) | target_ref(32) | evidence_hash(32) | valid_from(i64) | valid_until(i64) | revoked_at(i64).`,
      layout: CHAINTRUST_SCHEMA_LAYOUT,
      fieldNames: CHAINTRUST_SCHEMA_FIELD_NAMES,
    });
    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(conn, tx, [payer]);
    console.log(`  ✓ Schema [${name}] created:`, sig);
  }

  console.log("\nDone. Set in .env.local:");
  console.log(`  NEXT_PUBLIC_SAS_DUAL_WRITE=true`);
  console.log(
    `  NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY=${payer.publicKey.toBase58()}`,
  );
  console.log(
    "\nReminder: every wallet that calls attest_relationship must be in the",
  );
  console.log(
    "Credential's authorized_signers list. Run again with --add-signers to add.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * One-time init: create the RegistryConfig PDA on the configured cluster.
 *
 * Run once after `anchor deploy` on a fresh cluster. The signer must equal
 * the program's hardcoded REGISTRY_BOOTSTRAP_ADMIN (see anchor/programs/
 * chaintrust/src/constants.rs).
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register \
 *     scripts/init-registry.ts
 *
 * Required env (loaded from .env.local automatically):
 *   REGISTRY_ADMIN_KEYPAIR_JSON  — JSON array of 64 bytes; this signer is
 *                                  used both as bootstrap admin AND as
 *                                  long-term admin_authority.
 *   SOLANA_RPC_URL               — optional; defaults to localnet.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  AnchorProvider,
  Program,
  type Wallet,
} from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

// Load .env.local explicitly (dotenv/config only reads .env).
function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
}
loadEnvLocal();

const idlJson = require("../lib/anchor/idl/chaintrust.json");

const CONFIG_SEED = Buffer.from("config");

function loadAdmin(): Keypair {
  const raw = process.env.REGISTRY_ADMIN_KEYPAIR_JSON;
  if (!raw) {
    throw new Error(
      "REGISTRY_ADMIN_KEYPAIR_JSON missing. Set it in .env.local first.",
    );
  }
  const arr = JSON.parse(raw) as number[];
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error(
      "REGISTRY_ADMIN_KEYPAIR_JSON must be a JSON array of 64 numbers",
    );
  }
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

function rpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    "http://127.0.0.1:8899"
  );
}

function buildAdminWallet(kp: Keypair): Wallet {
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      tx: T,
    ): Promise<T> => {
      if ("partialSign" in tx) (tx as Transaction).partialSign(kp);
      else (tx as VersionedTransaction).sign([kp]);
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[],
    ): Promise<T[]> => {
      for (const tx of txs) {
        if ("partialSign" in tx) (tx as Transaction).partialSign(kp);
        else (tx as VersionedTransaction).sign([kp]);
      }
      return txs;
    },
  };
}

async function main() {
  const admin = loadAdmin();
  const url = rpcUrl();
  console.log("RPC          :", url);
  console.log("Admin pubkey :", admin.publicKey.toBase58());

  const connection = new Connection(url, "confirmed");
  const provider = new AnchorProvider(connection, buildAdminWallet(admin), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const program = new Program(idlJson, provider) as Program<any>;

  const [registryConfig] = PublicKey.findProgramAddressSync(
    [CONFIG_SEED],
    program.programId,
  );
  console.log("RegistryConfig PDA:", registryConfig.toBase58());

  const existing = await connection.getAccountInfo(registryConfig);
  if (existing) {
    console.log("✓ RegistryConfig already initialized — nothing to do.");
    return;
  }

  console.log("Submitting initialize_registry_config...");
  const sig = await (program.methods as any)
    .initializeRegistryConfig(admin.publicKey)
    .accountsPartial({
      registryConfig,
      signer: admin.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("✓ tx:", sig);
}

main().catch((e) => {
  console.error("init-registry failed:", e);
  process.exit(1);
});

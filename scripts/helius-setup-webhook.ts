/**
 * Helius webhook management for ChainTrust.
 *
 * Subcommands:
 *   list                      print every webhook on this Helius account
 *   create                    register a webhook for the ChainTrust program
 *   delete <webhookID>        remove one webhook by id
 *
 * Required env (in .env.local):
 *   HELIUS_API_KEY            your Helius account API key
 *   HELIUS_WEBHOOK_URL        public URL of /api/helius/webhook
 *                             (use ngrok during local dev, e.g.
 *                              https://abc-123.ngrok-free.app/api/helius/webhook)
 *   HELIUS_WEBHOOK_AUTH       shared secret — Helius will send this in the
 *                             Authorization header on every delivery
 *   HELIUS_CLUSTER            optional, "devnet" (default) or "mainnet-beta"
 *
 * Run:
 *   npm run helius:list
 *   npm run helius:create
 *   npm run helius:delete -- <webhookID>
 */
import {
  createWebhook,
  deleteWebhook,
  isHeliusConfigured,
  listWebhooks,
} from "@/lib/helius/client";
import { PROGRAM_ID } from "@/lib/anchor/pdas";

function loadEnv() {
  // ts-node + dotenv aren't wired into the project, so do a minimal manual
  // load of .env.local before reading process.env. Mirrors the pattern used
  // in scripts/sas-bootstrap.ts.
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const file = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    // best-effort
  }
}

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

async function main() {
  loadEnv();

  const sub = process.argv[2];
  if (!sub || !["list", "create", "delete"].includes(sub)) {
    console.error(
      "Usage: helius-setup-webhook.ts <list|create|delete [id]>",
    );
    process.exit(2);
  }

  if (!isHeliusConfigured()) fail("HELIUS_API_KEY is not set");

  if (sub === "list") {
    const hooks = await listWebhooks();
    console.log(`Helius webhooks on this account: ${hooks.length}`);
    for (const h of hooks) {
      console.log(
        `  ${h.webhookID}  ${h.webhookType}  ${h.webhookURL}\n` +
          `    accounts: ${h.accountAddresses.length}  types: ${h.transactionTypes.join(",")}`,
      );
    }
    return;
  }

  if (sub === "delete") {
    const id = process.argv[3];
    if (!id) fail("delete requires a webhookID argument");
    await deleteWebhook(id);
    console.log(`Deleted webhook ${id}`);
    return;
  }

  // create
  const url = process.env.HELIUS_WEBHOOK_URL;
  const authHeader = process.env.HELIUS_WEBHOOK_AUTH;
  if (!url) fail("HELIUS_WEBHOOK_URL is not set");
  if (!authHeader)
    fail(
      "HELIUS_WEBHOOK_AUTH is not set — required so the receiver can verify deliveries",
    );

  const program = PROGRAM_ID.toBase58();
  console.log(
    `Creating webhook for ChainTrust program ${program} → ${url}…`,
  );
  const hook = await createWebhook({
    webhookURL: url!,
    accountAddresses: [program],
    transactionTypes: ["ANY"],
    webhookType: "enhanced",
    authHeader: authHeader!,
  });
  console.log(`✓ Created webhook ${hook.webhookID}`);
  console.log(JSON.stringify(hook, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

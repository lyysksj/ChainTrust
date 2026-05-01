/**
 * Append-only JSONL log of on-chain events delivered by Helius webhooks.
 *
 * One line per Helius enhanced transaction. The schema is intentionally
 * loose — we record what's useful for indexing later (signature, slot,
 * timestamp, fee payer, accounts touched) and keep the original payload
 * under `raw` so a future indexer can re-derive richer fields without
 * re-fetching from RPC.
 *
 * File: `data/audit/chain-events.log`. Same directory as the upload audit
 * log, separate stream.
 */
import fs from "node:fs/promises";
import path from "node:path";

export type ChainEvent = {
  ts: string;
  signature: string;
  slot: number | null;
  timestamp: number | null;
  feePayer: string | null;
  type: string | null;
  source: string | null;
  accountsTouched: string[];
  description: string | null;
  raw: unknown;
};

const ROOT = path.join(process.cwd(), "data", "audit");
const LOG = path.join(ROOT, "chain-events.log");

async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function appendChainEvents(events: ChainEvent[]): Promise<void> {
  if (events.length === 0) return;
  try {
    await ensureRoot();
    const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    await fs.appendFile(LOG, lines, "utf8");
  } catch {
    // Logging must not block the webhook ack.
  }
}

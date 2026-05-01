/**
 * POST /api/helius/webhook
 *
 * Receiver for Helius webhook deliveries. Helius posts a JSON array of
 * enhanced transactions for every signature that matches the registered
 * filters (in our case: any tx that touches the ChainTrust program ID).
 *
 * Hardening:
 *   - Authorization header must equal HELIUS_WEBHOOK_AUTH (set on both
 *     sides at registration time).
 *   - Body size capped at 1 MB to keep route bundles small.
 *   - Log append is fire-and-forget; the route always 200s if auth passes
 *     so Helius doesn't retry-spam us.
 *
 * The receiver intentionally does NOT decode our Anchor instructions yet —
 * Phase 1 ships an event log; an indexer (Postgres) reads it later.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  appendChainEvents,
  type ChainEvent,
} from "@/lib/server/chain-events-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024 * 1024;

type HeliusEnhancedTx = {
  signature?: string;
  slot?: number;
  timestamp?: number;
  feePayer?: string;
  type?: string;
  source?: string;
  description?: string;
  accountData?: { account?: string }[];
  events?: unknown;
  instructions?: unknown[];
  [key: string]: unknown;
};

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function asEvent(tx: HeliusEnhancedTx): ChainEvent {
  const accounts: string[] = [];
  if (Array.isArray(tx.accountData)) {
    for (const a of tx.accountData) {
      if (a && typeof a.account === "string") accounts.push(a.account);
    }
  }
  return {
    ts: new Date().toISOString(),
    signature: tx.signature ?? "",
    slot: typeof tx.slot === "number" ? tx.slot : null,
    timestamp: typeof tx.timestamp === "number" ? tx.timestamp : null,
    feePayer: tx.feePayer ?? null,
    type: tx.type ?? null,
    source: tx.source ?? null,
    accountsTouched: accounts,
    description: tx.description ?? null,
    raw: tx,
  };
}

export async function POST(req: NextRequest) {
  const expected = process.env.HELIUS_WEBHOOK_AUTH;
  if (!expected) {
    // Loud failure — refuse to accept unauthenticated webhooks even in dev.
    return NextResponse.json(
      { error: "HELIUS_WEBHOOK_AUTH not configured on receiver" },
      { status: 503 },
    );
  }
  const provided = req.headers.get("authorization") ?? "";
  if (provided !== expected) return unauthorized();

  const cl = Number(req.headers.get("content-length") ?? "0");
  if (cl > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "body too large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const txs: HeliusEnhancedTx[] = Array.isArray(payload)
    ? (payload as HeliusEnhancedTx[])
    : [payload as HeliusEnhancedTx];

  const events = txs.filter((t) => t && typeof t === "object").map(asEvent);
  void appendChainEvents(events);

  return NextResponse.json({ ok: true, received: events.length });
}

/** GET probe so Helius's webhook config UI / our own ops can sanity check
 *  the URL without sending a fake transaction. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    expectsAuthHeader: !!process.env.HELIUS_WEBHOOK_AUTH,
    method: "POST",
  });
}

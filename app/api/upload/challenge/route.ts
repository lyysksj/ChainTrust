/**
 * GET /api/upload/challenge
 *
 * Issues a one-time nonce + the exact challenge message the wallet should
 * sign. The client posts the file to /api/upload along with the wallet
 * signature; the server reconstructs the message by nonce lookup and
 * verifies the signature before pinning anything.
 *
 * Nonces are single-use, expire after 5 minutes, and are kept in process
 * memory. Anyone can call this — it's free; it's the upload endpoint that's
 * gated by the proof-of-key.
 */
import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/server/upload-nonce";

export const runtime = "nodejs";

export async function GET() {
  const ch = issueNonce();
  return NextResponse.json(ch, {
    headers: { "cache-control": "no-store" },
  });
}

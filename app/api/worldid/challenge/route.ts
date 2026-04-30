/**
 * GET /api/worldid/challenge?wallet=<base58>
 *
 * Issues a single-use, wallet-bound nonce. The wallet must sign the returned
 * message with `signMessage`; the signature is later submitted to
 * /api/worldid/verify and verified before a HumanProof PDA is created on
 * chain. Nonces expire after 5 minutes and are scoped to the wallet pubkey
 * embedded in the message — replaying the message under a different wallet
 * pubkey will fail signature verification.
 */
import { NextRequest, NextResponse } from "next/server";
import { issueWorldIdNonce } from "@/lib/server/worldid-challenge";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json(
      { error: "wallet must be a base58 Solana pubkey" },
      { status: 400 },
    );
  }
  const ch = issueWorldIdNonce(wallet);
  return NextResponse.json(ch, {
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Open metadata-upload endpoint — DEPRECATED.
 *
 * This used to be a free, unauthenticated text-pin endpoint. Anyone could
 * scribble to the storage backend, attach the resulting URI to an Entity /
 * Comment / Issuer record on chain, and burn through your IPFS quota. The
 * authenticated replacement is `/api/upload/metadata` (challenge + wallet
 * signature + per-wallet rate limit).
 *
 * In production the route is hard-disabled. In dev it's also disabled by
 * default to make sure no caller accidentally regresses; flip
 * `ALLOW_LEGACY_MOCK_UPLOAD=true` in `.env.local` if you really need it for
 * a one-off script.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOW_LEGACY = process.env.ALLOW_LEGACY_MOCK_UPLOAD === "true";

export async function POST() {
  if (!ALLOW_LEGACY) {
    return NextResponse.json(
      {
        error:
          "Deprecated. Use POST /api/upload/metadata with x-pubkey / x-signature / x-nonce headers.",
        replacement: "/api/upload/metadata",
      },
      { status: 410 },
    );
  }
  return NextResponse.json(
    { error: "Legacy fallback enabled but no implementation in this build" },
    { status: 501 },
  );
}

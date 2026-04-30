/**
 * Open image-upload endpoint — DEPRECATED.
 *
 * Replaced by the authenticated `/api/upload/image` route. The original
 * unauthenticated path is permanently disabled to close the anonymous
 * disk-fill / IPFS-pin abuse surface.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Deprecated. Use POST /api/upload/image with x-pubkey / x-signature / x-nonce headers.",
      replacement: "/api/upload/image",
    },
    { status: 410 },
  );
}

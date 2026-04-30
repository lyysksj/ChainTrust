/**
 * POST /api/upload/metadata
 *
 * Authenticated text/JSON upload for off-chain metadata that ends up in a
 * Relationship.evidence_uri / Entity.metadata_uri / CommentRecord.content_uri
 * field. Same wallet-signed challenge + rate-limit envelope as /api/upload,
 * just for plain content instead of multipart files.
 *
 * Replaces the open `/api/mock/upload` endpoint, which let anyone scribble
 * to the storage backend without proving wallet ownership.
 *
 * Headers:
 *   x-pubkey      base58 wallet pubkey
 *   x-signature   base58 ed25519 signature over the issued challenge message
 *   x-nonce       hex nonce from /api/upload/challenge
 *
 * Query:
 *   sensitivity   "public" (default) | "sensitive"
 *
 * Body:
 *   raw text / JSON. Empty body is rejected.
 */
import { NextRequest, NextResponse } from "next/server";
import { putContent, type Sensitivity } from "@/lib/storage";
import { verifySolanaSignature } from "@/lib/server/verify-signature";
import { consumeNonce } from "@/lib/server/upload-nonce";
import { checkAndConsume } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 256 * 1024; // 256 KB cap on metadata payloads
const RATE_SHORT_WINDOW_SEC = 5;
const RATE_SHORT_MAX = 4;
const RATE_LONG_WINDOW_SEC = 24 * 3600;
const RATE_LONG_MAX = 200;

function bad(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  const pubkey = req.headers.get("x-pubkey")?.trim() ?? "";
  const signature = req.headers.get("x-signature")?.trim() ?? "";
  const nonce = req.headers.get("x-nonce")?.trim() ?? "";

  if (!pubkey || !signature || !nonce) {
    return bad(401, "Missing x-pubkey, x-signature, or x-nonce header");
  }
  const consumed = consumeNonce(nonce);
  if (!consumed.ok) return bad(401, consumed.reason);
  if (!verifySolanaSignature(consumed.message, signature, pubkey)) {
    return bad(401, "Bad signature");
  }

  const shortRl = checkAndConsume(
    `metadata:${pubkey}:short`,
    RATE_SHORT_WINDOW_SEC,
    RATE_SHORT_MAX,
  );
  if (!shortRl.allowed) {
    const r = bad(
      429,
      `Too many uploads. Retry in ${shortRl.retryAfterSec}s.`,
    );
    r.headers.set("retry-after", String(shortRl.retryAfterSec));
    return r;
  }
  const longRl = checkAndConsume(
    `metadata:${pubkey}:long`,
    RATE_LONG_WINDOW_SEC,
    RATE_LONG_MAX,
  );
  if (!longRl.allowed) {
    const r = bad(
      429,
      `Daily metadata quota exceeded. Retry in ${Math.ceil(longRl.retryAfterSec / 3600)}h.`,
    );
    r.headers.set("retry-after", String(longRl.retryAfterSec));
    return r;
  }

  const sensitivity = (req.nextUrl.searchParams.get("sensitivity") ??
    "public") as Sensitivity;
  if (sensitivity !== "public" && sensitivity !== "sensitive") {
    return bad(400, "sensitivity must be 'public' or 'sensitive'");
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return bad(400, "Could not read request body");
  }
  if (!body) return bad(400, "Body required");
  if (Buffer.byteLength(body, "utf8") > MAX_BYTES) {
    return bad(413, `Metadata payload exceeds ${MAX_BYTES / 1024} KB`);
  }

  try {
    const result = await putContent(body, sensitivity);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: String((err as Error).message ?? err) },
      { status: 502 },
    );
  }
}

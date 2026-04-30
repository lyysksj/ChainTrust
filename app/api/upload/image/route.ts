/**
 * POST /api/upload/image
 *
 * Authenticated image upload for community-signal attachments. Same
 * challenge-sig pattern as /api/upload, scoped to images and a tighter size
 * cap (5 MB). Replaces the open `/api/mock/upload-image` endpoint.
 *
 * MIME whitelist deliberately excludes SVG (inline-JS attack surface).
 */
import { NextRequest, NextResponse } from "next/server";
import { putImagePublic } from "@/lib/storage";
import { verifySolanaSignature } from "@/lib/server/verify-signature";
import { consumeNonce } from "@/lib/server/upload-nonce";
import { checkAndConsume } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const RATE_SHORT_WINDOW_SEC = 5;
const RATE_SHORT_MAX = 2;
const RATE_LONG_WINDOW_SEC = 24 * 3600;
const RATE_LONG_MAX = 50;

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
    `image:${pubkey}:short`,
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
    `image:${pubkey}:long`,
    RATE_LONG_WINDOW_SEC,
    RATE_LONG_MAX,
  );
  if (!longRl.allowed) {
    const r = bad(
      429,
      `Daily image quota exceeded. Retry in ${Math.ceil(longRl.retryAfterSec / 3600)}h.`,
    );
    r.headers.set("retry-after", String(longRl.retryAfterSec));
    return r;
  }

  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) return bad(400, "form field 'file' required");
    file = f;
  } catch {
    return bad(400, "Could not parse multipart body");
  }
  if (!ALLOWED.has(file.type)) {
    return bad(415, `Unsupported image type: ${file.type || "unknown"}`);
  }
  if (file.size > MAX_BYTES) {
    return bad(413, `Image exceeds ${MAX_BYTES / 1024 / 1024} MB limit`);
  }
  if (file.size === 0) return bad(400, "Empty file");

  const buf = new Uint8Array(await file.arrayBuffer());
  const ext =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type.split("/")[1] ?? "bin";

  try {
    const result = await putImagePublic(buf, ext);
    return NextResponse.json({
      uri: result.uri,
      hashHex: result.hashHex,
      contentType: file.type,
      backend: result.backend,
    });
  } catch (err) {
    return NextResponse.json(
      { error: String((err as Error).message ?? err) },
      { status: 502 },
    );
  }
}

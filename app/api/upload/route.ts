/**
 * POST /api/upload
 *
 * Authenticated, rate-limited file upload for evidence attached to
 * attestations. Pins the file to IPFS via Pinata when configured, falls
 * back to the in-process mock store for local dev.
 *
 * Request:
 *   multipart/form-data with field `file`
 *   headers:
 *     x-pubkey     base58 Solana wallet pubkey
 *     x-signature  base58 ed25519 signature over the challenge message
 *     x-nonce      hex nonce previously issued from /api/upload/challenge
 *
 * Response (200):
 *   { uri, hashHex, contentType, sizeBytes, backend }
 *
 * Hardening:
 *   1. Wallet must sign a fresh, single-use challenge. Anonymous uploads
 *      are not accepted.
 *   2. Per-wallet sliding rate limit (1 req / 10s, 10 req / 24h).
 *   3. MIME whitelist (PDF / PNG / JPEG / WebP). SVG is rejected — it
 *      can carry inline JS.
 *   4. Hard byte limit, 25 MB for PDF and 5 MB for images.
 *   5. Every accepted or rejected request is appended to data/audit/upload.log
 *      so abuse is traceable even if the file is later unpinned.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { putImagePublic } from "@/lib/storage";
import { verifySolanaSignature } from "@/lib/server/verify-signature";
import { consumeNonce } from "@/lib/server/upload-nonce";
import { checkAndConsume } from "@/lib/server/rate-limit";
import { appendUploadAudit } from "@/lib/server/audit-log";

export const runtime = "nodejs";

const MAX_BYTES_IMAGE = 5 * 1024 * 1024;
const MAX_BYTES_PDF = 25 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const RATE_SHORT_WINDOW_SEC = 10;
const RATE_SHORT_MAX = 1;
const RATE_LONG_WINDOW_SEC = 24 * 3600;
const RATE_LONG_MAX = 10;

function reject(
  status: number,
  error: string,
  audit: Partial<Parameters<typeof appendUploadAudit>[0]> & { mime: string; sizeBytes: number },
): NextResponse {
  void appendUploadAudit({
    ts: new Date().toISOString(),
    wallet: audit.wallet ?? null,
    uri: null,
    cid: null,
    sha256: audit.sha256 ?? null,
    mime: audit.mime,
    sizeBytes: audit.sizeBytes,
    backend: null,
    result: "rejected",
    reason: error,
  });
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  const pubkey = req.headers.get("x-pubkey")?.trim() ?? "";
  const signature = req.headers.get("x-signature")?.trim() ?? "";
  const nonce = req.headers.get("x-nonce")?.trim() ?? "";

  if (!pubkey || !signature || !nonce) {
    return reject(401, "Missing x-pubkey, x-signature, or x-nonce header", {
      mime: "",
      sizeBytes: 0,
    });
  }

  const consumed = consumeNonce(nonce);
  if (!consumed.ok) {
    return reject(401, consumed.reason, { wallet: pubkey, mime: "", sizeBytes: 0 });
  }
  if (!verifySolanaSignature(consumed.message, signature, pubkey)) {
    return reject(401, "Bad signature", { wallet: pubkey, mime: "", sizeBytes: 0 });
  }

  const shortRl = checkAndConsume(
    `upload:${pubkey}:short`,
    RATE_SHORT_WINDOW_SEC,
    RATE_SHORT_MAX,
  );
  if (!shortRl.allowed) {
    const r = NextResponse.json(
      { error: `Too many uploads. Retry in ${shortRl.retryAfterSec}s.` },
      { status: 429 },
    );
    r.headers.set("retry-after", String(shortRl.retryAfterSec));
    return r;
  }
  const longRl = checkAndConsume(
    `upload:${pubkey}:long`,
    RATE_LONG_WINDOW_SEC,
    RATE_LONG_MAX,
  );
  if (!longRl.allowed) {
    const hours = Math.ceil(longRl.retryAfterSec / 3600);
    const r = NextResponse.json(
      { error: `Daily upload quota exceeded. Retry in ~${hours}h.` },
      { status: 429 },
    );
    r.headers.set("retry-after", String(longRl.retryAfterSec));
    return r;
  }

  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) {
      return reject(400, "form field 'file' required", {
        wallet: pubkey,
        mime: "",
        sizeBytes: 0,
      });
    }
    file = f;
  } catch {
    return reject(400, "Could not parse multipart body", {
      wallet: pubkey,
      mime: "",
      sizeBytes: 0,
    });
  }

  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return reject(415, `Unsupported MIME type: ${file.type || "unknown"}`, {
      wallet: pubkey,
      mime: file.type,
      sizeBytes: file.size,
    });
  }

  const maxBytes = file.type === "application/pdf" ? MAX_BYTES_PDF : MAX_BYTES_IMAGE;
  if (file.size > maxBytes) {
    return reject(
      413,
      `File exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit`,
      { wallet: pubkey, mime: file.type, sizeBytes: file.size },
    );
  }
  if (file.size === 0) {
    return reject(400, "Empty file", {
      wallet: pubkey,
      mime: file.type,
      sizeBytes: 0,
    });
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(data).digest("hex");

  let result;
  try {
    result = await putImagePublic(data, ext);
  } catch (err) {
    return reject(502, `Storage backend failed: ${(err as Error).message}`, {
      wallet: pubkey,
      mime: file.type,
      sizeBytes: file.size,
      sha256,
    });
  }

  const cid =
    result.uri.startsWith("ipfs://")
      ? result.uri.slice("ipfs://".length).split(".")[0]
      : null;

  void appendUploadAudit({
    ts: new Date().toISOString(),
    wallet: pubkey,
    uri: result.uri,
    cid,
    sha256,
    mime: file.type,
    sizeBytes: file.size,
    backend: result.backend,
    result: "ok",
  });

  return NextResponse.json({
    uri: result.uri,
    hashHex: sha256,
    contentType: file.type,
    sizeBytes: file.size,
    backend: result.backend,
  });
}

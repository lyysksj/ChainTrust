/**
 * Stateless HMAC-signed challenge tokens for upload requests.
 *
 * Previously this module kept a per-process Map of issued nonces. That
 * worked on a single Next dev server but breaks on serverless platforms
 * (Vercel, Cloudflare Workers) where each request can land on a fresh
 * instance and the issuer-vs-verifier pair can resolve to different memory
 * spaces — `consumeNonce` would return "Unknown or expired nonce" on the
 * first attempt.
 *
 * The new design encodes everything the verifier needs (random salt,
 * expiry, the exact message the wallet should sign) into the token itself
 * and authenticates it with HMAC-SHA256 under a server-side secret. No
 * shared state required.
 *
 * Trade-off vs. the old design: a token can be replayed within its 5-minute
 * TTL. For this use case that's harmless — replay just re-uploads the same
 * content from the same wallet, and the upload routes hash-bind the request
 * body to the message, so an attacker can't substitute different content.
 */
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const TTL_MS = 15 * 60 * 1000;

/** Derive a stable HMAC secret. Production should set NONCE_HMAC_SECRET to
 *  a strong random string (`openssl rand -hex 32`). Otherwise we auto-derive
 *  from the admin keypair, which the server-side stack already requires. */
function getSecret(): Buffer {
  const explicit = process.env.NONCE_HMAC_SECRET;
  if (explicit && explicit.length >= 32) return Buffer.from(explicit, "utf8");
  const seed =
    process.env.REGISTRY_ADMIN_KEYPAIR_JSON ||
    process.env.REGISTRY_ADMIN_KEYPAIR_BASE58 ||
    "chaintrust-dev-fallback-please-set-NONCE_HMAC_SECRET";
  return createHash("sha256").update(seed).update("ct-upload-nonce-v1").digest();
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export type IssuedChallenge = {
  nonce: string;
  message: string;
  expiresAt: number;
};

export function issueNonce(now: number = Date.now()): IssuedChallenge {
  const expiresAt = now + TTL_MS;
  const random = randomBytes(32).toString("hex");
  const message = [
    "ChainTrust upload challenge",
    `nonce: ${random}`,
    `expires: ${new Date(expiresAt).toISOString()}`,
  ].join("\n");
  const payload = Buffer.from(
    JSON.stringify({ random, expiresAt, message }),
    "utf8",
  ).toString("base64url");
  const sig = sign(payload);
  return { nonce: `${payload}.${sig}`, message, expiresAt };
}

export type ConsumeResult =
  | { ok: true; message: string }
  | { ok: false; reason: string };

export function consumeNonce(
  nonce: string,
  now: number = Date.now(),
): ConsumeResult {
  const dot = nonce.indexOf(".");
  if (dot < 0) return { ok: false, reason: "Malformed nonce" };
  const payload = nonce.slice(0, dot);
  const providedSig = nonce.slice(dot + 1);
  const expectedSig = sign(payload);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Bad signature" };
  }
  let parsed: { random: string; expiresAt: number; message: string };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "Malformed payload" };
  }
  if (typeof parsed.expiresAt !== "number" || now > parsed.expiresAt) {
    return { ok: false, reason: "Expired nonce" };
  }
  if (typeof parsed.message !== "string") {
    return { ok: false, reason: "Malformed payload" };
  }
  return { ok: true, message: parsed.message };
}

/**
 * Stateless HMAC-signed challenge tokens for World ID wallet binding.
 *
 * Same rationale as upload-nonce.ts: encode {random, wallet, expiry,
 * message} into a self-contained token authenticated with HMAC-SHA256, so
 * the verifier needs no shared state with the issuer. This is the form that
 * survives Vercel / Cloudflare serverless deployments where successive
 * requests can land on different instances.
 *
 * The wallet pubkey is part of the signed message AND the HMAC payload, so
 * a stolen token can't be used to bind a different wallet — the server
 * reconstructs the exact message it issued and the verify route then checks
 * the user's signature over that same string.
 */
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const TTL_MS = 15 * 60 * 1000;

function getSecret(): Buffer {
  const explicit = process.env.NONCE_HMAC_SECRET;
  if (explicit && explicit.length >= 32) return Buffer.from(explicit, "utf8");
  const seed =
    process.env.REGISTRY_ADMIN_KEYPAIR_JSON ||
    process.env.REGISTRY_ADMIN_KEYPAIR_BASE58 ||
    "chaintrust-dev-fallback-please-set-NONCE_HMAC_SECRET";
  return createHash("sha256").update(seed).update("ct-worldid-nonce-v1").digest();
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export type IssuedWorldIdChallenge = {
  nonce: string;
  message: string;
  expiresAt: number;
};

export function issueWorldIdNonce(
  wallet: string,
  now: number = Date.now(),
): IssuedWorldIdChallenge {
  const expiresAt = now + TTL_MS;
  const random = randomBytes(32).toString("hex");
  const message = [
    "ChainTrust World ID binding",
    `wallet: ${wallet}`,
    `nonce: ${random}`,
    `expires: ${new Date(expiresAt).toISOString()}`,
  ].join("\n");
  const payload = Buffer.from(
    JSON.stringify({ random, wallet, expiresAt, message }),
    "utf8",
  ).toString("base64url");
  const sig = sign(payload);
  return { nonce: `${payload}.${sig}`, message, expiresAt };
}

export type ConsumeWorldIdResult =
  | { ok: true; message: string }
  | { ok: false; reason: string };

export function consumeWorldIdNonce(
  nonce: string,
  now: number = Date.now(),
): ConsumeWorldIdResult {
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
  let parsed: {
    random: string;
    wallet: string;
    expiresAt: number;
    message: string;
  };
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

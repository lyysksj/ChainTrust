/**
 * Single-use challenge store for World ID wallet binding.
 *
 * The /api/worldid/verify endpoint used to trust the `wallet` field in the
 * request body. That let anyone bind a real WorldID nullifier to someone
 * else's wallet. The fix: issue a server-signed nonce, have the wallet sign
 * it client-side, and verify the signature before recording anything.
 *
 * Same in-process limitations as upload-nonce.ts: single instance only;
 * production should swap for Redis.
 */
import { randomBytes } from "node:crypto";

const TTL_MS = 5 * 60 * 1000;

type NonceEntry = {
  message: string;
  expiresAt: number;
  consumed: boolean;
};

// Pin to globalThis so every API route that imports this module shares the
// same Map across (a) Next dev's per-route module graphs and (b) HMR
// reloads. Without this, /api/worldid/challenge and /api/worldid/verify can
// resolve to different module instances on first hit, so consume() never
// sees the nonce that issue() just wrote → "Unknown or expired nonce" on the
// first attempt of every fresh session.
const g = globalThis as unknown as {
  __ctWorldIdNonces?: Map<string, NonceEntry>;
};
const nonces = g.__ctWorldIdNonces ?? (g.__ctWorldIdNonces = new Map());

function sweep(now: number) {
  for (const [k, v] of nonces) {
    if (v.expiresAt < now) nonces.delete(k);
  }
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
  sweep(now);
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = now + TTL_MS;
  const iso = new Date(expiresAt).toISOString();
  // The wallet pubkey is part of the signed message so a stolen nonce can't
  // be re-used to bind a different wallet.
  const message = [
    "ChainTrust World ID binding",
    `wallet: ${wallet}`,
    `nonce: ${nonce}`,
    `expires: ${iso}`,
  ].join("\n");
  nonces.set(nonce, { message, expiresAt, consumed: false });
  return { nonce, message, expiresAt };
}

export type ConsumeWorldIdResult =
  | { ok: true; message: string }
  | { ok: false; reason: string };

export function consumeWorldIdNonce(
  nonce: string,
  now: number = Date.now(),
): ConsumeWorldIdResult {
  sweep(now);
  const entry = nonces.get(nonce);
  if (!entry) return { ok: false, reason: "Unknown or expired nonce" };
  if (entry.consumed) return { ok: false, reason: "Nonce already used" };
  entry.consumed = true;
  return { ok: true, message: entry.message };
}

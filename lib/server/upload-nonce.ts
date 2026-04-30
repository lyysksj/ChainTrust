/**
 * Single-use nonce store for upload challenges.
 *
 * Lives in-process (same caveat as `rate-limit.ts`). Each nonce expires after
 * 5 minutes and can only be consumed once. The full challenge message is
 * stored alongside the nonce so the verifier reconstructs exactly what the
 * wallet signed — clients never need to send the message back.
 */
import { randomBytes } from "node:crypto";

const TTL_MS = 5 * 60 * 1000;

type NonceEntry = {
  message: string;
  expiresAt: number;
  consumed: boolean;
};

const nonces = new Map<string, NonceEntry>();

function sweep(now: number) {
  for (const [k, v] of nonces) {
    if (v.expiresAt < now) nonces.delete(k);
  }
}

export type IssuedChallenge = {
  nonce: string;
  message: string;
  expiresAt: number;
};

export function issueNonce(now: number = Date.now()): IssuedChallenge {
  sweep(now);
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = now + TTL_MS;
  const iso = new Date(expiresAt).toISOString();
  const message = [
    "ChainTrust upload challenge",
    `nonce: ${nonce}`,
    `expires: ${iso}`,
  ].join("\n");
  nonces.set(nonce, { message, expiresAt, consumed: false });
  return { nonce, message, expiresAt };
}

export type ConsumeResult =
  | { ok: true; message: string }
  | { ok: false; reason: string };

export function consumeNonce(
  nonce: string,
  now: number = Date.now(),
): ConsumeResult {
  sweep(now);
  const entry = nonces.get(nonce);
  if (!entry) return { ok: false, reason: "Unknown or expired nonce" };
  if (entry.consumed) return { ok: false, reason: "Nonce already used" };
  entry.consumed = true;
  return { ok: true, message: entry.message };
}

/**
 * Verify a Solana ed25519 signature without pulling in tweetnacl.
 *
 * Node 18+ ships ed25519 in `crypto`, but only via `KeyObject`. Raw 32-byte
 * pubkeys aren't accepted directly — we wrap them in the fixed SPKI DER
 * prefix that identifies an Ed25519 key.
 */
import { createPublicKey, verify } from "node:crypto";
import bs58 from "bs58";

const ED25519_SPKI_PREFIX = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);

export function verifySolanaSignature(
  message: string,
  signatureBase58: string,
  pubkeyBase58: string,
): boolean {
  let pubkeyRaw: Buffer;
  let signature: Buffer;
  try {
    pubkeyRaw = Buffer.from(bs58.decode(pubkeyBase58));
    signature = Buffer.from(bs58.decode(signatureBase58));
  } catch {
    return false;
  }
  if (pubkeyRaw.length !== 32) return false;
  if (signature.length !== 64) return false;

  try {
    const keyObj = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, pubkeyRaw]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(message, "utf8"), keyObj, signature);
  } catch {
    return false;
  }
}

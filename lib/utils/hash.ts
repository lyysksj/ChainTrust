import { createHash, randomBytes } from "crypto";

/** SHA-256 hex digest. */
export function sha256Hex(input: string | Uint8Array): string {
  const h = createHash("sha256");
  h.update(input);
  return h.digest("hex");
}

/** Returns a 32-byte array (number[]) of the SHA-256 digest; zeros if empty. */
export function sha256Bytes(input: string | undefined | null): number[] {
  if (!input) return new Array<number>(32).fill(0);
  const buf = createHash("sha256").update(input).digest();
  return Array.from(buf);
}

/** Random 8-byte id used as PDA seed for Entity / Project. */
export function randomId8(): number[] {
  return Array.from(randomBytes(8));
}

export const randomEntityId = randomId8;
export const randomProjectId = randomId8;

export function bytesToHex(bytes: number[] | Uint8Array): string {
  return Array.from(bytes as number[])
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Inverse of bytesToHex. Accepts an optional `0x` prefix. Throws on
 *  malformed input — a 64-char hex string is the only valid sha256 form on
 *  the on-chain `evidence_hash` field. */
export function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(clean)) {
    throw new Error("Invalid hex string");
  }
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

/** Short content-addressable id for mock storage paths. */
export function contentId(body: string): string {
  return sha256Hex(body).slice(0, 24);
}

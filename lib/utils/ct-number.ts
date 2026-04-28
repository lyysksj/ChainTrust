/**
 * CT-Number — the public, citable short code for an Entity.
 *
 * Derived deterministically from the 8-byte entity_id by Crockford-base32
 * encoding the bytes and grouping as `CT-XXXX-XXXX`. 8 bytes = 64 bits → 13
 * base32 chars; we keep the first 8 (40 bits) of entropy for compactness,
 * which leaves > 1 trillion possible values — plenty for the MVP.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (no I L O U)

export function entityIdToCtNumber(entityId: number[] | Uint8Array): string {
  const bytes = Array.from(entityId as number[]);
  if (bytes.length !== 8) throw new Error("entity_id must be 8 bytes");

  // Take first 5 bytes (40 bits) → exactly 8 base32 chars.
  let bits = 0n;
  for (let i = 0; i < 5; i++) {
    bits = (bits << 8n) | BigInt(bytes[i] & 0xff);
  }

  let out = "";
  for (let i = 0; i < 8; i++) {
    const idx = Number((bits >> BigInt((7 - i) * 5)) & 0x1fn);
    out += ALPHABET[idx];
  }
  return `CT-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Inverse: CT-XXXX-XXXX → first 5 bytes of entity_id. */
export function ctNumberToPrefixBytes(ct: string): number[] {
  const cleaned = ct.replace(/^CT-/i, "").replace(/-/g, "").toUpperCase();
  if (cleaned.length !== 8) throw new Error("Invalid CT-Number format");
  let bits = 0n;
  for (let i = 0; i < 8; i++) {
    const idx = ALPHABET.indexOf(cleaned[i]);
    if (idx < 0) throw new Error(`Invalid char in CT-Number: ${cleaned[i]}`);
    bits = (bits << 5n) | BigInt(idx);
  }
  const out: number[] = [];
  for (let i = 4; i >= 0; i--) {
    out.unshift(Number((bits >> BigInt((4 - i) * 8)) & 0xffn));
  }
  return out;
}

/** Cheap display helper. */
export function shortCt(ct: string): string {
  return ct.replace(/^CT-/, "");
}

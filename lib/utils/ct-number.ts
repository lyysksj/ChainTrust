/**
 * CT-Number — the public, citable short code for an Entity.
 *
 * Derivation chain:
 *   primary_id = (country, id_type, id_value)
 *   id_value   = normalizeIdValue(raw)            // ASCII upper-alnum
 *   hash       = SHA-256(`${country}|${id_type}|${id_value}`)
 *   entity_id  = hash[0..5]                       // 5 bytes / 40 bits
 *   payload    = base32Crockford(entity_id)       // 8 chars
 *   check      = mod37CheckChar(entity_id)        // 1 char
 *   ct         = `CT-V<3 payload>-<5 payload><check>`
 *               └ V = version, currently '1'
 *
 * Why this shape:
 *   - **Deterministic.** The same primary identifier always produces the
 *     same CT, so a real-world entity has at most one canonical address on
 *     ChainTrust regardless of who files first or how legal name strings
 *     drift over time.
 *   - **Anchor `init` enforces uniqueness.** The Entity PDA derives from
 *     entity_id, so the network rejects duplicate filings at the program
 *     level — there is nothing to grind, no client-side randomness to
 *     manipulate.
 *   - **Self-checking.** Mod-37 check char catches ~95% of single-character
 *     typos and adjacent transpositions when the CT is dictated, photographed,
 *     or manually re-typed.
 *   - **Versioned.** The leading 'V1' lets us widen the encoding later
 *     (longer payload, different alphabet) without breaking historical CTs.
 *     Older 'CT-XXXX-XXXX' strings (no version, no check) from the prior
 *     random-id design are NOT valid here and will fail to parse.
 */

import { sha256Bytes } from "./hash";

// Crockford base32: alphabet excludes I, L, O, U for visual disambiguation.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// Check-character alphabet: standard Crockford extension for the mod-37
// check symbol. Five extra glyphs map to indices 32–36; we accept upper-case
// 'U' as a check char (37→`U` is technically out-of-range, never produced —
// only the index 32–36 outputs `*`, `~`, `$`, `=`, `U` when the byte stream
// happens to land there).
const CHECK_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U";

// Bumped to "1" with the deterministic-derivation redesign. Older strings
// without a version letter cannot be re-derived from primary identifiers,
// so they're treated as invalid input rather than legacy.
export const CT_VERSION = "1" as const;

/**
 * Normalize an identifier value the way the on-chain validator expects:
 * ASCII uppercase + digits, separators stripped. Whitespace, dashes, dots,
 * and slashes are common in human-typed registry IDs (12-3456789, CHE-123.456,
 * USCC ABC123XYZ) so we strip them; everything else passes through and will
 * be rejected by `validateIdentifierValue` if it's not [A-Z0-9].
 */
export function normalizeIdValue(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-./]/g, "");
}

/** SHA-256 of `${country}|${id_type}|${normalizeIdValue(value)}` as bytes. */
export function idHashBytes(
  country: string,
  idType: string,
  rawIdValue: string,
): Uint8Array {
  const normalized = normalizeIdValue(rawIdValue);
  const bytes = sha256Bytes(`${country}|${idType}|${normalized}`);
  return new Uint8Array(bytes);
}

/** First 5 bytes of the id-hash — the on-chain entity_id seed. */
export function deriveEntityId(
  country: string,
  idType: string,
  rawIdValue: string,
): number[] {
  const h = idHashBytes(country, idType, rawIdValue);
  return [h[0], h[1], h[2], h[3], h[4]];
}

/** Crockford-base32 encode 5 bytes (40 bits) as 8 chars. */
function encodeBase32(entityId: number[]): string {
  if (entityId.length !== 5) throw new Error("entity_id must be 5 bytes");
  let bits = 0n;
  for (let i = 0; i < 5; i++) {
    bits = (bits << 8n) | BigInt(entityId[i] & 0xff);
  }
  let out = "";
  for (let i = 0; i < 8; i++) {
    const idx = Number((bits >> BigInt((7 - i) * 5)) & 0x1fn);
    out += ALPHABET[idx];
  }
  return out;
}

/** Decode 8 base32 chars → 5 bytes. Throws on invalid characters. */
function decodeBase32(payload: string): number[] {
  if (payload.length !== 8) throw new Error("payload must be 8 chars");
  let bits = 0n;
  for (let i = 0; i < 8; i++) {
    const idx = ALPHABET.indexOf(payload[i]);
    if (idx < 0) throw new Error(`Invalid char in CT-Number: ${payload[i]}`);
    bits = (bits << 5n) | BigInt(idx);
  }
  const out: number[] = [];
  for (let i = 4; i >= 0; i--) {
    out.unshift(Number((bits >> BigInt((4 - i) * 8)) & 0xffn));
  }
  return out;
}

/** Mod-37 check character over the 5-byte entity_id (Crockford Check Symbol). */
function checkCharFor(entityId: number[]): string {
  let n = 0n;
  for (const b of entityId) n = (n << 8n) | BigInt(b & 0xff);
  const idx = Number(n % 37n);
  return CHECK_ALPHABET[idx];
}

/**
 * Format a 5-byte entity_id as `CT-<V><3 payload>-<5 payload><check>`:
 *
 *   C T - V x x x - x x x x x C
 *         │ └─┬─┘   └────┬────┘ └ check char (mod-37)
 *         │   └ first 3 base32 chars of payload
 *         └ version char ('1' today)
 *         The remaining 5 base32 chars sit in the right half before check.
 *
 * Total visible length: 13 chars (10 alnum + 2 dashes + 1 'CT' prefix split).
 */
export function entityIdToCtNumber(entityId: number[] | Uint8Array): string {
  const bytes = Array.from(entityId as number[]);
  if (bytes.length !== 5) {
    throw new Error("entity_id must be 5 bytes");
  }
  const payload = encodeBase32(bytes);
  const check = checkCharFor(bytes);
  const left = `${CT_VERSION}${payload.slice(0, 3)}`; // 4 chars: V + 3 payload
  const right = `${payload.slice(3, 8)}${check}`; // 6 chars: 5 payload + check
  return `CT-${left}-${right}`;
}

/**
 * Parse a CT-Number back to its 5-byte entity_id. Throws on malformed
 * input, unknown version, or check-character mismatch — callers should
 * surface the error message to the user rather than fall through silently.
 */
export function ctNumberToEntityId(ct: string): number[] {
  const cleaned = ct.trim().toUpperCase();
  const m = /^CT-([0-9A-Z]{4})-([0-9A-Z*~$=]{6})$/.exec(cleaned);
  if (!m) throw new Error("CT-Number must look like CT-1XXX-XXXXXC");
  const left = m[1];
  const right = m[2];
  const version = left[0];
  if (version !== CT_VERSION) {
    throw new Error(`Unsupported CT-Number version: ${version}`);
  }
  const payload = `${left.slice(1, 4)}${right.slice(0, 5)}`; // 3 + 5 = 8 chars
  const check = right[5];
  const entityId = decodeBase32(payload);
  if (checkCharFor(entityId) !== check) {
    throw new Error("CT-Number check character does not match — likely a typo");
  }
  return entityId;
}

/** Returns true iff the CT-Number is well-formed and check-valid. */
export function isValidCtNumber(ct: string): boolean {
  try {
    ctNumberToEntityId(ct);
    return true;
  } catch {
    return false;
  }
}

/** Loose regex test for "looks like a CT-Number" — used for input UIs that
 *  want to gate the submit button without running the check digit. The
 *  full validity check goes through `isValidCtNumber`. */
export const CT_NUMBER_PATTERN = /^CT-[0-9A-Z]{4}-[0-9A-Z*~$=]{6}$/i;

/** Convenience: derive the CT-Number directly from the primary identifier. */
export function ctNumberFromPrimaryId(
  country: string,
  idType: string,
  rawIdValue: string,
): string {
  return entityIdToCtNumber(deriveEntityId(country, idType, rawIdValue));
}

/** Cheap display helper. */
export function shortCt(ct: string): string {
  return ct.replace(/^CT-/, "");
}

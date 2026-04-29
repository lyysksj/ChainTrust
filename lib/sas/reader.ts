/**
 * Path D — SAS consumer for ChainTrust.
 *
 * Reads attestations stored under the platform Credential and decodes their
 * payloads back into ChainTrust-shaped records. Used by the Resolve page to
 * surface "the same fact, but written via SAS standard schema" alongside the
 * native Relationship rows.
 *
 * SAS Attestation account layout (after 1-byte discriminator = 0):
 *   nonce (32) | credential (32) | schema (32) | data (Vec<u8>) |
 *   signer (32) | expiry (i64) | token_account (32)
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { SAS_PROGRAM_ID, SAS_SCHEMA_NAMES } from "./config";
import { decodeChainTrustAttestationData } from "./instructions";

const ACCOUNT_DISCRIMINATOR_ATTESTATION = 0;
const OFFSET_CREDENTIAL = 1 + 32; // discriminator (1) + nonce (32)

export type SasAttestationRecord = {
  pda: PublicKey;
  nonce: PublicKey;
  credential: PublicKey;
  schema: PublicKey;
  signer: PublicKey;
  expiry: number;
  decoded: ReturnType<typeof decodeChainTrustAttestationData>;
};

/**
 * Fetch all SAS attestations under the given Credential PDA.
 *
 * Uses getProgramAccounts with memcmp at offset 33 (= start of credential
 * field within Attestation account body, after the 1-byte discriminator
 * and 32-byte nonce). The discriminator filter ensures we only pick up
 * Attestation accounts (=0), not Credential (=1) or Schema (=2).
 */
export async function fetchSasAttestationsByCredential(
  conn: Connection,
  credential: PublicKey,
): Promise<SasAttestationRecord[]> {
  const resp = await conn.getProgramAccounts(SAS_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: encodeU8AsBase58(ACCOUNT_DISCRIMINATOR_ATTESTATION) } },
      { memcmp: { offset: OFFSET_CREDENTIAL, bytes: credential.toBase58() } },
    ],
  });

  const out: SasAttestationRecord[] = [];
  for (const { pubkey, account } of resp) {
    const buf = Buffer.from(account.data);
    if (buf.length < 1 + 32 + 32 + 32 + 4) continue;
    let off = 1; // skip discriminator
    const nonce = new PublicKey(buf.subarray(off, off + 32));
    off += 32;
    const credentialKey = new PublicKey(buf.subarray(off, off + 32));
    off += 32;
    const schemaKey = new PublicKey(buf.subarray(off, off + 32));
    off += 32;
    const dataLen = buf.readUInt32LE(off);
    off += 4;
    const dataField = buf.subarray(off, off + dataLen);
    off += dataLen;
    const signer = new PublicKey(buf.subarray(off, off + 32));
    off += 32;
    const expiry = Number(buf.readBigInt64LE(off));
    off += 8;
    // (token_account follows, ignored for read view)

    const decoded = decodeChainTrustAttestationData(Buffer.from(dataField));
    out.push({
      pda: pubkey,
      nonce,
      credential: credentialKey,
      schema: schemaKey,
      signer,
      expiry,
      decoded,
    });
  }
  return out;
}

/**
 * Filter SAS attestations whose decoded payload entity == target. Used on
 * Resolve to find SAS records that mirror our native Relationships.
 */
export function filterSasByEntity(
  records: SasAttestationRecord[],
  entity: PublicKey,
): SasAttestationRecord[] {
  const target = entity.toBase58();
  return records.filter((r) => r.decoded?.entity.toBase58() === target);
}

/**
 * Filter SAS attestations whose decoded payload target_ref matches a wallet
 * pubkey. Used on Resolve when a user pastes a wallet — we want to know if
 * any SAS attestation targets that wallet.
 */
export function filterSasByTarget(
  records: SasAttestationRecord[],
  target: PublicKey,
): SasAttestationRecord[] {
  const t = target.toBase58();
  return records.filter((r) => {
    if (!r.decoded) return false;
    try {
      return new PublicKey(Buffer.from(r.decoded.targetRef)).toBase58() === t;
    } catch {
      return false;
    }
  });
}

export function sasSchemaKindLabel(kind: number): string {
  return SAS_SCHEMA_NAMES[kind] ?? `KIND_${kind}`;
}

// memcmp 'bytes' must be base58 — for a single u8 value we encode via Buffer.
function encodeU8AsBase58(n: number): string {
  // bs58 needs the dependency, but we can use built-in: a single byte's base58
  // is just a 1-2 char string. Cheaper: re-use PublicKey static helper isn't
  // safe. Build minimal bs58 here.
  return base58Encode(new Uint8Array([n]));
}

const BS58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  // Count leading zeros.
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // Convert to big-endian base58.
  const buf = Array.from(bytes);
  const out: number[] = [];
  let start = zeros;
  while (start < buf.length) {
    let carry = 0;
    for (let i = start; i < buf.length; i++) {
      const x = (buf[i] & 0xff) + carry * 256;
      buf[i] = Math.floor(x / 58);
      carry = x % 58;
    }
    out.push(carry);
    while (start < buf.length && buf[start] === 0) start++;
  }
  let s = "";
  for (let i = 0; i < zeros; i++) s += "1";
  for (let i = out.length - 1; i >= 0; i--) s += BS58_ALPHABET[out[i]];
  return s;
}

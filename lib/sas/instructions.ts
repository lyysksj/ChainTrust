/**
 * SAS instruction builders in pure @solana/web3.js, using the byte-level
 * data layouts cross-checked against sas-lib generated encoders. We avoid
 * pulling kit at runtime so we don't have to bridge two SDKs in the wallet
 * adapter / Anchor transaction flow.
 *
 * Layouts (from sas-lib createAttestation.js / closeAttestation.js):
 *   create_attestation: u8(6) | nonce[32] | u32(len) | data[len] | i64(expiry)
 *   close_attestation:  u8(7)
 *
 * Account orders match sas-lib generated builders.
 */
import {
  AccountMeta,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { SAS_PROGRAM_ID } from "./config";
import { sasEventAuthorityPda } from "./pdas";

const DISCRIMINATOR_CREATE_ATTESTATION = 6;
const DISCRIMINATOR_CLOSE_ATTESTATION = 7;

function meta(
  pubkey: PublicKey,
  isSigner = false,
  isWritable = false,
): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

/**
 * Encode the data field for create_attestation.
 *
 * The SAS Schema we provision uses a single field of type VecU8 named "payload",
 * so the on-chain data layout is:
 *   u32(payload_len=121, LE) | payload[121]
 *
 * Inside the payload we use a fixed flat record:
 *   entity (32) | kind (u8) | target_ref (32) | evidence_hash (32) |
 *   valid_from (i64 LE) | valid_until (i64 LE) | revoked_at (i64 LE)
 *
 * Total: 4 (vec len) + 32 + 1 + 32 + 32 + 8 + 8 + 8 = 125 bytes.
 */
const CHAINTRUST_PAYLOAD_LEN = 121;

export function encodeChainTrustAttestationData(args: {
  entity: PublicKey;
  kind: number;
  targetRef: number[]; // 32 bytes
  evidenceHash: number[]; // 32 bytes
  validFrom: number; // unix seconds
  validUntil: number; // unix seconds, 0 = no expiry
  revokedAt: number; // unix seconds, 0 = active
}): Buffer {
  const payload = Buffer.alloc(CHAINTRUST_PAYLOAD_LEN);
  let off = 0;
  args.entity.toBuffer().copy(payload, off);
  off += 32;
  payload.writeUInt8(args.kind, off);
  off += 1;
  Buffer.from(args.targetRef).copy(payload, off, 0, 32);
  off += 32;
  Buffer.from(args.evidenceHash).copy(payload, off, 0, 32);
  off += 32;
  payload.writeBigInt64LE(BigInt(args.validFrom), off);
  off += 8;
  payload.writeBigInt64LE(BigInt(args.validUntil), off);
  off += 8;
  payload.writeBigInt64LE(BigInt(args.revokedAt), off);
  off += 8;

  // Wrap in VecU8: u32 LE length prefix.
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(CHAINTRUST_PAYLOAD_LEN, 0);
  return Buffer.concat([lenBuf, payload]);
}

/**
 * Decode a ChainTrust attestation payload back to its fields. Used by the
 * Path D consumer in lib/sas/reader.ts.
 */
export function decodeChainTrustAttestationData(data: Buffer): {
  entity: PublicKey;
  kind: number;
  targetRef: number[];
  evidenceHash: number[];
  validFrom: number;
  validUntil: number;
  revokedAt: number;
} | null {
  if (data.length < 4) return null;
  const payloadLen = data.readUInt32LE(0);
  if (payloadLen !== CHAINTRUST_PAYLOAD_LEN) return null;
  const payload = data.subarray(4, 4 + CHAINTRUST_PAYLOAD_LEN);
  if (payload.length < CHAINTRUST_PAYLOAD_LEN) return null;
  let off = 0;
  const entity = new PublicKey(payload.subarray(off, off + 32));
  off += 32;
  const kind = payload.readUInt8(off);
  off += 1;
  const targetRef = Array.from(payload.subarray(off, off + 32));
  off += 32;
  const evidenceHash = Array.from(payload.subarray(off, off + 32));
  off += 32;
  const validFrom = Number(payload.readBigInt64LE(off));
  off += 8;
  const validUntil = Number(payload.readBigInt64LE(off));
  off += 8;
  const revokedAt = Number(payload.readBigInt64LE(off));
  return {
    entity,
    kind,
    targetRef,
    evidenceHash,
    validFrom,
    validUntil,
    revokedAt,
  };
}

/** Schema layout bytes — single VecU8 (= 13). Matches encodeChainTrustAttestationData. */
export const CHAINTRUST_SCHEMA_LAYOUT = Buffer.from([13]);
export const CHAINTRUST_SCHEMA_FIELD_NAMES = ["payload"];

// ===========================================================================
// Admin / bootstrap instructions (used by scripts/sas-bootstrap.ts only)
// ===========================================================================

const DISCRIMINATOR_CREATE_CREDENTIAL = 0;
const DISCRIMINATOR_CREATE_SCHEMA = 1;
const DISCRIMINATOR_CHANGE_AUTHORIZED_SIGNERS = 3;

function encodeUtf8WithLen(s: string): Buffer {
  const utf = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(utf.length, 0);
  return Buffer.concat([len, utf]);
}

function encodeAddressArray(keys: PublicKey[]): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(keys.length, 0);
  return Buffer.concat([len, ...keys.map((k) => k.toBuffer())]);
}

function encodeStringArray(items: string[]): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(items.length, 0);
  return Buffer.concat([len, ...items.map(encodeUtf8WithLen)]);
}

/**
 * create_credential — provisions a SAS Credential PDA.
 * Account order: payer, credential, authority, system_program.
 */
export function buildCreateCredentialIx(args: {
  payer: PublicKey;
  credential: PublicKey;
  authority: PublicKey;
  name: string;
  signers: PublicKey[];
}): TransactionInstruction {
  const data = Buffer.concat([
    Buffer.from([DISCRIMINATOR_CREATE_CREDENTIAL]),
    encodeUtf8WithLen(args.name),
    encodeAddressArray(args.signers),
  ]);
  return new TransactionInstruction({
    programId: SAS_PROGRAM_ID,
    keys: [
      meta(args.payer, true, true),
      meta(args.credential, false, true),
      meta(args.authority, true, false),
      meta(SystemProgram.programId, false, false),
    ],
    data,
  });
}

/**
 * create_schema — provisions a SAS Schema PDA under a Credential.
 * Account order: payer, authority, credential, schema, system_program.
 */
export function buildCreateSchemaIx(args: {
  payer: PublicKey;
  authority: PublicKey;
  credential: PublicKey;
  schema: PublicKey;
  name: string;
  description: string;
  layout: Buffer;
  fieldNames: string[];
}): TransactionInstruction {
  const layoutLen = Buffer.alloc(4);
  layoutLen.writeUInt32LE(args.layout.length, 0);
  const data = Buffer.concat([
    Buffer.from([DISCRIMINATOR_CREATE_SCHEMA]),
    encodeUtf8WithLen(args.name),
    encodeUtf8WithLen(args.description),
    layoutLen,
    args.layout,
    encodeStringArray(args.fieldNames),
  ]);
  return new TransactionInstruction({
    programId: SAS_PROGRAM_ID,
    keys: [
      meta(args.payer, true, true),
      meta(args.authority, true, false),
      meta(args.credential, false, false),
      meta(args.schema, false, true),
      meta(SystemProgram.programId, false, false),
    ],
    data,
  });
}

/**
 * change_authorized_signers — update the Vec<Pubkey> of who can sign
 * attestations under this Credential. Replaces the entire list.
 * Account order: payer, authority, credential, system_program.
 */
export function buildChangeAuthorizedSignersIx(args: {
  payer: PublicKey;
  authority: PublicKey;
  credential: PublicKey;
  signers: PublicKey[];
}): TransactionInstruction {
  const data = Buffer.concat([
    Buffer.from([DISCRIMINATOR_CHANGE_AUTHORIZED_SIGNERS]),
    encodeAddressArray(args.signers),
  ]);
  return new TransactionInstruction({
    programId: SAS_PROGRAM_ID,
    keys: [
      meta(args.payer, true, true),
      meta(args.authority, true, false),
      meta(args.credential, false, true),
      meta(SystemProgram.programId, false, false),
    ],
    data,
  });
}

/**
 * Build SAS create_attestation instruction.
 * Account order (from sas-lib): payer, authority, credential, schema,
 * attestation, system_program.
 */
export function buildCreateAttestationIx(args: {
  payer: PublicKey;
  authority: PublicKey; // must be in credential.authorized_signers
  credential: PublicKey;
  schema: PublicKey;
  attestation: PublicKey; // PDA
  nonce: PublicKey; // we use the ChainTrust Relationship PDA
  data: Buffer;
  expiry: number; // 0 = never expires
}): TransactionInstruction {
  const ixData = Buffer.concat([
    Buffer.from([DISCRIMINATOR_CREATE_ATTESTATION]),
    args.nonce.toBuffer(), // 32 bytes
    (() => {
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32LE(args.data.length, 0);
      return lenBuf;
    })(),
    args.data,
    (() => {
      const expBuf = Buffer.alloc(8);
      expBuf.writeBigInt64LE(BigInt(args.expiry), 0);
      return expBuf;
    })(),
  ]);

  return new TransactionInstruction({
    programId: SAS_PROGRAM_ID,
    keys: [
      meta(args.payer, true, true),
      meta(args.authority, true, false),
      meta(args.credential, false, false),
      meta(args.schema, false, false),
      meta(args.attestation, false, true),
      meta(SystemProgram.programId, false, false),
    ],
    data: ixData,
  });
}

/**
 * Build SAS close_attestation instruction.
 * Account order (from sas-lib): payer, authority, credential, attestation,
 * event_authority, system_program, attestation_program (= SAS itself, for
 * the CPI'd emit_event call).
 */
export function buildCloseAttestationIx(args: {
  payer: PublicKey;
  authority: PublicKey;
  credential: PublicKey;
  attestation: PublicKey;
}): TransactionInstruction {
  const eventAuthority = sasEventAuthorityPda();
  return new TransactionInstruction({
    programId: SAS_PROGRAM_ID,
    keys: [
      meta(args.payer, true, true),
      meta(args.authority, true, false),
      meta(args.credential, false, false),
      meta(args.attestation, false, true),
      meta(eventAuthority, false, false),
      meta(SystemProgram.programId, false, false),
      meta(SAS_PROGRAM_ID, false, false),
    ],
    data: Buffer.from([DISCRIMINATOR_CLOSE_ATTESTATION]),
  });
}

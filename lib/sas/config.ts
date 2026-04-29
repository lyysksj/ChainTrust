/**
 * Solana Attestation Service (SAS) configuration for ChainTrust.
 *
 * SAS is the Solana Foundation's standardized on-chain attestation program.
 * ChainTrust dual-writes its Relationship records to SAS so that other Solana
 * apps can consume them via the canonical SAS schema, without needing to
 * understand the ChainTrust IDL.
 *
 * The dual-write is OPT-IN at runtime via `NEXT_PUBLIC_SAS_DUAL_WRITE`. The
 * platform's SAS Credential and per-RelKind Schema PDAs must be provisioned
 * once via `npm run sas:bootstrap` before turning the flag on.
 */
import { PublicKey } from "@solana/web3.js";

/** SAS program (same on devnet + mainnet). */
export const SAS_PROGRAM_ID = new PublicKey(
  "22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG",
);

/** Single platform-wide Credential. Issuers' wallets get added as
 *  authorized_signers so they can sign attestations under this Credential
 *  without each issuer needing its own SAS Credential PDA. */
export const SAS_CREDENTIAL_NAME = "ChainTrust";

/** SAS schema version is a u8 in the Schema PDA seeds. We start at 1. */
export const SAS_SCHEMA_VERSION = 1;

/** Schema name per ChainTrust relationship kind. Each kind is a separate
 *  SAS Schema PDA so consumers can filter by verb at the Schema level. */
export const SAS_SCHEMA_NAMES: Record<number, string> = {
  1: "OPERATES_PROJECT",
  2: "DEPLOYS_WALLET",
  3: "CONTROLS_WALLET",
  4: "HAS_DOMAIN",
  5: "SUBSIDIARY_OF",
  6: "PARENT_OF",
  7: "HAS_UBO",
  8: "HAS_OFFICER",
  9: "AUDITED_BY",
};

/** Whether to dual-write to SAS at runtime. Read at the call site so .env
 *  changes don't require a rebuild. */
export function sasDualWriteEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SAS_DUAL_WRITE === "true";
}

/** The platform Credential authority pubkey (also the only key allowed to
 *  rotate authorized_signers via change_authorized_signers). For hackathon
 *  this is the dev wallet that ran the bootstrap script. */
export function sasCredentialAuthority(): PublicKey | null {
  const v = process.env.NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY;
  if (!v) return null;
  try {
    return new PublicKey(v);
  } catch {
    return null;
  }
}

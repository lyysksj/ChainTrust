/**
 * SAS PDA derivation, mirrored from sas-lib but using @solana/web3.js so we
 * don't have to bridge @solana/kit Address ↔ PublicKey at every call site.
 *
 * Source seeds (from sas-lib/src/pdas.ts):
 *   credential   = ["credential", authority, name]
 *   schema       = ["schema", credential, name, [version]]
 *   attestation  = ["attestation", credential, schema, nonce]
 *   eventAuthority = ["__event_authority"]
 */
import { PublicKey } from "@solana/web3.js";
import {
  SAS_PROGRAM_ID,
  SAS_CREDENTIAL_NAME,
  SAS_SCHEMA_VERSION,
  SAS_SCHEMA_NAMES,
} from "./config";

const CREDENTIAL_SEED = Buffer.from("credential");
const SCHEMA_SEED = Buffer.from("schema");
const ATTESTATION_SEED = Buffer.from("attestation");
const EVENT_AUTHORITY_SEED = Buffer.from("__event_authority");

export function sasCredentialPda(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [CREDENTIAL_SEED, authority.toBuffer(), Buffer.from(SAS_CREDENTIAL_NAME)],
    SAS_PROGRAM_ID,
  );
  return pda;
}

export function sasSchemaPda(
  credential: PublicKey,
  kind: number,
  version: number = SAS_SCHEMA_VERSION,
): PublicKey {
  const name = SAS_SCHEMA_NAMES[kind];
  if (!name) throw new Error(`Unknown SAS schema for kind ${kind}`);
  const [pda] = PublicKey.findProgramAddressSync(
    [
      SCHEMA_SEED,
      credential.toBuffer(),
      Buffer.from(name),
      Buffer.from([version]),
    ],
    SAS_PROGRAM_ID,
  );
  return pda;
}

/**
 * Attestation PDA, derived from credential + schema + nonce. We use the
 * ChainTrust Relationship PDA as the SAS nonce so the two records are 1:1
 * and trivially cross-referenced.
 */
export function sasAttestationPda(
  credential: PublicKey,
  schema: PublicKey,
  nonce: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      ATTESTATION_SEED,
      credential.toBuffer(),
      schema.toBuffer(),
      nonce.toBuffer(),
    ],
    SAS_PROGRAM_ID,
  );
  return pda;
}

export function sasEventAuthorityPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [EVENT_AUTHORITY_SEED],
    SAS_PROGRAM_ID,
  );
  return pda;
}

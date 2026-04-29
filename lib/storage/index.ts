/**
 * Storage abstraction with public / sensitive sensitivity tiers.
 *
 * Routing:
 *   - If PINATA_JWT is configured at runtime, public uploads pin to Pinata
 *     IPFS and return `ipfs://<cid>` URIs.
 *   - If not, fall back to the in-process mock storage that writes to
 *     `data/mock-storage/` and returns `mock://<id>` URIs. This keeps local
 *     dev free of Pinata setup and keeps existing demo data readable.
 *
 * Reads of either URI scheme go through `app/api/mock/fetch/route.ts`,
 * which routes by URI prefix.
 *
 * Sensitivity tiers:
 *   "public"     — uploaded plaintext. Readable by anyone with the CID.
 *   "sensitive"  — uploaded plaintext for now (Phase 1). Phase 3 wraps the
 *                  body in a Lit Protocol envelope before pinning so only
 *                  wallets that satisfy the access conditions can decrypt.
 *
 * Migration plan:
 *   Phase 0  mock://     local disk, both tiers
 *   Phase 1  ipfs://     Pinata public, both tiers (CURRENT)
 *   Phase 3  ipfs://     Pinata public for "public", Lit-encrypted Pinata
 *                        for "sensitive"
 *
 * Anything that ever encodes sensitive data should call `putSensitive`. The
 * function signature does not change between phases — the encryption layer
 * is added inside this module.
 */
export type Sensitivity = "public" | "sensitive";

export type StorageResult = {
  uri: string;
  hashHex: string;
  /** Whether the upload bytes were encrypted before pinning. False until
   *  Lit Protocol integration ships in Phase 3. */
  isEncrypted: boolean;
  sensitivity: Sensitivity;
  /** Where the bytes ultimately live. Useful for the UI to surface
   *  e.g. "Pinned to IPFS" instead of "Stored locally". */
  backend: "mock" | "ipfs-pinata";
};

import { contentId, sha256Hex } from "@/lib/utils/hash";
import {
  putBinary as mockPutBinary,
  putText as mockPutText,
} from "@/lib/mock/storage";
import {
  isPinataConfigured,
  pinataPinBinary,
  pinataPinText,
} from "./pinata";

export async function putPublic(body: string): Promise<StorageResult> {
  if (isPinataConfigured()) {
    const { uri, hashHex } = await pinataPinText(body);
    return {
      uri,
      hashHex,
      isEncrypted: false,
      sensitivity: "public",
      backend: "ipfs-pinata",
    };
  }
  const { uri, hashHex } = await mockPutText(body);
  return {
    uri,
    hashHex,
    isEncrypted: false,
    sensitivity: "public",
    backend: "mock",
  };
}

export async function putSensitive(body: string): Promise<StorageResult> {
  // TODO(phase 3): Wrap `body` in a Lit Protocol envelope before upload.
  //   const { ciphertext, dataToEncryptHash } = await litClient.encrypt({
  //     accessControlConditions, dataToEncrypt: body,
  //   });
  //   body = JSON.stringify({ ciphertext, dataToEncryptHash, conditions });
  //   isEncrypted = true;
  if (isPinataConfigured()) {
    const { uri, hashHex } = await pinataPinText(body);
    return {
      uri,
      hashHex,
      isEncrypted: false,
      sensitivity: "sensitive",
      backend: "ipfs-pinata",
    };
  }
  const { uri, hashHex } = await mockPutText(body);
  return {
    uri,
    hashHex,
    isEncrypted: false,
    sensitivity: "sensitive",
    backend: "mock",
  };
}

export async function putContent(
  body: string,
  sensitivity: Sensitivity = "public",
): Promise<StorageResult> {
  return sensitivity === "sensitive" ? putSensitive(body) : putPublic(body);
}

export async function putImagePublic(
  data: Uint8Array,
  ext: string,
): Promise<StorageResult> {
  if (isPinataConfigured()) {
    const { uri, hashHex } = await pinataPinBinary(data, ext);
    return {
      uri,
      hashHex,
      isEncrypted: false,
      sensitivity: "public",
      backend: "ipfs-pinata",
    };
  }
  const { uri, hashHex } = await mockPutBinary(data, ext);
  return {
    uri,
    hashHex,
    isEncrypted: false,
    sensitivity: "public",
    backend: "mock",
  };
}

// Re-export helpers used at the storage layer boundary.
export { sha256Hex, contentId };
export { isPinataConfigured } from "./pinata";

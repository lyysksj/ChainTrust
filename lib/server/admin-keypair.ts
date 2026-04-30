/**
 * Server-side admin keypair loader.
 *
 * The registry admin key signs `attest_human_proof` so wallets that complete
 * the World ID + wallet-signature flow can be bound on chain. Loaded once
 * at module init and cached.
 *
 * Configure via .env.local:
 *   REGISTRY_ADMIN_KEYPAIR_JSON  — JSON array of 64 bytes (anchor/solana CLI
 *                                  format), e.g. `[12,34,...]`
 *   REGISTRY_ADMIN_KEYPAIR_BASE58 — alternative: base58-encoded 64-byte
 *                                   secret key.
 *
 * If neither is set, the API endpoints that require admin signing will fail
 * with a clear error rather than silently bypass the gate.
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

let cached: Keypair | null = null;
let cacheError: string | null = null;

export function loadAdminKeypair(): Keypair | null {
  if (cached) return cached;
  if (cacheError) return null;

  const jsonForm = process.env.REGISTRY_ADMIN_KEYPAIR_JSON;
  const base58Form = process.env.REGISTRY_ADMIN_KEYPAIR_BASE58;

  try {
    if (jsonForm) {
      const arr = JSON.parse(jsonForm) as number[];
      if (!Array.isArray(arr) || arr.length !== 64) {
        throw new Error(
          "REGISTRY_ADMIN_KEYPAIR_JSON must be a JSON array of 64 bytes",
        );
      }
      cached = Keypair.fromSecretKey(Uint8Array.from(arr));
      return cached;
    }
    if (base58Form) {
      const raw = bs58.decode(base58Form);
      if (raw.length !== 64) {
        throw new Error(
          "REGISTRY_ADMIN_KEYPAIR_BASE58 must decode to a 64-byte secret key",
        );
      }
      cached = Keypair.fromSecretKey(raw);
      return cached;
    }
    cacheError =
      "Admin keypair not configured. Set REGISTRY_ADMIN_KEYPAIR_JSON or REGISTRY_ADMIN_KEYPAIR_BASE58.";
    return null;
  } catch (e) {
    cacheError = (e as Error).message;
    return null;
  }
}

export function adminLoadError(): string | null {
  loadAdminKeypair();
  return cacheError;
}

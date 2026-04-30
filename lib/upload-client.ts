"use client";

/**
 * Client helpers that go through the authenticated `/api/upload/*` routes.
 * Every caller used to bypass auth via `/api/mock/upload`; that endpoint is
 * now only reachable in dev mode (and rejects requests in production).
 *
 * The flow is: GET /api/upload/challenge → wallet.signMessage → POST upload
 * with x-pubkey, x-signature, x-nonce. Client fails closed if the wallet
 * doesn't expose signMessage.
 */
import bs58 from "bs58";
import type { PublicKey } from "@solana/web3.js";

export type SignMessage = (msg: Uint8Array) => Promise<Uint8Array>;

type ChallengeResp = {
  nonce: string;
  message: string;
  expiresAt: number;
};

async function getChallenge(): Promise<ChallengeResp> {
  const r = await fetch("/api/upload/challenge");
  if (!r.ok) throw new Error("Could not fetch upload challenge");
  const j = (await r.json()) as ChallengeResp;
  if (!j?.nonce || !j?.message) throw new Error("Bad challenge payload");
  return j;
}

async function signedHeaders(
  publicKey: PublicKey,
  signMessage: SignMessage,
): Promise<{ headers: Record<string, string> }> {
  const ch = await getChallenge();
  const sig = await signMessage(new TextEncoder().encode(ch.message));
  return {
    headers: {
      "x-pubkey": publicKey.toBase58(),
      "x-signature": bs58.encode(sig),
      "x-nonce": ch.nonce,
    },
  };
}

export type MetadataUploadResult = {
  uri: string;
  hashHex: string;
  isEncrypted?: boolean;
  sensitivity?: "public" | "sensitive";
  backend?: string;
};

/**
 * Upload an arbitrary text/JSON metadata payload via the authenticated route.
 * Throws on network / auth / quota errors; the caller is responsible for
 * surfacing those to the user. The wallet must support signMessage.
 */
export async function uploadMetadata(
  publicKey: PublicKey,
  signMessage: SignMessage | null | undefined,
  payload: string,
  opts: { sensitivity?: "public" | "sensitive" } = {},
): Promise<MetadataUploadResult> {
  if (!signMessage) {
    throw new Error(
      "Connected wallet does not support message signing. Use a wallet that exposes signMessage (e.g. Phantom, Backpack).",
    );
  }
  const { headers } = await signedHeaders(publicKey, signMessage);
  const url =
    "/api/upload/metadata" +
    (opts.sensitivity ? `?sensitivity=${opts.sensitivity}` : "");
  const resp = await fetch(url, {
    method: "POST",
    headers: { ...headers, "content-type": "text/plain" },
    body: payload,
  });
  const json = (await resp.json().catch(() => ({}))) as MetadataUploadResult & {
    error?: string;
  };
  if (!resp.ok) {
    throw new Error(json?.error ?? `Metadata upload failed (${resp.status})`);
  }
  if (!json.uri) throw new Error("Upload response missing uri");
  return json;
}

export type ImageUploadResult = {
  uri: string;
  hashHex: string;
  contentType: string;
  backend?: string;
};

/**
 * Upload an image file (PNG/JPEG/WebP/GIF) via the authenticated image route.
 * Used by community-signal forms.
 */
export async function uploadImage(
  publicKey: PublicKey,
  signMessage: SignMessage | null | undefined,
  file: File,
): Promise<ImageUploadResult> {
  if (!signMessage) {
    throw new Error(
      "Connected wallet does not support message signing. Use a wallet that exposes signMessage (e.g. Phantom, Backpack).",
    );
  }
  const { headers } = await signedHeaders(publicKey, signMessage);
  const form = new FormData();
  form.set("file", file);
  const resp = await fetch("/api/upload/image", {
    method: "POST",
    headers, // do NOT set content-type; FormData picks the boundary
    body: form,
  });
  const json = (await resp.json().catch(() => ({}))) as ImageUploadResult & {
    error?: string;
  };
  if (!resp.ok) {
    throw new Error(json?.error ?? `Image upload failed (${resp.status})`);
  }
  if (!json.uri) throw new Error("Upload response missing uri");
  return json;
}

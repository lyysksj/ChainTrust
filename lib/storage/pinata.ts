/**
 * Pinata IPFS REST client.
 *
 * Why hand-rolled instead of using the `pinata` npm SDK:
 *  - We only need pinJSON + pinFile + gateway URL, not the full SDK surface.
 *  - The SDK pulls in heavy deps (axios, form-data) that double our route bundle.
 *  - REST + native fetch + global FormData (Node 18+) is ~80 lines and zero
 *    extra deps.
 *
 * Configuration: set PINATA_JWT in .env.local (server-side only — never
 * NEXT_PUBLIC_, the JWT lets anyone pin to your account). Optional:
 *   NEXT_PUBLIC_PINATA_GATEWAY = your dedicated gateway hostname (paid tier),
 *   defaults to gateway.pinata.cloud (free, rate-limited).
 *
 * URI scheme:
 *   ipfs://<cid>            — JSON / text payload
 *   ipfs://<cid>.<ext>      — binary payload (image), where <ext> is one of
 *                             png/jpg/webp/gif. The CID still resolves the
 *                             same content; the extension is a hint for the
 *                             fetch route to set Content-Type when streaming.
 */
import { createHash } from "node:crypto";

const PINATA_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export function isPinataConfigured(): boolean {
  return !!process.env.PINATA_JWT;
}

export function pinataGatewayHost(): string {
  return (
    process.env.NEXT_PUBLIC_PINATA_GATEWAY ||
    process.env.PINATA_GATEWAY ||
    "gateway.pinata.cloud"
  );
}

/** Public HTTPS URL to read this CID from a Pinata gateway. */
export function pinataGatewayUrl(cidOrPath: string): string {
  return `https://${pinataGatewayHost()}/ipfs/${cidOrPath}`;
}

type PinataResp = { IpfsHash: string; PinSize: number; Timestamp: string };

async function postPinata(
  url: string,
  init: RequestInit,
): Promise<PinataResp> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT is not configured");
  const headers = {
    Authorization: `Bearer ${jwt}`,
    ...(init.headers || {}),
  };
  const resp = await fetch(url, { ...init, headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Pinata ${resp.status}: ${text || resp.statusText}`);
  }
  return (await resp.json()) as PinataResp;
}

/** Pin arbitrary text/JSON. Body string is treated as the JSON payload (we
 *  parse and re-serialize so Pinata gets the canonical form). If parsing
 *  fails we wrap as `{ "raw": body }` so we still get a CID. */
export async function pinataPinText(body: string): Promise<{
  uri: string;
  cid: string;
  hashHex: string;
}> {
  let pinataContent: unknown;
  try {
    pinataContent = JSON.parse(body);
  } catch {
    pinataContent = { raw: body };
  }
  const reqBody = JSON.stringify({
    pinataContent,
    pinataOptions: { cidVersion: 1 },
  });
  const resp = await postPinata(PINATA_JSON_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: reqBody,
  });
  const hashHex = createHash("sha256").update(body).digest("hex");
  return {
    uri: `ipfs://${resp.IpfsHash}`,
    cid: resp.IpfsHash,
    hashHex,
  };
}

/** Pin raw bytes (image). The returned URI carries the file extension as a
 *  suffix so the fetch route can pick the right Content-Type without a
 *  separate metadata lookup. */
export async function pinataPinBinary(
  data: Uint8Array,
  ext: string,
): Promise<{ uri: string; cid: string; hashHex: string }> {
  const safeExt = ext.toLowerCase().replace(/^\./, "").replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
  const form = new FormData();
  // The Blob name carries an extension hint that ends up in the Pinata
  // dashboard as the filename.
  // Cast through ArrayBuffer to satisfy strict TS lib that distinguishes
  // ArrayBuffer from SharedArrayBuffer in BlobPart.
  const blob = new Blob([new Uint8Array(data).buffer as ArrayBuffer]);
  form.append("file", blob, `upload.${safeExt || "bin"}`);
  const resp = await postPinata(PINATA_FILE_URL, {
    method: "POST",
    body: form,
  });
  const hashHex = createHash("sha256").update(data).digest("hex");
  return {
    uri: `ipfs://${resp.IpfsHash}.${safeExt || "bin"}`,
    cid: resp.IpfsHash,
    hashHex,
  };
}

/** Read text payload back from IPFS via the configured gateway. Returns null
 *  on miss / non-200. Used by /api/mock/fetch to handle ipfs:// URIs. */
export async function pinataFetchText(uri: string): Promise<string | null> {
  const cid = parseIpfsCid(uri);
  if (!cid) return null;
  const resp = await fetch(pinataGatewayUrl(cid));
  if (!resp.ok) return null;
  return resp.text();
}

/** Read binary payload back from IPFS. Returns the raw bytes + the extension
 *  encoded in the URI. */
export async function pinataFetchBinary(
  uri: string,
): Promise<{ data: Buffer; ext: string } | null> {
  const cid = parseIpfsCidWithExt(uri);
  if (!cid) return null;
  const resp = await fetch(pinataGatewayUrl(cid.cid));
  if (!resp.ok) return null;
  const buf = Buffer.from(await resp.arrayBuffer());
  return { data: buf, ext: cid.ext };
}

function parseIpfsCid(uri: string): string | null {
  if (!uri.startsWith("ipfs://")) return null;
  const rest = uri.slice("ipfs://".length);
  // Strip any extension suffix; for plain JSON the URI has none.
  const dot = rest.lastIndexOf(".");
  return dot > 0 ? rest.slice(0, dot) : rest;
}

function parseIpfsCidWithExt(
  uri: string,
): { cid: string; ext: string } | null {
  if (!uri.startsWith("ipfs://")) return null;
  const rest = uri.slice("ipfs://".length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  return { cid: rest.slice(0, dot), ext: rest.slice(dot + 1) };
}

import fs from "node:fs/promises";
import path from "node:path";
import { contentId, sha256Hex } from "@/lib/utils/hash";

// Mock IPFS-like storage. Replace with a real pinning adapter later.
// Text content keyed by sha256 with `.json` extension.
// Binary content keyed by sha256 with its original extension (e.g. `.png`).

const ROOT = path.join(process.cwd(), "data", "mock-storage");
const SCHEME = "mock";

const TEXT_EXT = ".json";

async function ensureDir() {
  await fs.mkdir(ROOT, { recursive: true });
}

function safeExt(ext: string): string {
  // Allow only simple image extensions to avoid path traversal.
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!/^[a-z0-9]{1,5}$/.test(e)) return "bin";
  return e;
}

export async function putText(
  body: string,
): Promise<{ uri: string; hashHex: string }> {
  await ensureDir();
  const hashHex = sha256Hex(body);
  const id = contentId(body);
  await fs.writeFile(path.join(ROOT, `${id}${TEXT_EXT}`), body, "utf8");
  return { uri: `${SCHEME}://${id}`, hashHex };
}

export async function putJson<T>(
  value: T,
): Promise<{ uri: string; hashHex: string }> {
  return putText(JSON.stringify(value));
}

export async function putBinary(
  data: Uint8Array,
  ext: string,
): Promise<{ uri: string; hashHex: string }> {
  await ensureDir();
  const hashHex = sha256Hex(Buffer.from(data).toString("base64"));
  const id = hashHex.slice(0, 40);
  const e = safeExt(ext);
  await fs.writeFile(path.join(ROOT, `${id}.${e}`), data);
  return { uri: `${SCHEME}://${id}.${e}`, hashHex };
}

export async function getText(uri: string): Promise<string | null> {
  if (!uri.startsWith(`${SCHEME}://`)) return null;
  const rest = uri.slice(SCHEME.length + 3);
  // Text URIs have no extension; binary URIs have one.
  if (rest.includes(".")) return null;
  try {
    return await fs.readFile(path.join(ROOT, `${rest}${TEXT_EXT}`), "utf8");
  } catch {
    return null;
  }
}

export async function getJson<T>(uri: string): Promise<T | null> {
  const t = await getText(uri);
  if (!t) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

export async function getBinary(
  uri: string,
): Promise<{ data: Buffer; ext: string } | null> {
  if (!uri.startsWith(`${SCHEME}://`)) return null;
  const rest = uri.slice(SCHEME.length + 3);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = rest.slice(0, dot);
  const ext = safeExt(rest.slice(dot + 1));
  if (!/^[0-9a-f]+$/i.test(id)) return null;
  try {
    const data = await fs.readFile(path.join(ROOT, `${id}.${ext}`));
    return { data, ext };
  } catch {
    return null;
  }
}

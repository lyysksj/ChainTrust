import fs from "node:fs/promises";
import path from "node:path";
import { contentId, sha256Hex } from "@/lib/utils/hash";

// Mock IPFS-like storage. Replace with a real pinning adapter later.
// Content is keyed by sha256 and written as JSON under data/mock-storage/.

const ROOT = path.join(process.cwd(), "data", "mock-storage");
const SCHEME = "mock";

async function ensureDir() {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function putText(body: string): Promise<{ uri: string; hashHex: string }> {
  await ensureDir();
  const hashHex = sha256Hex(body);
  const id = contentId(body);
  await fs.writeFile(path.join(ROOT, `${id}.json`), body, "utf8");
  return { uri: `${SCHEME}://${id}`, hashHex };
}

export async function putJson<T>(value: T): Promise<{ uri: string; hashHex: string }> {
  return putText(JSON.stringify(value));
}

export async function getText(uri: string): Promise<string | null> {
  if (!uri.startsWith(`${SCHEME}://`)) return null;
  const id = uri.slice(SCHEME.length + 3);
  try {
    return await fs.readFile(path.join(ROOT, `${id}.json`), "utf8");
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

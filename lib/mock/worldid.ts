import fs from "node:fs/promises";
import path from "node:path";

// Local mock store for World ID verification state.
// Production replaces this with an on-chain NullifierRecord PDA whose seed is
// `["nullifier", nullifier_hash]`. For the hackathon we keep nullifier→wallet
// in a flat JSON file under data/mock-storage/worldid/.

const ROOT = path.join(process.cwd(), "data", "mock-storage", "worldid");

type Record = {
  wallet: string;
  nullifierHash: string;
  verifiedAt: number;
};

async function ensureDir() {
  await fs.mkdir(ROOT, { recursive: true });
}

function nullifierFile(nullifierHash: string): string {
  // sanitize: keep only hex chars
  const safe = nullifierHash.replace(/[^0-9a-fx]/gi, "");
  return path.join(ROOT, `n_${safe}.json`);
}

function walletFile(wallet: string): string {
  // sanitize: keep base58 chars only
  const safe = wallet.replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
  return path.join(ROOT, `w_${safe}.json`);
}

export async function getByNullifier(
  nullifierHash: string,
): Promise<Record | null> {
  try {
    const text = await fs.readFile(nullifierFile(nullifierHash), "utf8");
    return JSON.parse(text) as Record;
  } catch {
    return null;
  }
}

export async function getByWallet(wallet: string): Promise<Record | null> {
  try {
    const text = await fs.readFile(walletFile(wallet), "utf8");
    return JSON.parse(text) as Record;
  } catch {
    return null;
  }
}

export async function recordVerification(
  wallet: string,
  nullifierHash: string,
): Promise<void> {
  await ensureDir();
  const record: Record = {
    wallet,
    nullifierHash,
    verifiedAt: Date.now(),
  };
  // Write both indexes so we can look up by either side.
  await fs.writeFile(
    nullifierFile(nullifierHash),
    JSON.stringify(record),
    "utf8",
  );
  await fs.writeFile(walletFile(wallet), JSON.stringify(record), "utf8");
}

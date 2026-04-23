import type { PublicKey } from "@solana/web3.js";

export function shortKey(key: PublicKey | string, chars = 4): string {
  const s = typeof key === "string" ? key : key.toBase58();
  if (s.length <= chars * 2 + 1) return s;
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

export function formatTimestamp(unix: number | bigint | { toNumber: () => number }): string {
  let ts: number;
  if (typeof unix === "number") ts = unix;
  else if (typeof unix === "bigint") ts = Number(unix);
  else ts = unix.toNumber();
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export function bytesHex(bytes: number[] | undefined | null): string {
  if (!bytes || bytes.length === 0) return "";
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function shortHash(bytes: number[] | undefined | null, n = 12): string {
  const h = bytesHex(bytes);
  if (!h) return "—";
  return `${h.slice(0, n)}…`;
}

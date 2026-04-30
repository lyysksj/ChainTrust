/**
 * Append-only JSONL audit log for upload events.
 *
 * One file per logical stream under `data/audit/`. Each line is a JSON object.
 * Designed for grep / jq inspection during development; in production this
 * stream should ship to a real log sink.
 */
import fs from "node:fs/promises";
import path from "node:path";

export type UploadAuditEvent = {
  ts: string;
  wallet: string | null;
  uri: string | null;
  cid: string | null;
  sha256: string | null;
  mime: string;
  sizeBytes: number;
  backend: string | null;
  result: "ok" | "rejected";
  reason?: string;
};

const ROOT = path.join(process.cwd(), "data", "audit");
const UPLOAD_LOG = path.join(ROOT, "upload.log");

async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function appendUploadAudit(e: UploadAuditEvent): Promise<void> {
  try {
    await ensureRoot();
    await fs.appendFile(UPLOAD_LOG, JSON.stringify(e) + "\n", "utf8");
  } catch {
    // Audit failure must not break the user-facing request.
  }
}

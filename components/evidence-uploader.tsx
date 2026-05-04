"use client";

/**
 * EvidenceUploader
 *
 * Two-mode evidence input for attestation forms:
 *   - "upload"   user picks/drops a file. We compute SHA-256 client-side,
 *                ask the wallet to sign a server-issued challenge, POST
 *                the file to /api/upload, and bind the returned URI to
 *                the client-computed hash. Both halves of the binding
 *                (uri, hashHex) are emitted via onChange.
 *   - "url"      user pastes a URL they already have. The hash field is
 *                left blank — the URL is the only commitment. Caller is
 *                expected to fall back to its legacy hashing.
 *
 * The hash is the canonical commitment. The URI is just a pointer; if
 * Pinata drops the pin, anyone re-uploading the exact bytes can prove the
 * binding still holds because the hash matches.
 */
import { useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { useT } from "@/lib/i18n";

export type EvidenceValue = {
  uri: string;
  /** 64-char lowercase hex sha256 of the raw file bytes. Empty when
   *  source === "url" (we don't fetch external URLs server-side). */
  hashHex: string;
  contentType?: string;
  sizeBytes?: number;
  source: "upload" | "url";
  fileName?: string;
};

const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const ACCEPTED_ATTR = ACCEPTED_MIME.join(",");
const MAX_BYTES = 25 * 1024 * 1024;

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function fmtBytes(n: number | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function EvidenceUploader({
  value,
  onChange,
  onError,
}: {
  value: EvidenceValue | null;
  onChange: (v: EvidenceValue | null) => void;
  onError?: (msg: string) => void;
}) {
  const { publicKey, signMessage } = useWallet();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"upload" | "url">(
    value?.source === "url" ? "url" : "upload",
  );
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState(
    value?.source === "url" ? value.uri : "",
  );

  function emitError(msg: string) {
    setProgress(null);
    onError?.(msg);
  }

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      emitError(t("evidence.errors.tooLarge", { n: MAX_BYTES / 1024 / 1024 }));
      return;
    }
    if (!ACCEPTED_MIME.includes(file.type)) {
      emitError(
        t("evidence.errors.unsupported", {
          kind: file.type || t("evidence.errors.unknown"),
        }),
      );
      return;
    }
    if (!publicKey || !signMessage) {
      emitError(t("evidence.errors.connect"));
      return;
    }

    setBusy(true);
    try {
      setProgress(t("evidence.progress.hashing"));
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const clientHash = bufToHex(digest);

      setProgress(t("evidence.progress.challenge"));
      const chResp = await fetch("/api/upload/challenge");
      if (!chResp.ok) throw new Error(t("evidence.errors.challenge"));
      const ch = (await chResp.json()) as {
        nonce: string;
        message: string;
        expiresAt: number;
      };
      if (!ch?.nonce || !ch?.message) throw new Error(t("evidence.errors.badPayload"));

      setProgress(t("evidence.progress.signing"));
      const sig = await signMessage(new TextEncoder().encode(ch.message));
      const sigBase58 = bs58.encode(sig);

      setProgress(t("evidence.progress.pinning"));
      const form = new FormData();
      form.append("file", file);
      const upResp = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-pubkey": publicKey.toBase58(),
          "x-signature": sigBase58,
          "x-nonce": ch.nonce,
        },
        body: form,
      });
      const json = (await upResp.json().catch(() => ({}))) as {
        uri?: string;
        hashHex?: string;
        contentType?: string;
        sizeBytes?: number;
        backend?: string;
        error?: string;
      };
      if (!upResp.ok) {
        throw new Error(json?.error ?? `Upload failed (${upResp.status})`);
      }
      if (!json.uri || !json.hashHex) {
        throw new Error(t("evidence.errors.uploadResp"));
      }
      if (json.hashHex.toLowerCase() !== clientHash.toLowerCase()) {
        throw new Error(t("evidence.errors.hashMismatch"));
      }

      onChange({
        uri: json.uri,
        hashHex: clientHash,
        contentType: json.contentType,
        sizeBytes: json.sizeBytes,
        source: "upload",
        fileName: file.name,
      });
      setProgress(null);
    } catch (err) {
      emitError((err as Error).message ?? t("evidence.errors.failed"));
    } finally {
      setBusy(false);
    }
  }

  function applyUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    onChange({
      uri: trimmed,
      hashHex: "",
      source: "url",
    });
  }

  function clearValue() {
    onChange(null);
    setUrlInput("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const haveUploaded = value?.source === "upload";

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 10,
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <button
          type="button"
          onClick={() => setMode("upload")}
          style={{
            padding: "6px 12px",
            border: "1.5px solid var(--rule)",
            background: mode === "upload" ? "var(--ink)" : "var(--paper-2)",
            color: mode === "upload" ? "var(--paper)" : "var(--ink)",
            cursor: "pointer",
          }}
        >
          {t("evidence.tab.upload")}
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          style={{
            padding: "6px 12px",
            border: "1.5px solid var(--rule)",
            borderLeft: "none",
            background: mode === "url" ? "var(--ink)" : "var(--paper-2)",
            color: mode === "url" ? "var(--paper)" : "var(--ink)",
            cursor: "pointer",
          }}
        >
          {t("evidence.tab.url")}
        </button>
      </div>

      {mode === "upload" ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_ATTR}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <div
            onClick={() => !busy && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (busy) return;
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            style={{
              border: `1.5px dashed ${dragActive ? "var(--stamp-deep)" : "var(--rule)"}`,
              background: dragActive ? "var(--stamp-faint)" : "var(--paper-2)",
              padding: "22px 16px",
              textAlign: "center",
              cursor: busy ? "wait" : "pointer",
              transition: "background 120ms, border-color 120ms",
            }}
          >
            {haveUploaded ? (
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  color: "var(--ink)",
                  letterSpacing: "0.04em",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--good)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {t("evidence.upload.pinned")} {value!.contentType ?? "file"} ·{" "}
                  {fmtBytes(value!.sizeBytes)}
                </div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {value!.fileName ?? t("evidence.upload.fileFallback")}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--ink-3)",
                    marginTop: 4,
                    wordBreak: "break-all",
                  }}
                >
                  {value!.uri}
                </div>
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearValue();
                    }}
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      border: "1px solid var(--rule)",
                      background: "transparent",
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {t("evidence.upload.replace")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 16,
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  {t("evidence.upload.cta")}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--ink-3)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {t("evidence.upload.hint")}
                </div>
              </>
            )}
          </div>

          {busy && (
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--stamp-deep)",
                letterSpacing: "0.06em",
              }}
            >
              ◇ {progress?.toUpperCase()}
            </div>
          )}

          {haveUploaded && (
            <div
              style={{
                marginTop: 10,
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-2)",
                lineHeight: 1.6,
                padding: "8px 10px",
                background: "var(--paper-2)",
                border: "1px solid var(--rule-soft)",
              }}
            >
              <div>
                <strong style={{ color: "var(--stamp-deep)" }}>{t("evidence.upload.hashLabel")}</strong> 0x
                {value!.hashHex.slice(0, 16)}…{value!.hashHex.slice(-8)}
              </div>
              <div style={{ color: "var(--ink-3)" }}>
                {t("evidence.upload.hashNote")}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 10,
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--revoked)",
              lineHeight: 1.6,
              letterSpacing: "0.04em",
            }}
          >
            {t("evidence.upload.warn")}
          </div>
        </>
      ) : (
        <>
          <input
            type="url"
            placeholder={t("evidence.url.placeholder")}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={applyUrl}
          />
          <div
            className="hint"
            style={{
              marginTop: 6,
              color: "var(--ink-3)",
            }}
          >
            {t("evidence.url.hint")}
          </div>
          {value?.source === "url" && value.uri && (
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-2)",
              }}
            >
              ↗ {value.uri}
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchEntityByPda,
  submitComment,
  submitReply,
} from "@/lib/anchor/client";
import { sha256Bytes } from "@/lib/utils/hash";
import { COMMENT_RELATION_LABELS } from "@/types";

type Props = {
  entity: PublicKey;
  parentComment?: PublicKey | null;
  onSubmitted?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
};

const MAX_IMAGES = 6;

export function CommentForm({
  entity,
  parentComment,
  onSubmitted,
  onCancel,
  autoFocus,
}: Props) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const isReply = !!parentComment;

  const [relationType, setRelationType] = useState(2); // default Addendum
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (images.length >= MAX_IMAGES) {
      setError(`Up to ${MAX_IMAGES} images per signal.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const remaining = MAX_IMAGES - images.length;
      const list = Array.from(files).slice(0, remaining);
      const uploaded: string[] = [];
      for (const file of list) {
        const form = new FormData();
        form.set("file", file);
        const resp = await fetch("/api/mock/upload-image", {
          method: "POST",
          body: form,
        });
        const json = await resp.json();
        if (!resp.ok || !json.uri) {
          throw new Error(json.error ?? "Image upload failed");
        }
        uploaded.push(json.uri);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError((err as Error).message ?? "Image upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(uri: string) {
    setImages((prev) => prev.filter((u) => u !== uri));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!program || !publicKey) {
      setError("Connect a wallet first.");
      return;
    }
    if (!body.trim()) {
      setError(isReply ? "Reply cannot be empty." : "Signal body is required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        body: body.trim(),
        images,
      };
      if (!isReply) {
        payload.headline = headline.trim() || "(untitled)";
        payload.relationType = relationType;
      }
      const content = JSON.stringify(payload);
      const up = await fetch("/api/mock/upload", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: content,
      }).then((r) => r.json());
      if (!up.uri) throw new Error(up.error ?? "Upload failed");

      const ent = await fetchEntityByPda(program, entity);
      if (!ent) throw new Error("Entity not found");
      const commentIndex = ent.commentCount;

      if (isReply && parentComment) {
        await submitReply(program, publicKey, {
          entity,
          parentComment,
          commentIndex,
          contentHash: sha256Bytes(content),
          evidenceHash: sha256Bytes(null),
          contentUri: up.uri,
        });
      } else {
        await submitComment(program, publicKey, {
          entity,
          commentIndex,
          relationType,
          contentHash: sha256Bytes(content),
          evidenceHash: sha256Bytes(null),
          contentUri: up.uri,
        });
      }

      setHeadline("");
      setBody("");
      setImages([]);
      onSubmitted?.();
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`space-y-3 border border-ink-200 bg-white p-4 ${isReply ? "" : "space-y-4"}`}
    >
      {!isReply && (
        <div>
          <h3 className="serif text-base font-semibold text-ink-800">
            Add a community signal
          </h3>
          <p className="hint">
            Append-only. Use this for nuanced facts (disputes, addenda, incidents)
            that don't fit the structured relationship schema. Hash, timestamp,
            and your wallet are anchored on-chain.
          </p>
        </div>
      )}

      {!isReply && (
        <>
          <div>
            <label className="label">Signal kind</label>
            <select
              className="select mt-1"
              value={relationType}
              onChange={(e) => setRelationType(Number(e.target.value))}
            >
              {Object.entries(COMMENT_RELATION_LABELS)
                .filter(([k]) => Number(k) >= 1)
                .map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Headline (optional)</label>
            <input
              className="input mt-1"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="One-line summary"
              maxLength={140}
            />
          </div>
        </>
      )}

      <div>
        <label className="label">{isReply ? "Reply" : "Body"}</label>
        <textarea
          className="textarea mt-1"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            isReply
              ? "Add context, ask a question, or share your take."
              : "Stick to facts. Provide evidence when possible."
          }
          maxLength={4000}
          autoFocus={autoFocus}
        />
      </div>

      <div>
        <label className="label">Images (optional)</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {images.map((uri) => (
            <div key={uri} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/mock/fetch?uri=${encodeURIComponent(uri)}`}
                alt="signal attachment"
                className="h-20 w-20 border border-ink-200 object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(uri)}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs text-white"
                aria-label="remove image"
              >
                ×
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center border border-dashed border-ink-300 text-xs text-ink-500 hover:bg-ink-50">
              {uploading ? "…" : "+ image"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploading}
              />
            </label>
          )}
        </div>
        <p className="hint mt-1">
          Up to {MAX_IMAGES} images. Images are pinned off-chain; only the body
          hash goes on-chain.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-500">
          {isReply
            ? "Replies are immutable once submitted."
            : "Claim gives voice, not control."}
        </p>
        <div className="flex gap-2">
          {isReply && onCancel && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
          <button
            className="btn"
            disabled={submitting || uploading || !publicKey}
          >
            {submitting
              ? "Publishing…"
              : isReply
              ? "Post reply"
              : "Submit on-chain"}
          </button>
        </div>
      </div>
    </form>
  );
}

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
import { uploadImage, uploadMetadata } from "@/lib/upload-client";
import { COMMENT_RELATION_LABELS } from "@/types";
import { useT } from "@/lib/i18n";

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
  const { publicKey, signMessage } = useWallet();
  const program = useProgram();
  const t = useT();
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
      setError(t("comment.errors.maxImages", { n: MAX_IMAGES }));
      return;
    }
    if (!publicKey) {
      setError(t("comment.errors.connect"));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const remaining = MAX_IMAGES - images.length;
      const list = Array.from(files).slice(0, remaining);
      const uploaded: string[] = [];
      for (const file of list) {
        const result = await uploadImage(publicKey, signMessage, file);
        uploaded.push(result.uri);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError((err as Error).message ?? t("comment.errors.imageUpload"));
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
      setError(t("comment.errors.connect"));
      return;
    }
    if (!body.trim()) {
      setError(
        isReply ? t("comment.errors.replyEmpty") : t("comment.errors.bodyEmpty"),
      );
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        body: body.trim(),
        images,
      };
      if (!isReply) {
        payload.headline = headline.trim() || t("comment.untitled");
        payload.relationType = relationType;
      }
      const content = JSON.stringify(payload);
      const up = await uploadMetadata(publicKey, signMessage, content);

      // Comment-index race fix: re-read entity right before submit, and on
      // CommentEntityMismatch retry once with the freshest count. Multiple
      // users hitting the same entity simultaneously would otherwise all see
      // the same stale `commentCount` and only one tx would land.
      const fetchIndex = async (): Promise<number> => {
        const ent = await fetchEntityByPda(program, entity);
        if (!ent) throw new Error(t("comment.errors.entityNotFound"));
        return ent.commentCount;
      };
      const submitOnce = async (commentIndex: number): Promise<void> => {
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
      };

      let commentIndex = await fetchIndex();
      try {
        await submitOnce(commentIndex);
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        if (
          msg.includes("CommentEntityMismatch") ||
          msg.includes("0x1c61") || // 6017 in hex
          msg.includes("comment_count") ||
          msg.includes("already in use")
        ) {
          commentIndex = await fetchIndex();
          await submitOnce(commentIndex);
        } else {
          throw err;
        }
      }

      setHeadline("");
      setBody("");
      setImages([]);
      onSubmitted?.();
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? t("comment.errors.failed"));
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
            {t("comment.title")}
          </h3>
          <p className="hint">{t("comment.intro")}</p>
        </div>
      )}

      {!isReply && (
        <>
          <div>
            <label className="label">{t("comment.fields.kind")}</label>
            <select
              className="select mt-1"
              value={relationType}
              onChange={(e) => setRelationType(Number(e.target.value))}
            >
              {Object.entries(COMMENT_RELATION_LABELS)
                .filter(([k]) => Number(k) >= 1)
                .map(([k]) => (
                  <option key={k} value={k}>
                    {t(`commentKind.${k}`)}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">{t("comment.fields.headline")}</label>
            <input
              className="input mt-1"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={t("comment.fields.headlinePlaceholder")}
              maxLength={140}
            />
          </div>
        </>
      )}

      <div>
        <label className="label">
          {isReply ? t("comment.fields.reply") : t("comment.fields.body")}
        </label>
        <textarea
          className="textarea mt-1"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            isReply
              ? t("comment.fields.replyPlaceholder")
              : t("comment.fields.bodyPlaceholder")
          }
          maxLength={4000}
          autoFocus={autoFocus}
        />
      </div>

      <div>
        <label className="label">{t("comment.fields.images")}</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {images.map((uri) => (
            <div key={uri} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/mock/fetch?uri=${encodeURIComponent(uri)}`}
                alt={t("comment.imageAlt")}
                className="h-20 w-20 border border-ink-200 object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(uri)}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs text-white"
                aria-label={t("comment.imageRemove")}
              >
                ×
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center border border-dashed border-ink-300 text-xs text-ink-500 hover:bg-ink-50">
              {uploading ? "…" : t("comment.fields.imagesAdd")}
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
          {t("comment.fields.imagesNote.lead")} {MAX_IMAGES}{" "}
          {t("comment.fields.imagesNote.tail")}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-500">
          {isReply ? t("comment.foot.reply") : t("comment.foot.signal")}
        </p>
        <div className="flex gap-2">
          {isReply && onCancel && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              {t("comment.btn.cancel")}
            </button>
          )}
          <button
            className="btn"
            disabled={submitting || uploading || !publicKey}
          >
            {submitting
              ? t("comment.btn.submitting")
              : isReply
              ? t("comment.btn.submitReply")
              : t("comment.btn.submit")}
          </button>
        </div>
      </div>
    </form>
  );
}

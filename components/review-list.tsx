"use client";

import { useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import { addOfficialResponse } from "@/lib/anchor/client";
import { formatTimestamp, shortHash, shortKey } from "@/lib/utils/format";
import { RELATION_LABELS } from "@/types";
import type { CommentBody, CommentRecord } from "@/types";

type Item = {
  publicKey: PublicKey;
  account: CommentRecord;
};

type Props = {
  entryPda: PublicKey;
  items: Item[];
  isClaimed: boolean;
  officialWallet?: PublicKey | null;
  onResponded?: () => void;
};

export function ReviewList({
  entryPda,
  items,
  isClaimed,
  officialWallet,
  onResponded,
}: Props) {
  if (!items.length) {
    return (
      <p className="hint">
        No reviews yet. Be the first to anchor a record of working with this company.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {items
        .slice()
        .sort((a, b) => Number(b.account.submittedAt) - Number(a.account.submittedAt))
        .map((c) => (
          <ReviewItem
            key={c.publicKey.toBase58()}
            entryPda={entryPda}
            commentPda={c.publicKey}
            comment={c.account}
            isClaimed={isClaimed}
            officialWallet={officialWallet ?? null}
            onResponded={onResponded}
          />
        ))}
    </ul>
  );
}

function ReviewItem({
  entryPda,
  commentPda,
  comment,
  isClaimed,
  officialWallet,
  onResponded,
}: {
  entryPda: PublicKey;
  commentPda: PublicKey;
  comment: CommentRecord;
  isClaimed: boolean;
  officialWallet: PublicKey | null;
  onResponded?: () => void;
}) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [body, setBody] = useState<CommentBody | null>(null);
  const [responseBody, setResponseBody] = useState<string | null>(null);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await fetch(
          `/api/mock/fetch?uri=${encodeURIComponent(comment.contentUri)}`,
        );
        if (!resp.ok) return;
        const text = await resp.text();
        if (!alive) return;
        try {
          setBody(JSON.parse(text) as CommentBody);
        } catch {
          setBody({ headline: "(content)", body: text } as CommentBody);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [comment.contentUri]);

  useEffect(() => {
    let alive = true;
    if (!comment.officialResponseUri) {
      setResponseBody(null);
      return;
    }
    (async () => {
      try {
        const resp = await fetch(
          `/api/mock/fetch?uri=${encodeURIComponent(comment.officialResponseUri)}`,
        );
        if (!resp.ok) return;
        const text = await resp.text();
        if (!alive) return;
        try {
          const parsed = JSON.parse(text) as { body?: string };
          setResponseBody(parsed.body ?? text);
        } catch {
          setResponseBody(text);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [comment.officialResponseUri]);

  const canRespond =
    isClaimed &&
    program &&
    publicKey &&
    officialWallet &&
    publicKey.toBase58() === officialWallet.toBase58();

  async function submitResponse() {
    if (!program || !publicKey) return;
    if (!draft.trim()) {
      setError("Response cannot be empty.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const content = JSON.stringify({ body: draft.trim() });
      const up = await fetch("/api/mock/upload", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: content,
      }).then((r) => r.json());
      if (!up.uri) throw new Error(up.error ?? "Upload failed");
      await addOfficialResponse(program, publicKey, entryPda, commentPda, up.uri);
      setShowResponseForm(false);
      setDraft("");
      onResponded?.();
    } catch (err) {
      setError((err as Error).message ?? "Failed to publish response");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="border border-ink-200 bg-white">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
          <div className="flex items-center gap-2">
            <span className="chip chip-community">Community review</span>
            <span>{RELATION_LABELS[comment.relationType] ?? "Other"}</span>
            <span className="mono">by {shortKey(comment.commenter)}</span>
          </div>
          <span>{formatTimestamp(comment.submittedAt)}</span>
        </div>

        {body?.headline && (
          <h4 className="serif text-lg font-semibold text-ink-800">{body.headline}</h4>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
          {body?.body ?? <span className="hint">Loading content…</span>}
        </p>

        <ScoreBar label="Contract" value={comment.contractScore} />
        <ScoreBar label="Team" value={comment.teamScore} />
        <ScoreBar label="Product" value={comment.productScore} />

        <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-2 text-[11px] text-ink-500">
          <span className="mono">content-hash: {shortHash(comment.contentHash)}</span>
          <span className="mono">pda: {shortKey(commentPda)}</span>
          <span>Immutable · append-only record</span>
        </div>
      </div>

      {comment.officialResponseUri ? (
        <div className="border-t-2 border-claimed bg-claimed/5 p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-claimed">
            <span className="chip chip-official">Official response</span>
            <span>{formatTimestamp(comment.officialResponseAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
            {responseBody ?? <span className="hint">Loading response…</span>}
          </p>
          <p className="hint mt-2">
            Official response is a separate record. It does not alter the original review hash above.
          </p>
        </div>
      ) : canRespond ? (
        <div className="border-t border-ink-100 bg-ink-50 p-4">
          {!showResponseForm ? (
            <button
              className="btn-outline"
              onClick={() => setShowResponseForm(true)}
            >
              Publish official response
            </button>
          ) : (
            <div className="space-y-2">
              <label className="label">Official response</label>
              <textarea
                className="textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Respond on-chain. You can add context, correct facts, or share resolution steps."
                maxLength={4000}
              />
              {error && <p className="error">{error}</p>}
              <div className="flex gap-2">
                <button
                  className="btn"
                  onClick={submitResponse}
                  disabled={submitting}
                >
                  {submitting ? "Publishing…" : "Publish response"}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowResponseForm(false);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-ink-600">
      <span className="w-20 uppercase tracking-wider text-ink-500">{label}</span>
      {value === 0 ? (
        <span className="text-ink-400">no opinion</span>
      ) : (
        <span className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={`inline-block h-2 w-4 rounded-xs ${
                n <= value ? "bg-ink-700" : "bg-ink-200"
              }`}
            />
          ))}
          <span className="ml-2 text-ink-500">{value}/5</span>
        </span>
      )}
    </div>
  );
}

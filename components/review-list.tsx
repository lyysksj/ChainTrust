"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import {
  addOfficialResponse,
  fetchLikesByLiker,
  likeComment,
  unlikeComment,
} from "@/lib/anchor/client";
import { CommentForm } from "@/components/comment-form";
import { formatTimestamp, shortHash, shortKey } from "@/lib/utils/format";
import { uploadMetadata } from "@/lib/upload-client";
import type { CommentBody, CommentRecord } from "@/types";
import { useT } from "@/lib/i18n";

type Item = {
  publicKey: PublicKey;
  account: CommentRecord;
};

type Props = {
  entity: PublicKey;
  items: Item[];
  isClaimed: boolean;
  createdBy: PublicKey;
  officialWallet?: PublicKey | null;
  onResponded?: () => void;
};

type CommenterRole = "official" | "creator" | "community";

function commenterRole(
  commenter: PublicKey,
  createdBy: PublicKey,
  officialWallet: PublicKey | null,
  isClaimed: boolean,
): CommenterRole {
  if (isClaimed && officialWallet && commenter.equals(officialWallet)) {
    return "official";
  }
  if (commenter.equals(createdBy)) return "creator";
  return "community";
}

type TreeNode = {
  item: Item;
  children: TreeNode[];
};

function buildTree(items: Item[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const it of items) {
    nodes.set(it.publicKey.toBase58(), { item: it, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.item.account.parentComment;
    if (!parent) {
      roots.push(node);
      continue;
    }
    const parentNode = nodes.get(parent.toBase58());
    if (parentNode) parentNode.children.push(node);
    else roots.push(node); // orphan fallback
  }
  // Sort roots newest first; sort children oldest first (conversation order)
  roots.sort(
    (a, b) =>
      Number(b.item.account.submittedAt) - Number(a.item.account.submittedAt),
  );
  const sortChildren = (n: TreeNode) => {
    n.children.sort(
      (a, b) =>
        Number(a.item.account.submittedAt) -
        Number(b.item.account.submittedAt),
    );
    n.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);
  return roots;
}

export function ReviewList({
  entity,
  items,
  isClaimed,
  createdBy,
  officialWallet,
  onResponded,
}: Props) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const t = useT();
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    if (!program || !publicKey) {
      setLikedSet(new Set());
      return;
    }
    (async () => {
      try {
        const mine = await fetchLikesByLiker(program, publicKey);
        if (!alive) return;
        setLikedSet(
          new Set(mine.map((r) => (r.account as { comment: PublicKey }).comment.toBase58())),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [program, publicKey, items]);

  const tree = useMemo(() => buildTree(items), [items]);

  if (!items.length) {
    return <p className="hint">{t("review.empty")}</p>;
  }

  return (
    <ul className="space-y-4">
      {tree.map((node) => (
        <CommentNode
          key={node.item.publicKey.toBase58()}
          node={node}
          entity={entity}
          isClaimed={isClaimed}
          createdBy={createdBy}
          officialWallet={officialWallet ?? null}
          likedSet={likedSet}
          setLikedSet={setLikedSet}
          onResponded={onResponded}
        />
      ))}
    </ul>
  );
}

function CommentNode({
  node,
  entity,
  isClaimed,
  createdBy,
  officialWallet,
  likedSet,
  setLikedSet,
  onResponded,
}: {
  node: TreeNode;
  entity: PublicKey;
  isClaimed: boolean;
  createdBy: PublicKey;
  officialWallet: PublicKey | null;
  likedSet: Set<string>;
  setLikedSet: (fn: (prev: Set<string>) => Set<string>) => void;
  onResponded?: () => void;
}) {
  const { item, children } = node;
  const { account: comment, publicKey: commentPda } = item;
  const { publicKey, signMessage } = useWallet();
  const program = useProgram();
  const t = useT();
  const [body, setBody] = useState<CommentBody | null>(null);
  const [responseBody, setResponseBody] = useState<string | null>(null);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseDraft, setResponseDraft] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [liking, setLiking] = useState(false);
  const [likeCountLocal, setLikeCountLocal] = useState(comment.likeCount);

  useEffect(() => setLikeCountLocal(comment.likeCount), [comment.likeCount]);

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
          setBody({ body: text } as CommentBody);
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
    !comment.parentComment &&
    program &&
    publicKey &&
    officialWallet &&
    publicKey.toBase58() === officialWallet.toBase58();

  const canReply = program && publicKey && comment.depth < 2;
  const isReply = !!comment.parentComment;
  const liked = likedSet.has(commentPda.toBase58());

  async function toggleLike() {
    if (!program || !publicKey) return;
    setLiking(true);
    try {
      if (liked) {
        await unlikeComment(program, publicKey, commentPda);
        setLikedSet((prev) => {
          const next = new Set(prev);
          next.delete(commentPda.toBase58());
          return next;
        });
        setLikeCountLocal((n) => Math.max(0, n - 1));
      } else {
        await likeComment(program, publicKey, commentPda);
        setLikedSet((prev) => {
          const next = new Set(prev);
          next.add(commentPda.toBase58());
          return next;
        });
        setLikeCountLocal((n) => n + 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLiking(false);
    }
  }

  async function submitResponse() {
    if (!program || !publicKey) return;
    if (!responseDraft.trim()) {
      setResponseError(t("review.errors.empty"));
      return;
    }
    setSubmittingResponse(true);
    setResponseError(null);
    try {
      const content = JSON.stringify({ body: responseDraft.trim() });
      const up = await uploadMetadata(publicKey, signMessage, content);
      await addOfficialResponse(
        program,
        publicKey,
        entity,
        commentPda,
        up.uri,
      );
      setShowResponseForm(false);
      setResponseDraft("");
      onResponded?.();
    } catch (err) {
      setResponseError((err as Error).message ?? t("review.errors.failed"));
    } finally {
      setSubmittingResponse(false);
    }
  }

  return (
    <li
      className={`${
        isReply ? "border-l-2 border-ink-200 pl-4" : "border border-ink-200 bg-white"
      }`}
    >
      <div className={isReply ? "space-y-2 border border-ink-100 bg-ink-50/60 p-3" : "space-y-3 p-4"}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
          <div className="flex items-center gap-2">
            {(() => {
              const role = commenterRole(
                comment.commenter,
                createdBy,
                officialWallet,
                isClaimed,
              );
              if (role === "official") {
                return (
                  <span className="chip chip-official">
                    {isReply
                      ? t("review.role.officialReply")
                      : t("review.role.officialResponse")}
                  </span>
                );
              }
              if (role === "creator") {
                return (
                  <span className="chip chip-creator">
                    {isReply
                      ? t("review.role.creatorReply")
                      : t("review.role.creatorSignal")}
                  </span>
                );
              }
              return (
                <span className="chip chip-community">
                  {isReply
                    ? t("review.role.communityReply")
                    : t("review.role.communitySignal")}
                </span>
              );
            })()}
            {!isReply && (
              <span>{t(`commentKind.${comment.relationType}`)}</span>
            )}
            <span className="mono">
              {t("review.by")} {shortKey(comment.commenter)}
            </span>
          </div>
          <span>{formatTimestamp(comment.submittedAt)}</span>
        </div>

        {!isReply && body?.headline && (
          <h4 className="serif text-lg font-semibold text-ink-800">
            {body.headline}
          </h4>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
          {body?.body ?? (
            <span className="hint">{t("review.bodyLoading")}</span>
          )}
        </p>

        {body?.images && body.images.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {body.images.map((uri) => (
              <a
                key={uri}
                href={`/api/mock/fetch?uri=${encodeURIComponent(uri)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/mock/fetch?uri=${encodeURIComponent(uri)}`}
                  alt={t("review.imageAlt")}
                  className="h-24 w-24 border border-ink-200 object-cover hover:opacity-80"
                />
              </a>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-2 text-[11px] text-ink-500">
          <button
            type="button"
            onClick={toggleLike}
            disabled={!publicKey || liking}
            className={`flex items-center gap-1 rounded-sm px-2 py-1 text-xs ${
              liked
                ? "bg-accent/10 text-accent"
                : "text-ink-600 hover:bg-ink-100"
            } disabled:opacity-50`}
            aria-pressed={liked}
          >
            <span>{liked ? "♥" : "♡"}</span>
            <span>{likeCountLocal}</span>
          </button>
          {canReply && (
            <button
              type="button"
              onClick={() => setShowReplyForm((v) => !v)}
              className="rounded-sm px-2 py-1 text-xs text-ink-600 hover:bg-ink-100"
            >
              {showReplyForm ? t("review.cancelReply") : t("review.replyBtn")}
            </button>
          )}
          {children.length > 0 && (
            <span>
              {children.length}{" "}
              {children.length === 1
                ? t("review.replyOne")
                : t("review.replyMany")}
            </span>
          )}
          <span className="mono ml-auto">
            {t("review.hash")} {shortHash(comment.contentHash)}
          </span>
          <span className="mono">
            {t("review.pda")} {shortKey(commentPda)}
          </span>
        </div>

        {showReplyForm && (
          <div className="pt-2">
            <CommentForm
              entity={entity}
              parentComment={commentPda}
              onSubmitted={() => {
                setShowReplyForm(false);
                onResponded?.();
              }}
              onCancel={() => setShowReplyForm(false)}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Official response block — only on top-level signals */}
      {!isReply && comment.officialResponseUri ? (
        <div className="border-t-2 border-claimed bg-claimed/5 p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-claimed">
            <span className="chip chip-official">
              {t("review.role.officialResponse")}
            </span>
            <span>{formatTimestamp(comment.officialResponseAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
            {responseBody ?? (
              <span className="hint">{t("review.responseLoading")}</span>
            )}
          </p>
          <p className="hint mt-2">{t("review.responseFoot")}</p>
        </div>
      ) : !isReply && canRespond ? (
        <div className="border-t border-ink-100 bg-ink-50 p-4">
          {!showResponseForm ? (
            <button
              type="button"
              className="btn-outline"
              onClick={() => setShowResponseForm(true)}
            >
              {t("review.publishResponseBtn")}
            </button>
          ) : (
            <div className="space-y-2">
              <label className="label">{t("review.responseLabel")}</label>
              <textarea
                className="textarea"
                value={responseDraft}
                onChange={(e) => setResponseDraft(e.target.value)}
                placeholder={t("review.responsePlaceholder")}
                maxLength={4000}
              />
              {responseError && <p className="error">{responseError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={submitResponse}
                  disabled={submittingResponse}
                >
                  {submittingResponse
                    ? t("review.responseSubmitting")
                    : t("review.responseSubmit")}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowResponseForm(false);
                    setResponseError(null);
                  }}
                >
                  {t("review.responseCancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Nested replies */}
      {children.length > 0 && (
        <ul className="mt-3 space-y-3 pl-4">
          {children.map((child) => (
            <CommentNode
              key={child.item.publicKey.toBase58()}
              node={child}
              entity={entity}
              isClaimed={isClaimed}
              createdBy={createdBy}
              officialWallet={officialWallet}
              likedSet={likedSet}
              setLikedSet={setLikedSet}
              onResponded={onResponded}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

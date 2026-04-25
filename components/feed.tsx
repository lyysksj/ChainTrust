"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllComments,
  fetchAllEntries,
  fetchAllUsers,
} from "@/lib/anchor/client";
import { bytesHex, formatTimestamp, shortKey } from "@/lib/utils/format";
import { RELATION_LABELS } from "@/types";
import type {
  CommentBody,
  CommentRecord,
  CompanyEntry,
  EntryMetadata,
  UserProfile,
} from "@/types";

const MAX_ITEMS = 30;

type FeedItem = {
  commentPda: PublicKey;
  comment: CommentRecord;
  entryIdHex: string;
  entryName: string | null;
  commenterName: string | null;
  body: CommentBody | null;
  replyCount: number;
};

export function Feed() {
  const program = useProgram();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!program) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [rawComments, rawEntries, rawUsers] = await Promise.all([
          fetchAllComments(program),
          fetchAllEntries(program),
          fetchAllUsers(program),
        ]);
        if (!alive) return;

        const entryByPda = new Map<
          string,
          { idHex: string; metaUri: string }
        >();
        for (const e of rawEntries) {
          const acc = e.account as unknown as CompanyEntry;
          entryByPda.set(e.publicKey.toBase58(), {
            idHex: bytesHex(acc.entryId),
            metaUri: acc.metadataUri,
          });
        }

        const userByWallet = new Map<string, UserProfile>();
        for (const u of rawUsers) {
          const acc = u.account as unknown as UserProfile;
          userByWallet.set(acc.wallet.toBase58(), acc);
        }

        // Count replies per parent_comment
        const replyCounts = new Map<string, number>();
        for (const c of rawComments) {
          const acc = c.account as unknown as CommentRecord;
          if (acc.parentComment) {
            const key = acc.parentComment.toBase58();
            replyCounts.set(key, (replyCounts.get(key) ?? 0) + 1);
          }
        }

        const metaByUri = new Map<string, EntryMetadata | null>();
        async function loadMeta(uri: string): Promise<EntryMetadata | null> {
          if (!uri) return null;
          if (metaByUri.has(uri)) return metaByUri.get(uri) ?? null;
          try {
            const resp = await fetch(
              `/api/mock/fetch?uri=${encodeURIComponent(uri)}`,
            );
            if (!resp.ok) {
              metaByUri.set(uri, null);
              return null;
            }
            const text = await resp.text();
            const parsed = JSON.parse(text) as EntryMetadata;
            metaByUri.set(uri, parsed);
            return parsed;
          } catch {
            metaByUri.set(uri, null);
            return null;
          }
        }

        async function loadBody(uri: string): Promise<CommentBody | null> {
          if (!uri) return null;
          try {
            const resp = await fetch(
              `/api/mock/fetch?uri=${encodeURIComponent(uri)}`,
            );
            if (!resp.ok) return null;
            const text = await resp.text();
            try {
              return JSON.parse(text) as CommentBody;
            } catch {
              return { body: text } as CommentBody;
            }
          } catch {
            return null;
          }
        }

        // Feed shows top-level reviews only
        const topLevel = rawComments
          .map((c) => ({
            publicKey: c.publicKey,
            account: c.account as unknown as CommentRecord,
          }))
          .filter((c) => !c.account.parentComment)
          .sort(
            (a, b) =>
              Number(b.account.submittedAt) - Number(a.account.submittedAt),
          )
          .slice(0, MAX_ITEMS);

        const hydrated = await Promise.all(
          topLevel.map(async (c) => {
            const entryInfo = entryByPda.get(c.account.entry.toBase58());
            const [meta, body] = await Promise.all([
              entryInfo ? loadMeta(entryInfo.metaUri) : Promise.resolve(null),
              loadBody(c.account.contentUri),
            ]);
            const commenter = userByWallet.get(c.account.commenter.toBase58());
            return {
              commentPda: c.publicKey,
              comment: c.account,
              entryIdHex: entryInfo?.idHex ?? "",
              entryName:
                meta?.projectName ?? meta?.legalName ?? null,
              commenterName: commenter?.username
                ? `@${commenter.username}`
                : null,
              body,
              replyCount: replyCounts.get(c.publicKey.toBase58()) ?? 0,
            } as FeedItem;
          }),
        );
        if (!alive) return;
        setItems(hydrated);
      } catch (err) {
        if (alive) setError((err as Error).message ?? "Failed to load feed");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program]);

  if (!program) {
    return (
      <div className="border border-ink-200 bg-white p-6">
        <p className="hint">Connect wallet to load the public review feed.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border border-ink-200 bg-white p-6">
        <p className="hint">Loading feed…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-ink-200 bg-white p-6">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="border border-ink-200 bg-white p-6">
        <p className="hint">
          No reviews have been anchored yet. Be the first to open an entry and
          leave a review.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <FeedCard key={item.commentPda.toBase58()} item={item} />
      ))}
    </ul>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const {
    comment,
    entryIdHex,
    entryName,
    commenterName,
    body,
    replyCount,
  } = item;
  const thumbnails = useMemo(
    () => (body?.images ?? []).slice(0, 3),
    [body],
  );

  return (
    <li className="border border-ink-200 bg-white">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span className="font-semibold text-ink-700">
            {commenterName ?? shortKey(comment.commenter)}
          </span>
          <span>reviewed</span>
          {entryIdHex ? (
            <Link
              href={`/entry/${entryIdHex}`}
              className="serif text-sm font-semibold text-accent hover:underline"
            >
              {entryName ?? "(unnamed entry)"}
            </Link>
          ) : (
            <span className="serif text-sm font-semibold text-ink-700">
              {entryName ?? "(unknown entry)"}
            </span>
          )}
          <span className="ml-auto">{formatTimestamp(comment.submittedAt)}</span>
        </div>

        {body?.headline && (
          <h4 className="serif text-lg font-semibold text-ink-800">
            {body.headline}
          </h4>
        )}
        {body?.body && (
          <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
            {body.body}
          </p>
        )}

        {thumbnails.length > 0 && (
          <div className="flex gap-2">
            {thumbnails.map((uri) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={uri}
                src={`/api/mock/fetch?uri=${encodeURIComponent(uri)}`}
                alt="review attachment"
                className="h-16 w-16 border border-ink-200 object-cover"
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
          <span className="chip chip-community">
            {RELATION_LABELS[comment.relationType] ?? "Other"}
          </span>
          <span>♥ {comment.likeCount}</span>
          <span>💬 {replyCount}</span>
          {comment.officialResponseUri && (
            <span className="chip chip-official">Official response</span>
          )}
          {entryIdHex && (
            <Link
              href={`/entry/${entryIdHex}`}
              className="ml-auto text-accent hover:underline"
            >
              View thread →
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

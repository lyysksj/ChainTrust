"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchCommentsByCommenter,
  fetchEntriesCreatedBy,
  fetchUserProfile,
} from "@/lib/anchor/client";
import { bytesHex, formatTimestamp, shortHash, shortKey } from "@/lib/utils/format";
import type { CommentRecord, CompanyEntry, UserProfile } from "@/types";

type Params = { wallet: string };

export default function ProfilePage({ params }: { params: Params }) {
  const program = useProgram();

  const wallet = useMemo(() => {
    try {
      return new PublicKey(params.wallet);
    } catch {
      return null;
    }
  }, [params.wallet]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<
    { publicKey: PublicKey; account: CompanyEntry }[]
  >([]);
  const [comments, setComments] = useState<
    { publicKey: PublicKey; account: CommentRecord }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!program || !wallet) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const p = await fetchUserProfile(program, wallet);
        if (!alive) return;
        setProfile(p);
        const [e, c] = await Promise.all([
          fetchEntriesCreatedBy(program, wallet),
          fetchCommentsByCommenter(program, wallet),
        ]);
        if (!alive) return;
        setEntries(e);
        setComments(c);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program, wallet]);

  if (!wallet) return <p className="hint">Invalid wallet address.</p>;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-500">User profile</p>
        <h1 className="serif text-4xl font-semibold text-ink-800">
          {profile?.displayName ?? shortKey(wallet)}
        </h1>
        <p className="text-sm text-ink-600">
          {profile ? (
            <>
              <span className="mono">@{profile.username}</span>
              {" · "}Registered {formatTimestamp(profile.registeredAt)}
            </>
          ) : (
            <>
              This wallet has not registered a ChainTrust profile yet.{" "}
              <Link href="/register" className="underline">
                Register
              </Link>
              .
            </>
          )}
        </p>
        <p className="mono text-xs text-ink-500">{wallet.toBase58()}</p>
      </header>

      {loading && <p className="hint">Loading on-chain records…</p>}

      <Section title="Entries created">
        {entries.length === 0 ? (
          <p className="hint">No entries created by this wallet.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.publicKey.toBase58()}
                className="flex items-center justify-between border border-ink-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="mono text-xs text-ink-500">
                    entry {bytesHex(e.account.entryId)}
                  </p>
                  <p className="text-sm">
                    Jurisdiction: {e.account.jurisdiction} · {e.account.commentCount} review(s)
                  </p>
                </div>
                <Link
                  href={`/entry/${bytesHex(e.account.entryId)}`}
                  className="btn-secondary"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Reviews submitted">
        {comments.length === 0 ? (
          <p className="hint">No reviews submitted yet.</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.publicKey.toBase58()}
                className="border border-ink-200 bg-white px-4 py-3"
              >
                <p className="text-xs text-ink-500">
                  for entry <span className="mono">{shortKey(c.account.entry)}</span>
                  {" · "}
                  submitted {formatTimestamp(c.account.submittedAt)}
                </p>
                <p className="mono mt-1 text-[11px] text-ink-500">
                  content-hash {shortHash(c.account.contentHash)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-ink-200 pt-6">
      <h2 className="serif mb-3 text-xl font-semibold text-ink-800">{title}</h2>
      {children}
    </section>
  );
}

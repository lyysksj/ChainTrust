"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchCommentsByCommenter,
  fetchEntriesCreatedBy,
  fetchUserProfile,
} from "@/lib/anchor/client";
import { shortKey } from "@/lib/utils/format";
import { WalletButton } from "@/components/wallet-button";
import type { UserProfile } from "@/types";

export function HomeSidebar() {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entriesCount, setEntriesCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!program || !publicKey) {
      setProfile(null);
      setEntriesCount(0);
      setReviewsCount(0);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const [p, entries, reviews] = await Promise.all([
          fetchUserProfile(program, publicKey),
          fetchEntriesCreatedBy(program, publicKey),
          fetchCommentsByCommenter(program, publicKey),
        ]);
        if (!alive) return;
        setProfile(p as UserProfile | null);
        setEntriesCount(entries.length);
        setReviewsCount(reviews.length);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program, publicKey]);

  if (!publicKey) {
    return (
      <aside className="border border-ink-200 bg-white">
        <div className="space-y-4 p-5">
          <h3 className="serif text-lg font-semibold text-ink-800">
            Connect wallet
          </h3>
          <p className="text-sm text-ink-600">
            ChainTrust is a public record. Connect a Solana wallet to register,
            review, or claim an entry.
          </p>
          <WalletButton />
        </div>
      </aside>
    );
  }

  if (loading && !profile) {
    return (
      <aside className="border border-ink-200 bg-white">
        <div className="p-5">
          <p className="hint">Loading profile…</p>
        </div>
      </aside>
    );
  }

  if (!profile) {
    return (
      <aside className="border border-ink-200 bg-white">
        <div className="space-y-4 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
              No profile yet
            </p>
            <p className="mono mt-1 text-xs text-ink-500">
              {shortKey(publicKey, 6)}
            </p>
          </div>
          <p className="text-sm text-ink-600">
            Register a verified user profile to create entries and submit
            reviews on-chain.
          </p>
          <Link href="/register" className="btn w-full text-center">
            Register on-chain
          </Link>
        </div>
      </aside>
    );
  }

  const initial = (profile.displayName || profile.username).slice(0, 1).toUpperCase();

  return (
    <aside className="border border-ink-200 bg-white">
      <div className="border-b border-ink-200 bg-ink-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center bg-accent text-lg font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="serif truncate text-base font-semibold text-ink-800">
              {profile.displayName || profile.username}
            </p>
            <p className="mono truncate text-xs text-ink-500">
              @{profile.username}
            </p>
          </div>
        </div>
        <p className="mono mt-3 truncate text-[11px] text-ink-500">
          {shortKey(publicKey, 6)}
        </p>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-ink-200 border-b border-ink-200 text-center text-sm">
        <div className="p-3">
          <dt className="text-xs uppercase tracking-wider text-ink-500">
            Entries
          </dt>
          <dd className="serif mt-1 text-xl font-semibold text-ink-800">
            {entriesCount}
          </dd>
        </div>
        <div className="p-3">
          <dt className="text-xs uppercase tracking-wider text-ink-500">
            Reviews
          </dt>
          <dd className="serif mt-1 text-xl font-semibold text-ink-800">
            {reviewsCount}
          </dd>
        </div>
      </dl>

      <div className="space-y-2 p-4">
        <Link
          href={`/profile/${publicKey.toBase58()}`}
          className="btn-outline w-full text-center"
        >
          View my profile
        </Link>
        <Link href="/create" className="btn-secondary w-full text-center">
          Create entry
        </Link>
      </div>
    </aside>
  );
}

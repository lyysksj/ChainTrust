"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchCommentsByCommenter,
  fetchEntitiesCreatedBy,
  fetchIssuer,
  fetchUserProfile,
} from "@/lib/anchor/client";
import { shortKey } from "@/lib/utils/format";
import { WalletButton } from "@/components/wallet-button";
import type { UserProfile } from "@/types";

export function HomeSidebar() {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entitiesCount, setEntitiesCount] = useState(0);
  const [signalsCount, setSignalsCount] = useState(0);
  const [isIssuer, setIsIssuer] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!program || !publicKey) {
      setProfile(null);
      setEntitiesCount(0);
      setSignalsCount(0);
      setIsIssuer(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const [p, entities, signals, issuer] = await Promise.all([
          fetchUserProfile(program, publicKey),
          fetchEntitiesCreatedBy(program, publicKey),
          fetchCommentsByCommenter(program, publicKey),
          fetchIssuer(program, publicKey),
        ]);
        if (!alive) return;
        setProfile(p as UserProfile | null);
        setEntitiesCount(entities.length);
        setSignalsCount(signals.length);
        setIsIssuer(!!issuer);
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
            ChainTrust is a public on-chain identity graph. Connect a Solana
            wallet to register an Entity, attest as an Issuer, or resolve a
            wallet.
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
            Register a verified user profile to create Entities, sign as an
            Issuer, or post community signals on-chain.
          </p>
          <Link href="/register" className="btn w-full text-center">
            Register on-chain
          </Link>
        </div>
      </aside>
    );
  }

  const initial = profile.username.slice(0, 1).toUpperCase();

  return (
    <aside className="border border-ink-200 bg-white">
      <div className="border-b border-ink-200 bg-ink-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center bg-accent text-lg font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="serif truncate text-base font-semibold text-ink-800">
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
            Entities
          </dt>
          <dd className="serif mt-1 text-xl font-semibold text-ink-800">
            {entitiesCount}
          </dd>
        </div>
        <div className="p-3">
          <dt className="text-xs uppercase tracking-wider text-ink-500">
            Signals
          </dt>
          <dd className="serif mt-1 text-xl font-semibold text-ink-800">
            {signalsCount}
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
          Create Entity
        </Link>
        <Link href="/resolve" className="btn-secondary w-full text-center">
          Resolve wallet → entity
        </Link>
        {!isIssuer ? (
          <Link
            href="/issuer/register"
            className="btn-secondary w-full text-center"
          >
            Become an Issuer
          </Link>
        ) : (
          <p className="hint text-center">
            ✓ Registered Issuer
          </p>
        )}
      </div>
    </aside>
  );
}

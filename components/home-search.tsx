"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import { fetchAllEntries, fetchAllUsers } from "@/lib/anchor/client";
import { bytesHex } from "@/lib/utils/format";
import type { CompanyEntry, EntryMetadata, UserProfile } from "@/types";

type EntryResult = {
  entryIdHex: string;
  pda: PublicKey;
  account: CompanyEntry;
  meta: EntryMetadata | null;
};

type UserResult = {
  pda: PublicKey;
  account: UserProfile;
};

export function HomeSearch() {
  const program = useProgram();
  const [entries, setEntries] = useState<EntryResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    if (!program) return;
    setLoading(true);
    (async () => {
      try {
        const [rawEntries, rawUsers] = await Promise.all([
          fetchAllEntries(program),
          fetchAllUsers(program),
        ]);
        if (!alive) return;

        const withMeta = await Promise.all(
          rawEntries.map(async (e) => {
            const account = e.account as unknown as CompanyEntry;
            const entryIdHex = bytesHex(account.entryId);
            let meta: EntryMetadata | null = null;
            if (account.metadataUri) {
              try {
                const resp = await fetch(
                  `/api/mock/fetch?uri=${encodeURIComponent(account.metadataUri)}`,
                );
                if (resp.ok) {
                  const text = await resp.text();
                  try {
                    meta = JSON.parse(text) as EntryMetadata;
                  } catch {
                    /* ignore */
                  }
                }
              } catch {
                /* ignore */
              }
            }
            return {
              entryIdHex,
              pda: e.publicKey,
              account,
              meta,
            };
          }),
        );
        if (!alive) return;
        setEntries(withMeta);
        setUsers(
          rawUsers.map((u) => ({
            pda: u.publicKey,
            account: u.account as unknown as UserProfile,
          })),
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const q = query.trim().toLowerCase();

  const matchedEntries = useMemo(() => {
    if (!q) return [];
    return entries
      .filter((e) => {
        const legal = (e.meta?.legalName ?? "").toLowerCase();
        const project = (e.meta?.projectName ?? "").toLowerCase();
        const sites = (e.meta?.websites ?? []).join(" ").toLowerCase();
        return (
          legal.includes(q) || project.includes(q) || sites.includes(q)
        );
      })
      .slice(0, 8);
  }, [q, entries]);

  const matchedUsers = useMemo(() => {
    if (!q) return [];
    return users
      .filter((u) => u.account.username.toLowerCase().includes(q))
      .slice(0, 6);
  }, [q, users]);

  const hasResults = matchedEntries.length + matchedUsers.length > 0;

  return (
    <div ref={boxRef} className="relative">
      <label className="sr-only" htmlFor="home-search">
        Search
      </label>
      <input
        id="home-search"
        className="input h-12 text-base"
        placeholder={
          program
            ? "Search companies or people…"
            : "Connect wallet to enable search"
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        disabled={!program}
      />

      {open && query && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[28rem] overflow-y-auto border border-ink-200 bg-white shadow-lg">
          {loading && entries.length === 0 ? (
            <p className="hint p-4">Loading…</p>
          ) : !hasResults ? (
            <div className="space-y-2 p-4">
              <p className="hint">No matches for "{query}".</p>
              <Link
                href="/create"
                className="block text-sm text-accent hover:underline"
                onClick={() => setOpen(false)}
              >
                → Create a new entry for "{query}"
              </Link>
            </div>
          ) : (
            <div>
              {matchedEntries.length > 0 && (
                <section>
                  <p className="bg-ink-50 px-4 py-2 text-xs uppercase tracking-wider text-ink-500">
                    Companies · {matchedEntries.length}
                  </p>
                  <ul>
                    {matchedEntries.map((e) => (
                      <li key={e.pda.toBase58()}>
                        <Link
                          href={`/entry/${e.entryIdHex}`}
                          className="block border-b border-ink-100 px-4 py-3 hover:bg-ink-50"
                          onClick={() => setOpen(false)}
                        >
                          <p className="serif text-sm font-semibold text-ink-800">
                            {e.meta?.projectName ??
                              e.meta?.legalName ??
                              "(unnamed)"}
                          </p>
                          <p className="text-xs text-ink-500">
                            {e.meta?.legalName}
                            {e.meta?.websites?.[0]
                              ? ` · ${e.meta.websites[0]}`
                              : ""}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {matchedUsers.length > 0 && (
                <section>
                  <p className="bg-ink-50 px-4 py-2 text-xs uppercase tracking-wider text-ink-500">
                    People · {matchedUsers.length}
                  </p>
                  <ul>
                    {matchedUsers.map((u) => (
                      <li key={u.pda.toBase58()}>
                        <Link
                          href={`/profile/${u.account.wallet.toBase58()}`}
                          className="block border-b border-ink-100 px-4 py-3 hover:bg-ink-50"
                          onClick={() => setOpen(false)}
                        >
                          <p className="text-sm font-semibold text-ink-800">
                            @{u.account.username}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

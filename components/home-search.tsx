"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import { fetchAllEntities, fetchAllUsers } from "@/lib/anchor/client";
import { bytesHex } from "@/lib/utils/format";
import { entityIdToCtNumber } from "@/lib/utils/ct-number";
import type { Entity, EntityMetadata, UserProfile } from "@/types";

type EntityResult = {
  entityIdHex: string;
  ctNumber: string;
  pda: PublicKey;
  account: Entity;
  meta: EntityMetadata | null;
};

type UserResult = {
  pda: PublicKey;
  account: UserProfile;
};

export function HomeSearch() {
  const program = useProgram();
  const [entities, setEntities] = useState<EntityResult[]>([]);
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
        const [rawEntities, rawUsers] = await Promise.all([
          fetchAllEntities(program),
          fetchAllUsers(program),
        ]);
        if (!alive) return;

        const withMeta = await Promise.all(
          rawEntities.map(async (e) => {
            const account = e.account as unknown as Entity;
            const entityIdHex = bytesHex(account.entityId);
            const ctNumber = entityIdToCtNumber(account.entityId);
            let meta: EntityMetadata | null = null;
            if (account.metadataUri) {
              try {
                const resp = await fetch(
                  `/api/mock/fetch?uri=${encodeURIComponent(account.metadataUri)}`,
                );
                if (resp.ok) {
                  const text = await resp.text();
                  try {
                    meta = JSON.parse(text) as EntityMetadata;
                  } catch {
                    /* ignore */
                  }
                }
              } catch {
                /* ignore */
              }
            }
            return {
              entityIdHex,
              ctNumber,
              pda: e.publicKey,
              account,
              meta,
            };
          }),
        );
        if (!alive) return;
        setEntities(withMeta);
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

  const matchedEntities = useMemo(() => {
    if (!q) return [];
    return entities
      .filter((e) => {
        const legal = (e.meta?.legalName ?? "").toLowerCase();
        const sites = (e.meta?.websites ?? []).join(" ").toLowerCase();
        const ct = e.ctNumber.toLowerCase();
        return legal.includes(q) || sites.includes(q) || ct.includes(q);
      })
      .slice(0, 8);
  }, [q, entities]);

  const matchedUsers = useMemo(() => {
    if (!q) return [];
    return users
      .filter((u) => u.account.username.toLowerCase().includes(q))
      .slice(0, 6);
  }, [q, users]);

  const hasResults = matchedEntities.length + matchedUsers.length > 0;

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
            ? "Search by name, domain, CT-Number, or username…"
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
          {loading && entities.length === 0 ? (
            <p className="hint p-4">Loading…</p>
          ) : !hasResults ? (
            <div className="space-y-2 p-4">
              <p className="hint">No matches for "{query}".</p>
              <Link
                href="/create"
                className="block text-sm text-accent hover:underline"
                onClick={() => setOpen(false)}
              >
                → Create a new Entity for "{query}"
              </Link>
            </div>
          ) : (
            <div>
              {matchedEntities.length > 0 && (
                <section>
                  <p className="bg-ink-50 px-4 py-2 text-xs uppercase tracking-wider text-ink-500">
                    Entities · {matchedEntities.length}
                  </p>
                  <ul>
                    {matchedEntities.map((e) => (
                      <li key={e.pda.toBase58()}>
                        <Link
                          href={`/entry/${e.entityIdHex}`}
                          className="block border-b border-ink-100 px-4 py-3 hover:bg-ink-50"
                          onClick={() => setOpen(false)}
                        >
                          <p className="serif text-sm font-semibold text-ink-800">
                            {e.meta?.legalName ?? "(unnamed)"}
                          </p>
                          <p className="text-xs text-ink-500">
                            <span className="mono">{e.ctNumber}</span>
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

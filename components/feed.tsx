"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllEntities,
  fetchAllIssuers,
  fetchAllRelationships,
} from "@/lib/anchor/client";
import { bytesHex, formatTimestamp, shortHash, shortKey } from "@/lib/utils/format";
import {
  ISSUER_KIND_LABELS,
  REL_KIND_META,
} from "@/types";
import type { Entity, EntityMetadata, Issuer, Relationship } from "@/types";

const MAX_ITEMS = 30;

type FeedItem = {
  pda: PublicKey;
  rel: Relationship;
  entityName: string | null;
  entityIdHex: string;
  issuerName: string | null;
  issuerTier: number;
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
        const [rawRels, rawEntities, rawIssuers] = await Promise.all([
          fetchAllRelationships(program),
          fetchAllEntities(program),
          fetchAllIssuers(program),
        ]);
        if (!alive) return;

        const entityByPda = new Map<
          string,
          { idHex: string; metaUri: string }
        >();
        for (const e of rawEntities) {
          const acc = e.account as unknown as Entity;
          entityByPda.set(e.publicKey.toBase58(), {
            idHex: bytesHex(acc.entityId),
            metaUri: acc.metadataUri,
          });
        }

        const issuerByPda = new Map<string, Issuer>();
        for (const i of rawIssuers) {
          issuerByPda.set(i.publicKey.toBase58(), i.account as unknown as Issuer);
        }

        const sorted = rawRels
          .map((r) => ({
            publicKey: r.publicKey,
            account: r.account as unknown as Relationship,
          }))
          .sort(
            (a, b) =>
              Number(b.account.createdAt) - Number(a.account.createdAt),
          )
          .slice(0, MAX_ITEMS);

        const metaByUri = new Map<string, EntityMetadata | null>();
        async function loadMeta(uri: string) {
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
            const parsed = JSON.parse(text) as EntityMetadata;
            metaByUri.set(uri, parsed);
            return parsed;
          } catch {
            metaByUri.set(uri, null);
            return null;
          }
        }

        const hydrated = await Promise.all(
          sorted.map(async (r) => {
            const entityInfo = entityByPda.get(r.account.entity.toBase58());
            const meta = entityInfo ? await loadMeta(entityInfo.metaUri) : null;
            const iss = issuerByPda.get(r.account.issuer.toBase58());
            return {
              pda: r.publicKey,
              rel: r.account,
              entityIdHex: entityInfo?.idHex ?? "",
              entityName: meta?.legalName ?? null,
              issuerName: iss
                ? ISSUER_KIND_LABELS[iss.kind] ?? "Issuer"
                : null,
              issuerTier: iss?.trustTier ?? 3,
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
        <p className="hint">Connect a wallet to load the on-chain attestation feed.</p>
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
          No attestations on-chain yet. Register an Entity, become an Issuer,
          and sign the first relationship.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <FeedCard key={item.pda.toBase58()} item={item} />
      ))}
    </ul>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const meta = REL_KIND_META[item.rel.kind];
  const revoked = Number(item.rel.revokedAt) > 0;
  const tierClass =
    item.issuerTier === 1
      ? "chip chip-verified"
      : item.issuerTier === 2
        ? "chip chip-creator"
        : "chip chip-community";
  return (
    <li className="border border-ink-200 bg-white">
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span className={tierClass}>
            T{item.issuerTier} {item.issuerName ?? "Issuer"}
          </span>
          <span>attested</span>
          <span className="font-medium text-ink-700">
            {meta?.label ?? "Relationship"}
          </span>
          <span>for</span>
          {item.entityIdHex ? (
            <Link
              href={`/entry/${item.entityIdHex}`}
              className="serif text-sm font-semibold text-accent hover:underline"
            >
              {item.entityName ?? "(unnamed entity)"}
            </Link>
          ) : (
            <span className="serif text-sm font-semibold text-ink-700">
              {item.entityName ?? "(unknown entity)"}
            </span>
          )}
          <span className="ml-auto">{formatTimestamp(item.rel.createdAt)}</span>
        </div>
        <div className="text-sm text-ink-700">
          target <span className="mono">{shortKey(new PublicKey(Buffer.from(item.rel.targetRef)))}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
          {Number(item.rel.validUntil) > 0 ? (
            <span>valid until {formatTimestamp(item.rel.validUntil)}</span>
          ) : (
            <span>no expiry</span>
          )}
          {revoked && (
            <span className="font-semibold text-red-700">
              revoked {formatTimestamp(item.rel.revokedAt)}
            </span>
          )}
          <span className="mono ml-auto">
            ev {shortHash(item.rel.evidenceHash)}
          </span>
        </div>
      </div>
    </li>
  );
}

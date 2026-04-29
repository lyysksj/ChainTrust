"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllEntities,
  fetchAllIssuers,
  fetchEntityByPda,
  fetchRelationshipsForEntity,
  fetchRelationshipsForTargetWallet,
} from "@/lib/anchor/client";
import { entityIdToCtNumber } from "@/lib/utils/ct-number";
import { bytesHex, formatTimestamp } from "@/lib/utils/format";
import { Stamp, StatusPill } from "@/components/registry-bits";
import { RelRowCompact } from "@/components/rel-row";
import { COUNTRIES } from "@/types";
import type {
  Entity,
  EntityMetadata,
  Issuer,
  Relationship,
} from "@/types";

export default function ResolveRoute() {
  return (
    <Suspense fallback={<p className="hint">Loading resolve…</p>}>
      <ResolvePage />
    </Suspense>
  );
}

type ResolveResult = {
  matchType: string;
  entity: Entity;
  pda: PublicKey;
  meta: EntityMetadata | null;
  ctNumber: string;
  entityIdHex: string;
  hits: { publicKey: PublicKey; account: Relationship }[];
  rels: { publicKey: PublicKey; account: Relationship }[];
} | null;

function ResolvePage() {
  const program = useProgram();
  const router = useRouter();
  const params = useSearchParams();
  const initialQuery = params.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolveResult>(null);
  const [issuers, setIssuers] = useState<Map<string, Issuer>>(new Map());

  useEffect(() => {
    if (initialQuery && initialQuery !== submitted) {
      setQuery(initialQuery);
      setSubmitted(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    if (!program) return;
    if (!submitted.trim()) {
      setResult(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setResult(null);
    (async () => {
      try {
        const q = submitted.trim();
        const [allEntities, allIssuersRaw] = await Promise.all([
          fetchAllEntities(program),
          fetchAllIssuers(program),
        ]);
        const issuerMap = new Map<string, Issuer>();
        for (const i of allIssuersRaw) {
          issuerMap.set(
            i.publicKey.toBase58(),
            i.account as unknown as Issuer,
          );
        }
        if (alive) setIssuers(issuerMap);

        // 1) match by CT-Number directly
        const upperQ = q.toUpperCase();
        const byCt = allEntities.find((e) => {
          const acc = e.account as unknown as Entity;
          return entityIdToCtNumber(acc.entityId).toUpperCase() === upperQ;
        });
        if (byCt) {
          const acc = byCt.account as unknown as Entity;
          const rels = await fetchRelationshipsForEntity(
            program,
            byCt.publicKey,
          );
          if (!alive) return;
          const meta = await loadMeta(acc.metadataUri);
          setResult({
            matchType: "CT-NUMBER",
            entity: acc,
            pda: byCt.publicKey,
            meta,
            ctNumber: entityIdToCtNumber(acc.entityId),
            entityIdHex: bytesHex(acc.entityId),
            hits: [],
            rels: rels.map((r) => ({
              publicKey: r.publicKey,
              account: r.account as unknown as Relationship,
            })),
          });
          return;
        }

        // 2) try as a base58 pubkey -> wallet / project / entity match
        let pk: PublicKey | null = null;
        try {
          pk = new PublicKey(q);
        } catch {
          pk = null;
        }
        if (pk) {
          const hitsRaw = await fetchRelationshipsForTargetWallet(program, pk);
          if (hitsRaw.length > 0) {
            const hits = hitsRaw.map((r) => ({
              publicKey: r.publicKey,
              account: r.account as unknown as Relationship,
            }));
            const entityKey = hits[0].account.entity;
            const entityAccount = (await fetchEntityByPda(
              program,
              entityKey,
            )) as Entity | null;
            if (!entityAccount) {
              setError("Target found but entity is missing.");
              return;
            }
            const allRelsRaw = await fetchRelationshipsForEntity(
              program,
              entityKey,
            );
            const meta = await loadMeta(entityAccount.metadataUri);
            if (!alive) return;
            const matchType =
              hits[0].account.kind === 1
                ? "PROJECT REF"
                : hits[0].account.kind === 4
                  ? "DOMAIN"
                  : hits[0].account.kind === 5 || hits[0].account.kind === 6
                    ? "ENTITY REF"
                    : "WALLET";
            setResult({
              matchType,
              entity: entityAccount,
              pda: entityKey,
              meta,
              ctNumber: entityIdToCtNumber(entityAccount.entityId),
              entityIdHex: bytesHex(entityAccount.entityId),
              hits,
              rels: allRelsRaw.map((r) => ({
                publicKey: r.publicKey,
                account: r.account as unknown as Relationship,
              })),
            });
            return;
          }
        }

        if (!alive) return;
        setResult(null);
      } catch (err) {
        if (alive)
          setError((err as Error).message ?? "Resolve failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program, submitted, refreshKey]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setSubmitted(query.trim());
    if (query.trim()) {
      router.replace(`/resolve?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.replace(`/resolve`);
    }
  }

  const samples = [
    { label: "CT-Number", value: "CT-XXXX-XXXX" },
    { label: "Wallet pubkey", value: "44-char base58" },
    { label: "Domain", value: "example.com" },
  ];

  const country = result
    ? COUNTRIES.find((c) => c.code === result.entity.jurisdiction)
    : null;

  return (
    <div data-screen="02 Resolve">
      <div className="docnum" style={{ marginBottom: 8 }}>
        FORM CT-RES · 2026 EDITION
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          Resolve to entity.
        </h2>
        <span className="section-meta">
          getProgramAccounts · target_ref filter
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--serif)",
          fontSize: 17,
          color: "var(--ink-2)",
          maxWidth: "70ch",
          marginTop: -8,
          marginBottom: 28,
        }}
      >
        Paste any wallet pubkey, contract PDA, domain, or CT-Number. The
        registry returns the operating Entity, the chain of signed evidence,
        and the issuer behind every edge.
      </p>

      <form onSubmit={submit} style={{ marginBottom: 24 }}>
        <div className="resolve-bar">
          <span className="resolve-bar-icon">›_</span>
          <input
            autoFocus
            placeholder="44-char Solana pubkey, domain, or CT-XXXX-XXXX…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-stamp">
            Resolve
          </button>
        </div>
        <div className="resolve-suggest">
          <span>HINT:</span>
          {samples.map((s) => (
            <span
              key={s.label}
              style={{
                padding: "3px 8px",
                background: "var(--paper-2)",
                border: "1px solid var(--rule)",
                color: "var(--ink-3)",
              }}
            >
              {s.label} · {s.value}
            </span>
          ))}
        </div>
      </form>

      {!program && (
        <div className="no-result">
          CONNECT A WALLET TO QUERY THE REGISTRY.
        </div>
      )}

      {loading && (
        <div className="no-result">RESOLVING · QUERYING SOLANA…</div>
      )}

      {error && (
        <div className="no-result">
          ERROR · {error.toUpperCase()}
        </div>
      )}

      {!loading && !error && submitted && !result && program && (
        <div className="no-result">
          NO MATCH IN REGISTRY · No issuer has filed a relationship with that
          target_ref.
          <br />
          <span style={{ color: "var(--ink-4)" }}>
            This is not a verdict — only the absence of a record.
          </span>
        </div>
      )}

      {result && (
        <>
          <div className="resolve-result">
            <div className="resolve-result-h">
              <span className="label-stamp">
                ◆ MATCH FOUND · {result.matchType}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  letterSpacing: "0.1em",
                }}
              >
                Resolved in 1 RPC call · {result.hits.length || result.rels.length}{" "}
                signed edges
              </span>
            </div>
            <div className="resolve-result-body">
              <div>
                <div className="ct-line">{result.ctNumber}</div>
                <h2>{result.meta?.legalName ?? "(metadata pending)"}</h2>
                <div className="meta-line">
                  {result.meta?.registryId ?? "—"} ·{" "}
                  {(country?.label ?? result.entity.jurisdiction).toUpperCase()}{" "}
                  · FILED {formatTimestamp(result.entity.createdAt)}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <StatusPill
                    status={result.entity.status}
                    claimed={result.entity.isClaimed}
                  />
                </div>
                {result.meta?.description && (
                  <p
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 15,
                      color: "var(--ink-2)",
                      margin: "0 0 18px",
                      maxWidth: "60ch",
                    }}
                  >
                    {result.meta.description}
                  </p>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => router.push(`/entry/${result.entityIdHex}`)}
                >
                  Open full identity graph →
                </button>
              </div>
              <Stamp
                text="Verified"
                sub={`CT · ${result.ctNumber.slice(3, 10)}`}
              />
            </div>
          </div>

          {result.hits.length > 0 && (
            <>
              <div className="section-h">
                <h2 className="section-title" style={{ fontSize: 20 }}>
                  Edges signed against your query
                </h2>
                <span className="section-meta">
                  {result.hits.length} match
                  {result.hits.length !== 1 ? "es" : ""}
                </span>
              </div>
              <div className="rel-list" style={{ marginBottom: 32 }}>
                {result.hits.map((h) => (
                  <RelRowCompact
                    key={h.publicKey.toBase58()}
                    pda={h.publicKey}
                    rel={h.account}
                    issuer={
                      issuers.get(h.account.issuer.toBase58()) ?? null
                    }
                    onRevoked={() => setRefreshKey((k) => k + 1)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="section-h">
            <h2 className="section-title" style={{ fontSize: 20 }}>
              Full evidence chain · {result.ctNumber}
            </h2>
            <span className="section-meta">
              {result.rels.length} relationship
              {result.rels.length !== 1 ? "s" : ""} ·{" "}
              {result.rels.filter(
                (r) => Number(r.account.revokedAt) > 0,
              ).length}{" "}
              revoked
            </span>
          </div>
          <div className="rel-list">
            {result.rels.map((h) => (
              <RelRowCompact
                key={h.publicKey.toBase58()}
                pda={h.publicKey}
                rel={h.account}
                issuer={issuers.get(h.account.issuer.toBase58()) ?? null}
                onRevoked={() => setRefreshKey((k) => k + 1)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

async function loadMeta(uri: string): Promise<EntityMetadata | null> {
  if (!uri) return null;
  try {
    const resp = await fetch(`/api/mock/fetch?uri=${encodeURIComponent(uri)}`);
    if (!resp.ok) return null;
    return JSON.parse(await resp.text()) as EntityMetadata;
  } catch {
    return null;
  }
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Connection, PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllIssuers,
  fetchEntitiesByIdPrefix,
  fetchEntityByPda,
  fetchRelationshipsForEntity,
  fetchRelationshipsForTargetHash,
  fetchRelationshipsForTargetWallet,
} from "@/lib/anchor/client";
import { sha256Bytes } from "@/lib/utils/hash";
import { ctNumberToPrefixBytes, entityIdToCtNumber } from "@/lib/utils/ct-number";
import { bytesHex, formatTimestamp, shortKey } from "@/lib/utils/format";
import { Stamp, StatusPill } from "@/components/registry-bits";
import { RelRowCompact } from "@/components/rel-row";
import { COUNTRIES } from "@/types";
import type {
  Entity,
  EntityMetadata,
  Issuer,
  Relationship,
} from "@/types";
import {
  sasCredentialAuthority,
  SAS_SCHEMA_NAMES,
} from "@/lib/sas/config";
import { sasCredentialPda } from "@/lib/sas/pdas";
import {
  fetchSasAttestationsByCredential,
  filterSasByEntity,
  type SasAttestationRecord,
} from "@/lib/sas/reader";
import { useT } from "@/lib/i18n";

export default function ResolveRoute() {
  return (
    <Suspense fallback={<ResolveFallback />}>
      <ResolvePage />
    </Suspense>
  );
}

function ResolveFallback() {
  const t = useT();
  return <p className="hint">{t("resolve.suspenseFallback")}</p>;
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
  const t = useT();

  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolveResult>(null);
  const [issuers, setIssuers] = useState<Map<string, Issuer>>(new Map());
  const [sasRecords, setSasRecords] = useState<SasAttestationRecord[]>([]);
  const { connection } = useConnection();

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
        const allIssuersRaw = await fetchAllIssuers(program);
        const issuerMap = new Map<string, Issuer>();
        for (const i of allIssuersRaw) {
          issuerMap.set(
            i.publicKey.toBase58(),
            i.account as unknown as Issuer,
          );
        }
        if (alive) setIssuers(issuerMap);

        // 1) match by CT-Number directly. The CT-Number is derived from the
        // first 5 bytes of entity_id, so we narrow with a 5-byte memcmp filter
        // on entity_id before enumerating — bounded RPC payload regardless of
        // how many entities exist on chain.
        const upperQ = q.toUpperCase();
        const ctMatch = /^CT-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(upperQ);
        let byCt:
          | {
              publicKey: PublicKey;
              account: Entity;
            }
          | null = null;
        if (ctMatch) {
          let prefix: number[];
          try {
            prefix = ctNumberToPrefixBytes(upperQ);
          } catch {
            prefix = [];
          }
          if (prefix.length === 5) {
            const candidates = await fetchEntitiesByIdPrefix(program, prefix);
            for (const e of candidates) {
              const acc = e.account as unknown as Entity;
              if (entityIdToCtNumber(acc.entityId).toUpperCase() === upperQ) {
                byCt = { publicKey: e.publicKey, account: acc };
                break;
              }
            }
          }
        }
        if (byCt) {
          const acc = byCt.account;
          const rels = await fetchRelationshipsForEntity(
            program,
            byCt.publicKey,
          );
          if (!alive) return;
          const meta = await loadMeta(acc.metadataUri);
          setResult({
            matchType: t("resolve.match.kind.ctNumber"),
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
              setError(t("resolve.targetMissing"));
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
                ? t("resolve.match.kind.project")
                : hits[0].account.kind === 5 || hits[0].account.kind === 6
                  ? t("resolve.match.kind.entity")
                  : t("resolve.match.kind.wallet");
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

        // 3) try as a domain — normalize and SHA-256 hash, then query by
        // target_ref. We accept inputs like `acme.xyz`, `https://acme.xyz/`,
        // `https://www.acme.xyz` and reduce to a canonical hostname.
        const looksLikeDomain = !pk && /\./.test(q) && q.length <= 253;
        if (looksLikeDomain) {
          const domain = normalizeDomain(q);
          if (domain) {
            const hash = sha256Bytes(domain);
            const hitsRaw = await fetchRelationshipsForTargetHash(
              program,
              hash,
            );
            // Only kind=4 (HAS_DOMAIN) targets are domains, but other kinds
            // could in principle reuse the same hash; filter to kind=4 to
            // avoid false positives.
            const domainHits = hitsRaw.filter(
              (r) => (r.account as unknown as Relationship).kind === 4,
            );
            if (domainHits.length > 0) {
              const hits = domainHits.map((r) => ({
                publicKey: r.publicKey,
                account: r.account as unknown as Relationship,
              }));
              const entityKey = hits[0].account.entity;
              const entityAccount = (await fetchEntityByPda(
                program,
                entityKey,
              )) as Entity | null;
              if (!entityAccount) {
                setError(t("resolve.domainMissing"));
                return;
              }
              const allRelsRaw = await fetchRelationshipsForEntity(
                program,
                entityKey,
              );
              const meta = await loadMeta(entityAccount.metadataUri);
              if (!alive) return;
              setResult({
                matchType: `${t("resolve.match.kind.domain")} · ${domain}`,
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
        }

        if (!alive) return;
        setResult(null);
      } catch (err) {
        if (alive)
          setError((err as Error).message ?? t("resolve.failed"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program, submitted, refreshKey]);

  // Path D — fetch SAS attestations once we have a resolved entity. Reads
  // are cheap (one getProgramAccounts) and run independently from the main
  // resolve effect so a missing/unconfigured SAS Credential doesn't block
  // the primary flow.
  useEffect(() => {
    if (!connection || !result?.entity) {
      setSasRecords([]);
      return;
    }
    const credAuthority = sasCredentialAuthority();
    if (!credAuthority) {
      setSasRecords([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const credential = sasCredentialPda(credAuthority);
        const all = await fetchSasAttestationsByCredential(
          connection as Connection,
          credential,
        );
        if (!alive) return;
        setSasRecords(filterSasByEntity(all, result.pda));
      } catch (err) {
        // SAS bootstrap may not have run yet; silent fall-back.
        console.warn("SAS read failed:", err);
        if (alive) setSasRecords([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [connection, result?.pda, refreshKey]);

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
    { label: t("resolve.sample.ctNumber"), value: "CT-XXXX-XXXX" },
    { label: t("resolve.sample.wallet"), value: t("resolve.sample.walletVal") },
    { label: t("resolve.sample.domain"), value: "example.com" },
  ];

  const country = result
    ? COUNTRIES.find((c) => c.code === result.entity.jurisdiction)
    : null;

  return (
    <div data-screen="02 Resolve">
      <div className="docnum" style={{ marginBottom: 8 }}>
        {t("resolve.docnum")}
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          {t("resolve.title")}
        </h2>
        <span className="section-meta">{t("resolve.meta")}</span>
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
        {t("resolve.intro")}
      </p>

      <form onSubmit={submit} style={{ marginBottom: 24 }}>
        <div className="resolve-bar">
          <span className="resolve-bar-icon">›_</span>
          <input
            autoFocus
            placeholder={t("resolve.input.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-stamp">
            {t("resolve.submit")}
          </button>
        </div>
        <div className="resolve-suggest">
          <span>{t("resolve.hint")}</span>
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

      {loading && (
        <div className="no-result">{t("resolve.loading")}</div>
      )}

      {error && (
        <div className="no-result">
          {t("common.errorPrefix")} · {error.toUpperCase()}
        </div>
      )}

      {!loading && !error && submitted && !result && program && (
        <div className="no-result">
          {t("resolve.noMatch.lead")}
          <br />
          <span style={{ color: "var(--ink-4)" }}>
            {t("resolve.noMatch.note")}
          </span>
        </div>
      )}

      {result && (
        <>
          <div className="resolve-result">
            <div className="resolve-result-h">
              <span className="label-stamp">
                {t("resolve.match.found")} · {result.matchType}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  letterSpacing: "0.1em",
                }}
              >
                {t("resolve.match.resolved")}{" "}
                {result.hits.length || result.rels.length}{" "}
                {t("resolve.match.signedEdges")}
              </span>
            </div>
            <div className="resolve-result-body">
              <div>
                <div className="ct-line">{result.ctNumber}</div>
                <h2>{result.meta?.legalName ?? t("resolve.match.metaPending")}</h2>
                <div className="meta-line">
                  {result.meta?.registryIdHashHex
                    ? `id·0x${result.meta.registryIdHashHex.slice(0, 8)}…`
                    : "—"}{" "}
                  ·{" "}
                  {(country?.label ?? result.entity.jurisdiction).toUpperCase()}{" "}
                  · {t("resolve.match.filed")} {formatTimestamp(result.entity.createdAt)}
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
                  {t("resolve.match.openGraph")}
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
                  {t("resolve.edges.title")}
                </h2>
                <span className="section-meta">
                  {result.hits.length}{" "}
                  {result.hits.length !== 1
                    ? t("resolve.edges.matches.many")
                    : t("resolve.edges.matches.one")}
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
              {t("resolve.chain.title")} {result.ctNumber}
            </h2>
            <span className="section-meta">
              {result.rels.length}{" "}
              {result.rels.length !== 1
                ? t("resolve.chain.relationships.many")
                : t("resolve.chain.relationships.one")}{" "}
              ·{" "}
              {result.rels.filter(
                (r) => Number(r.account.revokedAt) > 0,
              ).length}{" "}
              {t("resolve.chain.revoked")}
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

          {/* Path D — Cross-program SAS view */}
          <SasMirrorSection records={sasRecords} ctNumber={result.ctNumber} />
        </>
      )}
    </div>
  );
}

function SasMirrorSection({
  records,
  ctNumber,
}: {
  records: SasAttestationRecord[];
  ctNumber: string;
}) {
  const t = useT();
  if (records.length === 0) {
    return (
      <div style={{ marginTop: 32 }}>
        <div className="section-h">
          <h2 className="section-title" style={{ fontSize: 20 }}>
            {t("resolve.sas.title")}
          </h2>
          <span className="section-meta">{t("resolve.sas.metaEmpty")}</span>
        </div>
        <div className="no-result">
          {t("resolve.sas.empty.lead")} {ctNumber}.
          <br />
          <span style={{ color: "var(--ink-4)" }}>
            {t("resolve.sas.empty.note")}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 32 }}>
      <div className="section-h">
        <h2 className="section-title" style={{ fontSize: 20 }}>
          {t("resolve.sas.title")}
        </h2>
        <span className="section-meta">
          {records.length}{" "}
          {records.length !== 1
            ? t("resolve.sas.metaSome.many")
            : t("resolve.sas.metaSome.one")}{" "}
          · {t("resolve.sas.metaSome.tail")}
        </span>
      </div>
      <div className="rel-list">
        {records.map((r) => {
          const kind = r.decoded?.kind ?? 0;
          const label = SAS_SCHEMA_NAMES[kind] ?? `KIND_${kind}`;
          const revoked =
            r.decoded ? Number(r.decoded.revokedAt) > 0 : false;
          return (
            <div
              key={r.pda.toBase58()}
              className={`rel-row ${revoked ? "revoked" : ""}`}
              style={{
                gridTemplateColumns: "140px 1fr 200px 120px",
              }}
            >
              <div className="rel-kind">SAS · {label}</div>
              <div>
                <div className="rel-target">{t("resolve.sas.row.attestation")}</div>
                <div className="rel-target-sub">
                  PDA · {shortKey(r.pda, 6)} · NONCE ·{" "}
                  {shortKey(r.nonce, 6)}
                </div>
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-2)",
                  letterSpacing: "0.04em",
                }}
              >
                {t("resolve.sas.row.signer")} {shortKey(r.signer, 6)}
              </div>
              <div className="rel-validity">
                <span>{t("resolve.sas.row.expiry")}</span>
                <span className="v-date">
                  {r.expiry > 0 ? formatTimestamp(r.expiry) : t("resolve.sas.row.open")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--ink-3)",
          letterSpacing: "0.04em",
          marginTop: 12,
        }}
      >
        SOURCE · 22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG · sas-lib v1
      </p>
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

/**
 * Reduce a user-input string to a canonical hostname for hashing.
 * Returns null if the input cannot reasonably be parsed as a domain.
 *
 * Conventions for the registry:
 *   - lowercase
 *   - strip protocol, path, query, fragment, port
 *   - strip leading "www."
 *   - require at least one dot and ASCII / dash / dot only
 */
function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  // Try URL parsing if it looks protocol-prefixed.
  if (/^[a-z]+:\/\//.test(s)) {
    try {
      const u = new URL(s);
      s = u.hostname;
    } catch {
      // fall through to manual cleanup
    }
  }
  // Strip path / query / fragment / port if any survived.
  s = s.split("/")[0].split("?")[0].split("#")[0].split(":")[0];
  // Strip leading "www."
  if (s.startsWith("www.")) s = s.slice(4);
  // Validate
  if (!s.includes(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  if (s.length > 253) return null;
  return s;
}

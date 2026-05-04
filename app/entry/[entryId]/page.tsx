"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllIssuers,
  fetchCommentsForEntity,
  fetchEntityByPda,
  fetchProjectsForEntity,
  fetchRelationshipsForEntity,
} from "@/lib/anchor/client";
import { entityPda } from "@/lib/anchor/pdas";
import { entityIdToCtNumber } from "@/lib/utils/ct-number";
import {
  bytesHex,
  formatTimestamp,
  shortHash,
  shortKey,
} from "@/lib/utils/format";
import { Stamp, StatusPill, Toast } from "@/components/registry-bits";
import { RelRowCompact } from "@/components/rel-row";
import { IdentityGraph } from "@/components/identity-graph";
import { ReviewList } from "@/components/review-list";
import { CommentForm } from "@/components/comment-form";
import { AddProjectForm } from "@/components/add-project-form";
import { ClaimCard } from "@/components/claim-card";
import { COMMENT_RELATION_LABELS, COUNTRIES } from "@/types";
import { useT } from "@/lib/i18n";
import type {
  CommentRecord,
  Entity,
  EntityMetadata,
  Issuer,
  Project,
  ProjectMetadata,
  Relationship,
} from "@/types";

type Params = { entryId: string };
type Tab = "graph" | "rels" | "projects" | "signals" | "raw";

function hexToBytes(hex: string): number[] | null {
  if (hex.length !== 16) return null;
  const out = new Array<number>(8);
  for (let i = 0; i < 8; i++) {
    const b = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(b)) return null;
    out[i] = b;
  }
  return out;
}

export default function EntityPage({ params }: { params: Params }) {
  const program = useProgram();
  const router = useRouter();
  const { publicKey } = useWallet();
  const t = useT();
  const [tab, setTab] = useState<Tab>("graph");
  const [toast, setToast] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const idBytes = useMemo(() => hexToBytes(params.entryId), [params.entryId]);
  const pda = useMemo(() => (idBytes ? entityPda(idBytes)[0] : null), [idBytes]);
  const ctNumber = useMemo(
    () => (idBytes ? entityIdToCtNumber(idBytes) : null),
    [idBytes],
  );

  const [entity, setEntity] = useState<Entity | null>(null);
  const [projects, setProjects] = useState<
    { publicKey: PublicKey; account: Project }[]
  >([]);
  const [projectMeta, setProjectMeta] = useState<
    Record<string, ProjectMetadata | null>
  >({});
  const [rels, setRels] = useState<
    { publicKey: PublicKey; account: Relationship }[]
  >([]);
  const [comments, setComments] = useState<
    { publicKey: PublicKey; account: CommentRecord }[]
  >([]);
  const [issuers, setIssuers] = useState<Map<string, Issuer>>(new Map());
  const [meta, setMeta] = useState<EntityMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    if (!program || !pda) return;
    const e = (await fetchEntityByPda(program, pda)) as Entity | null;
    if (!e) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setEntity(e);
    const [p, r, c, allIssuersRaw] = await Promise.all([
      fetchProjectsForEntity(program, pda),
      fetchRelationshipsForEntity(program, pda),
      fetchCommentsForEntity(program, pda),
      fetchAllIssuers(program),
    ]);
    setProjects(
      p.map((x) => ({
        publicKey: x.publicKey,
        account: x.account as unknown as Project,
      })),
    );
    setRels(
      r.map((x) => ({
        publicKey: x.publicKey,
        account: x.account as unknown as Relationship,
      })),
    );
    setComments(
      c.map((x) => ({
        publicKey: x.publicKey,
        account: x.account as unknown as CommentRecord,
      })),
    );
    const issuerMap = new Map<string, Issuer>();
    for (const i of allIssuersRaw)
      issuerMap.set(i.publicKey.toBase58(), i.account as unknown as Issuer);
    setIssuers(issuerMap);
    setLoading(false);
    setRefreshKey((k) => k + 1);
  }, [program, pda]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!entity?.metadataUri) {
      setMeta(null);
      return;
    }
    let alive = true;
    fetch(`/api/mock/fetch?uri=${encodeURIComponent(entity.metadataUri)}`)
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => {
        if (!alive || !t) return;
        try {
          setMeta(JSON.parse(t) as EntityMetadata);
        } catch {
          /* ignore */
        }
      });
    return () => {
      alive = false;
    };
  }, [entity?.metadataUri]);

  // Load Project off-chain metadata in parallel so the Projects tab can
  // show real names + domains instead of just hashes.
  useEffect(() => {
    if (projects.length === 0) {
      setProjectMeta({});
      return;
    }
    let alive = true;
    (async () => {
      const result: Record<string, ProjectMetadata | null> = {};
      await Promise.all(
        projects.map(async (p) => {
          if (!p.account.metadataUri) {
            result[p.publicKey.toBase58()] = null;
            return;
          }
          try {
            const resp = await fetch(
              `/api/mock/fetch?uri=${encodeURIComponent(p.account.metadataUri)}`,
            );
            if (!resp.ok) {
              result[p.publicKey.toBase58()] = null;
              return;
            }
            result[p.publicKey.toBase58()] = JSON.parse(
              await resp.text(),
            ) as ProjectMetadata;
          } catch {
            result[p.publicKey.toBase58()] = null;
          }
        }),
      );
      if (alive) setProjectMeta(result);
    })();
    return () => {
      alive = false;
    };
  }, [projects]);

  if (!idBytes) {
    return <div className="no-result">{t("entry.invalidId")}</div>;
  }
  if (loading) {
    return <p className="hint">{t("entry.loading")}</p>;
  }
  if (notFound || !entity || !pda || !ctNumber) {
    return (
      <div data-screen="entity not found">
        <div className="no-result">
          {t("entry.notFound.lead")} <span className="mono">{params.entryId}</span>
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/create" className="btn">
            {t("entry.notFound.cta")}
          </Link>
        </div>
      </div>
    );
  }

  const country = COUNTRIES.find((c) => c.code === entity.jurisdiction);
  const isOfficial =
    entity.isClaimed &&
    publicKey != null &&
    publicKey.toBase58() === entity.officialWallet.toBase58();

  return (
    <div data-screen={`03 Entity · ${ctNumber}`}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--ink-3)",
          letterSpacing: "0.06em",
        }}
      >
        <a
          onClick={() => router.push("/")}
          style={{ cursor: "pointer" }}
        >
          {t("entry.crumb.registry")}
        </a>
        <span>›</span>
        <span style={{ color: "var(--ink)" }}>{ctNumber}</span>
      </div>

      <div className="entity-head">
        <div>
          <div className="ct-num-big">{t("entry.head.ct")} {ctNumber}</div>
          <h1>{meta?.legalName ?? t("entry.head.metaPending")}</h1>
          <p className="summary">
            {meta?.description ??
              `${t("entry.head.summary.filed")} ${formatTimestamp(entity.createdAt)} ${t("entry.head.summary.tail")}`}
          </p>
          <div className="entity-meta-grid">
            <div className="entity-meta-cell">
              <div className="label">{t("entry.head.label.registryId")}</div>
              <div className="v">
                {meta?.registryIdHashHex
                  ? `0x${meta.registryIdHashHex.slice(0, 12)}…`
                  : "—"}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("entry.head.label.jurisdiction")}</div>
              <div className="v serif">
                {country?.label ?? entity.jurisdiction}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("entry.head.label.filed")}</div>
              <div className="v">{formatTimestamp(entity.createdAt)}</div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("entry.head.label.primaryDomain")}</div>
              <div className="v">
                {meta?.websites?.[0]
                  ? new URL(meta.websites[0]).hostname
                  : "—"}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("entry.head.label.officialWallet")}</div>
              <div className="v">
                {entity.isClaimed
                  ? shortKey(entity.officialWallet, 6)
                  : t("entry.head.label.unclaimed")}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("entry.head.label.claimed")}</div>
              <div className="v">
                {entity.isClaimed
                  ? formatTimestamp(entity.claimedAt)
                  : "—"}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("entry.head.label.createdBy")}</div>
              <div className="v">{shortKey(entity.createdBy, 6)}</div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("entry.head.label.signedEdges")}</div>
              <div className="v">
                {entity.relationshipCount} ·{" "}
                {rels.filter((r) => Number(r.account.revokedAt) > 0).length}{" "}
                {t("entry.head.revoked")}
              </div>
            </div>
          </div>
        </div>
        <div className="entity-head-side">
          <Stamp
            text={
              entity.isClaimed
                ? t("entry.stamp.claimed")
                : entity.status === 1
                  ? t("entry.stamp.verified")
                  : t("entry.stamp.unverified")
            }
            sub={`CT · ${ctNumber.slice(3, 10)}`}
          />
          <div className="entity-statuses">
            <StatusPill
              status={entity.status}
              claimed={entity.isClaimed}
            />
            {entity.isClaimed && (
              <span className="status status-platform">
                {t("entry.statusPill.claimPrefix")}{" "}
                {formatTimestamp(entity.claimedAt)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
            <Link
              href={`/attest?entity=${ctNumber}`}
              className="btn btn-stamp"
            >
              {t("entry.btn.fileAttestation")}
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(window.location.href)
                  .then(() => setToast(t("entry.toast.copied")))
                  .catch(() => setToast(t("entry.toast.copyFailed")));
              }}
            >
              {t("entry.btn.copyUrl")}
            </button>
            {isOfficial && (
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--stamp-deep)",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                {t("entry.btn.officialBadge")}
              </div>
            )}
          </div>
        </div>
      </div>

      {!entity.isClaimed && (
        <div style={{ marginTop: 16, marginBottom: 24 }}>
          <ClaimCard entity={pda} onClaimed={refresh} />
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${tab === "graph" ? "active" : ""}`}
          onClick={() => setTab("graph")}
        >
          {t("entry.tab.graph")}
        </button>
        <button
          className={`tab ${tab === "rels" ? "active" : ""}`}
          onClick={() => setTab("rels")}
        >
          {t("entry.tab.rels")} <span className="count">{rels.length}</span>
        </button>
        <button
          className={`tab ${tab === "projects" ? "active" : ""}`}
          onClick={() => setTab("projects")}
        >
          {t("entry.tab.projects")}{" "}
          <span className="count">{projects.length}</span>
        </button>
        <button
          className={`tab ${tab === "signals" ? "active" : ""}`}
          onClick={() => setTab("signals")}
        >
          {t("entry.tab.signals")}{" "}
          <span className="count">{comments.length}</span>
        </button>
        <button
          className={`tab ${tab === "raw" ? "active" : ""}`}
          onClick={() => setTab("raw")}
        >
          {t("entry.tab.raw")}
        </button>
      </div>

      {tab === "graph" && (
        <>
          <div className="graph-card">
            <div className="graph-card-h">
              <h3>{t("entry.graph.title")}</h3>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  letterSpacing: "0.06em",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  <Dot color="#492a3a" />
                  T1
                </span>
                <span>
                  <Dot color="#8985cf" />
                  T2
                </span>
                <span>
                  <Dot color="#ca986d" />
                  T3
                </span>
                <span style={{ color: "var(--revoked)" }}>{t("entry.graph.legend.revoked")}</span>
              </div>
            </div>
            <div className="graph-svg-wrap">
              <IdentityGraph
                entity={pda}
                entityAccount={entity}
                refreshKey={refreshKey}
              />
            </div>
          </div>
          <div className="rel-list">
            {rels.length === 0 ? (
              <div className="no-result" style={{ border: "none" }}>
                {t("entry.graph.empty")}
              </div>
            ) : (
              rels
                .slice(0, 6)
                .map((r) => (
                  <RelRowCompact
                    key={r.publicKey.toBase58()}
                    pda={r.publicKey}
                    rel={r.account}
                    issuer={issuers.get(r.account.issuer.toBase58()) ?? null}
                    onRevoked={refresh}
                  />
                ))
            )}
          </div>
          {rels.length > 6 && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 16 }}
              onClick={() => setTab("rels")}
            >
              {t("entry.graph.viewAll", { n: rels.length })}
            </button>
          )}
        </>
      )}

      {tab === "rels" && (
        <>
          <div
            style={{
              marginBottom: 16,
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-3)",
              letterSpacing: "0.04em",
            }}
          >
            {t("entry.rels.note")}
          </div>
          <div className="rel-list">
            {rels.length === 0 ? (
              <div className="no-result" style={{ border: "none" }}>
                {t("entry.rels.empty")}
              </div>
            ) : (
              [...rels]
                .sort(
                  (a, b) =>
                    Number(b.account.createdAt) - Number(a.account.createdAt),
                )
                .map((r) => (
                  <RelRowCompact
                    key={r.publicKey.toBase58()}
                    pda={r.publicKey}
                    rel={r.account}
                    issuer={issuers.get(r.account.issuer.toBase58()) ?? null}
                    onRevoked={refresh}
                  />
                ))
            )}
          </div>
        </>
      )}

      {tab === "projects" && (
        <>
          {projects.length === 0 && (
            <div className="no-result" style={{ marginBottom: 16 }}>
              {t("entry.projects.empty")}
            </div>
          )}
          {projects.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
              }}
            >
              {projects.map((p) => {
                const pm = projectMeta[p.publicKey.toBase58()] ?? null;
                const fallbackName = `${t("entry.projects.fallback")} ${bytesHex(p.account.projectId).slice(0, 6)}`;
                return (
                  <div key={p.publicKey.toBase58()} className="doc-card">
                    <div className="docnum" style={{ marginBottom: 6 }}>
                      {t("entry.projects.cardLabel")} {bytesHex(p.account.projectId)}
                    </div>
                    <h3
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 22,
                        margin: "0 0 6px",
                        fontWeight: 600,
                      }}
                    >
                      {pm?.name ?? fallbackName}
                    </h3>
                    {pm?.domain && (
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 12,
                          color: "var(--stamp-deep)",
                          letterSpacing: "0.04em",
                          marginBottom: 8,
                        }}
                      >
                        <a
                          href={
                            pm.domain.startsWith("http")
                              ? pm.domain
                              : `https://${pm.domain}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "inherit", textDecoration: "underline" }}
                        >
                          {pm.domain}
                        </a>
                      </div>
                    )}
                    {pm?.description && (
                      <p
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: 14,
                          color: "var(--ink-2)",
                          margin: "0 0 12px",
                          lineHeight: 1.5,
                        }}
                      >
                        {pm.description}
                      </p>
                    )}
                    <div
                      className="rule-h-soft"
                      style={{
                        paddingTop: 10,
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: "var(--ink-3)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {t("entry.projects.domainHash")}{" "}
                      {shortHash(p.account.domainHash, 8)}
                      <br />
                      PDA · {shortKey(p.publicKey, 6)}
                      <br />
                      {t("entry.projects.created")}{" "}
                      {formatTimestamp(p.account.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {publicKey && (
            <div style={{ marginTop: 24 }}>
              <details>
                <summary
                  style={{
                    cursor: "pointer",
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: "var(--stamp-deep)",
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  {t("entry.projects.add")}
                </summary>
                <AddProjectForm entity={pda} onCreated={refresh} />
              </details>
            </div>
          )}
          {!publicKey && projects.length === 0 && (
            <p className="hint" style={{ marginTop: 16 }}>
              {t("entry.projects.connectFirst")}
            </p>
          )}
        </>
      )}

      {tab === "signals" && (
        <>
          <div
            style={{
              marginBottom: 16,
              fontFamily: "var(--serif)",
              fontSize: 15,
              color: "var(--ink-2)",
              maxWidth: "70ch",
            }}
          >
            <em>{t("entry.signals.intro.em")}</em>
            {t("entry.signals.intro.tail")}
          </div>
          {comments.length === 0 ? (
            <div className="no-result">{t("entry.signals.empty")}</div>
          ) : (
            <ReviewList
              entity={pda}
              items={comments}
              isClaimed={entity.isClaimed}
              createdBy={entity.createdBy}
              officialWallet={
                entity.isClaimed ? entity.officialWallet : null
              }
              onResponded={refresh}
            />
          )}
          {publicKey && (
            <div style={{ marginTop: 24 }}>
              <CommentForm entity={pda} onSubmitted={refresh} />
            </div>
          )}
          {!publicKey && (
            <p className="hint" style={{ marginTop: 16 }}>
              {t("entry.signals.connectFirst")}
            </p>
          )}
        </>
      )}

      {tab === "raw" && (
        <div className="doc-card">
          <div className="docnum" style={{ marginBottom: 12 }}>
            {t("entry.raw.title")}
          </div>
          <pre
            style={{
              fontFamily: "var(--mono)",
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--ink)",
              background: "var(--paper-2)",
              padding: 16,
              margin: 0,
              border: "1px solid var(--rule-soft)",
              overflowX: "auto",
            }}
          >
{`{
  "account_type":      "Entity",
  "pda":               "${pda.toBase58()}",
  "ct_number":         "${ctNumber}",
  "entity_id":         "${bytesHex(entity.entityId)}",
  "created_by":        "${entity.createdBy.toBase58()}",
  "legal_name_hash":   "0x${shortHash(entity.legalNameHash, 8)}",
  "registry_id_hash":  "0x${shortHash(entity.registryIdHash, 8)}",
  "jurisdiction":      "${entity.jurisdiction}",
  "status":            ${entity.status},
  "is_claimed":        ${entity.isClaimed},
  "official_wallet":   ${
    entity.isClaimed ? `"${entity.officialWallet.toBase58()}"` : "null"
  },
  "metadata_uri":      "${entity.metadataUri}",
  "project_count":     ${entity.projectCount},
  "comment_count":     ${entity.commentCount},
  "relationship_count":${entity.relationshipCount},
  "created_at":        ${entity.createdAt.toString()},
  "claimed_at":        ${entity.claimedAt.toString()},
  "bump":              ${entity.bump}
}`}
          </pre>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        background: color,
        borderRadius: "50%",
        marginRight: 4,
        verticalAlign: "middle",
      }}
    />
  );
}

// Suppress unused — relation labels exported elsewhere
void COMMENT_RELATION_LABELS;

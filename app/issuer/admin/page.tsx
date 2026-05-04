"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllIssuerTierRequests,
  fetchAllIssuers,
  fetchRegistryConfig,
  initializeRegistryConfig,
  reviewIssuerTier,
} from "@/lib/anchor/client";
import { formatTimestamp, shortKey } from "@/lib/utils/format";
import type {
  Issuer,
  IssuerTierRequest,
  RegistryConfig,
} from "@/types";
import { useT } from "@/lib/i18n";

type RequestRow = {
  publicKey: PublicKey;
  account: IssuerTierRequest;
};

export default function IssuerAdminPage() {
  const program = useProgram();
  const { publicKey } = useWallet();
  const t = useT();
  const [config, setConfig] = useState<RegistryConfig | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [issuers, setIssuers] = useState<Map<string, Issuer>>(new Map());
  const [noteBodies, setNoteBodies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adminInput, setAdminInput] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (publicKey) {
      setAdminInput(publicKey.toBase58());
    }
  }, [publicKey]);

  useEffect(() => {
    if (!program) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [cfg, rawRequests, rawIssuers] = await Promise.all([
          fetchRegistryConfig(program),
          fetchAllIssuerTierRequests(program),
          fetchAllIssuers(program),
        ]);
        if (!alive) return;
        setConfig((cfg as RegistryConfig | null) ?? null);
        setRequests(
          (rawRequests as { publicKey: PublicKey; account: unknown }[]).map(
            (r) => ({
              publicKey: r.publicKey,
              account: r.account as IssuerTierRequest,
            }),
          ),
        );
        const issuerMap = new Map<string, Issuer>();
        for (const row of rawIssuers) {
          issuerMap.set(
            row.publicKey.toBase58(),
            row.account as unknown as Issuer,
          );
        }
        setIssuers(issuerMap);
      } catch (err) {
        if (alive) setError((err as Error).message ?? t("issuerAdmin.errors.loadFailed"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program, refreshKey]);

  useEffect(() => {
    if (requests.length === 0) {
      setNoteBodies({});
      return;
    }
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        requests.map(async (req) => {
          if (!req.account.noteUri) return;
          try {
            const resp = await fetch(
              `/api/mock/fetch?uri=${encodeURIComponent(req.account.noteUri)}`,
            );
            if (!resp.ok) return;
            const text = await resp.text();
            try {
              const parsed = JSON.parse(text) as { note?: string };
              next[req.publicKey.toBase58()] = parsed.note ?? text;
            } catch {
              next[req.publicKey.toBase58()] = text;
            }
          } catch {
            /* ignore */
          }
        }),
      );
      if (alive) setNoteBodies(next);
    })();
    return () => {
      alive = false;
    };
  }, [requests]);

  const isAdmin =
    !!config &&
    !!publicKey &&
    config.adminAuthority.toBase58() === publicKey.toBase58();

  const pendingRequests = useMemo(
    () =>
      requests
        .filter((r) => r.account.status === 0)
        .sort(
          (a, b) =>
            Number(b.account.requestedAt) - Number(a.account.requestedAt),
        ),
    [requests],
  );

  const reviewedRequests = useMemo(
    () =>
      requests
        .filter((r) => r.account.status !== 0)
        .sort(
          (a, b) =>
            Number(b.account.resolvedAt || b.account.requestedAt) -
            Number(a.account.resolvedAt || a.account.requestedAt),
        )
        .slice(0, 12),
    [requests],
  );

  async function onInitialize() {
    setError(null);
    setNotice(null);
    if (!program || !publicKey) {
      setError(t("issuerAdmin.errors.connect"));
      return;
    }
    let adminAuthority: PublicKey;
    try {
      adminAuthority = new PublicKey(adminInput.trim());
    } catch {
      setError(t("issuerAdmin.errors.adminPubkey"));
      return;
    }
    setInitializing(true);
    try {
      await initializeRegistryConfig(program, publicKey, adminAuthority);
      setNotice(t("issuerAdmin.notice.initialized"));
      setRefreshKey((n) => n + 1);
    } catch (err) {
      setError((err as Error).message ?? t("issuerAdmin.errors.initFailed"));
    } finally {
      setInitializing(false);
    }
  }

  async function onReview(req: RequestRow, approve: boolean) {
    setError(null);
    setNotice(null);
    if (!program || !publicKey) {
      setError(t("issuerAdmin.errors.connect"));
      return;
    }
    setActingKey(req.publicKey.toBase58());
    try {
      await reviewIssuerTier(program, publicKey, {
        issuer: req.account.issuer,
        requestedTier: req.account.requestedTier,
        approve,
      });
      setNotice(
        approve
          ? t("issuerAdmin.notice.approved", { tier: req.account.requestedTier })
          : t("issuerAdmin.notice.rejected", { tier: req.account.requestedTier }),
      );
      setRefreshKey((n) => n + 1);
    } catch (err) {
      setError((err as Error).message ?? t("issuerAdmin.errors.reviewFailed"));
    } finally {
      setActingKey(null);
    }
  }

  return (
    <div data-screen="issuer admin">
      <div className="docnum" style={{ marginBottom: 8 }}>
        {t("issuerAdmin.docnum")}
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          {t("issuerAdmin.title")}
        </h2>
        <span className="section-meta">{t("issuerAdmin.meta")}</span>
      </div>
      <p
        style={{
          fontFamily: "var(--serif)",
          fontSize: 17,
          color: "var(--ink-2)",
          maxWidth: "72ch",
          marginTop: -8,
          marginBottom: 28,
        }}
      >
        {t("issuerAdmin.intro")}
      </p>

      <div style={{ marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/issuers" className="btn btn-ghost">
          {t("issuerAdmin.btn.back")}
        </Link>
        <Link href="/issuer/register" className="btn btn-stamp">
          {t("issuerAdmin.btn.selfService")}
        </Link>
      </div>

      {!publicKey && (
        <div className="no-result">{t("issuerAdmin.connect")}</div>
      )}

      {error && <p className="error">{error}</p>}
      {notice && (
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--good)",
            letterSpacing: "0.06em",
            marginBottom: 16,
          }}
        >
          ◆ {notice.toUpperCase()}
        </p>
      )}

      {loading ? (
        <div className="no-result">{t("issuerAdmin.loading")}</div>
      ) : !config ? (
        <div className="doc-card">
          <div className="doc-card-h">
            <div className="doc-card-title">{t("issuerAdmin.init.title")}</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              {t("issuerAdmin.init.meta")}
            </div>
          </div>
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 15,
              color: "var(--ink-2)",
              marginTop: 0,
            }}
          >
            {t("issuerAdmin.init.body")}
          </p>
          <label className="label">{t("issuerAdmin.init.label")}</label>
          <input
            className="input mt-1"
            value={adminInput}
            onChange={(e) => setAdminInput(e.target.value)}
            placeholder={t("issuerAdmin.init.placeholder")}
          />
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={onInitialize} disabled={initializing || !publicKey}>
              {initializing
                ? t("issuerAdmin.init.btn.busy")
                : t("issuerAdmin.init.btn")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="doc-card" style={{ marginBottom: 28 }}>
            <div className="doc-card-h">
              <div className="doc-card-title">{t("issuerAdmin.status.title")}</div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  letterSpacing: "0.1em",
                }}
              >
                {t("issuerAdmin.status.meta")}
              </div>
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-2)",
                lineHeight: 1.7,
              }}
            >
              <div>
                {t("issuerAdmin.status.admin")} {shortKey(config.adminAuthority, 8)}
              </div>
              <div>
                {t("issuerAdmin.status.initialized")} {formatTimestamp(config.initializedAt)}
              </div>
              <div>
                {t("issuerAdmin.status.connected")}{" "}
                {publicKey ? shortKey(publicKey, 8) : "—"}
              </div>
              <div>
                {t("issuerAdmin.status.statusLabel")}{" "}
                {isAdmin
                  ? t("issuerAdmin.status.authorized")
                  : t("issuerAdmin.status.readonly")}
              </div>
            </div>
          </div>

          <section style={{ marginBottom: 36 }}>
            <div className="section-h">
              <h2 className="section-title">{t("issuerAdmin.pending.title")}</h2>
              <span className="section-meta">
                {t("issuerAdmin.pending.meta", { n: pendingRequests.length })}
              </span>
            </div>
            {pendingRequests.length === 0 ? (
              <div className="no-result">{t("issuerAdmin.pending.empty")}</div>
            ) : (
              <div className="rel-list">
                {pendingRequests.map((req) => {
                  const issuer = issuers.get(req.account.issuer.toBase58()) ?? null;
                  const busy = actingKey === req.publicKey.toBase58();
                  return (
                    <div
                      key={req.publicKey.toBase58()}
                      className="doc-card"
                      style={{ marginBottom: 0 }}
                    >
                      <div className="doc-card-h">
                        <div className="doc-card-title">
                          {t("issuerAdmin.req.title", {
                            tier: req.account.requestedTier,
                          })}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 10,
                            color: "var(--ink-3)",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {t(`issuerTierReq.${req.account.status}`)}
                        </div>
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          color: "var(--ink-2)",
                          lineHeight: 1.7,
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          {t("issuerAdmin.req.issuer")}{" "}
                          {issuer
                            ? t(`issuerKind.${issuer.kind}`)
                            : t("issuerKind.fallback")}{" "}
                          ·{" "}
                          {issuer ? t(`issuerTier.${issuer.trustTier}`) : "—"}
                        </div>
                        <div>
                          {t("issuerAdmin.req.issuerPda")}{" "}
                          {shortKey(req.account.issuer, 8)}
                        </div>
                        <div>
                          {t("issuerAdmin.req.requester")}{" "}
                          {shortKey(req.account.requester, 8)}
                        </div>
                        <div>
                          {t("issuerAdmin.req.requested")}{" "}
                          {formatTimestamp(req.account.requestedAt)}
                        </div>
                        <div>
                          {t("issuerAdmin.req.noteUri")}{" "}
                          {req.account.noteUri ? (
                            <a
                              href={`/api/mock/fetch?uri=${encodeURIComponent(req.account.noteUri)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--stamp-deep)" }}
                            >
                              {t("issuerAdmin.req.openNote")}
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>
                      {noteBodies[req.publicKey.toBase58()] && (
                        <div
                          style={{
                            fontFamily: "var(--serif)",
                            fontSize: 15,
                            color: "var(--ink)",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.55,
                            background: "var(--paper-2)",
                            border: "1px solid var(--rule-soft)",
                            padding: 12,
                            marginBottom: 16,
                          }}
                        >
                          {noteBodies[req.publicKey.toBase58()]}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => onReview(req, true)}
                          disabled={!isAdmin || busy}
                        >
                          {busy
                            ? t("issuerAdmin.req.btn.busy")
                            : t("issuerAdmin.req.btn.approve", {
                                tier: req.account.requestedTier,
                              })}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => onReview(req, false)}
                          disabled={!isAdmin || busy}
                        >
                          {t("issuerAdmin.req.btn.reject")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="section-h">
              <h2 className="section-title">{t("issuerAdmin.recent.title")}</h2>
              <span className="section-meta">
                {t("issuerAdmin.recent.meta", { n: reviewedRequests.length })}
              </span>
            </div>
            {reviewedRequests.length === 0 ? (
              <div className="no-result">{t("issuerAdmin.recent.empty")}</div>
            ) : (
              <div className="rel-list">
                {reviewedRequests.map((req) => (
                  <div
                    key={req.publicKey.toBase58()}
                    className="rel-row"
                    style={{ gridTemplateColumns: "110px 1fr 180px 160px" }}
                  >
                    <div className="rel-kind">T{req.account.requestedTier}</div>
                    <div>
                      <div className="rel-target">
                        {t(`issuerTierReq.${req.account.status}`)}
                      </div>
                      <div className="rel-target-sub">
                        {t("issuerAdmin.recent.issuer")}{" "}
                        {shortKey(req.account.issuer, 6)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: "var(--ink-2)",
                      }}
                    >
                      {t("issuerAdmin.recent.reviewedBy")}{" "}
                      {shortKey(req.account.reviewedBy, 6)}
                    </div>
                    <div className="rel-validity">
                      <span>{t("issuerAdmin.recent.resolved")}</span>
                      <span className="v-date">
                        {req.account.resolvedAt
                          ? formatTimestamp(req.account.resolvedAt)
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

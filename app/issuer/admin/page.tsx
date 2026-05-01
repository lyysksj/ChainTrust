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
import {
  ISSUER_KIND_LABELS,
  ISSUER_TIER_LABELS,
  ISSUER_TIER_REQUEST_STATUS_LABELS,
} from "@/types";
import type {
  Issuer,
  IssuerTierRequest,
  RegistryConfig,
} from "@/types";

type RequestRow = {
  publicKey: PublicKey;
  account: IssuerTierRequest;
};

export default function IssuerAdminPage() {
  const program = useProgram();
  const { publicKey } = useWallet();
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
        if (alive) setError((err as Error).message ?? "Failed to load review console");
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
      setError("Connect the admin wallet first.");
      return;
    }
    let adminAuthority: PublicKey;
    try {
      adminAuthority = new PublicKey(adminInput.trim());
    } catch {
      setError("Admin authority must be a valid Solana public key.");
      return;
    }
    setInitializing(true);
    try {
      await initializeRegistryConfig(program, publicKey, adminAuthority);
      setNotice("Registry admin initialized.");
      setRefreshKey((n) => n + 1);
    } catch (err) {
      setError((err as Error).message ?? "Failed to initialize registry admin");
    } finally {
      setInitializing(false);
    }
  }

  async function onReview(req: RequestRow, approve: boolean) {
    setError(null);
    setNotice(null);
    if (!program || !publicKey) {
      setError("Connect the admin wallet first.");
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
          ? `Approved issuer to T${req.account.requestedTier}.`
          : `Rejected T${req.account.requestedTier} request.`,
      );
      setRefreshKey((n) => n + 1);
    } catch (err) {
      setError((err as Error).message ?? "Review action failed");
    } finally {
      setActingKey(null);
    }
  }

  return (
    <div data-screen="issuer admin">
      <div className="docnum" style={{ marginBottom: 8 }}>
        ISSUER TIER REVIEW CONSOLE · ADMIN
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          Issuer review admin.
        </h2>
        <span className="section-meta">T1 / T2 APPROVAL WORKFLOW</span>
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
        Tier 3 issuers can request a manual review for Tier 2 or Tier 1. The
        registry admin wallet reviews the request note and either approves the
        tier change on-chain or rejects it.
      </p>

      <div style={{ marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/issuers" className="btn btn-ghost">
          Back to issuer directory
        </Link>
        <Link href="/issuer/register" className="btn btn-stamp">
          Issuer self-service →
        </Link>
      </div>

      {!publicKey && (
        <div className="no-result">CONNECT A WALLET TO USE THE REVIEW CONSOLE.</div>
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
        <div className="no-result">LOADING REVIEW QUEUE…</div>
      ) : !config ? (
        <div className="doc-card">
          <div className="doc-card-h">
            <div className="doc-card-title">Initialize registry admin</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              ONE-TIME SETUP
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
            No registry admin has been initialized on-chain yet. The wallet that
            signs this action becomes the admin authority unless you explicitly
            set another public key below.
          </p>
          <label className="label">Admin authority public key</label>
          <input
            className="input mt-1"
            value={adminInput}
            onChange={(e) => setAdminInput(e.target.value)}
            placeholder="Wallet that can approve T1/T2 requests"
          />
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={onInitialize} disabled={initializing || !publicKey}>
              {initializing ? "Initializing…" : "Initialize admin on-chain"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="doc-card" style={{ marginBottom: 28 }}>
            <div className="doc-card-h">
              <div className="doc-card-title">Registry admin status</div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  letterSpacing: "0.1em",
                }}
              >
                CONFIG PDA
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
              <div>ADMIN · {shortKey(config.adminAuthority, 8)}</div>
              <div>INITIALIZED · {formatTimestamp(config.initializedAt)}</div>
              <div>CONNECTED WALLET · {publicKey ? shortKey(publicKey, 8) : "—"}</div>
              <div>STATUS · {isAdmin ? "AUTHORIZED ADMIN" : "READ-ONLY VIEWER"}</div>
            </div>
          </div>

          <section style={{ marginBottom: 36 }}>
            <div className="section-h">
              <h2 className="section-title">Pending requests</h2>
              <span className="section-meta">{pendingRequests.length} PENDING</span>
            </div>
            {pendingRequests.length === 0 ? (
              <div className="no-result">NO PENDING TIER REVIEW REQUESTS.</div>
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
                          Request for T{req.account.requestedTier}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 10,
                            color: "var(--ink-3)",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {ISSUER_TIER_REQUEST_STATUS_LABELS[req.account.status]}
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
                          ISSUER · {issuer ? ISSUER_KIND_LABELS[issuer.kind] : "Unknown"} ·{" "}
                          {issuer ? ISSUER_TIER_LABELS[issuer.trustTier] : "—"}
                        </div>
                        <div>ISSUER PDA · {shortKey(req.account.issuer, 8)}</div>
                        <div>REQUESTER · {shortKey(req.account.requester, 8)}</div>
                        <div>REQUESTED · {formatTimestamp(req.account.requestedAt)}</div>
                        <div>
                          NOTE URI ·{" "}
                          {req.account.noteUri ? (
                            <a
                              href={`/api/mock/fetch?uri=${encodeURIComponent(req.account.noteUri)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--stamp-deep)" }}
                            >
                              open note
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
                          {busy ? "Submitting…" : `Approve T${req.account.requestedTier}`}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => onReview(req, false)}
                          disabled={!isAdmin || busy}
                        >
                          Reject request
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
              <h2 className="section-title">Recent decisions</h2>
              <span className="section-meta">{reviewedRequests.length} RECENT</span>
            </div>
            {reviewedRequests.length === 0 ? (
              <div className="no-result">NO APPROVED OR REJECTED REQUESTS YET.</div>
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
                        {ISSUER_TIER_REQUEST_STATUS_LABELS[req.account.status]}
                      </div>
                      <div className="rel-target-sub">
                        issuer {shortKey(req.account.issuer, 6)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: "var(--ink-2)",
                      }}
                    >
                      reviewed by {shortKey(req.account.reviewedBy, 6)}
                    </div>
                    <div className="rel-validity">
                      <span>Resolved</span>
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

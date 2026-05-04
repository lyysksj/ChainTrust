"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllIssuers,
  fetchAllRelationships,
} from "@/lib/anchor/client";
import { formatTimestamp, shortKey } from "@/lib/utils/format";
import { TierPill } from "@/components/registry-bits";
import type { Issuer, Relationship } from "@/types";
import { useT } from "@/lib/i18n";

type Row = {
  pda: PublicKey;
  account: Issuer;
  total: number;
  active: number;
  revoked: number;
};

export default function IssuersListPage() {
  const program = useProgram();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    if (!program) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const [rawIssuers, rawRels] = await Promise.all([
        fetchAllIssuers(program),
        fetchAllRelationships(program),
      ]);
      if (!alive) return;
      const counts = new Map<
        string,
        { total: number; active: number; revoked: number }
      >();
      for (const r of rawRels) {
        const acc = r.account as unknown as Relationship;
        const key = acc.issuer.toBase58();
        const cur = counts.get(key) ?? { total: 0, active: 0, revoked: 0 };
        cur.total += 1;
        if (Number(acc.revokedAt) > 0) cur.revoked += 1;
        else cur.active += 1;
        counts.set(key, cur);
      }
      const next = rawIssuers.map((i) => {
        const c = counts.get(i.publicKey.toBase58()) ?? {
          total: 0,
          active: 0,
          revoked: 0,
        };
        return {
          pda: i.publicKey,
          account: i.account as unknown as Issuer,
          ...c,
        };
      });
      next.sort((a, b) => a.account.trustTier - b.account.trustTier);
      setRows(next);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [program]);

  return (
    <div data-screen="05 Issuers">
      <div className="docnum" style={{ marginBottom: 8 }}>
        {t("issuers.docnum")}
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          {t("issuers.title")}
        </h2>
        <span className="section-meta">
          {rows.length}{" "}
          {rows.length === 1 ? t("common.entry") : t("common.entries")} ·{" "}
          {t("issuers.metaTiers")}
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--serif)",
          fontSize: 17,
          color: "var(--ink-2)",
          maxWidth: "70ch",
          marginTop: -8,
          marginBottom: 32,
        }}
      >
        {t("issuers.intro.lead")}
        <strong>{t("issuers.intro.bold")}</strong>
        {t("issuers.intro.tail")}
      </p>

      <div
        style={{ marginBottom: 32, display: "flex", gap: 12, flexWrap: "wrap" }}
      >
        <Link href="/issuer/register" className="btn btn-stamp">
          {t("issuers.btn.register")}
        </Link>
        <Link href="/issuer/admin" className="btn btn-ghost">
          {t("issuers.btn.admin")}
        </Link>
        <Link href="/attest" className="btn btn-ghost">
          {t("issuers.btn.attest")}
        </Link>
      </div>

      {loading ? (
        <div className="no-result">{t("issuers.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="no-result">{t("issuers.empty")}</div>
      ) : (
        <>
          <div
            className="entity-row head"
            style={{
              gridTemplateColumns: "60px 1fr 200px 120px 90px 90px",
            }}
          >
            <span className="label">{t("issuers.col.tier")}</span>
            <span className="label">{t("issuers.col.issuer")}</span>
            <span className="label">{t("issuers.col.authority")}</span>
            <span className="label">{t("issuers.col.registered")}</span>
            <span className="label">{t("issuers.col.active")}</span>
            <span className="label">{t("issuers.col.revoked")}</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.pda.toBase58()}
              className="entity-row"
              style={{
                gridTemplateColumns: "60px 1fr 200px 120px 90px 90px",
                cursor: "default",
              }}
            >
              <TierPill tier={r.account.trustTier} />
              <div>
                <div className="ent-name">
                  {r.account.kind > 0
                    ? t(`issuerKind.${r.account.kind}`)
                    : t("issuerKind.fallback")}
                </div>
                <div className="ent-sub">
                  PDA · {shortKey(r.pda, 6)}
                </div>
              </div>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-2)",
                }}
              >
                {shortKey(r.account.authority, 8)}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                }}
              >
                {formatTimestamp(r.account.registeredAt)}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {r.active}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  color: r.revoked ? "var(--revoked)" : "var(--ink-3)",
                  fontWeight: 600,
                }}
              >
                {r.revoked}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Tier definitions */}
      <div style={{ marginTop: 48 }}>
        <div className="section-h">
          <h2 className="section-title">{t("issuers.tierDef.title")}</h2>
          <span className="section-meta">{t("issuers.tierDef.meta")}</span>
        </div>
        <div className="principles">
          <div className="principle">
            <div className="principle-num">
              <TierPill tier={1} />
              &nbsp;{t("issuers.tierDef.t1.label")}
            </div>
            <h3 className="principle-title">{t("issuers.tierDef.t1.title")}</h3>
            <p className="principle-body">{t("issuers.tierDef.t1.body")}</p>
          </div>
          <div className="principle">
            <div className="principle-num">
              <TierPill tier={2} />
              &nbsp;{t("issuers.tierDef.t2.label")}
            </div>
            <h3 className="principle-title">{t("issuers.tierDef.t2.title")}</h3>
            <p className="principle-body">{t("issuers.tierDef.t2.body")}</p>
          </div>
          <div className="principle">
            <div className="principle-num">
              <TierPill tier={3} />
              &nbsp;{t("issuers.tierDef.t3.label")}
            </div>
            <h3 className="principle-title">{t("issuers.tierDef.t3.title")}</h3>
            <p className="principle-body">{t("issuers.tierDef.t3.body")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

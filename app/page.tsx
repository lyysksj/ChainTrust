"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllEntities,
  fetchAllIssuers,
  fetchAllRelationships,
  fetchAllUsers,
} from "@/lib/anchor/client";
import { entityIdToCtNumber } from "@/lib/utils/ct-number";
import { bytesHex, formatTimestamp } from "@/lib/utils/format";
import { StatusPill } from "@/components/registry-bits";
import { AttestationSample } from "@/components/attestation-sample";
import { COUNTRIES } from "@/types";
import type { Entity, EntityMetadata, Issuer, Relationship } from "@/types";
import { useT } from "@/lib/i18n";

type EntityRow = {
  pda: PublicKey;
  account: Entity;
  meta: EntityMetadata | null;
  ctNumber: string;
  entityIdHex: string;
};

export default function HomePage() {
  const program = useProgram();
  const router = useRouter();
  const t = useT();

  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [counts, setCounts] = useState({
    entities: 0,
    rels: 0,
    issuers: 0,
    users: 0,
  });
  const [resolveQuery, setResolveQuery] = useState("");

  useEffect(() => {
    if (!program) return;
    let alive = true;
    (async () => {
      const [rawEntities, rawRels, rawIssuers, rawUsers] = await Promise.all([
        fetchAllEntities(program),
        fetchAllRelationships(program),
        fetchAllIssuers(program),
        fetchAllUsers(program),
      ]);
      if (!alive) return;

      const rels = rawRels.map((r) => r.account as unknown as Relationship);
      const issuers = rawIssuers.map((i) => i.account as unknown as Issuer);
      void issuers;
      setCounts({
        entities: rawEntities.length,
        rels: rawRels.length,
        issuers: rawIssuers.length,
        users: rawUsers.length,
      });

      const rows = await Promise.all(
        rawEntities.map(async (e) => {
          const account = e.account as unknown as Entity;
          let meta: EntityMetadata | null = null;
          if (account.metadataUri) {
            try {
              const resp = await fetch(
                `/api/mock/fetch?uri=${encodeURIComponent(account.metadataUri)}`,
              );
              if (resp.ok) meta = JSON.parse(await resp.text());
            } catch {
              /* ignore */
            }
          }
          return {
            pda: e.publicKey,
            account,
            meta,
            ctNumber: entityIdToCtNumber(account.entityId),
            entityIdHex: bytesHex(account.entityId),
          } satisfies EntityRow;
        }),
      );
      if (!alive) return;
      rows.sort(
        (a, b) =>
          Number(b.account.claimedAt || b.account.createdAt) -
          Number(a.account.claimedAt || a.account.createdAt),
      );
      setEntities(rows);
    })();
    return () => {
      alive = false;
    };
  }, [program]);

  function submitResolve(e?: React.FormEvent) {
    e?.preventDefault();
    if (!resolveQuery.trim()) {
      router.push("/resolve");
      return;
    }
    router.push(`/resolve?q=${encodeURIComponent(resolveQuery.trim())}`);
  }

  const samples = [
    { label: t("home.sample.ctNumber"), value: entities[0]?.ctNumber ?? t("home.sample.ctNumberVal") },
    { label: t("home.sample.legalId"), value: t("home.sample.legalIdVal") },
    { label: t("home.sample.companyName"), value: t("home.sample.companyNameVal") },
    { label: t("home.sample.wallet"), value: t("home.sample.walletVal") },
    { label: t("home.sample.domain"), value: "example.com" },
  ];

  const recent = useMemo(() => entities.slice(0, 12), [entities]);

  return (
    <div data-screen="01 Registry Home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">{t("home.eyebrow")}</div>
        <div className="hero-row">
          <div className="hero-left">
            <h1 className="hero-title">
              {t("home.title.lead")} <em>{t("home.title.em")}</em>{" "}
              {t("home.title.tail")}
            </h1>
            <div className="hero-sub">
              <p>
                {t("home.sub.p1.lead")}
                <strong>{t("home.sub.p1.bold")}</strong>
              </p>
              <p>{t("home.sub.p2")}</p>
              <p>
                <strong>{t("home.sub.p3.bold")}</strong>
              </p>
            </div>
            <div className="hero-cta">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => router.push("/resolve")}
              >
                {t("home.cta.resolve")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => router.push("/create")}
              >
                {t("home.cta.fileEntity")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => router.push("/attest")}
              >
                {t("home.cta.fileAttestation")}
              </button>
            </div>
          </div>
          <div className="hero-stamp-wrap">
            <AttestationSample />
            <div className="r-caption">
              <span>Sample dossier · for illustration</span>
              <span className="dot" />
              <span>Solana · v0.4</span>
            </div>
          </div>
        </div>
      </section>

      {/* Resolve quick-bar */}
      <form onSubmit={submitResolve} style={{ marginBottom: 32 }}>
        <div className="resolve-bar">
          <span className="resolve-bar-icon">›_</span>
          <input
            placeholder={t("home.resolveBar.placeholder")}
            value={resolveQuery}
            onChange={(e) => setResolveQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-stamp">
            {t("home.resolveBar.submit")}
          </button>
        </div>
        {samples.length > 0 && (
          <div className="resolve-suggest" style={{ marginTop: 8 }}>
            <span>{t("home.resolveBar.try")}</span>
            {samples.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  setResolveQuery(s.value);
                  router.push(`/resolve?q=${encodeURIComponent(s.value)}`);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Stats strip */}
      <div className="stat-strip">
        <div className="stat-cell">
          <div className="stat-v">{counts.entities}</div>
          <div className="stat-l">{t("home.stats.entities")}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-v">{counts.rels}</div>
          <div className="stat-l">{t("home.stats.rels")}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-v">{counts.issuers}</div>
          <div className="stat-l">{t("home.stats.issuers")}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-v">{counts.users}</div>
          <div className="stat-l">{t("home.stats.users")}</div>
        </div>
      </div>

      {/* Filer onboarding strip */}
      <div className="section-h">
        <h2 className="section-title">{t("home.onboarding.title")}</h2>
        <span className="section-meta">{t("home.onboarding.meta")}</span>
      </div>
      <div className="principles" style={{ marginBottom: 48 }}>
        <Link
          href="/register"
          className="principle"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="principle-num">{t("home.onboarding.s1.num")}</div>
          <h3 className="principle-title">{t("home.onboarding.s1.title")}</h3>
          <p className="principle-body">{t("home.onboarding.s1.body")}</p>
        </Link>
        <Link
          href="/create"
          className="principle"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="principle-num">{t("home.onboarding.s2.num")}</div>
          <h3 className="principle-title">{t("home.onboarding.s2.title")}</h3>
          <p className="principle-body">{t("home.onboarding.s2.body")}</p>
        </Link>
        <Link
          href="/issuer/register"
          className="principle"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="principle-num">{t("home.onboarding.s3.num")}</div>
          <h3 className="principle-title">{t("home.onboarding.s3.title")}</h3>
          <p className="principle-body">{t("home.onboarding.s3.body")}</p>
        </Link>
      </div>

      {/* Recently verified registry */}
      <div className="section-h">
        <h2 className="section-title">{t("home.recent.title")}</h2>
        <span className="section-meta">
          {t("home.recent.metaPrefix")} {recent.length}{" "}
          {recent.length === 1 ? t("common.entry") : t("common.entries")}
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="no-result">{t("home.recent.empty")}</div>
      ) : (
        <>
          <div className="entity-row head">
            <span className="label">{t("home.recent.col.ctNumber")}</span>
            <span className="label">{t("home.recent.col.entity")}</span>
            <span className="label">{t("home.recent.col.jurisdiction")}</span>
            <span className="label">{t("home.recent.col.status")}</span>
            <span className="label">{t("home.recent.col.filed")}</span>
            <span></span>
          </div>
          {recent.map((row) => {
            const country = COUNTRIES.find(
              (c) => c.code === row.account.jurisdiction,
            );
            return (
              <div
                className="entity-row"
                key={row.pda.toBase58()}
                onClick={() => router.push(`/entry/${row.entityIdHex}`)}
              >
                <span className="ct-num">{row.ctNumber}</span>
                <div>
                  <div className="ent-name">
                    {row.meta?.legalName ?? t("home.recent.metaPending")}
                  </div>
                  <div className="ent-sub">
                    {(() => {
                      const primary = row.meta?.identifiers?.find(
                        (id) => id.primary,
                      );
                      return primary
                        ? `${primary.typeLabel}·${primary.value}`
                        : "—";
                    })()}{" "}
                    · INC{" "}
                    {formatTimestamp(row.account.createdAt)}
                  </div>
                </div>
                <span className="ent-juris">
                  {country?.label ?? row.account.jurisdiction}
                </span>
                <StatusPill
                  status={row.account.status}
                  claimed={row.account.isClaimed}
                />
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--ink-3)",
                  }}
                >
                  {formatTimestamp(
                    Number(row.account.claimedAt) > 0
                      ? row.account.claimedAt
                      : row.account.createdAt,
                  )}
                </span>
                <span className="arrow">→</span>
              </div>
            );
          })}
        </>
      )}

      {/* CTA strip */}
      <div className="cta-strip">
        <h3>
          {t("home.cta.bottom.l1")}
          <br />
          {t("home.cta.bottom.l2.lead")}{" "}
          <em>{t("home.cta.bottom.l2.em")}</em>{" "}
          {t("home.cta.bottom.l2.tail")}
        </h3>
        <Link href="/resolve" className="btn">
          {t("home.cta.bottom.btn")}
        </Link>
      </div>
    </div>
  );
}

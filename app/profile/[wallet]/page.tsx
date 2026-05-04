"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllRelationships,
  fetchCommentsByCommenter,
  fetchEntitiesByOfficialWallet,
  fetchEntitiesCreatedBy,
  fetchIssuer,
  fetchUserProfile,
  updateUserMetadataUri,
} from "@/lib/anchor/client";
import {
  bytesHex,
  formatTimestamp,
  shortHash,
  shortKey,
} from "@/lib/utils/format";
import { entityIdToCtNumber } from "@/lib/utils/ct-number";
import {
  validateHeadline,
  validateOptionalUrl,
} from "@/lib/utils/validation";
import {
  StatusPill,
  TierPill,
} from "@/components/registry-bits";
import { uploadMetadata } from "@/lib/upload-client";
import { COMMENT_RELATION_LABELS } from "@/types";
import { useT } from "@/lib/i18n";
import type {
  CommentRecord,
  Entity,
  EntityMetadata,
  Issuer,
  Relationship,
  UserMetadata,
  UserProfile,
} from "@/types";

type Params = { wallet: string };

export default function ProfilePage({ params }: { params: Params }) {
  const program = useProgram();
  const { publicKey: connectedWallet, signMessage } = useWallet();
  const t = useT();

  const wallet = useMemo(() => {
    try {
      return new PublicKey(params.wallet);
    } catch {
      return null;
    }
  }, [params.wallet]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [meta, setMeta] = useState<UserMetadata | null>(null);
  const [issuer, setIssuer] = useState<Issuer | null>(null);
  const [entities, setEntities] = useState<
    { publicKey: PublicKey; account: Entity }[]
  >([]);
  const [verifiedEntities, setVerifiedEntities] = useState<
    { publicKey: PublicKey; account: Entity }[]
  >([]);
  const [comments, setComments] = useState<
    { publicKey: PublicKey; account: CommentRecord }[]
  >([]);
  const [signedRels, setSignedRels] = useState<
    { publicKey: PublicKey; account: Relationship }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [draftHeadline, setDraftHeadline] = useState("");
  const [draftAbout, setDraftAbout] = useState("");
  const [draftLinkX, setDraftLinkX] = useState("");
  const [draftLinkGithub, setDraftLinkGithub] = useState("");
  const [draftLinkLinkedin, setDraftLinkLinkedin] = useState("");
  const [draftLinkSite, setDraftLinkSite] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!program || !wallet) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const p = await fetchUserProfile(program, wallet);
        if (!alive) return;
        setProfile(p);
        const [e, ve, c, iss, allRels] = await Promise.all([
          fetchEntitiesCreatedBy(program, wallet),
          fetchEntitiesByOfficialWallet(program, wallet),
          fetchCommentsByCommenter(program, wallet),
          fetchIssuer(program, wallet),
          fetchAllRelationships(program),
        ]);
        if (!alive) return;
        setEntities(
          e.map((x) => ({
            publicKey: x.publicKey,
            account: x.account as unknown as Entity,
          })),
        );
        setVerifiedEntities(
          ve.map((x) => ({
            publicKey: x.publicKey,
            account: x.account as unknown as Entity,
          })),
        );
        setComments(
          c.map((x) => ({
            publicKey: x.publicKey,
            account: x.account as unknown as CommentRecord,
          })),
        );
        setIssuer((iss as Issuer | null) ?? null);

        // Filter relationships signed by this wallet's authority.
        const target = wallet.toBase58();
        setSignedRels(
          allRels
            .map((r) => ({
              publicKey: r.publicKey,
              account: r.account as unknown as Relationship,
            }))
            .filter((r) => r.account.attestorAuthority.toBase58() === target),
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program, wallet]);

  useEffect(() => {
    let alive = true;
    if (!profile?.metadataUri) {
      setMeta(null);
      return;
    }
    fetch(`/api/mock/fetch?uri=${encodeURIComponent(profile.metadataUri)}`)
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => {
        if (!alive || !t) return;
        try {
          setMeta(JSON.parse(t) as UserMetadata);
        } catch {
          /* ignore */
        }
      });
    return () => {
      alive = false;
    };
  }, [profile?.metadataUri]);

  useEffect(() => {
    setDraftHeadline(meta?.headline ?? "");
    setDraftAbout(meta?.about ?? "");
    setDraftLinkX(meta?.links?.x ?? "");
    setDraftLinkGithub(meta?.links?.github ?? "");
    setDraftLinkLinkedin(meta?.links?.linkedin ?? "");
    setDraftLinkSite(meta?.links?.site ?? "");
  }, [meta]);

  // Pull entity metadata for the verified-rep callout.
  const [verifiedEntryNames, setVerifiedEntryNames] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    if (verifiedEntities.length === 0) {
      setVerifiedEntryNames({});
      return;
    }
    let alive = true;
    (async () => {
      const result: Record<string, string> = {};
      await Promise.all(
        verifiedEntities.map(async (e) => {
          if (!e.account.metadataUri) return;
          try {
            const resp = await fetch(
              `/api/mock/fetch?uri=${encodeURIComponent(e.account.metadataUri)}`,
            );
            if (!resp.ok) return;
            const text = await resp.text();
            const parsed = JSON.parse(text) as EntityMetadata;
            result[e.publicKey.toBase58()] =
              parsed.legalName ?? "(unnamed)";
          } catch {
            /* ignore */
          }
        }),
      );
      if (alive) setVerifiedEntryNames(result);
    })();
    return () => {
      alive = false;
    };
  }, [verifiedEntities]);

  if (!wallet) {
    return (
      <div className="no-result">{t("profile.invalidWallet")}</div>
    );
  }

  const isOwner =
    !!connectedWallet && connectedWallet.toBase58() === wallet.toBase58();
  const activeSigned = signedRels.filter(
    (r) => Number(r.account.revokedAt) === 0,
  ).length;
  const revokedSigned = signedRels.length - activeSigned;

  async function saveProfileEdits(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveNotice(null);

    if (!program || !connectedWallet || !isOwner) {
      setSaveError(t("profile.edit.errors.connect"));
      return;
    }

    const trimmedHeadline = draftHeadline.trim();
    if (trimmedHeadline) {
      const headlineError = validateHeadline(trimmedHeadline);
      if (headlineError) {
        setSaveError(headlineError);
        return;
      }
    } else if (draftHeadline.length > 120) {
      setSaveError(t("profile.edit.errors.headlineLong"));
      return;
    }

    for (const [label, value] of [
      ["X", draftLinkX],
      ["GitHub", draftLinkGithub],
      ["LinkedIn", draftLinkLinkedin],
      ["Website", draftLinkSite],
    ] as const) {
      const linkError = validateOptionalUrl(value);
      if (linkError) {
        setSaveError(`${label}: ${linkError}`);
        return;
      }
    }

    const nextMetadata: UserMetadata = {
      ...meta,
      headline: trimmedHeadline || undefined,
      about: draftAbout.trim() || undefined,
      links: {
        x: draftLinkX.trim() || undefined,
        github: draftLinkGithub.trim() || undefined,
        linkedin: draftLinkLinkedin.trim() || undefined,
        site: draftLinkSite.trim() || undefined,
      },
    };

    setSaving(true);
    try {
      const up = await uploadMetadata(
        connectedWallet,
        signMessage,
        JSON.stringify(nextMetadata),
      );

      await updateUserMetadataUri(program, connectedWallet, up.uri);
      setMeta(nextMetadata);
      setProfile((prev) => (prev ? { ...prev, metadataUri: up.uri } : prev));
      setEditOpen(false);
      setSaveNotice(t("profile.edit.success"));
    } catch (err) {
      setSaveError((err as Error).message ?? t("profile.edit.errors.failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-screen="user profile">
      <div className="docnum" style={{ marginBottom: 8 }}>
        {t("profile.docnum")}
      </div>

      {/* Header */}
      <div className="entity-head">
        <div>
          <div className="ct-num-big">
            {t("profile.walletPrefix")} {shortKey(wallet, 10)}
          </div>
          <h1>
            {profile?.username ? `@${profile.username}` : shortKey(wallet, 6)}
          </h1>
          {meta?.headline ? (
            <p className="summary">{meta.headline}</p>
          ) : profile ? (
            <p className="summary">
              {t("profile.summary.since")}{" "}
              {formatTimestamp(profile.registeredAt)}.
            </p>
          ) : (
            <p className="summary">
              {t("profile.summary.notReg.lead")}{" "}
              <Link
                href="/register"
                style={{
                  color: "var(--stamp-deep)",
                  textDecoration: "underline",
                }}
              >
                {t("profile.summary.notReg.cta")}
              </Link>
            </p>
          )}

          <div className="entity-meta-grid">
            <div className="entity-meta-cell">
              <div className="label">{t("profile.meta.username")}</div>
              <div className="v">
                {profile?.username ? `@${profile.username}` : "—"}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("profile.meta.registered")}</div>
              <div className="v">
                {profile ? formatTimestamp(profile.registeredAt) : "—"}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("profile.meta.entitiesFiled")}</div>
              <div className="v">{entities.length}</div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("profile.meta.claimedEntities")}</div>
              <div className="v">{verifiedEntities.length}</div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("profile.meta.signalsPosted")}</div>
              <div className="v">{comments.length}</div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("profile.meta.edgesSigned")}</div>
              <div className="v">
                {signedRels.length} · {revokedSigned}{" "}
                {t("profile.meta.revokedTail")}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("profile.meta.issuerRole")}</div>
              <div className="v">
                {issuer
                  ? `T${issuer.trustTier} · ${
                      issuer.kind > 0
                        ? t(`issuerKind.${issuer.kind}`)
                        : t("issuerKind.fallback")
                    }`
                  : "—"}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">{t("profile.meta.wallet")}</div>
              <div className="v">{shortKey(wallet, 8)}</div>
            </div>
          </div>
        </div>

        <div className="entity-head-side">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            {profile ? (
              <span className="status status-platform">
                {t("profile.status.verified")}
              </span>
            ) : (
              <span className="status status-unverified">
                {t("profile.status.unregistered")}
              </span>
            )}
            {issuer && <TierPill tier={issuer.trustTier} />}
            {verifiedEntities.length > 0 && (
              <span className="status status-claimed">
                {t("profile.status.officialRep")}
              </span>
            )}
          </div>

          {issuer && (
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.04em",
                lineHeight: 1.6,
              }}
            >
              {t("profile.aside.issuer")}{" "}
              {issuer.kind > 0 ? t(`issuerKind.${issuer.kind}`) : "—"}
              <br />
              {t("profile.aside.tier")}{" "}
              {issuer.trustTier > 0 ? t(`issuerTier.${issuer.trustTier}`) : "—"}
              <br />
              {t("profile.aside.registered")}{" "}
              {formatTimestamp(issuer.registeredAt)}
            </div>
          )}

          {verifiedEntities.length > 0 && (
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--stamp-deep)",
                letterSpacing: "0.04em",
                lineHeight: 1.6,
              }}
            >
              {t("profile.aside.represents")}{" "}
              {verifiedEntities.map((e, i) => (
                <span key={e.publicKey.toBase58()}>
                  <Link
                    href={`/entry/${bytesHex(e.account.entityId)}`}
                    style={{
                      color: "var(--stamp-deep)",
                      textDecoration: "underline",
                    }}
                  >
                    {verifiedEntryNames[e.publicKey.toBase58()] ??
                      t("profile.aside.loading")}
                  </Link>
                  {i < verifiedEntities.length - 1 ? " · " : ""}
                </span>
              ))}
            </div>
          )}

          {isOwner && profile && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                className="btn btn-stamp"
                onClick={() => {
                  setSaveError(null);
                  setSaveNotice(null);
                  setEditOpen((open) => !open);
                }}
              >
                {editOpen ? t("profile.editBtn.close") : t("profile.editBtn")}
              </button>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  letterSpacing: "0.04em",
                  lineHeight: 1.6,
                }}
              >
                {t("profile.editNote.l1")}
                <br />
                {t("profile.editNote.l2")}
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <p
          className="hint"
          style={{ marginBottom: 24 }}
        >
          {t("profile.loading")}
        </p>
      )}

      {saveNotice && (
        <div
          className="doc-card"
          style={{
            marginBottom: 24,
            borderColor: "var(--good)",
            background: "rgba(158, 184, 156, 0.10)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--good)",
              letterSpacing: "0.06em",
            }}
          >
            ◆ {saveNotice.toUpperCase()}
          </p>
        </div>
      )}

      {isOwner && profile && editOpen && (
        <Section title={t("profile.edit.title")} meta={t("profile.edit.meta")}>
          <form onSubmit={saveProfileEdits} className="doc-card">
            <div className="doc-card-h">
              <div className="doc-card-title">
                {t("profile.edit.cardTitle")}
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  letterSpacing: "0.1em",
                }}
              >
                {t("profile.edit.locked")}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="label">
                  {t("profile.edit.fields.headline")}
                </label>
                <input
                  className="input mt-1"
                  value={draftHeadline}
                  onChange={(e) => setDraftHeadline(e.target.value)}
                  placeholder={t("profile.edit.fields.headlinePlaceholder")}
                  maxLength={120}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">
                  {t("profile.edit.fields.about")}
                </label>
                <textarea
                  className="textarea mt-1"
                  value={draftAbout}
                  onChange={(e) => setDraftAbout(e.target.value)}
                  placeholder={t("profile.edit.fields.aboutPlaceholder")}
                  maxLength={4000}
                />
              </div>
              <div>
                <label className="label">X</label>
                <input
                  className="input mt-1"
                  value={draftLinkX}
                  onChange={(e) => setDraftLinkX(e.target.value)}
                  placeholder="https://x.com/handle"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="label">GitHub</label>
                <input
                  className="input mt-1"
                  value={draftLinkGithub}
                  onChange={(e) => setDraftLinkGithub(e.target.value)}
                  placeholder="https://github.com/handle"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="label">LinkedIn</label>
                <input
                  className="input mt-1"
                  value={draftLinkLinkedin}
                  onChange={(e) => setDraftLinkLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/handle"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="label">Website</label>
                <input
                  className="input mt-1"
                  value={draftLinkSite}
                  onChange={(e) => setDraftLinkSite(e.target.value)}
                  placeholder="https://yourdomain.dev"
                  maxLength={200}
                />
              </div>
            </div>

            {saveError && <p className="error">{saveError}</p>}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 20,
              }}
            >
              <p
                className="hint"
                style={{ margin: 0, maxWidth: "52ch" }}
              >
                {t("profile.edit.note")}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditOpen(false);
                    setSaveError(null);
                  }}
                  disabled={saving}
                >
                  {t("profile.edit.btn.cancel")}
                </button>
                <button className="btn btn-primary" disabled={saving}>
                  {saving
                    ? t("profile.edit.btn.submitting")
                    : t("profile.edit.btn.submit")}
                </button>
              </div>
            </div>
          </form>
        </Section>
      )}

      {/* About / expertise */}
      {meta?.expertise && meta.expertise.length > 0 && (
        <Section
          title={t("profile.section.expertise")}
          meta={t("profile.section.expertiseMeta")}
        >
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
          >
            {meta.expertise.map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  border: "1px solid var(--rule)",
                  background: "var(--paper-2)",
                  color: "var(--ink-2)",
                  padding: "3px 10px",
                  textTransform: "uppercase",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </Section>
      )}

      {meta?.workExperience && meta.workExperience.length > 0 && (
        <Section
          title={t("profile.section.workExperience")}
          meta={t("profile.section.expertiseMeta")}
        >
          <div className="rel-list">
            {meta.workExperience.map((exp, i) => (
              <div
                key={i}
                className="rel-row"
                style={{
                  gridTemplateColumns: "1fr 200px",
                  cursor: "default",
                }}
              >
                <div>
                  <div className="rel-target">{exp.role}</div>
                  <div className="rel-target-sub">{exp.company}</div>
                </div>
                <span className="rel-validity">
                  <span className="v-date">
                    {exp.fromYear ?? "—"} –{" "}
                    {exp.toYear ?? t("profile.section.workNow")}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {meta?.about && (
        <Section
          title={t("profile.section.about")}
          meta={t("profile.section.expertiseMeta")}
        >
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              maxWidth: "70ch",
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {meta.about}
          </p>
        </Section>
      )}

      {meta?.links && hasAnyLink(meta.links) && (
        <Section title={t("profile.section.links")}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              fontFamily: "var(--mono)",
              fontSize: 12,
            }}
          >
            {meta.links.x && (
              <ExtLink label="X" url={meta.links.x} />
            )}
            {meta.links.github && (
              <ExtLink label="GitHub" url={meta.links.github} />
            )}
            {meta.links.linkedin && (
              <ExtLink label="LinkedIn" url={meta.links.linkedin} />
            )}
            {meta.links.site && (
              <ExtLink label="Site" url={meta.links.site} />
            )}
          </div>
        </Section>
      )}

      {/* On-chain entity list */}
      <Section
        title={t("profile.section.entities.title")}
        meta={`${entities.length} ${
          entities.length === 1 ? t("common.entry") : t("common.entries")
        }`}
      >
        {entities.length === 0 ? (
          <div className="no-result">
            {t("profile.section.entities.empty")}
          </div>
        ) : (
          <>
            <div
              className="entity-row head"
              style={{
                gridTemplateColumns:
                  "140px 1fr 160px 140px 100px 36px",
              }}
            >
              <span className="label">{t("profile.section.entities.col.ct")}</span>
              <span className="label">
                {t("profile.section.entities.col.entity")}
              </span>
              <span className="label">
                {t("profile.section.entities.col.juris")}
              </span>
              <span className="label">
                {t("profile.section.entities.col.status")}
              </span>
              <span className="label">
                {t("profile.section.entities.col.filed")}
              </span>
              <span></span>
            </div>
            {entities.map((e) => {
              const ct = entityIdToCtNumber(e.account.entityId);
              const idHex = bytesHex(e.account.entityId);
              return (
                <Link
                  key={e.publicKey.toBase58()}
                  href={`/entry/${idHex}`}
                  className="entity-row"
                  style={{
                    gridTemplateColumns:
                      "140px 1fr 160px 140px 100px 36px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span className="ct-num">{ct}</span>
                  <div>
                    <div className="ent-name">
                      {verifiedEntryNames[e.publicKey.toBase58()] ??
                        `Entity ${idHex.slice(0, 6)}`}
                    </div>
                    <div className="ent-sub">
                      {e.account.projectCount}{" "}
                      {t("profile.section.entities.subProject")} ·{" "}
                      {e.account.relationshipCount}{" "}
                      {t("profile.section.entities.subAtt")}
                    </div>
                  </div>
                  <span className="ent-juris">
                    {e.account.jurisdiction}
                  </span>
                  <StatusPill
                    status={e.account.status}
                    claimed={e.account.isClaimed}
                  />
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: "var(--ink-3)",
                    }}
                  >
                    {formatTimestamp(e.account.createdAt)}
                  </span>
                  <span className="arrow">→</span>
                </Link>
              );
            })}
          </>
        )}
      </Section>

      {/* Signed relationships */}
      <Section
        title={t("profile.section.signed.title")}
        meta={t("profile.section.signed.meta", {
          n: signedRels.length,
          active: activeSigned,
          revoked: revokedSigned,
        })}
      >
        {signedRels.length === 0 ? (
          <div className="no-result">
            {t("profile.section.signed.empty")}
          </div>
        ) : (
          <div className="rel-list">
            {signedRels.slice(0, 12).map((r) => {
              const revoked = Number(r.account.revokedAt) > 0;
              return (
                <div
                  key={r.publicKey.toBase58()}
                  className={`rel-row ${revoked ? "revoked" : ""}`}
                  style={{
                    gridTemplateColumns: "130px 1fr 160px 100px",
                  }}
                >
                  <div className="rel-kind">
                    {t("profile.section.signed.kindPrefix")} {r.account.kind}
                  </div>
                  <div>
                    <div className="rel-target">
                      {t("profile.section.signed.edge")}{" "}
                      {shortKey(r.publicKey, 4)}
                    </div>
                    <div className="rel-target-sub">
                      {t("profile.section.signed.entity")}{" "}
                      <Link
                        href={`/entry/${shortKey(r.account.entity, 8)}`}
                        style={{ color: "var(--stamp-deep)" }}
                      >
                        {shortKey(r.account.entity, 8)}
                      </Link>
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: "var(--ink-2)",
                    }}
                  >
                    {t("profile.section.signed.target")}{" "}
                    {shortHash(r.account.targetRef, 6)}
                  </span>
                  <div className="rel-validity">
                    {revoked ? (
                      <>
                        <span className="v-revoked">
                          {t("profile.section.signed.revoked")}
                        </span>
                        <span className="v-date v-revoked">
                          {formatTimestamp(r.account.revokedAt)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>{t("profile.section.signed.from")}</span>
                        <span className="v-date">
                          {formatTimestamp(r.account.validFrom)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Community signals */}
      <Section
        title={t("profile.section.signals.title")}
        meta={t(
          comments.length !== 1
            ? "profile.section.signals.metaMany"
            : "profile.section.signals.metaOne",
          { n: comments.length },
        )}
      >
        {comments.length === 0 ? (
          <div className="no-result">
            {t("profile.section.signals.empty")}
          </div>
        ) : (
          <div className="rel-list">
            {comments.slice(0, 20).map((c) => (
              <div
                key={c.publicKey.toBase58()}
                className="rel-row"
                style={{
                  gridTemplateColumns: "100px 1fr 160px",
                  cursor: "default",
                }}
              >
                <div className="rel-kind">
                  {(COMMENT_RELATION_LABELS[c.account.relationType] ?? "Reply").toUpperCase()}
                </div>
                <div>
                  <div className="rel-target">
                    {t("profile.section.signals.label", {
                      n: c.account.commentIndex,
                    })}
                  </div>
                  <div className="rel-target-sub">
                    {t("profile.section.signals.onEntity")}{" "}
                    {shortKey(c.account.entity, 6)} ·{" "}
                    {t("profile.section.signals.hash")}{" "}
                    {shortHash(c.account.contentHash, 8)}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--ink-3)",
                    textAlign: "right",
                  }}
                >
                  {formatTimestamp(c.account.submittedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div className="section-h">
        <h2 className="section-title">{title}</h2>
        {meta && <span className="section-meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function ExtLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "var(--stamp-deep)",
        textDecoration: "underline",
      }}
    >
      {label} · {hostnameOf(url)}
    </a>
  );
}

function hasAnyLink(links: UserMetadata["links"]): boolean {
  if (!links) return false;
  return Boolean(links.x || links.github || links.linkedin || links.site);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

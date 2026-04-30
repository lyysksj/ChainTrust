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
import {
  COMMENT_RELATION_LABELS,
  ISSUER_KIND_LABELS,
  ISSUER_TIER_LABELS,
} from "@/types";
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
      <div className="no-result">INVALID WALLET ADDRESS</div>
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
      setSaveError("Connect the owner wallet to edit this profile.");
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
      setSaveError("Headline must be 120 characters or fewer.");
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
      setSaveNotice("Profile updated on-chain.");
    } catch (err) {
      setSaveError((err as Error).message ?? "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-screen="user profile">
      <div className="docnum" style={{ marginBottom: 8 }}>
        FORM CT-USR · PUBLIC PROFILE
      </div>

      {/* Header */}
      <div className="entity-head">
        <div>
          <div className="ct-num-big">
            WALLET · {shortKey(wallet, 10)}
          </div>
          <h1>
            {profile?.username ? `@${profile.username}` : shortKey(wallet, 6)}
          </h1>
          {meta?.headline ? (
            <p className="summary">{meta.headline}</p>
          ) : profile ? (
            <p className="summary">
              ChainTrust user since{" "}
              {formatTimestamp(profile.registeredAt)}.
            </p>
          ) : (
            <p className="summary">
              This wallet has not registered a ChainTrust profile yet.{" "}
              <Link
                href="/register"
                style={{
                  color: "var(--stamp-deep)",
                  textDecoration: "underline",
                }}
              >
                Register profile →
              </Link>
            </p>
          )}

          <div className="entity-meta-grid">
            <div className="entity-meta-cell">
              <div className="label">USERNAME</div>
              <div className="v">
                {profile?.username ? `@${profile.username}` : "—"}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">REGISTERED</div>
              <div className="v">
                {profile ? formatTimestamp(profile.registeredAt) : "—"}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">ENTITIES FILED</div>
              <div className="v">{entities.length}</div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">CLAIMED ENTITIES</div>
              <div className="v">{verifiedEntities.length}</div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">SIGNALS POSTED</div>
              <div className="v">{comments.length}</div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">EDGES SIGNED</div>
              <div className="v">
                {signedRels.length} · {revokedSigned} revoked
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">ISSUER ROLE</div>
              <div className="v">
                {issuer
                  ? `T${issuer.trustTier} · ${ISSUER_KIND_LABELS[issuer.kind] ?? "Issuer"}`
                  : "—"}
              </div>
            </div>
            <div className="entity-meta-cell">
              <div className="label">WALLET</div>
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
                ● Verified user
              </span>
            ) : (
              <span className="status status-unverified">
                ○ Unregistered
              </span>
            )}
            {issuer && <TierPill tier={issuer.trustTier} />}
            {verifiedEntities.length > 0 && (
              <span className="status status-claimed">
                ◆ Official representative
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
              ISSUER · {ISSUER_KIND_LABELS[issuer.kind] ?? "—"}
              <br />
              TIER · {ISSUER_TIER_LABELS[issuer.trustTier] ?? "—"}
              <br />
              REGISTERED ·{" "}
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
              REPRESENTS ·{" "}
              {verifiedEntities.map((e, i) => (
                <span key={e.publicKey.toBase58()}>
                  <Link
                    href={`/entry/${bytesHex(e.account.entityId)}`}
                    style={{
                      color: "var(--stamp-deep)",
                      textDecoration: "underline",
                    }}
                  >
                    {verifiedEntryNames[e.publicKey.toBase58()] ?? "(loading)"}
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
                {editOpen ? "Close editor" : "Edit profile"}
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
                USERNAME IS FIXED AFTER REGISTRATION.
                <br />
                HEADLINE, ABOUT, AND LINKS CAN BE UPDATED.
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
          LOADING ON-CHAIN RECORDS…
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
        <Section title="Edit profile" meta="OWNER ACTION · ON-CHAIN METADATA UPDATE">
          <form onSubmit={saveProfileEdits} className="doc-card">
            <div className="doc-card-h">
              <div className="doc-card-title">Update public profile metadata</div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  letterSpacing: "0.1em",
                }}
              >
                USERNAME LOCKED
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="label">Headline</label>
                <input
                  className="input mt-1"
                  value={draftHeadline}
                  onChange={(e) => setDraftHeadline(e.target.value)}
                  placeholder="Compliance lead at Acme · KYB analyst"
                  maxLength={120}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">About</label>
                <textarea
                  className="textarea mt-1"
                  value={draftAbout}
                  onChange={(e) => setDraftAbout(e.target.value)}
                  placeholder="What kinds of attestations you sign or rely on."
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
                This updates the profile metadata URI only. Your wallet and username stay unchanged.
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
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </div>
            </div>
          </form>
        </Section>
      )}

      {/* About / expertise */}
      {meta?.expertise && meta.expertise.length > 0 && (
        <Section title="Expertise" meta="OFF-CHAIN METADATA">
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
        <Section title="Work experience" meta="OFF-CHAIN METADATA">
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
                    {exp.fromYear ?? "—"} – {exp.toYear ?? "now"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {meta?.about && (
        <Section title="About" meta="OFF-CHAIN METADATA">
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
        <Section title="Links">
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
        title="Entities filed"
        meta={`${entities.length} ${entities.length === 1 ? "ENTRY" : "ENTRIES"}`}
      >
        {entities.length === 0 ? (
          <div className="no-result">
            NO ENTITIES FILED BY THIS WALLET
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
              <span className="label">CT-Number</span>
              <span className="label">Entity</span>
              <span className="label">Jurisdiction</span>
              <span className="label">Status</span>
              <span className="label">Filed</span>
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
                      {verifiedEntryNames[e.publicKey.toBase58()] ?? `Entity ${idHex.slice(0, 6)}`}
                    </div>
                    <div className="ent-sub">
                      {e.account.projectCount} project ·{" "}
                      {e.account.relationshipCount} attestation
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
        title="Edges signed by this wallet"
        meta={`${signedRels.length} signed · ${activeSigned} active · ${revokedSigned} revoked`}
      >
        {signedRels.length === 0 ? (
          <div className="no-result">
            NO RELATIONSHIPS SIGNED. REGISTER AS AN ISSUER FIRST.
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
                    KIND · {r.account.kind}
                  </div>
                  <div>
                    <div className="rel-target">
                      Edge {shortKey(r.publicKey, 4)}
                    </div>
                    <div className="rel-target-sub">
                      ENTITY ·{" "}
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
                    target {shortHash(r.account.targetRef, 6)}
                  </span>
                  <div className="rel-validity">
                    {revoked ? (
                      <>
                        <span className="v-revoked">Revoked</span>
                        <span className="v-date v-revoked">
                          {formatTimestamp(r.account.revokedAt)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>From</span>
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
        title="Community signals submitted"
        meta={`${comments.length} signal${comments.length !== 1 ? "s" : ""}`}
      >
        {comments.length === 0 ? (
          <div className="no-result">
            NO COMMUNITY SIGNALS SUBMITTED YET
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
                    Signal #{c.account.commentIndex}
                  </div>
                  <div className="rel-target-sub">
                    on entity {shortKey(c.account.entity, 6)} · hash{" "}
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

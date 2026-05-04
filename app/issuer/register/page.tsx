"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchIssuer,
  fetchIssuerTierRequestsForIssuer,
  fetchUserProfile,
  registerIssuer,
  requestIssuerTier,
} from "@/lib/anchor/client";
import { issuerPda } from "@/lib/anchor/pdas";
import { sha256Bytes } from "@/lib/utils/hash";
import { uploadMetadata } from "@/lib/upload-client";
import { ISSUER_KIND, ISSUER_KIND_LABELS } from "@/types";
import type { Issuer, IssuerTierRequest } from "@/types";
import { useT } from "@/lib/i18n";

export default function IssuerRegisterPage() {
  const { publicKey, signMessage } = useWallet();
  const program = useProgram();
  const t = useT();

  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [existing, setExisting] = useState<Issuer | null>(null);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<number>(ISSUER_KIND.SELF);
  // Tier is locked to 3 for self-registration. Higher tiers require an
  // out-of-band platform review process (not yet implemented).
  const tier = 3;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [tierRequests, setTierRequests] = useState<
    { publicKey: string; account: IssuerTierRequest }[]
  >([]);
  const [requestTier, setRequestTier] = useState<number>(2);
  const [requestNote, setRequestNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!program || !publicKey) return;
    let alive = true;
    (async () => {
      const [profile, iss] = await Promise.all([
        fetchUserProfile(program, publicKey),
        fetchIssuer(program, publicKey),
      ]);
      if (!alive) return;
      setHasProfile(!!profile);
      setExisting((iss as Issuer | null) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [program, publicKey]);

  useEffect(() => {
    if (!program || !publicKey || !existing) {
      setTierRequests([]);
      return;
    }
    let alive = true;
    (async () => {
      const [issuer] = issuerPda(publicKey);
      const rows = await fetchIssuerTierRequestsForIssuer(program, issuer);
      if (!alive) return;
      setTierRequests(
        (rows as { publicKey: { toBase58(): string }; account: unknown }[]).map(
          (r) => ({
            publicKey: r.publicKey.toBase58(),
            account: r.account as IssuerTierRequest,
          }),
        ),
      );
    })();
    return () => {
      alive = false;
    };
  }, [program, publicKey, existing, done, requestNotice]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!program || !publicKey) {
      setError(t("issuerReg.form.errors.connect"));
      return;
    }
    if (!name.trim()) {
      setError(t("issuerReg.form.errors.name"));
      return;
    }
    setSubmitting(true);
    try {
      const metadata = {
        name: name.trim(),
        website: website.trim() || undefined,
        description: description.trim() || undefined,
      };
      const up = await uploadMetadata(
        publicKey,
        signMessage,
        JSON.stringify(metadata),
      );

      await registerIssuer(program, publicKey, {
        kind,
        trustTier: tier,
        nameHash: sha256Bytes(name.trim()),
        metadataUri: up.uri,
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message ?? t("issuerReg.form.errors.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onRequestTier(e: React.FormEvent) {
    e.preventDefault();
    setRequestError(null);
    setRequestNotice(null);
    if (!program || !publicKey || !existing) {
      setRequestError(t("issuerReg.tierReview.errors.notIssuer"));
      return;
    }
    if (existing.trustTier <= requestTier) {
      setRequestError(t("issuerReg.tierReview.errors.lower"));
      return;
    }
    if (!requestNote.trim()) {
      setRequestError(t("issuerReg.tierReview.errors.note"));
      return;
    }
    setRequesting(true);
    try {
      const payload = JSON.stringify({
        requestedTier: requestTier,
        note: requestNote.trim(),
      });
      const up = await uploadMetadata(publicKey, signMessage, payload);

      await requestIssuerTier(program, publicKey, {
        requestedTier: requestTier,
        noteHash: sha256Bytes(payload),
        noteUri: up.uri,
      });
      setRequestNote("");
      setRequestNotice(
        t("issuerReg.tierReview.notice", { tier: requestTier }),
      );
    } catch (err) {
      setRequestError(
        (err as Error).message ?? t("issuerReg.tierReview.errors.failed"),
      );
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div data-screen="issuer register">
      <div className="docnum" style={{ marginBottom: 8 }}>
        {t("issuerReg.docnum")}
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          {t("issuerReg.title")}
        </h2>
        <span className="section-meta">{t("issuerReg.meta")}</span>
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
        {t("issuerReg.intro")}
      </p>

      {!publicKey && (
        <div className="no-result">{t("issuerReg.connect")}</div>
      )}
      {publicKey && hasProfile === false && (
        <div className="doc-card">
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 15,
              color: "var(--ink-2)",
              margin: "0 0 16px",
            }}
          >
            {t("issuerReg.needProfile")}
          </p>
          <Link href="/register" className="btn btn-primary">
            {t("issuerReg.registerProfile")}
          </Link>
        </div>
      )}

      {existing && (
        <div
          className="doc-card"
          style={{ borderColor: "var(--stamp-deep)" }}
        >
          <div
            className="docnum"
            style={{ marginBottom: 8, color: "var(--stamp-deep)" }}
          >
            {t("issuerReg.already.title")}
          </div>
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 16,
              color: "var(--ink)",
              margin: 0,
            }}
          >
            {t("issuerReg.already.body.lead")}{" "}
            <strong>
              {existing.kind > 0
                ? t(`issuerKind.${existing.kind}`)
                : t("issuerKind.fallback")}
            </strong>{" "}
            ·{" "}
            <strong>
              {existing.trustTier > 0
                ? t(`issuerTier.${existing.trustTier}`)
                : t("issuerTier.3")}
            </strong>
          </p>
        </div>
      )}

      {existing && (
        <div className="doc-card" style={{ marginTop: 24 }}>
          <div className="doc-card-h">
            <div className="doc-card-title">{t("issuerReg.tierReview.title")}</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              {t("issuerReg.tierReview.meta")}
            </div>
          </div>

          {tierRequests.length > 0 ? (
            <div className="rel-list" style={{ marginBottom: 16 }}>
              {tierRequests
                .sort(
                  (a, b) =>
                    Number(b.account.requestedAt) - Number(a.account.requestedAt),
                )
                .map((req) => (
                  <div
                    key={req.publicKey}
                    className="rel-row"
                    style={{ gridTemplateColumns: "110px 1fr 180px" }}
                  >
                    <div className="rel-kind">T{req.account.requestedTier}</div>
                    <div>
                      <div className="rel-target">
                        {t(`issuerTierReq.${req.account.status}`)}
                      </div>
                      <div className="rel-target-sub">
                        {t("issuerReg.tierReview.note")}{" "}
                        {req.account.noteUri || "—"}
                      </div>
                    </div>
                    <div className="rel-validity">
                      <span>{t("issuerReg.tierReview.requested")}</span>
                      <span className="v-date">
                        {new Date(Number(req.account.requestedAt) * 1000)
                          .toISOString()
                          .slice(0, 10)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="hint" style={{ marginTop: 0 }}>
              {t("issuerReg.tierReview.empty")}
            </p>
          )}

          {existing.trustTier === 3 ? (
            <form onSubmit={onRequestTier}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="label">
                    {t("issuerReg.tierReview.fields.tier")}
                  </label>
                  <select
                    className="select mt-1"
                    value={requestTier}
                    onChange={(e) => setRequestTier(Number(e.target.value))}
                  >
                    <option value={2}>{t("issuerTier.2")}</option>
                    <option value={1}>{t("issuerTier.1")}</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">
                    {t("issuerReg.tierReview.fields.note")}
                  </label>
                  <textarea
                    className="textarea mt-1"
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder={t(
                      "issuerReg.tierReview.fields.notePlaceholder",
                    )}
                    maxLength={1200}
                  />
                </div>
              </div>
              {requestError && <p className="error">{requestError}</p>}
              {requestNotice && (
                <p className="hint" style={{ color: "var(--good)" }}>
                  {requestNotice}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 16,
                  alignItems: "center",
                }}
              >
                <p className="hint" style={{ margin: 0, maxWidth: "48ch" }}>
                  {t("issuerReg.tierReview.adminNote")}
                </p>
                <button className="btn btn-primary" disabled={requesting}>
                  {requesting
                    ? t("issuerReg.tierReview.btn.submitting")
                    : t("issuerReg.tierReview.btn.submit")}
                </button>
              </div>
            </form>
          ) : (
            <p className="hint" style={{ margin: 0 }}>
              {t("issuerReg.tierReview.alreadyApproved")}
            </p>
          )}
        </div>
      )}

      {publicKey && hasProfile && !existing && !done && (
        <form onSubmit={onSubmit} className="doc-card">
          <div className="doc-card-h">
            <div className="doc-card-title">{t("issuerReg.form.title")}</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              {t("issuerReg.form.meta")}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">{t("issuerReg.form.name.label")}</label>
              <input
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("issuerReg.form.name.placeholder")}
                maxLength={120}
              />
            </div>
            <div>
              <label className="label">{t("issuerReg.form.website.label")}</label>
              <input
                className="input mt-1"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder={t("issuerReg.form.website.placeholder")}
                maxLength={200}
              />
            </div>
            <div>
              <label className="label">{t("issuerReg.form.kind.label")}</label>
              <select
                className="select mt-1"
                value={kind}
                onChange={(e) => setKind(Number(e.target.value))}
              >
                {Object.entries(ISSUER_KIND_LABELS).map(([k]) => (
                  <option key={k} value={k}>
                    {t(`issuerKind.${k}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("issuerReg.form.tier.label")}</label>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  color: "var(--ink)",
                  padding: "10px 12px",
                  background: "var(--paper-2)",
                  border: "1.5px solid var(--rule-soft)",
                }}
              >
                {t("issuerReg.form.tier.value")}
              </div>
              <p className="hint mt-1">{t("issuerReg.form.tier.hint")}</p>
            </div>
            <div className="md:col-span-2">
              <label className="label">
                {t("issuerReg.form.description.label")}
              </label>
              <textarea
                className="textarea mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("issuerReg.form.description.placeholder")}
                maxLength={1200}
              />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={submitting}>
            {submitting
              ? t("issuerReg.form.btn.submitting")
              : t("issuerReg.form.btn.submit")}
          </button>
        </form>
      )}

      {done && <p className="text-sm text-claimed">{t("issuerReg.success")}</p>}
    </div>
  );
}

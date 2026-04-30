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
import {
  ISSUER_KIND,
  ISSUER_KIND_LABELS,
  ISSUER_TIER_LABELS,
  ISSUER_TIER_REQUEST_STATUS_LABELS,
} from "@/types";
import type { Issuer, IssuerTierRequest } from "@/types";

export default function IssuerRegisterPage() {
  const { publicKey, signMessage } = useWallet();
  const program = useProgram();

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
        rows.map((r) => ({
          publicKey: r.publicKey.toBase58(),
          account: r.account as unknown as IssuerTierRequest,
        })),
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
      setError("Connect a wallet first.");
      return;
    }
    if (!name.trim()) {
      setError("Issuer name is required.");
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
      setError((err as Error).message ?? "Failed to register issuer");
    } finally {
      setSubmitting(false);
    }
  }

  async function onRequestTier(e: React.FormEvent) {
    e.preventDefault();
    setRequestError(null);
    setRequestNotice(null);
    if (!program || !publicKey || !existing) {
      setRequestError("Register as an issuer first.");
      return;
    }
    if (existing.trustTier <= requestTier) {
      setRequestError("You can only request a higher-trust tier.");
      return;
    }
    if (!requestNote.trim()) {
      setRequestError("Explain why your issuer should be reviewed.");
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
        `Tier review request for T${requestTier} submitted.`,
      );
    } catch (err) {
      setRequestError((err as Error).message ?? "Tier review request failed");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div data-screen="issuer register">
      <div className="docnum" style={{ marginBottom: 8 }}>
        FORM CT-ISS · 2026 EDITION · ART. 5.2
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          Become a ChainTrust Issuer.
        </h2>
        <span className="section-meta">PDA seeds: [&quot;issuer&quot;, authority]</span>
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
        Issuers sign on-chain Relationship attestations. Each attestation is
        tagged with the Issuer&apos;s tier — consumers decide which tiers to
        trust.
      </p>

      {!publicKey && (
        <div className="no-result">CONNECT A WALLET TO CONTINUE.</div>
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
            You need a verified user profile first.
          </p>
          <Link href="/register" className="btn btn-primary">
            Register profile →
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
            ◆ ALREADY REGISTERED
          </div>
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 16,
              color: "var(--ink)",
              margin: 0,
            }}
          >
            You&apos;re already an Issuer.{" "}
            <strong>{ISSUER_KIND_LABELS[existing.kind] ?? "Unknown"}</strong>{" "}
            ·{" "}
            <strong>{ISSUER_TIER_LABELS[existing.trustTier] ?? "Tier 3"}</strong>
          </p>
        </div>
      )}

      {existing && (
        <div className="doc-card" style={{ marginTop: 24 }}>
          <div className="doc-card-h">
            <div className="doc-card-title">Tier review</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              REQUEST · ADMIN APPROVAL
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
                        {ISSUER_TIER_REQUEST_STATUS_LABELS[req.account.status] ??
                          "Unknown"}
                      </div>
                      <div className="rel-target-sub">
                        note URI · {req.account.noteUri || "—"}
                      </div>
                    </div>
                    <div className="rel-validity">
                      <span>Requested</span>
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
              No tier review requests on record yet.
            </p>
          )}

          {existing.trustTier === 3 ? (
            <form onSubmit={onRequestTier}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="label">Requested tier</label>
                  <select
                    className="select mt-1"
                    value={requestTier}
                    onChange={(e) => setRequestTier(Number(e.target.value))}
                  >
                    <option value={2}>Tier 2 · Known Third-party</option>
                    <option value={1}>Tier 1 · Platform / Regulated</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Review note</label>
                  <textarea
                    className="textarea mt-1"
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="Describe your legal entity, license status, website, and why this issuer should be upgraded."
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
                  Requests are reviewed by the registry admin wallet from the issuer admin page.
                </p>
                <button className="btn btn-primary" disabled={requesting}>
                  {requesting ? "Submitting…" : "Request tier review"}
                </button>
              </div>
            </form>
          ) : (
            <p className="hint" style={{ margin: 0 }}>
              This issuer has already been approved above Tier 3. Future changes should go through the admin review console.
            </p>
          )}
        </div>
      )}

      {publicKey && hasProfile && !existing && !done && (
        <form onSubmit={onSubmit} className="doc-card">
          <div className="doc-card-h">
            <div className="doc-card-title">Issuer registration</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              SUBJECT · §1
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">Issuer name</label>
              <input
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme KYB Co."
                maxLength={120}
              />
            </div>
            <div>
              <label className="label">Website (optional)</label>
              <input
                className="input mt-1"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://acme-kyb.com"
                maxLength={200}
              />
            </div>
            <div>
              <label className="label">Issuer kind</label>
              <select
                className="select mt-1"
                value={kind}
                onChange={(e) => setKind(Number(e.target.value))}
              >
                {Object.entries(ISSUER_KIND_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Trust tier</label>
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
                T3 · Self / Community
              </div>
              <p className="hint mt-1">
                Self-registration always lands at Tier 3. Higher tiers (T1
                Platform, T2 Known third-party) are granted only after
                platform review of the issuer&apos;s real-world identity and
                attestation history.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea
                className="textarea mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What kinds of attestations will you issue?"
                maxLength={1200}
              />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={submitting}>
            {submitting ? "Registering…" : "Register Issuer on-chain"}
          </button>
        </form>
      )}

      {done && (
        <p className="text-sm text-claimed">
          Issuer registered. You can now attest relationships from any Entity
          page.
        </p>
      )}
    </div>
  );
}

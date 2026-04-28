"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchIssuer,
  fetchUserProfile,
  registerIssuer,
} from "@/lib/anchor/client";
import { sha256Bytes } from "@/lib/utils/hash";
import {
  ISSUER_KIND,
  ISSUER_KIND_LABELS,
  ISSUER_TIER_LABELS,
} from "@/types";
import type { Issuer } from "@/types";

export default function IssuerRegisterPage() {
  const { publicKey } = useWallet();
  const program = useProgram();

  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [existing, setExisting] = useState<Issuer | null>(null);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<number>(ISSUER_KIND.SELF);
  const [tier, setTier] = useState<number>(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
      const up = await fetch("/api/mock/upload", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify(metadata),
      }).then((r) => r.json());
      if (!up.uri) throw new Error(up.error ?? "Upload failed");

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
              <select
                className="select mt-1"
                value={tier}
                onChange={(e) => setTier(Number(e.target.value))}
              >
                {Object.entries(ISSUER_TIER_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="hint mt-1">
                For the hackathon MVP, anyone can self-register at any tier.
                Production would gate Tier 1 / 2 behind platform onboarding.
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

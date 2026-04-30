"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { useProgram } from "@/lib/anchor/hooks";
import { fetchUserProfile, registerUser } from "@/lib/anchor/client";
import { uploadMetadata } from "@/lib/upload-client";
import {
  validateHeadline,
  validateOptionalUrl,
  validateUsername,
} from "@/lib/utils/validation";
import { Stamp } from "@/components/registry-bits";
import { shortKey } from "@/lib/utils/format";
import type { UserMetadata } from "@/types";

const WORLDID_APP_ID = process.env.NEXT_PUBLIC_WORLDID_APP_ID ?? "";
const WORLDID_RP_ID = process.env.NEXT_PUBLIC_WORLDID_RP_ID ?? "";
const WORLDID_ACTION =
  process.env.NEXT_PUBLIC_WORLDID_ACTION || "register-chaintrust-user";
const WORLDID_ENV: "production" | "staging" =
  process.env.NEXT_PUBLIC_WORLDID_ENV === "production"
    ? "production"
    : "staging";
const worldidEnabled =
  WORLDID_APP_ID.startsWith("app_") && WORLDID_RP_ID.length > 0;

export default function RegisterPage() {
  const router = useRouter();
  const { publicKey, signMessage } = useWallet();
  const program = useProgram();

  const [checking, setChecking] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [existingUsername, setExistingUsername] = useState<string | null>(null);

  // Core form (3 fields)
  const [username, setUsername] = useState("");
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");

  // Advanced (collapsible)
  const [linkX, setLinkX] = useState("");
  const [linkGithub, setLinkGithub] = useState("");
  const [linkLinkedin, setLinkLinkedin] = useState("");
  const [linkSite, setLinkSite] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // World ID state
  const [humanVerified, setHumanVerified] = useState(!worldidEnabled);
  const [humanCheckLoading, setHumanCheckLoading] = useState(false);

  useEffect(() => {
    if (!program || !publicKey) return;
    let alive = true;
    setChecking(true);
    fetchUserProfile(program, publicKey)
      .then((p) => {
        if (!alive) return;
        if (p) {
          setAlreadyRegistered(true);
          setExistingUsername(p.username);
        }
      })
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [program, publicKey]);

  useEffect(() => {
    if (!worldidEnabled || !publicKey) return;
    let alive = true;
    setHumanCheckLoading(true);
    fetch(`/api/worldid/check?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive && j.verified) setHumanVerified(true);
      })
      .finally(() => alive && setHumanCheckLoading(false));
    return () => {
      alive = false;
    };
  }, [publicKey]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!program || !publicKey) {
      setError("Connect a wallet first.");
      return;
    }
    if (worldidEnabled && !humanVerified) {
      setError("Verify with World ID before filing your profile.");
      return;
    }
    const uerr = validateUsername(username);
    if (uerr) {
      setError(uerr);
      return;
    }
    const herr = validateHeadline(headline);
    if (herr) {
      setError(herr);
      return;
    }
    for (const [label, v] of [
      ["X", linkX],
      ["GitHub", linkGithub],
      ["LinkedIn", linkLinkedin],
      ["Website", linkSite],
    ] as const) {
      const lerr = validateOptionalUrl(v);
      if (lerr) {
        setError(`${label}: ${lerr}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const metadata: UserMetadata = {
        headline: headline.trim(),
        about: about.trim() || undefined,
        links: {
          x: linkX.trim() || undefined,
          github: linkGithub.trim() || undefined,
          linkedin: linkLinkedin.trim() || undefined,
          site: linkSite.trim() || undefined,
        },
      };

      const up = await uploadMetadata(
        publicKey,
        signMessage,
        JSON.stringify(metadata),
      );
      await registerUser(program, publicKey, username, up.uri);
      router.push(`/profile/${publicKey.toBase58()}`);
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Pre-form gates ----

  if (!publicKey) {
    return (
      <div data-screen="register">
        <PageHeader />
        <div className="no-result">CONNECT A SOLANA WALLET TO CONTINUE.</div>
      </div>
    );
  }

  if (checking) {
    return (
      <div data-screen="register">
        <PageHeader />
        <div className="no-result">CHECKING ON-CHAIN PROFILE…</div>
      </div>
    );
  }

  if (alreadyRegistered) {
    return (
      <div data-screen="register">
        <PageHeader />
        <div className="doc-card" style={{ maxWidth: 640 }}>
          <div
            className="docnum"
            style={{ marginBottom: 8, color: "var(--stamp-deep)" }}
          >
            ◆ ALREADY ON RECORD
          </div>
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 16,
              color: "var(--ink)",
              margin: "0 0 16px",
            }}
          >
            This wallet already has an on-chain profile{" "}
            {existingUsername && (
              <>
                (
                <span className="mono" style={{ color: "var(--stamp-deep)" }}>
                  @{existingUsername}
                </span>
                ).
              </>
            )}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => router.push(`/profile/${publicKey.toBase58()}`)}
          >
            Open profile →
          </button>
        </div>
      </div>
    );
  }

  // ---- Layout: wizard left / live preview right ----

  return (
    <div data-screen="register">
      <PageHeader />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 32,
          alignItems: "start",
        }}
      >
        {/* LEFT */}
        <div>
          {/* Step 1 — World ID gate */}
          <WorldIdGate
            humanVerified={humanVerified}
            loading={humanCheckLoading}
            onSuccess={() => setHumanVerified(true)}
            wallet={publicKey.toBase58()}
          />

          {/* Step 2 — Disclosure notice (only after gate, not blocking) */}
          {humanVerified && (
            <div
              className="doc-card"
              style={{
                marginTop: 24,
                borderColor: "var(--stamp-deep)",
                background: "var(--paper-2)",
              }}
            >
              <div
                className="docnum"
                style={{ marginBottom: 6, color: "var(--stamp-deep)" }}
              >
                ◆ § 2 · DISCLOSURE NOTICE
              </div>
              <p
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 15,
                  color: "var(--ink)",
                  margin: "0 0 8px",
                  lineHeight: 1.55,
                }}
              >
                <strong>
                  Everything below is publicly readable, append-only, and
                  cannot be deleted.
                </strong>
              </p>
              <p
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 14,
                  color: "var(--ink-2)",
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                Your username and a pointer to off-chain metadata are written
                to Solana under PDA <span className="mono">
                  [&quot;user&quot;, {shortKey(publicKey, 4)}]
                </span>
                . Do not enter information you would not want a stranger to
                read in five years.
              </p>
            </div>
          )}

          {/* Step 3 — The form */}
          {humanVerified && (
            <form
              onSubmit={onSubmit}
              className="doc-card"
              style={{ marginTop: 24 }}
            >
              <div className="doc-card-h">
                <div className="doc-card-title">§ 3 · User record</div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--ink-3)",
                    letterSpacing: "0.1em",
                  }}
                >
                  3 FIELDS · CORE
                </div>
              </div>

              <div className="form-row">
                <label className="label">Handle (on-chain)</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 14,
                      color: "var(--stamp-deep)",
                      fontWeight: 600,
                    }}
                  >
                    @
                  </span>
                  <input
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_-]/g, ""),
                      )
                    }
                    placeholder="acme_compliance"
                    maxLength={32}
                  />
                </div>
                <div className="hint">
                  Letters, digits, underscore, dash. Used in your profile URL
                  and across the registry.
                </div>
              </div>

              <div className="form-row">
                <label className="label">Display name / role line</label>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Compliance lead at Acme · KYB analyst"
                  maxLength={120}
                />
                <div className="hint">
                  One line, shown next to your handle. This is what consumers
                  see when judging your role on the registry.
                </div>
              </div>

              <div className="form-row">
                <label className="label">About (optional · one line)</label>
                <input
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="What kinds of attestations you sign or rely on."
                  maxLength={200}
                />
              </div>

              <details
                style={{
                  borderTop: "1px solid var(--rule-soft)",
                  paddingTop: 16,
                  marginTop: 8,
                }}
              >
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
                  ▸ EXTERNAL LINKS (optional · X · GitHub · LinkedIn · Site)
                </summary>
                <div className="form-grid-2">
                  <div className="form-row">
                    <label className="label">X / Twitter</label>
                    <input
                      value={linkX}
                      onChange={(e) => setLinkX(e.target.value)}
                      placeholder="https://x.com/handle"
                      maxLength={200}
                    />
                  </div>
                  <div className="form-row">
                    <label className="label">GitHub</label>
                    <input
                      value={linkGithub}
                      onChange={(e) => setLinkGithub(e.target.value)}
                      placeholder="https://github.com/handle"
                      maxLength={200}
                    />
                  </div>
                  <div className="form-row">
                    <label className="label">LinkedIn</label>
                    <input
                      value={linkLinkedin}
                      onChange={(e) => setLinkLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/handle"
                      maxLength={200}
                    />
                  </div>
                  <div className="form-row">
                    <label className="label">Personal website</label>
                    <input
                      value={linkSite}
                      onChange={(e) => setLinkSite(e.target.value)}
                      placeholder="https://yourdomain.dev"
                      maxLength={200}
                    />
                  </div>
                </div>
              </details>

              {error && (
                <p className="error" style={{ marginTop: 8 }}>
                  {error}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: "1px solid var(--rule-soft)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => router.push("/")}
                >
                  ← Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-stamp"
                  disabled={
                    submitting || (worldidEnabled && !humanVerified)
                  }
                >
                  {submitting ? "FILING…" : "◆ Sign & file user record"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* RIGHT — live preview */}
        <div className="doc-card" style={{ position: "sticky", top: 24 }}>
          <div className="doc-card-h">
            <div className="doc-card-title">Live preview</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              UNFILED DRAFT
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              WALLET
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-2)",
                wordBreak: "break-all",
              }}
            >
              {publicKey.toBase58()}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              HANDLE
            </div>
            {username ? (
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 16,
                  color: "var(--stamp-deep)",
                  fontWeight: 600,
                }}
              >
                @{username}
              </div>
            ) : (
              <div className="hint">— HANDLE NOT SET —</div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              DISPLAY LINE
            </div>
            {headline ? (
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 16,
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {headline}
              </div>
            ) : (
              <div className="hint">— DISPLAY LINE NOT SET —</div>
            )}
          </div>

          {about && (
            <div style={{ marginBottom: 16 }}>
              <div className="docnum" style={{ marginBottom: 4 }}>
                ABOUT
              </div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 13,
                  color: "var(--ink-2)",
                  lineHeight: 1.5,
                }}
              >
                {about}
              </div>
            </div>
          )}

          <div
            className="rule-h-soft"
            style={{
              paddingTop: 14,
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--ink-3)",
              letterSpacing: "0.04em",
              lineHeight: 1.7,
            }}
          >
            <div>WORLD ID · {humanVerified ? "✓ VERIFIED" : "PENDING"}</div>
            <div>
              EXTERNAL LINKS ·{" "}
              {[linkX, linkGithub, linkLinkedin, linkSite].filter((s) =>
                s.trim(),
              ).length}
            </div>
            <div>METADATA URI · ipfs://… (assigned at signing)</div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Stamp text="Pending" sub="UNFILED" size="small" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <>
      <div className="docnum" style={{ marginBottom: 8 }}>
        FORM CT-USR · 2026 EDITION · ART. 5.1
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          Register a verified user.
        </h2>
        <span className="section-meta">
          PDA seeds: [&quot;user&quot;, wallet]
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
        One human, one wallet, one profile. Verified users can file entities,
        sign as issuers, and add community signals on-chain. Authority on
        the registry comes from <em>signed attestations</em>, not from
        biographical detail — so this form is intentionally short.
      </p>
    </>
  );
}

function WorldIdGate({
  humanVerified,
  loading,
  onSuccess,
  wallet,
}: {
  humanVerified: boolean;
  loading: boolean;
  onSuccess: () => void;
  wallet: string;
}) {
  const { signMessage } = useWallet();
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [fetchingSig, setFetchingSig] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  if (!worldidEnabled) {
    return (
      <div
        className="doc-card"
        style={{
          borderColor: "var(--warn)",
          background: "rgba(196, 165, 118, 0.08)",
        }}
      >
        <div
          className="docnum"
          style={{ marginBottom: 6, color: "var(--warn)" }}
        >
          ⚠ § 1 · DEV MODE — World ID NOT CONFIGURED
        </div>
        <p
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            color: "var(--ink-2)",
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          Set <code className="mono">NEXT_PUBLIC_WORLDID_APP_ID</code> and{" "}
          <code className="mono">NEXT_PUBLIC_WORLDID_RP_ID</code> in{" "}
          <code className="mono">.env.local</code> to enforce
          proof-of-personhood. Without them, anti-sybil is bypassed.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="doc-card">
        <div className="docnum" style={{ marginBottom: 6 }}>
          § 1 · CHECKING WORLD ID…
        </div>
        <p className="hint">CHECKING PREVIOUS PROOF-OF-PERSONHOOD…</p>
      </div>
    );
  }

  if (humanVerified) {
    return (
      <div
        className="doc-card"
        style={{
          borderColor: "var(--good)",
          background: "rgba(158, 184, 156, 0.10)",
        }}
      >
        <div
          className="docnum"
          style={{ marginBottom: 6, color: "#4a6648" }}
        >
          ✓ § 1 · VERIFIED WITH WORLD ID
        </div>
        <p
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            color: "var(--ink)",
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          This wallet has passed proof-of-personhood. Continue below to file
          your record.
        </p>
      </div>
    );
  }

  async function startVerify() {
    setGateError(null);
    setFetchingSig(true);
    try {
      const sig = await fetch("/api/worldid/rp-signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: WORLDID_ACTION }),
      }).then((r) => r.json());
      if (!sig.ok) throw new Error(sig.error ?? "Failed to sign rp_context");

      setRpContext({
        rp_id: WORLDID_RP_ID,
        nonce: sig.nonce,
        created_at: sig.created_at,
        expires_at: sig.expires_at,
        signature: sig.sig,
      });
      setWidgetOpen(true);
    } catch (err) {
      setGateError((err as Error).message ?? "Failed to start verification");
    } finally {
      setFetchingSig(false);
    }
  }

  async function handleVerify(result: IDKitResult) {
    if (!signMessage) {
      throw new Error(
        "Connected wallet does not support message signing. Use a wallet that exposes signMessage (e.g. Phantom, Backpack).",
      );
    }
    // Step A — server-issued, wallet-bound challenge.
    const chResp = await fetch(
      `/api/worldid/challenge?wallet=${encodeURIComponent(wallet)}`,
    );
    if (!chResp.ok) {
      throw new Error("Could not fetch World ID challenge");
    }
    const ch = (await chResp.json()) as {
      nonce: string;
      message: string;
      expiresAt: number;
    };
    if (!ch?.nonce || !ch?.message) {
      throw new Error("Bad challenge payload");
    }
    // Step B — wallet signs the challenge so the server can prove the wallet
    // owner is the one binding the nullifier.
    const sig = await signMessage(new TextEncoder().encode(ch.message));
    const signature = bs58.encode(sig);

    const resp = await fetch("/api/worldid/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        result,
        wallet,
        nonce: ch.nonce,
        signature,
      }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.ok) {
      throw new Error(json.error ?? "World ID verification failed");
    }
  }

  return (
    <div
      className="doc-card"
      style={{
        borderColor: "var(--stamp-deep)",
        background: "var(--paper-2)",
      }}
    >
      <div className="doc-card-h">
        <div className="doc-card-title">§ 1 · Proof-of-personhood</div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--ink-3)",
            letterSpacing: "0.1em",
          }}
        >
          GATE · REQUIRED
        </div>
      </div>
      <p
        style={{
          fontFamily: "var(--serif)",
          fontSize: 15,
          color: "var(--ink-2)",
          margin: "0 0 16px",
          lineHeight: 1.55,
        }}
      >
        ChainTrust uses <strong>World ID</strong> so that one real human can
        register only one profile per wallet. Your World ID does not reveal
        your identity — it only confirms you are a unique human within this
        app&apos;s namespace.
      </p>
      <button
        type="button"
        className="btn btn-stamp"
        onClick={startVerify}
        disabled={fetchingSig}
      >
        {fetchingSig ? "PREPARING…" : "◆ Verify with World ID"}
      </button>
      {gateError && (
        <p className="error" style={{ marginTop: 12 }}>
          {gateError}
        </p>
      )}

      {rpContext && (
        <IDKitRequestWidget
          open={widgetOpen}
          onOpenChange={setWidgetOpen}
          app_id={WORLDID_APP_ID as `app_${string}`}
          action={WORLDID_ACTION}
          environment={WORLDID_ENV}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          preset={orbLegacy({ signal: wallet })}
          handleVerify={handleVerify}
          onSuccess={() => {
            setWidgetOpen(false);
            onSuccess();
          }}
        />
      )}
    </div>
  );
}

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
import { useT } from "@/lib/i18n";

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
const PUBLIC_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "devnet";
const mockHumanProofEnabled =
  process.env.NODE_ENV !== "production" &&
  /(?:127\.0\.0\.1|localhost)/.test(PUBLIC_RPC);

function explainWorldIdError(message: string): string {
  if (
    message.includes(
      "This identity has already registered a ChainTrust profile from a different wallet.",
    ) ||
    message.includes("nullifier_reused")
  ) {
    return "This World ID simulator identity is already bound to another wallet. For local testing, use the local mock proof button below or reset your local World ID state.";
  }
  if (message.includes("bufferUtil.mask is not a function")) {
    return "Your runtime hit a websocket issue while waiting for signature confirmation. We now use an HTTP polling path on the server, so retry verification and use local mock proof if this persists.";
  }
  return message;
}

export default function RegisterPage() {
  const router = useRouter();
  const { publicKey, signMessage } = useWallet();
  const program = useProgram();
  const t = useT();

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
      setError(t("register.errors.connect"));
      return;
    }
    if (worldidEnabled && !humanVerified) {
      setError(t("register.errors.worldId"));
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
      setError((err as Error).message ?? t("register.errors.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Pre-form gates ----

  if (!publicKey) {
    return (
      <div data-screen="register">
        <PageHeader />
        <div className="no-result">{t("register.connect")}</div>
      </div>
    );
  }

  if (checking) {
    return (
      <div data-screen="register">
        <PageHeader />
        <div className="no-result">{t("register.checking")}</div>
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
            {t("register.already.title")}
          </div>
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 16,
              color: "var(--ink)",
              margin: "0 0 16px",
            }}
          >
            {t("register.already.body.lead")}{" "}
            {existingUsername && (
              <>
                (
                <span className="mono" style={{ color: "var(--stamp-deep)" }}>
                  @{existingUsername}
                </span>
                )
              </>
            )}
            {t("register.already.body.tail")}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => router.push(`/profile/${publicKey.toBase58()}`)}
          >
            {t("register.openProfile")}
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
                {t("register.disclosure.title")}
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
                <strong>{t("register.disclosure.bold")}</strong>
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
                {t("register.disclosure.body.lead")}
                <span className="mono">
                  [&quot;user&quot;, {shortKey(publicKey, 4)}]
                </span>
                {t("register.disclosure.body.tail")}
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
                <div className="doc-card-title">{t("register.form.title")}</div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--ink-3)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {t("register.form.meta")}
                </div>
              </div>

              <div className="form-row">
                <label className="label">{t("register.form.handle.label")}</label>
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
                    placeholder={t("register.form.handle.placeholder")}
                    maxLength={32}
                  />
                </div>
                <div className="hint">{t("register.form.handle.hint")}</div>
              </div>

              <div className="form-row">
                <label className="label">{t("register.form.headline.label")}</label>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder={t("register.form.headline.placeholder")}
                  maxLength={120}
                />
                <div className="hint">{t("register.form.headline.hint")}</div>
              </div>

              <div className="form-row">
                <label className="label">{t("register.form.about.label")}</label>
                <input
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder={t("register.form.about.placeholder")}
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
                  {t("register.form.links.summary")}
                </summary>
                <div className="form-grid-2">
                  <div className="form-row">
                    <label className="label">{t("register.form.links.x")}</label>
                    <input
                      value={linkX}
                      onChange={(e) => setLinkX(e.target.value)}
                      placeholder="https://x.com/handle"
                      maxLength={200}
                    />
                  </div>
                  <div className="form-row">
                    <label className="label">{t("register.form.links.github")}</label>
                    <input
                      value={linkGithub}
                      onChange={(e) => setLinkGithub(e.target.value)}
                      placeholder="https://github.com/handle"
                      maxLength={200}
                    />
                  </div>
                  <div className="form-row">
                    <label className="label">{t("register.form.links.linkedin")}</label>
                    <input
                      value={linkLinkedin}
                      onChange={(e) => setLinkLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/handle"
                      maxLength={200}
                    />
                  </div>
                  <div className="form-row">
                    <label className="label">{t("register.form.links.site")}</label>
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
                  {t("register.form.btn.cancel")}
                </button>
                <button
                  type="submit"
                  className="btn btn-stamp"
                  disabled={
                    submitting || (worldidEnabled && !humanVerified)
                  }
                >
                  {submitting
                    ? t("register.form.btn.submitting")
                    : t("register.form.btn.submit")}
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
  const t = useT();
  return (
    <>
      <div className="docnum" style={{ marginBottom: 8 }}>
        {t("register.docnum")}
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          {t("register.title")}
        </h2>
        <span className="section-meta">{t("register.meta")}</span>
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
        {t("register.intro")}
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
  const t = useT();
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [fetchingSig, setFetchingSig] = useState(false);
  const [mockingProof, setMockingProof] = useState(false);
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
          {t("register.gate.notConfigured.body")}
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
        <p className="hint">{t("register.gate.checking")}</p>
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
          {t("register.gate.verified.body")}
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
    setGateError(null);
    try {
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
        throw new Error(
          explainWorldIdError(json.error ?? "World ID verification failed"),
        );
      }
    } catch (err) {
      const message = explainWorldIdError(
        (err as Error).message ?? "World ID verification failed",
      );
      setWidgetOpen(false);
      setRpContext(null);
      setGateError(message);
      throw new Error(message);
    }
  }

  async function issueMockProof() {
    setGateError(null);
    setMockingProof(true);
    try {
      const resp = await fetch("/api/dev/humanproof", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        throw new Error(
          explainWorldIdError(json.error ?? "Failed to issue local mock proof"),
        );
      }
      setWidgetOpen(false);
      setRpContext(null);
      onSuccess();
    } catch (err) {
      setGateError(
        explainWorldIdError(
          (err as Error).message ?? "Failed to issue local mock proof",
        ),
      );
    } finally {
      setMockingProof(false);
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
        <div className="doc-card-title">{t("register.gate.title")}</div>
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
        {t("register.gate.intro.lead")}
        <strong>{t("register.gate.intro.bold")}</strong>
        {t("register.gate.intro.tail")}
      </p>
      <button
        type="button"
        className="btn btn-stamp"
        onClick={startVerify}
        disabled={fetchingSig}
      >
        {fetchingSig
          ? t("register.gate.btn.preparing")
          : t("register.gate.btn.verify")}
      </button>
      {mockHumanProofEnabled && (
        <>
          <div
            className="hint"
            style={{ marginTop: 12, marginBottom: 8, maxWidth: "60ch" }}
          >
            {t("register.gate.mock.hint")}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={issueMockProof}
            disabled={mockingProof}
          >
            {mockingProof
              ? t("register.gate.mock.btn.busy")
              : t("register.gate.mock.btn")}
          </button>
        </>
      )}
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
          onError={(errorCode) => {
            if (errorCode === "failed_by_host_app") return;
            if (errorCode === "verification_rejected") {
              setGateError(
                "World ID verification was cancelled or rejected before ChainTrust could bind your wallet.",
              );
              return;
            }
            setGateError(
              `World ID verification did not complete (${errorCode}).`,
            );
          }}
          onSuccess={() => {
            setWidgetOpen(false);
            setGateError(null);
            onSuccess();
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { useProgram } from "@/lib/anchor/hooks";
import { fetchUserProfile, registerUser } from "@/lib/anchor/client";
import {
  validateHeadline,
  validateOptionalUrl,
  validateUsername,
} from "@/lib/utils/validation";
import type { UserMetadata, WorkExperienceItem } from "@/types";

const EMPTY_EXPERIENCE: WorkExperienceItem = {
  company: "",
  role: "",
  fromYear: null,
  toYear: null,
};

const WORLDID_APP_ID = process.env.NEXT_PUBLIC_WORLDID_APP_ID ?? "";
const WORLDID_RP_ID = process.env.NEXT_PUBLIC_WORLDID_RP_ID ?? "";
const WORLDID_ACTION =
  process.env.NEXT_PUBLIC_WORLDID_ACTION || "register-chaintrust-user";
// v4 IDKit takes an `environment` prop ("staging" | "production").
// Default to "staging" so dev runs work with the simulator out-of-the-box.
const WORLDID_ENV: "production" | "staging" =
  process.env.NEXT_PUBLIC_WORLDID_ENV === "production"
    ? "production"
    : "staging";
// v4 requires both an app_id (must start with `app_`) and an rp_id from the
// developer portal. If either is missing we fall back to dev-mode (no
// proof-of-personhood gating).
const worldidEnabled =
  WORLDID_APP_ID.startsWith("app_") && WORLDID_RP_ID.length > 0;

export default function RegisterPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [checking, setChecking] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [existingUsername, setExistingUsername] = useState<string | null>(null);

  // Form state
  const [username, setUsername] = useState("");
  const [headline, setHeadline] = useState("");
  const [expertiseRaw, setExpertiseRaw] = useState("");
  const [experience, setExperience] = useState<WorkExperienceItem[]>([
    { ...EMPTY_EXPERIENCE },
  ]);
  const [linkX, setLinkX] = useState("");
  const [linkGithub, setLinkGithub] = useState("");
  const [linkLinkedin, setLinkLinkedin] = useState("");
  const [linkSite, setLinkSite] = useState("");
  const [about, setAbout] = useState("");

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

  // Returning user: skip widget if this wallet has already passed World ID.
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

  function updateExperience(i: number, patch: Partial<WorkExperienceItem>) {
    setExperience((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );
  }
  function addExperience() {
    setExperience((prev) => [...prev, { ...EMPTY_EXPERIENCE }]);
  }
  function removeExperience(i: number) {
    setExperience((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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
    if (worldidEnabled && !humanVerified) {
      setError("Verify with World ID before creating a profile.");
      return;
    }
    if (!program || !publicKey) {
      setError("Connect a wallet first.");
      return;
    }

    setSubmitting(true);
    try {
      const expertise = expertiseRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const liveExperience = experience
        .filter((e) => e.company.trim() || e.role.trim())
        .map((e) => ({
          company: e.company.trim(),
          role: e.role.trim(),
          fromYear: e.fromYear ?? null,
          toYear: e.toYear ?? null,
        }));

      const metadata: UserMetadata = {
        headline: headline.trim(),
        expertise,
        workExperience: liveExperience,
        links: {
          x: linkX.trim() || undefined,
          github: linkGithub.trim() || undefined,
          linkedin: linkLinkedin.trim() || undefined,
          site: linkSite.trim() || undefined,
        },
        about: about.trim() || undefined,
      };

      const up = await fetch("/api/mock/upload", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify(metadata),
      }).then((r) => r.json());
      if (!up.uri) throw new Error(up.error ?? "Upload failed");

      await registerUser(program, publicKey, username, up.uri);
      router.push(`/profile/${publicKey.toBase58()}`);
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!publicKey) {
    return (
      <Prose>
        <h1 className="serif text-3xl font-semibold text-ink-800">Register</h1>
        <p>Connect your Solana wallet to register a ChainTrust user profile.</p>
      </Prose>
    );
  }

  if (checking) {
    return (
      <Prose>
        <h1 className="serif text-3xl font-semibold text-ink-800">Register</h1>
        <p>Checking on-chain profile…</p>
      </Prose>
    );
  }

  if (alreadyRegistered) {
    return (
      <Prose>
        <h1 className="serif text-3xl font-semibold text-ink-800">
          Already registered
        </h1>
        <p>
          This wallet already has an on-chain profile{" "}
          {existingUsername && (
            <>
              (<span className="mono">@{existingUsername}</span>)
            </>
          )}
          .
        </p>
        <button
          className="btn"
          onClick={() => router.push(`/profile/${publicKey.toBase58()}`)}
        >
          Go to profile
        </button>
      </Prose>
    );
  }

  return (
    <div className="max-w-2xl">
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
          marginBottom: 24,
        }}
      >
        One human, one wallet, one profile. Verified users can file entities,
        sign as issuers, and add community signals on-chain.
      </p>

      <WorldIdGate
        humanVerified={humanVerified}
        loading={humanCheckLoading}
        onSuccess={() => setHumanVerified(true)}
        wallet={publicKey.toBase58()}
      />

      <div className="border border-accent/40 bg-accent/5 p-4 text-sm text-ink-700">
        <p className="font-semibold text-accent">All fields below are public.</p>
        <p className="mt-1">
          Your username and a pointer to your profile metadata are written to
          Solana. Headline, expertise, work history, links, and about are
          stored at that pointer (mocked locally for the demo; IPFS in
          production). Anyone can read them. Don't enter information you don't
          want public.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="space-y-4">
          <div>
            <label className="label">Username (handle)</label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-ink-500">@</span>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="alice_web3"
                maxLength={32}
              />
            </div>
            <p className="hint mt-1">
              Letters, digits, underscore, or dash. Used in your profile URL.
            </p>
          </div>

          <div>
            <label className="label">Headline</label>
            <input
              className="input mt-1"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Smart contract auditor at Trail of Bits"
              maxLength={120}
            />
            <p className="hint mt-1">
              One line. This is the main thing other users see when judging
              whether your reviews are credible.
            </p>
          </div>

          <div>
            <label className="label">Areas of expertise</label>
            <input
              className="input mt-1"
              value={expertiseRaw}
              onChange={(e) => setExpertiseRaw(e.target.value)}
              placeholder="Solana, MEV, Smart contract audits"
              maxLength={200}
            />
            <p className="hint mt-1">Comma-separated. Up to 5 tags.</p>
          </div>
        </section>

        <section className="space-y-3 border-t border-ink-200 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="serif text-lg font-semibold text-ink-800">
                Work experience
              </h2>
              <p className="hint">
                Optional. Helps reviewers gauge the weight of your reviews.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={addExperience}
            >
              + Add role
            </button>
          </div>
          <div className="space-y-2">
            {experience.map((exp, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-sm border border-ink-200 bg-white p-3 md:grid-cols-[2fr_2fr_80px_80px_auto]"
              >
                <input
                  className="input"
                  value={exp.company}
                  onChange={(e) =>
                    updateExperience(i, { company: e.target.value })
                  }
                  placeholder="Company"
                  maxLength={80}
                />
                <input
                  className="input"
                  value={exp.role}
                  onChange={(e) =>
                    updateExperience(i, { role: e.target.value })
                  }
                  placeholder="Role"
                  maxLength={80}
                />
                <input
                  className="input"
                  value={exp.fromYear ?? ""}
                  onChange={(e) =>
                    updateExperience(i, {
                      fromYear: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  placeholder="From"
                  type="number"
                  min={1950}
                  max={2100}
                />
                <input
                  className="input"
                  value={exp.toYear ?? ""}
                  onChange={(e) =>
                    updateExperience(i, {
                      toYear: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="To"
                  type="number"
                  min={1950}
                  max={2100}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => removeExperience(i)}
                  disabled={experience.length === 1}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p className="hint">
            Leave the year fields empty to omit dates. "To" empty means
            current.
          </p>
        </section>

        <section className="space-y-4 border-t border-ink-200 pt-6">
          <div>
            <h2 className="serif text-lg font-semibold text-ink-800">Links</h2>
            <p className="hint">
              Optional. External profiles other users can use to verify you.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">X / Twitter</label>
              <input
                className="input mt-1"
                value={linkX}
                onChange={(e) => setLinkX(e.target.value)}
                placeholder="https://x.com/alice"
                maxLength={200}
              />
            </div>
            <div>
              <label className="label">GitHub</label>
              <input
                className="input mt-1"
                value={linkGithub}
                onChange={(e) => setLinkGithub(e.target.value)}
                placeholder="https://github.com/alice"
                maxLength={200}
              />
            </div>
            <div>
              <label className="label">LinkedIn</label>
              <input
                className="input mt-1"
                value={linkLinkedin}
                onChange={(e) => setLinkLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/alice"
                maxLength={200}
              />
            </div>
            <div>
              <label className="label">Personal website</label>
              <input
                className="input mt-1"
                value={linkSite}
                onChange={(e) => setLinkSite(e.target.value)}
                placeholder="https://alice.dev"
                maxLength={200}
              />
            </div>
          </div>
        </section>

        <section className="space-y-2 border-t border-ink-200 pt-6">
          <label className="label">About (optional)</label>
          <textarea
            className="textarea mt-1"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Anything else worth knowing — focus areas, prior work, what kinds of projects you'll review."
            maxLength={1500}
          />
        </section>

        {error && <p className="error">{error}</p>}

        <button
          className="btn"
          disabled={submitting || (worldidEnabled && !humanVerified)}
        >
          {submitting ? "Creating profile…" : "Create profile on-chain"}
        </button>
      </form>
    </div>
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
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [fetchingSig, setFetchingSig] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  if (!worldidEnabled) {
    return (
      <div className="border border-yellow-500/50 bg-yellow-50 p-4 text-sm text-ink-700">
        <p className="font-semibold text-yellow-900">
          ⚠ World ID not configured (development mode)
        </p>
        <p className="mt-1">
          Set <code className="mono">NEXT_PUBLIC_WORLDID_APP_ID</code> and
          <code className="mono"> NEXT_PUBLIC_WORLDID_RP_ID</code> in
          <code className="mono"> .env.local</code> to enable proof-of-personhood
          gating. Without them, anti-sybil is not enforced.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border border-ink-200 bg-white p-4 text-sm text-ink-600">
        Checking previous World ID verification…
      </div>
    );
  }

  if (humanVerified) {
    return (
      <div className="border border-verified/60 bg-verified/5 p-4 text-sm text-ink-700">
        <p className="font-semibold text-verified">✓ Verified with World ID</p>
        <p className="mt-1">
          This wallet has passed proof-of-personhood. Continue filling in your
          profile below.
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
    const resp = await fetch("/api/worldid/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result, wallet }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.ok) {
      throw new Error(json.error ?? "World ID verification failed");
    }
  }

  return (
    <div className="border-2 border-dashed border-accent/50 bg-accent/5 p-4">
      <p className="font-semibold text-accent">
        Step 1 — Prove you're a real person
      </p>
      <p className="mt-1 text-sm text-ink-700">
        ChainTrust uses World ID to ensure one real human can register only one
        profile. Your World ID does not reveal who you are; it only confirms
        you're a unique human in this app's namespace.
      </p>
      <div className="mt-3 space-y-2">
        <button
          type="button"
          className="btn"
          onClick={startVerify}
          disabled={fetchingSig}
        >
          {fetchingSig ? "Preparing…" : "Verify with World ID"}
        </button>
        {gateError && <p className="error">{gateError}</p>}
      </div>

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

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="max-w-xl space-y-3 text-sm text-ink-700">{children}</div>;
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
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

export default function RegisterPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [checking, setChecking] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [existingUsername, setExistingUsername] = useState<string | null>(null);

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
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="serif text-3xl font-semibold text-ink-800">
          Register as a verified user
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          One wallet, one profile. Verified users can create entries, link
          wallets, leave reviews, and reply.
        </p>
      </header>

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
              Currently not enforced as globally unique on-chain.
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

        <button className="btn" disabled={submitting}>
          {submitting ? "Creating profile…" : "Create profile on-chain"}
        </button>
      </form>

      <p className="hint border-t border-ink-200 pt-4">
        Anti-sybil check is mocked for the hackathon. A production version
        would require a lightweight proof-of-personhood check before
        registration.
      </p>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="max-w-xl space-y-3 text-sm text-ink-700">{children}</div>;
}

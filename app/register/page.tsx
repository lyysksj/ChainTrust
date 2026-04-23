"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import { fetchUserProfile, registerUser } from "@/lib/anchor/client";
import {
  validateDisplayName,
  validateUsername,
} from "@/lib/utils/validation";

export default function RegisterPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [checking, setChecking] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [existingUsername, setExistingUsername] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const uerr = validateUsername(username);
    const derr = validateDisplayName(displayName);
    if (uerr || derr) {
      setError(uerr ?? derr);
      return;
    }
    if (!program || !publicKey) {
      setError("Connect a wallet first.");
      return;
    }
    setSubmitting(true);
    try {
      let metadataUri = "";
      if (bio.trim()) {
        const up = await fetch("/api/mock/upload", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: JSON.stringify({ bio: bio.trim() }),
        }).then((r) => r.json());
        metadataUri = up.uri ?? "";
      }
      await registerUser(program, publicKey, username, displayName, metadataUri);
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
        <h1>Register</h1>
        <p>Connect your Solana wallet to register a ChainTrust user profile.</p>
      </Prose>
    );
  }

  if (checking) {
    return (
      <Prose>
        <h1>Register</h1>
        <p>Checking on-chain profile…</p>
      </Prose>
    );
  }

  if (alreadyRegistered) {
    return (
      <Prose>
        <h1>Already registered</h1>
        <p>
          This wallet already has an on-chain profile{" "}
          {existingUsername && <>(<span className="mono">{existingUsername}</span>)</>}.
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
    <div className="max-w-xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-ink-500">Step 1</p>
        <h1 className="serif mt-2 text-3xl font-semibold text-ink-800">
          Register as a verified user
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          One wallet, one profile. Verified users can create entries, link wallets, and submit reviews.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <input
            className="input mt-1"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="alice_web3"
            maxLength={32}
          />
          <p className="hint mt-1">Letters, digits, underscore, or dash.</p>
        </div>
        <div>
          <label className="label">Display name</label>
          <input
            className="input mt-1"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Alice Chen"
            maxLength={64}
          />
        </div>
        <div>
          <label className="label">Bio (optional)</label>
          <textarea
            className="textarea mt-1"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Who are you, and what kind of trust signals do you tend to contribute?"
            maxLength={600}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn" disabled={submitting}>
          {submitting ? "Creating profile…" : "Create profile on-chain"}
        </button>
      </form>

      <p className="hint border-t border-ink-200 pt-4">
        Anti-sybil check is mocked for the hackathon. A production version would require a lightweight
        proof-of-personhood check before registration.
      </p>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="max-w-xl space-y-3 text-sm text-ink-700">{children}</div>;
}

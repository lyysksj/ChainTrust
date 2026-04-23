"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import { claimEntry } from "@/lib/anchor/client";

type Props = {
  entryPda: PublicKey;
  domain: string;
  onClaimed?: () => void;
};

export function ClaimCard({ entryPda, domain, onClaimed }: Props) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [step, setStep] = useState<"idle" | "dns" | "sign" | "done">("idle");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [dnsResult, setDnsResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDnsMock() {
    if (!publicKey) return;
    setError(null);
    setStep("dns");
    const resp = await fetch(
      `/api/mock/verify?wallet=${encodeURIComponent(publicKey.toBase58())}`,
    ).then((r) => r.json());
    setChallenge(resp.challenge);
  }

  async function confirmDns() {
    if (!publicKey) return;
    setSubmitting(true);
    try {
      const resp = await fetch("/api/mock/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "dns",
          domain,
          wallet: publicKey.toBase58(),
          challenge,
        }),
      }).then((r) => r.json());
      if (!resp.ok) throw new Error(resp.note ?? "DNS verification failed");
      setDnsResult(resp.note);
      setStep("sign");
    } catch (err) {
      setError((err as Error).message ?? "DNS verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmClaim() {
    if (!program || !publicKey) return;
    setSubmitting(true);
    setError(null);
    try {
      await claimEntry(program, publicKey, entryPda);
      setStep("done");
      onClaimed?.();
    } catch (err) {
      setError((err as Error).message ?? "Claim failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 border-2 border-dashed border-claimed/40 bg-claimed/5 p-4">
      <div>
        <h3 className="serif text-lg font-semibold text-ink-800">
          Claim this entry
        </h3>
        <p className="hint">
          Representatives prove control via domain or wallet. Claim unlocks official responses and metadata — it does <span className="font-medium">not</span> delete or rewrite any review.
        </p>
      </div>

      {step === "idle" && (
        <div className="space-y-2">
          <button className="btn" onClick={startDnsMock} disabled={!publicKey}>
            Start claim with {domain || "domain"}
          </button>
          <p className="text-xs text-ink-500">Mock DNS flow — no real DNS lookup is performed.</p>
        </div>
      )}

      {step === "dns" && (
        <div className="space-y-3">
          <div className="rounded-sm border border-ink-200 bg-white p-3 font-mono text-xs text-ink-700">
            <div className="text-ink-500">Add this TXT record to {domain}:</div>
            <div className="mt-1">_chaintrust.{domain}  TXT  "{challenge}"</div>
          </div>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={confirmDns}
              disabled={submitting}
            >
              {submitting ? "Checking…" : "I added the TXT record (mock)"}
            </button>
            <button className="btn-secondary" onClick={() => setStep("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "sign" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-700">DNS verified (mock).</p>
          {dnsResult && <p className="hint">{dnsResult}</p>}
          <div className="flex gap-2">
            <button className="btn" onClick={confirmClaim} disabled={submitting}>
              {submitting ? "Claiming…" : "Sign on-chain claim"}
            </button>
            <button className="btn-secondary" onClick={() => setStep("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <p className="text-sm text-claimed">
          Entry claimed. You can now publish official responses. Reviews remain immutable.
        </p>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

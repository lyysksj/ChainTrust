"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  attestRelationship,
  fetchIssuer,
  fetchProjectsForEntity,
} from "@/lib/anchor/client";
import { sha256Bytes } from "@/lib/utils/hash";
import { REL_KIND, REL_KIND_META } from "@/types";
import type { Issuer, Project } from "@/types";

type Props = {
  entity: PublicKey;
  onSubmitted?: () => void;
};

const KIND_OPTIONS: { value: number; label: string }[] = Object.entries(
  REL_KIND_META,
).map(([k, v]) => ({ value: Number(k), label: v.label }));

export function AddRelationshipForm({ entity, onSubmitted }: Props) {
  const { publicKey } = useWallet();
  const program = useProgram();

  const [issuer, setIssuer] = useState<Issuer | null>(null);
  const [issuerLoading, setIssuerLoading] = useState(true);
  const [projects, setProjects] = useState<
    { publicKey: PublicKey; account: Project }[]
  >([]);

  const [kind, setKind] = useState<number>(REL_KIND.OPERATES_PROJECT);
  const [target, setTarget] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceUri, setEvidenceUri] = useState("");
  const [validUntil, setValidUntil] = useState(""); // YYYY-MM-DD or empty
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!program || !publicKey) return;
    let alive = true;
    (async () => {
      try {
        const [iss, projs] = await Promise.all([
          fetchIssuer(program, publicKey),
          fetchProjectsForEntity(program, entity),
        ]);
        if (!alive) return;
        setIssuer(iss as Issuer | null);
        setProjects(
          projs.map((p) => ({
            publicKey: p.publicKey,
            account: p.account as unknown as Project,
          })),
        );
      } finally {
        if (alive) setIssuerLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program, publicKey, entity]);

  const meta = REL_KIND_META[kind];
  const targetPlaceholder = useMemo(() => {
    switch (meta?.targetType) {
      case "wallet":
        return "Wallet pubkey (base58)";
      case "project":
        return "Project PDA (base58) — pick from list above";
      case "domain":
        return "domain.example (will be hashed)";
      case "person":
        return "Person identifier (e.g. name + DOB; will be hashed)";
      case "entity":
        return "Other Entity PDA (base58)";
      case "issuer":
        return "Issuer PDA (base58)";
      default:
        return "";
    }
  }, [meta]);

  function targetRefBytes(): number[] | { error: string } {
    if (!target.trim()) return { error: "Target is required." };
    const tt = meta?.targetType;
    try {
      if (
        tt === "wallet" ||
        tt === "project" ||
        tt === "entity" ||
        tt === "issuer"
      ) {
        const pk = new PublicKey(target.trim());
        return Array.from(pk.toBytes());
      }
      // domain / person — hash the input string.
      return sha256Bytes(target.trim().toLowerCase());
    } catch {
      return { error: "Invalid target — expected a base58 pubkey." };
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!program || !publicKey) {
      setError("Connect wallet first.");
      return;
    }
    if (!issuer) {
      setError("You must register as an Issuer before attesting relationships.");
      return;
    }
    const targetBytes = targetRefBytes();
    if ("error" in targetBytes) {
      setError(targetBytes.error);
      return;
    }

    let validUntilTs = 0;
    if (validUntil) {
      const d = new Date(validUntil);
      if (Number.isNaN(d.getTime())) {
        setError("Invalid expiry date.");
        return;
      }
      validUntilTs = Math.floor(d.getTime() / 1000);
    }
    const validFromTs = Math.floor(Date.now() / 1000);

    setSubmitting(true);
    try {
      let evUri = evidenceUri.trim();
      if (!evUri && evidenceNote.trim()) {
        const up = await fetch("/api/mock/upload", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: JSON.stringify({ note: evidenceNote.trim() }),
        }).then((r) => r.json());
        if (!up.uri) throw new Error(up.error ?? "Evidence upload failed");
        evUri = up.uri;
      }
      await attestRelationship(program, publicKey, {
        entity,
        kind,
        targetRef: targetBytes,
        evidenceHash: sha256Bytes(evidenceNote || target),
        evidenceUri: evUri,
        validFrom: validFromTs,
        validUntil: validUntilTs,
      });
      setTarget("");
      setEvidenceNote("");
      setEvidenceUri("");
      setValidUntil("");
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? "Attestation failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (issuerLoading) return <p className="hint">Checking issuer status…</p>;

  if (!issuer) {
    return (
      <div className="space-y-2 border border-dashed border-ink-300 bg-white p-4">
        <p className="text-sm text-ink-700">
          Only registered Issuers can attest relationships. Sign signatures bind
          to your Issuer PDA, including the trust tier.
        </p>
        <a href="/issuer/register" className="btn">
          Register as an Issuer
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 border border-ink-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="chip chip-verified">
          You · T{issuer.trustTier} Issuer
        </span>
        {projects.length > 0 && meta?.targetType === "project" && (
          <span className="hint">
            Available project PDAs:{" "}
            {projects.map((p) => p.publicKey.toBase58().slice(0, 6)).join(", ")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="label">Relationship kind</label>
          <select
            className="select mt-1"
            value={kind}
            onChange={(e) => setKind(Number(e.target.value))}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Valid until (optional)</label>
          <input
            type="date"
            className="input mt-1"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Target</label>
          <input
            className="input mt-1 font-mono text-xs"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={targetPlaceholder}
          />
          <p className="hint mt-1">
            For wallets / projects / entities / issuers: paste the base58
            pubkey. For domains and persons: paste a string — it will be hashed
            on-chain so the raw identifier stays off-chain.
          </p>
        </div>
        <div className="md:col-span-2">
          <label className="label">Evidence note</label>
          <textarea
            className="textarea mt-1"
            value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)}
            placeholder="Describe the evidence you reviewed (will be uploaded as the evidence URI)."
            maxLength={2000}
          />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {done && !error && <p className="hint">Attestation published on-chain.</p>}

      <button className="btn" disabled={submitting}>
        {submitting ? "Signing…" : "Sign attestation"}
      </button>
    </form>
  );
}

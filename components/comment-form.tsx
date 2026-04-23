"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import { fetchEntryByPda, submitComment } from "@/lib/anchor/client";
import { sha256Bytes } from "@/lib/utils/hash";

type Props = {
  entryPda: PublicKey;
  onSubmitted?: () => void;
};

export function CommentForm({ entryPda, onSubmitted }: Props) {
  const { publicKey } = useWallet();
  const program = useProgram();

  const [relationType, setRelationType] = useState(4); // default Customer
  const [contractScore, setContractScore] = useState(0);
  const [teamScore, setTeamScore] = useState(0);
  const [productScore, setProductScore] = useState(0);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!program || !publicKey) {
      setError("Connect a wallet first.");
      return;
    }
    if (!body.trim()) {
      setError("Review body is required.");
      return;
    }
    setSubmitting(true);
    try {
      // Upload content off-chain
      const content = JSON.stringify({
        headline: headline.trim() || "(untitled)",
        body: body.trim(),
        relationType,
        contractScore,
        teamScore,
        productScore,
      });
      const up = await fetch("/api/mock/upload", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: content,
      }).then((r) => r.json());
      if (!up.uri) throw new Error(up.error ?? "Upload failed");

      // Read current comment_count for index
      const entry = await fetchEntryByPda(program, entryPda);
      if (!entry) throw new Error("Entry not found");
      const commentIndex = entry.commentCount;

      await submitComment(program, publicKey, {
        entry: entryPda,
        commentIndex,
        relationType,
        contractScore,
        teamScore,
        productScore,
        contentHash: sha256Bytes(content),
        evidenceHash: sha256Bytes(null),
        contentUri: up.uri,
      });

      setHeadline("");
      setBody("");
      setContractScore(0);
      setTeamScore(0);
      setProductScore(0);
      onSubmitted?.();
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border border-ink-200 bg-white p-4">
      <div>
        <h3 className="serif text-base font-semibold text-ink-800">
          Add a review
        </h3>
        <p className="hint">
          Reviews are append-only. Once submitted, content hash and timestamp are anchored on-chain and cannot be edited or deleted.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label className="label">Relationship</label>
          <select
            className="select mt-1"
            value={relationType}
            onChange={(e) => setRelationType(Number(e.target.value))}
          >
            <option value={1}>Employee</option>
            <option value={2}>Partner</option>
            <option value={3}>Investor</option>
            <option value={4}>Customer</option>
            <option value={5}>Other</option>
          </select>
        </div>
        <ScoreField label="Contract" value={contractScore} onChange={setContractScore} />
        <ScoreField label="Team" value={teamScore} onChange={setTeamScore} />
        <ScoreField label="Product" value={productScore} onChange={setProductScore} />
      </div>

      <div>
        <label className="label">Headline (optional)</label>
        <input
          className="input mt-1"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="One-line summary"
          maxLength={140}
        />
      </div>

      <div>
        <label className="label">Review</label>
        <textarea
          className="textarea mt-1"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe the interaction. Stick to facts; provide evidence when possible."
          maxLength={4000}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">
          Claim gives voice, not control. The company cannot edit or remove this review.
        </p>
        <button className="btn" disabled={submitting || !publicKey}>
          {submitting ? "Publishing…" : "Submit on-chain"}
        </button>
      </div>
    </form>
  );
}

function ScoreField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="select mt-1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        <option value={0}>— no opinion</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n} / 5
          </option>
        ))}
      </select>
    </div>
  );
}

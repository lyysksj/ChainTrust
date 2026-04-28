"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import { createProject } from "@/lib/anchor/client";
import { randomProjectId, sha256Bytes } from "@/lib/utils/hash";

type Props = {
  entity: PublicKey;
  onCreated?: () => void;
};

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function AddProjectForm({ entity, onCreated }: Props) {
  const { publicKey } = useWallet();
  const program = useProgram();

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!program || !publicKey) {
      setError("Connect a wallet first.");
      return;
    }
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const metadata = {
        name: name.trim(),
        domain: domain.trim() || undefined,
        description: description.trim() || undefined,
      };
      const up = await fetch("/api/mock/upload", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify(metadata),
      }).then((r) => r.json());
      if (!up.uri) throw new Error(up.error ?? "Upload failed");

      const projectId = randomProjectId();
      const primaryDomain = domain ? domainFromUrl(domain) : "";
      await createProject(program, publicKey, {
        entity,
        projectId,
        nameHash: sha256Bytes(name.trim()),
        domainHash: sha256Bytes(primaryDomain),
        metadataUri: up.uri,
      });
      setName("");
      setDomain("");
      setDescription("");
      onCreated?.();
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 border border-ink-200 bg-white p-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="label">Project name</label>
          <input
            className="input mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Lend"
            maxLength={200}
          />
        </div>
        <div>
          <label className="label">Primary domain (optional)</label>
          <input
            className="input mt-1"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="https://lend.acme.xyz"
            maxLength={200}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Description (optional)</label>
          <textarea
            className="textarea mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1200}
          />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={submitting || !publicKey}>
        {submitting ? "Publishing…" : "Publish Project on-chain"}
      </button>
    </form>
  );
}

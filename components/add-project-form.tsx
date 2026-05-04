"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import { createProject } from "@/lib/anchor/client";
import { randomProjectId, sha256Bytes } from "@/lib/utils/hash";
import { uploadMetadata } from "@/lib/upload-client";
import { useT } from "@/lib/i18n";

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
  const { publicKey, signMessage } = useWallet();
  const program = useProgram();
  const t = useT();

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!program || !publicKey) {
      setError(t("addProject.errors.connect"));
      return;
    }
    if (!name.trim()) {
      setError(t("addProject.errors.name"));
      return;
    }
    setSubmitting(true);
    try {
      const metadata = {
        name: name.trim(),
        domain: domain.trim() || undefined,
        description: description.trim() || undefined,
      };
      const up = await uploadMetadata(
        publicKey,
        signMessage,
        JSON.stringify(metadata),
      );

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
      setError((err as Error).message ?? t("addProject.errors.failed"));
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
          <label className="label">{t("addProject.fields.name")}</label>
          <input
            className="input mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("addProject.fields.namePlaceholder")}
            maxLength={200}
          />
        </div>
        <div>
          <label className="label">{t("addProject.fields.domain")}</label>
          <input
            className="input mt-1"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t("addProject.fields.domainPlaceholder")}
            maxLength={200}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">
            {t("addProject.fields.description")}
          </label>
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
        {submitting
          ? t("addProject.btn.submitting")
          : t("addProject.btn.submit")}
      </button>
    </form>
  );
}

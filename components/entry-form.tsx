"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import { createEntry, addWalletMapping } from "@/lib/anchor/client";
import { entryPda } from "@/lib/anchor/pdas";
import { randomEntryId, sha256Bytes } from "@/lib/utils/hash";
import {
  validateCompanyName,
  validateDomain,
  validateJurisdiction,
  validatePubkey,
} from "@/lib/utils/validation";
import { bytesHex } from "@/lib/utils/format";

type InitialMapping = {
  pubkey: string;
  role: number;
  note: string;
};

const DEFAULT_MAPPING: InitialMapping = { pubkey: "", role: 1, note: "" };

export function EntryForm() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [companyName, setCompanyName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("Hong Kong");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [primaryWallet, setPrimaryWallet] = useState("");
  const [mappings, setMappings] = useState<InitialMapping[]>([
    { ...DEFAULT_MAPPING },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  function updateMapping(i: number, patch: Partial<InitialMapping>) {
    setMappings((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  function addMapping() {
    setMappings((prev) => [...prev, { ...DEFAULT_MAPPING }]);
  }

  function removeMapping(i: number) {
    setMappings((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!publicKey || !program) {
      setError("Connect a wallet first.");
      return;
    }

    const errs = [
      validateCompanyName(companyName),
      validateJurisdiction(jurisdiction),
      validateDomain(domain),
      validatePubkey(primaryWallet),
    ].filter(Boolean);
    if (errs.length) {
      setError(errs[0] as string);
      return;
    }

    // Validate each mapping pubkey (allow empty lines so user can skip)
    const live = mappings.filter((m) => m.pubkey.trim().length > 0);
    for (const m of live) {
      const err = validatePubkey(m.pubkey);
      if (err) {
        setError(`Wallet mapping: ${err}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      setProgress("Uploading metadata to mock storage…");
      const metadata = {
        companyName,
        projectName,
        domain,
        description,
        evidenceNote: "Mock submission for hackathon demo.",
      };
      const up = await fetch("/api/mock/upload", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify(metadata),
      }).then((r) => r.json());
      if (!up.uri) throw new Error(up.error ?? "Upload failed");

      setProgress("Creating on-chain entry…");
      const entryId = randomEntryId();
      const [entry] = entryPda(entryId);
      await createEntry(program, publicKey, {
        entryId,
        companyNameHash: sha256Bytes(companyName),
        projectNameHash: sha256Bytes(projectName),
        jurisdiction,
        domainHash: sha256Bytes(domain.toLowerCase()),
        metadataUri: up.uri,
        primaryWallet: new PublicKey(primaryWallet),
      });

      for (const m of live) {
        setProgress(`Linking wallet mapping ${m.pubkey.slice(0, 6)}…`);
        await addWalletMapping(program, publicKey, {
          entry,
          targetWallet: new PublicKey(m.pubkey),
          walletRole: m.role,
          evidenceHash: sha256Bytes(m.note || m.pubkey),
          evidenceUri: "",
          isOfficial: false,
        });
      }

      setProgress("Done — redirecting…");
      router.push(`/entry/${bytesHex(entryId)}`);
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message ?? "Failed to create entry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Company / legal name</label>
          <input
            className="input mt-1"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Protocol Pte. Ltd."
            maxLength={200}
          />
        </div>
        <div>
          <label className="label">Project / brand name</label>
          <input
            className="input mt-1"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Acme"
            maxLength={200}
          />
        </div>
        <div>
          <label className="label">Jurisdiction</label>
          <input
            className="input mt-1"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="Hong Kong"
            maxLength={64}
          />
        </div>
        <div>
          <label className="label">Primary domain</label>
          <input
            className="input mt-1"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.xyz"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <textarea
            className="textarea mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this company do? What should partners know?"
            maxLength={1200}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Primary project wallet</label>
          <input
            className="input mt-1 font-mono text-xs"
            value={primaryWallet}
            onChange={(e) => setPrimaryWallet(e.target.value)}
            placeholder="Project treasury or deployer wallet pubkey"
          />
          <p className="hint mt-1">
            Anchored as the canonical wallet for this entry. You can link more wallets below.
          </p>
        </div>
      </div>

      <section className="border-t border-ink-200 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="serif text-lg font-semibold text-ink-800">
              Initial wallet mappings
            </h3>
            <p className="hint">
              These are community-added mappings. Official mappings can be added later once the entry is claimed.
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={addMapping}>
            + Add wallet
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {mappings.map((m, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-sm border border-ink-200 bg-white p-3 md:grid-cols-[1fr_160px_1fr_auto]"
            >
              <input
                className="input font-mono text-xs"
                value={m.pubkey}
                onChange={(e) => updateMapping(i, { pubkey: e.target.value })}
                placeholder="wallet pubkey"
              />
              <select
                className="select"
                value={m.role}
                onChange={(e) => updateMapping(i, { role: Number(e.target.value) })}
              >
                <option value={1}>Treasury</option>
                <option value={2}>Deployer</option>
                <option value={3}>Team</option>
                <option value={4}>Other</option>
              </select>
              <input
                className="input"
                value={m.note}
                onChange={(e) => updateMapping(i, { note: e.target.value })}
                placeholder="note / evidence (optional)"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => removeMapping(i)}
                disabled={mappings.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {progress && !error && <p className="hint">{progress}</p>}

      <button type="submit" className="btn" disabled={submitting || !publicKey}>
        {submitting ? "Submitting…" : "Publish entry on-chain"}
      </button>
    </form>
  );
}

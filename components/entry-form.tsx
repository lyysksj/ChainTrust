"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import { createEntry, addWalletMapping } from "@/lib/anchor/client";
import { entryPda } from "@/lib/anchor/pdas";
import { randomEntryId, sha256Bytes } from "@/lib/utils/hash";
import {
  validateCompanyName,
  validateEin,
  validatePubkey,
  validateWebsite,
} from "@/lib/utils/validation";
import { bytesHex } from "@/lib/utils/format";
import { COUNTRIES } from "@/types";

type InitialMapping = {
  pubkey: string;
  role: number;
  note: string;
};

const DEFAULT_MAPPING: InitialMapping = { pubkey: "", role: 1, note: "" };

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function EntryForm() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [legalName, setLegalName] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [ein, setEin] = useState("");
  const [projectName, setProjectName] = useState("");
  const [websites, setWebsites] = useState<string[]>([""]);
  const [primaryWallet, setPrimaryWallet] = useState("");
  const [description, setDescription] = useState("");
  const [mappings, setMappings] = useState<InitialMapping[]>([
    { ...DEFAULT_MAPPING },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0],
    [countryCode],
  );

  function updateWebsite(i: number, v: string) {
    setWebsites((prev) => prev.map((w, idx) => (idx === i ? v : w)));
  }
  function addWebsite() {
    setWebsites((prev) => [...prev, ""]);
  }
  function removeWebsite(i: number) {
    setWebsites((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateMapping(i: number, patch: Partial<InitialMapping>) {
    setMappings((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    );
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

    const companyErr = validateCompanyName(legalName);
    if (companyErr) {
      setError(companyErr);
      return;
    }
    const einErr = validateEin(countryCode, ein);
    if (einErr) {
      setError(einErr);
      return;
    }
    if (!projectName.trim()) {
      setError("Project name is required.");
      return;
    }
    const liveWebsites = websites.map((w) => w.trim()).filter(Boolean);
    if (!liveWebsites.length) {
      setError("Add at least one website URL.");
      return;
    }
    for (const w of liveWebsites) {
      const werr = validateWebsite(w);
      if (werr) {
        setError(`Website: ${werr}`);
        return;
      }
    }

    // Primary wallet is optional — only validate when provided.
    if (primaryWallet.trim()) {
      const perr = validatePubkey(primaryWallet.trim());
      if (perr) {
        setError(`Project wallet: ${perr}`);
        return;
      }
    }

    const live = mappings.filter((m) => m.pubkey.trim().length > 0);
    for (const m of live) {
      const merr = validatePubkey(m.pubkey);
      if (merr) {
        setError(`Wallet mapping: ${merr}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      setProgress("Uploading metadata to mock storage…");
      const primaryDomain = domainFromUrl(liveWebsites[0]);
      const metadata = {
        legalName,
        ein,
        countryCode,
        countryLabel: country.label,
        projectName,
        websites: liveWebsites,
        primaryWallet: primaryWallet.trim() || null,
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
        companyNameHash: sha256Bytes(legalName),
        projectNameHash: sha256Bytes(projectName),
        einHash: sha256Bytes(`${countryCode}:${ein}`),
        jurisdiction: countryCode,
        domainHash: sha256Bytes(primaryDomain),
        metadataUri: up.uri,
        primaryWallet: primaryWallet.trim()
          ? new PublicKey(primaryWallet.trim())
          : null,
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
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="serif text-lg font-semibold text-ink-800">
            Legal entity
          </h2>
          <p className="hint">
            The real-world company this entry represents. Business ID is hashed
            before being stored on-chain.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Legal company name</label>
            <input
              className="input mt-1"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Acme Protocol Pte. Ltd."
              maxLength={200}
            />
          </div>
          <div>
            <label className="label">Country of registration</label>
            <select
              className="select mt-1"
              value={countryCode}
              onChange={(e) => {
                setCountryCode(e.target.value);
                setEin("");
              }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{country.idLabel}</label>
            <input
              className="input mt-1 font-mono text-sm"
              value={ein}
              onChange={(e) => setEin(e.target.value)}
              placeholder={country.idFormat}
              maxLength={40}
            />
            <p className="hint mt-1">Format: {country.idFormat}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-ink-200 pt-6">
        <div>
          <h2 className="serif text-lg font-semibold text-ink-800">
            Blockchain project
          </h2>
          <p className="hint">
            How the project appears on-chain and which wallet represents it.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Project / brand name</label>
            <input
              className="input mt-1"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Acme"
              maxLength={200}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Project websites</label>
            <div className="mt-1 space-y-2">
              {websites.map((w, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]"
                >
                  <input
                    className="input"
                    value={w}
                    onChange={(e) => updateWebsite(i, e.target.value)}
                    placeholder="https://acme.xyz"
                    maxLength={200}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => removeWebsite(i)}
                    disabled={websites.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={addWebsite}
              >
                + Add website
              </button>
            </div>
            <p className="hint mt-1">
              The first URL becomes the primary domain (hashed on-chain).
            </p>
          </div>
          <div className="md:col-span-2">
            <label className="label">
              Primary project wallet <span className="text-ink-400">(optional)</span>
            </label>
            <input
              className="input mt-1 font-mono text-xs"
              value={primaryWallet}
              onChange={(e) => setPrimaryWallet(e.target.value)}
              placeholder="Project treasury or deployer wallet (leave blank if unknown)"
            />
            <p className="hint mt-1">
              Leave blank if the project does not publish a canonical wallet
              yet. You can still link wallets below.
            </p>
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
        </div>
      </section>

      <section className="border-t border-ink-200 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="serif text-lg font-semibold text-ink-800">
              Initial wallet mappings
            </h2>
            <p className="hint">
              Community mappings are proposals. Official mappings can be added
              after the entry is claimed.
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
                onChange={(e) =>
                  updateMapping(i, { role: Number(e.target.value) })
                }
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

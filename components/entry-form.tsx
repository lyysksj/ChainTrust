"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import { createEntity } from "@/lib/anchor/client";
import { entityPda } from "@/lib/anchor/pdas";
import { randomEntityId, sha256Bytes } from "@/lib/utils/hash";
import { entityIdToCtNumber } from "@/lib/utils/ct-number";
import {
  validateCompanyName,
  validateEin,
  validateWebsite,
} from "@/lib/utils/validation";
import { bytesHex } from "@/lib/utils/format";
import { COUNTRIES } from "@/types";

export function EntryForm() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [legalName, setLegalName] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [registryId, setRegistryId] = useState("");
  const [websites, setWebsites] = useState<string[]>([""]);
  const [description, setDescription] = useState("");
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!publicKey || !program) {
      setError("Connect a wallet first.");
      return;
    }

    const nameErr = validateCompanyName(legalName);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    const idErr = validateEin(countryCode, registryId);
    if (idErr) {
      setError(idErr);
      return;
    }
    const liveWebsites = websites.map((w) => w.trim()).filter(Boolean);
    for (const w of liveWebsites) {
      const werr = validateWebsite(w);
      if (werr) {
        setError(`Website: ${werr}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      setProgress("Uploading entity metadata…");
      const metadata = {
        legalName,
        registryId,
        countryCode,
        countryLabel: country.label,
        websites: liveWebsites,
        description,
        evidenceNote: "Mock submission for hackathon demo.",
      };
      const up = await fetch("/api/mock/upload", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify(metadata),
      }).then((r) => r.json());
      if (!up.uri) throw new Error(up.error ?? "Upload failed");

      setProgress("Creating Entity on-chain…");
      const entityId = randomEntityId();
      const [pda] = entityPda(entityId);
      await createEntity(program, publicKey, {
        entityId,
        legalNameHash: sha256Bytes(legalName),
        registryIdHash: sha256Bytes(`${countryCode}:${registryId}`),
        jurisdiction: countryCode,
        metadataUri: up.uri,
      });
      setProgress(
        `Done — CT-Number ${entityIdToCtNumber(entityId)}. Redirecting…`,
      );
      // Suppress unused-var lint without consumer.
      void pda;
      router.push(`/entry/${bytesHex(entityId)}`);
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message ?? "Failed to create entity");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="form-grid-2">
        <div className="form-row" style={{ gridColumn: "1 / -1" }}>
          <label className="label">Legal company name</label>
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Acme Protocol Pte. Ltd."
            maxLength={200}
          />
        </div>
        <div className="form-row">
          <label className="label">Country of registration</label>
          <select
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value);
              setRegistryId("");
            }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="label">{country.idLabel}</label>
          <input
            value={registryId}
            onChange={(e) => setRegistryId(e.target.value)}
            placeholder={country.idFormat}
            maxLength={40}
          />
          <div className="hint">Hashed on-chain · format: {country.idFormat}</div>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--rule-soft)",
          paddingTop: 24,
          marginTop: 8,
        }}
      >
        <div className="form-row">
          <label className="label">Websites (optional)</label>
          {websites.map((w, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <input
                value={w}
                onChange={(e) => updateWebsite(i, e.target.value)}
                placeholder="https://acme.xyz"
                maxLength={200}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => removeWebsite(i)}
                disabled={websites.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={addWebsite}>
            + Add website
          </button>
        </div>
        <div className="form-row">
          <label className="label">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this entity do? What is its on-chain footprint?"
            maxLength={1200}
          />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {progress && !error && (
        <p
          className="hint"
          style={{ color: "var(--stamp-deep)", fontWeight: 600 }}
        >
          {progress}
        </p>
      )}

      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--ink-3)",
          letterSpacing: "0.04em",
          marginBottom: 16,
        }}
      >
        AFTER PUBLISHING · YOU&apos;LL LAND ON THE ENTITY PAGE TO ATTEST
        RELATIONSHIPS
      </div>

      <button
        type="submit"
        className="btn btn-stamp"
        disabled={submitting || !publicKey}
      >
        {submitting ? "Filing…" : "◆ File Entity on-chain"}
      </button>
    </form>
  );
}

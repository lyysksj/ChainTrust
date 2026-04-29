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
  validateOptionalUrl,
  validateWebsite,
} from "@/lib/utils/validation";
import { bytesHex } from "@/lib/utils/format";
import { Stamp } from "@/components/registry-bits";
import {
  COUNTRIES,
  ENTITY_TYPES,
  INDUSTRIES,
  REGIONS,
} from "@/types";
import type { EntityMetadata, FilerRole } from "@/types";

type Step = 1 | 2 | 3 | 4;

const STEP_TITLES: Record<Step, string> = {
  1: "Filer & jurisdiction",
  2: "Identity",
  3: "Public profile",
  4: "Disclosures & sign",
};
const STEP_TAGS: Record<Step, string> = {
  1: "FILER",
  2: "IDENTITY",
  3: "PROFILE",
  4: "SIGN",
};

const FILER_DECLARATIONS: Record<FilerRole, string> = {
  "first-party":
    "I am authorized to file this Entity record on behalf of the named legal entity.",
  "third-party":
    "I am filing this Entity record as a third-party observer, pending the entity's claim.",
};

export function EntryForm() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [filerRole, setFilerRole] = useState<FilerRole | "">("");
  const [countryCode, setCountryCode] = useState("SG");
  const [registryId, setRegistryId] = useState("");

  // Step 2
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [entityType, setEntityType] = useState("PTE");
  const [incorporationDate, setIncorporationDate] = useState("");

  // Step 3
  const [websites, setWebsites] = useState<string[]>([""]);
  const [industry, setIndustry] = useState("");
  const [operatingRegions, setOperatingRegions] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [parentEntityCt, setParentEntityCt] = useState("");
  const [lei, setLei] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Step 4
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [confirmPublic, setConfirmPublic] = useState(false);

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
  function toggleRegion(code: string) {
    setOperatingRegions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function validateStep(s: Step): string | null {
    if (s === 1) {
      if (!filerRole) return "Pick a filer role.";
      if (!countryCode) return "Country is required.";
      const idErr = validateEin(countryCode, registryId);
      if (idErr) return idErr;
    }
    if (s === 2) {
      const nameErr = validateCompanyName(legalName);
      if (nameErr) return nameErr;
      if (!entityType) return "Entity type is required.";
      if (incorporationDate) {
        const d = new Date(incorporationDate);
        if (Number.isNaN(d.getTime())) return "Invalid incorporation date.";
        if (d.getTime() > Date.now())
          return "Incorporation date cannot be in the future.";
      }
    }
    if (s === 3) {
      const liveWebsites = websites.map((w) => w.trim()).filter(Boolean);
      for (const w of liveWebsites) {
        const werr = validateWebsite(w);
        if (werr) return `Website: ${werr}`;
      }
      if (parentEntityCt && !/^CT-[0-9A-Z]{4}-[0-9A-Z]{4}$/i.test(parentEntityCt.trim())) {
        return "Parent CT-Number must look like CT-XXXX-XXXX.";
      }
      const siteErr = validateOptionalUrl("");
      void siteErr;
      if (
        contactEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())
      ) {
        return "Contact email looks invalid.";
      }
    }
    if (s === 4) {
      if (!confirmAccurate || !confirmPublic) {
        return "Confirm both disclosures before signing.";
      }
    }
    return null;
  }

  function next() {
    const e = validateStep(step);
    if (e) {
      setError(e);
      return;
    }
    setError(null);
    if (step < 4) setStep((step + 1) as Step);
  }

  function back() {
    setError(null);
    if (step > 1) setStep((step - 1) as Step);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!publicKey || !program) {
      setError("Connect a wallet first.");
      return;
    }
    for (const s of [1, 2, 3, 4] as Step[]) {
      const err = validateStep(s);
      if (err) {
        setError(`Step ${s}: ${err}`);
        setStep(s);
        return;
      }
    }

    setSubmitting(true);
    try {
      setProgress("Uploading entity metadata…");
      const liveWebsites = websites.map((w) => w.trim()).filter(Boolean);
      const metadata: EntityMetadata = {
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || undefined,
        registryId: registryId.trim(),
        countryCode,
        countryLabel: country.label,
        entityType,
        incorporationDate: incorporationDate || undefined,
        industry: industry || undefined,
        operatingRegions:
          operatingRegions.length > 0 ? operatingRegions : undefined,
        websites: liveWebsites.length > 0 ? liveWebsites : undefined,
        parentEntityCt:
          parentEntityCt.trim().toUpperCase() || undefined,
        lei: lei.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        description: description.trim() || undefined,
        filerRole: filerRole || undefined,
        filerStatement: filerRole
          ? FILER_DECLARATIONS[filerRole]
          : undefined,
        evidenceNote:
          filerRole === "first-party"
            ? "First-party self-filing."
            : "Third-party observation pending claim.",
      };
      const up = await fetch("/api/mock/upload", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify(metadata),
      }).then((r) => r.json());
      if (!up.uri) throw new Error(up.error ?? "Upload failed");

      setProgress("Filing Entity on-chain…");
      const entityId = randomEntityId();
      const [pda] = entityPda(entityId);
      void pda;
      await createEntity(program, publicKey, {
        entityId,
        legalNameHash: sha256Bytes(legalName.trim()),
        registryIdHash: sha256Bytes(`${countryCode}:${registryId.trim()}`),
        jurisdiction: countryCode,
        metadataUri: up.uri,
      });
      setProgress(
        `Filed · CT-Number ${entityIdToCtNumber(entityId)}. Redirecting…`,
      );
      router.push(`/entry/${bytesHex(entityId)}`);
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? "Failed to file entity");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: 32,
        alignItems: "start",
      }}
    >
      {/* Wizard left panel */}
      <form onSubmit={onSubmit}>
        <div className="doc-card">
          <div className="doc-card-h">
            <div className="doc-card-title">
              Step {step} of 4 · {STEP_TITLES[step]}
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              {STEP_TAGS[step]} · §{step}
            </div>
          </div>

          {step === 1 && (
            <>
              <div className="form-row">
                <label className="label">Filer declaration</label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <FilerOption
                    role="first-party"
                    selected={filerRole}
                    onSelect={setFilerRole}
                    title="First-party · authorized representative"
                    body="I am filing on behalf of the named legal entity. I am authorized to commit it to this public record."
                  />
                  <FilerOption
                    role="third-party"
                    selected={filerRole}
                    onSelect={setFilerRole}
                    title="Third-party · observation"
                    body="I am filing as a researcher / observer. The entity has not yet claimed this record."
                  />
                </div>
                <div className="hint">
                  This selection is recorded in the metadata and influences the
                  default issuer tier shown to consumers.
                </div>
              </div>

              <div className="form-grid-2">
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
                  <div className="hint">
                    Only the SHA-256 hash goes on-chain. The raw ID stays in
                    your private metadata.
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-row">
                <label className="label">Legal name (as registered)</label>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Acme Protocol Pte. Ltd."
                  maxLength={200}
                />
              </div>
              <div className="form-row">
                <label className="label">Trade name / DBA (optional)</label>
                <input
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="Acme · Stellaris"
                  maxLength={200}
                />
                <div className="hint">
                  Brand or "doing business as" name, if different from the
                  legal name.
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label className="label">Entity type</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                  >
                    {ENTITY_TYPES.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="label">
                    Incorporation date (optional)
                  </label>
                  <input
                    type="date"
                    value={incorporationDate}
                    onChange={(e) => setIncorporationDate(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="form-row">
                <label className="label">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  <option value="">— select industry —</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i.code} value={i.code}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label className="label">Operating regions (optional)</label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  {REGIONS.map((r) => {
                    const active = operatingRegions.includes(r.code);
                    return (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => toggleRegion(r.code)}
                        className={
                          active ? "tier tier-2" : "tier tier-3"
                        }
                        style={{
                          cursor: "pointer",
                          fontSize: 10,
                          padding: "4px 10px",
                          background: active
                            ? "var(--stamp)"
                            : "var(--paper-2)",
                        }}
                      >
                        {active ? "✓" : "+"} {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

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
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={addWebsite}
                >
                  + Add website
                </button>
              </div>

              <div className="form-row">
                <label className="label">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="One paragraph: what this entity does, what it operates on-chain, who its primary counterparties are."
                  maxLength={1200}
                />
              </div>

              <details
                style={{
                  borderTop: "1px solid var(--rule-soft)",
                  paddingTop: 16,
                  marginTop: 8,
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: "var(--stamp-deep)",
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  ▸ ADVANCED FIELDS (parent entity · LEI · contact)
                </summary>
                <div className="form-grid-2">
                  <div className="form-row">
                    <label className="label">Parent Entity CT-Number</label>
                    <input
                      value={parentEntityCt}
                      onChange={(e) =>
                        setParentEntityCt(e.target.value.toUpperCase())
                      }
                      placeholder="CT-XXXX-XXXX"
                      maxLength={20}
                    />
                  </div>
                  <div className="form-row">
                    <label className="label">LEI (optional)</label>
                    <input
                      value={lei}
                      onChange={(e) => setLei(e.target.value.toUpperCase())}
                      placeholder="20-char Legal Entity Identifier"
                      maxLength={20}
                    />
                  </div>
                  <div className="form-row" style={{ gridColumn: "1 / -1" }}>
                    <label className="label">Public contact email</label>
                    <input
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="legal@acme.xyz"
                      maxLength={120}
                      type="email"
                    />
                  </div>
                </div>
              </details>
            </>
          )}

          {step === 4 && (
            <>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 14,
                  color: "var(--ink-2)",
                  lineHeight: 1.55,
                  padding: "14px 16px",
                  borderLeft: "3px solid var(--stamp)",
                  background: "var(--paper-2)",
                  marginBottom: 18,
                }}
              >
                <strong>Filer declaration · {filerRole}</strong>
                <br />
                {filerRole && FILER_DECLARATIONS[filerRole]}
              </div>

              <div className="form-row">
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmAccurate}
                    onChange={(e) => setConfirmAccurate(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 13,
                      color: "var(--ink-2)",
                      lineHeight: 1.5,
                    }}
                  >
                    I confirm that the information above is accurate and
                    submitted in good faith. False filings are themselves a
                    public, signed record.
                  </span>
                </label>
              </div>
              <div className="form-row">
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmPublic}
                    onChange={(e) => setConfirmPublic(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 13,
                      color: "var(--ink-2)",
                      lineHeight: 1.5,
                    }}
                  >
                    I understand all data above is{" "}
                    <strong>publicly readable, append-only, and cannot be deleted.</strong>
                    Only the SHA-256 hash of the legal name and registry ID is
                    written to Solana; full metadata is uploaded off-chain
                    and addressed by hash.
                  </span>
                </label>
              </div>

              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  lineHeight: 1.6,
                  padding: 12,
                  background: "var(--paper-2)",
                  border: "1px solid var(--rule-soft)",
                  marginBottom: 18,
                }}
              >
                <div>
                  PROGRAM · HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt
                </div>
                <div>SEEDS · [&quot;entity&quot;, entity_id (8 random bytes)]</div>
                <div>FEE · ~0.00204 SOL (rent-exempt deposit)</div>
              </div>
            </>
          )}

          {error && (
            <p className="error" style={{ marginTop: 8 }}>
              {error}
            </p>
          )}
          {progress && !error && (
            <p
              className="hint"
              style={{
                color: "var(--stamp-deep)",
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              {progress}
            </p>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 24,
              paddingTop: 16,
              borderTop: "1px solid var(--rule-soft)",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => (step === 1 ? router.push("/") : back())}
            >
              ← {step === 1 ? "Cancel" : "Back"}
            </button>
            {step < 4 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={next}
              >
                Next: {STEP_TITLES[(step + 1) as Step]} →
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-stamp"
                disabled={
                  submitting || !confirmAccurate || !confirmPublic
                }
              >
                {submitting ? "FILING…" : "◆ Sign & file Entity"}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Live preview right panel */}
      <div
        className="doc-card"
        style={{ position: "sticky", top: 24 }}
      >
        <div className="doc-card-h">
          <div className="doc-card-title">Live preview</div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--ink-3)",
              letterSpacing: "0.1em",
            }}
          >
            UNFILED DRAFT
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="docnum" style={{ marginBottom: 4 }}>
            ENTITY · CT-NUMBER (auto)
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 13,
              color: "var(--stamp-deep)",
              fontWeight: 600,
              letterSpacing: "0.08em",
            }}
          >
            CT-XXXX-XXXX
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--ink-3)",
              letterSpacing: "0.04em",
            }}
          >
            Assigned at signing
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="docnum" style={{ marginBottom: 4 }}>
            LEGAL NAME
          </div>
          {legalName.trim() ? (
            <>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 18,
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {legalName}
              </div>
              {tradeName.trim() && (
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--ink-3)",
                    letterSpacing: "0.04em",
                  }}
                >
                  DBA · {tradeName}
                </div>
              )}
            </>
          ) : (
            <div className="hint">— LEGAL NAME NOT SET —</div>
          )}
        </div>

        <div className="form-grid-2">
          <div style={{ marginBottom: 12 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              JURISDICTION
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
              }}
            >
              {country.label}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              ENTITY TYPE
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
              }}
            >
              {ENTITY_TYPES.find((t) => t.code === entityType)?.code ?? "—"}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              REGISTRY ID HASH
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-2)",
              }}
            >
              {registryId.trim()
                ? `0x${sha256Bytes(`${countryCode}:${registryId.trim()}`)
                    .slice(0, 4)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("")}…`
                : "—"}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              INCORPORATED
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
              }}
            >
              {incorporationDate || "—"}
            </div>
          </div>
        </div>

        {industry && (
          <div style={{ marginBottom: 12 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              INDUSTRY
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
              }}
            >
              {INDUSTRIES.find((i) => i.code === industry)?.label}
            </div>
          </div>
        )}

        {operatingRegions.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              OPERATING REGIONS
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.04em",
              }}
            >
              {operatingRegions
                .map((c) => REGIONS.find((r) => r.code === c)?.code ?? c)
                .join(" · ")}
            </div>
          </div>
        )}

        {filerRole && (
          <div
            className="rule-h-soft"
            style={{
              paddingTop: 14,
              marginTop: 8,
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--ink-3)",
              letterSpacing: "0.04em",
              lineHeight: 1.6,
            }}
          >
            <div>FILER · {filerRole.toUpperCase()}</div>
            <div>WEBSITES · {websites.filter((w) => w.trim()).length}</div>
            <div>PARENT · {parentEntityCt || "—"}</div>
            <div>LEI · {lei || "—"}</div>
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Stamp text="Pending" sub="UNFILED" size="small" />
        </div>
      </div>
    </div>
  );
}

function FilerOption({
  role,
  selected,
  onSelect,
  title,
  body,
}: {
  role: FilerRole;
  selected: FilerRole | "";
  onSelect: (r: FilerRole) => void;
  title: string;
  body: string;
}) {
  const active = selected === role;
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        border: `1.5px solid ${active ? "var(--stamp-deep)" : "var(--rule)"}`,
        background: active ? "var(--paper-3)" : "var(--paper-2)",
        cursor: "pointer",
        transition: "all 0.1s",
      }}
    >
      <input
        type="radio"
        name="filer-role"
        checked={active}
        onChange={() => onSelect(role)}
        style={{ marginTop: 3 }}
      />
      <div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 13,
            color: "var(--ink-2)",
            marginTop: 2,
            lineHeight: 1.45,
          }}
        >
          {body}
        </div>
      </div>
    </label>
  );
}

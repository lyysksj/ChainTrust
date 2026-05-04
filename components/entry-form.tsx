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
import { uploadMetadata } from "@/lib/upload-client";
import { useT } from "@/lib/i18n";
import {
  COUNTRIES,
  ENTITY_TYPES,
  INDUSTRIES,
  REGIONS,
} from "@/types";
import type { EntityMetadata, FilerRole } from "@/types";

type Step = 1 | 2 | 3 | 4;

export function EntryForm() {
  const router = useRouter();
  const { publicKey, signMessage } = useWallet();
  const program = useProgram();
  const t = useT();

  const STEP_TITLES: Record<Step, string> = {
    1: t("entryForm.step.title.1"),
    2: t("entryForm.step.title.2"),
    3: t("entryForm.step.title.3"),
    4: t("entryForm.step.title.4"),
  };
  const STEP_TAGS: Record<Step, string> = {
    1: t("entryForm.step.tag.1"),
    2: t("entryForm.step.tag.2"),
    3: t("entryForm.step.tag.3"),
    4: t("entryForm.step.tag.4"),
  };
  const FILER_DECLARATIONS: Record<FilerRole, string> = {
    "first-party": t("entryForm.filer.first"),
    "third-party": t("entryForm.filer.third"),
  };

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
      if (!filerRole) return t("entryForm.errors.role");
      if (!countryCode) return t("entryForm.errors.country");
      const idErr = validateEin(countryCode, registryId);
      if (idErr) return idErr;
    }
    if (s === 2) {
      const nameErr = validateCompanyName(legalName);
      if (nameErr) return nameErr;
      if (!entityType) return t("entryForm.errors.entityType");
      if (incorporationDate) {
        const d = new Date(incorporationDate);
        if (Number.isNaN(d.getTime())) return t("entryForm.errors.incorpInvalid");
        if (d.getTime() > Date.now())
          return t("entryForm.errors.incorpFuture");
      }
    }
    if (s === 3) {
      const liveWebsites = websites.map((w) => w.trim()).filter(Boolean);
      for (const w of liveWebsites) {
        const werr = validateWebsite(w);
        if (werr) return `${t("entryForm.errors.websitePrefix")} ${werr}`;
      }
      if (parentEntityCt && !/^CT-[0-9A-Z]{4}-[0-9A-Z]{4}$/i.test(parentEntityCt.trim())) {
        return t("entryForm.errors.parentCt");
      }
      const siteErr = validateOptionalUrl("");
      void siteErr;
      if (
        contactEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())
      ) {
        return t("entryForm.errors.email");
      }
    }
    if (s === 4) {
      if (!confirmAccurate || !confirmPublic) {
        return t("entryForm.errors.disclosures");
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
      setError(t("entryForm.errors.connect"));
      return;
    }
    for (const s of [1, 2, 3, 4] as Step[]) {
      const err = validateStep(s);
      if (err) {
        setError(`${t("entryForm.errors.stepPrefix")} ${s}: ${err}`);
        setStep(s);
        return;
      }
    }

    setSubmitting(true);
    try {
      setProgress(t("entryForm.progress.upload"));
      const liveWebsites = websites.map((w) => w.trim()).filter(Boolean);
      // Privacy: hash the registry ID client-side. Raw value never leaves
      // the browser. Only the hex prefix is stored in the public IPFS doc.
      const registryIdHashBytes = sha256Bytes(
        `${countryCode}:${registryId.trim()}`,
      );
      const registryIdHashHex = registryIdHashBytes
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const metadata: EntityMetadata = {
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || undefined,
        registryIdHashHex,
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
            ? t("entryForm.filer.evidence.first")
            : t("entryForm.filer.evidence.third"),
      };
      const up = await uploadMetadata(
        publicKey,
        signMessage,
        JSON.stringify(metadata),
      );

      setProgress(t("entryForm.progress.filing"));
      const entityId = randomEntityId();
      const [pda] = entityPda(entityId);
      void pda;
      await createEntity(program, publicKey, {
        entityId,
        legalNameHash: sha256Bytes(legalName.trim()),
        registryIdHash: registryIdHashBytes,
        jurisdiction: countryCode,
        metadataUri: up.uri,
      });
      setProgress(
        t("entryForm.progress.filed", {
          ct: entityIdToCtNumber(entityId),
        }),
      );
      router.push(`/entry/${bytesHex(entityId)}`);
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? t("entryForm.errors.failed"));
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
              {t("entryForm.step.label", { n: step })} {STEP_TITLES[step]}
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
                <label className="label">{t("entryForm.filer.declaration")}</label>
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
                    title={t("entryForm.filer.firstParty.title")}
                    body={t("entryForm.filer.firstParty.body")}
                  />
                  <FilerOption
                    role="third-party"
                    selected={filerRole}
                    onSelect={setFilerRole}
                    title={t("entryForm.filer.thirdParty.title")}
                    body={t("entryForm.filer.thirdParty.body")}
                  />
                </div>
                <div className="hint">{t("entryForm.filer.note")}</div>
              </div>

              <div className="form-grid-2">
                <div className="form-row">
                  <label className="label">{t("entryForm.country.label")}</label>
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
                  <div className="hint">{t("entryForm.registryId.hint")}</div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-row">
                <label className="label">{t("entryForm.legalName.label")}</label>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder={t("entryForm.legalName.placeholder")}
                  maxLength={200}
                />
              </div>
              <div className="form-row">
                <label className="label">{t("entryForm.tradeName.label")}</label>
                <input
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder={t("entryForm.tradeName.placeholder")}
                  maxLength={200}
                />
                <div className="hint">{t("entryForm.tradeName.hint")}</div>
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label className="label">{t("entryForm.entityType.label")}</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                  >
                    {ENTITY_TYPES.map((et) => (
                      <option key={et.code} value={et.code}>
                        {et.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="label">{t("entryForm.incorpDate.label")}</label>
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
                <label className="label">{t("entryForm.industry.label")}</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  <option value="">{t("entryForm.industry.placeholder")}</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i.code} value={i.code}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label className="label">{t("entryForm.regions.label")}</label>
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
                <label className="label">{t("entryForm.websites.label")}</label>
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
                      placeholder={t("entryForm.websites.placeholder")}
                      maxLength={200}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeWebsite(i)}
                      disabled={websites.length === 1}
                    >
                      {t("entryForm.websites.remove")}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={addWebsite}
                >
                  {t("entryForm.websites.add")}
                </button>
              </div>

              <div className="form-row">
                <label className="label">{t("entryForm.description.label")}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("entryForm.description.placeholder")}
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
                  {t("entryForm.advanced.summary")}
                </summary>
                <div className="form-grid-2">
                  <div className="form-row">
                    <label className="label">{t("entryForm.advanced.parent")}</label>
                    <input
                      value={parentEntityCt}
                      onChange={(e) =>
                        setParentEntityCt(e.target.value.toUpperCase())
                      }
                      placeholder={t("entryForm.advanced.parentPlaceholder")}
                      maxLength={20}
                    />
                  </div>
                  <div className="form-row">
                    <label className="label">{t("entryForm.advanced.lei")}</label>
                    <input
                      value={lei}
                      onChange={(e) => setLei(e.target.value.toUpperCase())}
                      placeholder={t("entryForm.advanced.leiPlaceholder")}
                      maxLength={20}
                    />
                  </div>
                  <div className="form-row" style={{ gridColumn: "1 / -1" }}>
                    <label className="label">{t("entryForm.advanced.email")}</label>
                    <input
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder={t("entryForm.advanced.emailPlaceholder")}
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
                <strong>{t("entryForm.filer.declaration")} · {filerRole}</strong>
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
                    {t("entryForm.confirm.accurate")}
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
                    {t("entryForm.confirm.public.lead")}
                    <strong>{t("entryForm.confirm.public.bold")}</strong>
                    {t("entryForm.confirm.public.tail")}
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
              {step === 1 ? t("entryForm.btn.cancel") : t("entryForm.btn.back")}
            </button>
            {step < 4 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={next}
              >
                {t("entryForm.btn.next")} {STEP_TITLES[(step + 1) as Step]} →
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-stamp"
                disabled={
                  submitting || !confirmAccurate || !confirmPublic
                }
              >
                {submitting
                  ? t("entryForm.btn.submitting")
                  : t("entryForm.btn.submit")}
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

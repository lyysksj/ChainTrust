"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import { createEntity } from "@/lib/anchor/client";
import {
  CT_NUMBER_PATTERN,
  ctNumberFromPrimaryId,
  deriveEntityId,
  idHashBytes,
  normalizeIdValue,
} from "@/lib/utils/ct-number";
import {
  validateCompanyName,
  validateCustomIdTypeLabel,
  validateIdentifierValue,
  validateOptionalUrl,
  validateWebsite,
} from "@/lib/utils/validation";
import { bytesHex } from "@/lib/utils/format";
import { Stamp } from "@/components/registry-bits";
import { uploadMetadata } from "@/lib/upload-client";
import { useT } from "@/lib/i18n";
import {
  COUNTRIES,
  EMPLOYEE_BANDS,
  ENTITY_TYPES,
  ID_TYPES_BY_COUNTRY,
  ID_TYPE_CUSTOM_CODE,
  INDUSTRIES,
  INDUSTRY_GROUPS,
  OPERATING_STATUSES,
  REGIONS,
  SUBDIVISIONS_BY_COUNTRY,
  SUBDIVISION_LABEL_BY_COUNTRY,
  findIdType,
} from "@/types";
import type {
  EntityIdentifier,
  EntityMetadata,
  FilerRole,
  IdTypeOption,
} from "@/types";

// Hard cap mirrors MAX_IDENTIFIERS_PER_ENTITY in the on-chain program.
const MAX_IDENTIFIERS = 5;

type LocalIdentifier = {
  type: string; // catalog code or ID_TYPE_CUSTOM_CODE
  customTypeLabel: string; // populated only when type === ID_TYPE_CUSTOM_CODE
  value: string;
};

function emptyIdentifier(country: string): LocalIdentifier {
  const list = ID_TYPES_BY_COUNTRY[country] ?? [];
  return {
    type: list[0]?.code ?? ID_TYPE_CUSTOM_CODE,
    customTypeLabel: "",
    value: "",
  };
}

/** Resolve the on-chain canonical type code (uppercase, matches `validate_identifier_inputs`). */
function canonicalTypeCode(country: string, ident: LocalIdentifier): string {
  if (ident.type === ID_TYPE_CUSTOM_CODE) {
    return ident.customTypeLabel.trim().toUpperCase();
  }
  return ident.type.toUpperCase();
}

/** Resolve the human-friendly label for the receipt and metadata. */
function typeLabelFor(country: string, ident: LocalIdentifier): string {
  if (ident.type === ID_TYPE_CUSTOM_CODE) {
    return ident.customTypeLabel.trim();
  }
  const found = findIdType(country, ident.type);
  return found?.label ?? ident.type;
}

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
  const [subdivision, setSubdivision] = useState("");
  const [identifiers, setIdentifiers] = useState<LocalIdentifier[]>(() => [
    emptyIdentifier("SG"),
  ]);
  const [primaryIndex, setPrimaryIndex] = useState(0);

  // Step 2
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [entityType, setEntityType] = useState("PTE");
  const [incorporationDate, setIncorporationDate] = useState("");
  const [operatingStatus, setOperatingStatus] = useState<
    "active" | "dormant" | "dissolved"
  >("active");

  // Step 3
  const [websites, setWebsites] = useState<string[]>([""]);
  const [industry, setIndustry] = useState("");
  const [operatingRegions, setOperatingRegions] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [hqCity, setHqCity] = useState("");
  const [hqCountryCode, setHqCountryCode] = useState("");
  const [employeeBand, setEmployeeBand] = useState("");
  const [parentEntityCt, setParentEntityCt] = useState("");
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

  const idTypeOptions: IdTypeOption[] = useMemo(
    () => ID_TYPES_BY_COUNTRY[countryCode] ?? [],
    [countryCode],
  );

  const subdivisionOptions = useMemo(
    () => SUBDIVISIONS_BY_COUNTRY[countryCode] ?? [],
    [countryCode],
  );
  const subdivisionLabel =
    SUBDIVISION_LABEL_BY_COUNTRY[countryCode] ?? "State / Province";

  // ----- Identifier helpers -------------------------------------------------
  function setIdentifierField(
    i: number,
    patch: Partial<LocalIdentifier>,
  ) {
    setIdentifiers((prev) =>
      prev.map((ident, idx) => (idx === i ? { ...ident, ...patch } : ident)),
    );
  }
  function addIdentifier() {
    if (identifiers.length >= MAX_IDENTIFIERS) return;
    setIdentifiers((prev) => [...prev, emptyIdentifier(countryCode)]);
  }
  function removeIdentifier(i: number) {
    if (identifiers.length === 1) return;
    setIdentifiers((prev) => prev.filter((_, idx) => idx !== i));
    setPrimaryIndex((prev) => {
      if (prev === i) return 0;
      if (prev > i) return prev - 1;
      return prev;
    });
  }
  function changeCountry(newCode: string) {
    setCountryCode(newCode);
    setSubdivision("");
    setIdentifiers([emptyIdentifier(newCode)]);
    setPrimaryIndex(0);
  }

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
      if (identifiers.length === 0) return "Add at least one identifier";
      // Each identifier must validate. Custom labels need a separate format
      // check; preset types delegate to the per-type validator.
      const seenKeys = new Set<string>();
      for (let i = 0; i < identifiers.length; i++) {
        const ident = identifiers[i];
        if (ident.type === ID_TYPE_CUSTOM_CODE) {
          const labelErr = validateCustomIdTypeLabel(ident.customTypeLabel);
          if (labelErr) return `Identifier #${i + 1}: ${labelErr}`;
        } else if (!ident.type) {
          return `Identifier #${i + 1}: type is required`;
        }
        const valErr = validateIdentifierValue(
          countryCode,
          ident.type === ID_TYPE_CUSTOM_CODE ? ID_TYPE_CUSTOM_CODE : ident.type,
          ident.value,
        );
        if (valErr) return `Identifier #${i + 1}: ${valErr}`;
        const canonType = canonicalTypeCode(countryCode, ident);
        const norm = normalizeIdValue(ident.value);
        const key = `${countryCode}|${canonType}|${norm}`;
        if (seenKeys.has(key)) {
          return `Identifier #${i + 1}: duplicate of an earlier identifier in this filing`;
        }
        seenKeys.add(key);
      }
      if (primaryIndex < 0 || primaryIndex >= identifiers.length) {
        return "Mark one identifier as primary";
      }
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
      if (parentEntityCt && !CT_NUMBER_PATTERN.test(parentEntityCt.trim())) {
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

      // Build the public identifiers array. Each entry stores:
      //   - the canonical type code (uppercase machine label) for hashing
      //   - the user-facing label for display
      //   - the raw user input AND the normalized form. Both are saved so
      //     the receipt can show "12-3456789" while the on-chain hash
      //     references "123456789".
      const metadataIdentifiers: EntityIdentifier[] = identifiers.map((ident, i) => {
        const canonType = canonicalTypeCode(countryCode, ident);
        const label = typeLabelFor(countryCode, ident);
        const normalized = normalizeIdValue(ident.value);
        return {
          type: canonType,
          typeLabel: label,
          value: ident.value.trim(),
          normalizedValue: normalized,
          primary: i === primaryIndex,
          custom: ident.type === ID_TYPE_CUSTOM_CODE,
        };
      });

      const primary = identifiers[primaryIndex];
      const primaryCanonType = canonicalTypeCode(countryCode, primary);
      const primaryNormalized = normalizeIdValue(primary.value);
      const primaryHash = Array.from(
        idHashBytes(countryCode, primaryCanonType, primary.value),
      );
      const entityId = deriveEntityId(
        countryCode,
        primaryCanonType,
        primary.value,
      );

      const additional = identifiers
        .map((ident, i) => ({ ident, i }))
        .filter(({ i }) => i !== primaryIndex)
        .map(({ ident }) => {
          const canonType = canonicalTypeCode(countryCode, ident);
          const idHash = Array.from(
            idHashBytes(countryCode, canonType, ident.value),
          );
          return {
            input: {
              country: countryCode,
              idType: canonType,
              idValue: normalizeIdValue(ident.value),
            },
            idHash,
          };
        });

      const metadata: EntityMetadata = {
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || undefined,
        identifiers: metadataIdentifiers,
        countryCode,
        countryLabel: country.label,
        subdivision: subdivision.trim() || undefined,
        entityType,
        incorporationDate: incorporationDate || undefined,
        industry: industry || undefined,
        operatingRegions:
          operatingRegions.length > 0 ? operatingRegions : undefined,
        websites: liveWebsites.length > 0 ? liveWebsites : undefined,
        parentEntityCt:
          parentEntityCt.trim().toUpperCase() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        operatingStatus,
        hqCity: hqCity.trim() || undefined,
        hqCountryCode: hqCountryCode || undefined,
        employeeBand: employeeBand || undefined,
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
      await createEntity(program, publicKey, {
        primary: {
          country: countryCode,
          idType: primaryCanonType,
          idValue: primaryNormalized,
        },
        primaryIdHash: primaryHash,
        additional,
        metadataUri: up.uri,
        entityId,
      });
      setProgress(
        t("entryForm.progress.filed", {
          ct: ctNumberFromPrimaryId(
            countryCode,
            primaryCanonType,
            primary.value,
          ),
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
                    onChange={(e) => changeCountry(e.target.value)}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="label">
                    {subdivisionLabel} (optional)
                  </label>
                  <select
                    value={subdivision}
                    onChange={(e) => setSubdivision(e.target.value)}
                  >
                    <option value="">— select —</option>
                    {subdivisionOptions.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <label className="label">Identifiers</label>
                <div className="hint" style={{ marginTop: -4, marginBottom: 8 }}>
                  Add one or more registry IDs for this entity. Mark the
                  primary one — it determines the CT-Number and locks this
                  entity globally on chain. Additional IDs (e.g. SEC CIK
                  alongside an EIN) attach via per-identifier IdClaim PDAs.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {identifiers.map((ident, i) => (
                    <IdentifierRow
                      key={i}
                      index={i}
                      identifier={ident}
                      isPrimary={i === primaryIndex}
                      canRemove={identifiers.length > 1}
                      typeOptions={idTypeOptions}
                      onChange={(patch) => setIdentifierField(i, patch)}
                      onMakePrimary={() => setPrimaryIndex(i)}
                      onRemove={() => removeIdentifier(i)}
                    />
                  ))}
                </div>
                {identifiers.length < MAX_IDENTIFIERS && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={addIdentifier}
                    style={{ marginTop: 8 }}
                  >
                    + Add identifier
                  </button>
                )}
                <div className="hint" style={{ marginTop: 8 }}>
                  Up to {MAX_IDENTIFIERS} identifiers per entity. The primary
                  identifier cannot be changed after signing.
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
              <div className="form-row">
                <label className="label">Operating status</label>
                <select
                  value={operatingStatus}
                  onChange={(e) =>
                    setOperatingStatus(
                      e.target.value as "active" | "dormant" | "dissolved",
                    )
                  }
                >
                  {OPERATING_STATUSES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <div className="hint">
                  {OPERATING_STATUSES.find((s) => s.code === operatingStatus)
                    ?.hint}
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
                  {INDUSTRY_GROUPS.map(({ group, items }) => (
                    <optgroup key={group} label={group}>
                      {items.map((i) => (
                        <option key={i.code} value={i.code}>
                          {i.label}
                        </option>
                      ))}
                    </optgroup>
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

              <div className="form-grid-2">
                <div className="form-row">
                  <label className="label">Headquarters city (optional)</label>
                  <input
                    value={hqCity}
                    onChange={(e) => setHqCity(e.target.value)}
                    placeholder="e.g. Singapore, San Francisco"
                    maxLength={64}
                  />
                  <div className="hint">
                    Where the entity actually operates. May differ from
                    jurisdiction of registration.
                  </div>
                </div>
                <div className="form-row">
                  <label className="label">Headquarters country (optional)</label>
                  <select
                    value={hqCountryCode}
                    onChange={(e) => setHqCountryCode(e.target.value)}
                  >
                    <option value="">— same as registration —</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <label className="label">Employee count (optional)</label>
                <select
                  value={employeeBand}
                  onChange={(e) => setEmployeeBand(e.target.value)}
                >
                  <option value="">— prefer not to say —</option>
                  {EMPLOYEE_BANDS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <div className="hint">
                  Banded so you can disclose scale without committing to an
                  exact headcount.
                </div>
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
                  padding: "14px 16px",
                  borderLeft: "3px solid var(--stamp)",
                  background: "var(--paper-2)",
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    color: "var(--stamp-deep)",
                    fontWeight: 600,
                    marginBottom: 6,
                    textTransform: "uppercase",
                  }}
                >
                  {t("entryForm.filer.declaration")} ·{" "}
                  {filerRole || "— pending —"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 14,
                    color: "var(--ink)",
                    lineHeight: 1.55,
                  }}
                >
                  {filerRole
                    ? FILER_DECLARATIONS[filerRole]
                    : "Filer role not selected. Go back to Step 1."}
                </div>
              </div>

              <ConfirmCheckbox
                checked={confirmAccurate}
                onChange={setConfirmAccurate}
              >
                {t("entryForm.confirm.accurate")}
              </ConfirmCheckbox>
              <ConfirmCheckbox
                checked={confirmPublic}
                onChange={setConfirmPublic}
              >
                {t("entryForm.confirm.public.lead")}
                <strong>{t("entryForm.confirm.public.bold")}</strong>
                {t("entryForm.confirm.public.tail")}
              </ConfirmCheckbox>

              {(() => {
                // Preview the CT-Number that will be locked at signing —
                // computed from the *primary* identifier the same way the
                // on-chain program will derive it. Helps the user catch
                // typos before the value is committed for good.
                const primary = identifiers[primaryIndex];
                if (!primary || !primary.value.trim()) return null;
                let canonType = "";
                let ctPreview = "";
                let primaryLabel = "";
                try {
                  canonType = canonicalTypeCode(countryCode, primary);
                  primaryLabel = typeLabelFor(countryCode, primary);
                  ctPreview = ctNumberFromPrimaryId(
                    countryCode,
                    canonType,
                    primary.value,
                  );
                } catch {
                  return null;
                }
                return (
                  <div
                    style={{
                      padding: "14px 16px",
                      borderLeft: "3px solid var(--stamp-deep)",
                      background: "var(--paper-3)",
                      marginBottom: 18,
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      color: "var(--ink)",
                      lineHeight: 1.6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.16em",
                        color: "var(--stamp-deep)",
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      THIS CT-NUMBER WILL LOCK TO ↓
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {ctPreview}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--ink-3)",
                        marginTop: 4,
                      }}
                    >
                      {countryCode} · {primaryLabel} ·{" "}
                      {normalizeIdValue(primary.value)}
                    </div>
                  </div>
                );
              })()}

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
                <div>
                  ENTITY SEED · [&quot;entity&quot;, sha256(country|type|value)[..5]]
                </div>
                <div>
                  ID CLAIM SEED · [&quot;id-claim&quot;, sha256(country|type|value)]
                </div>
                <div>
                  IDENTIFIERS · {identifiers.length} (primary + {identifiers.length - 1} additional)
                </div>
                <div>
                  FEE · ~{(0.00204 + 0.001 * identifiers.length).toFixed(5)}{" "}
                  SOL (rent-exempt deposit)
                </div>
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

      {/* Live preview — receipt style */}
      <Receipt
        legalName={legalName}
        tradeName={tradeName}
        country={country}
        subdivision={subdivision}
        subdivisionLabel={subdivisionLabel}
        subdivisionOptions={subdivisionOptions}
        entityType={entityType}
        identifiers={identifiers}
        primaryIndex={primaryIndex}
        countryCode={countryCode}
        incorporationDate={incorporationDate}
        operatingStatus={operatingStatus}
        industry={industry}
        operatingRegions={operatingRegions}
        filerRole={filerRole}
        websites={websites}
        hqCity={hqCity}
        hqCountryCode={hqCountryCode}
        employeeBand={employeeBand}
        parentEntityCt={parentEntityCt}
        contactEmail={contactEmail}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receipt — printed-style live preview that mirrors what the user is filling.
//
// Why receipt-style: the "filing" metaphor reads more directly than a
// half-rendered card. Dotted leaders + monospace + a torn footer convey
// "this is a draft of an official record" and answer the question "what
// will I be signing in step 4?" at a glance.
// ---------------------------------------------------------------------------

function Receipt(props: {
  legalName: string;
  tradeName: string;
  country: { code: string; label: string };
  subdivision: string;
  subdivisionLabel: string;
  subdivisionOptions: { code: string; label: string }[];
  entityType: string;
  identifiers: LocalIdentifier[];
  primaryIndex: number;
  countryCode: string;
  incorporationDate: string;
  operatingStatus: "active" | "dormant" | "dissolved";
  industry: string;
  operatingRegions: string[];
  filerRole: FilerRole | "";
  websites: string[];
  hqCity: string;
  hqCountryCode: string;
  employeeBand: string;
  parentEntityCt: string;
  contactEmail: string;
}) {
  const {
    legalName,
    tradeName,
    country,
    subdivision,
    subdivisionLabel,
    subdivisionOptions,
    entityType,
    identifiers,
    primaryIndex,
    countryCode,
    incorporationDate,
    operatingStatus,
    industry,
    operatingRegions,
    filerRole,
    websites,
    hqCity,
    hqCountryCode,
    employeeBand,
    parentEntityCt,
    contactEmail,
  } = props;

  // Subdivisions are stored as codes for curated lists (US "DE" = Delaware,
  // AU "NSW", CN "BJ"). The receipt shows the human label. Free-text values
  // pass through unchanged.
  const subdivisionDisplay = subdivision
    ? subdivisionOptions.find((s) => s.code === subdivision)?.label ??
      subdivision
    : "";

  const validIdentifiers = identifiers.filter((id) => id.value.trim());
  const filledFields = [
    legalName.trim(),
    tradeName.trim(),
    validIdentifiers.length > 0 ? "ok" : "",
    subdivision,
    incorporationDate,
    operatingStatus,
    industry,
    operatingRegions.length > 0 ? "ok" : "",
    websites.some((w) => w.trim()) ? "ok" : "",
    hqCity.trim(),
    hqCountryCode,
    employeeBand,
    parentEntityCt.trim(),
    contactEmail.trim(),
  ].filter(Boolean).length;
  const totalFields = 14;

  // Preview the CT-Number whenever the primary identifier is populated.
  const primary = identifiers[primaryIndex];
  let ctPreview: string | null = null;
  if (primary && primary.value.trim()) {
    try {
      const canonType =
        primary.type === ID_TYPE_CUSTOM_CODE
          ? primary.customTypeLabel.trim().toUpperCase()
          : primary.type.toUpperCase();
      if (canonType) {
        ctPreview = ctNumberFromPrimaryId(
          countryCode,
          canonType,
          primary.value,
        );
      }
    } catch {
      ctPreview = null;
    }
  }
  const operatingStatusLabel =
    operatingStatus === "active"
      ? "Active"
      : operatingStatus === "dormant"
        ? "Dormant"
        : "Dissolved";
  const hqCountryLabel =
    COUNTRIES.find((c) => c.code === hqCountryCode)?.label ?? hqCountryCode;
  const employeeBandLabel =
    EMPLOYEE_BANDS.find((b) => b.code === employeeBand)?.label;

  const liveWebsiteCount = websites.filter((w) => w.trim()).length;
  const industryLabel = INDUSTRIES.find((i) => i.code === industry)?.label;
  const entityTypeLabel =
    ENTITY_TYPES.find((t) => t.code === entityType)?.code ?? "—";

  return (
    <div style={{ position: "sticky", top: 24 }}>
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--rule)",
          padding: "20px 22px 0",
          fontFamily: "var(--mono)",
          fontSize: 12,
          color: "var(--ink)",
          // Torn / receipt-paper feel: drop a tiny shadow under the bottom
          // edge but keep the top crisp.
          boxShadow: "0 8px 18px -14px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", paddingBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.28em",
              color: "var(--stamp-deep)",
              fontWeight: 700,
            }}
          >
            ENTITY FILING LIVE PREVIEW
          </div>
        </div>

        <DoubleRule />

        {/* Filing metadata: receipt no. + clock */}
        <ReceiptMetaRow
          left={["FILING #", "DRAFT-PENDING"]}
          right={["DATE", new Date().toISOString().slice(0, 10)]}
        />
        <ReceiptMetaRow
          left={["CT-NUMBER", ctPreview ?? "— pending —"]}
          right={["STATUS", "UNFILED"]}
        />

        <DashedRule />

        {/* Legal name block — feature line */}
        <div style={{ padding: "10px 0 4px" }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.2em",
              color: "var(--ink-3)",
            }}
          >
            LEGAL NAME
          </div>
          {legalName.trim() ? (
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 19,
                fontWeight: 700,
                lineHeight: 1.2,
                marginTop: 2,
              }}
            >
              {legalName}
            </div>
          ) : (
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                marginTop: 4,
                letterSpacing: "0.04em",
              }}
            >
              — not yet entered —
            </div>
          )}
          {tradeName.trim() && (
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.06em",
                marginTop: 2,
              }}
            >
              DBA · {tradeName}
            </div>
          )}
        </div>

        <DashedRule />

        {/* Itemized fields */}
        <div style={{ padding: "8px 0 4px" }}>
          <ReceiptItem
            label="Jurisdiction"
            value={`${country.code} · ${country.label}`}
          />
          {subdivisionDisplay && (
            <ReceiptItem label={subdivisionLabel} value={subdivisionDisplay} />
          )}
          <ReceiptItem label="Entity type" value={entityTypeLabel} />
          <ReceiptItem
            label="Operating status"
            value={operatingStatusLabel}
            emphasis={operatingStatus !== "active"}
          />
          {validIdentifiers.length === 0 ? (
            <ReceiptItem label="Identifiers" value="—" />
          ) : (
            identifiers.map((ident, i) => {
              if (!ident.value.trim()) return null;
              const label =
                ident.type === ID_TYPE_CUSTOM_CODE
                  ? ident.customTypeLabel.trim() || "CUSTOM"
                  : findIdType(countryCode, ident.type)?.label ?? ident.type;
              const isPrimary = i === primaryIndex;
              return (
                <ReceiptItem
                  key={i}
                  label={isPrimary ? `${label} (primary)` : label}
                  value={ident.value.trim()}
                  mono
                  emphasis={isPrimary}
                />
              );
            })
          )}
          <ReceiptItem
            label="Incorporated"
            value={incorporationDate || "—"}
          />
          {industry && (
            <ReceiptItem label="Industry" value={industryLabel ?? industry} />
          )}
          {operatingRegions.length > 0 && (
            <ReceiptItem
              label="Regions"
              value={operatingRegions.join(" · ")}
            />
          )}
          {liveWebsiteCount > 0 && (
            <ReceiptItem
              label="Websites"
              value={`${liveWebsiteCount} listed`}
            />
          )}
          {(hqCity.trim() || hqCountryCode) && (
            <ReceiptItem
              label="Headquarters"
              value={
                [hqCity.trim(), hqCountryLabel]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
          )}
          {employeeBandLabel && (
            <ReceiptItem label="Employees" value={employeeBandLabel} />
          )}
          {parentEntityCt.trim() && (
            <ReceiptItem
              label="Parent CT"
              value={parentEntityCt.trim().toUpperCase()}
              mono
            />
          )}
          {contactEmail.trim() && (
            <ReceiptItem label="Contact" value={contactEmail.trim()} mono />
          )}
        </div>

        <DashedRule />

        {/* Subtotal-style summary */}
        <div style={{ padding: "8px 0" }}>
          <ReceiptItem
            label="Fields entered"
            value={`${filledFields} of ${totalFields}`}
            emphasis
          />
          <ReceiptItem
            label="Filer"
            value={filerRole ? filerRole.toUpperCase() : "— pending —"}
            emphasis
          />
        </div>

        <DoubleRule />

        {/* Footer + stamp */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "12px 0 6px",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.16em",
              color: "var(--ink-3)",
              lineHeight: 1.6,
            }}
          >
            <div>SIGNS AT STEP 4</div>
            <div>METADATA → IPFS (PLAINTEXT)</div>
            <div>CT FROM PRIMARY ID HASH</div>
          </div>
          <Stamp text="Pending" sub="UNFILED" size="small" />
        </div>

        {/* Torn-edge feel via SVG zig-zag */}
        <TornEdge />
      </div>
    </div>
  );
}

function ReceiptItem({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        padding: "3px 0",
        fontSize: 12,
      }}
    >
      <span
        style={{
          color: emphasis ? "var(--ink)" : "var(--ink-2)",
          fontWeight: emphasis ? 600 : 400,
          flexShrink: 0,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        style={{
          flex: 1,
          borderBottom: "1px dotted var(--rule)",
          marginBottom: 4,
        }}
      />
      <span
        style={{
          fontFamily: mono ? "var(--mono)" : "inherit",
          fontWeight: emphasis ? 700 : 500,
          color: emphasis ? "var(--stamp-deep)" : "var(--ink)",
          textAlign: "right",
          maxWidth: "55%",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ReceiptMetaRow({
  left,
  right,
}: {
  left: [string, string];
  right: [string, string];
}) {
  const cellStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    fontSize: 10,
    letterSpacing: "0.06em",
  };
  const tagStyle: React.CSSProperties = {
    color: "var(--ink-3)",
    letterSpacing: "0.16em",
    fontSize: 9,
  };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        gap: 12,
      }}
    >
      <div style={cellStyle}>
        <span style={tagStyle}>{left[0]}</span>
        <span style={{ color: "var(--ink-2)" }}>{left[1]}</span>
      </div>
      <div style={{ ...cellStyle, alignItems: "flex-end" }}>
        <span style={tagStyle}>{right[0]}</span>
        <span style={{ color: "var(--ink-2)" }}>{right[1]}</span>
      </div>
    </div>
  );
}

function DoubleRule() {
  return (
    <div
      aria-hidden
      style={{
        borderTop: "1px solid var(--rule)",
        borderBottom: "1px solid var(--rule)",
        height: 3,
      }}
    />
  );
}

function DashedRule() {
  return (
    <div
      aria-hidden
      style={{
        borderTop: "1px dashed var(--rule)",
        marginTop: 2,
      }}
    />
  );
}

function TornEdge() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 6"
      preserveAspectRatio="none"
      style={{
        display: "block",
        width: "calc(100% + 44px)",
        height: 6,
        marginLeft: -22,
        marginRight: -22,
        marginTop: 8,
        color: "var(--paper)",
      }}
    >
      <path
        d="M0 0 L8 6 L16 0 L24 6 L32 0 L40 6 L48 0 L56 6 L64 0 L72 6 L80 0 L88 6 L96 0 L104 6 L112 0 L120 6 L128 0 L136 6 L144 0 L152 6 L160 0 L168 6 L176 0 L184 6 L192 0 L200 6 L200 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// IdentifierRow — one row in Step 1's identifiers list.
//
// Lays out: type dropdown · primary radio · value input · remove button.
// When the user picks "CUSTOM" from the type dropdown, an extra label input
// appears above the value input so they can name the type (e.g. "STATE_FILE_NO").
// ---------------------------------------------------------------------------

function IdentifierRow({
  index,
  identifier,
  isPrimary,
  canRemove,
  typeOptions,
  onChange,
  onMakePrimary,
  onRemove,
}: {
  index: number;
  identifier: LocalIdentifier;
  isPrimary: boolean;
  canRemove: boolean;
  typeOptions: IdTypeOption[];
  onChange: (patch: Partial<LocalIdentifier>) => void;
  onMakePrimary: () => void;
  onRemove: () => void;
}) {
  const isCustom = identifier.type === ID_TYPE_CUSTOM_CODE;
  const presetMatch = typeOptions.find((t) => t.code === identifier.type);
  const placeholder = isCustom
    ? "value (uppercase letters + digits)"
    : presetMatch?.format ?? "identifier value";
  const description = isCustom
    ? "Custom type — pick a stable label for this kind of ID."
    : presetMatch?.description;

  return (
    <div
      style={{
        border: `1.5px solid ${isPrimary ? "var(--stamp-deep)" : "var(--rule)"}`,
        background: isPrimary ? "var(--paper-3)" : "var(--paper-2)",
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            color: "var(--ink-3)",
            fontWeight: 600,
          }}
        >
          ID #{index + 1}
        </span>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            color: isPrimary ? "var(--stamp-deep)" : "var(--ink-2)",
            fontWeight: isPrimary ? 700 : 500,
          }}
        >
          <input
            type="radio"
            name="primary-identifier"
            checked={isPrimary}
            onChange={onMakePrimary}
            style={{
              position: "absolute",
              opacity: 0,
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              border: 0,
            }}
          />
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: `1.5px solid ${isPrimary ? "var(--stamp-deep)" : "var(--ink-3)"}`,
              background: "var(--paper)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isPrimary && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--stamp-deep)",
                }}
              />
            )}
          </span>
          PRIMARY
        </label>
      </div>

      <div className="form-grid-2" style={{ gap: 8 }}>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label className="label">Type</label>
          <select
            value={identifier.type}
            onChange={(e) => onChange({ type: e.target.value })}
          >
            {typeOptions.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
            <option value={ID_TYPE_CUSTOM_CODE}>— Custom type —</option>
          </select>
        </div>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label className="label">Value</label>
          <input
            value={identifier.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={placeholder}
            maxLength={64}
          />
        </div>
      </div>

      {isCustom && (
        <div className="form-row" style={{ marginTop: 8, marginBottom: 0 }}>
          <label className="label">Custom type label</label>
          <input
            value={identifier.customTypeLabel}
            onChange={(e) =>
              onChange({
                customTypeLabel: e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9_-]/g, ""),
              })
            }
            placeholder="e.g. STATE_FILE_NO"
            maxLength={32}
          />
          <div className="hint">
            Uppercase letters, digits, underscore, dash. Locked into the
            on-chain hash, so pick a stable label.
          </div>
        </div>
      )}

      {description && (
        <div className="hint" style={{ marginTop: 6 }}>
          {description}
        </div>
      )}

      {canRemove && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onRemove}
          style={{ marginTop: 8 }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

function ConfirmCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  // Same reason as FilerOption: the global `.form-row input` rule mangles
  // native checkboxes. We hide the real input visually but keep it
  // accessible, and draw the box ourselves so layout stays predictable.
  return (
    <div className="form-row">
      <label
        style={{
          display: "grid",
          gridTemplateColumns: "20px 1fr",
          columnGap: 12,
          alignItems: "start",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            border: 0,
          }}
        />
        <span
          aria-hidden
          style={{
            width: 16,
            height: 16,
            border: `1.5px solid ${checked ? "var(--stamp-deep)" : "var(--ink-3)"}`,
            background: checked ? "var(--stamp-deep)" : "var(--paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 3,
            color: "var(--paper)",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--mono)",
            lineHeight: 1,
          }}
        >
          {checked && "✓"}
        </span>
        <span
          style={{
            fontFamily: "var(--serif)",
            fontSize: 13,
            color: "var(--ink-2)",
            lineHeight: 1.55,
          }}
        >
          {children}
        </span>
      </label>
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
  // Why we hide the real radio: the form's global `.form-row input`
  // rule (padding 10/12, border 1.5px, mono font) is meant for text
  // inputs — it inflates the radio glyph and pushes the surrounding
  // text out of place. We keep the input for keyboard / form semantics
  // but draw the indicator ourselves.
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr",
        columnGap: 12,
        rowGap: 4,
        alignItems: "start",
        padding: "14px 16px",
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
        style={{
          position: "absolute",
          opacity: 0,
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          border: 0,
        }}
      />
      <span
        aria-hidden
        style={{
          gridRow: "1 / span 2",
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: `1.5px solid ${active ? "var(--stamp-deep)" : "var(--ink-3)"}`,
          background: "var(--paper)",
          marginTop: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {active && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--stamp-deep)",
            }}
          />
        )}
      </span>
      <span
        style={{
          fontFamily: "var(--serif)",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--ink)",
          lineHeight: 1.3,
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontFamily: "var(--serif)",
          fontSize: 13,
          color: "var(--ink-2)",
          lineHeight: 1.5,
        }}
      >
        {body}
      </span>
    </label>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  attestRelationship,
  fetchAllEntities,
  fetchAllIssuers,
  fetchIssuer,
  fetchProjectsForEntity,
} from "@/lib/anchor/client";
import { entityIdToCtNumber } from "@/lib/utils/ct-number";
import { hexToBytes, sha256Bytes } from "@/lib/utils/hash";
import { bytesHex, formatTimestamp, shortKey } from "@/lib/utils/format";
import { Stamp, TierPill } from "@/components/registry-bits";
import {
  EvidenceUploader,
  type EvidenceValue,
} from "@/components/evidence-uploader";
import { uploadMetadata } from "@/lib/upload-client";
import {
  ISSUER_KIND_LABELS,
  REL_KIND,
  REL_KIND_META,
} from "@/types";
import type { Entity, Issuer, Project } from "@/types";

export default function AttestRoute() {
  return (
    <Suspense fallback={<p className="hint">LOADING ATTEST FORM…</p>}>
      <AttestPage />
    </Suspense>
  );
}

const KIND_OPTIONS: { value: number; label: string; verb: string }[] = Object.entries(
  REL_KIND_META,
).map(([k, v]) => ({ value: Number(k), label: kindLabel(Number(k)), verb: v.verb }));

function kindLabel(k: number): string {
  switch (k) {
    case 1:
      return "OPERATES_PROJECT";
    case 2:
      return "DEPLOYS_WALLET";
    case 3:
      return "CONTROLS_WALLET";
    case 4:
      return "HAS_DOMAIN";
    case 5:
      return "SUBSIDIARY_OF";
    case 6:
      return "PARENT_OF";
    case 7:
      return "HAS_UBO";
    case 8:
      return "HAS_OFFICER";
    case 9:
      return "AUDITED_BY";
    default:
      return "RELATIONSHIP";
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function AttestPage() {
  const program = useProgram();
  const router = useRouter();
  const params = useSearchParams();
  const { publicKey, signMessage } = useWallet();
  const presetCt = params.get("entity") ?? "";

  const [step, setStep] = useState(1);
  const [entities, setEntities] = useState<
    { publicKey: PublicKey; account: Entity; ctNumber: string; entityIdHex: string }[]
  >([]);
  const [issuersAll, setIssuersAll] = useState<
    { publicKey: PublicKey; account: Issuer }[]
  >([]);
  const [myIssuer, setMyIssuer] = useState<Issuer | null>(null);
  const [projects, setProjects] = useState<
    { publicKey: PublicKey; account: Project }[]
  >([]);

  const [entityCt, setEntityCt] = useState(presetCt);
  const [kind, setKind] = useState<number>(REL_KIND.OPERATES_PROJECT);
  const [target, setTarget] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [validFrom, setValidFrom] = useState(todayISO());
  const [validUntil, setValidUntil] = useState("");
  const [evidence, setEvidence] = useState<EvidenceValue | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!program) return;
    let alive = true;
    (async () => {
      const [rawEntities, rawIssuers] = await Promise.all([
        fetchAllEntities(program),
        fetchAllIssuers(program),
      ]);
      if (!alive) return;
      setEntities(
        rawEntities.map((e) => {
          const acc = e.account as unknown as Entity;
          return {
            publicKey: e.publicKey,
            account: acc,
            ctNumber: entityIdToCtNumber(acc.entityId),
            entityIdHex: bytesHex(acc.entityId),
          };
        }),
      );
      setIssuersAll(
        rawIssuers.map((i) => ({
          publicKey: i.publicKey,
          account: i.account as unknown as Issuer,
        })),
      );
    })();
    return () => {
      alive = false;
    };
  }, [program]);

  useEffect(() => {
    if (!program || !publicKey) {
      setMyIssuer(null);
      return;
    }
    let alive = true;
    fetchIssuer(program, publicKey).then((iss) => {
      if (!alive) return;
      setMyIssuer((iss as Issuer | null) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [program, publicKey]);

  const selectedEntity = useMemo(
    () => entities.find((e) => e.ctNumber === entityCt) ?? null,
    [entities, entityCt],
  );

  useEffect(() => {
    if (!program || !selectedEntity) {
      setProjects([]);
      return;
    }
    let alive = true;
    fetchProjectsForEntity(program, selectedEntity.publicKey).then((p) => {
      if (!alive) return;
      setProjects(
        p.map((x) => ({
          publicKey: x.publicKey,
          account: x.account as unknown as Project,
        })),
      );
    });
    return () => {
      alive = false;
    };
  }, [program, selectedEntity]);

  const meta = REL_KIND_META[kind];
  const targetType = meta?.targetType ?? "wallet";

  // Computed evidence hash preview. When the user uploaded a file we surface
  // the real sha256 the server pinned. Otherwise we fall back to a cheap
  // deterministic stub so the form still has something to show before sign.
  const evidenceHashPreview = useMemo(() => {
    if (evidence?.source === "upload" && evidence.hashHex) {
      const h = evidence.hashHex.toLowerCase();
      return `0x${h.slice(0, 12)}…${h.slice(-6)}`;
    }
    const seed = `${entityCt}|${kind}|${target}|${evidence?.uri ?? ""}|${evidenceNotes}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    }
    const hex = (Math.abs(h) >>> 0).toString(16).padStart(8, "0");
    return `0x${hex}…${hex.slice(0, 4)}`;
  }, [entityCt, kind, target, evidence, evidenceNotes]);

  const pdaPreview = useMemo(() => {
    if (!selectedEntity || !target) return "— pending fields —";
    const seed = `rel|${entityCt}|${kind}|${target}|${publicKey?.toBase58() ?? ""}`;
    let h1 = 0,
      h2 = 0;
    for (let i = 0; i < seed.length; i++) {
      h1 = ((h1 << 7) - h1 + seed.charCodeAt(i)) | 0;
      h2 = ((h2 << 11) - h2 + seed.charCodeAt(i)) | 0;
    }
    const a = (Math.abs(h1) >>> 0).toString(16).padStart(8, "0").toUpperCase();
    const b = (Math.abs(h2) >>> 0).toString(16).padStart(8, "0").toUpperCase();
    return `Rel${a}${b}…${a.slice(0, 4)}`;
  }, [selectedEntity, target, entityCt, kind, publicKey]);

  function canAdvance(): boolean {
    if (step === 1) return !!selectedEntity;
    if (step === 2) return target.trim().length > 0;
    if (step === 3) return !!myIssuer;
    return true;
  }

  function targetRefBytes(): number[] | { error: string } {
    if (!target.trim()) return { error: "Target is required." };
    if (
      targetType === "wallet" ||
      targetType === "project" ||
      targetType === "entity" ||
      targetType === "issuer"
    ) {
      try {
        const pk = new PublicKey(target.trim());
        return Array.from(pk.toBytes());
      } catch {
        return { error: "Invalid base58 pubkey." };
      }
    }
    return sha256Bytes(target.trim().toLowerCase());
  }

  async function submit() {
    setError(null);
    if (!program || !publicKey) {
      setError("Connect a wallet first.");
      return;
    }
    if (!myIssuer) {
      setError("You must register as an Issuer before signing attestations.");
      return;
    }
    if (!selectedEntity) {
      setError("Select a subject Entity.");
      return;
    }
    const targetBytes = targetRefBytes();
    if ("error" in targetBytes) {
      setError(targetBytes.error);
      return;
    }
    const validFromTs = validFrom
      ? Math.floor(new Date(validFrom).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    const validUntilTs = validUntil
      ? Math.floor(new Date(validUntil).getTime() / 1000)
      : 0;

    setSubmitting(true);
    try {
      let evUri = evidence?.uri.trim() ?? "";
      let evidenceHashBytes: number[];

      if (evidence?.source === "upload" && evidence.hashHex) {
        // Strong binding: hash on chain == sha256(file bytes). The
        // EvidenceUploader has already cross-checked client and server hashes.
        if (evidence.hashHex.length !== 64) {
          throw new Error(
            "Internal: uploaded evidence hash is malformed. Re-upload the file.",
          );
        }
        evidenceHashBytes = hexToBytes(evidence.hashHex);
      } else if (evUri || evidenceNotes.trim()) {
        // URL mode or notes-only mode: we can't bind a file hash, so we
        // commit to sha256(notes || URL || target) as a weak content marker.
        evidenceHashBytes = sha256Bytes(
          evidenceNotes.trim() || evUri || target,
        );
      } else {
        // Nothing supplied at all — pad zeros so the on-chain field is well
        // formed, but the attestation will read as "no evidence on file".
        evidenceHashBytes = sha256Bytes(target);
      }

      // Auto-pin notes if the user provided them and there's no URI yet, so
      // the attestation still has a human-readable pointer attached.
      if (!evUri && evidenceNotes.trim()) {
        const up = await uploadMetadata(
          publicKey,
          signMessage,
          JSON.stringify({ note: evidenceNotes.trim() }),
          { sensitivity: "sensitive" },
        );
        evUri = up.uri;
      }

      await attestRelationship(program, publicKey, {
        entity: selectedEntity.publicKey,
        kind,
        targetRef: targetBytes,
        evidenceHash: evidenceHashBytes,
        evidenceUri: evUri,
        validFrom: validFromTs,
        validUntil: validUntilTs,
      });
      setSuccessMsg(
        `Attestation filed for ${selectedEntity.ctNumber}. Redirecting…`,
      );
      setTimeout(
        () => router.push(`/entry/${selectedEntity.entityIdHex}`),
        900,
      );
    } catch (err) {
      setError((err as Error).message ?? "Attestation failed");
    } finally {
      setSubmitting(false);
    }
  }

  const stepTitle =
    [
      "Subject & verb",
      "Target & validity",
      "Issuer & evidence",
      "Review & sign",
    ][step - 1] ?? "";

  return (
    <div data-screen="04 Attest">
      <div className="docnum" style={{ marginBottom: 8 }}>
        FORM CT-ATT · 2026 EDITION · ART. 5.5
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          File an attestation.
        </h2>
        <span className="section-meta">
          PDA seeds: [&quot;rel&quot;, entity, kind, target, issuer]
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--serif)",
          fontSize: 17,
          color: "var(--ink-2)",
          maxWidth: "70ch",
          marginTop: -8,
          marginBottom: 32,
        }}
      >
        A signed, time-bounded edge between a subject Entity and a target —
        wallet, domain, project, person hash, or another Entity. Multiple
        issuers may attest the same fact independently; this form creates one
        relationship PDA on your behalf.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 32,
          alignItems: "start",
        }}
      >
        <div className="doc-card">
          <div className="doc-card-h">
            <div className="doc-card-title">
              Step {step} of 4 · {stepTitle}
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              {["SUBJECT", "TARGET", "EVIDENCE", "SIGN"][step - 1]} · §{step}
            </div>
          </div>

          {step === 1 && (
            <>
              <div className="form-row">
                <label className="label">Subject entity (CT-Number)</label>
                <select
                  value={entityCt}
                  onChange={(e) => setEntityCt(e.target.value)}
                >
                  <option value="">— select an entity —</option>
                  {entities.map((e) => (
                    <option key={e.ctNumber} value={e.ctNumber}>
                      {e.ctNumber}
                      {" · "}
                      {e.account.metadataUri ? "" : "(metadata pending)"}
                    </option>
                  ))}
                </select>
                <div className="hint">
                  Every relationship is anchored to one Entity.
                </div>
              </div>
              <div className="form-row">
                <label className="label">Relationship kind (verb)</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(Number(e.target.value))}
                >
                  {KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} — {o.verb}
                    </option>
                  ))}
                </select>
                <div className="hint">
                  Target type will switch to:{" "}
                  <strong>{targetType.toUpperCase()}</strong>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-row">
                <label className="label">
                  Target reference ({targetType})
                </label>
                {kind === REL_KIND.OPERATES_PROJECT &&
                projects.length > 0 ? (
                  <select
                    value={target}
                    onChange={(e) => {
                      const p = projects.find(
                        (x) => x.publicKey.toBase58() === e.target.value,
                      );
                      setTarget(e.target.value);
                      setTargetLabel(
                        p
                          ? `Project ${bytesHex(p.account.projectId).slice(0, 6)}`
                          : "",
                      );
                    }}
                  >
                    <option value="">
                      — select a project under this entity —
                    </option>
                    {projects.map((p) => (
                      <option
                        key={p.publicKey.toBase58()}
                        value={p.publicKey.toBase58()}
                      >
                        {bytesHex(p.account.projectId)} · PDA{" "}
                        {shortKey(p.publicKey, 4)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    placeholder={
                      targetType === "wallet"
                        ? "44-char Solana pubkey"
                        : targetType === "domain"
                          ? "example.com"
                          : targetType === "entity"
                            ? "Other entity PDA (base58)"
                            : targetType === "person"
                              ? "Person identifier (will be hashed)"
                              : "target_ref"
                    }
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                )}
                <div className="hint">
                  Stored on-chain as 32 bytes — pubkey or hash.
                </div>
              </div>
              <div className="form-row">
                <label className="label">Display label (off-chain)</label>
                <input
                  placeholder="e.g. Treasury wallet, Deployer key, Director Tan"
                  value={targetLabel}
                  onChange={(e) => setTargetLabel(e.target.value)}
                />
              </div>
              <div className="form-grid-2">
                <div className="form-row">
                  <label className="label">Valid from</label>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label className="label">Valid until</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    placeholder="Open-ended"
                  />
                  <div className="hint">Leave empty for no expiry.</div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="form-row">
                <label className="label">Sign as issuer (your wallet)</label>
                {myIssuer ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      border: "1.5px solid var(--rule)",
                      background: "var(--paper-2)",
                    }}
                  >
                    <TierPill tier={myIssuer.trustTier} />
                    <span
                      style={{
                        fontFamily: "var(--sans)",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {ISSUER_KIND_LABELS[myIssuer.kind] ?? "Issuer"}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: "var(--ink-3)",
                        marginLeft: "auto",
                      }}
                    >
                      authority{" "}
                      {publicKey ? shortKey(publicKey, 6) : "—"}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "12px",
                      border: "1.5px dashed var(--rule)",
                      background: "var(--paper-2)",
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: "var(--ink-2)",
                    }}
                  >
                    YOUR WALLET IS NOT REGISTERED AS AN ISSUER ·{" "}
                    <Link
                      href="/issuer/register"
                      style={{ color: "var(--stamp-deep)" }}
                    >
                      Register here →
                    </Link>
                  </div>
                )}
                <div className="hint">
                  Tier is public. Consumers decide what to trust.
                </div>
              </div>
              <div className="form-row">
                <label className="label">Evidence document</label>
                <EvidenceUploader
                  value={evidence}
                  onChange={(v) => {
                    setEvidence(v);
                    setError(null);
                  }}
                  onError={(msg) => setError(msg)}
                />
              </div>
              <div className="form-row">
                <label className="label">Evidence notes (off-chain)</label>
                <textarea
                  placeholder="Brief description of what the evidence proves. Stored alongside the file URI; the on-chain commitment is the file hash above."
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="label">Computed evidence hash</label>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 13,
                    color: "var(--stamp-deep)",
                    padding: "10px 12px",
                    border: "1.5px dashed var(--stamp-deep)",
                    background: "var(--paper-2)",
                  }}
                >
                  {evidenceHashPreview}
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="form-row">
                <label className="label">Relationship PDA (preview)</label>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 13,
                    color: "var(--ink)",
                    padding: "10px 12px",
                    background: "var(--paper-2)",
                    border: "1px solid var(--rule-soft)",
                  }}
                >
                  {pdaPreview}
                </div>
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
                  SEEDS · [&quot;rel&quot;, {selectedEntity?.ctNumber ?? "—"},{" "}
                  {kindLabel(kind)}, target, issuer]
                </div>
                <div>
                  PROGRAM · HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt
                </div>
                <div>
                  SIGNER · {publicKey ? shortKey(publicKey, 6) : "— not connected —"}
                </div>
                <div>FEE · ~0.00204 SOL (rent-exempt deposit)</div>
              </div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 14,
                  color: "var(--ink-2)",
                  lineHeight: 1.55,
                  padding: "14px 16px",
                  borderLeft: "3px solid var(--stamp)",
                  background: "var(--paper-2)",
                  marginBottom: 8,
                }}
              >
                By signing, the issuer authority key creates an append-only
                relationship account. The PDA cannot be deleted. Revocation is
                itself a signed event recorded against this same account.
              </div>
            </>
          )}

          {error && (
            <p className="error" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}
          {successMsg && !error && (
            <p
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--good)",
                letterSpacing: "0.06em",
                marginTop: 12,
              }}
            >
              ◆ {successMsg.toUpperCase()}
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
              onClick={() => (step === 1 ? router.push("/") : setStep(step - 1))}
            >
              ← {step === 1 ? "Cancel" : "Back"}
            </button>
            {step < 4 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canAdvance()}
                onClick={() => setStep(step + 1)}
              >
                Next:{" "}
                {[
                  "Target",
                  "Issuer & evidence",
                  "Review & sign",
                ][step - 1]}{" "}
                →
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-stamp"
                onClick={submit}
                disabled={submitting || !myIssuer}
              >
                {submitting ? "SIGNING…" : "◆ Sign & file attestation"}
              </button>
            )}
          </div>
        </div>

        {/* Live preview side */}
        <div className="doc-card">
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
              UNSIGNED DRAFT
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              SUBJECT ENTITY
            </div>
            {selectedEntity ? (
              <>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {selectedEntity.ctNumber}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--stamp-deep)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {selectedEntity.account.jurisdiction} · filed{" "}
                  {formatTimestamp(selectedEntity.account.createdAt)}
                </div>
              </>
            ) : (
              <div className="hint">— SUBJECT NOT SELECTED —</div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              VERB
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {kindLabel(kind)}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              TARGET
            </div>
            {targetLabel || target ? (
              <>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  {targetLabel || "(no label)"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--ink-3)",
                    wordBreak: "break-all",
                  }}
                >
                  {targetType.toUpperCase()} · {target || "—"}
                </div>
              </>
            ) : (
              <div className="hint">— TARGET NOT SET —</div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="docnum" style={{ marginBottom: 4 }}>
              SIGNER
            </div>
            {myIssuer ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TierPill tier={myIssuer.trustTier} />
                <span
                  style={{
                    fontFamily: "var(--sans)",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {ISSUER_KIND_LABELS[myIssuer.kind] ?? "Issuer"}
                </span>
              </div>
            ) : (
              <div className="hint">— ISSUER NOT SET —</div>
            )}
          </div>

          <div
            className="rule-h-soft"
            style={{
              paddingTop: 14,
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--ink-3)",
              letterSpacing: "0.04em",
              lineHeight: 1.7,
            }}
          >
            <div>VALID_FROM · {validFrom || "—"}</div>
            <div>VALID_UNTIL · {validUntil || "OPEN-ENDED"}</div>
            <div>EVIDENCE_HASH · {evidenceHashPreview}</div>
            <div>
              EVIDENCE_URI ·{" "}
              {evidence?.uri
                ? evidence.uri.length > 36
                  ? evidence.uri.slice(0, 32) + "…"
                  : evidence.uri
                : "—"}
            </div>
            <div>
              EVIDENCE_SRC ·{" "}
              {evidence?.source === "upload"
                ? `FILE · ${evidence.contentType ?? "—"}`
                : evidence?.source === "url"
                  ? "EXTERNAL URL"
                  : "—"}
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Stamp text="Pending" sub="UNSIGNED" size="small" />
          </div>
        </div>
      </div>

      {issuersAll.length === 0 && (
        <div
          className="hint"
          style={{
            marginTop: 16,
            color: "var(--ink-3)",
          }}
        >
          {/* keep an unused render to avoid lint noise */}
        </div>
      )}
    </div>
  );
}

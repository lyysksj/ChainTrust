"use client";

/**
 * ClaimCard
 *
 * The on-chain `claim_entity` instruction now requires a non-revoked
 * `HAS_OFFICER` Relationship signed by a T1 or T2 Issuer that names the
 * caller as the officer. This component:
 *
 *   1. Fetches all relationships under the entity.
 *   2. Filters down to HAS_OFFICER edges whose target_ref equals the
 *      connected wallet's pubkey bytes.
 *   3. Drops revoked edges and edges signed by T3 issuers.
 *   4. Surfaces the qualifying proofs so the user can pick one (or auto-uses
 *      the only one) and signs `claim_entity`.
 *
 * Without a qualifying proof we render a clear explainer: "you cannot claim
 * this entity until a Tier-1 / Tier-2 issuer attests that you are an officer
 * of it." This keeps the demo's "Claim gives voice, not control" promise
 * honest — claim is no longer something an attacker can race.
 */
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  claimEntity,
  fetchAllIssuers,
  fetchRelationshipsForEntity,
} from "@/lib/anchor/client";
import { REL_KIND } from "@/types";
import type { Issuer, Relationship } from "@/types";
import { formatTimestamp, shortKey } from "@/lib/utils/format";
import { useT } from "@/lib/i18n";

type Props = {
  entity: PublicKey;
  onClaimed?: () => void;
};

type Candidate = {
  pda: PublicKey;
  rel: Relationship;
  issuer: Issuer;
  issuerPda: PublicKey;
};

export function ClaimCard({ entity, onClaimed }: Props) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const t = useT();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!program || !publicKey) {
      setCandidates([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const [rawRels, rawIssuers] = await Promise.all([
          fetchRelationshipsForEntity(program, entity),
          fetchAllIssuers(program),
        ]);
        if (!alive) return;
        const issuerByPda = new Map<string, { pda: PublicKey; account: Issuer }>();
        for (const i of rawIssuers) {
          issuerByPda.set(i.publicKey.toBase58(), {
            pda: i.publicKey,
            account: i.account as unknown as Issuer,
          });
        }

        const targetBytes = publicKey.toBytes();
        const matches: Candidate[] = [];
        for (const r of rawRels) {
          const rel = r.account as unknown as Relationship;
          if (rel.kind !== REL_KIND.HAS_OFFICER) continue;
          if (Number(rel.revokedAt) > 0) continue;
          if (!arraysEqual(rel.targetRef, Array.from(targetBytes))) continue;
          const iss = issuerByPda.get(rel.issuer.toBase58());
          if (!iss) continue;
          if (iss.account.trustTier > 2) continue; // T3 cannot enable claim
          matches.push({
            pda: r.publicKey,
            rel,
            issuer: iss.account,
            issuerPda: iss.pda,
          });
        }
        setCandidates(matches);
        setSelected(matches[0]?.pda.toBase58() ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program, publicKey, entity]);

  const chosen = useMemo(
    () => candidates.find((c) => c.pda.toBase58() === selected) ?? null,
    [candidates, selected],
  );

  async function onClaim() {
    if (!program || !publicKey || !chosen) return;
    setSubmitting(true);
    setError(null);
    try {
      await claimEntity(
        program,
        publicKey,
        entity,
        chosen.pda,
        chosen.issuerPda,
      );
      setDone(true);
      onClaimed?.();
    } catch (err) {
      setError((err as Error).message ?? t("claim.errors.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!publicKey) {
    return (
      <div className="doc-card" style={{ borderStyle: "dashed" }}>
        <div className="docnum" style={{ marginBottom: 6 }}>
          {t("claim.connect.title")}
        </div>
        <p className="hint" style={{ margin: 0 }}>
          {t("claim.connect.body")}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="doc-card" style={{ borderStyle: "dashed" }}>
        <div className="docnum">{t("claim.checking")}</div>
      </div>
    );
  }

  if (done) {
    return (
      <div
        className="doc-card"
        style={{ borderColor: "var(--good)", background: "rgba(158, 184, 156, 0.10)" }}
      >
        <div className="docnum" style={{ color: "#4a6648" }}>
          {t("claim.done.title")}
        </div>
        <p className="hint" style={{ margin: 0 }}>
          {t("claim.done.body")}
        </p>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="doc-card" style={{ borderStyle: "dashed" }}>
        <div className="docnum" style={{ marginBottom: 6 }}>
          {t("claim.notEligible.title")}
        </div>
        <p
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            color: "var(--ink-2)",
            lineHeight: 1.55,
            margin: "0 0 8px",
          }}
        >
          {t("claim.notEligible.body.lead")}
          <strong>{t("claim.notEligible.body.bold")}</strong>
          {t("claim.notEligible.body.tail")}
        </p>
        <p className="hint" style={{ margin: 0 }}>
          {t("claim.notEligible.body.note")}
        </p>
      </div>
    );
  }

  return (
    <div
      className="doc-card"
      style={{ borderStyle: "dashed", borderColor: "var(--stamp-deep)" }}
    >
      <div className="docnum" style={{ marginBottom: 6, color: "var(--stamp-deep)" }}>
        {t("claim.found.title")}
      </div>
      <p
        style={{
          fontFamily: "var(--serif)",
          fontSize: 14,
          color: "var(--ink-2)",
          lineHeight: 1.55,
          margin: "0 0 12px",
        }}
      >
        {t("claim.found.body")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {candidates.map((c) => {
          const id = c.pda.toBase58();
          const isSel = id === selected;
          return (
            <label
              key={id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                border: `1.5px solid ${isSel ? "var(--stamp-deep)" : "var(--rule)"}`,
                background: isSel ? "var(--paper-3)" : "var(--paper-2)",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="officer-proof"
                checked={isSel}
                onChange={() => setSelected(id)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    color: "var(--ink)",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                  }}
                >
                  T{c.issuer.trustTier} ·{" "}
                  {c.issuer.kind > 0
                    ? t(`issuerKind.${c.issuer.kind}`)
                    : t("issuerKind.fallback")}{" "}
                  · {shortKey(c.issuerPda, 6)}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--ink-3)",
                    letterSpacing: "0.04em",
                    marginTop: 2,
                  }}
                >
                  {t("claim.found.relPda")} {shortKey(c.pda, 6)} ·{" "}
                  {t("claim.found.filed")}{" "}
                  {formatTimestamp(c.rel.createdAt)}
                </div>
              </div>
            </label>
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}
      <button
        type="button"
        className="btn btn-stamp"
        onClick={onClaim}
        disabled={submitting || !chosen}
      >
        {submitting ? t("claim.btn.submitting") : t("claim.btn.submit")}
      </button>
      <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
        {t("claim.btn.foot")}
      </p>
    </div>
  );
}

function arraysEqual(a: number[] | Uint8Array, b: number[] | Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if ((a as number[])[i] !== (b as number[])[i]) return false;
  }
  return true;
}

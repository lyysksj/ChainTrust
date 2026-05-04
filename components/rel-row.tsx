"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import type { Issuer, Relationship } from "@/types";
import { REL_KIND_META } from "@/types";
import { useProgram } from "@/lib/anchor/hooks";
import { revokeRelationship } from "@/lib/anchor/client";
import { formatTimestamp, shortHash, shortKey } from "@/lib/utils/format";
import { IssuerBadge } from "@/components/registry-bits";
import { useT } from "@/lib/i18n";

/**
 * Evidence URI router. `mock://` and `ipfs://` URIs go through our local
 * fetch proxy because the dev/preview gateway needs server-side resolution.
 * Anything `http(s)://` opens in a new tab directly so the user gets the
 * real link they pasted in the attest form.
 */
function evidenceHref(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return uri;
  }
  return `/api/mock/fetch?uri=${encodeURIComponent(uri)}`;
}

function targetSubLine(rel: Relationship): string {
  const meta = REL_KIND_META[rel.kind];
  const tt = meta?.targetType ?? "wallet";
  if (tt === "domain" || tt === "person") {
    return `${tt.toUpperCase()} · ${shortHash(rel.targetRef, 6)}`;
  }
  try {
    const pk = new PublicKey(Buffer.from(rel.targetRef));
    return `${tt.toUpperCase()} · ${pk.toBase58().slice(0, 10)}…${pk.toBase58().slice(-4)}`;
  } catch {
    return `${tt.toUpperCase()} · ${shortHash(rel.targetRef, 6)}`;
  }
}

function useTargetLabel() {
  const t = useT();
  return (rel: Relationship, issuerName?: string | null): string => {
    const meta = REL_KIND_META[rel.kind];
    const tt = meta?.targetType ?? "wallet";
    if (tt === "domain") return t("rel.target.domain");
    if (tt === "person") return t("rel.target.person");
    if (tt === "project") return t("rel.target.project");
    if (tt === "issuer")
      return `${t("rel.target.auditor")} ${issuerName ?? t("rel.target.auditorUnknown")}`;
    if (tt === "entity") {
      if (rel.kind === 5) return t("rel.target.parent");
      if (rel.kind === 6) return t("rel.target.subsidiary");
      return t("rel.target.entityRef");
    }
    return rel.kind === 2 ? t("rel.target.deployer") : t("rel.target.controlled");
  };
}

export function RelRowCompact({
  pda,
  rel,
  issuer,
  onRevoked,
}: {
  pda: PublicKey;
  rel: Relationship;
  issuer: Issuer | null;
  onRevoked?: () => void;
}) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const t = useT();
  const targetLabel = useTargetLabel();
  const meta = REL_KIND_META[rel.kind];
  const revoked = Number(rel.revokedAt) > 0;
  const tier = issuer?.trustTier ?? 3;
  const issuerName = issuer
    ? issuer.kind > 0
      ? t(`issuerKind.${issuer.kind}`)
      : t("issuerKind.fallback")
    : null;
  const authorityShort = issuer
    ? shortKey(issuer.authority, 4)
    : shortKey(rel.attestorAuthority, 4);

  const canRevoke =
    !revoked &&
    !!publicKey &&
    !!program &&
    publicKey.toBase58() === rel.attestorAuthority.toBase58();

  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function onRevoke() {
    if (!program || !publicKey) return;
    if (!window.confirm(t("rel.confirmRevoke"))) {
      return;
    }
    setRevoking(true);
    setRevokeError(null);
    try {
      await revokeRelationship(program, publicKey, pda);
      onRevoked?.();
    } catch (err) {
      setRevokeError((err as Error).message ?? t("rel.errorRevoke"));
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className={`rel-row ${revoked ? "revoked" : ""}`}>
      <div className="rel-kind">
        {(meta?.label ?? t("rel.target.relationshipFallback"))
          .toUpperCase()
          .replace(/\s/g, "_")}
      </div>
      <div>
        <div className="rel-target">{targetLabel(rel, issuerName)}</div>
        <div className="rel-target-sub">{targetSubLine(rel)}</div>
      </div>
      <IssuerBadge
        name={issuerName}
        tier={tier}
        kind={issuer ? `T${tier}` : "UNKNOWN"}
        authorityShort={authorityShort}
      />
      <div className="rel-validity">
        <span>{t("rel.validFrom")}</span>
        <span className="v-date">{formatTimestamp(rel.validFrom)}</span>
        {revoked ? (
          <>
            <span className="v-revoked">{t("rel.revoked")}</span>
            <span className="v-date v-revoked">
              {formatTimestamp(rel.revokedAt)}
            </span>
          </>
        ) : (
          <>
            <span>{t("rel.until")}</span>
            <span className="v-date">
              {Number(rel.validUntil) > 0
                ? formatTimestamp(rel.validUntil)
                : t("rel.untilOpen")}
            </span>
          </>
        )}
      </div>
      <div className="rel-evidence">
        <span>
          <strong>{t("rel.evidence")}</strong>0x{shortHash(rel.evidenceHash, 8)}
        </span>
        {rel.evidenceUri && (
          <span>
            <strong>{t("rel.uri")}</strong>
            <a
              href={evidenceHref(rel.evidenceUri)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--stamp-deep)" }}
            >
              {rel.evidenceUri.length > 28
                ? rel.evidenceUri.slice(0, 26) + "…"
                : rel.evidenceUri}
            </a>
          </span>
        )}
        <span>
          <strong>{t("rel.signer")}</strong>
          {shortKey(rel.attestorAuthority, 6)}
        </span>
        <span>
          <strong>{t("rel.pda")}</strong>
          {shortKey(pda, 6)}
        </span>
        {canRevoke && (
          <span style={{ marginLeft: "auto" }}>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onRevoke}
              disabled={revoking}
              style={{
                borderColor: "var(--revoked)",
                color: "var(--revoked)",
              }}
            >
              {revoking ? t("rel.btn.revoking") : t("rel.btn.revoke")}
            </button>
          </span>
        )}
        {revokeError && (
          <span
            style={{
              color: "var(--revoked)",
              fontFamily: "var(--mono)",
              fontSize: 10,
            }}
          >
            {t("common.errorPrefix")} · {revokeError.toUpperCase().slice(0, 60)}
          </span>
        )}
      </div>
    </div>
  );
}

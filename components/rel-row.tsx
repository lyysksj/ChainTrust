"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import type { Issuer, Relationship } from "@/types";
import {
  ISSUER_KIND_LABELS,
  REL_KIND_META,
} from "@/types";
import { useProgram } from "@/lib/anchor/hooks";
import { revokeRelationship } from "@/lib/anchor/client";
import { formatTimestamp, shortHash, shortKey } from "@/lib/utils/format";
import { IssuerBadge } from "@/components/registry-bits";

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
    return `${tt.toUpperCase()} HASH · ${shortHash(rel.targetRef, 6)}`;
  }
  try {
    const pk = new PublicKey(Buffer.from(rel.targetRef));
    return `${tt.toUpperCase()} · ${pk.toBase58().slice(0, 10)}…${pk.toBase58().slice(-4)}`;
  } catch {
    return `${tt.toUpperCase()} · ${shortHash(rel.targetRef, 6)}`;
  }
}

function targetLabel(rel: Relationship, issuerName?: string | null): string {
  const meta = REL_KIND_META[rel.kind];
  const tt = meta?.targetType ?? "wallet";
  if (tt === "domain") return "Domain attestation";
  if (tt === "person") return "Person hash";
  if (tt === "project") return "Project PDA";
  if (tt === "issuer") return `Auditor · ${issuerName ?? "Unknown"}`;
  if (tt === "entity") {
    if (rel.kind === 5) return "Parent entity";
    if (rel.kind === 6) return "Subsidiary entity";
    return "Entity reference";
  }
  return rel.kind === 2 ? "Deployer wallet" : "Controlled wallet";
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
  const meta = REL_KIND_META[rel.kind];
  const revoked = Number(rel.revokedAt) > 0;
  const tier = issuer?.trustTier ?? 3;
  const issuerName = issuer
    ? ISSUER_KIND_LABELS[issuer.kind] ?? "Issuer"
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
    if (
      !window.confirm(
        "Revoke this attestation? The PDA stays on-chain — only `revoked_at` is set. This is itself a public, signed event.",
      )
    ) {
      return;
    }
    setRevoking(true);
    setRevokeError(null);
    try {
      await revokeRelationship(program, publicKey, pda);
      onRevoked?.();
    } catch (err) {
      setRevokeError((err as Error).message ?? "Revoke failed");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className={`rel-row ${revoked ? "revoked" : ""}`}>
      <div className="rel-kind">
        {(meta?.label ?? "RELATIONSHIP").toUpperCase().replace(/\s/g, "_")}
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
        <span>Valid from</span>
        <span className="v-date">{formatTimestamp(rel.validFrom)}</span>
        {revoked ? (
          <>
            <span className="v-revoked">Revoked</span>
            <span className="v-date v-revoked">
              {formatTimestamp(rel.revokedAt)}
            </span>
          </>
        ) : (
          <>
            <span>Until</span>
            <span className="v-date">
              {Number(rel.validUntil) > 0
                ? formatTimestamp(rel.validUntil)
                : "Open"}
            </span>
          </>
        )}
      </div>
      <div className="rel-evidence">
        <span>
          <strong>EVIDENCE</strong>0x{shortHash(rel.evidenceHash, 8)}
        </span>
        {rel.evidenceUri && (
          <span>
            <strong>URI</strong>
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
          <strong>SIGNER</strong>
          {shortKey(rel.attestorAuthority, 6)}
        </span>
        <span>
          <strong>PDA</strong>
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
              {revoking ? "Revoking…" : "◆ Revoke"}
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
            ERROR · {revokeError.toUpperCase().slice(0, 60)}
          </span>
        )}
      </div>
    </div>
  );
}

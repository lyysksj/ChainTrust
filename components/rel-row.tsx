"use client";

import { PublicKey } from "@solana/web3.js";
import type { Issuer, Relationship } from "@/types";
import {
  ISSUER_KIND_LABELS,
  REL_KIND_META,
} from "@/types";
import { formatTimestamp, shortHash, shortKey } from "@/lib/utils/format";
import { IssuerBadge } from "@/components/registry-bits";

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
  // wallet
  return rel.kind === 2 ? "Deployer wallet" : "Controlled wallet";
}

export function RelRowCompact({
  pda,
  rel,
  issuer,
}: {
  pda: PublicKey;
  rel: Relationship;
  issuer: Issuer | null;
}) {
  const meta = REL_KIND_META[rel.kind];
  const revoked = Number(rel.revokedAt) > 0;
  const tier = issuer?.trustTier ?? 3;
  const issuerName = issuer
    ? ISSUER_KIND_LABELS[issuer.kind] ?? "Issuer"
    : null;
  const authorityShort = issuer
    ? shortKey(issuer.authority, 4)
    : shortKey(rel.attestorAuthority, 4);

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
              href={`/api/mock/fetch?uri=${encodeURIComponent(rel.evidenceUri)}`}
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
      </div>
    </div>
  );
}

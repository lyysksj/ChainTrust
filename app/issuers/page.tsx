"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllIssuers,
  fetchAllRelationships,
} from "@/lib/anchor/client";
import { formatTimestamp, shortKey } from "@/lib/utils/format";
import { TierPill } from "@/components/registry-bits";
import { ISSUER_KIND_LABELS } from "@/types";
import type { Issuer, Relationship } from "@/types";

type Row = {
  pda: PublicKey;
  account: Issuer;
  total: number;
  active: number;
  revoked: number;
};

export default function IssuersListPage() {
  const program = useProgram();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!program) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const [rawIssuers, rawRels] = await Promise.all([
        fetchAllIssuers(program),
        fetchAllRelationships(program),
      ]);
      if (!alive) return;
      const counts = new Map<
        string,
        { total: number; active: number; revoked: number }
      >();
      for (const r of rawRels) {
        const acc = r.account as unknown as Relationship;
        const key = acc.issuer.toBase58();
        const cur = counts.get(key) ?? { total: 0, active: 0, revoked: 0 };
        cur.total += 1;
        if (Number(acc.revokedAt) > 0) cur.revoked += 1;
        else cur.active += 1;
        counts.set(key, cur);
      }
      const next = rawIssuers.map((i) => {
        const c = counts.get(i.publicKey.toBase58()) ?? {
          total: 0,
          active: 0,
          revoked: 0,
        };
        return {
          pda: i.publicKey,
          account: i.account as unknown as Issuer,
          ...c,
        };
      });
      next.sort((a, b) => a.account.trustTier - b.account.trustTier);
      setRows(next);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [program]);

  return (
    <div data-screen="05 Issuers">
      <div className="docnum" style={{ marginBottom: 8 }}>
        REGISTER OF ATTESTORS · 2026
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          Registered issuers.
        </h2>
        <span className="section-meta">
          {rows.length} {rows.length === 1 ? "ENTRY" : "ENTRIES"} · 3 TRUST
          TIERS
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
        Every signed edge in the registry traces back to one of these authority
        keys. Tiers are <strong>public</strong>: the platform does not bless an
        issuer&apos;s tier as truth — it only publishes who claimed which tier
        and when. Consumers decide what to trust.
      </p>

      <div
        style={{ marginBottom: 32, display: "flex", gap: 12, flexWrap: "wrap" }}
      >
        <Link href="/issuer/register" className="btn btn-stamp">
          + Register as issuer
        </Link>
        <Link href="/attest" className="btn btn-ghost">
          File an attestation →
        </Link>
      </div>

      {loading ? (
        <div className="no-result">LOADING ISSUERS…</div>
      ) : rows.length === 0 ? (
        <div className="no-result">
          NO ISSUERS REGISTERED YET — BE THE FIRST TO STAKE A TIER.
        </div>
      ) : (
        <>
          <div
            className="entity-row head"
            style={{
              gridTemplateColumns: "60px 1fr 200px 120px 90px 90px",
            }}
          >
            <span className="label">Tier</span>
            <span className="label">Issuer</span>
            <span className="label">Authority key</span>
            <span className="label">Registered</span>
            <span className="label">Active</span>
            <span className="label">Revoked</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.pda.toBase58()}
              className="entity-row"
              style={{
                gridTemplateColumns: "60px 1fr 200px 120px 90px 90px",
                cursor: "default",
              }}
            >
              <TierPill tier={r.account.trustTier} />
              <div>
                <div className="ent-name">
                  {ISSUER_KIND_LABELS[r.account.kind] ?? "Issuer"}
                </div>
                <div className="ent-sub">
                  PDA · {shortKey(r.pda, 6)}
                </div>
              </div>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-2)",
                }}
              >
                {shortKey(r.account.authority, 8)}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                }}
              >
                {formatTimestamp(r.account.registeredAt)}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {r.active}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  color: r.revoked ? "var(--revoked)" : "var(--ink-3)",
                  fontWeight: 600,
                }}
              >
                {r.revoked}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Tier definitions */}
      <div style={{ marginTop: 48 }}>
        <div className="section-h">
          <h2 className="section-title">Tier definitions</h2>
          <span className="section-meta">§ 4 · CORE CONCEPTS</span>
        </div>
        <div className="principles">
          <div className="principle">
            <div className="principle-num">
              <TierPill tier={1} />
              &nbsp;PLATFORM
            </div>
            <h3 className="principle-title">Bootstrapped at deploy.</h3>
            <p className="principle-body">
              ChainTrust&apos;s own platform issuer. Used for foundational
              identity-class attestations until regulated third parties take
              over.
            </p>
          </div>
          <div className="principle">
            <div className="principle-num">
              <TierPill tier={2} />
              &nbsp;THIRD-PARTY
            </div>
            <h3 className="principle-title">Known professional.</h3>
            <p className="principle-body">
              KYB providers, audit firms, chain-analytics vendors, and
              regulators. Tier is self-claimed at registration and visible to
              all consumers.
            </p>
          </div>
          <div className="principle">
            <div className="principle-num">
              <TierPill tier={3} />
              &nbsp;SELF / COMMUNITY
            </div>
            <h3 className="principle-title">Open self-registration.</h3>
            <p className="principle-body">
              Any verified user. Self-asserted facts are recorded but not
              blessed. Useful for entities to publish their own graph before a
              higher tier arrives.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

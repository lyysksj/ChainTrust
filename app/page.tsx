"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllEntities,
  fetchAllIssuers,
  fetchAllRelationships,
} from "@/lib/anchor/client";
import { entityIdToCtNumber } from "@/lib/utils/ct-number";
import { bytesHex, formatTimestamp } from "@/lib/utils/format";
import { Stamp, StatusPill } from "@/components/registry-bits";
import { COUNTRIES } from "@/types";
import type { Entity, EntityMetadata, Issuer, Relationship } from "@/types";

type EntityRow = {
  pda: PublicKey;
  account: Entity;
  meta: EntityMetadata | null;
  ctNumber: string;
  entityIdHex: string;
};

export default function HomePage() {
  const program = useProgram();
  const router = useRouter();

  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [counts, setCounts] = useState({
    entities: 0,
    rels: 0,
    issuers: 0,
    revoked: 0,
  });
  const [resolveQuery, setResolveQuery] = useState("");

  useEffect(() => {
    if (!program) return;
    let alive = true;
    (async () => {
      const [rawEntities, rawRels, rawIssuers] = await Promise.all([
        fetchAllEntities(program),
        fetchAllRelationships(program),
        fetchAllIssuers(program),
      ]);
      if (!alive) return;

      const rels = rawRels.map((r) => r.account as unknown as Relationship);
      const issuers = rawIssuers.map((i) => i.account as unknown as Issuer);
      void issuers;
      setCounts({
        entities: rawEntities.length,
        rels: rawRels.length,
        issuers: rawIssuers.length,
        revoked: rels.filter((r) => Number(r.revokedAt) > 0).length,
      });

      const rows = await Promise.all(
        rawEntities.map(async (e) => {
          const account = e.account as unknown as Entity;
          let meta: EntityMetadata | null = null;
          if (account.metadataUri) {
            try {
              const resp = await fetch(
                `/api/mock/fetch?uri=${encodeURIComponent(account.metadataUri)}`,
              );
              if (resp.ok) meta = JSON.parse(await resp.text());
            } catch {
              /* ignore */
            }
          }
          return {
            pda: e.publicKey,
            account,
            meta,
            ctNumber: entityIdToCtNumber(account.entityId),
            entityIdHex: bytesHex(account.entityId),
          } satisfies EntityRow;
        }),
      );
      if (!alive) return;
      rows.sort(
        (a, b) =>
          Number(b.account.claimedAt || b.account.createdAt) -
          Number(a.account.claimedAt || a.account.createdAt),
      );
      setEntities(rows);
    })();
    return () => {
      alive = false;
    };
  }, [program]);

  function submitResolve(e?: React.FormEvent) {
    e?.preventDefault();
    if (!resolveQuery.trim()) {
      router.push("/resolve");
      return;
    }
    router.push(`/resolve?q=${encodeURIComponent(resolveQuery.trim())}`);
  }

  const samples = [
    { label: "First entity", value: entities[0]?.ctNumber ?? "" },
    { label: "Domain", value: "example.com" },
    { label: "CT-Number", value: "CT-XXXX-XXXX" },
  ].filter((s) => s.value);

  const recent = useMemo(() => entities.slice(0, 12), [entities]);

  return (
    <div data-screen="01 Registry Home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">
          PUBLIC IDENTITY REGISTRY · SOLANA · NO. 0000-0001
        </div>
        <div className="hero-row">
          <div>
            <h1 className="hero-title">
              The on-chain<br />
              <em>Dun &amp; Bradstreet</em><br />
              for Web3.
            </h1>
            <p className="hero-sub">
              A signed, time-stamped registry that links real-world legal
              entities to the wallets, contracts, projects and domains they
              operate on Solana. Not reviews. Not consensus.{" "}
              <strong>
                Cited evidence, by named issuers, with no delete key.
              </strong>
            </p>
            <div className="hero-cta">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => router.push("/resolve")}
              >
                Resolve a wallet →
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => router.push("/create")}
              >
                + File an Entity
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => router.push("/attest")}
              >
                File an attestation
              </button>
            </div>
          </div>
          <div className="hero-stamp-wrap">
            <Stamp text="Append-only" sub="NO DELETE KEY" />
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                textAlign: "right",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Filed {new Date().toISOString().slice(0, 10)}
              <br />Solana · v0.4
            </div>
          </div>
        </div>
      </section>

      {/* Resolve quick-bar */}
      <form onSubmit={submitResolve} style={{ marginBottom: 32 }}>
        <div className="resolve-bar">
          <span className="resolve-bar-icon">›_</span>
          <input
            placeholder="Paste a wallet pubkey, contract PDA, domain, or CT-Number…"
            value={resolveQuery}
            onChange={(e) => setResolveQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-stamp">
            Resolve
          </button>
        </div>
        {samples.length > 0 && (
          <div className="resolve-suggest">
            <span>TRY:</span>
            {samples.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  setResolveQuery(s.value);
                  router.push(`/resolve?q=${encodeURIComponent(s.value)}`);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Stats strip */}
      <div className="stat-strip">
        <div className="stat-cell">
          <div className="stat-v">{counts.entities}</div>
          <div className="stat-l">Entities recorded</div>
        </div>
        <div className="stat-cell">
          <div className="stat-v">{counts.rels}</div>
          <div className="stat-l">Signed relationships</div>
        </div>
        <div className="stat-cell">
          <div className="stat-v">{counts.issuers}</div>
          <div className="stat-l">Registered issuers</div>
        </div>
        <div className="stat-cell">
          <div className="stat-v">{counts.revoked}</div>
          <div className="stat-l">Revoked (still on record)</div>
        </div>
      </div>

      {/* Filer onboarding strip */}
      <div className="section-h">
        <h2 className="section-title">New here? File in three steps.</h2>
        <span className="section-meta">§ ONBOARDING · ART. 5</span>
      </div>
      <div className="principles" style={{ marginBottom: 48 }}>
        <Link
          href="/register"
          className="principle"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="principle-num">STEP 01 / USER</div>
          <h3 className="principle-title">Register profile →</h3>
          <p className="principle-body">
            Connect a Solana wallet and claim a username (with optional
            World&nbsp;ID anti-sybil). Required for everything below.
          </p>
        </Link>
        <Link
          href="/create"
          className="principle"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="principle-num">STEP 02 / ENTITY</div>
          <h3 className="principle-title">File a new Entity →</h3>
          <p className="principle-body">
            Open a public legal-entity record. Get a stable CT-Number short
            code that anyone can cite or resolve.
          </p>
        </Link>
        <Link
          href="/issuer/register"
          className="principle"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="principle-num">STEP 03 / ISSUER</div>
          <h3 className="principle-title">Become an Issuer →</h3>
          <p className="principle-body">
            Register an authority key with a public trust tier so you can
            sign Relationship attestations on Entities.
          </p>
        </Link>
      </div>

      {/* Principles */}
      <div className="section-h">
        <h2 className="section-title">The graph belongs to the facts.</h2>
        <span className="section-meta">§ MANIFESTO · I.</span>
      </div>
      <div className="principles" style={{ marginBottom: 48 }}>
        <div className="principle">
          <div className="principle-num">01 / SUBJECT</div>
          <h3 className="principle-title">Entity is the anchor.</h3>
          <p className="principle-body">
            Every wallet, contract, domain, and officer hangs off a legal
            Entity with a stable CT-Number. The Entity is public, citable, and
            immutable.
          </p>
        </div>
        <div className="principle">
          <div className="principle-num">02 / SIGNATURE</div>
          <h3 className="principle-title">Every edge is signed.</h3>
          <p className="principle-body">
            Relationships are signed by named issuers with public trust tiers
            — platform, third-party, or self-asserted. Consumers decide which
            tiers to trust.
          </p>
        </div>
        <div className="principle">
          <div className="principle-num">03 / RECORD</div>
          <h3 className="principle-title">Nothing is erased.</h3>
          <p className="principle-body">
            Revocation is itself a signed event. Records are struck through,
            never removed. Claim gives voice — never control.
          </p>
        </div>
      </div>

      {/* Recently verified registry */}
      <div className="section-h">
        <h2 className="section-title">Recently filed entities</h2>
        <span className="section-meta">
          ON-CHAIN · {recent.length} {recent.length === 1 ? "ENTRY" : "ENTRIES"}
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="no-result">
          {program
            ? "NO ENTITIES ON-CHAIN YET — BE THE FIRST TO FILE."
            : "CONNECT A WALLET TO LOAD THE PUBLIC REGISTRY."}
        </div>
      ) : (
        <>
          <div className="entity-row head">
            <span className="label">CT-Number</span>
            <span className="label">Legal entity</span>
            <span className="label">Jurisdiction</span>
            <span className="label">Status</span>
            <span className="label">Filed</span>
            <span></span>
          </div>
          {recent.map((row) => {
            const country = COUNTRIES.find(
              (c) => c.code === row.account.jurisdiction,
            );
            return (
              <div
                className="entity-row"
                key={row.pda.toBase58()}
                onClick={() => router.push(`/entry/${row.entityIdHex}`)}
              >
                <span className="ct-num">{row.ctNumber}</span>
                <div>
                  <div className="ent-name">
                    {row.meta?.legalName ?? "(metadata pending)"}
                  </div>
                  <div className="ent-sub">
                    {row.meta?.registryId ?? "—"} · INC{" "}
                    {formatTimestamp(row.account.createdAt)}
                  </div>
                </div>
                <span className="ent-juris">
                  {country?.label ?? row.account.jurisdiction}
                </span>
                <StatusPill
                  status={row.account.status}
                  claimed={row.account.isClaimed}
                />
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--ink-3)",
                  }}
                >
                  {formatTimestamp(
                    Number(row.account.claimedAt) > 0
                      ? row.account.claimedAt
                      : row.account.createdAt,
                  )}
                </span>
                <span className="arrow">→</span>
              </div>
            );
          })}
        </>
      )}

      {/* Manifesto strip */}
      <section className="manifesto">
        <div className="manifesto-row">
          <div className="label">REPEAT DURING DEMO</div>
          <div>
            <p className="manifesto-quote">
              &ldquo;Claim gives voice, not control.&rdquo;
            </p>
            <div className="manifesto-attr">— § PHILOSOPHY · ARTICLE II.</div>
            <p className="manifesto-quote">
              &ldquo;Every edge is signed. Every signature has a tier.
              <br />
              Every fact has an expiry.&rdquo;
            </p>
            <div className="manifesto-attr">— § PHILOSOPHY · ARTICLE III.</div>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <div className="cta-strip">
        <h3>
          Resolve any wallet, contract, or domain
          <br />
          to the <em>operating entity</em> behind it.
        </h3>
        <Link href="/resolve" className="btn">
          Open Resolve →
        </Link>
      </div>
    </div>
  );
}

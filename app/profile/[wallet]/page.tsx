"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchCommentsByCommenter,
  fetchEntitiesByOfficialWallet,
  fetchEntitiesCreatedBy,
  fetchUserProfile,
} from "@/lib/anchor/client";
import {
  bytesHex,
  formatTimestamp,
  shortHash,
  shortKey,
} from "@/lib/utils/format";
import type {
  CommentRecord,
  Entity,
  EntityMetadata,
  UserMetadata,
  UserProfile,
} from "@/types";

type Params = { wallet: string };

export default function ProfilePage({ params }: { params: Params }) {
  const program = useProgram();

  const wallet = useMemo(() => {
    try {
      return new PublicKey(params.wallet);
    } catch {
      return null;
    }
  }, [params.wallet]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [meta, setMeta] = useState<UserMetadata | null>(null);
  const [entities, setEntities] = useState<
    { publicKey: PublicKey; account: Entity }[]
  >([]);
  const [verifiedEntities, setVerifiedEntities] = useState<
    { publicKey: PublicKey; account: Entity }[]
  >([]);
  const [comments, setComments] = useState<
    { publicKey: PublicKey; account: CommentRecord }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!program || !wallet) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const p = await fetchUserProfile(program, wallet);
        if (!alive) return;
        setProfile(p);
        const [e, ve, c] = await Promise.all([
          fetchEntitiesCreatedBy(program, wallet),
          fetchEntitiesByOfficialWallet(program, wallet),
          fetchCommentsByCommenter(program, wallet),
        ]);
        if (!alive) return;
        setEntities(
          e.map((x) => ({
            publicKey: x.publicKey,
            account: x.account as unknown as Entity,
          })),
        );
        setVerifiedEntities(
          ve.map((x) => ({
            publicKey: x.publicKey,
            account: x.account as unknown as Entity,
          })),
        );
        setComments(
          c.map((x) => ({
            publicKey: x.publicKey,
            account: x.account as unknown as CommentRecord,
          })),
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [program, wallet]);

  useEffect(() => {
    let alive = true;
    if (!profile?.metadataUri) {
      setMeta(null);
      return;
    }
    fetch(`/api/mock/fetch?uri=${encodeURIComponent(profile.metadataUri)}`)
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => {
        if (!alive || !t) return;
        try {
          setMeta(JSON.parse(t) as UserMetadata);
        } catch {
          /* ignore */
        }
      });
    return () => {
      alive = false;
    };
  }, [profile?.metadataUri]);

  // Fetch metadata for verified-rep entities so the badge can show the project
  // name.
  const [verifiedEntryNames, setVerifiedEntryNames] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    if (verifiedEntities.length === 0) {
      setVerifiedEntryNames({});
      return;
    }
    let alive = true;
    (async () => {
      const result: Record<string, string> = {};
      await Promise.all(
        verifiedEntities.map(async (e) => {
          if (!e.account.metadataUri) return;
          try {
            const resp = await fetch(
              `/api/mock/fetch?uri=${encodeURIComponent(e.account.metadataUri)}`,
            );
            if (!resp.ok) return;
            const text = await resp.text();
            const parsed = JSON.parse(text) as EntityMetadata;
            result[e.publicKey.toBase58()] =
              parsed.legalName ?? "(unnamed)";
          } catch {
            /* ignore */
          }
        }),
      );
      if (alive) setVerifiedEntryNames(result);
    })();
    return () => {
      alive = false;
    };
  }, [verifiedEntities]);

  if (!wallet) return <p className="hint">Invalid wallet address.</p>;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-500">
          User profile
        </p>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="serif text-4xl font-semibold text-ink-800">
            {profile?.username ? `@${profile.username}` : shortKey(wallet)}
          </h1>
          {verifiedEntities.length > 0 && (
            <span className="chip chip-official text-[11px]">
              ✓ Official representative
            </span>
          )}
        </div>
        {meta?.headline && (
          <p className="serif text-lg text-ink-700">{meta.headline}</p>
        )}
        {verifiedEntities.length > 0 && (
          <p className="text-sm text-claimed">
            Verified representative for{" "}
            {verifiedEntities.map((e, i) => {
              const name =
                verifiedEntryNames[e.publicKey.toBase58()] ?? "(loading)";
              return (
                <span key={e.publicKey.toBase58()}>
                  <Link
                    href={`/entry/${bytesHex(e.account.entityId)}`}
                    className="font-semibold underline"
                  >
                    {name}
                  </Link>
                  {i < verifiedEntities.length - 1 ? ", " : ""}
                </span>
              );
            })}
          </p>
        )}
        <p className="text-sm text-ink-600">
          {profile ? (
            <>Verified {formatTimestamp(profile.registeredAt)}</>
          ) : (
            <>
              This wallet has not registered a ChainTrust profile yet.{" "}
              <Link href="/register" className="underline">
                Register
              </Link>
              .
            </>
          )}
        </p>
        <p className="mono text-xs text-ink-500">{wallet.toBase58()}</p>
      </header>

      {loading && <p className="hint">Loading on-chain records…</p>}

      {profile && meta?.expertise && meta.expertise.length > 0 && (
        <Section title="Expertise">
          <div className="flex flex-wrap gap-2">
            {meta.expertise.map((tag) => (
              <span
                key={tag}
                className="border border-ink-300 bg-white px-2.5 py-1 text-xs text-ink-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </Section>
      )}

      {profile &&
        meta?.workExperience &&
        meta.workExperience.length > 0 && (
          <Section title="Work experience">
            <ul className="space-y-2">
              {meta.workExperience.map((exp, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between border border-ink-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-800">
                      {exp.role}
                    </p>
                    <p className="text-sm text-ink-600">{exp.company}</p>
                  </div>
                  <span className="mono text-xs text-ink-500">
                    {exp.fromYear ?? "—"} – {exp.toYear ?? "now"}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

      {profile && meta?.links && hasAnyLink(meta.links) && (
        <Section title="Links">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {meta.links.x && (
              <li>
                <a
                  href={meta.links.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  X · {hostnameOf(meta.links.x)}
                </a>
              </li>
            )}
            {meta.links.github && (
              <li>
                <a
                  href={meta.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  GitHub · {hostnameOf(meta.links.github)}
                </a>
              </li>
            )}
            {meta.links.linkedin && (
              <li>
                <a
                  href={meta.links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  LinkedIn · {hostnameOf(meta.links.linkedin)}
                </a>
              </li>
            )}
            {meta.links.site && (
              <li>
                <a
                  href={meta.links.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  Site · {hostnameOf(meta.links.site)}
                </a>
              </li>
            )}
          </ul>
        </Section>
      )}

      {profile && meta?.about && (
        <Section title="About">
          <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
            {meta.about}
          </p>
        </Section>
      )}

      <Section title="Entities created">
        {entities.length === 0 ? (
          <p className="hint">No entities created by this wallet.</p>
        ) : (
          <ul className="space-y-2">
            {entities.map((e) => (
              <li
                key={e.publicKey.toBase58()}
                className="flex items-center justify-between border border-ink-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="mono text-xs text-ink-500">
                    entity {bytesHex(e.account.entityId)}
                  </p>
                  <p className="text-sm">
                    {e.account.jurisdiction} · {e.account.projectCount}{" "}
                    project(s) · {e.account.relationshipCount} attestation(s)
                  </p>
                </div>
                <Link
                  href={`/entry/${bytesHex(e.account.entityId)}`}
                  className="btn-secondary"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Community signals submitted">
        {comments.length === 0 ? (
          <p className="hint">No community signals submitted yet.</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.publicKey.toBase58()}
                className="border border-ink-200 bg-white px-4 py-3"
              >
                <p className="text-xs text-ink-500">
                  on entity{" "}
                  <span className="mono">{shortKey(c.account.entity)}</span>
                  {" · "}
                  submitted {formatTimestamp(c.account.submittedAt)}
                </p>
                <p className="mono mt-1 text-[11px] text-ink-500">
                  content-hash {shortHash(c.account.contentHash)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-ink-200 pt-6">
      <h2 className="serif mb-3 text-xl font-semibold text-ink-800">{title}</h2>
      {children}
    </section>
  );
}

function hasAnyLink(links: UserMetadata["links"]): boolean {
  if (!links) return false;
  return Boolean(links.x || links.github || links.linkedin || links.site);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

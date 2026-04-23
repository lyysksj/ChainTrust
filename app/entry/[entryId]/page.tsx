"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchCommentsForEntry,
  fetchEntryByPda,
  fetchWalletMappingsForEntry,
} from "@/lib/anchor/client";
import { entryPda } from "@/lib/anchor/pdas";
import { StatusChip } from "@/components/status-chip";
import { WalletMappingList } from "@/components/wallet-mapping-list";
import { ReviewList } from "@/components/review-list";
import { CommentForm } from "@/components/comment-form";
import { ClaimCard } from "@/components/claim-card";
import { AttestationsCard } from "@/components/attestations-card";
import { formatTimestamp, shortHash, shortKey } from "@/lib/utils/format";
import type { CompanyEntry, EntryMetadata, CommentRecord, WalletMapping } from "@/types";

type Params = { entryId: string };

function hexToBytes(hex: string): number[] {
  if (hex.length !== 16) throw new Error("entry id must be 16 hex chars");
  const out = new Array<number>(8);
  for (let i = 0; i < 8; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export default function EntryPage({ params }: { params: Params }) {
  const program = useProgram();
  const { publicKey } = useWallet();

  const idBytes = useMemo(() => {
    try {
      return hexToBytes(params.entryId);
    } catch {
      return null;
    }
  }, [params.entryId]);

  const pda = useMemo(() => (idBytes ? entryPda(idBytes)[0] : null), [idBytes]);

  const [entry, setEntry] = useState<CompanyEntry | null>(null);
  const [mappings, setMappings] = useState<
    { publicKey: PublicKey; account: WalletMapping }[]
  >([]);
  const [comments, setComments] = useState<
    { publicKey: PublicKey; account: CommentRecord }[]
  >([]);
  const [metadata, setMetadata] = useState<EntryMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    if (!program || !pda) return;
    const e = await fetchEntryByPda(program, pda);
    if (!e) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setEntry(e);
    const [m, c] = await Promise.all([
      fetchWalletMappingsForEntry(program, pda),
      fetchCommentsForEntry(program, pda),
    ]);
    setMappings(m);
    setComments(c);
    setLoading(false);
  }, [program, pda]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!entry?.metadataUri) {
      setMetadata(null);
      return;
    }
    let alive = true;
    fetch(`/api/mock/fetch?uri=${encodeURIComponent(entry.metadataUri)}`)
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => {
        if (!alive || !t) return;
        try {
          setMetadata(JSON.parse(t) as EntryMetadata);
        } catch {
          /* ignore */
        }
      });
    return () => {
      alive = false;
    };
  }, [entry?.metadataUri]);

  if (!idBytes) {
    return <p className="hint">Invalid entry id.</p>;
  }
  if (loading) return <p className="hint">Loading entry…</p>;
  if (notFound || !entry || !pda) {
    return (
      <div className="space-y-3">
        <h1 className="serif text-2xl font-semibold text-ink-800">Entry not found</h1>
        <p className="text-sm text-ink-600">
          The entry <span className="mono">{params.entryId}</span> does not exist yet.
        </p>
        <Link href="/create" className="btn">
          Create a new entry
        </Link>
      </div>
    );
  }

  const isOfficial =
    entry.isClaimed &&
    publicKey != null &&
    publicKey.toBase58() === entry.officialWallet.toBase58();
  const domain = metadata?.domain ?? "";

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-ink-500">
          <span>Company entry</span>
          <span>·</span>
          <span className="mono normal-case tracking-normal">{params.entryId}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="serif text-4xl font-semibold text-ink-800">
              {metadata?.companyName ?? "(metadata pending)"}
            </h1>
            {metadata?.projectName &&
              metadata.projectName !== metadata.companyName && (
                <p className="mt-1 text-ink-600">
                  Project: <span className="font-medium">{metadata.projectName}</span>
                </p>
              )}
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={entry.status} isClaimed={entry.isClaimed} />
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <Field label="Jurisdiction" value={entry.jurisdiction} />
          <Field label="Primary domain" value={metadata?.domain || "—"} />
          <Field
            label="Primary wallet"
            value={<span className="mono">{shortKey(entry.primaryWallet)}</span>}
          />
          <Field
            label="Created"
            value={formatTimestamp(entry.createdAt)}
          />
          <Field
            label="Created by"
            value={<span className="mono">{shortKey(entry.createdBy)}</span>}
          />
          <Field
            label="Domain hash"
            value={<span className="mono">{shortHash(entry.domainHash)}</span>}
          />
        </dl>

        {metadata?.description && (
          <p className="max-w-3xl border-l-2 border-ink-300 pl-4 text-sm leading-relaxed text-ink-700">
            {metadata.description}
          </p>
        )}

        {entry.isClaimed && (
          <p className="rounded-sm bg-claimed/5 px-3 py-2 text-xs text-claimed">
            Claimed by <span className="mono">{shortKey(entry.officialWallet)}</span> on{" "}
            {formatTimestamp(entry.claimedAt)}. Claim gives voice, not control — community reviews remain immutable.
          </p>
        )}
      </header>

      <Section title="Attestations" hint="Who vouches for this entry.">
        <AttestationsCard entryPda={pda.toBase58()} />
      </Section>

      <Section
        title="Linked wallets"
        hint="Community mappings are proposals. Official mappings are added by the claimed representative."
      >
        <WalletMappingList items={mappings} />
      </Section>

      {!entry.isClaimed && domain && (
        <Section title="Claim" hint="Available because no representative has claimed this entry yet.">
          <ClaimCard entryPda={pda} domain={domain} onClaimed={refresh} />
        </Section>
      )}

      <Section
        title="Reviews"
        hint="Each review is a PDA with a content hash and timestamp. The program has no delete instruction."
      >
        <ReviewList
          entryPda={pda}
          items={comments}
          isClaimed={entry.isClaimed}
          officialWallet={entry.isClaimed ? entry.officialWallet : null}
          onResponded={refresh}
        />
      </Section>

      <Section title="Add a review" hint="">
        {publicKey ? (
          <CommentForm entryPda={pda} onSubmitted={refresh} />
        ) : (
          <p className="hint">Connect and register a user to submit a review.</p>
        )}
      </Section>

      {isOfficial && (
        <p className="border border-claimed/40 bg-claimed/5 p-3 text-xs text-claimed">
          You are the official representative for this entry. Click on any community review to publish an official response.
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-800">{value}</dd>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-ink-200 pt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="serif text-xl font-semibold text-ink-800">{title}</h2>
        {hint && <p className="hint max-w-lg text-right">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

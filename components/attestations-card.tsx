"use client";

import { useEffect, useState } from "react";
import type { Attestation } from "@/types";
import { formatTimestamp } from "@/lib/utils/format";

export function AttestationsCard({ entryPda }: { entryPda: string }) {
  const [items, setItems] = useState<Attestation[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/mock/attestations?entry=${encodeURIComponent(entryPda)}`)
      .then((r) => r.json())
      .then((data) => {
        if (alive && Array.isArray(data?.attestations)) setItems(data.attestations);
      });
    return () => {
      alive = false;
    };
  }, [entryPda]);

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="hint">Loading attestations…</p>}
      {items.map((a) => (
        <div
          key={a.id}
          className="border border-ink-200 bg-white p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={
                  a.issuerRole === "platform"
                    ? "chip chip-verified"
                    : "chip chip-community"
                }
              >
                {a.issuerRole === "platform" ? "Platform" : "Third-party"}
              </span>
              <span className="text-sm font-medium text-ink-800">{a.issuer}</span>
            </div>
            <span className="text-xs text-ink-500">{formatTimestamp(a.issuedAt)}</span>
          </div>
          <p className="mt-1 text-sm text-ink-700">{a.type}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-ink-500">
            Status: {a.status}
          </p>
          {a.note && <p className="hint mt-2">{a.note}</p>}
        </div>
      ))}
    </div>
  );
}

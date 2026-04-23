"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import { fetchUserProfile } from "@/lib/anchor/client";
import { EntryForm } from "@/components/entry-form";

export default function CreateEntryPage() {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [state, setState] = useState<"connect" | "checking" | "register" | "ready">(
    "connect",
  );

  useEffect(() => {
    if (!publicKey || !program) {
      setState("connect");
      return;
    }
    let alive = true;
    setState("checking");
    fetchUserProfile(program, publicKey).then((p) => {
      if (!alive) return;
      setState(p ? "ready" : "register");
    });
    return () => {
      alive = false;
    };
  }, [publicKey, program]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-ink-500">Step 2</p>
        <h1 className="serif mt-2 text-3xl font-semibold text-ink-800">
          Create a company entry
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-600">
          An entry is a public PDA. It's not owned by you — it belongs to the facts.
          You can anchor identity, wallets, and evidence; anyone else can add reviews.
        </p>
      </header>

      {state === "connect" && (
        <p className="text-sm text-ink-700">Connect a Solana wallet to continue.</p>
      )}
      {state === "checking" && (
        <p className="text-sm text-ink-700">Checking profile…</p>
      )}
      {state === "register" && (
        <div className="border border-ink-200 bg-white p-4 text-sm text-ink-700">
          <p>You need a user profile before creating an entry.</p>
          <Link href="/register" className="btn mt-3">
            Register first
          </Link>
        </div>
      )}
      {state === "ready" && <EntryForm />}
    </div>
  );
}

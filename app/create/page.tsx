"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import { fetchUserProfile } from "@/lib/anchor/client";
import { EntryForm } from "@/components/entry-form";

export default function CreateEntityPage() {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [state, setState] = useState<
    "connect" | "checking" | "register" | "ready"
  >("connect");

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
    <div data-screen="create entity">
      <div className="docnum" style={{ marginBottom: 8 }}>
        FORM CT-NEW · 2026 EDITION · ART. 5.3
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          File a new Entity.
        </h2>
        <span className="section-meta">PDA seeds: [&quot;entity&quot;, entity_id]</span>
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
        The Entity is the off-chain legal anchor of the on-chain identity graph.
        Once filed, you can register Projects under it and attest relationships
        (wallets, domains, UBO, hierarchy) on the entity page.
      </p>

      {state === "connect" && (
        <div className="no-result">CONNECT A SOLANA WALLET TO CONTINUE.</div>
      )}
      {state === "checking" && (
        <div className="no-result">CHECKING PROFILE…</div>
      )}
      {state === "register" && (
        <div className="doc-card">
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 15,
              color: "var(--ink-2)",
              margin: "0 0 16px",
            }}
          >
            You need a verified user profile before filing an Entity.
          </p>
          <Link href="/register" className="btn btn-primary">
            Register profile first →
          </Link>
        </div>
      )}
      {state === "ready" && (
        <div className="doc-card">
          <div className="doc-card-h">
            <div className="doc-card-title">Entity registration</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              SUBJECT · §1
            </div>
          </div>
          <EntryForm />
        </div>
      )}
    </div>
  );
}

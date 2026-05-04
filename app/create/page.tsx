"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/lib/anchor/hooks";
import { fetchUserProfile } from "@/lib/anchor/client";
import { EntryForm } from "@/components/entry-form";
import { useT } from "@/lib/i18n";

export default function CreateEntityPage() {
  const { publicKey } = useWallet();
  const program = useProgram();
  const t = useT();
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
        {t("create.docnum")}
      </div>
      <div className="section-h" style={{ borderTop: "none", paddingTop: 0 }}>
        <h2 className="section-title" style={{ fontSize: 36 }}>
          {t("create.title")}
        </h2>
        <span className="section-meta">{t("create.meta")}</span>
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
        {t("create.intro")}
      </p>

      {state === "connect" && (
        <div className="no-result">{t("common.connectWallet")}</div>
      )}
      {state === "checking" && (
        <div className="no-result">{t("common.checkingProfile")}</div>
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
            {t("create.needProfile")}
          </p>
          <Link href="/register" className="btn btn-primary">
            {t("create.registerFirst")}
          </Link>
        </div>
      )}
      {state === "ready" && <EntryForm />}
    </div>
  );
}

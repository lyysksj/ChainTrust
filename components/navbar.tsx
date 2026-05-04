"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WalletButton } from "./wallet-button";
import { LanguageToggle } from "./language-toggle";
import { useT } from "@/lib/i18n";

const LINK_DEFS = [
  { href: "/", key: "nav.home", match: (p: string) => p === "/" },
  {
    href: "/resolve",
    key: "nav.resolve",
    match: (p: string) => p.startsWith("/resolve"),
  },
  {
    href: "/attest",
    key: "nav.attest",
    match: (p: string) => p.startsWith("/attest"),
  },
  {
    href: "/issuers",
    key: "nav.issuers",
    match: (p: string) => p.startsWith("/issuers") || p.startsWith("/issuer"),
  },
  {
    href: "/register",
    key: "nav.register",
    match: (p: string) => p.startsWith("/register"),
  },
  {
    href: "/create",
    key: "nav.entity",
    match: (p: string) => p.startsWith("/create"),
  },
];

function todayLabel(): string {
  return new Date()
    .toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  return (
    <>
      <div className="topbar-meta">
        <div className="topbar-meta-inner">
          <span>CT REGISTRY · PUBLIC GOOD</span>
          <span>SOLANA · {todayLabel()}</span>
        </div>
      </div>
      <header className="topbar">
        <div className="topbar-inner">
          <a
            className="brand"
            onClick={() => router.push("/")}
            style={{ cursor: "pointer" }}
          >
            <span className="brand-mark">C</span>
            <span className="brand-name">ChainTrust</span>
            <span className="brand-tag">
              Public Identity Registry · Solana
            </span>
          </a>
          <nav className="nav">
            {LINK_DEFS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link ${l.match(pathname) ? "active" : ""}`}
              >
                {t(l.key)}
              </Link>
            ))}
            <span style={{ marginLeft: 12, display: "inline-flex", alignItems: "center", gap: 12 }}>
              <LanguageToggle />
              <WalletButton />
            </span>
          </nav>
        </div>
      </header>
    </>
  );
}

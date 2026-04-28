"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WalletButton } from "./wallet-button";

const LINKS = [
  { href: "/", label: "Registry", match: (p: string) => p === "/" },
  { href: "/resolve", label: "Resolve", match: (p: string) => p.startsWith("/resolve") },
  { href: "/attest", label: "Attest", match: (p: string) => p.startsWith("/attest") },
  { href: "/issuers", label: "Issuers", match: (p: string) => p.startsWith("/issuers") || p.startsWith("/issuer") },
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
  return (
    <>
      <div className="topbar-meta">
        <div className="topbar-meta-inner">
          <span>CT REGISTRY · PUBLIC GOOD · NO. 0000-0001</span>
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
              Public Identity Registry · v0.4 MVP
            </span>
          </a>
          <nav className="nav">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link ${l.match(pathname) ? "active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
            <span style={{ marginLeft: 12 }}>
              <WalletButton />
            </span>
          </nav>
        </div>
      </header>
    </>
  );
}

"use client";

import { useEffect, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

// ---------- Stamp seal ----------
export function Stamp({
  text = "Verified",
  sub = "CHAINTRUST · T1",
  size = "normal",
}: {
  text?: string;
  sub?: string;
  size?: "small" | "normal";
}) {
  return (
    <div className={`stamp-seal ${size === "small" ? "small" : ""}`}>
      <div>{text}</div>
      <div className="stamp-seal-inner">{sub}</div>
    </div>
  );
}

// ---------- Tier pill ----------
export function TierPill({ tier }: { tier: number }) {
  const t = Math.max(1, Math.min(3, tier || 3));
  return <span className={`tier tier-${t}`}>T{t}</span>;
}

// ---------- Status pill ----------
type StatusInput = number | "platform_verified" | "claimed" | "unverified";

export function StatusPill({
  status,
  claimed,
}: {
  status: StatusInput;
  claimed?: boolean;
}) {
  const t = useT();
  const s =
    typeof status === "number"
      ? status === 2
        ? "claimed"
        : status === 1
          ? "platform_verified"
          : "unverified"
      : status;
  if ((s === "platform_verified" && claimed) || s === "claimed") {
    return (
      <span
        className="status status-claimed"
        title={t("status.claimed.title")}
      >
        {t("status.claimed.text")}
      </span>
    );
  }
  if (s === "platform_verified") {
    return (
      <span
        className="status status-platform"
        title={t("status.platform.title")}
      >
        {t("status.platform.text")}
      </span>
    );
  }
  return (
    <span
      className="status status-unverified"
      title={t("status.unverified.title")}
    >
      {t("status.unverified.text")}
    </span>
  );
}

// ---------- Issuer badge ----------
export function IssuerBadge({
  name,
  tier,
  kind,
  authorityShort,
}: {
  name: string | null;
  tier: number;
  kind?: string | null;
  authorityShort?: string | null;
}) {
  const t = useT();
  return (
    <div className="rel-issuer">
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <TierPill tier={tier} />
        <span className="rel-issuer-name">
          {name ?? t("issuerBadge.unknown")}
        </span>
      </div>
      <div className="docnum mono" style={{ fontSize: 9 }}>
        {(kind ?? t("issuerBadge.fallbackKind"))}
        {authorityShort ? ` · ${authorityShort}` : ""}
      </div>
    </div>
  );
}

// ---------- Toast ----------
export function Toast({
  message,
  onClose,
  durationMs = 2400,
}: {
  message: string | null;
  onClose: () => void;
  durationMs?: number;
}) {
  const t = useT();
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onClose, durationMs);
    return () => clearTimeout(id);
  }, [message, onClose, durationMs]);
  if (!message) return null;
  return (
    <div className="toast">
      <span className="stamp-mark">●</span>
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("toast.dismiss")}
        style={{
          marginLeft: 12,
          background: "transparent",
          border: "none",
          color: "var(--paper)",
          cursor: "pointer",
          fontFamily: "var(--mono)",
          fontSize: 11,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ---------- Section header ----------
export function SectionH({
  title,
  meta,
  children,
  fontSize,
}: {
  title: string;
  meta?: string;
  children?: ReactNode;
  fontSize?: number;
}) {
  return (
    <div className="section-h">
      <h2
        className="section-title"
        style={fontSize ? { fontSize } : undefined}
      >
        {title}
      </h2>
      {children ? children : meta ? (
        <span className="section-meta">{meta}</span>
      ) : null}
    </div>
  );
}

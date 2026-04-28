"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "@/lib/anchor/hooks";
import {
  fetchAllIssuers,
  fetchProjectsForEntity,
  fetchRelationshipsForEntity,
} from "@/lib/anchor/client";
import {
  REL_KIND,
  REL_KIND_META,
} from "@/types";
import type { Entity, Issuer, Project, Relationship } from "@/types";
import { shortHash } from "@/lib/utils/format";
import { entityIdToCtNumber } from "@/lib/utils/ct-number";

type RelItem = { publicKey: PublicKey; account: Relationship };

type GroupKey =
  | "parent"
  | "subsidiary"
  | "project"
  | "wallet"
  | "domain"
  | "person"
  | "audit";

type Node = {
  rel: RelItem;
  x: number;
  y: number;
  group: GroupKey;
  label: string;
  sub: string;
  tier: number;
};

type Props = {
  entity: PublicKey;
  entityAccount: Entity;
  refreshKey?: number;
};

const W = 760;
const H = 360;

export function IdentityGraph({ entity, entityAccount, refreshKey }: Props) {
  const program = useProgram();
  const [rels, setRels] = useState<RelItem[]>([]);
  const [issuers, setIssuers] = useState<Map<string, Issuer>>(new Map());
  const [projects, setProjects] = useState<Map<string, Project>>(new Map());

  useEffect(() => {
    if (!program) return;
    let alive = true;
    (async () => {
      const [r, p, i] = await Promise.all([
        fetchRelationshipsForEntity(program, entity),
        fetchProjectsForEntity(program, entity),
        fetchAllIssuers(program),
      ]);
      if (!alive) return;
      setRels(
        r.map((x) => ({
          publicKey: x.publicKey,
          account: x.account as unknown as Relationship,
        })),
      );
      const issuerMap = new Map<string, Issuer>();
      for (const x of i)
        issuerMap.set(x.publicKey.toBase58(), x.account as unknown as Issuer);
      setIssuers(issuerMap);
      const projMap = new Map<string, Project>();
      for (const x of p)
        projMap.set(x.publicKey.toBase58(), x.account as unknown as Project);
      setProjects(projMap);
    })();
    return () => {
      alive = false;
    };
  }, [program, entity, refreshKey]);

  const nodes = useMemo(() => buildNodes(rels, issuers, projects), [
    rels,
    issuers,
    projects,
  ]);

  const ctNumber = entityIdToCtNumber(entityAccount.entityId);
  const cx = W / 2;
  const cy = H / 2;

  if (rels.length === 0) {
    return (
      <div style={{ padding: 32 }}>
        <div className="no-result">
          NO ATTESTATIONS YET — FILE THE FIRST RELATIONSHIP TO POPULATE THE
          GRAPH
        </div>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="360"
      style={{ display: "block" }}
    >
      <defs>
        <marker
          id="arrow-ink"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#2a1f3d" />
        </marker>
        <marker
          id="arrow-revoked"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#8a6f6f" />
        </marker>
        <linearGradient id="center-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2a1f3d" />
          <stop offset="100%" stopColor="#3d2f5a" />
        </linearGradient>
      </defs>

      {/* Edges */}
      {nodes.map((n) => {
        const revoked = Number(n.rel.account.revokedAt) > 0;
        const stroke = revoked ? "#8a6f6f" : "#7a6e92";
        const dash = revoked ? "5 4" : "none";
        const dx = n.x - cx;
        const dy = n.y - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const startX = cx + (dx / len) * 70;
        const startY = cy + (dy / len) * 30;
        const endX = n.x - (dx / len) * 56;
        const endY = n.y - (dy / len) * 19;
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2 - 6;
        const verb = (REL_KIND_META[n.rel.account.kind]?.verb ??
          "rel") as string;
        return (
          <g key={"edge-" + n.rel.publicKey.toBase58()}>
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={stroke}
              strokeWidth="1.2"
              strokeDasharray={dash}
              markerEnd={revoked ? "url(#arrow-revoked)" : "url(#arrow-ink)"}
            />
            <text
              x={midX}
              y={midY}
              textAnchor="middle"
              fontFamily="'IBM Plex Mono', monospace"
              fontSize="8"
              fill={revoked ? "#8a6f6f" : "#7a6e92"}
              letterSpacing="0.06em"
            >
              {verb}
            </text>
          </g>
        );
      })}

      {/* Center entity */}
      <g transform={`translate(${cx - 70}, ${cy - 30})`}>
        <rect
          width="140"
          height="60"
          fill="url(#center-grad)"
          stroke="#2a1f3d"
          strokeWidth="1.5"
        />
        <text
          x="70"
          y="22"
          textAnchor="middle"
          fontFamily="'Source Serif 4', serif"
          fontSize="13"
          fontWeight="600"
          fill="#f5f1f7"
        >
          ENTITY
        </text>
        <text
          x="70"
          y="40"
          textAnchor="middle"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="9"
          fill="#dcc9f0"
          letterSpacing="0.06em"
        >
          {ctNumber}
        </text>
        <text
          x="70"
          y="52"
          textAnchor="middle"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="8"
          fill="#a89cb8"
          letterSpacing="0.1em"
        >
          {entityAccount.jurisdiction.toUpperCase()}
        </text>
      </g>

      {/* Nodes */}
      {nodes.map((n) => renderNode(n))}
    </svg>
  );
}

function buildNodes(
  rels: RelItem[],
  issuers: Map<string, Issuer>,
  projects: Map<string, Project>,
): Node[] {
  const cx = W / 2;
  const cy = H / 2;
  const buckets: Record<GroupKey, RelItem[]> = {
    parent: [],
    subsidiary: [],
    project: [],
    wallet: [],
    domain: [],
    person: [],
    audit: [],
  };
  for (const r of rels) {
    const kind = r.account.kind;
    if (kind === REL_KIND.SUBSIDIARY_OF) buckets.parent.push(r);
    else if (kind === REL_KIND.PARENT_OF) buckets.subsidiary.push(r);
    else if (kind === REL_KIND.OPERATES_PROJECT) buckets.project.push(r);
    else if (
      kind === REL_KIND.DEPLOYS_WALLET ||
      kind === REL_KIND.CONTROLS_WALLET
    )
      buckets.wallet.push(r);
    else if (kind === REL_KIND.HAS_DOMAIN) buckets.domain.push(r);
    else if (kind === REL_KIND.HAS_UBO || kind === REL_KIND.HAS_OFFICER)
      buckets.person.push(r);
    else if (kind === REL_KIND.AUDITED_BY) buckets.audit.push(r);
  }
  const groups: {
    bucket: GroupKey;
    angle: number;
    spread: number;
    dist: number;
  }[] = [
    { bucket: "parent", angle: -100, spread: 30, dist: 130 },
    { bucket: "subsidiary", angle: -80, spread: 30, dist: 130 },
    { bucket: "project", angle: 0, spread: 40, dist: 150 },
    { bucket: "domain", angle: 50, spread: 16, dist: 145 },
    { bucket: "wallet", angle: 90, spread: 50, dist: 150 },
    { bucket: "person", angle: 180, spread: 30, dist: 135 },
    { bucket: "audit", angle: 215, spread: 16, dist: 135 },
  ];

  const nodes: Node[] = [];
  for (const g of groups) {
    const items = buckets[g.bucket];
    if (!items.length) continue;
    const baseAng = (g.angle * Math.PI) / 180;
    items.forEach((rel, i) => {
      const offset =
        items.length === 1
          ? 0
          : ((i - (items.length - 1) / 2) * g.spread) /
            Math.max(items.length - 1, 1);
      const ang = baseAng + (offset * Math.PI) / 180;
      const x = cx + Math.cos(ang) * g.dist;
      const y = cy + Math.sin(ang) * g.dist;
      const issuer = issuers.get(rel.account.issuer.toBase58());
      const tier = issuer?.trustTier ?? 3;
      const meta = REL_KIND_META[rel.account.kind];
      const tt = meta?.targetType ?? "wallet";
      let label = "—";
      let sub = "";
      if (tt === "project") {
        try {
          const projPk = new PublicKey(Buffer.from(rel.account.targetRef));
          const proj = projects.get(projPk.toBase58());
          label = proj
            ? `Project ${shortHash(proj.projectId, 6)}`
            : "Project PDA";
          sub = "OPERATES_PROJECT";
        } catch {
          label = "Project";
          sub = "OPERATES_PROJECT";
        }
      } else if (tt === "wallet") {
        try {
          const pk = new PublicKey(Buffer.from(rel.account.targetRef));
          label =
            rel.account.kind === REL_KIND.DEPLOYS_WALLET
              ? "Deployer wallet"
              : "Controlled wallet";
          sub = `${pk.toBase58().slice(0, 6)}…${pk.toBase58().slice(-4)}`;
        } catch {
          label = "Wallet";
          sub = "—";
        }
      } else if (tt === "domain") {
        label = "Domain";
        sub = `HASH ${shortHash(rel.account.targetRef, 6)}`;
      } else if (tt === "person") {
        label =
          rel.account.kind === REL_KIND.HAS_UBO ? "UBO" : "Officer";
        sub = `HASH ${shortHash(rel.account.targetRef, 6)}`;
      } else if (tt === "entity") {
        label =
          rel.account.kind === REL_KIND.PARENT_OF
            ? "Subsidiary entity"
            : "Parent entity";
        try {
          const pk = new PublicKey(Buffer.from(rel.account.targetRef));
          sub = `${pk.toBase58().slice(0, 6)}…${pk.toBase58().slice(-4)}`;
        } catch {
          sub = "—";
        }
      } else if (tt === "issuer") {
        label = "Auditor";
        try {
          const pk = new PublicKey(Buffer.from(rel.account.targetRef));
          sub = `${pk.toBase58().slice(0, 6)}…${pk.toBase58().slice(-4)}`;
        } catch {
          sub = "—";
        }
      }
      if (label.length > 22) label = label.slice(0, 20) + "…";
      nodes.push({ rel, x, y, group: g.bucket, label, sub, tier });
    });
  }
  return nodes;
}

function renderNode(n: Node) {
  const revoked = Number(n.rel.account.revokedAt) > 0;
  const stroke = revoked
    ? "#8a6f6f"
    : n.tier === 1
      ? "#2a1f3d"
      : n.tier === 2
        ? "#7a6e92"
        : "#a89cb8";
  const strokeDash = revoked ? "4 3" : "none";
  const fill = revoked ? "#ebe4f0" : "#f5f1f7";
  const NW = 110;
  const NH = 38;
  return (
    <g
      key={n.rel.publicKey.toBase58()}
      transform={`translate(${n.x - NW / 2}, ${n.y - NH / 2})`}
    >
      <rect
        width={NW}
        height={NH}
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
        strokeDasharray={strokeDash}
      />
      <text
        x={NW / 2}
        y={15}
        textAnchor="middle"
        fontFamily="'Source Serif 4', serif"
        fontSize="11"
        fontWeight="600"
        fill={revoked ? "#a89cb8" : "#2a1f3d"}
        style={{ textDecoration: revoked ? "line-through" : "none" }}
      >
        {n.label}
      </text>
      <text
        x={NW / 2}
        y={29}
        textAnchor="middle"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="8"
        fill={revoked ? "#a89cb8" : "#7a6e92"}
        letterSpacing="0.04em"
      >
        {n.sub}
      </text>
      <circle
        cx={6}
        cy={6}
        r={3}
        fill={
          n.tier === 1 ? "#2a1f3d" : n.tier === 2 ? "#7a6e92" : "#a89cb8"
        }
      />
    </g>
  );
}

import { NextRequest, NextResponse } from "next/server";
import {
  getByNullifier,
  getByWallet,
  recordVerification,
} from "@/lib/mock/worldid";

export const runtime = "nodejs";

const APP_ID = process.env.NEXT_PUBLIC_WORLDID_APP_ID || "";
const RP_ID = process.env.NEXT_PUBLIC_WORLDID_RP_ID || "";

// World ID Cloud v4 verification API.
// POST https://developer.world.org/api/v4/verify/{rp_id}
// Body: the IDKit result payload as-is (no remapping).
const WORLD_API_BASE = "https://developer.world.org/api/v4/verify";

type IDKitResultPayload = {
  protocol_version?: string;
  nonce?: string;
  action?: string;
  responses?: Array<{
    identifier?: string;
    nullifier?: string;
    proof?: unknown;
    merkle_root?: string;
    signal_hash?: string;
    issuer_schema_id?: number;
  }>;
};

function extractNullifier(result: IDKitResultPayload): string | null {
  const r = result.responses?.[0];
  if (!r) return null;
  return r.nullifier ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { result, wallet } = body as {
      result: IDKitResultPayload;
      wallet?: string;
    };

    if (!result || !wallet) {
      return NextResponse.json(
        { ok: false, error: "missing required fields (result, wallet)" },
        { status: 400 },
      );
    }
    if (!APP_ID || !RP_ID) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "NEXT_PUBLIC_WORLDID_APP_ID / _RP_ID are not configured on the server",
        },
        { status: 500 },
      );
    }

    const nullifierHash = extractNullifier(result);
    if (!nullifierHash) {
      return NextResponse.json(
        { ok: false, error: "result has no nullifier" },
        { status: 400 },
      );
    }

    // Anti-sybil: refuse if nullifier already mapped to a different wallet.
    const prior = await getByNullifier(nullifierHash);
    if (prior && prior.wallet !== wallet) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This identity has already registered a ChainTrust profile from a different wallet.",
          code: "nullifier_reused",
        },
        { status: 409 },
      );
    }

    // Forward the IDKit payload as-is to World's verifier.
    const upstreamResp = await fetch(`${WORLD_API_BASE}/${RP_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result),
    });
    const upstreamJson = await upstreamResp.json().catch(() => ({}));
    if (!upstreamResp.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: upstreamJson?.detail ?? "World ID verification failed",
          code: upstreamJson?.code ?? "verify_failed",
          upstream: upstreamJson,
        },
        { status: upstreamResp.status },
      );
    }

    await recordVerification(wallet, nullifierHash);

    return NextResponse.json({
      ok: true,
      nullifier_hash: nullifierHash,
      wallet,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String((err as Error).message ?? err) },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet)
    return NextResponse.json({ verified: false }, { status: 400 });
  const record = await getByWallet(wallet);
  return NextResponse.json({
    verified: !!record,
    nullifierHash: record?.nullifierHash ?? null,
    verifiedAt: record?.verifiedAt ?? null,
    appConfigured: !!APP_ID && !!RP_ID,
  });
}

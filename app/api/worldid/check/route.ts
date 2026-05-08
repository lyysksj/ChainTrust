/**
 * GET /api/worldid/check?wallet=<base58>
 *
 * Returns whether a wallet is bound to a World ID nullifier. Source of truth
 * is the on-chain HumanProof PDA (created by /api/worldid/verify). The
 * previous implementation read a local-disk cache that doesn't survive
 * Vercel cold starts — users who had verified would see "pending" forever
 * after a redeploy.
 */
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { fetchHumanProof } from "@/lib/anchor/client";
import { buildReadonlyProgram, defaultRpcUrl } from "@/lib/server/anchor-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_ID = process.env.NEXT_PUBLIC_WORLDID_APP_ID || "";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json(
      { verified: false, error: "wallet required" },
      { status: 400 },
    );
  }

  let walletPk: PublicKey;
  try {
    walletPk = new PublicKey(wallet);
  } catch {
    return NextResponse.json(
      { verified: false, error: "invalid wallet" },
      { status: 400 },
    );
  }

  try {
    const { program } = buildReadonlyProgram(defaultRpcUrl());
    const proof = await fetchHumanProof(program, walletPk);
    if (!proof) {
      return NextResponse.json({
        verified: false,
        nullifierHash: null,
        verifiedAt: null,
        appConfigured: !!APP_ID,
      });
    }
    const nullifierBytes: number[] | undefined = (
      proof as { nullifierHash?: number[] }
    ).nullifierHash;
    const nullifierHex = nullifierBytes
      ? "0x" +
        nullifierBytes
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      : null;
    const verifiedAtRaw = (
      proof as { verifiedAt?: { toNumber?: () => number } | number }
    ).verifiedAt;
    const verifiedAt =
      typeof verifiedAtRaw === "number"
        ? verifiedAtRaw * 1000
        : verifiedAtRaw && typeof verifiedAtRaw.toNumber === "function"
          ? verifiedAtRaw.toNumber() * 1000
          : null;
    return NextResponse.json({
      verified: true,
      nullifierHash: nullifierHex,
      verifiedAt,
      appConfigured: !!APP_ID,
    });
  } catch (err) {
    return NextResponse.json(
      {
        verified: false,
        error: `chain read failed: ${(err as Error).message ?? err}`,
        appConfigured: !!APP_ID,
      },
      { status: 502 },
    );
  }
}

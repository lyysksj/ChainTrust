import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { fetchHumanProof } from "@/lib/anchor/client";
import { recordVerification } from "@/lib/mock/worldid";
import { adminLoadError, loadAdminKeypair } from "@/lib/server/admin-keypair";
import {
  buildAdminProgram,
  defaultRpcUrl,
} from "@/lib/server/anchor-server";
import {
  attestHumanProofNoWs,
  ensureRegistryConfigInitialized,
} from "@/lib/server/tx-confirm";

export const runtime = "nodejs";

function isLocalDevMode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const rpcUrl = defaultRpcUrl();
  return /(?:127\.0\.0\.1|localhost)/.test(rpcUrl);
}

function bytesToHex(bytes: number[] | Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export async function POST(req: NextRequest) {
  if (!isLocalDevMode()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Mock HumanProof issuance is only available in local development against localhost RPC.",
      },
      { status: 403 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const wallet = body.wallet as string | undefined;
    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: "wallet is required" },
        { status: 400 },
      );
    }

    let walletPk: PublicKey;
    try {
      walletPk = new PublicKey(wallet);
    } catch {
      return NextResponse.json(
        { ok: false, error: "wallet is not a valid Solana pubkey" },
        { status: 400 },
      );
    }

    const admin = loadAdminKeypair();
    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            adminLoadError() ??
            "Admin keypair is not configured; cannot issue mock HumanProof.",
        },
        { status: 500 },
      );
    }

    const { program, provider } = buildAdminProgram(admin, defaultRpcUrl());
    await ensureRegistryConfigInitialized(program, provider, admin);

    const existingProof = await fetchHumanProof(program, walletPk);
    if (existingProof) {
      const nullifierHex = `0x${bytesToHex(existingProof.nullifierHash)}`;
      await recordVerification(walletPk.toBase58(), nullifierHex);
      return NextResponse.json({
        ok: true,
        wallet: walletPk.toBase58(),
        alreadyVerified: true,
        mock: true,
        nullifier_hash: nullifierHex,
      });
    }

    const nullifierBytes = Array.from(randomBytes(32));
    const txSig = await attestHumanProofNoWs(
      program,
      provider,
      admin,
      walletPk,
      nullifierBytes,
    );
    const nullifierHex = `0x${bytesToHex(nullifierBytes)}`;
    await recordVerification(walletPk.toBase58(), nullifierHex);

    return NextResponse.json({
      ok: true,
      wallet: walletPk.toBase58(),
      mock: true,
      onchain_tx: txSig,
      nullifier_hash: nullifierHex,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String((err as Error).message ?? err) },
      { status: 500 },
    );
  }
}

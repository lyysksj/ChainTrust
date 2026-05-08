/**
 * POST /api/worldid/verify
 *
 * Hardened verification flow. Three-way binding:
 *   1. World ID upstream verification (proof is real, nullifier is fresh)
 *   2. Wallet signature over a server-issued nonce (the wallet posting this
 *      request actually controls the pubkey — fixes the "I bind your wallet
 *      to my nullifier" attack)
 *   3. On-chain attestation: the registry admin keypair sends an
 *      `attest_human_proof` transaction, creating HumanProof + NullifierRecord
 *      PDAs. After this point register_user is unblocked for `wallet`.
 *
 * Body shape:
 *   {
 *     result: <IDKitResult>,
 *     wallet: string,           // base58
 *     nonce: string,            // hex from /api/worldid/challenge
 *     signature: string,        // base58 ed25519 signature over the message
 *   }
 *
 * The local-file mock store is kept for the GET pre-check so the UI can show
 * "verified" status quickly; the source of truth is the on-chain HumanProof.
 */
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  getByNullifier,
  getByWallet,
  recordVerification,
} from "@/lib/mock/worldid";
import {
  consumeWorldIdNonce,
} from "@/lib/server/worldid-challenge";
import { verifySolanaSignature } from "@/lib/server/verify-signature";
import { adminLoadError, loadAdminKeypair } from "@/lib/server/admin-keypair";
import {
  buildAdminProgram,
  defaultRpcUrl,
} from "@/lib/server/anchor-server";
import { fetchHumanProof } from "@/lib/anchor/client";
import {
  attestHumanProofNoWs,
  ensureRegistryConfigInitialized,
} from "@/lib/server/tx-confirm";

export const runtime = "nodejs";
// Verify performs an admin-signed on-chain attestation; devnet confirmation
// can take 8-15s, well over Vercel's 10s default. Requires Pro plan.
export const maxDuration = 60;

const APP_ID = process.env.NEXT_PUBLIC_WORLDID_APP_ID || "";
const RP_ID = process.env.NEXT_PUBLIC_WORLDID_RP_ID || "";

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

function extractNullifierHex(result: IDKitResultPayload): string | null {
  const r = result.responses?.[0];
  if (!r?.nullifier) return null;
  return r.nullifier;
}

/**
 * Convert a hex / 0x-hex / decimal string into a 32-byte big-endian buffer.
 * World ID nullifiers can come back as either decimal (legacy) or 0x-hex.
 */
function nullifierToBytes32(input: string): number[] | null {
  let hex: string;
  if (/^0x[0-9a-f]+$/i.test(input)) {
    hex = input.slice(2);
  } else if (/^[0-9a-f]{64}$/i.test(input)) {
    hex = input;
  } else if (/^[0-9]+$/.test(input)) {
    hex = BigInt(input).toString(16);
  } else {
    return null;
  }
  if (hex.length > 64) return null;
  hex = hex.padStart(64, "0");
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { result, wallet, nonce, signature } = body as {
      result: IDKitResultPayload;
      wallet?: string;
      nonce?: string;
      signature?: string;
    };

    if (!result || !wallet || !nonce || !signature) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "missing required fields (result, wallet, nonce, signature)",
        },
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

    // --- 1. Wallet signature must match the server-issued nonce. ---------
    const consumed = consumeWorldIdNonce(nonce);
    if (!consumed.ok) {
      return NextResponse.json(
        { ok: false, error: consumed.reason, code: "nonce_invalid" },
        { status: 401 },
      );
    }
    if (!verifySolanaSignature(consumed.message, signature, wallet)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Wallet signature does not match the issued challenge. Refusing to bind a wallet that did not prove control.",
          code: "bad_wallet_signature",
        },
        { status: 401 },
      );
    }

    // --- 2. Extract + canonicalise the World ID nullifier. ---------------
    const nullifierHex = extractNullifierHex(result);
    if (!nullifierHex) {
      return NextResponse.json(
        { ok: false, error: "result has no nullifier" },
        { status: 400 },
      );
    }
    const nullifierBytes = nullifierToBytes32(nullifierHex);
    if (!nullifierBytes) {
      return NextResponse.json(
        { ok: false, error: "nullifier could not be parsed to 32 bytes" },
        { status: 400 },
      );
    }

    // --- 3. Anti-sybil: same nullifier must not bind to a different wallet
    //         (kept locally as a quick reject before the on-chain check).
    const prior = await getByNullifier(nullifierHex);
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

    // --- 4. Forward the IDKit payload to World's verifier. ---------------
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

    // --- 5. On-chain HumanProof creation. --------------------------------
    const admin = loadAdminKeypair();
    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            adminLoadError() ??
            "Admin keypair is not configured; cannot issue HumanProof on chain.",
          code: "admin_not_configured",
        },
        { status: 500 },
      );
    }
    const { program, provider } = buildAdminProgram(admin, defaultRpcUrl());
    const walletPk = (() => {
      try {
        return new PublicKey(wallet);
      } catch {
        return null;
      }
    })();
    if (!walletPk) {
      return NextResponse.json(
        { ok: false, error: "wallet is not a valid Solana pubkey" },
        { status: 400 },
      );
    }

    // Idempotency: if a HumanProof already exists for this wallet, skip the
    // on-chain call and just refresh the local mirror.
    const existingProof = await fetchHumanProof(program, walletPk);
    let txSig: string | null = null;
    if (!existingProof) {
      try {
        await ensureRegistryConfigInitialized(program, provider, admin);
        txSig = await attestHumanProofNoWs(
          program,
          provider,
          admin,
          walletPk,
          nullifierBytes,
        );
      } catch (err) {
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to submit attest_human_proof: ${(err as Error).message}`,
            code: "onchain_attest_failed",
          },
          { status: 502 },
        );
      }
    }

    await recordVerification(wallet, nullifierHex);

    return NextResponse.json({
      ok: true,
      nullifier_hash: nullifierHex,
      wallet,
      onchain_tx: txSig,
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

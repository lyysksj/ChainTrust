import { NextRequest, NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit-core/signing";

export const runtime = "nodejs";

const SIGNING_KEY = process.env.WORLDID_RP_SIGNING_KEY || "";

// Returns a fresh RP signature so the IDKit widget can build the rp_context.
// Frontend POSTs `{ action }`; we sign and return the four fields the widget
// needs (sig + nonce + created_at + expires_at). The signing key never leaves
// the server.
export async function POST(req: NextRequest) {
  try {
    if (!SIGNING_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "WORLDID_RP_SIGNING_KEY is not configured on the server",
        },
        { status: 500 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const action = (body?.action as string) ?? "";
    if (!action) {
      return NextResponse.json(
        { ok: false, error: "action is required" },
        { status: 400 },
      );
    }

    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: SIGNING_KEY,
      action,
    });

    return NextResponse.json({
      ok: true,
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String((err as Error).message ?? err) },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { dnsChallenge, verifyDnsClaim } from "@/lib/mock/dns";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const kind = body.kind as "dns" | undefined;

  if (kind === "dns") {
    const challenge = body.challenge ?? dnsChallenge(body.wallet ?? "");
    const result = verifyDnsClaim({
      domain: body.domain ?? "",
      wallet: body.wallet ?? "",
      challenge,
    });
    return NextResponse.json({ ...result, challenge });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") ?? "";
  return NextResponse.json({ challenge: dnsChallenge(wallet) });
}

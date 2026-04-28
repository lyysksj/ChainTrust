import { NextRequest, NextResponse } from "next/server";
import { getByWallet } from "@/lib/mock/worldid";

export const runtime = "nodejs";

const APP_ID = process.env.NEXT_PUBLIC_WORLDID_APP_ID || "";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json(
      { verified: false, error: "wallet required" },
      { status: 400 },
    );
  }
  const record = await getByWallet(wallet);
  return NextResponse.json({
    verified: !!record,
    nullifierHash: record?.nullifierHash ?? null,
    verifiedAt: record?.verifiedAt ?? null,
    appConfigured: !!APP_ID,
  });
}

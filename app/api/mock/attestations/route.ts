import { NextRequest, NextResponse } from "next/server";
import { allAttestations } from "@/lib/mock/attestations";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const entryPda = req.nextUrl.searchParams.get("entry") ?? "";
  return NextResponse.json({ attestations: allAttestations(entryPda) });
}

import { NextRequest, NextResponse } from "next/server";
import { getText } from "@/lib/mock/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const uri = req.nextUrl.searchParams.get("uri");
  if (!uri) return NextResponse.json({ error: "uri required" }, { status: 400 });
  const body = await getText(uri);
  if (body == null) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(body, {
    headers: { "content-type": "application/json" },
  });
}

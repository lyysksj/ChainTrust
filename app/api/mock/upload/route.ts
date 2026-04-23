import { NextRequest, NextResponse } from "next/server";
import { putText } from "@/lib/mock/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    if (!body) {
      return NextResponse.json({ error: "Body required" }, { status: 400 });
    }
    const { uri, hashHex } = await putText(body);
    return NextResponse.json({ uri, hashHex });
  } catch (err) {
    return NextResponse.json(
      { error: String((err as Error).message ?? err) },
      { status: 500 },
    );
  }
}

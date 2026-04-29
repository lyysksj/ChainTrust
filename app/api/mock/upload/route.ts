import { NextRequest, NextResponse } from "next/server";
import { putContent, type Sensitivity } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const sensitivity = (req.nextUrl.searchParams.get("sensitivity") ??
      "public") as Sensitivity;
    const body = await req.text();
    if (!body) {
      return NextResponse.json({ error: "Body required" }, { status: 400 });
    }
    const result = await putContent(body, sensitivity);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: String((err as Error).message ?? err) },
      { status: 500 },
    );
  }
}

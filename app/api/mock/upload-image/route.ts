import { NextRequest, NextResponse } from "next/server";
import { putBinary } from "@/lib/mock/storage";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "multipart form field 'file' required" },
        { status: 400 },
      );
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${file.type}` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Image exceeds ${MAX_BYTES / 1024 / 1024} MB limit` },
        { status: 400 },
      );
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const ext =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type.split("/")[1] ?? "bin";
    const { uri, hashHex } = await putBinary(buf, ext);
    return NextResponse.json({ uri, hashHex, contentType: file.type });
  } catch (err) {
    return NextResponse.json(
      { error: String((err as Error).message ?? err) },
      { status: 500 },
    );
  }
}

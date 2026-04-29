import { NextRequest, NextResponse } from "next/server";
import { getBinary, getText } from "@/lib/mock/storage";
import {
  pinataFetchBinary,
  pinataFetchText,
} from "@/lib/storage/pinata";

export const runtime = "nodejs";

const EXT_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(req: NextRequest) {
  const uri = req.nextUrl.searchParams.get("uri");
  if (!uri) return NextResponse.json({ error: "uri required" }, { status: 400 });

  // Binary URIs (images) carry an extension after the last dot, e.g.
  // mock://abcd.png or ipfs://bafy...d.png. Plain JSON has no extension.
  const hasExt = uri.includes(".") && uri.lastIndexOf(".") > uri.indexOf("://");

  if (uri.startsWith("ipfs://")) {
    if (hasExt) {
      const bin = await pinataFetchBinary(uri);
      if (!bin)
        return NextResponse.json({ error: "not found" }, { status: 404 });
      const contentType =
        EXT_CONTENT_TYPE[bin.ext] ?? "application/octet-stream";
      return new NextResponse(new Uint8Array(bin.data), {
        headers: {
          "content-type": contentType,
          "cache-control": "public, max-age=86400",
        },
      });
    }
    const body = await pinataFetchText(uri);
    if (body == null)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    return new NextResponse(body, {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=300",
      },
    });
  }

  // Fall through to mock:// scheme — local disk.
  if (hasExt) {
    const bin = await getBinary(uri);
    if (!bin) return NextResponse.json({ error: "not found" }, { status: 404 });
    const contentType =
      EXT_CONTENT_TYPE[bin.ext] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(bin.data), {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600",
      },
    });
  }

  const body = await getText(uri);
  if (body == null)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(body, {
    headers: { "content-type": "application/json" },
  });
}

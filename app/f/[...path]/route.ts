import { issueSignedToken, presignUrl } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LINK_TTL_MS = 60 * 60 * 1000;

/** Permanent share link for a file in a private Blob store: redirects to a fresh short-lived signed URL. */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathname = path.map(decodeURIComponent).join("/");
  if (!pathname || pathname.split("/").some((s) => s === ".." || s === ".")) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const validUntil = Date.now() + LINK_TTL_MS;
    const token = await issueSignedToken({ pathname, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(token, { operation: "get", pathname, access: "private", validUntil });
    return NextResponse.redirect(presignedUrl, { status: 307, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return new NextResponse("This file is no longer available.", { status: 404 });
  }
}

import { NextResponse } from "next/server";
import { uploadMode } from "@/lib/blob-config";

export const dynamic = "force-dynamic";

export function GET() {
  const mode = uploadMode();
  return NextResponse.json({ uploadsEnabled: mode !== null, uploadMode: mode });
}

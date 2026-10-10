import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ uploadsEnabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
}

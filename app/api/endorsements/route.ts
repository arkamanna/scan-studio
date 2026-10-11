import { NextResponse } from "next/server";
import { listEndorsements, submitEndorsement, validateEndorsement, type EndorsementInput } from "@/lib/endorsements";
import { uploadMode } from "@/lib/blob-config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!uploadMode()) return NextResponse.json({ endorsements: [] });
  try {
    const endorsements = await listEndorsements("approved");
    return NextResponse.json({ endorsements }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ endorsements: [] });
  }
}

export async function POST(request: Request) {
  if (!uploadMode()) return NextResponse.json({ error: "Endorsements aren’t available right now." }, { status: 503 });
  const result = validateEndorsement((await request.json().catch(() => ({}))) as EndorsementInput);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  try {
    await submitEndorsement(result.value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 429 });
  }
}

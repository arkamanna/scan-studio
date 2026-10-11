import { NextResponse } from "next/server";
import {
  approveEndorsement,
  deleteUploads,
  isAdmin,
  listEndorsements,
  listUploads,
  purgeUploads,
  removeEndorsement,
} from "@/lib/endorsements";

export const dynamic = "force-dynamic";

const unauthorized = () =>
  NextResponse.json({ error: process.env.ADMIN_KEY ? "Wrong admin key." : "ADMIN_KEY isn’t set in Vercel yet." }, { status: 401 });

export async function GET(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const [pending, approved, files] = await Promise.all([listEndorsements("pending"), listEndorsements("approved"), listUploads()]);
  return NextResponse.json({ pending, approved, files });
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const { action, id, pathnames } = (await request.json().catch(() => ({}))) as { action?: string; id?: string; pathnames?: string[] };
  try {
    switch (action) {
      case "approve":
        await approveEndorsement(id ?? "");
        return NextResponse.json({ ok: true });
      case "reject":
        await removeEndorsement(id ?? "", "pending");
        return NextResponse.json({ ok: true });
      case "unpublish":
        await removeEndorsement(id ?? "", "approved");
        return NextResponse.json({ ok: true });
      case "delete-files":
        return NextResponse.json({ ok: true, deleted: await deleteUploads(Array.isArray(pathnames) ? pathnames : []) });
      case "purge-uploads":
        return NextResponse.json({ ok: true, deleted: await purgeUploads() });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

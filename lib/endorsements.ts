import { del, get, list, put } from "@vercel/blob";
import { timingSafeEqual } from "node:crypto";

export const UPLOADS_PREFIX = "uploads/";
const PENDING = "endorsements/pending/";
const APPROVED = "endorsements/approved/";
const MAX_PENDING = 200;

export type Endorsement = {
  id: string;
  name: string;
  role?: string;
  message: string;
  linkedin?: string;
  createdAt: number;
};

export type EndorsementInput = { name?: unknown; role?: unknown; message?: unknown; linkedin?: unknown; website?: unknown };

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function validateEndorsement(input: EndorsementInput): { ok: true; value: Omit<Endorsement, "id" | "createdAt"> } | { ok: false; error: string } {
  if (clean(input.website, 100)) return { ok: false, error: "Rejected." };
  const name = clean(input.name, 60);
  const role = clean(input.role, 80);
  const message = clean(input.message, 300);
  const linkedin = clean(input.linkedin, 200);
  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  if (message.length < 10) return { ok: false, error: "Please write at least a short sentence (10+ characters)." };
  if (linkedin && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[\w\-%]+\/?$/i.test(linkedin)) {
    return { ok: false, error: "LinkedIn link should look like https://www.linkedin.com/in/your-name" };
  }
  return { ok: true, value: { name, message, ...(role && { role }), ...(linkedin && { linkedin }) } };
}

async function listAll(prefix: string) {
  const blobs: { pathname: string; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

async function readJson<T>(pathname: string): Promise<T | null> {
  const res = await get(pathname, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return JSON.parse(await new Response(res.stream).text()) as T;
}

const writeJson = (pathname: string, data: unknown) =>
  put(pathname, JSON.stringify(data), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });

export async function listEndorsements(status: "pending" | "approved"): Promise<Endorsement[]> {
  const blobs = await listAll(status === "pending" ? PENDING : APPROVED);
  const items = await Promise.all(blobs.map((b) => readJson<Endorsement>(b.pathname).catch(() => null)));
  return items.filter((e): e is Endorsement => Boolean(e)).sort((a, b) => b.createdAt - a.createdAt);
}

export async function submitEndorsement(value: Omit<Endorsement, "id" | "createdAt">) {
  const { blobs } = await list({ prefix: PENDING, limit: MAX_PENDING });
  if (blobs.length >= MAX_PENDING) throw new Error("Too many endorsements are waiting for review. Please try again later.");
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await writeJson(`${PENDING}${id}.json`, { ...value, id, createdAt: Date.now() } satisfies Endorsement);
}

const safeId = (id: string) => /^[a-z0-9-]{4,40}$/.test(id);

export async function approveEndorsement(id: string) {
  if (!safeId(id)) throw new Error("Invalid id");
  const item = await readJson<Endorsement>(`${PENDING}${id}.json`);
  if (!item) throw new Error("Endorsement not found");
  await writeJson(`${APPROVED}${id}.json`, item);
  await del(`${PENDING}${id}.json`);
}

export async function removeEndorsement(id: string, status: "pending" | "approved") {
  if (!safeId(id)) throw new Error("Invalid id");
  await del(`${status === "pending" ? PENDING : APPROVED}${id}.json`);
}

/** Deletes every shared photo/file, leaving endorsements untouched. */
export async function purgeUploads() {
  const blobs = (await listAll("")).filter((b) => !b.pathname.startsWith("endorsements/"));
  for (let i = 0; i < blobs.length; i += 100) await del(blobs.slice(i, i + 100).map((b) => b.pathname));
  return blobs.length;
}

export function isAdmin(request: Request) {
  const expected = process.env.ADMIN_KEY;
  const given = request.headers.get("x-admin-key") ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

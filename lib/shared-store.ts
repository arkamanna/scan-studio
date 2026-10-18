/**
 * Tiny Upstash Redis REST client for counters shared by all server instances (free Upstash database, or Vercel's
 * Upstash integration which sets KV_REST_API_*). Every call returns null when Redis isn't configured or doesn't
 * answer, so callers can fall back to per-instance memory.
 */
const URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function pipeline(commands: (string | number)[][]): Promise<unknown[] | null> {
  if (!URL || !TOKEN) return null;
  try {
    const res = await fetch(`${URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: unknown; error?: string }[];
    return data.some((d) => d.error) ? null : data.map((d) => d.result);
  } catch {
    return null;
  }
}

/** Increments a counter that expires after windowMs; returns the new count. */
export async function sharedHit(key: string, windowMs: number): Promise<number | null> {
  const r = await pipeline([["INCR", key], ["PEXPIRE", key, windowMs, "NX"]]);
  return r ? Number(r[0]) : null;
}

/** Marks keys as set for ms milliseconds. */
export async function sharedSet(key: string, ms: number) {
  await pipeline([["SET", key, 1, "PX", Math.max(1, Math.round(ms))]]);
}

/** Which of the keys are currently set. */
export async function sharedHas(keys: string[]): Promise<Set<string> | null> {
  if (!keys.length) return new Set();
  const r = await pipeline([["MGET", ...keys]]);
  if (!r || !Array.isArray(r[0])) return null;
  const values = r[0] as unknown[];
  return new Set(keys.filter((_, i) => values[i] !== null));
}

import { experimental_transcribe as transcribe, generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { sharedHit } from "@/lib/shared-store";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Speech-to-text for browsers without built-in speech recognition (Firefox, Brave…). */

const MAX_BYTES = 8 * 1024 * 1024;
/** Words Whisper should expect, so app terms are spelled the way the agent understands them. */
const VOCABULARY = "QR code, Wi-Fi, SSID, password, barcode, EAN-13, UPC, Code 128, Data Matrix, Aztec, PDF417, GS1, gradient, caption, logo.";

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 30;
const hits = new Map<string, number[]>();
async function limited(ip: string) {
  const now = Date.now();
  const shared = await sharedHit(`ss:stt:rl:${ip}:${Math.floor(now / WINDOW_MS)}`, WINDOW_MS);
  if (shared !== null) return shared > LIMIT;
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT;
}

type Attempt = { name: string; run: (audio: Uint8Array, mediaType: string, signal: AbortSignal) => Promise<string> };

function attempts(): Attempt[] {
  const list: Attempt[] = [];
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    for (const id of ["whisper-large-v3-turbo", "whisper-large-v3"]) {
      list.push({
        name: `groq:${id}`,
        run: async (audio, _type, signal) =>
          (await transcribe({ model: groq.transcription(id), audio, providerOptions: { groq: { prompt: VOCABULARY } }, maxRetries: 0, abortSignal: signal })).text,
      });
    }
  }
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (googleKey) {
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    list.push({
      name: "google",
      run: async (audio, mediaType, signal) =>
        (
          await generateText({
            model: google(process.env.GEMINI_MODELS?.split(",")[0]?.trim() || "gemini-3.1-flash-lite"),
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: `Transcribe this voice note exactly, in the language spoken. Output only the transcript, nothing else. Terms that may appear: ${VOCABULARY}` },
                  { type: "file", data: audio, mediaType },
                ],
              },
            ],
            maxOutputTokens: 600,
            maxRetries: 0,
            abortSignal: signal,
          })
        ).text,
    });
  }
  return list;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (await limited(ip)) return NextResponse.json({ error: "Too many voice messages. Please wait a few minutes." }, { status: 429 });

  let file: File | null = null;
  try {
    const value = (await req.formData()).get("audio");
    file = value instanceof File ? value : null;
  } catch {
    /* handled below */
  }
  if (!file || !file.size) return NextResponse.json({ error: "No audio received." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
  if (!/^audio\//.test(file.type) && !/^video\/webm/.test(file.type)) return NextResponse.json({ error: "Unsupported audio format." }, { status: 415 });

  const audio = new Uint8Array(await file.arrayBuffer());
  const mediaType = file.type.split(";")[0].replace(/^video\//, "audio/");
  const deadline = Date.now() + 25_000;
  for (const a of attempts()) {
    const left = deadline - Date.now();
    if (left < 3000) break;
    try {
      const text = (await a.run(audio, mediaType, AbortSignal.timeout(Math.min(left, 15_000)))).trim();
      return NextResponse.json({ text });
    } catch (e) {
      console.error(`transcribe: ${a.name} failed`, (e as Error)?.message?.slice(0, 300));
    }
  }
  return NextResponse.json({ error: "Voice input is busy right now. Please type your request." }, { status: 503 });
}

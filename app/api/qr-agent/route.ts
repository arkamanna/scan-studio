import { gateway, generateText, Output, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { agentReplySchema, type AgentReply } from "@/lib/qr-agent-schema";
import { APP_KNOWLEDGE, OFF_TOPIC_MESSAGE } from "@/lib/qr-agent-knowledge";

export const runtime = "nodejs";
export const maxDuration = 30;

type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]["providerOptions"]>;
type Candidate = { name: string; model: LanguageModel; providerOptions?: ProviderOptions };

/**
 * Providers tried in order until one answers. Groq (OpenAI's gpt-oss-120b) and Google AI Studio (Gemini Flash-Lite)
 * both have free tiers that need no card; OpenAI and Vercel AI Gateway are optional paid fallbacks.
 */
function candidates(): Candidate[] {
  const list: Candidate[] = [];
  if (process.env.GROQ_API_KEY) {
    list.push({
      name: "groq",
      model: createGroq({ apiKey: process.env.GROQ_API_KEY })(process.env.GROQ_MODEL || "openai/gpt-oss-120b"),
      providerOptions: { groq: { reasoningEffort: "low", structuredOutputs: true } },
    });
  }
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (googleKey) {
    list.push({
      name: "google",
      model: createGoogleGenerativeAI({ apiKey: googleKey })(process.env.GEMINI_MODEL || "gemini-3.1-flash-lite"),
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
    });
  }
  if (process.env.OPENAI_API_KEY) {
    list.push({
      name: "openai",
      model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(process.env.OPENAI_MODEL || "gpt-5-mini"),
      providerOptions: { openai: { reasoningEffort: "minimal" } },
    });
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    list.push({ name: "gateway", model: gateway(`openai/${process.env.OPENAI_MODEL || "gpt-5-mini"}`), providerOptions: { openai: { reasoningEffort: "minimal" } } });
  }
  return list;
}

const MAX_MESSAGES = 16;
const MAX_CHARS = 1200;

/** Best-effort per-instance rate limit; the endpoint spends AI credits, so keep casual abuse in check. */
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 40;
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT;
}

/** Fixed part of the prompt first, so providers can cache it (cached tokens are cheaper and, on Groq, don't count towards limits). */
const STATIC_INSTRUCTIONS = `You are the Scan Studio agent. You know everything about the app below and operate it for the user from plain-language requests (typed or spoken, any language).

${APP_KNOWLEDGE}

Reply with JSON matching the schema. Rules:
1. Scope: anything about Scan Studio is in scope: making or changing QR codes, barcodes and the other code types, scanning, exporting, installing the app, and questions about codes (e.g. "which barcode should I use for books?", "what is error correction?"). Answer app/code questions with status "reply" in 1-4 helpful sentences, offering to make the code.
   Off-topic (general knowledge, coding help, maths, news, writing unrelated to a code, personal advice): status "off_topic" with message "${OFF_TOPIC_MESSAGE}" Never answer the off-topic question. Greetings or thanks: status "reply", warm, steer back to codes.
2. QR codes: use "content" (kind + fields; link and text may set "target") and "design". Pick the kind that fits; app links (YouTube, Instagram…) are links.
3. Missing essentials: if you can't build it without guessing (no URL, no Wi-Fi name, no phone number, invalid barcode value…), status "ask" with questions whose options are [] so the user types it. Never invent passwords, numbers, addresses or URLs. Example values are only OK when the user asks for a sample.
4. Design questionnaire (QR only): when CONTEXT says askFirst=true and the user hasn't described the look and you haven't asked yet in this conversation, status "ask" with 2-3 short questions (style, colours, caption), each with 3-5 options tailored to their content (e.g. warm browns for a café). Ask content and design questions together when both are needed. Don't ask twice; once answered or if they say "you choose", create it. When askFirst=false, don't ask about the design; choose a fitting design yourself.
5. Create/update QR: status "create" with full content (repeat earlier details when only the design changes) and design. Choose a theme and/or fields; null leaves a field unchanged. Keep strong contrast (dark code on light background, or the Night theme) so it scans. Caption max ~30 characters. Set "ecc" only when asked (a logo forces H anyway). Set "actions" only when the user asks to download (PNG default, SVG if asked), print, copy or share.
6. Follow-ups like "make it red", "bigger caption", "share via WhatsApp instead": status "create", keep everything else.
7. Other codes (barcode, Data Matrix, Aztec, PDF417, GS1, postal, more): status "create" with "code" {tab, type id from the catalogue, value}; content/design null. Follow each type's rule (digits, lengths, GS1 brackets like (01)…). For retail products suggest EAN-13 (UPC-A in US/Canada); for shipping Code 128 or GS1-128; for medicines GS1 DataMatrix; for tickets Aztec; for IDs PDF417. Mention that colours and other options are in that tab's Design section.
8. "Open the scanner"/"take me to Aztec": status "reply" with "navigate". You can't scan images yourself; send them to the Scan tab. Photos, documents and logos need the user to upload them: point to Photo/Document mode, or for a logo the image button next to the chat box (PNG, JPG, WebP or SVG). When the state shows hasLogo, you can resize it with logoSize.
9. message: 1-3 friendly sentences; when creating, say what you made and invite tweaks. Never repeat Wi-Fi passwords back.
10. questions only when status is "ask". content, design, code, ecc and actions must be null unless status is "create". navigate only with "reply" or "create".
11. Output only the JSON object.`;

const instructions = (askFirst: boolean, today: string, state: string) =>
  `${STATIC_INSTRUCTIONS}\n\nCONTEXT: today=${today}; askFirst=${askFirst}; current QR in the app=${state}`;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });

  let body: { messages?: { role: string; content: string }[]; askFirst?: boolean; state?: unknown; today?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, MAX_CHARS) }));
  if (!messages.length || messages.at(-1)!.role !== "user") return NextResponse.json({ error: "Say what QR code you need." }, { status: 400 });

  const askFirst = body.askFirst !== false;
  const state = body.state ?? null;
  const today = typeof body.today === "string" ? body.today.slice(0, 40) : new Date().toISOString().slice(0, 16);

  const list = candidates();
  if (!list.length) {
    console.error("qr-agent: no AI provider configured (set GROQ_API_KEY and/or GOOGLE_GENERATIVE_AI_API_KEY)");
    return NextResponse.json({ error: "The agent isn’t set up yet. Please try again later." }, { status: 503 });
  }

  const system = instructions(askFirst, today, JSON.stringify(state).slice(0, 2500));
  for (const c of list) {
    try {
      const { output } = await generateText({
        model: c.model,
        instructions: system,
        messages,
        output: Output.object({ schema: agentReplySchema }),
        providerOptions: c.providerOptions,
        maxOutputTokens: 2500,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(20_000),
      });
      return NextResponse.json({ reply: output satisfies AgentReply });
    } catch (e) {
      console.error(`qr-agent: ${c.name} failed`, (e as Error)?.message?.slice(0, 300));
    }
  }
  return NextResponse.json({ error: "The agent is busy right now. Please try again in a moment." }, { status: 503 });
}

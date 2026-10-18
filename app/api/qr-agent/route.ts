import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { agentReplySchema, type AgentReply } from "@/lib/qr-agent-schema";
import { localAgent, OFF_TOPIC_MESSAGE } from "@/lib/qr-agent-local";
import { APP_KNOWLEDGE } from "@/lib/qr-agent-knowledge";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.QR_AGENT_MODEL || "openai/gpt-4.1-mini";
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

const instructions = (askFirst: boolean, today: string, state: string) => `You are the Scan Studio agent. You know everything about the app below and operate it for the user from plain-language requests (typed or spoken, any language).

${APP_KNOWLEDGE}

Today is ${today}. Current QR in the app: ${state}

Reply with JSON matching the schema. Rules:
1. Scope: anything about Scan Studio is in scope: making or changing QR codes, barcodes and the other code types, scanning, exporting, installing the app, and questions about codes (e.g. "which barcode should I use for books?", "what is error correction?"). Answer app/code questions with status "reply" in 1-4 helpful sentences, offering to make the code.
   Off-topic (general knowledge, coding help, maths, news, writing unrelated to a code, personal advice): status "off_topic" with message "${OFF_TOPIC_MESSAGE}" Never answer the off-topic question. Greetings or thanks: status "reply", warm, steer back to codes.
2. QR codes: use "content" (kind + fields; link and text may set "target") and "design". Pick the kind that fits; app links (YouTube, Instagram…) are links.
3. Missing essentials: if you can't build it without guessing (no URL, no Wi-Fi name, no phone number, invalid barcode value…), status "ask" with questions whose options are [] so the user types it. Never invent passwords, numbers, addresses or URLs. Example values are only OK when the user asks for a sample.
4. Design questionnaire (QR only): ${
  askFirst
    ? `the user wants to be asked first. If they haven't described the look and you haven't asked yet in this conversation, status "ask" with 2-3 short questions (style, colours, caption), each with 3-5 options tailored to their content (e.g. warm browns for a café). Ask content and design questions together when both are needed. Don't ask twice; once answered or if they say "you choose", create it.`
    : "don't ask about the design; choose a fitting design yourself."
}
5. Create/update QR: status "create" with full content (repeat earlier details when only the design changes) and design. Choose a theme and/or fields; null leaves a field unchanged. Keep strong contrast (dark code on light background, or the Night theme) so it scans. Caption max ~30 characters. Set "ecc" only when asked (a logo forces H anyway). Set "actions" only when the user asks to download (PNG default, SVG if asked), print, copy or share.
6. Follow-ups like "make it red", "bigger caption", "share via WhatsApp instead": status "create", keep everything else.
7. Other codes (barcode, Data Matrix, Aztec, PDF417, GS1, postal, more): status "create" with "code" {tab, type id from the catalogue, value}; content/design null. Follow each type's rule (digits, lengths, GS1 brackets like (01)…). For retail products suggest EAN-13 (UPC-A in US/Canada); for shipping Code 128 or GS1-128; for medicines GS1 DataMatrix; for tickets Aztec; for IDs PDF417. Mention that colours and other options are in that tab's Design section.
8. "Open the scanner"/"take me to Aztec": status "reply" with "navigate". You can't scan images yourself; send them to the Scan tab. Photos, documents and logos need the user to upload them: point to Photo/Document mode, or for a logo the image button next to the chat box (PNG, JPG, WebP or SVG). When the state shows hasLogo, you can resize it with logoSize.
9. message: 1-3 friendly sentences; when creating, say what you made and invite tweaks. Never repeat Wi-Fi passwords back.
10. questions only when status is "ask". content, design, code, ecc and actions must be null unless status is "create". navigate only with "reply" or "create".`;

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
  const hasCode = Boolean((state as { content?: unknown } | null)?.content);
  const today = typeof body.today === "string" ? body.today.slice(0, 40) : new Date().toISOString().slice(0, 16);

  try {
    const { output } = await generateText({
      model: MODEL,
      instructions: instructions(askFirst, today, JSON.stringify(state).slice(0, 2500)),
      messages,
      output: Output.object({ schema: agentReplySchema }),
      maxOutputTokens: 1200,
      abortSignal: AbortSignal.timeout(25_000),
    });
    return NextResponse.json({ reply: output satisfies AgentReply, mode: "ai" });
  } catch (e) {
    console.error("qr-agent: AI call failed, using the basic agent", (e as Error)?.message);
    return NextResponse.json({ reply: localAgent(messages, askFirst, hasCode), mode: "basic" });
  }
}

import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { agentReplySchema, type AgentReply } from "@/lib/qr-agent-schema";
import { localAgent, OFF_TOPIC_MESSAGE } from "@/lib/qr-agent-local";

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

const instructions = (askFirst: boolean, today: string, state: string) => `You are the QR code agent inside Scan Studio, a web app that creates QR codes.
Your ONLY job is to turn the user's request (typed or spoken, any language) into a QR code: what it does when scanned, and how it looks.

Today is ${today}. Current QR in the app: ${state}

Reply with JSON matching the schema. Rules:
1. Off-topic: if the message is not about creating, changing or understanding a QR code for this app (e.g. general knowledge, coding help, maths, chit-chat unrelated to the code), set status "off_topic" and message to: "${OFF_TOPIC_MESSAGE}" Never answer the off-topic question itself. Brief greetings or thanks are fine: reply warmly with status "reply" and steer back to QR codes.
2. Content kinds: link (any URL; app links like YouTube or Instagram are links), text, wifi, contact (vCard), email, phone (call), sms, whatsapp, location, event. Pick the one that fits.
3. Missing essentials: if you can't build the content without guessing (no URL, no Wi-Fi network name, no phone number…), status "ask" with questions whose options are [] so the user types the answer. Never invent passwords, numbers, addresses or URLs.
4. Design questionnaire: ${
  askFirst
    ? `the user wants to be asked about the design first. If they haven't described the look and you haven't asked yet in this conversation, status "ask" with 2-3 short questions about style, colours and caption, each with 3-5 short options tailored to their content (e.g. warm brown colours for a café). Ask content and design questions together when both are needed. Don't ask twice: once answered, or if they say "you choose", create it.`
    : "don't ask about the design; choose a fitting design yourself."
}
5. Create: status "create" with the full content (repeat earlier details when only the design changes) and design. Themes: Classic (black squares), Night (white on black, dots), Aurora (purple→cyan gradient, rounded), Sunset (pink→orange radial, stars), Forest (green leaves), Love (red hearts). Pick a theme and/or set fields; null leaves a field unchanged. Keep strong contrast (dark code on a light background, or Night) so it scans. The caption must be short (max ~30 characters).
6. Follow-ups like "make it red" or "add the text Scan me": status "create", keep the content, change only what was asked.
7. message: 1-3 friendly sentences. When creating, say briefly what you made and invite tweaks. Don't repeat Wi-Fi passwords back.
8. questions must be null unless status is "ask". content and design must be null when status is "ask", "off_topic" or "reply".`;

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
      instructions: instructions(askFirst, today, JSON.stringify(state).slice(0, 2000)),
      messages,
      output: Output.object({ schema: agentReplySchema }),
      maxOutputTokens: 900,
      abortSignal: AbortSignal.timeout(25_000),
    });
    return NextResponse.json({ reply: output satisfies AgentReply, mode: "ai" });
  } catch (e) {
    console.error("qr-agent: AI call failed, using the basic agent", (e as Error)?.message);
    return NextResponse.json({ reply: localAgent(messages, askFirst, hasCode), mode: "basic" });
  }
}

import { APICallError, gateway, generateText, Output, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { agentReplySchema, type AgentReply } from "@/lib/qr-agent-schema";
import { APP_KNOWLEDGE, OFF_TOPIC_MESSAGE } from "@/lib/qr-agent-knowledge";
import { localAgent } from "@/lib/qr-agent-local";
import { codeProblem } from "@/lib/code-validate";
import { redactSecrets } from "@/lib/redact";
import { sharedHas, sharedHit, sharedSet } from "@/lib/shared-store";

export const runtime = "nodejs";
export const maxDuration = 30;

type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]["providerOptions"]>;
type Candidate = { name: string; model: LanguageModel; providerOptions?: ProviderOptions; maxOutputTokens?: number };

/** Groq's free tier counts the reserved output budget towards its tokens-per-minute limit, so keep it close to a real reply. */
const GROQ_MAX_OUTPUT = 1200;

/** Comma-separated model list from an env var, or the defaults. */
const models = (env: string | undefined, fallback: string[]) => (env ? env.split(",").map((m) => m.trim()).filter(Boolean) : fallback);

/**
 * Providers tried in order until one answers. Groq (OpenAI's gpt-oss) and Google AI Studio (Gemini Flash-Lite) have
 * free tiers that need no card, with separate limits per model, so the two services take turns across their models.
 * OpenAI and Vercel AI Gateway are optional paid fallbacks.
 */
function candidates(): Candidate[] {
  const groqList: Candidate[] = [];
  const googleList: Candidate[] = [];
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    for (const id of models(process.env.GROQ_MODELS, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"])) {
      groqList.push({ name: `groq:${id}`, model: groq(id), providerOptions: { groq: { reasoningEffort: "low", structuredOutputs: true } }, maxOutputTokens: GROQ_MAX_OUTPUT });
    }
  }
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (googleKey) {
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    for (const id of models(process.env.GEMINI_MODELS, ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"])) {
      googleList.push({ name: `google:${id}`, model: google(id), providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } } });
    }
  }
  const list: Candidate[] = [];
  for (let i = 0; i < Math.max(groqList.length, googleList.length); i++) {
    if (groqList[i]) list.push(groqList[i]);
    if (googleList[i]) list.push(googleList[i]);
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

/**
 * Models that answered 429 are skipped until their limit resets, so users don't wait on a model that is out of tokens.
 * Kept in memory and, when Upstash Redis is configured, shared across server instances.
 */
const cooldown = new Map<string, number>();
const cooldownKey = (name: string) => `ss:agent:cooldown:${name}`;

async function available(all: Candidate[]) {
  const now = Date.now();
  const shared = await sharedHas(all.map((c) => cooldownKey(c.name)));
  return all.filter((c) => (cooldown.get(c.name) ?? 0) <= now && !shared?.has(cooldownKey(c.name)));
}

function coolDown(name: string, seconds: number) {
  const ms = Math.min(Math.max(seconds, 5), 3600) * 1000;
  cooldown.set(name, Date.now() + ms);
  return sharedSet(cooldownKey(name), ms);
}
const MAX_MESSAGES = 16;
const MAX_CHARS = 1200;

/** Per-IP rate limit so one visitor can't use up the shared free quota: Redis when configured, else per-instance memory. */
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 40;
const hits = new Map<string, number[]>();
async function limited(ip: string) {
  const now = Date.now();
  const shared = await sharedHit(`ss:agent:rl:${ip}:${Math.floor(now / WINDOW_MS)}`, WINDOW_MS);
  if (shared !== null) return shared > LIMIT;
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT;
}

const ECC_WORDS =
  /error|correction|ecc|damage|robust|durab|level\s*[lmqh]\b|\b[lmqh]\s*level|त्रुटि|এরর|corrección|correction|fehlerkorrektur|correção/i;
const ACTION_WORDS =
  /download|save|export|print|copy|share|\b(png|svg)\b|डाउनलोड|सेव|प्रिंट|शेयर|ডাউনলোড|সেভ|প্রিন্ট|শেয়ার|descarg|guardar|imprim|copiar|compartir|télécharg|enregistr|copier|partager|herunterlad|speicher|druck|kopier|teilen|baixar|salvar|compartilh/i;
const PLACEHOLDER_CAPTION = /^\W*(you choose|your choice|up to you|you decide|no preference|pick something|anything|none|n\/a)\b/i;

/**
 * Keeps the AI to what the user actually asked for: error correction and downloads/prints only when requested
 * in the latest message, and never a "you choose"-style answer used as the caption text.
 */
function tidy(reply: AgentReply, lastUser: string): AgentReply {
  const out = { ...reply };
  if (out.ecc && !ECC_WORDS.test(lastUser)) out.ecc = null;
  if (out.actions?.length && !ACTION_WORDS.test(lastUser)) out.actions = null;
  if (out.design?.caption && PLACEHOLDER_CAPTION.test(out.design.caption)) out.design = { ...out.design, caption: null };
  return out;
}

/** Turns a non-QR code with a value its tab can't render into a question, so the user isn't sent to a broken code. */
function checkCode(reply: AgentReply): AgentReply {
  if (reply.status !== "create" || !reply.code) return reply;
  const problem = codeProblem(reply.code);
  if (!problem) return reply;
  return {
    ...reply,
    status: "ask",
    message: `${problem} What value should I use?`,
    questions: [{ question: "Value", options: [] }],
    content: null,
    design: null,
    ecc: null,
    actions: null,
    code: null,
    navigate: null,
  };
}

/** Fixed part of the prompt first, so providers can cache it (cached tokens are cheaper and, on Groq, don't count towards limits). */
const STATIC_INSTRUCTIONS = `You are the Scan Studio agent. You know everything about the app below and operate it for the user from plain-language requests (typed or spoken, any language).

${APP_KNOWLEDGE}

Reply with JSON matching the schema. Rules:
1. Scope: anything about Scan Studio is in scope: making or changing QR codes, barcodes and the other code types, scanning, exporting, installing the app, and questions about codes (e.g. "which barcode should I use for books?", "what is error correction?"). Answer app/code questions with status "reply" in 1-4 helpful sentences, offering to make the code.
   Off-topic (general knowledge, coding help, maths, news, writing unrelated to a code, personal advice): status "off_topic" with message "${OFF_TOPIC_MESSAGE}" Never answer the off-topic question. Greetings or thanks: status "reply", warm, steer back to codes.
2. QR codes: use "content" (kind + fields; link and text may set "target") and "design". Pick the kind that fits; app links (YouTube, Instagram…) are links.
3. Missing essentials: if you can't build it without guessing (no URL, no Wi-Fi name, no phone number, invalid barcode value…), status "ask" with questions whose options are [] so the user types it. Never invent passwords, numbers, addresses or URLs. Example values are only OK when the user asks for a sample.
4. Design questionnaire (QR only): answers like "no preference", "you choose" or "up to you" mean you pick a fitting value yourself; never put those words into the caption or any other field. When CONTEXT says askFirst=true and the user hasn't described the look and you haven't asked yet in this conversation, status "ask" with 2-3 short questions (style, colours, caption), each with 3-5 options tailored to their content (e.g. warm browns for a café). Ask content and design questions together when both are needed. Don't ask twice; once answered or if they say "you choose", create it. When askFirst=false, don't ask about the design; choose a fitting design yourself.
5. Create/update QR: status "create" with full content (repeat earlier details when only the design changes) and design. Choose a theme and/or fields; null leaves a field unchanged. Keep strong contrast (dark code on light background, or the Night theme) so it scans. Caption max ~30 characters. Set "ecc" only when the user asks about error correction (a logo already forces H automatically, so never set it for a logo). Set "actions" only when the user asks to download (PNG default, SVG if asked), print, copy or share.
6. Follow-ups like "make it red", "bigger caption", "share via WhatsApp instead": status "create", keep everything else.
7. Other codes (barcode, Data Matrix, Aztec, PDF417, GS1, postal, more): status "create" with "code" {tab, type id from the catalogue, value}; content/design null. Use the type's real format (EAN/UPC digits with a valid check digit, GS1 Application Identifiers in brackets like (01)09521234543213, postal digit counts); the app checks the value and asks again if it doesn't fit. For retail products suggest EAN-13 (UPC-A in US/Canada); for shipping Code 128 or GS1-128; for medicines GS1 DataMatrix; for tickets Aztec; for IDs PDF417. Mention that colours and other options are in that tab's Design section.
8. "Open the scanner"/"take me to Aztec": status "reply" with "navigate". You can't scan images yourself; send them to the Scan tab. Photos, documents and logos need the user to upload them: point to Photo/Document mode, or for a logo the image button next to the chat box (PNG, JPG, WebP or SVG). When the state shows hasLogo, you can resize it with logoSize.
9. message: 1-3 friendly sentences; when creating, say what you made and invite tweaks. Never repeat Wi-Fi passwords back. Placeholders like [[SECRET_1]] are passwords hidden for privacy: copy them exactly into the password field.
10. questions only when status is "ask". content, design, code, ecc and actions must be null unless status is "create". navigate only with "reply" or "create".
11. Output only the JSON object.`;

const instructions = (askFirst: boolean, today: string, state: string) =>
  `${STATIC_INSTRUCTIONS}\n\nCONTEXT: today=${today}; askFirst=${askFirst}; current QR in the app=${state}`;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (await limited(ip)) return NextResponse.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });

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

  const hasCode = Boolean((state as { content?: unknown } | null)?.content);
  const all = candidates();
  const list = await available(all);
  const system = instructions(askFirst, today, JSON.stringify(state).slice(0, 2500));
  const deadline = Date.now() + 25_000;
  let outOfTokens = all.length > list.length;
  const secret = redactSecrets(messages);

  for (const c of list) {
    const left = deadline - Date.now();
    if (left < 3000) break;
    try {
      const { output } = await generateText({
        model: c.model,
        instructions: system,
        messages: secret.messages,
        output: Output.object({ schema: agentReplySchema }),
        providerOptions: c.providerOptions,
        maxOutputTokens: c.maxOutputTokens ?? 2500,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(Math.min(left, 18_000)),
      });
      return NextResponse.json({ reply: checkCode(tidy(secret.restore(output satisfies AgentReply), messages.at(-1)!.content)), mode: "ai", provider: c.name });
    } catch (e) {
      const cause = (e as { cause?: unknown })?.cause;
      const api = APICallError.isInstance(e) ? e : APICallError.isInstance(cause) ? cause : null;
      const message = (e as Error)?.message ?? "";
      const status = api?.statusCode;
      if (status === 429 || /quota|rate.?limit|exhausted|tokens per/i.test(message)) {
        outOfTokens = true;
        const retryAfter = Number(api?.responseHeaders?.["retry-after"]) || Number(message.match(/try again in ([\d.]+)s/i)?.[1]);
        await coolDown(c.name, retryAfter > 0 ? retryAfter : 60);
      }
      console.error(`qr-agent: ${c.name} failed`, status ?? "", message.slice(0, 300));
    }
  }

  const notice = outOfTokens
    ? "The Groq and Google AI services have run out of free tokens for now, so the basic agent is answering. It handles simple requests; the full AI comes back automatically once the limits reset."
    : "The Groq and Google AI services aren’t responding right now, so the basic agent is answering. It handles simple requests; the full AI comes back automatically.";
  return NextResponse.json({ reply: checkCode(localAgent(messages, askFirst, hasCode)), mode: "basic", notice });
}

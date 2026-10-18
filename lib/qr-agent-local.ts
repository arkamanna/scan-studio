import type { AgentContent, AgentDesign, AgentReply } from "./qr-agent-schema";
import { THEME_NAMES } from "./qr-agent-schema";

/** Rule-based stand-in for the AI agent, used when the AI service isn't reachable. */

export const OFF_TOPIC_MESSAGE =
  "I’m the QR code agent, so I can only help create and design QR codes. Tell me what the code should do (a link, Wi‑Fi, contact, message…) and how it should look.";

export const DESIGN_QUESTIONS: NonNullable<AgentReply["questions"]> = [
  { question: "Which style do you like?", options: ["Classic", "Aurora (gradient, rounded)", "Night (dark)", "Sunset", "Forest", "Love (hearts)"] },
  { question: "Main colour?", options: ["Black", "Purple", "Blue", "Green", "Red", "Use the style’s colours"] },
  { question: "Text under the code?", options: ["No text", "Scan me", "Scan to connect"] },
];

const COLORS: Record<string, string> = {
  black: "#0f172a", white: "#ffffff", grey: "#475569", gray: "#475569", red: "#dc2626", maroon: "#7f1d1d", orange: "#ea580c",
  amber: "#d97706", yellow: "#ca8a04", gold: "#b45309", brown: "#78350f", green: "#15803d", teal: "#0f766e", cyan: "#0891b2",
  blue: "#1d4ed8", navy: "#1e3a8a", indigo: "#4338ca", purple: "#7c3aed", violet: "#7c3aed", pink: "#db2777", magenta: "#c026d3",
};

const QR_WORDS = /\b(qr|code|scan|design|colou?r|style|theme|dots?|gradient|logo|caption|link|url|website|wi-?fi|wifi|network|contact|vcard|email|mail|call|phone|sms|whatsapp|location|map|event|calendar|make|create|generate|black|purple|blue|green|red|dark|rounded|heart|star)\b/i;

const pick = (re: RegExp, text: string) => text.match(re)?.[1]?.trim() ?? null;

function emptyContent(kind: AgentContent["kind"]): AgentContent {
  return {
    kind, url: null, text: null, ssid: null, password: null, security: null, hidden: null, firstName: null, lastName: null, org: null,
    jobTitle: null, phone: null, email: null, website: null, address: null, subject: null, body: null, message: null, place: null,
    mapApp: null, eventTitle: null, start: null, end: null, location: null, description: null,
  };
}

function parseContent(t: string): AgentContent | "missing-wifi" | null {
  const phone = pick(/(\+?\d[\d\s-]{7,}\d)/, t);
  const email = pick(/([\w.+-]+@[\w-]+\.[\w.-]+)/, t);
  const url = pick(/((?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s"']*)?)/i, t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ""));
  const quoted = pick(/["“']([^"”']{1,300})["”']/, t);

  if (/\bwi-?fi\b|\bnetwork\b|\bssid\b/i.test(t)) {
    const ssid = pick(/(?:network|ssid|wi-?fi)(?:\s+name)?\s*(?:is|called|named|:|=)?\s*["“']?([^\s"”',]+)/i, t);
    if (!ssid || /^(qr|code|password|for|with|and)$/i.test(ssid)) return "missing-wifi";
    const c = emptyContent("wifi");
    c.ssid = ssid;
    c.password = pick(/(?:password|passcode|pass|pwd|key)\s*(?:is|:|=)?\s*["“']?([^\s"”',]+)/i, t);
    c.security = c.password ? "WPA" : /open|no password/i.test(t) ? "nopass" : null;
    return c;
  }
  if (phone && /whats\s?app/i.test(t)) return { ...emptyContent("whatsapp"), phone, message: quoted };
  if (phone && /\b(sms|text message|message)\b/i.test(t)) return { ...emptyContent("sms"), phone, message: quoted };
  if (email && !/contact|vcard|card/i.test(t)) return { ...emptyContent("email"), email, subject: pick(/subject\s*["“']([^"”']+)["”']/i, t) };
  if (/contact|vcard|business card/i.test(t)) {
    const name = pick(/(?:for|name(?:d| is)?)\s+([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)/, t);
    if (name || email || phone) {
      const [first, ...rest] = (name ?? "").split(/\s+/);
      return { ...emptyContent("contact"), firstName: first || null, lastName: rest.join(" ") || null, phone, email, website: url };
    }
  }
  if (phone && /\bcall|phone|dial/i.test(t)) return { ...emptyContent("phone"), phone };
  const place = pick(/(?:location of|directions to|map (?:to|of|for)|location[: ]+)\s*["“']?([^"”'.]+)/i, t);
  if (place) return { ...emptyContent("location"), place, mapApp: /apple/i.test(t) ? "apple" : "google" };
  if (url) return { ...emptyContent("link"), url };
  if (quoted && /\btext\b|\bmessage\b|\bsays?\b|\bnote\b/i.test(t) && !/caption|under/i.test(t)) return { ...emptyContent("text"), text: quoted };
  return null;
}

function parseDesign(t: string): AgentDesign | null {
  const d: AgentDesign = {
    theme: null, dots: null, frame: null, ball: null, fillType: null, color: null, color2: null, angle: null, eyeColor: null,
    background: null, transparent: null, caption: null, captionColor: null,
  };
  let touched = false;
  const set = <K extends keyof AgentDesign>(k: K, v: AgentDesign[K]) => {
    d[k] = v;
    touched = true;
  };
  const theme = THEME_NAMES.find((n) => new RegExp(`\\b${n}\\b`, "i").test(t));
  if (theme) set("theme", theme);
  else if (/\bdark\b|black background/i.test(t)) set("theme", "Night");

  const dots: [RegExp, AgentDesign["dots"]][] = [[/heart/i, "heart"], [/star/i, "star"], [/leaf/i, "leaf"], [/diamond/i, "diamond"], [/plus|cross/i, "plus"], [/round(ed)?\b/i, "rounded"], [/\bdots?\b|circle|circular/i, "dots"], [/square/i, "square"]];
  const shape = dots.find(([re]) => re.test(t));
  if (shape) {
    set("dots", shape[1]);
    if (shape[1] === "rounded" || shape[1] === "dots") (set("frame", "rounded"), set("ball", "circle"));
  }

  const named = Object.keys(COLORS).filter((c) => new RegExp(`\\b${c}\\b`, "i").test(t) && !new RegExp(`${c}\\s+background`, "i").test(t));
  const hexes = t.match(/#[0-9a-f]{6}\b/gi) ?? [];
  const colors = [...hexes, ...named.map((c) => COLORS[c])].filter((c) => c !== "#ffffff");
  if (colors[0] && !/style.s colours/i.test(t)) set("color", colors[0]);
  if (/gradient/i.test(t) || colors.length > 1) {
    set("fillType", /radial/i.test(t) ? "radial" : "linear");
    set("color2", colors[1] ?? "#06b6d4");
    set("angle", 45);
  } else if (colors[0]) set("fillType", "solid");
  const bg = pick(/(\w+)\s+background/i, t)?.toLowerCase();
  if (bg && COLORS[bg]) set("background", COLORS[bg]);
  if (/transparent/i.test(t)) set("transparent", true);

  const caption = pick(/(?:caption|text under(?: the code)?|label|saying|says)\s*(?:is|:|of)?\s*["“']([^"”']{1,60})["”']/i, t) ?? (/scan to connect/i.test(t) ? "Scan to connect" : /scan me/i.test(t) ? "Scan me" : null);
  if (caption) set("caption", caption);
  if (/no text/i.test(t)) set("caption", "");
  return touched ? d : null;
}

export function localAgent(messages: { role: string; content: string }[], askFirst: boolean, hasCode: boolean): AgentReply {
  const users = messages.filter((m) => m.role === "user").map((m) => m.content);
  const last = users.at(-1) ?? "";
  const all = users.join("\n");
  const asked = messages.some((m) => m.role === "assistant" && /style do you like/i.test(m.content));

  const content = parseContent(all);
  const design = parseDesign(last) ?? (asked ? null : parseDesign(all));

  if (!QR_WORDS.test(last) && !content && !design && !asked) {
    return { status: "off_topic", message: OFF_TOPIC_MESSAGE, questions: null, content: null, design: null };
  }
  if (content === "missing-wifi") {
    return { status: "ask", message: "Happy to make a Wi‑Fi QR code. I just need the network details.", questions: [{ question: "Network name (SSID)?", options: [] }, { question: "Password? (say “open” if there isn’t one)", options: [] }], content: null, design: null };
  }
  if (!content && !hasCode) {
    return {
      status: "ask",
      message: "What should the QR code do when someone scans it?",
      questions: [{ question: "Pick one, then add the details (link, network name, phone…)", options: ["Open a website", "Join Wi‑Fi", "Save a contact", "Start a WhatsApp chat", "Show a location"] }],
      content: null,
      design: null,
    };
  }
  if (askFirst && !design && !asked) {
    return { status: "ask", message: "Got it. A few quick choices about the look:", questions: DESIGN_QUESTIONS, content: null, design: null };
  }
  return {
    status: "create",
    message: content ? "Here’s your QR code. Ask for any changes, like “rounded dots” or “purple gradient”." : "Updated the design.",
    questions: null,
    content: content || null,
    design,
  };
}

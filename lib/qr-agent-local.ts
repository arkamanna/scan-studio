import type { AgentContent, AgentDesign, AgentReply } from "./qr-agent-schema";
import { THEME_NAMES } from "./qr-agent-schema";

/** Rule-based stand-in for the AI agent, used when the AI service isn't reachable. */

export const OFF_TOPIC_MESSAGE =
  "Sorry, I can only help with QR codes and the other codes in Scan Studio, so I can’t answer that. Tell me what your code should do (a link, Wi‑Fi, contact, barcode…) and how it should look.";

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
    kind, target: null, url: null, text: null, ssid: null, password: null, security: null, hidden: null, firstName: null, lastName: null, org: null,
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
  if (url) {
    const via = pick(/(?:share|send)\s+(?:it\s+)?(?:via|on|through|by)\s+(whatsapp|sms|email|telegram)/i, t)?.toLowerCase() ?? null;
    return { ...emptyContent("link"), url, target: via };
  }
  if (quoted && /\btext\b|\bmessage\b|\bsays?\b|\bnote\b/i.test(t) && !/caption|under/i.test(t)) return { ...emptyContent("text"), text: quoted };
  return null;
}

function parseDesign(t: string): AgentDesign | null {
  const d: AgentDesign = {
    theme: null, dots: null, frame: null, ball: null, fillType: null, color: null, color2: null, angle: null, eyeColor: null,
    background: null, transparent: null, caption: null, captionColor: null, captionSize: null, logoSize: null, logoClear: null,
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

type Reply = AgentReply;
const reply = (r: Partial<Reply> & Pick<Reply, "status" | "message">): Reply => ({
  questions: null, content: null, design: null, ecc: null, actions: null, code: null, navigate: null, ...r,
});

const TAB_WORDS: [RegExp, NonNullable<Reply["navigate"]>][] = [
  [/scan(ner)?|camera|read a code/i, "scan"], [/data ?matrix/i, "datamatrix"], [/aztec/i, "aztec"], [/pdf ?417/i, "pdf417"],
  [/\bgs1\b|databar|sscc/i, "gs1"], [/postal|usps|royal mail|postnet/i, "postal"], [/\bbarcode/i, "barcode"], [/\bqr\b/i, "qr"],
];

/** Non-QR codes: keyword → [tab, type id]. */
const CODE_WORDS: [RegExp, NonNullable<Reply["code"]>["tab"], string][] = [
  [/gs1 ?data ?matrix/i, "datamatrix", "gs1datamatrix"], [/data ?matrix/i, "datamatrix", "datamatrix"], [/aztec/i, "aztec", "azteccode"],
  [/micro ?pdf/i, "pdf417", "micropdf417"], [/pdf ?417/i, "pdf417", "pdf417"], [/gs1[- ]?128/i, "gs1", "gs1-128"], [/sscc/i, "gs1", "sscc18"],
  [/databar/i, "gs1", "databaromni"], [/micro ?qr/i, "more", "microqrcode"], [/maxicode/i, "more", "maxicode"], [/ean[- ]?13|isbn/i, "barcode", "EAN13"],
  [/ean[- ]?8/i, "barcode", "EAN8"], [/upc/i, "barcode", "UPC"], [/itf[- ]?14/i, "barcode", "ITF14"], [/code ?39/i, "barcode", "CODE39"],
  [/code ?93/i, "barcode", "CODE93"], [/codabar/i, "barcode", "codabar"], [/pharmacode/i, "barcode", "pharmacode"], [/msi/i, "barcode", "MSI"],
  [/code ?128|\bbarcode\b/i, "barcode", "CODE128"],
];

const HELP =
  "I can build QR codes for links, text, Wi‑Fi, contacts, WhatsApp, email, calls, SMS, locations and events, and style them (themes, dot shapes, gradients, captions). I can also fill in barcodes (EAN-13, UPC, Code 128…), Data Matrix, Aztec, PDF417, GS1 and postal codes, open the scanner, and download or print your QR. Just tell me what you need.";

export function localAgent(messages: { role: string; content: string }[], askFirst: boolean, hasCode: boolean): AgentReply {
  const users = messages.filter((m) => m.role === "user").map((m) => m.content);
  const last = users.at(-1) ?? "";
  const all = users.join("\n");
  const asked = messages.some((m) => m.role === "assistant" && /style do you like/i.test(m.content));

  if (/what can you do|\bhelp\b|how does (this|the app) work|what is this app/i.test(last)) return reply({ status: "reply", message: HELP });

  const go = /\b(open|go to|take me to|show me|switch to)\b/i.test(last) && TAB_WORDS.find(([re]) => re.test(last));
  if (go && !/\b(make|create|generate)\b/i.test(last)) return reply({ status: "reply", message: "Opening it for you.", navigate: go[1] });

  const codeWord = !/\bqr\b/i.test(last) || /micro ?qr/i.test(last) ? CODE_WORDS.find(([re]) => re.test(last)) : undefined;
  if (codeWord) {
    const value = pick(/["“']([^"”']+)["”']/, last) ?? pick(/(?:for|with|value|of|number|is)\s+([(\w][\w()\-./ ]*\w)/i, last) ?? pick(/(\d{4,})/, last);
    if (!value) return reply({ status: "ask", message: "Sure. What value should it encode?", questions: [{ question: "Value", options: [] }] });
    return reply({ status: "create", message: "Done. I opened that tab with your value; colours and options are in its Design section.", code: { tab: codeWord[1], type: codeWord[2], value } });
  }

  const content = parseContent(all);
  const design = parseDesign(last) ?? (asked ? null : parseDesign(all));
  const actions: NonNullable<Reply["actions"]> = [];
  if (/\b(download|save)\b/i.test(last)) actions.push(/\bsvg\b/i.test(last) ? "download_svg" : "download_png");
  if (/\bprint\b/i.test(last)) actions.push("print");
  const eccLetter = pick(/error correction\s*(?:level\s*)?([LMQH])\b/i, last)?.toUpperCase() as Reply["ecc"] | undefined;
  const ecc = eccLetter ?? (/(high|max(imum)?|strong) error correction/i.test(last) ? "H" : null);

  if (!QR_WORDS.test(last) && !content && !design && !asked && !actions.length && !ecc) {
    return reply({ status: "off_topic", message: OFF_TOPIC_MESSAGE });
  }
  if (content === "missing-wifi") {
    return reply({ status: "ask", message: "Happy to make a Wi‑Fi QR code. I just need the network details.", questions: [{ question: "Network name (SSID)?", options: [] }, { question: "Password? (say “open” if there isn’t one)", options: [] }] });
  }
  if (!content && !hasCode) {
    return reply({
      status: "ask",
      message: "What should the QR code do when someone scans it?",
      questions: [{ question: "Pick one, then add the details (link, network name, phone…)", options: ["Open a website", "Join Wi‑Fi", "Save a contact", "Start a WhatsApp chat", "Show a location"] }],
    });
  }
  if (askFirst && content && !design && !asked && !actions.length) {
    return reply({ status: "ask", message: "Got it. A few quick choices about the look:", questions: DESIGN_QUESTIONS });
  }
  return reply({
    status: "create",
    message: content ? "Here’s your QR code. Ask for any changes, like “rounded dots” or “purple gradient”." : actions.length ? "On it." : "Updated.",
    content: content || null,
    design,
    ecc,
    actions: actions.length ? actions : null,
  });
}

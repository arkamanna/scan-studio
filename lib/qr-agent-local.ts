import type { AgentContent, AgentDesign, AgentReply } from "./qr-agent-schema";
import { THEME_NAMES } from "./qr-agent-schema";
import { OFF_TOPIC_MESSAGE } from "./qr-agent-knowledge";

/** Rule-based stand-in for the AI agent, used when Groq and Google are out of tokens or unreachable. */

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

/**
 * Common words in Hindi, Bengali, Spanish, French, German and Portuguese mapped to the English keywords this agent
 * understands. Words are swapped in place, so "पासवर्ड abc123" still reads as "password abc123".
 */
const TRANSLATIONS: [string, string][] = [
  ["बारकोड|বারকোড|código de barras|code-barres|strichcode", "barcode"],
  ["क्यूआर|कोड|কিউআর|কোড|código|code qr", "qr code"],
  ["बनाओ|बनाएं|बनाइए|बना दो|बनाना|তৈরি করো|তৈরি|বানাও|crear|crea|créer|crée|erstelle|erstellen|criar|crie|gerar|gere|genera|générer", "create"],
  ["वाई-?फाई|वाईफाई|ওয়াইফাই|wlan", "wifi"],
  ["नेटवर्क|নেটওয়ার্ক|réseau|netzwerk|rede", "network"],
  ["पासवर्ड|পাসওয়ার্ড|contraseña|clave|mot de passe|passwort|kennwort|senha", "password"],
  ["वेबसाइट|ওয়েবসাইট|sitio web|site web|webseite|página web", "website"],
  ["संपर्क|যোগাযোগ|contacto|contato|kontakt", "contact"],
  ["फ़ोन|फोन|কল|ফোন|teléfono|téléphone|telefon|telefone|llamar|appeler|anrufen|ligar", "call"],
  ["ईमेल|ইমেল|correo|courriel", "email"],
  ["लोकेशन|स्थान|অবস্থান|ubicación|localisation|standort|localização", "location of"],
  ["डाउनलोड|ডাউনলোড|descargar|télécharger|herunterladen|baixar", "download"],
  ["प्रिंट|প্রিন্ট|imprimir|imprimer|drucken", "print"],
  ["स्कैनर|स्कैन|স্ক্যানার|স্ক্যান|escáner|escanear|scannen", "scanner"],
  ["ग्रेडिएंट|গ্রেডিয়েন্ট|degradado|dégradé|farbverlauf|verlauf|gradiente", "gradient"],
  ["दिल|হার্ট|corazones|corazón|cœurs|cœur|herzen|herz|corações|coração", "heart"],
  ["गोल|গোল|redondeado|redondos|arrondi|abgerundet|arredondado", "rounded"],
  ["हरा|हरे|हरी|সবুজ|verde|vert|grün", "green"],
  ["लाल|লাল|rojo|rouge|vermelho", "red"],
  ["नीला|नीले|नीली|নীল|azul|bleu|blau", "blue"],
  ["काला|काले|काली|কালো|negro|noir|schwarz|preto", "black"],
  ["बैंगनी|জামরঙা|বেগুনি|morado|violeta|lila|roxo", "purple"],
  ["गुलाबी|গোলাপি|rosa", "pink"],
  ["पीला|पीले|হলুদ|amarillo|jaune|gelb|amarelo", "yellow"],
  ["नारंगी|কমলা|naranja", "orange"],
  ["भूरा|भूरे|বাদামি|marrón|marron|braun|marrom", "brown"],
];
const TRANSLATION_RES = TRANSLATIONS.map(([words, en]) => [new RegExp(`(?<![\\p{L}\\p{M}])(?:${words})(?![\\p{L}\\p{M}])`, "giu"), ` ${en} `] as const);
const toEnglish = (text: string) => TRANSLATION_RES.reduce((t, [re, en]) => t.replace(re, en), text).replace(/ {2,}/g, " ");

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
    const after = /(?:network|ssid|wi-?fi)(?:\s+name\b)?\s*(?:is|called|named|:|=)?\s*["“']?([^\s"”',]+)/iy;
    const ssid = [...t.matchAll(/network|ssid|wi-?fi/gi)]
      .map((m) => ((after.lastIndex = m.index), after.exec(t)?.[1]))
      .find((v) => v && !/^(qr|code|password|for|with|and|network|name|ssid|wi-?fi|is)$/i.test(v));
    if (!ssid) return "missing-wifi";
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

/** The code tab the user is chatting in, when it isn't the QR tab. */
export type CodeContext = { tab: string; type: string; value: string | null };

export function localAgent(messages: { role: string; content: string }[], askFirst: boolean, hasCode: boolean, context: CodeContext | null = null): AgentReply {
  const users = messages.filter((m) => m.role === "user").map((m) => toEnglish(m.content));
  const last = users.at(-1) ?? "";
  const all = users.join("\n");
  const asked = messages.some((m) => m.role === "assistant" && /style do you like/i.test(m.content));

  if (/what can you do|\bhelp\b|how does (this|the app) work|what is this app/i.test(last)) return reply({ status: "reply", message: HELP });

  const actions: NonNullable<Reply["actions"]> = [];
  if (/\b(download|save)\b/i.test(last)) actions.push(/\bsvg\b/i.test(last) ? "download_svg" : "download_png");
  if (/\bprint\b/i.test(last)) actions.push("print");
  const go = /\b(open|go to|take me to|show me|switch to)\b/i.test(last) && TAB_WORDS.find(([re]) => re.test(last));
  if (go && !/\b(make|create|generate)\b/i.test(last)) return reply({ status: "reply", message: "Opening it for you.", navigate: go[1] });

  const named = !/\bqr\b/i.test(last) || /micro ?qr/i.test(last) ? CODE_WORDS.find(([re]) => re.test(last)) : undefined;
  const codeWord: [RegExp, NonNullable<Reply["code"]>["tab"], string] | undefined =
    named ??
    (context && !/\bqr\b/i.test(last) && (QR_WORDS.test(last) || parseDesign(last) || /\d{4,}|["“']/.test(last))
      ? [/./, context.tab as NonNullable<Reply["code"]>["tab"], context.type]
      : undefined);
  if (codeWord) {
    const designOnly = !named && !/\d{4,}|["“']/.test(last) && Boolean(parseDesign(last));
    const value = designOnly
      ? (context?.value ?? null)
      : pick(/["“']([^"”']+)["”']/, last) ??
      pick(/(?:for|with|value|of|number|is)\s+([(\w][\w()\-./ ]*\w)/i, last)?.replace(/\s+(?:with|in|and|then|using|on)\b.*$/i, "") ??
      pick(/(\d{4,})/, last) ??
      (!named && context?.value ? context.value : null);
    if (!value) return reply({ status: "ask", message: "Sure. What value should it encode?", questions: [{ question: "Value", options: [] }] });
    const look = parseDesign(last);
    const design = look && (look.color || look.background || look.transparent)
      ? { fillType: look.fillType, color: look.color, color2: look.color2, background: look.background, transparent: look.transparent, heading: null, caption: null }
      : null;
    return reply({ status: "create", message: "Done, your code is ready. Ask for changes like “make it blue” or “add a heading”; size and rotation are in the tab itself.", code: { tab: codeWord[1], type: codeWord[2], value, design }, actions: actions.length ? actions : null });
  }

  const content = parseContent(all);
  const design = parseDesign(last) ?? (asked ? null : parseDesign(all));
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

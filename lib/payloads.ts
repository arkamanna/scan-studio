export type Result = { payload: string; opensIn: string } | null;
export type OnResult = (result: Result) => void;

export type Target = {
  id: string;
  label: string;
  app: string;
  build: (text: string) => string;
};

const enc = encodeURIComponent;

export const TEXT_TARGETS: Target[] = [
  { id: "plain", label: "Show text", app: "Camera text preview", build: (t) => t },
  { id: "whatsapp", label: "WhatsApp", app: "WhatsApp", build: (t) => `https://wa.me/?text=${enc(t)}` },
  { id: "sms", label: "Messages", app: "Messages / SMS", build: (t) => `sms:?&body=${enc(t)}` },
  { id: "email", label: "Email", app: "Mail app", build: (t) => `mailto:?body=${enc(t)}` },
  { id: "telegram", label: "Telegram", app: "Telegram", build: (t) => `https://t.me/share/url?url=${enc(t)}` },
  { id: "search", label: "Search", app: "Browser · Google Search", build: (t) => `https://www.google.com/search?q=${enc(t)}` },
  {
    id: "translate",
    label: "Translate",
    app: "Google Translate",
    build: (t) => `https://translate.google.com/?sl=auto&tl=en&text=${enc(t)}&op=translate`,
  },
  { id: "maps", label: "Maps", app: "Google Maps", build: (t) => `https://www.google.com/maps/search/?api=1&query=${enc(t)}` },
];

export const LINK_TARGETS: Target[] = [
  { id: "direct", label: "Open link", app: "", build: (u) => u },
  ...TEXT_TARGETS.filter((t) => ["whatsapp", "sms", "email", "telegram"].includes(t.id)),
];

export function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (/^https?:$/.test(url.protocol) && !url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.toString();
  } catch {
    return null;
  }
}

const APP_PATTERNS: [RegExp, string][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(spotify\.com|spotify\.link)$/, "Spotify"],
  [/(^|\.)music\.apple\.com$/, "Apple Music"],
  [/(^|\.)apps\.apple\.com$/, "App Store"],
  [/(^|\.)play\.google\.com$/, "Google Play Store"],
  [/(^|\.)(maps\.google\.[a-z.]+|maps\.app\.goo\.gl)$/, "Google Maps"],
  [/(^|\.)maps\.apple\.com$/, "Apple Maps"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "WhatsApp"],
  [/(^|\.)(t\.me|telegram\.me)$/, "Telegram"],
  [/(^|\.)(x\.com|twitter\.com)$/, "X (Twitter)"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)(facebook\.com|fb\.me)$/, "Facebook"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/(^|\.)zoom\.us$/, "Zoom"],
  [/(^|\.)meet\.google\.com$/, "Google Meet"],
  [/(^|\.)teams\.microsoft\.com$/, "Microsoft Teams"],
  [/(^|\.)(docs|drive)\.google\.com$/, "Google Drive"],
  [/(^|\.)github\.com$/, "GitHub"],
  [/(^|\.)pinterest\.[a-z.]+$/, "Pinterest"],
  [/(^|\.)netflix\.com$/, "Netflix"],
  [/(^|\.)amazon\.[a-z.]+$/, "Amazon"],
];

export function detectApp(url: string): string {
  try {
    const { hostname, pathname, protocol } = new URL(url);
    if (protocol === "mailto:") return "Mail app";
    if (protocol === "tel:") return "Phone dialer";
    if (protocol === "sms:") return "Messages / SMS";
    if (protocol === "geo:") return "Maps app";
    if (!/^https?:$/.test(protocol)) return `${protocol.replace(":", "")} app`;
    if (/(^|\.)google\.[a-z.]+$/.test(hostname) && pathname.startsWith("/maps")) return "Google Maps";
    const match = APP_PATTERNS.find(([re]) => re.test(hostname));
    return match ? `${match[1]} app (or browser)` : "Web browser";
  } catch {
    return "Web browser";
  }
}

const escWifi = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");

export function wifiPayload(o: { ssid: string; password: string; security: "WPA" | "WEP" | "nopass"; hidden: boolean }) {
  const pass = o.security === "nopass" ? "" : `P:${escWifi(o.password)};`;
  return `WIFI:T:${o.security};S:${escWifi(o.ssid)};${pass}${o.hidden ? "H:true;" : ""};`;
}

const escV = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function vcardPayload(c: {
  first: string;
  last: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  website: string;
  address: string;
}) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${escV(c.last)};${escV(c.first)};;;`];
  lines.push(`FN:${escV([c.first, c.last].filter(Boolean).join(" "))}`);
  if (c.org) lines.push(`ORG:${escV(c.org)}`);
  if (c.title) lines.push(`TITLE:${escV(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone.trim()}`);
  if (c.email) lines.push(`EMAIL:${c.email.trim()}`);
  if (c.website) lines.push(`URL:${normalizeUrl(c.website) ?? c.website}`);
  if (c.address) lines.push(`ADR:;;${escV(c.address)};;;;`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export function emailPayload(to: string, subject: string, body: string) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const qs = params.toString().replace(/\+/g, "%20");
  return `mailto:${to.trim()}${qs ? `?${qs}` : ""}`;
}

export const cleanPhone = (p: string) => p.replace(/[^\d+]/g, "");

export function smsPayload(phone: string, message: string) {
  return `SMSTO:${cleanPhone(phone)}:${message}`;
}

export function whatsappPayload(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${message ? `?text=${enc(message)}` : ""}`;
}

export type MapApp = "google" | "apple" | "geo";

export function locationPayload(query: string, app: MapApp) {
  const q = query.trim();
  const coords = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (app === "google") return `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
  if (app === "apple") return coords ? `https://maps.apple.com/?ll=${coords[1]},${coords[2]}&q=Pin` : `https://maps.apple.com/?q=${enc(q)}`;
  return coords ? `geo:${coords[1]},${coords[2]}` : `geo:0,0?q=${enc(q)}`;
}

const escIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const icsDate = (local: string) => `${local.replace(/[-:]/g, "")}00`;

export function eventPayload(e: { title: string; start: string; end: string; location: string; description: string }) {
  const lines = ["BEGIN:VEVENT", `SUMMARY:${escIcs(e.title)}`];
  if (e.start) lines.push(`DTSTART:${icsDate(e.start)}`);
  if (e.end) lines.push(`DTEND:${icsDate(e.end)}`);
  if (e.location) lines.push(`LOCATION:${escIcs(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${escIcs(e.description)}`);
  lines.push("END:VEVENT");
  return lines.join("\n");
}

import type { AgentContent, AgentDesign } from "./qr-agent-schema";
import { DEFAULT_DESIGN, THEMES, type QrDesign } from "./qr-design";
import {
  detectApp,
  emailPayload,
  eventPayload,
  locationPayload,
  normalizeUrl,
  smsPayload,
  vcardPayload,
  whatsappPayload,
  wifiPayload,
  type Result,
} from "./payloads";

export type AgentMessage = { role: "user" | "assistant"; content: string };

const s = (v: string | null | undefined) => (v ?? "").trim();
const HEX = /^#[0-9a-f]{6}$/i;
const color = (v: string | null | undefined) => {
  const c = s(v);
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${[...c.slice(1)].map((x) => x + x).join("")}`;
  return HEX.test(c) ? c.toLowerCase() : null;
};

/** Turns the agent's structured content into the payload the QR preview encodes. */
export function contentToResult(c: AgentContent): { result: Result; label: string } | null {
  switch (c.kind) {
    case "link": {
      const url = normalizeUrl(s(c.url));
      return url ? { result: { payload: url, opensIn: detectApp(url) }, label: `Link · ${url}` } : null;
    }
    case "text":
      return s(c.text) ? { result: { payload: s(c.text), opensIn: "Camera text preview" }, label: "Text" } : null;
    case "wifi": {
      if (!s(c.ssid)) return null;
      const security = c.security ?? (s(c.password) ? "WPA" : "nopass");
      return {
        result: { payload: wifiPayload({ ssid: s(c.ssid), password: s(c.password), security, hidden: Boolean(c.hidden) }), opensIn: "Wi‑Fi settings (joins the network)" },
        label: `Wi‑Fi · ${s(c.ssid)}`,
      };
    }
    case "contact": {
      const card = { first: s(c.firstName), last: s(c.lastName), org: s(c.org), title: s(c.jobTitle), phone: s(c.phone), email: s(c.email), website: s(c.website), address: s(c.address) };
      if (!card.first && !card.last && !card.org) return null;
      return { result: { payload: vcardPayload(card), opensIn: "Contacts (save contact)" }, label: `Contact · ${[card.first, card.last].filter(Boolean).join(" ") || card.org}` };
    }
    case "email":
      return s(c.email) ? { result: { payload: emailPayload(s(c.email), s(c.subject), s(c.body)), opensIn: "Mail app" }, label: `Email · ${s(c.email)}` } : null;
    case "phone":
      return s(c.phone) ? { result: { payload: `tel:${s(c.phone).replace(/[^\d+]/g, "")}`, opensIn: "Phone dialer" }, label: `Call · ${s(c.phone)}` } : null;
    case "sms":
      return s(c.phone) ? { result: { payload: smsPayload(s(c.phone), s(c.message)), opensIn: "Messages / SMS" }, label: `SMS · ${s(c.phone)}` } : null;
    case "whatsapp":
      return s(c.phone) ? { result: { payload: whatsappPayload(s(c.phone), s(c.message)), opensIn: "WhatsApp" }, label: `WhatsApp · ${s(c.phone)}` } : null;
    case "location": {
      if (!s(c.place)) return null;
      const app = c.mapApp ?? "google";
      return { result: { payload: locationPayload(s(c.place), app), opensIn: app === "apple" ? "Apple Maps" : app === "geo" ? "Maps app" : "Google Maps" }, label: `Location · ${s(c.place)}` };
    }
    case "event": {
      if (!s(c.eventTitle)) return null;
      const payload = eventPayload({ title: s(c.eventTitle), start: s(c.start), end: s(c.end), location: s(c.location), description: s(c.description) });
      return { result: { payload, opensIn: "Calendar (add event)" }, label: `Event · ${s(c.eventTitle)}` };
    }
  }
}

/** Applies the agent's design choices: start from the named theme (or the current design), then override. */
export function applyAgentDesign(current: QrDesign, d: AgentDesign | null): QrDesign {
  if (!d) return current;
  const theme = d.theme ? THEMES.find((t) => t.name === d.theme) : null;
  const base: QrDesign = theme ? { ...DEFAULT_DESIGN, ...theme.design, fill: { ...DEFAULT_DESIGN.fill, ...theme.design.fill }, theme: theme.name } : { ...current, fill: { ...current.fill } };
  const next: QrDesign = { ...base, logo: current.logo, logoSize: current.logoSize, logoClear: current.logoClear };
  if (d.dots) next.dots = d.dots;
  if (d.frame) next.frame = d.frame;
  if (d.ball) next.ball = d.ball;
  if (d.fillType) next.fill.type = d.fillType;
  if (color(d.color)) next.fill.color = color(d.color)!;
  if (color(d.color2)) next.fill.color2 = color(d.color2)!;
  if (typeof d.angle === "number" && Number.isFinite(d.angle)) next.fill.angle = Math.round(((d.angle % 360) + 360) % 360);
  if (d.eyeColor !== null && d.eyeColor !== undefined) next.eyeColor = color(d.eyeColor);
  if (color(d.background)) next.background = color(d.background)!;
  if (typeof d.transparent === "boolean") next.transparent = d.transparent;
  if (d.caption !== null && d.caption !== undefined) next.caption = d.caption.slice(0, 60);
  if (color(d.captionColor)) next.captionColor = color(d.captionColor)!;
  return next;
}

/** Compact description of the current state, so follow-ups like "make it red" work. */
export function describeState(design: QrDesign, label: string | null) {
  const { logo, ...rest } = design;
  return { content: label, design: { ...rest, hasLogo: Boolean(logo) } };
}

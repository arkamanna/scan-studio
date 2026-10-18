import { detectApp } from "./payloads";

export type Kind =
  | "url"
  | "wifi"
  | "contact"
  | "event"
  | "email"
  | "phone"
  | "sms"
  | "location"
  | "whatsapp"
  | "upi"
  | "otp"
  | "crypto"
  | "app"
  | "product"
  | "book"
  | "text";

export type ActionIcon = "open" | "call" | "mail" | "sms" | "map" | "contact" | "calendar" | "search" | "pay" | "book" | "cart" | "translate" | "key" | "chat";

export type Field = { label: string; value: string; href?: string; secret?: boolean };
export type Action = {
  label: string;
  icon: ActionIcon;
  href?: string;
  file?: { name: string; type: string; content: string };
  primary?: boolean;
};

export type Parsed = {
  kind: Kind;
  label: string;
  title: string;
  subtitle?: string;
  fields: Field[];
  actions: Action[];
  /** Where to send the user when "open automatically" is on. */
  openUrl?: string;
  opensIn?: string;
  warning?: string;
  note?: string;
  lookup?: { type: "book" | "product"; code: string };
};

const enc = encodeURIComponent;

const FORMAT_NAMES: Record<string, string> = {
  qr_code: "QR Code",
  micro_qr_code: "Micro QR",
  rm_qr_code: "rMQR",
  data_matrix: "Data Matrix",
  aztec: "Aztec",
  pdf417: "PDF417",
  micro_pdf417: "MicroPDF417",
  maxi_code: "MaxiCode",
  ean_13: "EAN-13",
  ean_8: "EAN-8",
  upc_a: "UPC-A",
  upc_e: "UPC-E",
  isbn: "ISBN",
  itf: "ITF",
  itf_14: "ITF-14",
  code_128: "Code 128",
  code_39: "Code 39",
  code_93: "Code 93",
  codabar: "Codabar",
  databar: "GS1 DataBar",
  databar_expanded: "GS1 DataBar Expanded",
  databar_limited: "GS1 DataBar Limited",
  databar_omni: "GS1 DataBar",
  databar_stacked: "GS1 DataBar Stacked",
  databar_stacked_omni: "GS1 DataBar Stacked",
  databar_expanded_stacked: "GS1 DataBar Expanded Stacked",
  compact_pdf417: "Compact PDF417",
  aztec_code: "Aztec",
  aztec_rune: "Aztec Rune",
  telepen: "Telepen",
  telepen_alpha: "Telepen",
  telepen_numeric: "Telepen",
  code_32: "Code 32",
  pzn: "PZN",
  dx_film_edge: "DX Film Edge",
};

export const formatName = (f: string) => FORMAT_NAMES[f] ?? f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const RETAIL = new Set(["ean_13", "ean_8", "upc_a", "upc_e", "isbn", "itf_14"]);

/** Splits `KEY:value;KEY:value;;` bodies used by WIFI:, MECARD: and MATMSG:, honouring backslash escapes. */
function splitKV(body: string) {
  const out: Record<string, string> = {};
  let key = "";
  let val = "";
  let inVal = false;
  const commit = () => {
    const k = key.trim().toUpperCase();
    if (k) out[k] = out[k] ? `${out[k]}, ${val}` : val;
    key = val = "";
    inVal = false;
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\" && i + 1 < body.length) {
      if (inVal) val += body[++i];
      else key += body[++i];
    } else if (!inVal && c === ":") inVal = true;
    else if (c === ";") commit();
    else if (inVal) val += c;
    else key += c;
  }
  commit();
  return out;
}

type VLine = { name: string; params: string; value: string };

function parseVLines(raw: string): VLine[] {
  const unesc = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .flatMap((line) => {
      const i = line.indexOf(":");
      if (i < 0) return [];
      const [name, ...params] = line.slice(0, i).split(";");
      return [{ name: name.replace(/^item\d+\./i, "").toUpperCase(), params: params.join(";").toUpperCase(), value: unesc(line.slice(i + 1)) }];
    });
}

function icsDate(v: string) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return v;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return new Date(+y, +mo - 1, +d).toLocaleDateString(undefined, { dateStyle: "full" });
  const date = z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))) : new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function validGtin(code: string) {
  if (!/^\d{8,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const GS1_PREFIXES: [number, number, string][] = [
  [0, 19, "USA / Canada"], [30, 37, "France"], [380, 380, "Bulgaria"], [400, 440, "Germany"], [450, 459, "Japan"],
  [460, 469, "Russia"], [471, 471, "Taiwan"], [489, 489, "Hong Kong"], [490, 499, "Japan"], [500, 509, "United Kingdom"],
  [540, 549, "Belgium / Luxembourg"], [560, 560, "Portugal"], [570, 579, "Denmark"], [590, 590, "Poland"], [600, 601, "South Africa"],
  [628, 628, "Saudi Arabia"], [629, 629, "United Arab Emirates"], [640, 649, "Finland"], [690, 699, "China"], [700, 709, "Norway"],
  [730, 739, "Sweden"], [750, 750, "Mexico"], [760, 769, "Switzerland"], [789, 790, "Brazil"], [800, 839, "Italy"],
  [840, 849, "Spain"], [858, 858, "Slovakia"], [859, 859, "Czechia"], [868, 869, "Türkiye"], [870, 879, "Netherlands"],
  [880, 880, "South Korea"], [885, 885, "Thailand"], [888, 888, "Singapore"], [890, 890, "India"], [893, 893, "Vietnam"],
  [896, 896, "Pakistan"], [899, 899, "Indonesia"], [900, 919, "Austria"], [930, 939, "Australia"], [940, 949, "New Zealand"],
  [955, 955, "Malaysia"], [977, 977, "Serial publication (ISSN)"], [978, 979, "Book (ISBN)"],
];

function gs1Region(gtin: string) {
  const ean13 = gtin.padStart(13, "0");
  const p3 = Number(ean13.slice(0, 3));
  return GS1_PREFIXES.find(([lo, hi]) => p3 >= lo && p3 <= hi)?.[2] ?? GS1_PREFIXES.find(([lo, hi]) => p3 / 10 >= lo && p3 / 10 <= hi)?.[2];
}

function isbn13to10(isbn: string) {
  if (!isbn.startsWith("978")) return null;
  const core = isbn.slice(3, 12);
  const sum = core.split("").reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? "X" : String(check));
}

const SHORTENERS = /(^|\.)(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|ow\.ly|rebrand\.ly|cutt\.ly|buff\.ly|shorturl\.at|rb\.gy|tiny\.cc)$/i;

function parseProduct(code: string, format: string): Parsed {
  const isBook = /^97[89]\d{10}$/.test(code);
  const valid = format === "upc_e" ? undefined : validGtin(code);
  const region = gs1Region(code);
  if (isBook) {
    const isbn10 = isbn13to10(code);
    return {
      kind: "book",
      label: "Book (ISBN)",
      title: `ISBN ${code}`,
      fields: [
        { label: "ISBN-13", value: code },
        ...(isbn10 ? [{ label: "ISBN-10", value: isbn10 }] : []),
        { label: "Check digit", value: valid ? "Valid ✓" : "Invalid ✗" },
      ],
      actions: [
        { label: "Open Library", icon: "book", href: `https://openlibrary.org/isbn/${code}`, primary: true },
        { label: "Google Books", icon: "book", href: `https://books.google.com/books?vid=ISBN${code}` },
        { label: "Goodreads", icon: "search", href: `https://www.goodreads.com/search?q=${code}` },
        { label: "Search web", icon: "search", href: `https://www.google.com/search?q=ISBN+${code}` },
      ],
      openUrl: `https://openlibrary.org/isbn/${code}`,
      opensIn: "Open Library",
      lookup: { type: "book", code },
    };
  }
  return {
    kind: "product",
    label: "Product barcode",
    title: code,
    subtitle: formatName(format),
    fields: [
      { label: "Number", value: code },
      ...(valid !== undefined ? [{ label: "Check digit", value: valid ? "Valid ✓" : "Invalid ✗" }] : []),
      ...(region ? [{ label: "Registered in", value: `${region} (GS1 prefix — not always the country of origin)` }] : []),
    ],
    actions: [
      { label: "Search product", icon: "search", href: `https://www.google.com/search?q=${code}`, primary: true },
      { label: "Shopping", icon: "cart", href: `https://www.google.com/search?tbm=shop&q=${code}` },
      { label: "Open Food Facts", icon: "open", href: `https://world.openfoodfacts.org/product/${code}` },
      { label: "Barcode Lookup", icon: "open", href: `https://www.barcodelookup.com/${code}` },
    ],
    openUrl: `https://www.google.com/search?q=${code}`,
    opensIn: "Google Search",
    lookup: { type: "product", code },
  };
}

function parseUrl(raw: string): Parsed {
  const url = new URL(raw);
  const host = url.hostname.replace(/^www\./, "");

  if (/^(wa\.me|api\.whatsapp\.com)$/.test(host)) {
    const phone = host === "wa.me" ? url.pathname.slice(1) : url.searchParams.get("phone") ?? "";
    const text = url.searchParams.get("text") ?? "";
    return {
      kind: "whatsapp",
      label: "WhatsApp",
      title: phone ? `Chat with +${phone.replace(/^\+/, "")}` : "Share on WhatsApp",
      fields: [...(phone ? [{ label: "Phone", value: `+${phone.replace(/^\+/, "")}` }] : []), ...(text ? [{ label: "Message", value: text }] : [])],
      actions: [{ label: "Open WhatsApp", icon: "chat", href: raw, primary: true }],
      openUrl: raw,
      opensIn: "WhatsApp",
    };
  }

  const fields: Field[] = [
    { label: "Website", value: url.hostname },
    { label: "Full link", value: raw, href: raw },
    { label: "Connection", value: url.protocol === "https:" ? "Secure (HTTPS) 🔒" : "Not secure (HTTP)" },
  ];
  const params = [...url.searchParams.entries()].filter(([k]) => !/^utm_/i.test(k));
  if (params.length && params.length <= 6) fields.push({ label: "Parameters", value: params.map(([k, v]) => `${k} = ${v}`).join("\n") });

  let warning: string | undefined;
  if (SHORTENERS.test(url.hostname)) warning = "This is a shortened link — the real destination is hidden until you open it.";
  else if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) warning = "This link points to a raw IP address instead of a website name. Be careful.";
  else if (url.hostname.includes("xn--")) warning = "This website name uses look‑alike international characters. Double‑check it.";
  else if (url.protocol === "http:") warning = "This link isn’t encrypted (HTTP).";

  const app = detectApp(raw);
  return {
    kind: "url",
    label: "Website link",
    title: host,
    subtitle: url.pathname !== "/" ? decodeURI(url.pathname) : undefined,
    fields,
    actions: [{ label: app === "Web browser" ? "Open link" : `Open in ${app.replace(" (or browser)", "")}`, icon: "open", href: raw, primary: true }],
    openUrl: raw,
    opensIn: app,
    warning,
  };
}

function parseWifi(raw: string): Parsed {
  const kv = splitKV(raw.slice(5));
  const security = kv.T && kv.T.toLowerCase() !== "nopass" ? kv.T.toUpperCase() : "Open (no password)";
  return {
    kind: "wifi",
    label: "Wi‑Fi network",
    title: kv.S || "Wi‑Fi network",
    fields: [
      { label: "Network (SSID)", value: kv.S ?? "" },
      ...(kv.P ? [{ label: "Password", value: kv.P, secret: true }] : []),
      { label: "Security", value: security },
      ...(kv.H === "true" ? [{ label: "Hidden network", value: "Yes" }] : []),
    ],
    actions: [],
    note: "Your phone’s camera app can join this network directly. On this device, copy the password and pick the network in Wi‑Fi settings.",
  };
}

function parseVCard(raw: string): Parsed {
  const lines = parseVLines(raw);
  const get = (n: string) => lines.filter((l) => l.name === n);
  const nParts = (get("N")[0]?.value ?? "").split(";");
  const name = get("FN")[0]?.value || [nParts[1], nParts[0]].filter(Boolean).join(" ") || "Contact";
  const phones = get("TEL");
  const emails = get("EMAIL");
  const fields: Field[] = [{ label: "Name", value: name }];
  const org = get("ORG")[0]?.value.replace(/;/g, ", ");
  const title = get("TITLE")[0]?.value;
  if (org) fields.push({ label: "Company", value: org });
  if (title) fields.push({ label: "Job title", value: title });
  phones.forEach((p) => {
    const type = p.params.match(/TYPE=([A-Z,]+)/)?.[1]?.split(",")[0]?.toLowerCase();
    fields.push({ label: `Phone${type ? ` (${type})` : ""}`, value: p.value, href: `tel:${p.value.replace(/[^\d+]/g, "")}` });
  });
  emails.forEach((e) => fields.push({ label: "Email", value: e.value, href: `mailto:${e.value}` }));
  get("URL").forEach((u) => fields.push({ label: "Website", value: u.value, href: u.value }));
  get("ADR").forEach((a) => fields.push({ label: "Address", value: a.value.split(";").filter(Boolean).join(", ") }));
  const note = get("NOTE")[0]?.value;
  if (note) fields.push({ label: "Note", value: note });

  const actions: Action[] = [
    { label: "Save contact", icon: "contact", primary: true, file: { name: `${name.replace(/[^\w ]+/g, "").trim() || "contact"}.vcf`, type: "text/vcard", content: raw } },
  ];
  if (phones[0]) actions.push({ label: "Call", icon: "call", href: `tel:${phones[0].value.replace(/[^\d+]/g, "")}` });
  if (emails[0]) actions.push({ label: "Email", icon: "mail", href: `mailto:${emails[0].value}` });
  return { kind: "contact", label: "Contact card", title: name, subtitle: [title, org].filter(Boolean).join(" · ") || undefined, fields, actions };
}

function parseMeCard(raw: string): Parsed {
  const kv = splitKV(raw.slice(7));
  const [last, first] = (kv.N ?? "").split(",");
  const name = [first, last].filter(Boolean).join(" ").trim() || "Contact";
  const vcard = ["BEGIN:VCARD", "VERSION:3.0", `N:${last ?? ""};${first ?? ""};;;`, `FN:${name}`];
  if (kv.TEL) kv.TEL.split(", ").forEach((t) => vcard.push(`TEL:${t}`));
  if (kv.EMAIL) vcard.push(`EMAIL:${kv.EMAIL}`);
  if (kv.ORG) vcard.push(`ORG:${kv.ORG}`);
  if (kv.URL) vcard.push(`URL:${kv.URL}`);
  if (kv.ADR) vcard.push(`ADR:;;${kv.ADR};;;;`);
  if (kv.NOTE) vcard.push(`NOTE:${kv.NOTE}`);
  vcard.push("END:VCARD");
  return parseVCard(vcard.join("\n"));
}

function parseEvent(raw: string): Parsed {
  const lines = parseVLines(raw);
  const get = (n: string) => lines.find((l) => l.name === n)?.value ?? "";
  const title = get("SUMMARY") || "Event";
  const fields: Field[] = [{ label: "Event", value: title }];
  if (get("DTSTART")) fields.push({ label: "Starts", value: icsDate(get("DTSTART")) });
  if (get("DTEND")) fields.push({ label: "Ends", value: icsDate(get("DTEND")) });
  if (get("LOCATION")) fields.push({ label: "Location", value: get("LOCATION") });
  if (get("DESCRIPTION")) fields.push({ label: "Details", value: get("DESCRIPTION") });
  const ics = /BEGIN:VCALENDAR/i.test(raw) ? raw : `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//QR Studio//EN\n${raw.trim()}\nEND:VCALENDAR`;
  const actions: Action[] = [
    { label: "Add to calendar", icon: "calendar", primary: true, file: { name: `${title.replace(/[^\w ]+/g, "").trim() || "event"}.ics`, type: "text/calendar", content: ics } },
  ];
  if (get("LOCATION")) actions.push({ label: "Directions", icon: "map", href: `https://www.google.com/maps/search/?api=1&query=${enc(get("LOCATION"))}` });
  return { kind: "event", label: "Calendar event", title, subtitle: get("DTSTART") ? icsDate(get("DTSTART")) : undefined, fields, actions };
}

function emailResult(to: string, subject: string, body: string, cc = ""): Parsed {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  if (cc) params.set("cc", cc);
  const href = `mailto:${to}${params.size ? `?${params.toString().replace(/\+/g, "%20")}` : ""}`;
  return {
    kind: "email",
    label: "Email",
    title: to || "New email",
    fields: [
      ...(to ? [{ label: "To", value: to }] : []),
      ...(cc ? [{ label: "Cc", value: cc }] : []),
      ...(subject ? [{ label: "Subject", value: subject }] : []),
      ...(body ? [{ label: "Message", value: body }] : []),
    ],
    actions: [{ label: "Write email", icon: "mail", href, primary: true }],
    openUrl: href,
    opensIn: "Mail app",
  };
}

function phoneResult(number: string): Parsed {
  const clean = number.replace(/[^\d+]/g, "");
  return {
    kind: "phone",
    label: "Phone number",
    title: number,
    fields: [{ label: "Number", value: number }],
    actions: [
      { label: "Call", icon: "call", href: `tel:${clean}`, primary: true },
      { label: "Send SMS", icon: "sms", href: `sms:${clean}` },
      { label: "WhatsApp", icon: "chat", href: `https://wa.me/${clean.replace(/\D/g, "")}` },
    ],
    openUrl: `tel:${clean}`,
    opensIn: "Phone dialer",
  };
}

function smsResult(number: string, message: string): Parsed {
  const clean = number.replace(/[^\d+]/g, "");
  const href = `sms:${clean}${message ? `?&body=${enc(message)}` : ""}`;
  return {
    kind: "sms",
    label: "Text message",
    title: number ? `SMS to ${number}` : "New SMS",
    fields: [...(number ? [{ label: "To", value: number }] : []), ...(message ? [{ label: "Message", value: message }] : [])],
    actions: [{ label: "Open Messages", icon: "sms", href, primary: true }],
    openUrl: href,
    opensIn: "Messages",
  };
}

function parseGeo(raw: string): Parsed {
  const m = raw.match(/^geo:(-?[\d.]+),(-?[\d.]+)(?:,[\d.-]+)?(?:[;?](.*))?$/i);
  const lat = m?.[1] ?? "0";
  const lng = m?.[2] ?? "0";
  const q = m?.[3] ? new URLSearchParams(m[3]).get("q") ?? "" : "";
  const hasCoords = !(lat === "0" && lng === "0");
  const query = hasCoords ? `${lat},${lng}` : q;
  const google = `https://www.google.com/maps/search/?api=1&query=${enc(query)}`;
  return {
    kind: "location",
    label: "Location",
    title: q && !hasCoords ? q : `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
    fields: [...(hasCoords ? [{ label: "Latitude", value: lat }, { label: "Longitude", value: lng }] : []), ...(q ? [{ label: "Place", value: q }] : [])],
    actions: [
      { label: "Google Maps", icon: "map", href: google, primary: true },
      { label: "Apple Maps", icon: "map", href: hasCoords ? `https://maps.apple.com/?ll=${lat},${lng}&q=Pin` : `https://maps.apple.com/?q=${enc(q)}` },
      { label: "Default maps app", icon: "map", href: raw },
    ],
    openUrl: google,
    opensIn: "Google Maps",
  };
}

function parseUpi(raw: string): Parsed {
  const url = new URL(raw);
  const p = url.searchParams;
  const amount = p.get("am");
  const currency = p.get("cu") ?? "INR";
  const name = p.get("pn") ?? "";
  return {
    kind: "upi",
    label: "UPI payment",
    title: name || p.get("pa") || "UPI payment",
    subtitle: amount ? `${currency === "INR" ? "₹" : `${currency} `}${amount}` : undefined,
    fields: [
      ...(name ? [{ label: "Pay to", value: name }] : []),
      { label: "UPI ID", value: p.get("pa") ?? "" },
      ...(amount ? [{ label: "Amount", value: `${currency === "INR" ? "₹" : `${currency} `}${amount}` }] : []),
      ...(p.get("tn") ? [{ label: "Note", value: p.get("tn")! }] : []),
      ...(p.get("mc") ? [{ label: "Merchant code", value: p.get("mc")! }] : []),
    ],
    actions: [{ label: "Pay with UPI app", icon: "pay", href: raw, primary: true }],
    openUrl: raw,
    opensIn: "UPI app (GPay, PhonePe, Paytm…)",
    note: "Always confirm the payee name in your UPI app before paying.",
  };
}

function parseOtp(raw: string): Parsed {
  const url = new URL(raw);
  const labelPath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const [labelIssuer, account] = labelPath.includes(":") ? labelPath.split(":") : ["", labelPath];
  const p = url.searchParams;
  const issuer = p.get("issuer") || labelIssuer;
  return {
    kind: "otp",
    label: "2‑factor authentication",
    title: issuer || "Authenticator setup",
    subtitle: account,
    fields: [
      ...(issuer ? [{ label: "Service", value: issuer }] : []),
      ...(account ? [{ label: "Account", value: account }] : []),
      { label: "Type", value: url.host.toUpperCase() },
      ...(p.get("secret") ? [{ label: "Secret key", value: p.get("secret")!, secret: true }] : []),
      { label: "Digits", value: p.get("digits") ?? "6" },
      ...(url.host === "totp" ? [{ label: "Refresh every", value: `${p.get("period") ?? "30"} seconds` }] : []),
    ],
    actions: [{ label: "Open authenticator app", icon: "key", href: raw, primary: true }],
    openUrl: raw,
    opensIn: "Authenticator app",
    warning: "This code contains a secret login key. Only scan it into your own authenticator app.",
  };
}

function parseCrypto(raw: string): Parsed {
  const [scheme, rest] = raw.split(/:(.*)/s);
  const [address, query] = rest.split("?");
  const p = new URLSearchParams(query ?? "");
  const coin = scheme.charAt(0).toUpperCase() + scheme.slice(1).toLowerCase();
  return {
    kind: "crypto",
    label: `${coin} address`,
    title: `${address.slice(0, 10)}…${address.slice(-6)}`,
    fields: [
      { label: "Currency", value: coin },
      { label: "Address", value: address },
      ...(p.get("amount") ? [{ label: "Amount", value: p.get("amount")! }] : []),
      ...(p.get("label") ? [{ label: "Label", value: p.get("label")! }] : []),
      ...(p.get("message") ? [{ label: "Message", value: p.get("message")! }] : []),
    ],
    actions: [{ label: "Open wallet", icon: "pay", href: raw, primary: true }],
    openUrl: raw,
    opensIn: "Crypto wallet app",
  };
}

function textResult(raw: string): Parsed {
  const words = raw.trim().split(/\s+/).filter(Boolean).length;
  return {
    kind: "text",
    label: "Text",
    title: raw.length > 90 ? `${raw.slice(0, 90).trim()}…` : raw,
    fields: [
      { label: "Text", value: raw },
      { label: "Length", value: `${raw.length.toLocaleString()} characters · ${words.toLocaleString()} words` },
    ],
    actions: [
      { label: "Search web", icon: "search", href: `https://www.google.com/search?q=${enc(raw.slice(0, 500))}`, primary: true },
      { label: "Translate", icon: "translate", href: `https://translate.google.com/?sl=auto&tl=en&text=${enc(raw.slice(0, 2000))}&op=translate` },
    ],
  };
}

export function parseCode(rawValue: string, format: string): Parsed {
  const raw = rawValue.trim();
  const lower = raw.toLowerCase();

  if (RETAIL.has(format) && /^\d{8,14}$/.test(raw)) return parseProduct(raw, format);

  try {
    if (/^https?:\/\//i.test(raw)) return parseUrl(raw);
    if (lower.startsWith("wifi:")) return parseWifi(raw);
    if (lower.startsWith("begin:vcard")) return parseVCard(raw);
    if (lower.startsWith("mecard:")) return parseMeCard(raw);
    if (/^begin:(vevent|vcalendar)/i.test(raw)) return parseEvent(raw);
    if (lower.startsWith("mailto:")) {
      const url = new URL(raw);
      return emailResult(decodeURIComponent(url.pathname), url.searchParams.get("subject") ?? "", url.searchParams.get("body") ?? "", url.searchParams.get("cc") ?? "");
    }
    if (lower.startsWith("matmsg:")) {
      const kv = splitKV(raw.slice(7));
      return emailResult(kv.TO ?? "", kv.SUB ?? "", kv.BODY ?? "");
    }
    if (lower.startsWith("tel:")) return phoneResult(decodeURIComponent(raw.slice(4)));
    if (lower.startsWith("smsto:")) {
      const [, number = "", ...msg] = raw.split(":");
      return smsResult(number, msg.join(":"));
    }
    if (lower.startsWith("sms:")) {
      const [number, query = ""] = raw.slice(4).split("?");
      return smsResult(decodeURIComponent(number), new URLSearchParams(query.replace(/^&/, "")).get("body") ?? "");
    }
    if (lower.startsWith("geo:")) return parseGeo(raw);
    if (lower.startsWith("upi://")) return parseUpi(raw);
    if (lower.startsWith("otpauth://")) return parseOtp(raw);
    if (/^(bitcoin|ethereum|litecoin|dogecoin|bitcoincash|monero):/i.test(raw)) return parseCrypto(raw);

    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(raw)) return emailResult(raw, "", "");
    if (/^\+?[\d\s\-().]{7,20}$/.test(raw) && format === "qr_code") return phoneResult(raw);
    if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(raw)) return parseUrl(`https://${raw}`);

    const scheme = raw.match(/^([a-z][a-z0-9+.-]{1,30}):\S+$/i);
    if (scheme) {
      return {
        kind: "app",
        label: "App link",
        title: `${scheme[1]}:// link`,
        fields: [{ label: "App scheme", value: scheme[1] }, { label: "Link", value: raw }],
        actions: [{ label: `Open in ${scheme[1]} app`, icon: "open", href: raw, primary: true }],
        openUrl: raw,
        opensIn: `${scheme[1]} app`,
      };
    }
  } catch {
    /* malformed structured data — fall back to plain text */
  }

  if (RETAIL.has(format) || /^\d{6,}$/.test(raw)) {
    if (/^\d{8,14}$/.test(raw)) return parseProduct(raw, format);
  }
  return textResult(raw);
}

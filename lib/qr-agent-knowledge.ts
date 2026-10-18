import { BARCODE_FORMATS } from "./barcode-formats";
import { CODE_GROUPS } from "./code-types";
import { THEMES } from "./qr-design";

const themeLine = THEMES.map((t) => {
  const d = t.design;
  const fill = d.fill ? (d.fill.type === "solid" ? d.fill.color : `${d.fill.type} ${d.fill.color}→${d.fill.color2}`) : "";
  return `${t.name} (${d.dots} dots, ${d.frame} frames, ${fill} on ${d.background})`;
}).join("; ");

const barcodeLines = BARCODE_FORMATS.map((f) => `  - ${f.id}: ${f.label}, ${f.use}. Rule: ${f.rule} Example: ${f.sample}`).join("\n");

const groupLines = CODE_GROUPS.map(
  (g) =>
    `- Tab "${g.id}" (${g.label}):\n` +
    g.types.map((t) => `  - ${t.bcid}: ${t.label}, ${t.use}. Rule: ${t.rule} Example: ${t.sample}${t.scannable ? "" : " (phones can't scan it; needs a dedicated scanner)"}`).join("\n"),
).join("\n");

/** Everything the agent knows about Scan Studio. */
export const APP_KNOWLEDGE = `SCAN STUDIO: a free web app (also installable as a phone/desktop app via the Install button under the logo) to create and scan codes. Everything runs in the browser; files are only uploaded if the user chooses "share as link". Curated by Arka Manna (Endorsements button at the bottom).

TABS: QR Code, Barcode, Data Matrix, Aztec, PDF417, GS1, Postal, More, Scan.

QR CODE TAB (you can fully control it):
- Content modes: Link (any URL; app links like YouTube, Instagram, Spotify, Maps open in their app; can instead share the link via WhatsApp, SMS, Email or Telegram), Text (rich text editor with bold/italic/underline/strike/sub/superscript Unicode styles; can show the text or send it to WhatsApp, SMS, Email, Telegram, Google Search, Google Translate or Maps), Photo (OCR text from a photo, or upload and share the photo as a link), Document (text from PDF/Word/TXT, or share as a link).
- Smart actions: Wi-Fi (join network), Contact (vCard), WhatsApp chat, Email draft, Call, SMS, Location (Google Maps, Apple Maps or geo:), Event (calendar).
- Design (collapsible): quick themes ${themeLine}. Dot shapes: square, rounded, dots, diamond, star, heart, leaf, plus. Corner frames: square, rounded, circle, leaf. Corner centres: square, rounded, circle, diamond, leaf. Colour: solid, linear or radial gradient (two colours + angle), separate corner colour, background colour or transparent. Logo in the middle (user uploads an image in Design → Logo; size 10-30% and "clear dots behind logo"). Caption text under the code with colour and size.
- Preview: PNG and SVG downloads, Copy image, Share, Test it / Copy data, Print. Error correction L (7%), M (15%, default), Q (25%), H (30%, forced when a logo is used). Capacity up to 2,953 bytes at L.

BARCODE TAB (JsBarcode; colours, bar width/height, text under/above, image above):
${barcodeLines}

OTHER CODE TABS (each with type picker, value, rotation, quiet zone, design colours, heading, image, PNG/SVG/print and an automatic "scan tested" check):
${groupLines}

SCAN TAB: camera scanning (zoom 1×-4×, torch, flip camera, continuous mode) or upload/paste images. Reads QR, Micro QR, rMQR, Data Matrix, Aztec, PDF417, MicroPDF417, MaxiCode, GS1 DataBar, EAN/UPC, Code 128/39/93, Codabar, ITF, Telepen and more, then shows the details with one-tap actions (open link, join Wi-Fi, save contact…). Tip for tiny codes: hold the phone ~15 cm away and use 2×-3× zoom.`;

/**
 * Plain-text "formatting" with Unicode: styled letter sets (bold, italic, script…), combining underline/strike marks,
 * and sub/superscript characters. QR codes only carry plain text, and these characters survive that.
 */

export type Family = "default" | "sans" | "script" | "fraktur" | "double" | "mono" | "circled" | "smallcaps";
export type TextStyle = { family: Family; bold: boolean; italic: boolean };

export const FAMILIES: { id: Family; label: string; sample: string; bold: boolean; italic: boolean }[] = [
  { id: "default", label: "Default", sample: "Aa", bold: true, italic: true },
  { id: "sans", label: "Sans", sample: "𝖠𝖺", bold: true, italic: true },
  { id: "script", label: "Script", sample: "𝒜𝒶", bold: true, italic: false },
  { id: "fraktur", label: "Gothic", sample: "𝔄𝔞", bold: true, italic: false },
  { id: "double", label: "Outline", sample: "𝔸𝕒", bold: false, italic: false },
  { id: "mono", label: "Typewriter", sample: "𝙰𝚊", bold: false, italic: false },
  { id: "circled", label: "Bubble", sample: "Ⓐⓐ", bold: false, italic: false },
  { id: "smallcaps", label: "Small caps", sample: "Aᴀ", bold: false, italic: false },
];

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";

type Alphabet = Map<string, string>;

function alphabet(upper: number | null, lower: number | null, digits: number | null, exceptions: Record<string, number> = {}): Alphabet {
  const map: Alphabet = new Map();
  if (upper !== null) [...UPPER].forEach((c, i) => map.set(c, String.fromCodePoint(upper + i)));
  if (lower !== null) [...LOWER].forEach((c, i) => map.set(c, String.fromCodePoint(lower + i)));
  if (digits !== null) [...DIGITS].forEach((c, i) => map.set(c, String.fromCodePoint(digits + i)));
  Object.entries(exceptions).forEach(([c, cp]) => map.set(c, String.fromCodePoint(cp)));
  return map;
}

const SCRIPT_EXC = { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 };
const FRAKTUR_EXC = { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 };
const DOUBLE_EXC = { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 };

const STYLES: Record<string, Alphabet> = {
  "serif-bold": alphabet(0x1d400, 0x1d41a, 0x1d7ce),
  "serif-italic": alphabet(0x1d434, 0x1d44e, null, { h: 0x210e }),
  "serif-bolditalic": alphabet(0x1d468, 0x1d482, 0x1d7ce),
  sans: alphabet(0x1d5a0, 0x1d5ba, 0x1d7e2),
  "sans-bold": alphabet(0x1d5d4, 0x1d5ee, 0x1d7ec),
  "sans-italic": alphabet(0x1d608, 0x1d622, 0x1d7e2),
  "sans-bolditalic": alphabet(0x1d63c, 0x1d656, 0x1d7ec),
  script: alphabet(0x1d49c, 0x1d4b6, null, SCRIPT_EXC),
  "script-bold": alphabet(0x1d4d0, 0x1d4ea, 0x1d7ce),
  fraktur: alphabet(0x1d504, 0x1d51e, null, FRAKTUR_EXC),
  "fraktur-bold": alphabet(0x1d56c, 0x1d586, 0x1d7ce),
  double: alphabet(0x1d538, 0x1d552, 0x1d7d8, DOUBLE_EXC),
  mono: alphabet(0x1d670, 0x1d68a, 0x1d7f6),
  circled: (() => {
    const m = alphabet(0x24b6, 0x24d0, null);
    m.set("0", "⓪");
    [..."123456789"].forEach((c, i) => m.set(c, String.fromCodePoint(0x2460 + i)));
    return m;
  })(),
  smallcaps: (() => {
    const caps = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ";
    const m: Alphabet = new Map();
    [...LOWER].forEach((c, i) => m.set(c, [...caps][i]));
    return m;
  })(),
};

/** Styled character -> { plain character, style key }. */
const REVERSE = new Map<string, { base: string; key: string }>();
for (const [key, map] of Object.entries(STYLES)) {
  map.forEach((styled, base) => {
    if (!REVERSE.has(styled) && styled !== base) REVERSE.set(styled, { base, key });
  });
}

function styleKey({ family, bold, italic }: TextStyle): string | null {
  switch (family) {
    case "default":
      return bold && italic ? "serif-bolditalic" : bold ? "serif-bold" : italic ? "serif-italic" : null;
    case "sans":
      return bold && italic ? "sans-bolditalic" : bold ? "sans-bold" : italic ? "sans-italic" : "sans";
    case "script":
      return bold ? "script-bold" : "script";
    case "fraktur":
      return bold ? "fraktur-bold" : "fraktur";
    default:
      return family;
  }
}

function styleOfKey(key: string): TextStyle {
  const [fam, variant = ""] = key.split("-");
  const family = (fam === "serif" ? "default" : fam) as Family;
  return { family, bold: variant.includes("bold"), italic: variant.includes("italic") };
}

const UNDERLINE = "\u0332";
const STRIKE = "\u0336";
const isMark = (ch: string) => /\p{M}/u.test(ch);

export const plainChar = (ch: string) => REVERSE.get(ch)?.base ?? ch;

/** Re-styles every letter/digit in `text` (undoing any previous letter style first). */
export function applyStyle(text: string, style: TextStyle) {
  const key = styleKey(style);
  const map = key ? STYLES[key] : null;
  return [...text]
    .map((ch) => {
      if (isMark(ch)) return ch;
      const base = plainChar(ch);
      return map?.get(base) ?? (key === "smallcaps" ? map?.get(base.toLowerCase()) ?? base : base);
    })
    .join("");
}

/** The letter style of the first styled letter in `text` (default when there is none). */
export function detectStyle(text: string): TextStyle {
  for (const ch of text) {
    const hit = REVERSE.get(ch);
    if (hit) return styleOfKey(hit.key);
  }
  return { family: "default", bold: false, italic: false };
}

export const hasMark = (text: string, mark: "underline" | "strike") => text.includes(mark === "underline" ? UNDERLINE : STRIKE);

/** Adds the combining mark after every visible character, or removes it everywhere when `on` is false. */
export function setMark(text: string, mark: "underline" | "strike", on: boolean) {
  const m = mark === "underline" ? UNDERLINE : STRIKE;
  const stripped = text.split(m).join("");
  if (!on) return stripped;
  let out = "";
  const chars = [...stripped];
  chars.forEach((ch, i) => {
    out += ch;
    const next = chars[i + 1];
    if (!isMark(ch) && ch !== "\n" && !(next && isMark(next))) out += m;
    else if (isMark(ch) && !(next && isMark(next))) out += m;
  });
  return out;
}

const SUPER: Record<string, string> = Object.fromEntries(
  [..."0123456789+-=()abcdefghijklmnoprstuvwxyzABDEGHIJKLMNOPRTUVW"].map((c, i) => [c, [..."⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ"][i]]),
);
const SUB: Record<string, string> = Object.fromEntries(
  [..."0123456789+-=()aehijklmnoprstuvx"].map((c, i) => [c, [..."₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ"][i]]),
);
const UNSUPER = Object.fromEntries(Object.entries(SUPER).map(([a, b]) => [b, a]));
const UNSUB = Object.fromEntries(Object.entries(SUB).map(([a, b]) => [b, a]));

export type Script = "super" | "sub";

export function isScript(text: string, kind: Script) {
  const back = kind === "super" ? UNSUPER : UNSUB;
  const chars = [...text].filter((c) => c.trim());
  return chars.length > 0 && chars.some((c) => back[c]);
}

/** Converts to super/subscript where Unicode has a matching character; `on: false` converts back. */
export function setScript(text: string, kind: Script, on: boolean) {
  const back = { ...UNSUPER, ...UNSUB };
  const plain = [...text].map((c) => back[c] ?? c).join("");
  if (!on) return plain;
  const table = kind === "super" ? SUPER : SUB;
  return [...plain].map((c) => table[plainChar(c)] ?? c).join("");
}

/** Strips every kind of styling back to ordinary text. */
export function clearFormatting(text: string) {
  return setScript(setMark(setMark(applyStyle(text, { family: "default", bold: false, italic: false }), "underline", false), "strike", false), "super", false);
}

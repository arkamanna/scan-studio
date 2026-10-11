import QRCode from "qrcode";

export type Ecc = "L" | "M" | "Q" | "H";
export type Fill = { type: "solid" | "linear" | "radial"; color: string; color2: string; angle: number };
export type DotShape = "square" | "rounded" | "dots" | "diamond" | "star" | "heart" | "leaf" | "plus";
export type FrameShape = "square" | "rounded" | "circle" | "leaf";
/** Scanners locate a QR code by its solid corner centres, so these stay chunky shapes. */
export type BallShape = "square" | "rounded" | "circle" | "diamond" | "leaf";

export type QrDesign = {
  /** Quick theme the design started from (stays selected while it is customised). */
  theme: string | null;
  dots: DotShape;
  frame: FrameShape;
  ball: BallShape;
  fill: Fill;
  /** null = same paint as the dots */
  eyeColor: string | null;
  background: string;
  transparent: boolean;
  logo: string | null;
  /** Logo width as a percentage of the code width. */
  logoSize: number;
  logoClear: boolean;
  caption: string;
  captionColor: string;
  /** Caption font size as a percentage of the image width. */
  captionSize: number;
};

export const DEFAULT_DESIGN: QrDesign = {
  theme: "Classic",
  dots: "square",
  frame: "square",
  ball: "square",
  fill: { type: "solid", color: "#0f172a", color2: "#7c3aed", angle: 45 },
  eyeColor: null,
  background: "#ffffff",
  transparent: false,
  logo: null,
  logoSize: 22,
  logoClear: true,
  caption: "",
  captionColor: "#0f172a",
  captionSize: 7,
};

const f = (n: number) => +n.toFixed(3);
const pt = (x: number, y: number) => `${f(x)} ${f(y)}`;

/** Rectangle path with individual corner radii [top-left, top-right, bottom-right, bottom-left]. */
export function roundRect(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: number[]) {
  return (
    `M${pt(x + tl, y)}H${f(x + w - tr)}A${f(tr)} ${f(tr)} 0 0 1 ${pt(x + w, y + tr)}` +
    `V${f(y + h - br)}A${f(br)} ${f(br)} 0 0 1 ${pt(x + w - br, y + h)}` +
    `H${f(x + bl)}A${f(bl)} ${f(bl)} 0 0 1 ${pt(x, y + h - bl)}` +
    `V${f(y + tl)}A${f(tl)} ${f(tl)} 0 0 1 ${pt(x + tl, y)}Z`
  );
}

const circle = (cx: number, cy: number, r: number) =>
  `M${pt(cx - r, cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

const polygon = (points: [number, number][]) => `M${points.map(([x, y]) => pt(x, y)).join("L")}Z`;

function star(cx: number, cy: number, outer: number, inner: number, spikes = 5) {
  const points: [number, number][] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return polygon(points);
}

function heart(x: number, y: number, s: number) {
  const p = (a: number, b: number) => pt(x + a * s, y + b * s);
  return (
    `M${p(0.5, 0.92)}C${p(0.12, 0.62)} ${p(0, 0.42)} ${p(0.08, 0.24)}C${p(0.18, 0.04)} ${p(0.42, 0.04)} ${p(0.5, 0.24)}` +
    `C${p(0.58, 0.04)} ${p(0.82, 0.04)} ${p(0.92, 0.24)}C${p(1, 0.42)} ${p(0.88, 0.62)} ${p(0.5, 0.92)}Z`
  );
}

export function dotPath(shape: DotShape, x: number, y: number) {
  switch (shape) {
    case "rounded":
      return roundRect(x + 0.05, y + 0.05, 0.9, 0.9, [0.3, 0.3, 0.3, 0.3]);
    case "dots":
      return circle(x + 0.5, y + 0.5, 0.45);
    case "diamond":
      return polygon([[x + 0.5, y - 0.02], [x + 1.02, y + 0.5], [x + 0.5, y + 1.02], [x - 0.02, y + 0.5]]);
    case "star":
      return star(x + 0.5, y + 0.54, 0.56, 0.25);
    case "heart":
      return heart(x, y, 1);
    case "leaf":
      return roundRect(x + 0.04, y + 0.04, 0.92, 0.92, [0.5, 0, 0.5, 0]);
    case "plus": {
      const a = 0.32;
      const b = 0.68;
      return polygon([
        [x + a, y], [x + b, y], [x + b, y + a], [x + 1, y + a], [x + 1, y + b], [x + b, y + b],
        [x + b, y + 1], [x + a, y + 1], [x + a, y + b], [x, y + b], [x, y + a], [x + a, y + a],
      ]);
    }
    default:
      return `M${pt(x, y)}h1v1h-1Z`;
  }
}

/** corner: 0 = top-left, 1 = top-right, 2 = bottom-left (leaf shapes are mirrored to point outwards). */
export function framePath(shape: FrameShape, x: number, y: number, corner = 0) {
  const leaf = (r: number) => (corner === 0 ? [r, 0, r, 0] : [0, r, 0, r]);
  const [outer, inner] =
    shape === "rounded" ? [[2, 2, 2, 2], [1.2, 1.2, 1.2, 1.2]]
    : shape === "circle" ? [[3.5, 3.5, 3.5, 3.5], [2.5, 2.5, 2.5, 2.5]]
    : shape === "leaf" ? [leaf(3), leaf(2)]
    : [[0, 0, 0, 0], [0, 0, 0, 0]];
  return roundRect(x, y, 7, 7, outer) + roundRect(x + 1, y + 1, 5, 5, inner);
}

export function ballPath(shape: BallShape, x: number, y: number, corner = 0) {
  const bx = x + 2;
  const by = y + 2;
  switch (shape) {
    case "rounded":
      return roundRect(bx, by, 3, 3, [0.9, 0.9, 0.9, 0.9]);
    case "circle":
      return circle(x + 3.5, y + 3.5, 1.5);
    case "diamond":
      return polygon([[x + 3.5, by - 0.2], [bx + 3.2, y + 3.5], [x + 3.5, by + 3.2], [bx - 0.2, y + 3.5]]);
    case "leaf":
      return roundRect(bx, by, 3, 3, corner === 0 ? [1.5, 0, 1.5, 0] : [0, 1.5, 0, 1.5]);
    default:
      return roundRect(bx, by, 3, 3, [0, 0, 0, 0]);
  }
}

export const escapeXml = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Gradient definition covering the box (x, y, w, h) in the referencing element's user space. */
export function gradientDef(id: string, fill: Fill, x: number, y: number, w: number, h: number) {
  const stops = `<stop offset="0" stop-color="${fill.color}"/><stop offset="1" stop-color="${fill.color2}"/>`;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (fill.type === "radial") {
    return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.hypot(w, h) / 2)}">${stops}</radialGradient>`;
  }
  if (fill.type === "linear") {
    const a = (fill.angle * Math.PI) / 180;
    const dx = (Math.cos(a) * w) / 2;
    const dy = (Math.sin(a) * h) / 2;
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(cx - dx)}" y1="${f(cy - dy)}" x2="${f(cx + dx)}" y2="${f(cy + dy)}">${stops}</linearGradient>`;
  }
  return "";
}

export const paint = (fill: Fill, id: string) => (fill.type === "solid" ? fill.color : `url(#${id})`);

export const CAPTION_FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Caption text that shrinks to fit when it would be wider than maxWidth. */
export function captionText(text: string, x: number, baseline: number, size: number, maxWidth: number, fill: string, weight = 700) {
  const estimated = text.length * size * 0.58;
  const fit = estimated > maxWidth ? ` textLength="${f(maxWidth)}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text x="${f(x)}" y="${f(baseline)}" font-family="${CAPTION_FONT}" font-size="${f(size)}" font-weight="${weight}" fill="${fill}" text-anchor="middle"${fit}>${escapeXml(text)}</text>`;
}

const QUIET = 3;

/** `id` must be unique among SVGs inlined on the same page, since gradient ids are document-wide. */
export function renderQr(payload: string, ecc: Ecc, d: QrDesign, id = "qr") {
  const qr = QRCode.create(payload, { errorCorrectionLevel: ecc });
  const n = qr.modules.size;
  const bits = qr.modules.data;
  const width = n + QUIET * 2;

  const caption = d.caption.trim();
  const fontSize = (width * d.captionSize) / 100;
  const top = caption ? QUIET * 0.7 + fontSize * 1.3 : 0;
  const height = top + width;

  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  let logoBox: { x: number; y: number; size: number } | null = null;
  if (d.logo) {
    const size = (n * d.logoSize) / 100;
    logoBox = { x: (n - size) / 2, y: (n - size) / 2, size };
  }
  const pad = 0.6;
  const underLogo = (r: number, c: number) =>
    !!logoBox && d.logoClear && c + 1 > logoBox.x - pad && c < logoBox.x + logoBox.size + pad && r + 1 > logoBox.y - pad && r < logoBox.y + logoBox.size + pad;

  let dots = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (bits[r * n + c] && !inFinder(r, c) && !underLogo(r, c)) dots += dotPath(d.dots, c, r);
    }
  }

  const corners: [number, number, number][] = [[0, 0, 0], [n - 7, 0, 1], [0, n - 7, 2]];
  const frames = corners.map(([x, y, i]) => framePath(d.frame, x, y, i)).join("");
  const balls = corners.map(([x, y, i]) => ballPath(d.ball, x, y, i)).join("");

  const gradientId = `${id}-fill`;
  const dotPaint = paint(d.fill, gradientId);
  const eyePaint = d.eyeColor ?? dotPaint;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(width)} ${f(height)}" width="${f(width * 10)}" height="${f(height * 10)}">`,
    `<defs>${gradientDef(gradientId, d.fill, 0, 0, n, n)}</defs>`,
    d.transparent ? "" : `<rect width="100%" height="100%" fill="${d.background}"/>`,
    caption ? captionText(caption, width / 2, QUIET * 0.7 + fontSize, fontSize, width - QUIET * 1.5, d.captionColor) : "",
    `<g transform="translate(${QUIET} ${f(top + QUIET)})">`,
    `<path d="${dots}" fill="${dotPaint}"${d.dots === "square" ? ' shape-rendering="crispEdges"' : ""}/>`,
    `<path d="${frames}" fill="${eyePaint}" fill-rule="evenodd"/>`,
    `<path d="${balls}" fill="${eyePaint}"/>`,
    logoBox
      ? `<image href="${d.logo}" x="${f(logoBox.x)}" y="${f(logoBox.y)}" width="${f(logoBox.size)}" height="${f(logoBox.size)}" preserveAspectRatio="xMidYMid meet"/>`
      : "",
    "</g></svg>",
  ];
  return { svg: parts.join(""), width, height };
}

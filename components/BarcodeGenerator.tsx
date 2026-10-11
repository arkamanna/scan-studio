"use client";

import { useEffect, useMemo, useState } from "react";
import JsBarcode from "jsbarcode";
import { Barcode, Check, Copy, Download, Palette, Printer, ScanBarcode, Share2, Shuffle } from "lucide-react";
import { Field, Input } from "./ui";
import { CollapsibleCard, ColorField, FillPicker, ImagePicker, Slider } from "./design-controls";
import { copyPng, printSvg, saveBlob, sharePng } from "@/lib/share";
import { captionText, gradientDef, paint, type Fill } from "@/lib/qr-design";
import { svgToPng } from "@/lib/raster";

type Format = {
  id: string;
  label: string;
  use: string;
  rule: string;
  sample: string;
  /** Example "Text under the bars" filled in when the type is picked. */
  caption: string;
  numeric?: boolean;
  upper?: boolean;
};

const FORMATS: Format[] = [
  { id: "CODE128", label: "Code 128", use: "General purpose, shipping, inventory", rule: "Any letters, numbers and symbols (ASCII).", sample: "SCAN-STUDIO-2026", caption: "SKU SCAN-STUDIO-2026" },
  { id: "EAN13", label: "EAN-13", use: "Retail products worldwide", rule: "12 digits (check digit is added) or 13 digits.", sample: "590123412345", caption: "5901234123457", numeric: true },
  { id: "UPC", label: "UPC-A", use: "Retail products in US / Canada", rule: "11 digits (check digit is added) or 12 digits.", sample: "03600029145", caption: "036000291452", numeric: true },
  { id: "EAN8", label: "EAN-8", use: "Small retail packages", rule: "7 digits (check digit is added) or 8 digits.", sample: "9638507", caption: "96385074", numeric: true },
  { id: "CODE39", label: "Code 39", use: "Badges, automotive, defence", rule: "A–Z, 0–9, space and - . $ / + %", sample: "BADGE 0042", caption: "Visitor badge 0042", upper: true },
  { id: "CODE93", label: "Code 93", use: "Logistics, compact Code 39", rule: "A–Z, 0–9, space and - . $ / + %", sample: "PARCEL-93", caption: "Parcel PARCEL-93", upper: true },
  { id: "ITF14", label: "ITF-14", use: "Shipping cartons & pallets", rule: "13 digits (check digit is added) or 14 digits.", sample: "1540014128876", caption: "15400141288763", numeric: true },
  { id: "ITF", label: "ITF", use: "Warehouses, distribution", rule: "An even number of digits.", sample: "12345678", caption: "Bin 12-34-56-78", numeric: true },
  { id: "codabar", label: "Codabar", use: "Libraries, blood banks, labs", rule: "Digits and - $ : / . + with optional A–D start/stop letters.", sample: "A40156B", caption: "Library book 40156", upper: true },
  { id: "MSI", label: "MSI Plessey", use: "Shelf labels, stock control", rule: "Digits only.", sample: "1234567", caption: "Shelf 1234567", numeric: true },
  { id: "pharmacode", label: "Pharmacode", use: "Pharmaceutical packaging", rule: "A whole number from 3 to 131070.", sample: "1234", caption: "Pharma 1234", numeric: true },
];

const PRESETS = [
  { fg: "#000000", bg: "#ffffff" },
  { fg: "#0f172a", bg: "#f8fafc" },
  { fg: "#4c1d95", bg: "#ffffff" },
  { fg: "#0e7490", bg: "#ffffff" },
  { fg: "#7f1d1d", bg: "#fffbeb" },
];

const SVG_NS = "http://www.w3.org/2000/svg";
/** Placeholder bar colour swapped for the real paint (solid or gradient) after JsBarcode renders. */
const SENTINEL = "#010203";
const MARGIN = 12;

type Rendered = { svg: string; width: number; height: number };

export default function BarcodeGenerator() {
  const [formatId, setFormatId] = useState(FORMATS[0].id);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [showText, setShowText] = useState(true);
  const [barWidth, setBarWidth] = useState(2);
  const [height, setHeight] = useState(100);
  const [fontSize, setFontSize] = useState(18);
  const [fill, setFill] = useState<Fill>({ type: "solid", color: PRESETS[0].fg, color2: "#7c3aed", angle: 0 });
  const [bg, setBg] = useState(PRESETS[0].bg);
  const [transparent, setTransparent] = useState(false);
  const [topText, setTopText] = useState("");
  const [topSize, setTopSize] = useState(20);
  const [topColor, setTopColor] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [imageHeight, setImageHeight] = useState(48);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const format = FORMATS.find((f) => f.id === formatId)!;
  /** Until the user types a value, the preview shows the type's example (the same text as the placeholders). */
  const isExample = !value.trim();
  const data = value.trim() || format.sample;
  const valid = Boolean(rendered);

  const options = useMemo(
    () => ({
      format: formatId,
      width: barWidth,
      height,
      displayValue: showText,
      text: label.trim() || (isExample ? format.caption : undefined),
      fontSize,
      font: "ui-monospace, Menlo, monospace",
      textMargin: 4,
      margin: 0,
      lineColor: SENTINEL,
      background: "",
    }),
    [formatId, barWidth, height, showText, label, isExample, format.caption, fontSize],
  );

  useEffect(() => {
    if (!data) {
      setRendered(null);
      return;
    }
    const tmp = document.createElementNS(SVG_NS, "svg");
    let ok = true;
    try {
      JsBarcode(tmp, data, { ...options, valid: (v) => (ok = v) });
    } catch {
      ok = false;
    }
    if (!ok) {
      setRendered(null);
      return;
    }

    const barsW = parseFloat(tmp.getAttribute("width") ?? "0");
    const barsH = parseFloat(tmp.getAttribute("height") ?? "0");
    const barPaint = paint(fill, "bc-fill");
    const bars = tmp.innerHTML.replaceAll(`"${SENTINEL}"`, `"${barPaint}"`);
    const width = barsW + MARGIN * 2;

    const parts: string[] = [];
    let y = MARGIN;
    if (image) {
      parts.push(`<image href="${image}" x="${MARGIN}" y="${y}" width="${barsW}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet"/>`);
      y += imageHeight + 8;
    }
    const top = topText.trim();
    if (top) {
      parts.push(captionText(top, width / 2, y + topSize * 0.85, topSize, barsW, topColor ?? barPaint, 600));
      y += topSize + 8;
    }
    parts.push(`<g transform="translate(${MARGIN} ${y})">${bars}</g>`);
    const total = y + barsH + MARGIN;

    setRendered({
      width,
      height: total,
      svg:
        `<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} ${total}" width="${width}" height="${total}">` +
        `<defs>${gradientDef("bc-fill", fill, 0, 0, barsW, barsH)}</defs>` +
        (transparent ? "" : `<rect width="100%" height="100%" fill="${bg}"/>`) +
        parts.join("") +
        "</svg>",
    });
  }, [data, options, fill, bg, transparent, topText, topSize, topColor, image, imageHeight]);

  const sanitize = (raw: string, f = format) => {
    if (f.numeric) return raw.replace(/\D/g, "");
    if (f.upper) return raw.toUpperCase();
    return raw;
  };

  const fillExample = (f: Format) => {
    setValue(f.sample);
    setLabel(f.caption);
    setShowText(true);
  };

  const chooseFormat = (f: Format) => {
    setFormatId(f.id);
    setValue("");
    setLabel("");
  };

  const notify = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1600);
  };

  const pngBlob = () => svgToPng(rendered!.svg, rendered!.width * 4, rendered!.height * 4);

  const filename = (ext: string) => `barcode-${formatId.toLowerCase()}-${data.replace(/[^\w-]+/g, "_").slice(0, 40)}.${ext}`;

  const download = async (type: "png" | "svg") => {
    const blob = type === "png" ? await pngBlob() : new Blob([rendered!.svg], { type: "image/svg+xml" });
    saveBlob(blob, filename(type));
  };

  const copyImage = async () => notify((await copyPng(pngBlob())) ? "Image copied" : "Copy not supported here");

  const share = async () => {
    if (!(await sharePng(await pngBlob(), filename("png"), "Barcode"))) notify("Sharing not supported here");
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Barcode type</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => chooseFormat(f)}
                className={`cursor-pointer rounded-2xl border px-3 py-2.5 text-left transition ${
                  f.id === formatId
                    ? "border-violet-400/50 bg-gradient-to-b from-violet-500/25 to-cyan-500/10 shadow-[0_0_0_3px_rgba(139,92,246,0.12)]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span className={`block text-sm font-medium ${f.id === formatId ? "text-white" : "text-slate-200"}`}>{f.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{f.use}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-6">
            <Field
              label="Barcode value"
              hint={!isExample && !valid ? <span className="text-amber-400">Not valid for {format.label}: {format.rule}</span> : format.rule}
            >
              <div className="flex gap-2">
                <Input
                  autoFocus
                  inputMode={format.numeric ? "numeric" : "text"}
                  placeholder={format.sample}
                  value={value}
                  onChange={(e) => setValue(sanitize(e.target.value))}
                  className="font-mono"
                />
                <button type="button" className="btn-ghost shrink-0" onClick={() => fillExample(format)} title="Fill with an example">
                  <Shuffle size={16} />
                  <span className="hidden sm:inline">Example</span>
                </button>
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Text under the bars">
                <div className="flex items-center gap-2">
                  <Input placeholder={isExample ? format.caption : "Same as value"} value={label} disabled={!showText} onChange={(e) => setLabel(e.target.value)} />
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                    <input type="checkbox" className="size-4 accent-violet-500" checked={showText} onChange={(e) => setShowText(e.target.checked)} />
                    Show
                  </label>
                </div>
              </Field>
              <Slider label="Text size" value={fontSize} min={10} max={32} unit="px" onChange={setFontSize} disabled={!showText} />
              <Slider label="Bar width" value={barWidth} min={1} max={5} step={0.5} unit="px" onChange={setBarWidth} />
              <Slider label="Bar height" value={height} min={30} max={200} step={5} unit="px" onChange={setHeight} />
            </div>
          </div>
        </section>

        <CollapsibleCard title="Design" subtitle="Colours, a heading and an image above the bars. Changes show live in the preview." icon={<Palette size={18} />}>

          <div className="space-y-4">
            <Field label="Quick colours">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.fg + p.bg}
                    type="button"
                    onClick={() => {
                      setFill((f) => ({ ...f, type: "solid", color: p.fg }));
                      setBg(p.bg);
                      setTransparent(false);
                    }}
                    className={`grid size-8 cursor-pointer place-items-center rounded-full border-2 transition ${
                      fill.type === "solid" && fill.color === p.fg && bg === p.bg && !transparent ? "border-violet-400" : "border-white/10"
                    }`}
                    style={{ background: p.bg }}
                    aria-label="Colour preset"
                  >
                    <span className="h-3.5 w-1.5 rounded-sm" style={{ background: p.fg }} />
                  </button>
                ))}
              </div>
            </Field>
            <FillPicker label="Bar colour" value={fill} onChange={setFill} />
            <div className="space-y-2">
              <div className={transparent ? "pointer-events-none opacity-40" : ""}>
                <ColorField label="Background" value={bg} onChange={setBg} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" className="size-4 accent-violet-500" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
                Transparent background
              </label>
            </div>
            <p className="text-xs text-slate-500">Scanners need dark bars on a light background, so keep strong contrast.</p>
          </div>

          <div className="grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-2">
            <div className="space-y-4">
              <Field label="Text above the bars">
                <Input placeholder="e.g. Product name or price" value={topText} maxLength={60} onChange={(e) => setTopText(e.target.value)} />
              </Field>
              {topText.trim() && (
                <>
                  <Slider label="Heading size" value={topSize} min={10} max={40} unit="px" onChange={setTopSize} />
                  {topColor === null ? null : <ColorField label="Heading colour" value={topColor} onChange={setTopColor} />}
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      className="size-4 accent-violet-500"
                      checked={topColor === null}
                      onChange={(e) => setTopColor(e.target.checked ? null : fill.color)}
                    />
                    Same colour as the bars
                  </label>
                </>
              )}
            </div>
            <div className="space-y-4">
              <ImagePicker
                label="Image / logo"
                value={image}
                onChange={setImage}
                hint="Shown centred above the bars. Anything covering the bars stops a barcode from scanning."
              />
              {image && <Slider label="Image height" value={imageHeight} min={20} max={160} step={4} unit="px" onChange={setImageHeight} />}
            </div>
          </div>
        </CollapsibleCard>
      </div>

      <aside className="lg:sticky lg:top-6">
        <div className="card p-5 sm:p-6">
          <div
            className="relative grid min-h-[200px] w-full place-items-center overflow-hidden rounded-3xl p-4 transition-colors"
            style={{
              background: !valid ? "rgba(0,0,0,0.25)" : transparent ? "repeating-conic-gradient(#e2e8f0 0 25%, #ffffff 0 50%) 0 0 / 16px 16px" : bg,
            }}
          >
            {rendered ? (
              <div
                className="flex w-full justify-center [&>svg]:h-auto [&>svg]:max-h-[320px] [&>svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: rendered.svg }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 text-center text-slate-500">
                <Barcode size={64} strokeWidth={1.2} className="text-slate-600" />
                <p className={`text-sm ${data ? "text-amber-300" : ""}`}>
                  {data ? `This value can’t be encoded as ${format.label}.` : "Your barcode appears here as you type"}
                </p>
              </div>
            )}
            {rendered && isExample && (
              <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white shadow">
                Example · type a value to replace
              </span>
            )}
            {flash && (
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1 text-xs text-white shadow-lg">
                <Check size={12} className="mr-1 inline" />
                {flash}
              </span>
            )}
          </div>

          {valid && (
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2.5 text-sm">
              <ScanBarcode size={16} className="shrink-0 text-emerald-300" />
              <span className="text-slate-400">Reads with</span>
              <span className="truncate font-medium text-emerald-200">POS & warehouse scanners, scanner apps</span>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button className="btn-primary" disabled={!valid} onClick={() => download("png")}>
              <Download size={16} /> PNG
            </button>
            <button className="btn-primary" disabled={!valid} onClick={() => download("svg")}>
              <Download size={16} /> SVG
            </button>
            <button className="btn-ghost" disabled={!valid} onClick={copyImage}>
              <Copy size={16} /> Copy image
            </button>
            <button className="btn-ghost" disabled={!valid} onClick={share}>
              <Share2 size={16} /> Share
            </button>
            <button className="btn-ghost col-span-2" disabled={!valid} onClick={() => printSvg(rendered!.svg, "Barcode", 70)}>
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

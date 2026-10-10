"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Barcode, Check, Copy, Download, ScanBarcode, Share2, Shuffle } from "lucide-react";
import { Field, Input } from "./ui";
import { copyPng, saveBlob, sharePng } from "@/lib/share";

type Format = {
  id: string;
  label: string;
  use: string;
  rule: string;
  sample: string;
  numeric?: boolean;
  upper?: boolean;
};

const FORMATS: Format[] = [
  { id: "CODE128", label: "Code 128", use: "General purpose, shipping, inventory", rule: "Any letters, numbers and symbols (ASCII).", sample: "SCAN-STUDIO-2026" },
  { id: "EAN13", label: "EAN-13", use: "Retail products worldwide", rule: "12 digits (check digit is added) or 13 digits.", sample: "590123412345", numeric: true },
  { id: "UPC", label: "UPC-A", use: "Retail products in US / Canada", rule: "11 digits (check digit is added) or 12 digits.", sample: "03600029145", numeric: true },
  { id: "EAN8", label: "EAN-8", use: "Small retail packages", rule: "7 digits (check digit is added) or 8 digits.", sample: "9638507", numeric: true },
  { id: "CODE39", label: "Code 39", use: "Badges, automotive, defence", rule: "A–Z, 0–9, space and - . $ / + %", sample: "BADGE 0042", upper: true },
  { id: "CODE93", label: "Code 93", use: "Logistics, compact Code 39", rule: "A–Z, 0–9, space and - . $ / + %", sample: "PARCEL-93", upper: true },
  { id: "ITF14", label: "ITF-14", use: "Shipping cartons & pallets", rule: "13 digits (check digit is added) or 14 digits.", sample: "1540014128876", numeric: true },
  { id: "ITF", label: "ITF", use: "Warehouses, distribution", rule: "An even number of digits.", sample: "12345678", numeric: true },
  { id: "codabar", label: "Codabar", use: "Libraries, blood banks, labs", rule: "Digits and - $ : / . + with optional A–D start/stop letters.", sample: "A40156B", upper: true },
  { id: "MSI", label: "MSI Plessey", use: "Shelf labels, stock control", rule: "Digits only.", sample: "1234567", numeric: true },
  { id: "pharmacode", label: "Pharmacode", use: "Pharmaceutical packaging", rule: "A whole number from 3 to 131070.", sample: "1234", numeric: true },
];

const PRESETS = [
  { fg: "#000000", bg: "#ffffff" },
  { fg: "#0f172a", bg: "#f8fafc" },
  { fg: "#4c1d95", bg: "#ffffff" },
  { fg: "#0e7490", bg: "#ffffff" },
  { fg: "#7f1d1d", bg: "#fffbeb" },
];

function Range({ label, value, min, max, step = 1, unit = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full cursor-pointer accent-violet-500" />
        <span className="w-12 text-right text-xs tabular-nums text-slate-400">
          {value}
          {unit}
        </span>
      </div>
    </Field>
  );
}

export default function BarcodeGenerator() {
  const [formatId, setFormatId] = useState("CODE128");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [showText, setShowText] = useState(true);
  const [barWidth, setBarWidth] = useState(2);
  const [height, setHeight] = useState(100);
  const [fontSize, setFontSize] = useState(18);
  const [fg, setFg] = useState(PRESETS[0].fg);
  const [bg, setBg] = useState(PRESETS[0].bg);
  const [valid, setValid] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const format = FORMATS.find((f) => f.id === formatId)!;
  const data = value.trim();

  const options = useMemo(
    () => ({
      format: formatId,
      width: barWidth,
      height,
      displayValue: showText,
      text: label.trim() || undefined,
      fontSize,
      font: "ui-monospace, Menlo, monospace",
      textMargin: 4,
      margin: 12,
      lineColor: fg,
      background: bg,
    }),
    [formatId, barWidth, height, showText, label, fontSize, fg, bg],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (!data) {
      svg.innerHTML = "";
      setValid(false);
      return;
    }
    let ok = true;
    try {
      JsBarcode(svg, data, { ...options, valid: (v) => (ok = v) });
    } catch {
      ok = false;
    }
    setValid(ok);
  }, [data, options]);

  const sanitize = (raw: string) => {
    if (format.numeric) return raw.replace(/\D/g, "");
    if (format.upper) return raw.toUpperCase();
    return raw;
  };

  const chooseFormat = (f: Format) => {
    setFormatId(f.id);
    setValue((v) => (f.numeric ? v.replace(/\D/g, "") : f.upper ? v.toUpperCase() : v));
  };

  const notify = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1600);
  };

  const pngBlob = () =>
    new Promise<Blob>((resolve, reject) => {
      const scale = 4;
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, data, { ...options, width: barWidth * scale, height: height * scale, fontSize: fontSize * scale, textMargin: 4 * scale, margin: 12 * scale });
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn’t render image"))), "image/png");
    });

  const filename = (ext: string) => `barcode-${formatId.toLowerCase()}-${data.replace(/[^\w-]+/g, "_").slice(0, 40)}.${ext}`;

  const download = async (type: "png" | "svg") => {
    const blob = type === "png" ? await pngBlob() : new Blob([new XMLSerializer().serializeToString(svgRef.current!)], { type: "image/svg+xml" });
    saveBlob(blob, filename(type));
  };

  const copyImage = async () => notify((await copyPng(pngBlob())) ? "Image copied" : "Copy not supported here");

  const share = async () => {
    if (!(await sharePng(await pngBlob(), filename("png"), "Barcode"))) notify("Sharing not supported here");
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
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
            hint={data && !valid ? <span className="text-amber-400">Not valid for {format.label}: {format.rule}</span> : format.rule}
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
              <button type="button" className="btn-ghost shrink-0" onClick={() => setValue(format.sample)} title="Fill with an example">
                <Shuffle size={16} />
                <span className="hidden sm:inline">Example</span>
              </button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Text under the bars">
              <div className="flex items-center gap-2">
                <Input placeholder="Same as value" value={label} disabled={!showText} onChange={(e) => setLabel(e.target.value)} />
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                  <input type="checkbox" className="size-4 accent-violet-500" checked={showText} onChange={(e) => setShowText(e.target.checked)} />
                  Show
                </label>
              </div>
            </Field>
            <Range label="Text size" value={fontSize} min={10} max={32} unit="px" onChange={setFontSize} />
            <Range label="Bar width" value={barWidth} min={1} max={5} step={0.5} unit="px" onChange={setBarWidth} />
            <Range label="Bar height" value={height} min={30} max={200} step={5} unit="px" onChange={setHeight} />
          </div>
        </div>
      </section>

      <aside className="lg:sticky lg:top-6">
        <div className="card p-5 sm:p-6">
          <div
            className="relative grid min-h-[200px] w-full place-items-center overflow-hidden rounded-3xl p-4 transition-colors"
            style={{ background: valid ? bg : "rgba(0,0,0,0.25)" }}
          >
            <svg ref={svgRef} className={`h-auto max-h-[280px] max-w-full ${valid ? "" : "hidden"}`} />
            {!valid && (
              <div className="flex flex-col items-center gap-3 px-6 text-center text-slate-500">
                <Barcode size={64} strokeWidth={1.2} className="text-slate-600" />
                <p className={`text-sm ${data ? "text-amber-300" : ""}`}>
                  {data ? `This value can’t be encoded as ${format.label}.` : "Your barcode appears here as you type"}
                </p>
              </div>
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
            <button className="btn-primary col-span-2" disabled={!valid} onClick={() => download("png")}>
              <Download size={16} /> Download PNG
            </button>
            <button className="btn-ghost" disabled={!valid} onClick={() => download("svg")}>
              <Download size={16} /> SVG
            </button>
            <button className="btn-ghost" disabled={!valid} onClick={copyImage}>
              <Copy size={16} /> Copy image
            </button>
            <button className="btn-ghost col-span-2" disabled={!valid} onClick={share}>
              <Share2 size={16} /> Share
            </button>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Colors</span>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.fg + p.bg}
                  onClick={() => {
                    setFg(p.fg);
                    setBg(p.bg);
                  }}
                  className={`grid size-8 cursor-pointer place-items-center rounded-full border-2 transition ${fg === p.fg && bg === p.bg ? "border-violet-400" : "border-white/10"}`}
                  style={{ background: p.bg }}
                  aria-label="Color preset"
                >
                  <span className="h-3.5 w-1.5 rounded-sm" style={{ background: p.fg }} />
                </button>
              ))}
              <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent" />
                Bars
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent" />
                Background
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">Scanners need dark bars on a light background — keep strong contrast.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

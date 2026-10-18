"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Copy, Download, LoaderCircle, Palette, Printer, Share2, ShieldCheck, Shuffle } from "lucide-react";
import { Field, Input, TextArea } from "./ui";
import { CollapsibleCard, ColorField, FillPicker, ImagePicker, Segmented, Slider } from "./design-controls";
import { copyPng, printSvg, saveBlob, sharePng } from "@/lib/share";
import { captionText, gradientDef, paint, type Fill } from "@/lib/qr-design";
import { svgToPng } from "@/lib/raster";
import { getDetector } from "@/lib/detector";
import { on, takeFill, type CodeFill } from "@/lib/app-events";
import { RMQR_VERSIONS, type CodeGroup, type CodeType } from "@/lib/code-types";

type Bwip = typeof import("bwip-js/browser");
type Rotation = "N" | "R" | "I" | "L";
type Rendered = { svg: string; width: number; height: number };
type ScanState = { state: "checking" } | { state: "ok" } | { state: "mismatch"; text: string } | { state: "unread" };

const SVG_NS = "http://www.w3.org/2000/svg";
/** Placeholder ink colour swapped for the real paint (solid or gradient) after bwip-js renders. */
const SENTINEL = "010203";

const PRESETS = [
  { fg: "#000000", bg: "#ffffff" },
  { fg: "#0f172a", bg: "#f8fafc" },
  { fg: "#4c1d95", bg: "#ffffff" },
  { fg: "#0e7490", bg: "#ffffff" },
  { fg: "#7f1d1d", bg: "#fffbeb" },
];

const ROTATIONS: { id: Rotation; label: string }[] = [
  { id: "N", label: "0°" },
  { id: "R", label: "90°" },
  { id: "I", label: "180°" },
  { id: "L", label: "270°" },
];

/** bwip-js errors look like "bwipp.datamatrixTooLong#123: Message"; keep the readable part. */
const errorText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^.*?#\d+:\s*/, "");

const normalise = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "").toUpperCase();

function renderSymbol(bwip: Bwip, type: CodeType, text: string, opts: Record<string, string | number | boolean>) {
  const base = { bcid: type.bcid, text, barcolor: SENTINEL, textcolor: SENTINEL, ...type.options, ...opts };
  if (type.bcid !== "rectangularmicroqrcode") return bwip.toSVG(base as Parameters<Bwip["toSVG"]>[0]);
  let last: unknown;
  for (const version of RMQR_VERSIONS) {
    try {
      return bwip.toSVG({ ...base, version } as Parameters<Bwip["toSVG"]>[0]);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

export default function CodeGenerator({ group }: { group: CodeGroup }) {
  const [bwip, setBwip] = useState<Bwip | null>(null);
  const [typeId, setTypeId] = useState(group.types[0].bcid);
  const [value, setValue] = useState("");
  const [showText, setShowText] = useState(true);
  const [barHeight, setBarHeight] = useState(12);
  const [quiet, setQuiet] = useState(true);
  const [rotate, setRotate] = useState<Rotation>("N");
  const [fill, setFill] = useState<Fill>({ type: "solid", color: PRESETS[0].fg, color2: "#7c3aed", angle: 0 });
  const [bg, setBg] = useState(PRESETS[0].bg);
  const [transparent, setTransparent] = useState(false);
  const [topText, setTopText] = useState("");
  const [topSize, setTopSize] = useState(20);
  const [image, setImage] = useState<string | null>(null);
  const [imageHeight, setImageHeight] = useState(48);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [checkSvg, setCheckSvg] = useState<Rendered | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<ScanState | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const checkRun = useRef(0);

  const type = group.types.find((t) => t.bcid === typeId)!;
  const isExample = !value.trim();
  const data = value.trim() || type.sample;
  const valid = Boolean(rendered);
  const linear = type.kind === "linear";
  const is2d = type.kind === "2d";

  useEffect(() => {
    import("bwip-js/browser").then(setBwip);
  }, []);

  useEffect(() => {
    const apply = (fill?: CodeFill) => {
      if (fill?.tab !== group.id) return;
      const t = group.types.find((x) => x.bcid.toLowerCase() === fill.type.toLowerCase() || x.label.toLowerCase() === fill.type.toLowerCase()) ?? group.types[0];
      setTypeId(t.bcid);
      setValue(t.numeric ? fill.value.replace(/\D/g, "") : t.upper ? fill.value.toUpperCase() : fill.value);
    };
    apply(takeFill(group.id));
    return on("ss:fill", apply);
  }, [group]);

  useEffect(() => {
    if (!bwip || !data) return;
    let symbol: string;
    try {
      symbol = renderSymbol(bwip, type, data, {
        rotate,
        ...(linear ? { includetext: showText, textxalign: "center", height: barHeight } : {}),
      });
    } catch (e) {
      setRendered(null);
      setCheckSvg(null);
      setError(errorText(e));
      return;
    }
    setError(null);

    const [, , w, h] = (symbol.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 0 0").split(/\s+/).map(Number);
    const inner = symbol.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const margin = quiet ? Math.max(8, Math.round(Math.min(w, h) * (is2d ? 0.1 : 0.06))) : 4;
    const width = w + margin * 2;

    const build = (ink: string, background: string | null) => {
      const parts: string[] = [];
      let y = margin;
      if (image) {
        parts.push(`<image href="${image}" x="${margin}" y="${y}" width="${w}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet"/>`);
        y += imageHeight + 8;
      }
      const top = topText.trim();
      if (top) {
        parts.push(captionText(top, width / 2, y + topSize * 0.85, topSize, w, ink, 600));
        y += topSize + 8;
      }
      parts.push(`<g transform="translate(${margin} ${y})">${inner.replaceAll(`"#${SENTINEL}"`, `"${ink}"`)}</g>`);
      const total = y + h + margin;
      return {
        width,
        height: total,
        svg:
          `<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} ${total}" width="${width}" height="${total}">` +
          `<defs>${gradientDef("cg-fill", fill, 0, 0, w, h)}</defs>` +
          (background ? `<rect width="100%" height="100%" fill="${background}"/>` : "") +
          parts.join("") +
          "</svg>",
      };
    };

    setRendered(build(paint(fill, "cg-fill"), transparent ? null : bg));
    // Read-back check always uses an opaque background, as a printed label would have.
    setCheckSvg(build(paint(fill, "cg-fill"), transparent ? "#ffffff" : bg));
  }, [bwip, type, data, rotate, linear, is2d, showText, barHeight, quiet, fill, bg, transparent, topText, topSize, image, imageHeight]);

  // Decode the finished image with the same engine as the scanner, so users know it really scans.
  useEffect(() => {
    if (!checkSvg || !type.scannable) {
      setCheck(null);
      return;
    }
    const run = ++checkRun.current;
    setCheck({ state: "checking" });
    const timer = window.setTimeout(async () => {
      try {
        const f = Math.max(2, Math.min(8, 1200 / Math.max(checkSvg.width, checkSvg.height)));
        const blob = await svgToPng(checkSvg.svg, checkSvg.width * f, checkSvg.height * f);
        const bitmap = await createImageBitmap(blob);
        const codes = await (await getDetector()).detect(bitmap);
        bitmap.close();
        if (run !== checkRun.current) return;
        const want = normalise(data);
        const hit = codes.find((c) => {
          const got = normalise(c.rawValue);
          return got && (got.includes(want) || want.includes(got));
        });
        setCheck(hit ? { state: "ok" } : codes.length ? { state: "mismatch", text: codes[0].rawValue } : { state: "unread" });
      } catch {
        if (run === checkRun.current) setCheck({ state: "unread" });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [checkSvg, type.scannable, data]);

  const sanitize = (raw: string) => {
    if (type.numeric) return raw.replace(/\D/g, "");
    if (type.upper) return raw.toUpperCase();
    return raw;
  };

  const chooseType = (t: CodeType) => {
    setTypeId(t.bcid);
    setValue("");
  };

  const notify = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1600);
  };

  /** Exports at least ~1200px on the longest side so small symbols stay crisp. */
  const exportScale = () => Math.max(4, Math.ceil(1200 / Math.max(rendered!.width, rendered!.height)));
  const pngBlob = () => svgToPng(rendered!.svg, rendered!.width * exportScale(), rendered!.height * exportScale());
  const filename = (ext: string) => `${type.bcid}-${data.replace(/[^\w-]+/g, "_").slice(0, 40)}.${ext}`;

  const download = async (kind: "png" | "svg") => {
    const blob = kind === "png" ? await pngBlob() : new Blob([rendered!.svg], { type: "image/svg+xml" });
    saveBlob(blob, filename(kind));
  };

  const copyImage = async () => notify((await copyPng(pngBlob())) ? "Image copied" : "Copy not supported here");

  const share = async () => {
    if (!(await sharePng(await pngBlob(), filename("png"), type.label))) notify("Sharing not supported here");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_400px] [&>*]:min-w-0">
      <div className="space-y-6">
        <section className="card p-4 sm:p-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.heading}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.types.map((t) => (
              <button
                key={t.bcid}
                type="button"
                onClick={() => chooseType(t)}
                className={`cursor-pointer rounded-2xl border px-3 py-2.5 text-left transition ${
                  t.bcid === typeId
                    ? "border-violet-400/50 bg-gradient-to-b from-violet-500/25 to-cyan-500/10 shadow-[0_0_0_3px_rgba(139,92,246,0.12)]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span className={`block truncate text-sm font-medium ${t.bcid === typeId ? "text-white" : "text-slate-200"}`}>{t.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{t.use}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-6">
            <Field label={`${type.label} value`} hint={!isExample && error ? <span className="text-amber-400">{error}</span> : type.rule}>
              <div className="flex items-start gap-2">
                {type.multiline ? (
                  <TextArea rows={3} placeholder={type.sample} value={value} onChange={(e) => setValue(sanitize(e.target.value))} className="font-mono" />
                ) : (
                  <Input
                    inputMode={type.numeric ? "numeric" : "text"}
                    placeholder={type.sample}
                    value={value}
                    onChange={(e) => setValue(sanitize(e.target.value))}
                    className="font-mono"
                  />
                )}
                <button type="button" className="btn-ghost shrink-0" onClick={() => setValue(type.sample)} title="Fill with an example">
                  <Shuffle size={16} />
                  <span className="hidden sm:inline">Example</span>
                </button>
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {linear && (
                <>
                  <Slider label="Bar height" value={barHeight} min={5} max={30} unit="mm" onChange={setBarHeight} />
                  <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-slate-300">
                    <input type="checkbox" className="size-4 accent-violet-500" checked={showText} onChange={(e) => setShowText(e.target.checked)} />
                    Show text under the bars
                  </label>
                </>
              )}
              <Field label="Rotation">
                <Segmented options={ROTATIONS} value={rotate} onChange={setRotate} />
              </Field>
              <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-slate-300">
                <input type="checkbox" className="size-4 accent-violet-500" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} />
                Quiet zone (blank margin scanners need)
              </label>
            </div>
          </div>
        </section>

        <CollapsibleCard title="Design" subtitle="Colours, a heading and an image above the code. Changes show live in the preview." icon={<Palette size={18} />}>
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
                    <span className="size-3.5 rounded-sm" style={{ background: p.fg }} />
                  </button>
                ))}
              </div>
            </Field>
            <FillPicker label="Code colour" value={fill} onChange={setFill} />
            <div className="space-y-2">
              <div className={transparent ? "pointer-events-none opacity-40" : ""}>
                <ColorField label="Background" value={bg} onChange={setBg} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" className="size-4 accent-violet-500" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
                Transparent background
              </label>
            </div>
            <p className="text-xs text-slate-500">Scanners need a dark code on a light background, so keep strong contrast.</p>
          </div>

          <div className="grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-2">
            <div className="space-y-4">
              <Field label="Text above the code">
                <Input placeholder="e.g. Product or label name" value={topText} maxLength={60} onChange={(e) => setTopText(e.target.value)} />
              </Field>
              {topText.trim() && <Slider label="Heading size" value={topSize} min={10} max={40} unit="px" onChange={setTopSize} />}
            </div>
            <div className="space-y-4">
              <ImagePicker label="Image / logo" value={image} onChange={setImage} hint="Shown centred above the code, never on top of it." />
              {image && <Slider label="Image height" value={imageHeight} min={20} max={160} step={4} unit="px" onChange={setImageHeight} />}
            </div>
          </div>
        </CollapsibleCard>
      </div>

      <aside className="lg:sticky lg:top-6">
        <div className="card p-4 sm:p-6">
          <div
            className="relative grid min-h-[220px] w-full place-items-center overflow-hidden rounded-3xl p-4 transition-colors"
            style={{
              background: !valid ? "rgba(0,0,0,0.25)" : transparent ? "repeating-conic-gradient(#e2e8f0 0 25%, #ffffff 0 50%) 0 0 / 16px 16px" : bg,
            }}
          >
            {rendered ? (
              <div
                className={`flex w-full justify-center [&>svg]:h-auto [&>svg]:max-h-[320px] [&>svg]:w-full ${is2d ? "[&>svg]:max-w-[280px]" : "[&>svg]:max-w-full"}`}
                dangerouslySetInnerHTML={{ __html: rendered.svg }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 text-center text-slate-500">
                {!bwip ? <LoaderCircle size={36} className="animate-spin text-slate-600" /> : null}
                <p className={`text-sm ${error ? "text-amber-300" : ""}`}>{!bwip ? "Loading generator…" : error ? `This value can’t be encoded as ${type.label}.` : "Your code appears here as you type"}</p>
              </div>
            )}
            {rendered && isExample && (
              <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white shadow">Example · type a value to replace</span>
            )}
            {flash && (
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1 text-xs text-white shadow-lg">
                <Check size={12} className="mr-1 inline" />
                {flash}
              </span>
            )}
          </div>

          {valid && <ScanCheck type={type} check={check} />}

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
            <button className="btn-ghost col-span-2" disabled={!valid} onClick={() => printSvg(rendered!.svg, type.label, is2d ? 40 : 70)}>
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ScanCheck({ type, check }: { type: CodeType; check: ScanState | null }) {
  if (!type.scannable) {
    return (
      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3.5 py-2.5 text-sm">
        <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-300" />
        <span className="text-slate-300">
          Valid {type.label} for printing. Phone cameras and Scan Studio can’t read it; it needs a dedicated {type.kind === "postal" ? "postal sorting" : "industrial"} scanner.
        </span>
      </div>
    );
  }
  if (!check || check.state === "checking") {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-slate-400">
        <LoaderCircle size={16} className="shrink-0 animate-spin" /> Checking it scans…
      </div>
    );
  }
  if (check.state === "ok") {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2.5 text-sm">
        <ShieldCheck size={16} className="shrink-0 text-emerald-300" />
        <span className="text-emerald-200">Scan tested: reads back correctly</span>
      </div>
    );
  }
  return (
    <div className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3.5 py-2.5 text-sm">
      <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-300" />
      <span className="min-w-0 text-slate-300 [overflow-wrap:anywhere]">
        {check.state === "mismatch" ? `Reads as “${check.text.slice(0, 80)}”, not your value.` : "Couldn’t read it back. Try darker colours, a lighter background or the quiet zone."}
      </span>
    </div>
  );
}

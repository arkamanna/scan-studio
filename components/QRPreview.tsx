"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCopy, Copy, Download, ExternalLink, Printer, QrCode, Share2, Smartphone } from "lucide-react";
import type { Result } from "@/lib/payloads";
import { copyPng, printSvg, saveBlob, sharePng } from "@/lib/share";
import { renderQr, type Ecc, type QrDesign } from "@/lib/qr-design";
import { svgToPng } from "@/lib/raster";

// Maximum bytes per QR code (version 40, byte mode) at each error-correction level.
const CAPACITY: Record<Ecc, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };
const ECC_LEVELS: { id: Ecc; hint: string }[] = [
  { id: "L", hint: "Most data, 7% damage tolerance" },
  { id: "M", hint: "Balanced, 15% damage tolerance" },
  { id: "Q", hint: "Sturdy, 25% damage tolerance" },
  { id: "H", hint: "Toughest, 30% damage tolerance" },
];
const OPENABLE = /^(https?:|mailto:|tel:|sms:|geo:)/i;

export default function QRPreview({ result, design }: { result: Result; design: QrDesign }) {
  const [ecc, setEcc] = useState<Ecc>("M");
  const [flash, setFlash] = useState<string | null>(null);

  const payload = result?.payload ?? "";
  const effectiveEcc: Ecc = design.logo ? "H" : ecc;
  const bytes = useMemo(() => new TextEncoder().encode(payload).length, [payload]);
  const capacity = CAPACITY[effectiveEcc];
  const tooBig = bytes > capacity;

  const rendered = useMemo(() => {
    if (!payload || tooBig) return { code: null, error: tooBig ? "too-big" : null };
    try {
      return { code: renderQr(payload, effectiveEcc, design, "qr-preview"), error: null };
    } catch (e) {
      return { code: null, error: (e as Error).message };
    }
  }, [payload, tooBig, effectiveEcc, design]);
  const code = rendered.code;
  const svg = code?.svg ?? null;
  const error = rendered.error;

  const notify = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1600);
  };

  const pngBlob = () => svgToPng(code!.svg, 1024, (1024 * code!.height) / code!.width);

  const download = async (type: "png" | "svg") => {
    const blob = type === "png" ? await pngBlob() : new Blob([svg!], { type: "image/svg+xml" });
    saveBlob(blob, `qr-code.${type}`);
  };

  const copyImage = async () => notify((await copyPng(pngBlob())) ? "Image copied" : "Copy not supported here");

  const copyText = async () => {
    await navigator.clipboard.writeText(payload);
    notify("Data copied");
  };

  const share = async () => {
    if (!(await sharePng(await pngBlob(), "qr-code.png", "QR code"))) notify("Sharing not supported here");
  };

  const ready = Boolean(svg);
  const fill = Math.min(100, (bytes / capacity) * 100);

  return (
    <div className="card p-4 sm:p-6">
      <div
        className={`relative mx-auto grid w-full max-w-[340px] place-items-center overflow-hidden rounded-3xl transition-colors ${ready ? "" : "aspect-square p-4"}`}
        style={{
          background: !ready ? "rgba(0,0,0,0.25)" : design.transparent ? "repeating-conic-gradient(#e2e8f0 0 25%, #ffffff 0 50%) 0 0 / 16px 16px" : design.background,
        }}
      >
        {ready ? (
          <div className="w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg! }} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-slate-500">
            <QrCode size={64} strokeWidth={1.2} className="text-slate-600" />
            {error === "too-big" ? (
              <p className="text-sm text-amber-300">
                Too much data for one QR code ({bytes.toLocaleString()} / {capacity.toLocaleString()} bytes). Shorten the text, pick level “L”,
                or share the file as a link.
              </p>
            ) : error ? (
              <p className="text-sm text-amber-300">{error}</p>
            ) : (
              <p className="text-sm">Your QR code appears here as you type</p>
            )}
          </div>
        )}
        {flash && (
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1 text-xs text-white shadow-lg">
            <Check size={12} className="mr-1 inline" />
            {flash}
          </span>
        )}
      </div>

      {result && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2.5 text-sm">
          <Smartphone size={16} className="shrink-0 text-emerald-300" />
          <span className="text-slate-400">Opens in</span>
          <span className="truncate font-medium text-emerald-200">{result.opensIn}</span>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button className="btn-primary" disabled={!ready} onClick={() => download("png")}>
          <Download size={16} /> PNG
        </button>
        <button className="btn-primary" disabled={!ready} onClick={() => download("svg")}>
          <Download size={16} /> SVG
        </button>
        <button className="btn-ghost" disabled={!ready} onClick={copyImage}>
          <Copy size={16} /> Copy image
        </button>
        <button className="btn-ghost" disabled={!ready} onClick={share}>
          <Share2 size={16} /> Share
        </button>
        {OPENABLE.test(payload) ? (
          <a className={`btn-ghost ${ready ? "" : "pointer-events-none opacity-40"}`} href={payload} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Test it
          </a>
        ) : (
          <button className="btn-ghost" disabled={!payload} onClick={copyText}>
            <ClipboardCopy size={16} /> Copy data
          </button>
        )}
        <button className="btn-ghost" disabled={!ready} onClick={() => printSvg(svg!, "QR code")}>
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
        <div>
          <div className="mb-1.5 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Data size</span>
            <span className={`tabular-nums ${tooBig ? "text-amber-300" : ""}`}>
              {bytes.toLocaleString()} / {capacity.toLocaleString()} bytes
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${tooBig ? "bg-amber-400" : fill > 60 ? "bg-yellow-300" : "bg-gradient-to-r from-violet-500 to-cyan-400"}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          {bytes > 600 && !tooBig && <p className="mt-1.5 text-xs text-slate-500">Dense codes scan best when printed large or shown full screen.</p>}
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Error correction</span>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/30 p-1">
            {ECC_LEVELS.map((l) => (
              <button
                key={l.id}
                title={l.hint}
                onClick={() => setEcc(l.id)}
                disabled={!!design.logo}
                className={`cursor-pointer rounded-lg py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${effectiveEcc === l.id ? "bg-white/15 text-white" : "text-slate-400 hover:text-white disabled:opacity-40"}`}
              >
                {l.id}
              </button>
            ))}
          </div>
          {design.logo && <p className="mt-1.5 text-xs text-slate-500">Locked to H while a logo is in the middle.</p>}
        </div>

        {payload && (
          <details className="group">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200">Encoded data</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-black/40 p-3 font-mono text-xs text-slate-300">{payload}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, ClipboardCopy, Copy, Download, ExternalLink, QrCode, Share2, Smartphone } from "lucide-react";
import type { Result } from "@/lib/payloads";
import { copyPng, saveBlob, sharePng } from "@/lib/share";

type Ecc = "L" | "M" | "Q" | "H";

// Maximum bytes per QR code (version 40, byte mode) at each error-correction level.
const CAPACITY: Record<Ecc, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };
const ECC_LEVELS: { id: Ecc; hint: string }[] = [
  { id: "L", hint: "Most data, 7% damage tolerance" },
  { id: "M", hint: "Balanced, 15% damage tolerance" },
  { id: "Q", hint: "Sturdy, 25% damage tolerance" },
  { id: "H", hint: "Toughest, 30% damage tolerance" },
];
const PRESETS = [
  { fg: "#0f172a", bg: "#ffffff" },
  { fg: "#4c1d95", bg: "#f5f3ff" },
  { fg: "#0e7490", bg: "#ecfeff" },
  { fg: "#9d174d", bg: "#fdf2f8" },
  { fg: "#14532d", bg: "#f0fdf4" },
  { fg: "#ffffff", bg: "#0f172a" },
];
const OPENABLE = /^(https?:|mailto:|tel:|sms:|geo:)/i;

export default function QRPreview({ result }: { result: Result }) {
  const [fg, setFg] = useState(PRESETS[0].fg);
  const [bg, setBg] = useState(PRESETS[0].bg);
  const [ecc, setEcc] = useState<Ecc>("M");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const payload = result?.payload ?? "";
  const bytes = useMemo(() => new TextEncoder().encode(payload).length, [payload]);
  const capacity = CAPACITY[ecc];
  const tooBig = bytes > capacity;
  const options = useMemo(() => ({ errorCorrectionLevel: ecc, margin: 2, color: { dark: fg, light: bg } }), [ecc, fg, bg]);

  useEffect(() => {
    if (!payload || tooBig) {
      setSvg(null);
      setError(tooBig ? "too-big" : null);
      return;
    }
    let cancelled = false;
    QRCode.toString(payload, { ...options, type: "svg" })
      .then((s) => !cancelled && (setSvg(s), setError(null)))
      .catch((e: Error) => !cancelled && (setSvg(null), setError(e.message)));
    return () => {
      cancelled = true;
    };
  }, [payload, options, tooBig]);

  const notify = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1600);
  };

  const pngBlob = async () => {
    const url = await QRCode.toDataURL(payload, { ...options, width: 1024 });
    return (await fetch(url)).blob();
  };

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
    <div className="card p-5 sm:p-6">
      <div
        className="relative mx-auto grid aspect-square w-full max-w-[340px] place-items-center overflow-hidden rounded-3xl p-4 transition-colors"
        style={{ background: ready ? bg : "rgba(0,0,0,0.25)" }}
      >
        {ready ? (
          <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg! }} />
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
        <button className="btn-primary col-span-2" disabled={!ready} onClick={() => download("png")}>
          <Download size={16} /> Download PNG
        </button>
        <button className="btn-ghost" disabled={!ready} onClick={() => download("svg")}>
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
                className={`cursor-pointer rounded-lg py-1.5 text-sm font-medium transition ${ecc === l.id ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}
              >
                {l.id}
              </button>
            ))}
          </div>
        </div>

        <div>
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
                <span className="size-3.5 rounded-sm" style={{ background: p.fg }} />
              </button>
            ))}
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
              <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent" />
              Dots
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent" />
              Background
            </label>
          </div>
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ExternalLink, History, ImageUp, ScanLine, Trash2, X } from "lucide-react";
import CameraScanner from "./CameraScanner";
import ImageScanner from "./ImageScanner";
import ResultCard, { kindIcon, type Scan } from "./ResultCard";
import { uid, type Found } from "@/lib/detector";
import { formatName, parseCode } from "@/lib/parse";

type Source = "camera" | "upload";

const HISTORY_KEY = "qr-studio:scan-history";
const SETTINGS_KEY = "qr-studio:scan-settings";
const AUTO_OPEN_SECONDS = 3;

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <span className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-violet-500" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

function HistoryRow({ scan, active, onClick }: { scan: Scan; active: boolean; onClick: () => void }) {
  const parsed = parseCode(scan.raw, scan.format);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition ${active ? "bg-violet-500/15" : "hover:bg-white/[0.05]"}`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-slate-300 [&>svg]:size-4">{kindIcon(parsed.kind)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-slate-200">{parsed.title}</span>
        <span className="block truncate text-[11px] text-slate-500">
          {parsed.label} · {formatName(scan.format)} · {new Date(scan.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </span>
    </button>
  );
}

export default function Scanner() {
  const [source, setSource] = useState<Source>("camera");
  const [scans, setScans] = useState<Scan[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [pending, setPending] = useState<{ url: string; label: string; left: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setScans(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"));
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
      setAutoOpen(Boolean(s.autoOpen));
      setContinuous(Boolean(s.continuous));
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(scans.slice(0, 50)));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ autoOpen, continuous }));
  }, [scans, autoOpen, continuous, loaded]);

  useEffect(() => {
    if (!pending) return;
    if (pending.left <= 0) {
      window.location.href = pending.url;
      setPending(null);
      return;
    }
    const t = setTimeout(() => setPending((p) => p && { ...p, left: p.left - 1 }), 1000);
    return () => clearTimeout(t);
  }, [pending]);

  const addScans = useCallback(
    (found: Found[], sourceLabel: string) => {
      const items: Scan[] = found.map((f) => ({ id: uid(), raw: f.raw, format: f.format, source: sourceLabel, at: Date.now() }));
      setScans((prev) => [...items, ...prev].slice(0, 50));
      setActiveId(items[0].id);

      if (autoOpen && items.length === 1) {
        const parsed = parseCode(items[0].raw, items[0].format);
        if (parsed.openUrl) setPending({ url: parsed.openUrl, label: parsed.opensIn ?? parsed.title, left: AUTO_OPEN_SECONDS });
      }
      if (window.innerWidth < 1024) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    },
    [autoOpen],
  );

  const active = scans.find((s) => s.id === activeId) ?? scans[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_420px] [&>*]:min-w-0">
      <section className="card space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-black/30 p-1">
          {(
            [
              { id: "camera", label: "Scan with camera", short: "Camera", icon: <Camera size={16} /> },
              { id: "upload", label: "Upload image", short: "Upload", icon: <ImageUp size={16} /> },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSource(s.id)}
              className={`flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl px-2 py-2.5 text-sm font-medium leading-none transition ${
                source === s.id ? "bg-gradient-to-r from-violet-500/40 to-cyan-500/30 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="shrink-0">{s.icon}</span>
              <span className="sm:hidden">{s.short}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {source === "camera" ? (
          <CameraScanner onDetect={(f) => addScans(f, "Camera")} continuous={continuous} onUseUpload={() => setSource("upload")} />
        ) : (
          <ImageScanner onDetect={addScans} />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            checked={autoOpen}
            onChange={setAutoOpen}
            label="Open automatically"
            hint={`Go to the link or app ${AUTO_OPEN_SECONDS}s after a scan (you can cancel).`}
          />
          {source === "camera" && (
            <Toggle checked={continuous} onChange={setContinuous} label="Continuous scanning" hint="Keep the camera running and collect every new code." />
          )}
        </div>

        <p className="text-xs text-slate-500">
          Reads QR, Micro QR, Data Matrix, Aztec, PDF417, EAN‑13/8, UPC‑A/E, ISBN, Code 128/39/93, ITF, Codabar and GS1 DataBar. Decoding happens on
          your device — images never leave it.
        </p>
      </section>

      <aside ref={resultRef} className="space-y-4 scroll-mt-4 lg:sticky lg:top-6">
        {pending && (
          <div className="card flex items-center gap-3 border-violet-400/40 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-500/30 text-lg font-semibold tabular-nums">{pending.left}</span>
            <p className="min-w-0 flex-1 text-sm">
              Opening <span className="font-medium text-white">{pending.label}</span>…
            </p>
            <a href={pending.url} className="btn-primary px-3 py-2" onClick={() => setPending(null)}>
              <ExternalLink size={15} /> Now
            </a>
            <button type="button" onClick={() => setPending(null)} className="btn-ghost px-2.5 py-2" title="Cancel">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="card p-4 sm:p-6">
          {active ? (
            <ResultCard key={active.id} scan={active} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-slate-500">
              <ScanLine size={56} strokeWidth={1.2} className="text-slate-600" />
              <p className="text-sm">Scan or upload a code — its details will appear here.</p>
            </div>
          )}
        </div>

        {scans.length > 0 && (
          <div className="card p-3">
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <History size={13} /> Recent scans ({scans.length})
              </p>
              <button
                type="button"
                onClick={() => {
                  setScans([]);
                  setActiveId(null);
                }}
                className="flex cursor-pointer items-center gap-1 text-xs text-slate-400 hover:text-white"
              >
                <Trash2 size={13} /> Clear
              </button>
            </div>
            <div className="max-h-80 space-y-0.5 overflow-y-auto">
              {scans.map((s) => (
                <HistoryRow key={s.id} scan={s} active={s.id === active?.id} onClick={() => setActiveId(s.id)} />
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

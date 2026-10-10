"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, ImageUp, LoaderCircle, Trash2 } from "lucide-react";
import { getDetector, uid, type Found } from "@/lib/detector";

type Point = { x: number; y: number };
type Item = {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  status: "working" | "done" | "error";
  codes: (Found & { points: Point[] })[];
  error?: string;
};

async function detectInImage(file: File) {
  const detector = await getDetector();
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  let codes = await detector.detect(bitmap);
  let factor = 1;

  // Retry at a friendlier resolution: huge phone photos and tiny screenshots both decode better resized.
  const longest = Math.max(width, height);
  if (!codes.length && (longest > 2000 || longest < 640)) {
    factor = longest > 2000 ? 1600 / longest : 1280 / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * factor);
    canvas.height = Math.round(height * factor);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = factor < 1;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    codes = await detector.detect(canvas);
  }
  bitmap.close();

  return {
    width,
    height,
    codes: codes.map((c) => ({ raw: c.rawValue, format: c.format, points: c.cornerPoints.map((p) => ({ x: p.x / factor, y: p.y / factor })) })),
  };
}

export default function ImageScanner({ onDetect }: { onDetect: (found: Found[], source: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const process = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    for (const file of images) {
      const id = uid();
      const url = URL.createObjectURL(file);
      setItems((prev) => [{ id, name: file.name || "Pasted image", url, width: 1, height: 1, status: "working", codes: [] }, ...prev]);
      try {
        const result = await detectInImage(file);
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...result, status: "done" } : it)));
        if (result.codes.length) onDetectRef.current(result.codes.map(({ raw, format }) => ({ raw, format })), file.name || "Pasted image");
      } catch (e) {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "error", error: (e as Error).message || "Couldn’t read this image." } : it)));
      }
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) process(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => items.forEach((it) => URL.revokeObjectURL(it.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          process([...e.dataTransfer.files]);
        }}
        className={`group flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition ${
          dragging ? "border-violet-400 bg-violet-500/10" : "border-white/15 bg-black/20 hover:border-white/30 hover:bg-white/[0.03]"
        }`}
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 transition group-hover:scale-105">
          <ImageUp size={26} />
        </span>
        <span className="text-sm font-medium text-slate-200">Drop images here, or tap to choose</span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <ClipboardPaste size={13} /> You can also paste a screenshot (Ctrl/⌘ + V). Several codes per image are fine.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          process([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Scanned images</p>
            <button type="button" onClick={() => setItems([])} className="flex cursor-pointer items-center gap-1 text-xs text-slate-400 hover:text-white">
              <Trash2 size={13} /> Clear
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <figure key={it.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt={it.name} className="block max-h-72 w-full object-contain" />
                  {it.status === "done" && it.codes.length > 0 && (
                    <svg viewBox={`0 0 ${it.width} ${it.height}`} preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 size-full">
                      {it.codes.map((c, i) => {
                        const cx = c.points.reduce((s, p) => s + p.x, 0) / c.points.length;
                        const cy = c.points.reduce((s, p) => s + p.y, 0) / c.points.length;
                        const r = Math.max(it.width, it.height) * 0.025;
                        return (
                          <g key={i}>
                            <polygon
                              points={c.points.map((p) => `${p.x},${p.y}`).join(" ")}
                              fill="rgba(139,92,246,0.25)"
                              stroke="#22d3ee"
                              strokeWidth={Math.max(it.width, it.height) * 0.006}
                              strokeLinejoin="round"
                            />
                            <circle cx={cx} cy={cy} r={r} fill="#7c3aed" />
                            <text x={cx} y={cy} fill="#fff" fontSize={r * 1.1} fontWeight={700} textAnchor="middle" dominantBaseline="central">
                              {i + 1}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                  {it.status === "working" && (
                    <div className="absolute inset-0 grid place-items-center bg-black/50">
                      <LoaderCircle size={28} className="animate-spin text-violet-300" />
                    </div>
                  )}
                </div>
                <figcaption className="flex items-center gap-2 px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-slate-400">{it.name}</span>
                  {it.status === "done" &&
                    (it.codes.length ? (
                      <span className="shrink-0 font-medium text-emerald-300">
                        {it.codes.length} code{it.codes.length > 1 ? "s" : ""} found
                      </span>
                    ) : (
                      <span className="shrink-0 text-amber-300">No code found — try a sharper, closer photo</span>
                    ))}
                  {it.status === "error" && <span className="shrink-0 text-amber-300">{it.error}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

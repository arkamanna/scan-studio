"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, ImagePlus, LoaderCircle, X } from "lucide-react";
import { Field } from "./ui";
import type { Fill } from "@/lib/qr-design";
import { imageFileToDataUrl } from "@/lib/raster";

const HEX = /^#[0-9a-f]{6}$/i;

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <div className={`flex items-center gap-3 ${disabled ? "opacity-40" : ""}`}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full cursor-pointer accent-violet-500"
        />
        <span className="w-12 text-right text-xs tabular-nums text-slate-400">
          {value}
          {unit}
        </span>
      </div>
    </Field>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-xl bg-black/30 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`cursor-pointer rounded-lg py-1.5 text-sm font-medium transition ${value === o.id ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Native colour wheel plus an editable hex value. */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => setText(value), [value]);

  const openWheel = () => {
    const input = picker.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.click();
    }
  };

  return (
    <Field label={label}>
      <div className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5 focus-within:border-violet-400/60">
        <input
          ref={picker}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-2 size-px opacity-0"
        />
        <button
          type="button"
          onClick={openWheel}
          className="size-8 shrink-0 cursor-pointer rounded-lg border border-white/20 transition hover:scale-105"
          style={{ background: value }}
          aria-label={`${label}: open colour wheel`}
          title="Open colour wheel"
        />
        <input
          value={text}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setText(v);
            if (HEX.test(v)) onChange(v.toLowerCase());
          }}
          onBlur={() => setText(value)}
          className="w-full min-w-0 bg-transparent font-mono text-sm uppercase text-slate-200 outline-none"
        />
        <button
          type="button"
          onClick={openWheel}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full transition hover:scale-110"
          style={{ background: "conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
          aria-label="Open colour wheel"
          title="Open colour wheel"
        >
          <span className="size-3 rounded-full border border-white/70" style={{ background: value }} />
        </button>
      </div>
    </Field>
  );
}

const GRADIENT_PRESETS: [string, string][] = [
  ["#7c3aed", "#06b6d4"],
  ["#db2777", "#f97316"],
  ["#0f766e", "#22c55e"],
  ["#1e3a8a", "#9333ea"],
  ["#b91c1c", "#f59e0b"],
  ["#0f172a", "#475569"],
];

export function FillPicker({ label, value, onChange }: { label: string; value: Fill; onChange: (v: Fill) => void }) {
  const set = (patch: Partial<Fill>) => onChange({ ...value, ...patch });
  const gradient = value.type !== "solid";

  return (
    <div className="space-y-3">
      <Field label={label}>
        <Segmented
          options={[
            { id: "solid", label: "Solid" },
            { id: "linear", label: "Linear gradient" },
            { id: "radial", label: "Radial gradient" },
          ]}
          value={value.type}
          onChange={(type) => set({ type })}
        />
      </Field>
      {gradient && (
        <div className="flex flex-wrap gap-2">
          {GRADIENT_PRESETS.map(([a, b]) => (
            <button
              key={a + b}
              type="button"
              onClick={() => set({ color: a, color2: b })}
              className={`size-8 cursor-pointer rounded-full border-2 transition ${value.color === a && value.color2 === b ? "border-violet-400" : "border-white/10"}`}
              style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
              aria-label="Gradient preset"
            />
          ))}
        </div>
      )}
      <div className={`grid items-end gap-3 ${gradient ? "grid-cols-[1fr_auto_1fr]" : "grid-cols-1"}`}>
        <ColorField label={gradient ? "Start colour" : "Colour"} value={value.color} onChange={(color) => set({ color })} />
        {gradient && (
          <>
            <button
              type="button"
              className="btn-ghost mb-0.5 px-2.5 py-2.5"
              onClick={() => set({ color: value.color2, color2: value.color })}
              title="Swap colours"
              aria-label="Swap colours"
            >
              <ArrowLeftRight size={15} />
            </button>
            <ColorField label="End colour" value={value.color2} onChange={(color2) => set({ color2 })} />
          </>
        )}
      </div>
      {value.type === "linear" && <Slider label="Gradient angle" value={value.angle} min={0} max={360} step={5} unit="°" onChange={(angle) => set({ angle })} />}
    </div>
  );
}

export function ShapeGrid<T extends string>({
  label,
  options,
  value,
  onChange,
  viewBox,
}: {
  label: string;
  options: { id: T; label: string; path: string; evenOdd?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  viewBox: string;
}) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            title={o.label}
            onClick={() => onChange(o.id)}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 transition ${
              value === o.id ? "border-violet-400/60 bg-violet-500/15 text-white" : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/20"
            }`}
          >
            <svg viewBox={viewBox} className="size-8">
              <path d={o.path} fill="currentColor" fillRule={o.evenOdd ? "evenodd" : "nonzero"} />
            </svg>
            <span className="text-[10px] leading-none">{o.label}</span>
          </button>
        ))}
      </div>
    </Field>
  );
}

export function ImagePicker({ label, value, onChange, hint }: { label: string; value: string | null; onChange: (v: string | null) => void; hint?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await imageFileToDataUrl(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Field label={label} hint={error ? <span className="text-amber-400">{error}</span> : hint}>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="size-12 rounded-lg bg-white/90 object-contain p-1" />
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => input.current?.click()}>
            Replace
          </button>
          <button type="button" className="btn-ghost ml-auto px-3 py-1.5 text-xs" onClick={() => onChange(null)}>
            <X size={14} /> Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-4 text-sm text-slate-400 transition hover:border-violet-400/50 hover:text-white"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <ImagePlus size={16} />} Upload image
        </button>
      )}
    </Field>
  );
}

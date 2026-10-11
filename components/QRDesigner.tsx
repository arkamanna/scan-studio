"use client";

import { Check, Palette, RotateCcw } from "lucide-react";
import { CollapsibleCard, ColorField, FillPicker, ImagePicker, ShapeGrid, Slider } from "./design-controls";
import { Field, Input } from "./ui";
import {
  ballPath,
  DEFAULT_DESIGN,
  dotPath,
  framePath,
  renderQr,
  type BallShape,
  type DotShape,
  type FrameShape,
  type QrDesign,
} from "@/lib/qr-design";

const DOT_SAMPLE = [
  [1, 0, 1],
  [1, 1, 0],
  [0, 1, 1],
];
const dotPreview = (shape: DotShape) =>
  DOT_SAMPLE.flatMap((row, r) => row.map((on, c) => (on ? dotPath(shape, c * 1.15 + 0.1, r * 1.15 + 0.1) : ""))).join("");

const DOTS: { id: DotShape; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "dots", label: "Dots" },
  { id: "diamond", label: "Diamond" },
  { id: "star", label: "Star" },
  { id: "heart", label: "Heart" },
  { id: "leaf", label: "Leaf" },
  { id: "plus", label: "Plus" },
];
const FRAMES: { id: FrameShape; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
  { id: "leaf", label: "Leaf" },
];
const BALLS: { id: BallShape; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
  { id: "diamond", label: "Diamond" },
  { id: "leaf", label: "Leaf" },
];

const THEMES: { name: string; design: Partial<QrDesign> }[] = [
  { name: "Classic", design: { dots: "square", frame: "square", ball: "square", fill: { ...DEFAULT_DESIGN.fill }, eyeColor: null, background: "#ffffff", transparent: false, captionColor: "#0f172a" } },
  {
    name: "Night",
    design: { dots: "dots", frame: "rounded", ball: "rounded", fill: { type: "solid", color: "#ffffff", color2: "#94a3b8", angle: 45 }, eyeColor: null, background: "#0b0b0f", transparent: false, captionColor: "#ffffff" },
  },
  {
    name: "Aurora",
    design: { dots: "rounded", frame: "rounded", ball: "circle", fill: { type: "linear", color: "#7c3aed", color2: "#06b6d4", angle: 45 }, eyeColor: null, background: "#ffffff", transparent: false, captionColor: "#5b21b6" },
  },
  {
    name: "Sunset",
    design: { dots: "star", frame: "circle", ball: "circle", fill: { type: "radial", color: "#db2777", color2: "#f97316", angle: 45 }, eyeColor: "#be185d", background: "#fff7ed", transparent: false, captionColor: "#be185d" },
  },
  {
    name: "Forest",
    design: { dots: "leaf", frame: "leaf", ball: "leaf", fill: { type: "linear", color: "#14532d", color2: "#16a34a", angle: 90 }, eyeColor: null, background: "#f0fdf4", transparent: false, captionColor: "#14532d" },
  },
  {
    name: "Love",
    design: { dots: "heart", frame: "rounded", ball: "circle", fill: { type: "linear", color: "#e11d48", color2: "#a21caf", angle: 135 }, eyeColor: null, background: "#fff1f2", transparent: false, captionColor: "#be123c" },
  },
];

const THEME_KEYS = ["dots", "frame", "ball", "eyeColor", "background", "transparent"] as const;
const sameFill = (a: QrDesign["fill"], b: QrDesign["fill"]) =>
  a.type === b.type && a.color === b.color && (a.type === "solid" || (a.color2 === b.color2 && (a.type === "radial" || a.angle === b.angle)));
const isActiveTheme = (design: QrDesign, theme: Partial<QrDesign>) =>
  THEME_KEYS.every((k) => theme[k] === undefined || theme[k] === design[k]) && (!theme.fill || sameFill(theme.fill, design.fill));

const thumbnail = (design: QrDesign, id: string) => renderQr("Scan Studio", "L", { ...design, logo: null, caption: "" }, id).svg;

export default function QRDesigner({ design, onChange }: { design: QrDesign; onChange: (d: QrDesign) => void }) {
  const set = (patch: Partial<QrDesign>) => onChange({ ...design, ...patch });

  return (
    <CollapsibleCard
      title="Design"
      subtitle="Shapes, colours, logo and a caption. Changes show live in the preview."
      icon={<Palette size={18} />}
      action={
        <button type="button" className="btn-ghost shrink-0 px-3 py-2 text-xs" onClick={() => onChange({ ...DEFAULT_DESIGN, caption: design.caption, logo: design.logo })}>
          <RotateCcw size={14} /> Reset
        </button>
      }
    >
      <Field label="Quick themes">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {THEMES.map((t) => {
            const preview = { ...design, ...t.design } as QrDesign;
            const active = isActiveTheme(design, t.design);
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => set(t.design)}
                aria-pressed={active}
                className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-2.5 transition ${
                  active
                    ? "border-violet-400/70 bg-gradient-to-b from-violet-500/25 to-cyan-500/10 shadow-[0_0_0_3px_rgba(139,92,246,0.18)]"
                    : "border-white/[0.06] bg-white/[0.02] hover:-translate-y-0.5 hover:border-white/25"
                }`}
              >
                {active && (
                  <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-violet-500 text-white shadow ring-2 ring-[#0b0d14]">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <span
                  className="block aspect-square w-full max-w-16 overflow-hidden rounded-xl shadow-md shadow-black/40 ring-1 ring-white/10 [&>svg]:size-full"
                  dangerouslySetInnerHTML={{ __html: thumbnail(preview, `theme-${t.name}`) }}
                />
                <span className={`text-xs font-medium ${active ? "text-white" : "text-slate-400 group-hover:text-white"}`}>{t.name}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <ShapeGrid label="Dot style" options={DOTS.map((o) => ({ ...o, path: dotPreview(o.id) }))} value={design.dots} onChange={(dots) => set({ dots })} viewBox="0 0 3.55 3.55" />
      <div className="grid gap-6 sm:grid-cols-2">
        <ShapeGrid
          label="Corner frame"
          options={FRAMES.map((o) => ({ ...o, path: framePath(o.id, 0, 0), evenOdd: true }))}
          value={design.frame}
          onChange={(frame) => set({ frame })}
          viewBox="-0.5 -0.5 8 8"
        />
        <ShapeGrid
          label="Corner centre"
          options={BALLS.map((o) => ({ ...o, path: ballPath(o.id, 0, 0) }))}
          value={design.ball}
          onChange={(ball) => set({ ball })}
          viewBox="1.3 1.3 4.4 4.4"
        />
      </div>

      <div className="space-y-4 border-t border-white/10 pt-6">
        <FillPicker label="Dot colour" value={design.fill} onChange={(fill) => set({ fill })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            {design.eyeColor === null ? (
              <Field label="Corner colour">
                <p className="py-2.5 text-sm text-slate-500">Same as dots</p>
              </Field>
            ) : (
              <ColorField label="Corner colour" value={design.eyeColor} onChange={(eyeColor) => set({ eyeColor })} />
            )}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                className="size-4 accent-violet-500"
                checked={design.eyeColor === null}
                onChange={(e) => set({ eyeColor: e.target.checked ? null : design.fill.color })}
              />
              Match dot colour
            </label>
          </div>
          <div className="space-y-2">
            <div className={design.transparent ? "pointer-events-none opacity-40" : ""}>
              <ColorField label="Background" value={design.background} onChange={(background) => set({ background })} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" className="size-4 accent-violet-500" checked={design.transparent} onChange={(e) => set({ transparent: e.target.checked })} />
              Transparent background
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-2">
        <div className="space-y-4">
          <ImagePicker
            label="Logo in the middle"
            value={design.logo}
            onChange={(logo) => set({ logo })}
            hint="Error correction switches to H automatically so the code still scans."
          />
          {design.logo && (
            <>
              <Slider label="Logo size" value={design.logoSize} min={12} max={30} unit="%" onChange={(logoSize) => set({ logoSize })} />
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" className="size-4 accent-violet-500" checked={design.logoClear} onChange={(e) => set({ logoClear: e.target.checked })} />
                Clear the dots behind the logo
              </label>
            </>
          )}
        </div>
        <div className="space-y-4">
          <Field label="Text above the code">
            <Input placeholder="e.g. Scan me" value={design.caption} maxLength={60} onChange={(e) => set({ caption: e.target.value })} />
          </Field>
          {design.caption.trim() && (
            <>
              <ColorField label="Text colour" value={design.captionColor} onChange={(captionColor) => set({ captionColor })} />
              <Slider label="Text size" value={design.captionSize} min={4} max={12} step={0.5} unit="%" onChange={(captionSize) => set({ captionSize })} />
            </>
          )}
        </div>
      </div>
    </CollapsibleCard>
  );
}

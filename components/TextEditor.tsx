"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarClock,
  CaseSensitive,
  ClipboardPaste,
  Copy,
  Eraser,
  List,
  Maximize2,
  Minimize2,
  Redo2,
  Smile,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";

/** Byte capacity of the largest QR code at the lowest error-correction level. */
const QR_MAX_BYTES = 2953;
const HISTORY_LIMIT = 100;
const EMOJI = ["😀", "😂", "😍", "🥳", "👍", "🙏", "👏", "🔥", "✨", "🎉", "❤️", "💯", "✅", "⭐", "📍", "📞", "📧", "🔗", "🕒", "💡", "🎁", "🚀", "☕", "🌟"];

type Transform = (s: string) => string;

const CASES: { id: string; label: string; fn: Transform }[] = [
  { id: "upper", label: "UPPERCASE", fn: (s) => s.toUpperCase() },
  { id: "lower", label: "lowercase", fn: (s) => s.toLowerCase() },
  { id: "title", label: "Title Case", fn: (s) => s.toLowerCase().replace(/(^|[\s\-(["'])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) },
  { id: "sentence", label: "Sentence case", fn: (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) },
];

const tidy: Transform = (s) =>
  s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

function ToolButton({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-white/10" />;

export default function TextEditor({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const history = useRef({ stack: [value], index: 0 });
  const typingTimer = useRef<number | undefined>(undefined);
  const [, force] = useState(0);
  const [menu, setMenu] = useState<"case" | "emoji" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const record = useCallback((next: string) => {
    const h = history.current;
    if (h.stack[h.index] === next) return;
    h.stack = [...h.stack.slice(0, h.index + 1), next].slice(-HISTORY_LIMIT);
    h.index = h.stack.length - 1;
    force((n) => n + 1);
  }, []);

  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  const notify = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 1400);
  };

  /** Applies a programmatic edit, records it for undo and restores the caret. */
  const apply = (next: string, caret?: [number, number]) => {
    window.clearTimeout(typingTimer.current);
    record(value);
    onChange(next);
    record(next);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      if (caret) el.setSelectionRange(caret[0], caret[1]);
    });
  };

  const selection = () => {
    const el = area.current;
    return el ? [el.selectionStart, el.selectionEnd] : [value.length, value.length];
  };

  const insert = (text: string) => {
    const [a, b] = selection();
    apply(value.slice(0, a) + text + value.slice(b), [a + text.length, a + text.length]);
  };

  /** Runs a transform on the selected text, or on everything when nothing is selected. */
  const transform = (fn: Transform) => {
    const [a, b] = selection();
    if (a !== b) {
      const out = fn(value.slice(a, b));
      apply(value.slice(0, a) + out + value.slice(b), [a, a + out.length]);
    } else {
      apply(fn(value));
    }
  };

  const bullets = () => {
    const [a, b] = selection();
    const start = value.lastIndexOf("\n", a - 1) + 1;
    const endIdx = value.indexOf("\n", b);
    const end = endIdx === -1 ? value.length : endIdx;
    const lines = value.slice(start, end).split("\n");
    const allBulleted = lines.every((l) => l.startsWith("• "));
    const out = lines.map((l) => (allBulleted ? l.slice(2) : l.startsWith("• ") ? l : `• ${l}`)).join("\n");
    apply(value.slice(0, start) + out + value.slice(end), [start, start + out.length]);
  };

  const step = (dir: -1 | 1) => {
    window.clearTimeout(typingTimer.current);
    const h = history.current;
    if (h.stack[h.index] !== value) record(value);
    const target = h.index + dir;
    if (target < 0 || target >= h.stack.length) return;
    h.index = target;
    onChange(h.stack[target]);
    force((n) => n + 1);
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) insert(text);
    } catch {
      notify("Press ⌘V / Ctrl+V to paste");
      area.current?.focus();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      notify("Copied");
    } catch {
      notify("Copy not supported here");
    }
  };

  const h = history.current;
  const canUndo = h.index > 0 || h.stack[h.index] !== value;
  const canRedo = h.index < h.stack.length - 1 && h.stack[h.index] === value;

  const chars = [...value].length;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const lines = value ? value.split("\n").length : 0;
  const bytes = new TextEncoder().encode(value).length;
  const usage = Math.min(100, (bytes / QR_MAX_BYTES) * 100);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 focus-within:border-violet-400/60">
      <div className="relative flex items-center gap-0.5 overflow-x-auto border-b border-white/10 bg-white/[0.03] px-1.5 py-1 [scrollbar-width:none]">
        <ToolButton label="Undo" onClick={() => step(-1)} disabled={!canUndo}>
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton label="Redo" onClick={() => step(1)} disabled={!canRedo}>
          <Redo2 size={16} />
        </ToolButton>
        <Divider />
        <ToolButton label="Paste" onClick={paste}>
          <ClipboardPaste size={16} />
        </ToolButton>
        <ToolButton label="Copy all" onClick={copy} disabled={!value}>
          <Copy size={16} />
        </ToolButton>
        <Divider />
        <ToolButton label="Change case" onClick={() => setMenu((m) => (m === "case" ? null : "case"))} disabled={!value} active={menu === "case"}>
          <CaseSensitive size={18} />
        </ToolButton>
        <ToolButton label="Bulleted list" onClick={bullets}>
          <List size={16} />
        </ToolButton>
        <ToolButton label="Tidy spaces and blank lines" onClick={() => transform(tidy)} disabled={!value}>
          <Sparkles size={16} />
        </ToolButton>
        <Divider />
        <ToolButton label="Insert emoji" onClick={() => setMenu((m) => (m === "emoji" ? null : "emoji"))} active={menu === "emoji"}>
          <Smile size={16} />
        </ToolButton>
        <ToolButton label="Insert date and time" onClick={() => insert(new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}>
          <CalendarClock size={16} />
        </ToolButton>
        <Divider />
        <ToolButton label={expanded ? "Smaller editor" : "Bigger editor"} onClick={() => setExpanded((e) => !e)}>
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </ToolButton>
        <ToolButton label="Remove line breaks" onClick={() => transform((s) => s.replace(/\s*\n\s*/g, " "))} disabled={!value.includes("\n")}>
          <Eraser size={16} />
        </ToolButton>
        <ToolButton label="Clear all" onClick={() => apply("", [0, 0])} disabled={!value}>
          <Trash2 size={16} />
        </ToolButton>
      </div>

      {menu === "case" && (
        <div className="flex flex-wrap gap-1.5 border-b border-white/10 bg-white/[0.02] p-2">
          {CASES.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                transform(c.fn);
                setMenu(null);
              }}
              className="chip"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {menu === "emoji" && (
        <div className="grid grid-cols-8 gap-1 border-b border-white/10 bg-white/[0.02] p-2 sm:grid-cols-12">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => insert(e)}
              className="grid aspect-square cursor-pointer place-items-center rounded-lg text-lg transition hover:bg-white/10"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <textarea
          ref={area}
          autoFocus
          value={value}
          placeholder={placeholder}
          spellCheck
          rows={expanded ? 16 : 7}
          onChange={(e) => {
            const next = e.target.value;
            if (typingTimer.current === undefined) record(value);
            window.clearTimeout(typingTimer.current);
            typingTimer.current = window.setTimeout(() => {
              typingTimer.current = undefined;
              record(next);
            }, 600);
            onChange(next);
          }}
          onKeyDown={(e) => {
            if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
            e.preventDefault();
            step(e.shiftKey ? 1 : -1);
          }}
          className="block w-full resize-y bg-transparent px-4 py-3 text-[15px] leading-relaxed text-slate-100 outline-none placeholder:text-slate-500"
        />
        {flash && <span className="absolute bottom-2 right-3 rounded-full bg-black/80 px-2.5 py-1 text-xs text-white">{flash}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] tabular-nums text-slate-500">
        <span>{chars.toLocaleString()} characters</span>
        <span>{words.toLocaleString()} words</span>
        <span>{lines.toLocaleString()} lines</span>
        <span className="ml-auto flex items-center gap-2">
          <span className={bytes > QR_MAX_BYTES ? "text-amber-300" : ""}>
            {bytes.toLocaleString()} / {QR_MAX_BYTES.toLocaleString()} bytes
          </span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
            <span
              className={`block h-full rounded-full ${bytes > QR_MAX_BYTES ? "bg-amber-400" : usage > 60 ? "bg-yellow-300" : "bg-gradient-to-r from-violet-500 to-cyan-400"}`}
              style={{ width: `${usage}%` }}
            />
          </span>
        </span>
      </div>
    </div>
  );
}

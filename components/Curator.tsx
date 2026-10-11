"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Award, CheckCircle2, LoaderCircle, Quote, Send, ThumbsUp, X } from "lucide-react";
import type { Endorsement } from "@/lib/endorsements";

const LINKEDIN_URL = "https://www.linkedin.com/in/arka-manna-39012920/";
const LINKEDIN_SKILLS_URL = `${LINKEDIN_URL}details/skills/`;
const WALL_PREVIEW = 6;

function LinkedInIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function Avatar({ className = "" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/arka.jpg" alt="Arka Manna" className={`rounded-full object-cover ring-2 ring-violet-400/60 ${className}`} />;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function EndorseDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", role: "", linkedin: "", message: "", website: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/endorsements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("done");
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Endorse Arka Manna">
        <div className="mb-5 flex items-start gap-3">
          <Avatar className="size-14" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Enjoying Scan Studio?</h2>
            <p className="text-sm text-slate-400">Endorse Arka Manna, who built it.</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost px-2.5 py-2" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <a
          href={LINKEDIN_SKILLS_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-[#0a66c2]/50 bg-[#0a66c2]/15 p-4 transition hover:bg-[#0a66c2]/25"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#0a66c2] text-white">
            <LinkedInIcon size={18} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-white">Endorse my skills on LinkedIn</span>
            <span className="block text-xs text-slate-400">Opens my Skills page — tap “Endorse” next to any skill.</span>
          </span>
        </a>

        <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <span className="h-px flex-1 bg-white/10" /> or leave a note here <span className="h-px flex-1 bg-white/10" />
        </div>

        {status === "done" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={44} className="text-emerald-300" />
            <p className="font-medium">Thank you!</p>
            <p className="max-w-xs text-sm text-slate-400">Your endorsement will appear on the site once Arka has reviewed it.</p>
            <button type="button" className="btn-ghost mt-2" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input" placeholder="Your name *" value={form.name} onChange={set("name")} maxLength={60} required />
              <input className="input" placeholder="Role / company (optional)" value={form.role} onChange={set("role")} maxLength={80} />
            </div>
            <input className="input" placeholder="Your LinkedIn URL (optional)" value={form.linkedin} onChange={set("linkedin")} maxLength={200} inputMode="url" />
            <textarea
              className="input resize-none leading-relaxed"
              rows={4}
              placeholder="What did you like about the app? *"
              value={form.message}
              onChange={set("message")}
              maxLength={300}
              required
            />
            <input type="text" name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Shown publicly after review.</span>
              <span>{form.message.length}/300</span>
            </div>
            {error && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={status === "sending"}>
              {status === "sending" ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
              Send endorsement
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function EndorsementCard({ e }: { e: Endorsement }) {
  return (
    <figure className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <Quote size={18} className="text-violet-300/70" />
      <blockquote className="flex-1 text-sm leading-relaxed text-slate-200">{e.message}</blockquote>
      <figcaption className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500/50 to-cyan-500/40 text-xs font-semibold">
          {initials(e.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{e.name}</span>
          {e.role && <span className="block truncate text-xs text-slate-500">{e.role}</span>}
        </span>
        {e.linkedin && (
          <a href={e.linkedin} target="_blank" rel="noreferrer nofollow" className="text-slate-400 hover:text-[#4c9be8]" aria-label={`${e.name} on LinkedIn`}>
            <LinkedInIcon size={16} />
          </a>
        )}
      </figcaption>
    </figure>
  );
}

export default function Curator() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Endorsement[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch("/api/endorsements")
      .then((r) => r.json())
      .then((d) => setItems(d.endorsements ?? []))
      .catch(() => {});
  }, []);

  const visible = showAll ? items : items.slice(0, WALL_PREVIEW);

  return (
    <>
      <section className="mt-14">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-300">
            <Award size={14} /> Endorsements
          </span>
          <h2 className="text-2xl font-semibold tracking-tight">{items.length ? "What people are saying" : "Like what you see?"}</h2>
        </div>

        {items.length > 0 && (
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((e) => (
              <EndorsementCard key={e.id} e={e} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {items.length > WALL_PREVIEW && (
            <button type="button" className="btn-ghost" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Show fewer" : `Show all ${items.length}`}
            </button>
          )}
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            <ThumbsUp size={16} /> {items.length ? "Add your endorsement" : "Be the first to endorse Arka"}
          </button>
        </div>
      </section>

      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full border border-white/15 bg-[#0b0e1a]/85 p-1 pr-1 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-3 transition hover:bg-white/[0.06]"
          title="Arka Manna on LinkedIn"
        >
          <Avatar className="size-9" />
          <span className="leading-tight">
            <span className="hidden text-[10px] uppercase tracking-wider text-slate-400 sm:block">Curated by</span>
            <span className="flex items-center gap-1 text-sm font-semibold text-white">
              Arka Manna <LinkedInIcon size={12} />
            </span>
          </span>
        </a>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
        >
          <ThumbsUp size={14} /> <span className="hidden sm:inline">Endorse</span>
        </button>
      </div>

      {open && <EndorseDialog onClose={() => setOpen(false)} />}
    </>
  );
}

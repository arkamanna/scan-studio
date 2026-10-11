"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Award, CheckCircle2, ChevronRight, LoaderCircle, Quote, Send, ThumbsUp, X } from "lucide-react";
import type { Endorsement } from "@/lib/endorsements";

const LINKEDIN_URL = "https://www.linkedin.com/in/arka-manna-39012920/";
const LINKEDIN_SKILLS_URL = `${LINKEDIN_URL}details/skills/`;

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

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

function EndorseForm({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ name: "", role: "", linkedin: "", message: "", website: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
    <div>
      <button type="button" onClick={onBack} className="mb-4 flex cursor-pointer items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={15} /> Back to endorsements
      </button>

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
          <span className="block text-xs text-slate-400">Opens my Skills page - tap “Endorse” next to any skill.</span>
        </span>
      </a>

      <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <span className="h-px flex-1 bg-white/10" /> or leave a note here <span className="h-px flex-1 bg-white/10" />
      </div>

      {status === "done" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 size={44} className="text-emerald-300" />
          <p className="font-medium">Thank you!</p>
          <p className="max-w-xs text-sm text-slate-400">Your endorsement will appear here once Arka has reviewed it.</p>
          <button type="button" className="btn-ghost mt-2" onClick={onBack}>
            Back to endorsements
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="Your name *" value={form.name} onChange={set("name")} maxLength={60} required autoFocus />
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
            <span>Shown publicly after review. Nothing is posted to LinkedIn.</span>
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

function EndorsementsPanel({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<"list" | "form">("list");
  const [items, setItems] = useState<Endorsement[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/endorsements")
      .then((r) => r.json())
      .then((d) => setItems(d.endorsements ?? []))
      .catch(() => setError(true));
  }, []);

  return (
    <Modal label="Endorsements for Arka Manna" onClose={onClose}>
      <div className="mb-6 flex items-start gap-4">
        <Avatar className="size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">Curated by</p>
          <h2 className="text-xl font-semibold">Arka Manna</h2>
          <p className="text-sm text-slate-400">Built Scan Studio - QR codes, barcodes and a scanner in one app.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-xs">
              <LinkedInIcon size={13} /> View LinkedIn profile
            </a>
            {view === "list" && (
              <button type="button" onClick={() => setView("form")} className="btn-primary px-3 py-1.5 text-xs">
                <ThumbsUp size={14} /> Endorse
              </button>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose} className="btn-ghost shrink-0 px-2.5 py-2" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="border-t border-white/10 pt-5">
        {view === "form" ? (
          <EndorseForm onBack={() => setView("list")} />
        ) : (
          <>
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Award size={13} /> Endorsements{items?.length ? ` (${items.length})` : ""}
            </p>
            {error ? (
              <p className="py-8 text-center text-sm text-amber-300">Couldn’t load endorsements. Please try again later.</p>
            ) : items === null ? (
              <div className="flex justify-center py-10">
                <LoaderCircle size={24} className="animate-spin text-violet-300" />
              </div>
            ) : items.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((e) => (
                  <EndorsementCard key={e.id} e={e} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Quote size={28} className="text-slate-600" />
                <p className="text-sm text-slate-400">No endorsements yet. Be the first to share what you liked.</p>
                <button type="button" onClick={() => setView("form")} className="btn-primary">
                  <ThumbsUp size={15} /> Endorse Arka
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export default function Curator() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="mt-14 flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex cursor-pointer items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] py-1.5 pl-1.5 pr-5 shadow-xl shadow-black/30 backdrop-blur-xl transition hover:border-violet-400/50 hover:bg-white/[0.07]"
        >
          <Avatar className="size-9" />
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Award size={16} className="text-violet-300" /> Endorsements
          </span>
          <ChevronRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
        </button>
      </section>

      {open && <EndorsementsPanel onClose={() => setOpen(false)} />}
    </>
  );
}

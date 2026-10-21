"use client";

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { CalendarDays, Contact, Sparkles, FileText, ImageIcon, Link2, Mail, MapPin, MessageCircle, MessageSquare, Phone, Type, Wifi } from "lucide-react";
import QRPreview from "./QRPreview";
import QRDesigner from "./QRDesigner";
import QRAgent from "./QRAgent";
import FileForm from "./FileForm";
import { ContactForm, EmailForm, EventForm, LinkForm, LocationForm, PhoneForm, SmsForm, TextForm, WhatsAppForm, WifiForm } from "./forms";
import type { OnResult, Result } from "@/lib/payloads";
import { DEFAULT_DESIGN, type QrDesign } from "@/lib/qr-design";
import { applyAgentDesign, contentToResult } from "@/lib/qr-agent";
import { on } from "@/lib/app-events";

type Mode = {
  id: string;
  label: string;
  icon: ReactNode;
  blurb: string;
  Form: ComponentType<{ onResult: OnResult }>;
};

const CONTENT: Mode[] = [
  { id: "link", label: "Link", icon: <Link2 size={18} />, blurb: "Any URL — app links open straight in their app.", Form: LinkForm },
  { id: "text", label: "Text", icon: <Type size={18} />, blurb: "Plain text, or send it to WhatsApp, Mail, Translate…", Form: TextForm },
  {
    id: "photo",
    label: "Photo",
    icon: <ImageIcon size={18} />,
    blurb: "Read the text in a photo (OCR), or share the photo itself.",
    Form: (p) => <FileForm kind="photo" {...p} />,
  },
  {
    id: "document",
    label: "Document",
    icon: <FileText size={18} />,
    blurb: "Pull text out of PDFs, Word docs and text files.",
    Form: (p) => <FileForm kind="document" {...p} />,
  },
];

const ACTIONS: Mode[] = [
  { id: "wifi", label: "Wi‑Fi", icon: <Wifi size={18} />, blurb: "Guests scan and join your network — no typing.", Form: WifiForm },
  { id: "contact", label: "Contact", icon: <Contact size={18} />, blurb: "Saves a contact card straight into Contacts.", Form: ContactForm },
  { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle size={18} />, blurb: "Opens a WhatsApp chat with a ready message.", Form: WhatsAppForm },
  { id: "email", label: "Email", icon: <Mail size={18} />, blurb: "Opens the mail app with a pre-written email.", Form: EmailForm },
  { id: "phone", label: "Call", icon: <Phone size={18} />, blurb: "Opens the dialer with the number ready.", Form: PhoneForm },
  { id: "sms", label: "SMS", icon: <MessageSquare size={18} />, blurb: "Opens Messages with recipient and text filled in.", Form: SmsForm },
  { id: "location", label: "Location", icon: <MapPin size={18} />, blurb: "Drops a pin in Google Maps, Apple Maps or the default app.", Form: LocationForm },
  { id: "event", label: "Event", icon: <CalendarDays size={18} />, blurb: "Adds an event to the calendar in one tap.", Form: EventForm },
];

const ALL = [...CONTENT, ...ACTIONS];

function ModeButton({ mode, active, onClick }: { mode: Mode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium transition ${
        active
          ? "border-violet-400/50 bg-gradient-to-b from-violet-500/25 to-cyan-500/10 text-white shadow-[0_0_0_3px_rgba(139,92,246,0.12)]"
          : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-100"
      }`}
    >
      {mode.icon}
      {mode.label}
    </button>
  );
}

export default function QRGenerator() {
  const [modeId, setModeId] = useState("link");
  const [result, setResult] = useState<Result>(null);
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);
  /** Set while the preview shows content made by the QR agent; typing in a form takes over again. */
  const [agentLabel, setAgentLabel] = useState<string | null>(null);
  const mode = ALL.find((m) => m.id === modeId)!;

  const select = (id: string) => {
    if (id === modeId) return;
    setResult(null);
    setAgentLabel(null);
    setModeId(id);
  };

  const fromForm = useCallback((r: Result) => {
    setAgentLabel(null);
    setResult(r);
  }, []);

  useEffect(
    () =>
      on("ss:qrapply", ({ content, design: d }) => {
        const built = content ? contentToResult(content) : null;
        if (built) {
          setResult(built.result);
          setAgentLabel(built.label);
        }
        if (d) setDesign((prev) => applyAgentDesign(prev, d));
      }),
    [],
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_400px] [&>*]:min-w-0">
      <div className="space-y-6">
        <QRAgent
          qr={{
            design,
            contentLabel: agentLabel ?? (result ? `${mode.label} (from the form)` : null),
            onApply: ({ result: r, label, design: d }) => {
              if (r) {
                setResult(r);
                setAgentLabel(label ?? "QR agent");
              }
              setDesign(d);
            },
          }}
        />
        <section className="card p-4 sm:p-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Content</p>
          <div className="grid grid-cols-4 gap-2">
            {CONTENT.map((m) => (
              <ModeButton key={m.id} mode={m} active={m.id === modeId} onClick={() => select(m.id)} />
            ))}
          </div>
          <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Smart actions</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {ACTIONS.map((m) => (
              <ModeButton key={m.id} mode={m} active={m.id === modeId} onClick={() => select(m.id)} />
            ))}
          </div>

          <div className="mt-6 border-t border-white/10 pt-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-white/[0.06] text-violet-300">{mode.icon}</span>
              <div>
                <h2 className="font-semibold">{mode.label}</h2>
                <p className="text-sm text-slate-400">{mode.blurb}</p>
              </div>
            </div>
            {agentLabel && (
              <p className="mb-4 flex items-start gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-3.5 py-2.5 text-sm text-violet-100">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-violet-300" />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  The preview shows the agent’s code: <b className="font-medium">{agentLabel}</b>. Fill in a form below to replace it.
                </span>
              </p>
            )}
            <mode.Form key={mode.id} onResult={fromForm} />
          </div>
        </section>
        <QRDesigner design={design} onChange={setDesign} />
      </div>

        <aside className="lg:sticky lg:top-6">
          <QRPreview result={result} design={design} />
        </aside>
    </div>
  );
}

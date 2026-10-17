"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  AppWindow,
  Barcode,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  Coins,
  Contact,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  IndianRupee,
  Info,
  KeyRound,
  Languages,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Search,
  ShoppingCart,
  Type,
  UserPlus,
  Wallet,
  Wifi,
} from "lucide-react";
import { formatName, parseCode, type Action, type ActionIcon, type Field, type Kind, type Parsed } from "@/lib/parse";
import { lookupBook, lookupProduct, type LookupResult } from "@/lib/lookup";

export type Scan = { id: string; raw: string; format: string; source: string; at: number };

const KIND_ICONS: Record<Kind, ReactNode> = {
  url: <Globe size={20} />,
  wifi: <Wifi size={20} />,
  contact: <Contact size={20} />,
  event: <CalendarDays size={20} />,
  email: <Mail size={20} />,
  phone: <Phone size={20} />,
  sms: <MessageSquare size={20} />,
  location: <MapPin size={20} />,
  whatsapp: <MessageCircle size={20} />,
  upi: <IndianRupee size={20} />,
  otp: <KeyRound size={20} />,
  crypto: <Coins size={20} />,
  app: <AppWindow size={20} />,
  product: <Barcode size={20} />,
  book: <BookOpen size={20} />,
  text: <Type size={20} />,
};

const ACTION_ICONS: Record<ActionIcon, ReactNode> = {
  open: <ExternalLink size={16} />,
  call: <Phone size={16} />,
  mail: <Mail size={16} />,
  sms: <MessageSquare size={16} />,
  map: <MapPin size={16} />,
  contact: <UserPlus size={16} />,
  calendar: <CalendarPlus size={16} />,
  search: <Search size={16} />,
  pay: <Wallet size={16} />,
  book: <BookOpen size={16} />,
  cart: <ShoppingCart size={16} />,
  translate: <Languages size={16} />,
  key: <KeyRound size={16} />,
  chat: <MessageCircle size={16} />,
};

export const kindIcon = (k: Kind) => KIND_ICONS[k];

export function useParsed(scan: Scan) {
  return useMemo(() => parseCode(scan.raw, scan.format), [scan.raw, scan.format]);
}

function CopyButton({ value, className = "" }: { value: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className={`grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white ${className}`}
    >
      {done ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
    </button>
  );
}

function FieldRow({ field }: { field: Field }) {
  const [reveal, setReveal] = useState(!field.secret);
  const shown = reveal ? field.value : "•".repeat(Math.min(12, field.value.length));
  return (
    <div className="group flex items-start gap-3 px-3.5 py-2.5">
      <dt className="w-28 shrink-0 pt-0.5 text-xs font-medium text-slate-500">{field.label}</dt>
      <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm text-slate-100">
        {field.href && reveal ? (
          <a href={field.href} target={/^https?:/.test(field.href) ? "_blank" : undefined} rel="noreferrer" className="text-cyan-300 hover:underline">
            {shown}
          </a>
        ) : (
          <span className={field.secret ? "font-mono" : ""}>{shown}</span>
        )}
      </dd>
      {field.secret && (
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          title={reveal ? "Hide" : "Show"}
          className="grid size-7 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
        >
          {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
      <CopyButton value={field.value} className="opacity-60 group-hover:opacity-100" />
    </div>
  );
}

function ActionButton({ action }: { action: Action }) {
  const cls = action.primary ? "btn-primary" : "btn-ghost";
  if (action.file) {
    const { name, type, content } = action.file;
    return (
      <button
        type="button"
        className={cls}
        onClick={() => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([content], { type }));
          a.download = name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }}
      >
        {ACTION_ICONS[action.icon]} {action.label}
      </button>
    );
  }
  const external = /^https?:/i.test(action.href ?? "");
  return (
    <a className={cls} href={action.href} target={external ? "_blank" : undefined} rel="noreferrer">
      {ACTION_ICONS[action.icon]} {action.label}
    </a>
  );
}

function Lookup({ parsed }: { parsed: Parsed }) {
  const [state, setState] = useState<"loading" | "none" | LookupResult>("loading");
  const lookup = parsed.lookup!;

  useEffect(() => {
    let off = false;
    setState("loading");
    (lookup.type === "book" ? lookupBook(lookup.code) : lookupProduct(lookup.code))
      .then((r) => !off && setState(r ?? "none"))
      .catch(() => !off && setState("none"));
    return () => {
      off = true;
    };
  }, [lookup.type, lookup.code]);

  if (state === "loading")
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-slate-400">
        <LoaderCircle size={16} className="animate-spin text-violet-400" /> Looking up {lookup.type} details…
      </div>
    );
  if (state === "none" || !state)
    return (
      <p className="rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-slate-400">
        No public {lookup.type} info found for this code. Try the search buttons below.
      </p>
    );
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div className="flex gap-3 p-3.5">
        {state.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.image} alt="" className="h-24 w-20 shrink-0 rounded-lg bg-white object-contain" />
        )}
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{state.title ?? "Unnamed"}</p>
          <a href={state.link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline">
            via {state.source} <ExternalLink size={11} />
          </a>
        </div>
      </div>
      {state.rows.length > 0 && (
        <dl className="divide-y divide-white/5 border-t border-white/10">
          {state.rows.map((f) => (
            <FieldRow key={f.label} field={f} />
          ))}
        </dl>
      )}
    </div>
  );
}

export default function ResultCard({ scan }: { scan: Scan }) {
  const parsed = useParsed(scan);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 text-violet-200">
          {KIND_ICONS[parsed.kind]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
            <span className="text-violet-300">{parsed.label}</span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-slate-300">{formatName(scan.format)}</span>
          </div>
          <h3 className="mt-0.5 break-words [overflow-wrap:anywhere] text-lg font-semibold leading-snug">{parsed.title}</h3>
          {parsed.subtitle && <p className="break-words [overflow-wrap:anywhere] text-sm text-slate-400">{parsed.subtitle}</p>}
        </div>
      </div>

      {parsed.warning && (
        <p className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {parsed.warning}
        </p>
      )}

      {parsed.lookup && <Lookup parsed={parsed} />}

      <dl className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        {parsed.fields.map((f, i) => (
          <FieldRow key={`${f.label}-${i}`} field={f} />
        ))}
      </dl>

      {parsed.note && (
        <p className="flex gap-2 text-xs text-slate-400">
          <Info size={14} className="mt-0.5 shrink-0" /> {parsed.note}
        </p>
      )}

      {parsed.opensIn && (
        <p className="text-xs text-slate-500">
          Opens in <span className="font-medium text-emerald-300">{parsed.opensIn}</span>
        </p>
      )}

      {parsed.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:whitespace-nowrap">
          {parsed.actions.map((a) => (
            <ActionButton key={a.label} action={a} />
          ))}
        </div>
      )}

      <details className="group rounded-2xl border border-white/10 bg-black/20">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200">
          <ChevronDown size={14} className="transition group-open:rotate-180" />
          Raw data · {new TextEncoder().encode(scan.raw).length} bytes
          <span className="ml-auto">
            <CopyButton value={scan.raw} />
          </span>
        </summary>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all border-t border-white/10 px-3.5 py-3 font-mono text-xs text-slate-300">{scan.raw}</pre>
      </details>
    </div>
  );
}

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Globe, Languages, Mail, MapPin, MessageCircle, MessageSquare, Search, Send, Type } from "lucide-react";
import type { Target } from "@/lib/payloads";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input resize-y leading-relaxed ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input cursor-pointer ${props.className ?? ""}`} />;
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button type="button" key={o.id} onClick={() => onChange(o.id)} className={`chip ${value === o.id ? "chip-active" : ""}`}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TARGET_ICONS: Record<string, ReactNode> = {
  direct: <Globe size={14} />,
  plain: <Type size={14} />,
  whatsapp: <MessageCircle size={14} />,
  sms: <MessageSquare size={14} />,
  email: <Mail size={14} />,
  telegram: <Send size={14} />,
  search: <Search size={14} />,
  translate: <Languages size={14} />,
  maps: <MapPin size={14} />,
};

export function TargetPicker({ targets, value, onChange }: { targets: Target[]; value: string; onChange: (id: string) => void }) {
  return (
    <Field label="When scanned, open in">
      <Chips options={targets.map((t) => ({ id: t.id, label: t.label, icon: TARGET_ICONS[t.id] }))} value={value} onChange={onChange} />
    </Field>
  );
}

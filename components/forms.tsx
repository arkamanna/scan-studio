"use client";

import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import { Chips, Field, Input, TargetPicker, TextArea } from "./ui";
import {
  LINK_TARGETS,
  TEXT_TARGETS,
  detectApp,
  emailPayload,
  eventPayload,
  locationPayload,
  normalizeUrl,
  smsPayload,
  vcardPayload,
  whatsappPayload,
  wifiPayload,
  cleanPhone,
  type MapApp,
  type OnResult,
} from "@/lib/payloads";

type FormProps = { onResult: OnResult };

export function LinkForm({ onResult }: FormProps) {
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("direct");
  const normalized = normalizeUrl(url);

  useEffect(() => {
    if (!normalized) return onResult(null);
    const t = LINK_TARGETS.find((x) => x.id === target)!;
    onResult({ payload: t.build(normalized), opensIn: t.id === "direct" ? detectApp(normalized) : t.app });
  }, [normalized, target, onResult]);

  return (
    <div className="space-y-5">
      <Field
        label="Link"
        hint={
          url && !normalized ? (
            <span className="text-amber-400">That doesn’t look like a valid link yet.</span>
          ) : (
            "YouTube, Instagram, Spotify, Maps, App Store… links open straight in their app."
          )
        }
      >
        <Input autoFocus inputMode="url" placeholder="https://youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <TargetPicker targets={LINK_TARGETS} value={target} onChange={setTarget} />
    </div>
  );
}

export function TextForm({ onResult }: FormProps) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState("plain");

  useEffect(() => {
    const value = text.trim();
    if (!value) return onResult(null);
    const t = TEXT_TARGETS.find((x) => x.id === target)!;
    onResult({ payload: t.build(value), opensIn: t.app });
  }, [text, target, onResult]);

  return (
    <div className="space-y-5">
      <Field label="Text" hint={`${text.length.toLocaleString()} characters`}>
        <TextArea autoFocus rows={7} placeholder="Type or paste any text…" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <TargetPicker targets={TEXT_TARGETS} value={target} onChange={setTarget} />
    </div>
  );
}

export function WifiForm({ onResult }: FormProps) {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!ssid.trim()) return onResult(null);
    onResult({ payload: wifiPayload({ ssid, password, security, hidden }), opensIn: "Wi‑Fi settings · tap to join" });
  }, [ssid, password, security, hidden, onResult]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Network name (SSID)">
          <Input autoFocus placeholder="Home Wi‑Fi" value={ssid} onChange={(e) => setSsid(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input
            type="text"
            placeholder={security === "nopass" ? "No password" : "••••••••"}
            disabled={security === "nopass"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Security">
        <Chips
          options={[
            { id: "WPA", label: "WPA / WPA2 / WPA3" },
            { id: "WEP", label: "WEP" },
            { id: "nopass", label: "Open (no password)" },
          ]}
          value={security}
          onChange={setSecurity}
        />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" className="size-4 accent-violet-500" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
        Hidden network
      </label>
    </div>
  );
}

export function ContactForm({ onResult }: FormProps) {
  const [c, setC] = useState({ first: "", last: "", org: "", title: "", phone: "", email: "", website: "", address: "" });
  const set = (k: keyof typeof c) => (e: React.ChangeEvent<HTMLInputElement>) => setC((prev) => ({ ...prev, [k]: e.target.value }));

  useEffect(() => {
    if (!c.first.trim() && !c.last.trim() && !c.phone.trim() && !c.email.trim()) return onResult(null);
    onResult({ payload: vcardPayload(c), opensIn: "Contacts · add new contact" });
  }, [c, onResult]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="First name"><Input autoFocus value={c.first} onChange={set("first")} /></Field>
      <Field label="Last name"><Input value={c.last} onChange={set("last")} /></Field>
      <Field label="Phone"><Input type="tel" placeholder="+91 98765 43210" value={c.phone} onChange={set("phone")} /></Field>
      <Field label="Email"><Input type="email" value={c.email} onChange={set("email")} /></Field>
      <Field label="Company"><Input value={c.org} onChange={set("org")} /></Field>
      <Field label="Job title"><Input value={c.title} onChange={set("title")} /></Field>
      <Field label="Website"><Input value={c.website} onChange={set("website")} /></Field>
      <Field label="Address"><Input value={c.address} onChange={set("address")} /></Field>
    </div>
  );
}

export function EmailForm({ onResult }: FormProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!to.trim() && !subject.trim() && !body.trim()) return onResult(null);
    onResult({ payload: emailPayload(to, subject, body), opensIn: "Mail app · new draft" });
  }, [to, subject, body, onResult]);

  return (
    <div className="space-y-4">
      <Field label="To"><Input autoFocus type="email" placeholder="hello@example.com" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="Message"><TextArea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
    </div>
  );
}

export function PhoneForm({ onResult }: FormProps) {
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const p = cleanPhone(phone);
    if (p.replace("+", "").length < 3) return onResult(null);
    onResult({ payload: `tel:${p}`, opensIn: "Phone dialer · ready to call" });
  }, [phone, onResult]);

  return (
    <Field label="Phone number" hint="Include the country code so it works anywhere, e.g. +91…">
      <Input autoFocus type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
    </Field>
  );
}

export function SmsForm({ onResult }: FormProps) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!cleanPhone(phone) && !message.trim()) return onResult(null);
    onResult({ payload: smsPayload(phone, message), opensIn: "Messages · pre-filled SMS" });
  }, [phone, message, onResult]);

  return (
    <div className="space-y-4">
      <Field label="Phone number"><Input autoFocus type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <Field label="Message"><TextArea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
    </div>
  );
}

export function WhatsAppForm({ onResult }: FormProps) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (phone.replace(/\D/g, "").length < 6) return onResult(null);
    onResult({ payload: whatsappPayload(phone, message), opensIn: "WhatsApp · chat with message" });
  }, [phone, message, onResult]);

  return (
    <div className="space-y-4">
      <Field label="WhatsApp number" hint="Full international number, e.g. +91 98765 43210">
        <Input autoFocus type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Pre-filled message (optional)"><TextArea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
    </div>
  );
}

const MAP_APPS: { id: MapApp; label: string; app: string }[] = [
  { id: "google", label: "Google Maps", app: "Google Maps" },
  { id: "apple", label: "Apple Maps", app: "Apple Maps" },
  { id: "geo", label: "Default maps app", app: "Phone’s default maps app" },
];

export function LocationForm({ onResult }: FormProps) {
  const [query, setQuery] = useState("");
  const [app, setApp] = useState<MapApp>("google");
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) return onResult(null);
    onResult({ payload: locationPayload(query, app), opensIn: MAP_APPS.find((m) => m.id === app)!.app });
  }, [query, app, onResult]);

  const locate = () => {
    if (!navigator.geolocation) return setGeoError("Location isn’t available in this browser.");
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setQuery(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
        setLocating(false);
      },
      (err) => {
        setGeoError(err.message || "Couldn’t get your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-5">
      <Field label="Place, address or coordinates" hint={geoError ? <span className="text-amber-400">{geoError}</span> : "e.g. “Victoria Memorial, Kolkata” or “22.5448,88.3426”"}>
        <div className="flex gap-2">
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a place…" />
          <button type="button" onClick={locate} disabled={locating} className="btn-ghost shrink-0" title="Use my current location">
            <LocateFixed size={16} className={locating ? "animate-pulse" : ""} />
            <span className="hidden sm:inline">My location</span>
          </button>
        </div>
      </Field>
      <Field label="Open in">
        <Chips options={MAP_APPS} value={app} onChange={setApp} />
      </Field>
    </div>
  );
}

export function EventForm({ onResult }: FormProps) {
  const [e, setE] = useState({ title: "", start: "", end: "", location: "", description: "" });
  const set = (k: keyof typeof e) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setE((prev) => ({ ...prev, [k]: ev.target.value }));

  useEffect(() => {
    if (!e.title.trim() || !e.start) return onResult(null);
    onResult({ payload: eventPayload(e), opensIn: "Calendar · add event" });
  }, [e, onResult]);

  return (
    <div className="space-y-4">
      <Field label="Event title"><Input autoFocus placeholder="Team dinner" value={e.title} onChange={set("title")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts"><Input type="datetime-local" value={e.start} onChange={set("start")} /></Field>
        <Field label="Ends"><Input type="datetime-local" value={e.end} min={e.start} onChange={set("end")} /></Field>
      </div>
      <Field label="Location"><Input value={e.location} onChange={set("location")} /></Field>
      <Field label="Details"><TextArea rows={3} value={e.description} onChange={set("description")} /></Field>
    </div>
  );
}
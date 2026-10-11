"use client";

import { useEffect, useState } from "react";
import { Barcode, QrCode, ScanLine } from "lucide-react";
import QRGenerator from "./QRGenerator";
import BarcodeGenerator from "./BarcodeGenerator";
import Scanner from "./scanner/Scanner";
import Curator from "./Curator";

type Tab = "qr" | "barcode" | "scan";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "qr", label: "QR Code", icon: <QrCode size={16} /> },
  { id: "barcode", label: "Barcode", icon: <Barcode size={16} /> },
  { id: "scan", label: "Scan", icon: <ScanLine size={16} /> },
];

const HERO: Record<Tab, { lead: string; accent: string; blurb: string }> = {
  qr: {
    lead: "QR codes that open",
    accent: "the right app",
    blurb: "Paste a link, type text, or drop a photo or document. Get a crisp QR code that phones open in WhatsApp, Maps, Mail, Wi‑Fi, Contacts and more.",
  },
  barcode: {
    lead: "Barcodes ready for",
    accent: "any scanner",
    blurb: "Create retail, shipping and inventory barcodes — EAN, UPC, Code 128, Code 39, ITF-14 and more — with check digits added automatically.",
  },
  scan: {
    lead: "Scan any code,",
    accent: "see what’s inside",
    blurb: "Use your camera or upload a photo or screenshot. Get every QR code and barcode decoded into clear details, then open it in the right app in one tap.",
  },
};

export default function Studio() {
  const [tab, setTab] = useState<Tab>("qr");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash === "barcode" || hash === "scan") setTab(hash);
  }, []);

  const select = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "qr" ? window.location.pathname : `#${t}`);
  };

  const hero = HERO[tab];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <header className="mb-8 flex flex-col items-center text-center sm:mb-10">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-900/40">
            <ScanLine size={22} className="text-white" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Scan Studio</span>
        </div>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
          {hero.lead} <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">{hero.accent}</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm text-slate-400 sm:text-base">{hero.blurb}</p>

        <div role="tablist" className="mt-7 inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => select(t.id)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition ${
                tab === t.id ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-900/30" : "text-slate-400 hover:text-white"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main>
        <div hidden={tab !== "qr"}>
          <QRGenerator />
        </div>
        <div hidden={tab !== "barcode"}>
          <BarcodeGenerator />
        </div>
        {tab === "scan" && <Scanner />}
      </main>

      <Curator />

      <footer className="mt-12 space-y-2 text-center text-xs text-slate-500">
        <p>
          Everything is generated and scanned in your browser. Photos and documents are read on your device and are only uploaded if you choose “share as
          link”.
        </p>
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Barcode, Grid3x3, Mail, Package, QrCode, Rows3, ScanLine, Shapes, Target } from "lucide-react";
import QRGenerator from "./QRGenerator";
import BarcodeGenerator from "./BarcodeGenerator";
import CodeGenerator from "./CodeGenerator";
import { CODE_GROUPS } from "@/lib/code-types";
import Scanner from "./scanner/Scanner";
import InstallApp from "./InstallApp";
import Curator from "./Curator";

type Tab = "qr" | "barcode" | "datamatrix" | "aztec" | "pdf417" | "gs1" | "postal" | "more" | "scan";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "qr", label: "QR Code", icon: <QrCode size={16} /> },
  { id: "barcode", label: "Barcode", icon: <Barcode size={16} /> },
  { id: "datamatrix", label: "Data Matrix", icon: <Grid3x3 size={16} /> },
  { id: "aztec", label: "Aztec", icon: <Target size={16} /> },
  { id: "pdf417", label: "PDF417", icon: <Rows3 size={16} /> },
  { id: "gs1", label: "GS1", icon: <Package size={16} /> },
  { id: "postal", label: "Postal", icon: <Mail size={16} /> },
  { id: "more", label: "More", icon: <Shapes size={16} /> },
  { id: "scan", label: "Scan", icon: <ScanLine size={16} /> },
];

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

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
  datamatrix: {
    lead: "Data Matrix codes for",
    accent: "tiny labels",
    blurb: "The square code on electronics, parts and medicines. Fits a lot of data into a few millimetres, including GS1 DataMatrix for healthcare.",
  },
  aztec: {
    lead: "Aztec codes for",
    accent: "tickets & passes",
    blurb: "The bullseye code on boarding passes and rail tickets. Reads even when printed small or slightly damaged, with no margin needed.",
  },
  pdf417: {
    lead: "PDF417 for",
    accent: "IDs & documents",
    blurb: "The stacked code on driving licences, ID cards and shipping labels. Holds long text, including Compact and MicroPDF417.",
  },
  gs1: {
    lead: "GS1 codes for",
    accent: "supply chains",
    blurb: "GS1-128, GS1 DataBar, SSCC, EAN-14 and GS1 QR for cartons, pallets, fresh food and medicines, with application identifiers like (01) and (17).",
  },
  postal: {
    lead: "Postal barcodes for",
    accent: "mail & parcels",
    blurb: "USPS Intelligent Mail, POSTNET, Royal Mail 4-State, KIX, Australia Post, Japan Post and Deutsche Post codes.",
  },
  more: {
    lead: "Every other code,",
    accent: "all in one place",
    blurb: "Micro QR, rMQR, MaxiCode, DotCode, Han Xin, Code One, stacked codes like Codablock F, and niche barcodes such as Telepen, PZN and Code 11.",
  },
  scan: {
    lead: "Scan any code,",
    accent: "see what’s inside",
    blurb: "Use your camera or upload a photo or screenshot. QR, Micro QR, Data Matrix, Aztec, PDF417, MaxiCode, GS1 DataBar and every common barcode are decoded into clear details.",
  },
};

export default function Studio() {
  const [tab, setTab] = useState<Tab>("qr");
  /** Code tabs mount on first visit and then stay mounted, so switching tabs keeps what was typed. */
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(["qr", "barcode"]));

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (TAB_IDS.has(hash)) {
      setTab(hash as Tab);
      setVisited((v) => new Set(v).add(hash as Tab));
    }
  }, []);

  const select = (t: Tab) => {
    setTab(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
    history.replaceState(null, "", t === "qr" ? window.location.pathname : `#${t}`);
  };

  const hero = HERO[tab];

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-16 pt-6 sm:px-6 sm:pt-12">
      <header className="mb-8 flex flex-col items-center text-center sm:mb-10">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-900/40">
            <ScanLine size={22} className="text-white" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Scan Studio</span>
        </div>
        <div className="-mt-1 mb-5 empty:hidden">
          <InstallApp />
        </div>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
          {hero.lead} <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">{hero.accent}</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm text-slate-400 sm:text-base">{hero.blurb}</p>

        <div
          role="tablist"
          className="mt-6 grid w-full max-w-md grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl sm:inline-flex sm:w-auto sm:max-w-full sm:flex-wrap sm:justify-center"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => select(t.id)}
              className={`inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2 text-[13px] font-medium transition sm:gap-2 sm:px-4 sm:text-sm ${
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
        {CODE_GROUPS.map(
          (g) =>
            visited.has(g.id as Tab) && (
              <div key={g.id} hidden={tab !== g.id}>
                <CodeGenerator group={g} />
              </div>
            ),
        )}
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

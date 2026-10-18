"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, Check, Copy, Download, Ellipsis, Share, SquarePlus, X } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type IosBrowser = "safari" | "other" | "in-app";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function iosBrowser(): IosBrowser {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|Instagram|LinkedInApp|Line\/|Twitter|GSA\//i.test(ua)) return "in-app";
  if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua)) return "other";
  return "safari";
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[28px_36px_1fr] items-center gap-3">
      <span className="grid size-7 place-items-center rounded-full bg-violet-500/25 text-xs font-semibold text-violet-200">{n}</span>
      <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-cyan-300">{icon}</span>
      <span className="text-sm leading-snug text-slate-300">{children}</span>
    </li>
  );
}

/** Registers the service worker and offers "Install app": the browser's install prompt, or guided steps on iPhone/iPad. */
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState<IosBrowser | null>(null);
  const [installed, setInstalled] = useState(true);
  const [help, setHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    setInstalled(isStandalone());
    if (isIos()) setIos(iosBrowser());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  const install = async () => {
    if (!prompt) return setHelp(true);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const shareIcon = <Share size={17} />;

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-violet-400/30 bg-gradient-to-r from-violet-500/20 to-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:border-violet-400/60 hover:brightness-110"
      >
        <Download size={14} /> Install app
      </button>

      {help && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setHelp(false)}>
          <div
            className="card w-full max-w-md rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-left sm:rounded-b-3xl sm:pb-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Install Scan Studio"
          >
            <div className="mb-5 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192-v2.png" alt="" className="size-12 shrink-0 rounded-2xl shadow-lg" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Install Scan Studio</p>
                <p className="text-xs text-slate-400">Adds an app icon to your Home Screen. It opens full screen and works offline.</p>
              </div>
              <button type="button" className="btn-ghost shrink-0 px-2.5 py-2" onClick={() => setHelp(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {ios === "in-app" ? (
              <ol className="space-y-4">
                <Step n={1} icon={<Ellipsis size={17} />}>
                  This in-app browser can’t install apps. Tap <b className="text-white">•••</b> and choose <b className="text-white">Open in Safari</b>.
                </Step>
                <Step n={2} icon={shareIcon}>
                  In Safari, tap <b className="text-white">Install app</b> again and follow the steps.
                </Step>
              </ol>
            ) : (
              <ol className="space-y-4">
                <Step n={1} icon={shareIcon}>
                  Tap the <b className="text-white">Share</b> button {ios === "safari" ? "in Safari’s toolbar" : "in the browser’s toolbar or menu"}. On newer
                  iOS it’s inside the <b className="text-white">•••</b> menu.
                </Step>
                <Step n={2} icon={<SquarePlus size={17} />}>
                  Scroll down and tap <b className="text-white">Add to Home Screen</b>.
                </Step>
                <Step n={3} icon={<Check size={17} />}>
                  Keep <b className="text-white">Open as Web App</b> switched on, then tap <b className="text-white">Add</b>.
                </Step>
              </ol>
            )}

            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-400">
              <span className="min-w-0 flex-1">Apple only allows web apps to be installed from the Share menu, so this can’t be a one-tap install on iPhone.</span>
              <button type="button" className="btn-ghost shrink-0 px-3 py-1.5 text-xs" onClick={copyLink}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy link"}
              </button>
            </div>

            {ios === "safari" && (
              <div className="pointer-events-none mt-4 flex flex-col items-center gap-1 text-[11px] text-cyan-300 sm:hidden">
                <span>Share is down here</span>
                <ArrowDown size={20} className="animate-bounce" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

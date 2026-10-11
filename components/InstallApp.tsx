"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Registers the service worker and offers "Install app" (native prompt, or Add to Home Screen steps on iPhone/iPad). */
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    setInstalled(isStandalone());
    setIos(isIos());

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

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-violet-400/50 hover:text-white"
      >
        <Download size={14} /> Install app
      </button>

      {help && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => setHelp(false)}>
          <div className="card w-full max-w-sm p-5 text-left" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Install Scan Studio">
            <div className="mb-4 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="" className="size-11 rounded-xl" />
              <div className="flex-1">
                <p className="font-semibold">Install Scan Studio</p>
                <p className="text-xs text-slate-400">Opens full screen, like a regular app.</p>
              </div>
              <button type="button" className="btn-ghost px-2.5 py-2" onClick={() => setHelp(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-cyan-300">
                  <Share size={16} />
                </span>
                Tap the <b className="text-white">Share</b> button in Safari’s toolbar.
              </li>
              <li className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-cyan-300">
                  <SquarePlus size={16} />
                </span>
                Choose <b className="text-white">Add to Home Screen</b>, then tap <b className="text-white">Add</b>.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

/** Tiny window-event bus so the QR agent can drive other parts of the studio. */

export type StudioTab = "qr" | "barcode" | "datamatrix" | "aztec" | "pdf417" | "gs1" | "postal" | "more" | "scan";
export type QrAction = "download_png" | "download_svg" | "print" | "copy_image" | "share";
export type CodeFill = { tab: Exclude<StudioTab, "qr" | "scan">; type: string; value: string };

type Events = {
  "ss:tab": { tab: StudioTab };
  "ss:fill": CodeFill;
  "ss:qr": { ecc?: "L" | "M" | "Q" | "H"; actions?: QrAction[] };
};

/** Fills sent before a tab's generator has mounted wait here until it picks them up. */
const pending = new Map<string, CodeFill>();

export function emit<K extends keyof Events>(name: K, detail: Events[K]) {
  if (name === "ss:fill") pending.set((detail as CodeFill).tab, detail as CodeFill);
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on<K extends keyof Events>(name: K, handler: (detail: Events[K]) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<Events[K]>).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

/** Returns (and clears) a fill waiting for this tab. */
export function takeFill(tab: string) {
  const fill = pending.get(tab);
  pending.delete(tab);
  return fill;
}

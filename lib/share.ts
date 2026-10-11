export function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function copyPng(png: Promise<Blob>): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return true;
  } catch {
    return false;
  }
}

/** Prints an SVG on its own page via a hidden iframe, so the rest of the app isn't printed. */
export function printSvg(svg: string, title: string, widthMm = 90) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow!;
  const doc = win.document;
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>${title.replace(/[<&]/g, "")}</title><style>` +
      `@page{margin:15mm}html,body{margin:0;height:100%}` +
      `body{display:flex;align-items:center;justify-content:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
      `svg{width:${widthMm}mm;max-width:100%;height:auto}` +
      `</style></head><body>${svg}</body></html>`,
  );
  doc.close();
  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  win.addEventListener("afterprint", cleanup);
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => iframe.isConnected && iframe.remove(), 60_000);
  }, 150);
}

export async function sharePng(png: Blob, filename: string, title: string): Promise<boolean> {
  const file = new File([png], filename, { type: "image/png" });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title });
  } catch {
    /* user cancelled */
  }
  return true;
}

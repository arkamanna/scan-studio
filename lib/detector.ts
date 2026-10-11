import type { BarcodeDetector, DetectedBarcode } from "barcode-detector/ponyfill";

export type { DetectedBarcode };
export type Found = { raw: string; format: string };

type Detector = Pick<BarcodeDetector, "detect">;

let detector: Promise<BarcodeDetector> | null = null;
let liveDetector: Promise<{ detector: Detector; native: boolean }> | null = null;

/** Lazily loads the zxing-wasm decoder (works in every modern browser, unlike the native BarcodeDetector). */
export function getDetector() {
  detector ??= import("barcode-detector/ponyfill").then(({ BarcodeDetector }) => new BarcodeDetector());
  return detector;
}

/**
 * Detector for live camera frames: the browser's built-in BarcodeDetector when it exists (hardware-accelerated
 * on Android, ChromeOS and macOS), otherwise the zxing-wasm decoder.
 */
export function getLiveDetector() {
  liveDetector ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: typeof BarcodeDetector }).BarcodeDetector;
    if (Native?.getSupportedFormats) {
      try {
        const formats = await Native.getSupportedFormats();
        if (formats.includes("qr_code")) return { detector: new Native({ formats: [...formats] }), native: true };
      } catch {
        /* fall back to zxing */
      }
    }
    return { detector: await getDetector(), native: false };
  })();
  return liveDetector;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

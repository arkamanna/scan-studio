import type { BarcodeDetector, DetectedBarcode } from "barcode-detector/ponyfill";

export type { DetectedBarcode };
export type Found = { raw: string; format: string };

let detector: Promise<BarcodeDetector> | null = null;

/** Lazily loads the zxing-wasm decoder (works in every modern browser, unlike the native BarcodeDetector). */
export function getDetector() {
  detector ??= import("barcode-detector/ponyfill").then(({ BarcodeDetector }) => new BarcodeDetector());
  return detector;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

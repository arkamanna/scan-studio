import { renderCard } from "@/lib/og-card";

export const alt = "Scan Studio — create and scan smart QR codes and barcodes. Curated by Arka Manna.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderCard(size.width, size.height);
}

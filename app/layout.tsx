import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scan Studio — QR Code & Barcode Generator and Scanner",
  description:
    "Create smart QR codes that open in WhatsApp, Maps, Mail, Wi‑Fi, Contacts and more, generate retail and shipping barcodes, and scan any QR code or barcode with your camera or an image.",
};

export const viewport: Viewport = {
  themeColor: "#070912",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-slate-100 antialiased">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Scan Studio - QR Code & Barcode Generator and Scanner";
const description =
  "Create smart QR codes that open in WhatsApp, Maps, Mail, Wi-Fi, Contacts and more, generate retail and shipping barcodes, and scan any QR code or barcode with your camera or an image.";

export const metadata: Metadata = {
  metadataBase: new URL("https://scan-studios.vercel.app"),
  title,
  description,
  authors: [{ name: "Arka Manna", url: "https://www.linkedin.com/in/arka-manna-39012920/" }],
  openGraph: { type: "website", siteName: "Scan Studio", title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
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

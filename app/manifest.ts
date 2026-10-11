import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Scan Studio - QR Code & Barcode Generator and Scanner",
    short_name: "Scan Studio",
    description: "Create smart QR codes and barcodes, and scan any code with your camera or an image.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#070912",
    theme_color: "#070912",
    categories: ["utilities", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scan a code", short_name: "Scan", url: "/#scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Make a barcode", short_name: "Barcode", url: "/#barcode", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

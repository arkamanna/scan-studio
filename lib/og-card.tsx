import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";

export const SITE_URL = "https://scan-studios.vercel.app";

const toDataUri = (mime: string, data: Buffer | string) => `data:${mime};base64,${Buffer.from(data).toString("base64")}`;

/** Shared artwork for the website link preview (Open Graph) and the GitHub social preview. */
export async function renderCard(width: number, height: number) {
  const font = (weight: number) => readFile(join(process.cwd(), "node_modules/@fontsource/inter/files", `inter-latin-${weight}-normal.woff`));
  const [avatar, qrSvg, regular, semibold, extrabold] = await Promise.all([
    readFile(join(process.cwd(), "public", "arka.jpg")),
    QRCode.toString(SITE_URL, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } }),
    font(400),
    font(600),
    font(800),
  ]);

  const s = width / 1200;
  const px = (n: number) => Math.round(n * s);
  const chips = ["QR codes", "Barcodes", "Camera scanner"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#070912",
          backgroundImage:
            "radial-gradient(circle at 8% 0%, rgba(124,58,237,0.55), transparent 45%), radial-gradient(circle at 100% 20%, rgba(6,182,212,0.40), transparent 45%), radial-gradient(circle at 55% 120%, rgba(236,72,153,0.28), transparent 50%)",
          color: "#f1f5f9",
          padding: `${px(64)}px ${px(72)}px`,
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingRight: px(40) }}>
          <div style={{ display: "flex", alignItems: "center", gap: px(16) }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: px(64),
                height: px(64),
                borderRadius: px(18),
                backgroundImage: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", width: px(30), height: px(30), gap: px(4) }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ width: px(13), height: px(13), borderRadius: px(3), background: i === 3 ? "rgba(255,255,255,0.55)" : "#fff" }} />
                ))}
              </div>
            </div>
            <div style={{ fontSize: px(32), fontWeight: 600, letterSpacing: -0.5 }}>Scan Studio</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: px(18) }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: px(64), fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5 }}>
              <span>Create &amp; scan</span>
              <span style={{ backgroundImage: "linear-gradient(90deg, #c4b5fd, #f0abfc, #67e8f9)", backgroundClip: "text", color: "transparent" }}>
                smart QR codes
              </span>
            </div>
            <div style={{ fontSize: px(23), color: "#94a3b8", lineHeight: 1.4, maxWidth: px(600) }}>
              Links, text, photos & documents become codes that open WhatsApp, Maps, Wi-Fi, Contacts and more.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: px(10), marginTop: px(6) }}>
              {chips.map((c) => (
                <div
                  key={c}
                  style={{
                    display: "flex",
                    fontSize: px(19),
                    fontWeight: 600,
                    padding: `${px(8)}px ${px(18)}px`,
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#e2e8f0",
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: px(14) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={toDataUri("image/jpeg", avatar)} width={px(52)} height={px(52)} style={{ borderRadius: 999, border: `${px(3)}px solid rgba(167,139,250,0.8)` }} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: px(15), letterSpacing: 2, color: "#94a3b8", textTransform: "uppercase" }}>Curated by</span>
              <span style={{ fontSize: px(24), fontWeight: 600 }}>Arka Manna</span>
            </div>
            <div style={{ display: "flex", marginLeft: "auto", fontSize: px(21), fontWeight: 600, color: "#67e8f9" }}>scan-studios.vercel.app</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: px(400) }}>
          <div
            style={{
              display: "flex",
              position: "relative",
              padding: px(30),
              borderRadius: px(36),
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <div style={{ display: "flex", padding: px(22), borderRadius: px(24), background: "#ffffff", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={toDataUri("image/svg+xml", qrSvg)} width={px(270)} height={px(270)} alt="" />
            </div>
            {[
              { top: 0, left: 0, borderTop: true, borderLeft: true },
              { top: 0, right: 0, borderTop: true, borderRight: true },
              { bottom: 0, left: 0, borderBottom: true, borderLeft: true },
              { bottom: 0, right: 0, borderBottom: true, borderRight: true },
            ].map(({ borderTop, borderLeft, borderRight, borderBottom, ...pos }, i) => {
              const edge = `${px(6)}px solid #67e8f9`;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: px(56),
                    height: px(56),
                    ...Object.fromEntries(Object.entries(pos).map(([k, v]) => [k, -px(6) + v])),
                    ...(borderTop && { borderTop: edge }),
                    ...(borderLeft && { borderLeft: edge }),
                    ...(borderRight && { borderRight: edge }),
                    ...(borderBottom && { borderBottom: edge }),
                    ...(borderTop && borderLeft && { borderTopLeftRadius: px(22) }),
                    ...(borderTop && borderRight && { borderTopRightRadius: px(22) }),
                    ...(borderBottom && borderLeft && { borderBottomLeftRadius: px(22) }),
                    ...(borderBottom && borderRight && { borderBottomRightRadius: px(22) }),
                  }}
                />
              );
            })}
            <div
              style={{
                position: "absolute",
                left: px(20),
                right: px(20),
                top: "50%",
                height: px(4),
                borderRadius: 999,
                backgroundImage: "linear-gradient(90deg, transparent, #22d3ee, transparent)",
                boxShadow: "0 0 24px rgba(34,211,238,0.9)",
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: semibold, weight: 600, style: "normal" },
        { name: "Inter", data: extrabold, weight: 800, style: "normal" },
      ],
    },
  );
}

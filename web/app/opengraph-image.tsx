import { ImageResponse } from "next/og";

export const dynamic = "force-static"; // required for output: export
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "GAFFER — World Cup 2026 Forecast Engine";

export default function OpengraphImage() {
  const bars = [
    { h: 150, c: "#828bfa" },
    { h: 240, c: "#828bfa" },
    { h: 330, c: "#d3b862" },
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(900px 500px at 85% -10%, rgba(130,139,250,0.16), transparent), #08090c",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 40 }}>
            <div style={{ width: 10, height: 16, borderRadius: 3, background: "#828bfa" }} />
            <div style={{ width: 10, height: 28, borderRadius: 3, background: "#828bfa" }} />
            <div style={{ width: 10, height: 40, borderRadius: 3, background: "#d3b862" }} />
          </div>
          <div
            style={{
              fontSize: 30,
              letterSpacing: 10,
              color: "#868fa1",
              textTransform: "uppercase",
            }}
          >
            FIFA World Cup 2026 · Live Forecast
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 230, fontWeight: 900, lineHeight: 1, color: "#828bfa" }}>
              GAFFER
            </div>
            <div style={{ fontSize: 42, color: "#e9edf4", marginTop: 18, maxWidth: 760 }}>
              Who wins the World Cup? Title odds from 50,000 simulations.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, paddingBottom: 8 }}>
            {bars.map((b, i) => (
              <div key={i} style={{ width: 46, height: b.h, borderRadius: 8, background: b.c }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 48, fontSize: 28, color: "#868fa1" }}>
          <div style={{ display: "flex" }}>gaffer-wc26.web.app</div>
          <div style={{ display: "flex" }}>Elo · Dixon-Coles · Transfermarkt · Monte Carlo</div>
        </div>
      </div>
    ),
    { ...size }
  );
}

import { ImageResponse } from "next/og";

export const alt = "FeedPlug - Gestion flux produits multi-canaux";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: "white",
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          FeedPlug
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#B0B0B0",
            maxWidth: 800,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Gestion flux produits simple — Google Shopping, Amazon, marketplaces
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            padding: "12px 24px",
            backgroundColor: "#6366f1",
            borderRadius: 8,
            fontSize: 18,
            color: "white",
            fontWeight: 600,
          }}
        >
          feedplug.com
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

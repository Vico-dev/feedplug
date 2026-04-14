import { ImageResponse } from "next/og";

export const alt = "FeedPlug - Logo";
export const size = { width: 200, height: 200 };
export const contentType = "image/png";

/**
 * Logo FeedPlug (200×200) : FP minimal, DA #0a0a0a sur blanc. JSON-LD, partages, etc.
 */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          borderRadius: 8,
          border: "2px solid #e5e7eb",
        }}
      >
        <span
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#0a0a0a",
            letterSpacing: "-0.04em",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          FP
        </span>
      </div>
    ),
    { ...size }
  );
}

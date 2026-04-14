import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple touch icon FeedPlug : FP comme icon.tsx, format 180x180.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          borderRadius: 24,
          border: "2px solid #e5e7eb",
        }}
      >
        <span
          style={{
            fontSize: 72,
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

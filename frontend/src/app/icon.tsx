import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Favicon FeedPlug : FP minimal, lisible en 32×32. DA #0a0a0a sur blanc.
 */
export default function Icon() {
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
          borderRadius: 4,
          border: "1px solid #E5E5E5",
        }}
      >
        <span
          style={{
            fontSize: 14,
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

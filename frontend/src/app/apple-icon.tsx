import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple touch icon FeedPlug (DS v2) : FP paper sur ink, 180x180.
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
          backgroundColor: "#0A0A0A",
          borderRadius: 36,
        }}
      >
        <span
          style={{
            fontSize: 88,
            fontWeight: 700,
            color: "#FAFAFA",
            letterSpacing: "-0.06em",
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

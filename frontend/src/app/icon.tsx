import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Compact mark FeedPlug (DS v2 Tesla mineral) : FP paper sur ink, coins arrondis.
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
          backgroundColor: "#0A0A0A",
          borderRadius: 6,
        }}
      >
        <span
          style={{
            fontSize: 16,
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

"use client";

/**
 * Spinner + texte de chargement centré (utilise les tokens).
 */
export function PageLoading({
  message = "Chargement…",
  style = {},
}: {
  message?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: "var(--empty-state-padding)",
        textAlign: "center",
        color: "var(--empty-state-text)",
        borderRadius: "var(--card-radius)",
        ...style,
      }}
    >
      <div
        style={{
          width: "var(--spinner-size)",
          height: "var(--spinner-size)",
          border: `4px solid var(--spinner-track)`,
          borderTopColor: "var(--spinner-color)",
          borderRadius: "50%",
          animation: "page-spinner 1s linear infinite",
          boxShadow: "var(--app-shadow-sm)",
          margin: "0 auto 16px",
        }}
      />
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{message}</p>
    </div>
  );
}

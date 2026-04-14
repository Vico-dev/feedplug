"use client";

/**
 * Bannière d’erreur avec message et bouton « Réessayer » optionnel.
 */
export function PageError({
  message,
  onRetry,
  style = {},
}: {
  message: string;
  onRetry?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="alert"
      style={{
        padding: 18,
        backgroundColor: "var(--alert-error-bg)",
        border: "1px solid var(--alert-error-border)",
        borderRadius: "var(--card-radius)",
        color: "var(--alert-error-color)",
        fontSize: 14,
        boxShadow: "var(--app-shadow-sm)",
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            minHeight: 38,
            padding: "0 14px",
            border: "1px solid var(--alert-error-border)",
            borderRadius: 10,
            backgroundColor: "#fff",
            color: "var(--alert-error-color)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}

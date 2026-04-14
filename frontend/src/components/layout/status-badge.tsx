"use client";

type StatusVariant = "success" | "error" | "warning" | "neutral";

const variantStyles: Record<
  StatusVariant,
  { backgroundColor: string; color: string }
> = {
  success: {
    backgroundColor: "var(--badge-success-bg)",
    color: "var(--badge-success-color)",
  },
  error: {
    backgroundColor: "var(--badge-error-bg)",
    color: "var(--badge-error-color)",
  },
  warning: {
    backgroundColor: "var(--badge-warning-bg)",
    color: "var(--badge-warning-color)",
  },
  neutral: {
    backgroundColor: "var(--badge-neutral-bg)",
    color: "var(--badge-neutral-color)",
  },
};

/**
 * Badge de statut (Actif, Erreur, En attente, etc.).
 */
export function StatusBadge({
  children,
  variant = "neutral",
  style = {},
}: {
  children: React.ReactNode;
  variant?: StatusVariant;
  style?: React.CSSProperties;
}) {
  const vs = variantStyles[variant];
  return (
    <span
      style={{
        fontSize: "var(--badge-font-size)",
        fontWeight: "var(--badge-fw)",
        padding: "var(--badge-padding)",
        borderRadius: "var(--badge-radius)",
        backgroundColor: vs.backgroundColor,
        color: vs.color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

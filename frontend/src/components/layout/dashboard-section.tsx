"use client";

import { ReactNode } from "react";

export function DashboardSection({
  title,
  description,
  actions,
  children,
  style = {},
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        ...style,
      }}
    >
      {(title || description || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            {title && (
              <h2
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  fontWeight: 600,
                  color: "var(--ink)",
                  letterSpacing: "-0.02em",
                }}
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                style={{
                  margin: title ? "6px 0 0" : 0,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--ink-3)",
                }}
              >
                {description}
              </p>
            )}
          </div>
          {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function DashboardStatGrid({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 18,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Tesla mineral KPI tile.
 *
 * The `accent` prop drives the icon chip color. To keep the palette
 * coherent we map any DS-token accent ("var(--ink)", "var(--danger)" …)
 * to a tasteful neutral background (paper-2 / soft-danger / soft-success
 * etc.). Hex values are still respected for back-compat but should be
 * avoided in new code.
 */
export function DashboardStatCard({
  icon,
  label,
  value,
  hint,
  accent = "var(--ink)",
}: {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  accent?: string;
}) {
  // Map known DS accents to (foreground, background) pairs. Anything else
  // falls back to the neutral ink/paper-2 pair.
  const iconChip: { fg: string; bg: string } = (() => {
    if (accent.includes("--success")) return { fg: "var(--success)", bg: "var(--success-bg)" };
    if (accent.includes("--warning")) return { fg: "var(--warning)", bg: "var(--warning-bg)" };
    if (accent.includes("--danger")) return { fg: "var(--danger)", bg: "var(--danger-bg)" };
    if (accent.includes("--accent")) return { fg: "var(--accent)", bg: "var(--accent-bg)" };
    return { fg: "var(--ink-2)", bg: "var(--paper-2)" };
  })();

  return (
    <div className="feedplug-shell-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            {label}
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontFamily: "var(--font-display)",
              fontSize: 30,
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "var(--ink)",
            }}
          >
            {value}
          </p>
          {hint && (
            <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--ink-3)" }}>{hint}</p>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--r-lg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: iconChip.bg,
              color: iconChip.fg,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardToolbar({
  children,
  style = {},
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="feedplug-shell-card"
      style={{
        padding: 18,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function DashboardInput({
  icon,
  children,
  style = {},
}: {
  icon?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minWidth: 220,
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--app-text-soft)",
            pointerEvents: "none",
          }}
        >
          {icon}
        </div>
      )}
      {children}
    </div>
  );
}

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
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--app-text)",
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
                  lineHeight: 1.6,
                  color: "var(--app-text-muted)",
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

export function DashboardStatCard({
  icon,
  label,
  value,
  hint,
  accent = "var(--app-accent)",
}: {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="feedplug-shell-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--app-text-muted)" }}>{label}</p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 30,
              lineHeight: 1,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              color: "var(--app-text)",
            }}
          >
            {value}
          </p>
          {hint && (
            <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--app-text-muted)" }}>{hint}</p>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${accent}18`,
              color: accent,
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

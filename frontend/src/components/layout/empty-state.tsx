"use client";

import { ReactNode } from "react";

/**
 * État vide : icône + titre + description + action optionnelle.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  style = {},
}: {
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  title: string;
  description?: string;
  action?: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: "var(--empty-state-padding)",
        textAlign: "center",
        color: "var(--empty-state-text)",
        border: "var(--card-border)",
        borderRadius: "var(--card-radius)",
        backgroundColor: "#ffffff",
        boxShadow: "var(--card-shadow)",
        ...style,
      }}
    >
      {Icon && (
        <Icon
          style={{
            width: 48,
            height: 48,
            color: "var(--empty-state-icon-color)",
            margin: "0 auto 18px",
            display: "block",
          }}
        />
      )}
      <p
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--empty-state-title)",
          margin: "0 0 8px 0",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </p>
      {description && (
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 16px 0" }}>{description}</p>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

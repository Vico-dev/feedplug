"use client";

import { CSSProperties, ReactNode } from "react";

/**
 * Conteneur standard pour toutes les pages du dashboard.
 * Padding, max-width et margin uniformes.
 */
export function PageLayout({
  children,
  className = "",
  style = {},
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`feedplug-page-layout ${className}`.trim()}
      style={{
        padding: "var(--page-padding-y) var(--page-padding-x)",
        maxWidth: "var(--page-max-width)",
        margin: "0 auto",
        fontFamily: "Inter, system-ui, sans-serif",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * En-tête de page standard : titre + sous-titre optionnel + actions optionnelles.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  icon: Icon,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: React.ComponentType<{ size?: number; style?: CSSProperties }>;
}) {
  return (
    <div
      style={{
        marginBottom: "var(--page-header-margin-bottom)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 18,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: "1 1 auto" }}>
        {Icon && (
          <Icon
            size={20}
            style={{
              color: "var(--app-accent)",
              flexShrink: 0,
              marginTop: 6,
              padding: 10,
              backgroundColor: "var(--app-accent-soft)",
              borderRadius: 12,
              width: 40,
              height: 40,
            }}
          />
        )}
        <div>
          <h1
            style={{
              fontSize: "var(--page-title-size)",
              fontWeight: "var(--page-title-weight)",
              color: "var(--page-title-color)",
              margin: 0,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: subtitle ? 8 : 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: "var(--page-subtitle-size)",
                color: "var(--page-subtitle-color)",
                margin: 0,
                lineHeight: 1.6,
                maxWidth: 720,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

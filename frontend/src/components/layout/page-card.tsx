"use client";

import { ReactNode } from "react";

/**
 * Carte de contenu standard dashboard (bordure, rayon, padding via design tokens).
 */
export function PageCard({
  children,
  style = {},
  className,
  ...rest
}: {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`feedplug-shell-card ${className ?? ""}`.trim()}
      style={{
        padding: "var(--card-padding)",
        boxShadow: "var(--card-shadow)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Titre de section (sous le page header).
 */
export function PageSectionTitle({
  children,
  style = {},
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <h2
      style={{
        fontSize: "var(--section-title-size)",
        fontWeight: "var(--section-title-fw)",
        color: "var(--section-title-color)",
        letterSpacing: "-0.02em",
        margin: "0 0 16px 0",
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

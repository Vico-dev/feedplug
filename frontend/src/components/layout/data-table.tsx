"use client";

import { ReactNode } from "react";

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--table-cell-padding)",
  fontWeight: "var(--table-header-fw)",
  backgroundColor: "var(--table-header-bg)",
  borderBottom: "var(--table-border)",
};

const tdStyle: React.CSSProperties = {
  padding: "var(--table-cell-padding)",
  borderBottom: "var(--table-border)",
  verticalAlign: "top",
};

/**
 * Conteneur de tableau avec styles unifiés (bordure, header).
 */
export function DataTable({
  children,
  style = {},
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        overflowX: "auto",
        border: "var(--table-border)",
        borderRadius: "var(--table-radius)",
        ...style,
      }}
    >
      <table style={tableStyle}>{children}</table>
    </div>
  );
}

export function DataTableHeader({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function DataTableRow({
  children,
  style = {},
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return <tr style={{ ...style }}>{children}</tr>;
}

export function DataTableTh({
  children,
  style = {},
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return <th style={{ ...thStyle, ...style }}>{children}</th>;
}

export function DataTableTd({
  children,
  style = {},
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return <td style={{ ...tdStyle, ...style }}>{children}</td>;
}

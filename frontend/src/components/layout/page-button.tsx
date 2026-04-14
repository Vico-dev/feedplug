"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: "var(--btn-height)",
  padding: "0 var(--btn-padding-x)",
  fontSize: 14,
  fontWeight: 600,
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all 0.2s ease",
};

export function PageButtonPrimary({
  children,
  disabled,
  type = "button",
  style = {},
  ...rest
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  style?: React.CSSProperties;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style">) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        ...baseStyle,
        backgroundColor: "var(--btn-primary-bg)",
        color: "var(--btn-primary-color)",
        boxShadow: "var(--app-shadow-sm)",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = "var(--btn-primary-bg-hover)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--btn-primary-bg)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = "2px solid var(--spinner-color)";
        e.currentTarget.style.outlineOffset = "2px";
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function PageButtonSecondary({
  children,
  disabled,
  type = "button",
  style = {},
  ...rest
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  style?: React.CSSProperties;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style">) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        ...baseStyle,
        backgroundColor: "var(--btn-secondary-bg)",
        color: "var(--btn-secondary-color)",
        border: "var(--btn-secondary-border)",
        borderRadius: "var(--btn-secondary-radius)",
        boxShadow: "var(--app-shadow-sm)",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = "var(--btn-secondary-bg-hover)";
          e.currentTarget.style.borderColor = "var(--app-border-strong)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--btn-secondary-bg)";
        e.currentTarget.style.color = "var(--btn-secondary-color)";
        e.currentTarget.style.borderColor = "var(--app-border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = "2px solid var(--btn-primary-bg)";
        e.currentTarget.style.outlineOffset = "2px";
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function PageButtonDanger({
  children,
  disabled,
  type = "button",
  style = {},
  ...rest
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  style?: React.CSSProperties;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style">) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        ...baseStyle,
        backgroundColor: "#dc2626",
        color: "#fff",
        boxShadow: "var(--app-shadow-sm)",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = "#b91c1c";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "#dc2626";
        e.currentTarget.style.transform = "translateY(0)";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

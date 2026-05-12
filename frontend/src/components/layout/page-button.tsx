"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: "var(--btn-height)",
  padding: "0 var(--btn-padding-x)",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.005em",
  border: "none",
  borderRadius: "var(--r-lg)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "background-color var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease), color var(--d-fast) var(--ease)",
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
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--btn-primary-bg)";
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = "2px solid var(--accent)";
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
          e.currentTarget.style.borderColor = "var(--line-strong)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--btn-secondary-bg)";
        e.currentTarget.style.color = "var(--btn-secondary-color)";
        e.currentTarget.style.borderColor = "var(--line)";
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = "2px solid var(--accent)";
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
        backgroundColor: "var(--danger)",
        color: "#ffffff",
        boxShadow: "var(--sh-sm)",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = "#8C1B12";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--danger)";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

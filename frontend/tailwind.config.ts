import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // shadcn / Radix tokens (HSL, themable)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Tesla mineral palette — direct utility access
        paper: {
          DEFAULT: "#FAFAFA",
          2: "#F2F2F2",
          3: "#EAEAEA",
        },
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#0A0A0A",
          2: "#2A2A2A",
          3: "#6F6F6F",
          4: "#B0B0B0",
        },
        line: {
          DEFAULT: "#E5E5E5",
          strong: "#CFCFCF",
        },
        steel: {
          DEFAULT: "#2A6FE8",
          hover: "#1F58C0",
          soft: "#E8EFFB",
        },
        success: {
          DEFAULT: "#15803D",
          soft: "#ECFDF3",
        },
        warning: {
          DEFAULT: "#B45309",
          soft: "#FEF6E7",
        },
        danger: {
          DEFAULT: "#B42318",
          soft: "#FEF1F1",
        },
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
        xl: "14px",
        "2xl": "20px",
        pill: "999px",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "fs-12": "0.75rem",
        "fs-13": "0.8125rem",
        "fs-14": "0.875rem",
        "fs-15": "0.9375rem",
        "fs-16": "1rem",
        "fs-18": "1.125rem",
        "fs-20": "1.25rem",
        "fs-24": "1.5rem",
        "fs-30": "1.875rem",
        "fs-36": "2.25rem",
        "fs-44": "2.75rem",
        "fs-56": "3.5rem",
        "fs-72": "4.5rem",
        "fs-96": "6rem",
        "fs-112": "7rem",
      },
      boxShadow: {
        xs: "0 1px 1px rgba(0,0,0,.04)",
        sm: "0 1px 2px rgba(0,0,0,.05), 0 1px 1px rgba(0,0,0,.04)",
        md: "0 6px 16px rgba(0,0,0,.06), 0 2px 4px rgba(0,0,0,.04)",
        lg: "0 16px 36px rgba(0,0,0,.08), 0 4px 8px rgba(0,0,0,.04)",
        xl: "0 28px 60px rgba(0,0,0,.10), 0 8px 16px rgba(0,0,0,.05)",
      },
      transitionTimingFunction: {
        ds: "cubic-bezier(.22,.61,.36,1)",
        "ds-io": "cubic-bezier(.65,0,.35,1)",
        "ds-spring": "cubic-bezier(.34,1.32,.64,1)",
      },
      transitionDuration: {
        fast: "140ms",
        base: "220ms",
        slow: "420ms",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;

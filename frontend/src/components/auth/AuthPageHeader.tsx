"use client";

import Link from "next/link";

/**
 * Header minimal pour les pages hors [locale] : login, register.
 * Pas de useLocale pour éviter d’être dans NextIntlClientProvider.
 */
export default function AuthPageHeader() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        backgroundColor: "rgba(250,250,250,0.85)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: "1px solid var(--line)",
        zIndex: 1000,
        boxShadow: "var(--sh-xs)",
        padding: "16px 0",
      }}
    >
      <div
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--r-md)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "var(--ink)",
              color: "var(--paper)",
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              boxShadow: "var(--sh-sm)",
            }}
          >
            FP
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 6,
              fontFamily: "var(--font-display)",
              fontSize: 17,
              fontWeight: 700,
              color: "var(--ink)",
              letterSpacing: "-0.025em",
            }}
          >
            FeedPlug
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: "var(--accent)",
                transform: "translateY(-2px)",
                display: "inline-block",
              }}
            />
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <Link
            href="/tarifs"
            style={{
              fontSize: "14px",
              color: "var(--ink-2)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Tarifs
          </Link>
          <Link
            href="/docs"
            style={{
              fontSize: "14px",
              color: "var(--ink-2)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Documentation
          </Link>
          <Link
            href="/login"
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--ink)",
              textDecoration: "none",
              borderBottom: "1px solid var(--line-strong)",
              paddingBottom: 2,
            }}
          >
            Connexion
          </Link>
        </div>
      </div>
    </nav>
  );
}

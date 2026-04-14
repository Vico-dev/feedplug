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
        backgroundColor: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(226,232,240,0.9)",
        zIndex: 1000,
        boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
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
              borderRadius: 12,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#111827",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              boxShadow: "0 8px 20px rgba(15,23,42,0.14)",
            }}
          >
            FP
          </span>
          <span
            style={{
              fontSize: 17,
              fontWeight: 650,
              color: "#111827",
              letterSpacing: "-0.03em",
            }}
          >
            FeedPlug
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <Link
            href="/tarifs"
            style={{
              fontSize: "14px",
              color: "#475569",
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
              color: "#475569",
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
              color: "#0f172a",
              textDecoration: "none",
              borderBottom: "1px solid #cbd5e1",
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

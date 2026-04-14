"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
    try {
      Sentry.captureException(error);
    } catch {}
  }, [error]);

  return (
    <div style={{ padding: "32px", maxWidth: "600px", margin: "0 auto", textAlign: "center", paddingTop: "80px" }}>
      <AlertCircle style={{ width: "48px", height: "48px", color: "#dc2626", margin: "0 auto 16px" }} />
      <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#111827", margin: "0 0 8px" }}>
        Erreur de chargement
      </h2>
      <p style={{ fontSize: "14px", color: "#6b7280", margin: "0 0 24px", lineHeight: "1.5" }}>
        Cette page n&apos;a pas pu se charger correctement.
        {error.message && (
          <span style={{ display: "block", marginTop: "8px", fontSize: "12px", color: "#9ca3af" }}>
            {error.message.substring(0, 200)}
          </span>
        )}
      </p>
      <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
        <button
          onClick={reset}
          style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "10px 20px", backgroundColor: "#111827", color: "white",
            border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer",
          }}
        >
          <RefreshCw style={{ width: "14px", height: "14px" }} />
          Réessayer
        </button>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "10px 20px", border: "1px solid #d1d5db", borderRadius: "8px",
            fontSize: "14px", color: "#374151", textDecoration: "none",
          }}
        >
          <ArrowLeft style={{ width: "14px", height: "14px" }} />
          Dashboard
        </Link>
      </div>
    </div>
  );
}

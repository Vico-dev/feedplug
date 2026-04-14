"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log vers Sentry si disponible
    console.error("Application error:", error);
    try {
      Sentry.captureException(error);
    } catch {}
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "440px",
          width: "100%",
          textAlign: "center",
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "48px 32px",
        }}
      >
        <AlertCircle
          style={{
            width: "48px",
            height: "48px",
            color: "#dc2626",
            margin: "0 auto 16px",
          }}
        />
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#111827",
            margin: "0 0 8px",
          }}
        >
          Une erreur est survenue
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: "0 0 24px",
            lineHeight: "1.5",
          }}
        >
          Nous sommes désolés, quelque chose s&apos;est mal passé. Notre équipe
          a été notifiée.
        </p>
        <button
          onClick={reset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 24px",
            backgroundColor: "#111827",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          <RefreshCw style={{ width: "16px", height: "16px" }} />
          Réessayer
        </button>
      </div>
    </div>
  );
}

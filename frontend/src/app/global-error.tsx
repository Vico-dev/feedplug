"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Filet de sécurité ultime : capture les crashs du root layout lui-même
 * (AuthProvider, polices, bridge Shopify…), que `error.tsx` ne peut pas
 * intercepter puisqu'il vit à l'intérieur de ce layout.
 *
 * global-error remplace tout le document : il doit donc rendre <html>/<body>
 * et ne peut pas dépendre des variables CSS du layout (couleurs en dur).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
    try {
      Sentry.captureException(error);
    } catch {}
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f4f4f3",
          padding: "24px",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "440px",
            width: "100%",
            textAlign: "center",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e5e5e3",
            padding: "48px 32px",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#1a1a1a",
              margin: "0 0 8px",
            }}
          >
            Une erreur est survenue
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "#666666",
              margin: "0 0 24px",
              lineHeight: 1.5,
            }}
          >
            Nous sommes désolés, quelque chose s&apos;est mal passé. Notre
            équipe a été notifiée.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "12px 24px",
              backgroundColor: "#1a1a1a",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}

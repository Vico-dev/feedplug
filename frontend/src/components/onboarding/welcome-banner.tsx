"use client";

import { Sparkles, X } from "lucide-react";

interface WelcomeBannerProps {
  onStartOnboarding: () => void;
  onDismiss: () => void;
}

export function WelcomeBanner({ onStartOnboarding, onDismiss }: WelcomeBannerProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9998,
        maxWidth: "calc(100vw - 32px)",
        width: "420px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
        borderRadius: "12px",
        backgroundColor: "#ffffff",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "10px",
          backgroundColor: "var(--accent-bg)",
          color: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Sparkles style={{ width: "22px", height: "22px" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0a0a0a" }}>
          Nouveau sur FeedPlug ?
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ink-3)" }}>
          Le plus rapide : connectez une source. La visite guidée reste dispo si besoin.
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* P1 — La visite guidée est une option secondaire : bouton discret (ghost),
            pas un CTA plein à égalité avec l'activation. */}
        <button
          type="button"
          onClick={onStartOnboarding}
          style={{
            padding: "9px 14px",
            backgroundColor: "transparent",
            color: "var(--ink-3)",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Visite guidée
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer"
          style={{
            padding: "8px",
            backgroundColor: "transparent",
            border: "none",
            borderRadius: "6px",
            color: "var(--ink-4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X style={{ width: "18px", height: "18px" }} />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

const CONSENT_KEY = "feedplug_cookie_consent";

type ConsentStatus = "accepted" | "refused" | null;

function getConsent(): ConsentStatus {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === "accepted" || v === "refused") return v;
  return null;
}

export function useConsent() {
  const [consent, setConsent] = useState<ConsentStatus>(() => getConsent());

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setConsent("accepted");
  };

  const refuse = () => {
    localStorage.setItem(CONSENT_KEY, "refused");
    setConsent("refused");
  };

  return { consent, accept, refuse };
}

export default function CookieConsent({
  onAccept,
  onRefuse,
}: {
  onAccept: () => void;
  onRefuse: () => void;
}) {
  const t = useTranslations("cookieConsent");
  const { consent, accept, refuse } = useConsent();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if no choice made yet
    if (consent === null) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
    if (consent === "accepted") onAccept();
  }, [consent, onAccept]);

  const handleAccept = () => {
    accept();
    setVisible(false);
    onAccept();
  };

  const handleRefuse = () => {
    refuse();
    setVisible(false);
    onRefuse();
  };

  if (!visible) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cookie-banner {
          animation: slideUp 0.35s ease-out forwards;
        }
      `}} />
      <div className="cookie-banner" style={{
        position: "fixed",
        bottom: "24px",
        left: "24px",
        right: "24px",
        maxWidth: "480px",
        zIndex: 9999,
        backgroundColor: "#ffffff",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        fontFamily: "inherit",
      }}>
        <p style={{
          fontSize: "14px",
          lineHeight: "1.6",
          color: "var(--ink-2)",
          margin: "0 0 16px 0",
        }}>
          {t("body")}{" "}
          <Link href="/legal/cookies" style={{ color: "var(--ink)", textDecoration: "underline" }}>
            {t("learnMore")}
          </Link>
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleRefuse} style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: "500",
            color: "var(--ink-3)",
            backgroundColor: "transparent",
            border: "1px solid var(--line-strong)",
            borderRadius: "6px",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "border-color 0.2s",
          }}>
            {t("refuse")}
          </button>
          <button onClick={handleAccept} style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#ffffff",
            backgroundColor: "var(--ink)",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background-color 0.2s",
          }}>
            {t("accept")}
          </button>
        </div>
      </div>
    </>
  );
}

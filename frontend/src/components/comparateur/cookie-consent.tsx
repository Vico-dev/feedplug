"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Bandeau de consentement cookies (RGPD), scopé au comparateur conso.
// Stocke le choix dans localStorage + un cookie 1st-party (lisible côté SSR si besoin).
// Le consentement conditionne les cookies NON essentiels (analytics) ; le cookie de
// session (cmp_session) reste essentiel et hors périmètre.
const KEY = "cmp_cookie_consent";

function persist(value: "all" | "essential") {
  try {
    localStorage.setItem(KEY, value);
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${KEY}=${value}; Max-Age=${oneYear}; Path=/; SameSite=Lax`;
  } catch {
    /* stockage indisponible : on n'affiche juste plus le bandeau cette session */
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      // Affichage one-shot au montage client (localStorage indispo en SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!visible) return null;

  function choose(value: "all" | "essential") {
    persist(value);
    setVisible(false);
    // Signal pour un éventuel chargement conditionnel de l'analytics.
    try { window.dispatchEvent(new CustomEvent("cmp-consent", { detail: value })); } catch { /* ignore */ }
  }

  return (
    <div
      role="dialog"
      aria-label="Consentement cookies"
      style={{
        position: "fixed",
        left: "16px",
        right: "16px",
        bottom: "16px",
        zIndex: 2000,
        maxWidth: "560px",
        margin: "0 auto",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-xl)",
        boxShadow: "var(--sh-lg)",
        padding: "18px 20px",
      }}
    >
      <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>
        On respecte ta vie privée
      </p>
      <p style={{ margin: "8px 0 0", fontSize: "13px", lineHeight: 1.55, color: "var(--ink-3)" }}>
        On utilise des cookies essentiels au fonctionnement du comparateur, et — avec ton accord — des
        cookies de mesure d&apos;audience. Tu peux refuser les non-essentiels.{" "}
        <Link href="/cookies" style={{ color: "var(--accent)", textDecoration: "none" }}>
          En savoir plus
        </Link>
        .
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px" }}>
        <button
          type="button"
          onClick={() => choose("all")}
          className="cta-btn"
          style={{ height: "40px", padding: "0 18px", borderRadius: "var(--r-lg)", fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none" }}
        >
          Tout accepter
        </button>
        <button
          type="button"
          onClick={() => choose("essential")}
          className="card-hover"
          style={{ height: "40px", padding: "0 18px", borderRadius: "var(--r-lg)", background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
        >
          Refuser les non-essentiels
        </button>
      </div>
    </div>
  );
}

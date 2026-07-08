"use client";

// Bouton « Modifier mon choix » de la page /cookies (conso).
// Efface le choix persisté par la bannière (components/comparateur/cookie-consent.tsx :
// localStorage + cookie 1st-party sous la clé cmp_cookie_consent) puis recharge la
// page → la bannière réapparaît et l'utilisateur peut re-consentir ou refuser.
const KEY = "cmp_cookie_consent";

export default function CookieChoiceReset() {
  function resetChoice() {
    try {
      localStorage.removeItem(KEY);
      document.cookie = `${KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
    } catch {
      /* stockage indisponible : le reload réaffichera la bannière de toute façon */
    }
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={resetChoice}
      className="cta-btn"
      style={{
        height: "40px",
        padding: "0 18px",
        borderRadius: "var(--r-lg)",
        fontFamily: "var(--font-sans)",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        border: "none",
      }}
    >
      Modifier mon choix
    </button>
  );
}

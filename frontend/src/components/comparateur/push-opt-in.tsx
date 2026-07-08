"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  getCurrentSubscription,
  getPermissionState,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";
import { sendTestPush } from "@/lib/comparator-api";

const cardStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "14px",
  padding: "16px 18px",
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-xl)",
  boxShadow: "var(--sh-xs)",
};

const glyphStyle: CSSProperties = {
  height: "40px",
  width: "40px",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--r-lg)",
  background: "var(--accent-bg)",
  color: "var(--accent)",
};

const primaryBtn: CSSProperties = {
  flexShrink: 0,
  height: "38px",
  padding: "0 18px",
  borderRadius: "var(--r-lg)",
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  background: "var(--ink)",
  color: "var(--paper)",
  border: "1px solid var(--ink)",
};

const secondaryBtn: CSSProperties = {
  flexShrink: 0,
  height: "38px",
  padding: "0 14px",
  borderRadius: "var(--r-lg)",
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  background: "var(--surface)",
  color: "var(--ink-3)",
  border: "1px solid var(--line)",
};

const activePill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  borderRadius: "var(--r-pill)",
  background: "var(--success-bg)",
  color: "var(--success)",
  fontSize: "12px",
  fontWeight: 600,
};

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

type Status = "loading" | "unsupported" | "denied" | "unsubscribed" | "subscribed";

/**
 * Opt-in aux alertes push (baisse de prix) du comparateur.
 * États : non supporté (rien), permission refusée (message), non abonné
 * (bouton activer), abonné (pill actif + test + désactiver).
 */
export default function PushOptIn() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isPushSupported()) {
        if (active) setStatus("unsupported");
        return;
      }
      if (getPermissionState() === "denied") {
        if (active) setStatus("denied");
        return;
      }
      const sub = await getCurrentSubscription().catch(() => null);
      if (active) setStatus(sub ? "subscribed" : "unsubscribed");
    })();
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setFeedback(null);
    const result = await subscribeToPush();
    if (result.ok) {
      setStatus("subscribed");
    } else if (result.reason === "denied") {
      setStatus("denied");
    } else if (result.reason === "unavailable") {
      setFeedback("Les alertes ne sont pas encore disponibles. Réessayez plus tard.");
    } else {
      setFeedback("Impossible d'activer les alertes sur cet appareil.");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setFeedback(null);
    await unsubscribeFromPush();
    setStatus("unsubscribed");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await sendTestPush();
      setFeedback(
        result.sent > 0
          ? "Notification de test envoyée — elle arrive dans un instant."
          : "Aucune notification envoyée (service push non configuré ou abonnement expiré).",
      );
    } catch {
      setFeedback("Échec de l'envoi de la notification de test.");
    }
    setBusy(false);
  }

  // Navigateur sans Web Push (ou pendant la détection) : on n'affiche rien.
  if (status === "loading" || status === "unsupported") return null;

  return (
    <section aria-label="Alertes de baisse de prix" style={{ margin: "24px 0 0" }}>
      <div style={cardStyle}>
        <span style={glyphStyle}>
          <BellIcon />
        </span>

        <div style={{ flex: 1, minWidth: "200px" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
            Alertes de baisse de prix
            {status === "subscribed" && <span style={{ ...activePill, marginLeft: "10px" }}>Activées</span>}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: "13px", color: "var(--ink-3)" }}>
            {status === "denied"
              ? "Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages de votre navigateur pour recevoir les alertes."
              : status === "subscribed"
                ? "Vous recevez une notification dès que le prix d'un produit suivi baisse."
                : "Recevez une notification sur cet appareil dès que le prix d'un produit suivi baisse."}
          </p>
          {feedback && (
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--ink-4)" }}>{feedback}</p>
          )}
        </div>

        {status === "unsubscribed" && (
          <button type="button" onClick={enable} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Activation…" : "Activer les alertes"}
          </button>
        )}

        {status === "subscribed" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button type="button" onClick={test} disabled={busy} style={{ ...secondaryBtn, color: "var(--accent)", opacity: busy ? 0.6 : 1 }}>
              Recevoir une notification de test
            </button>
            <button type="button" onClick={disable} disabled={busy} style={{ ...secondaryBtn, opacity: busy ? 0.6 : 1 }}>
              Désactiver
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

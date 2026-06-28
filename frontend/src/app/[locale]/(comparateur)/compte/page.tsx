"use client";

import { useState, type CSSProperties } from "react";
import { requestMagicLink } from "@/lib/comparator-api";

const eyebrowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "9px",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};
const dotStyle: CSSProperties = {
  width: "7px",
  height: "7px",
  borderRadius: "999px",
  backgroundColor: "var(--accent)",
  boxShadow: "0 0 0 4px var(--accent-bg)",
  display: "inline-block",
};

export default function ComptePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || status === "sending") return;
    setStatus("sending");
    try {
      await requestMagicLink(value, "fr");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main style={{ maxWidth: "520px", margin: "0 auto", padding: "56px var(--page-padding-x) 96px" }}>
      <div style={eyebrowStyle}>
        <span style={dotStyle} />
        Mon compte
      </div>

      <h1
        className="hero-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(34px, 5vw, 52px)",
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 1.0,
          color: "var(--ink)",
          margin: "22px 0 0",
          textWrap: "balance",
        }}
      >
        Suivez vos prix,{" "}
        <em
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 400,
            color: "var(--ink-2)",
            letterSpacing: "-0.02em",
          }}
        >
          sans mot de passe.
        </em>
      </h1>

      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "17px",
          lineHeight: 1.55,
          color: "var(--ink-2)",
          margin: "18px 0 0",
        }}
      >
        Entrez votre e-mail : on vous envoie un lien de connexion sécurisé. Pas de mot de passe à retenir.
      </p>

      {status === "sent" ? (
        <div
          style={{
            margin: "28px 0 0",
            padding: "24px",
            background: "var(--success-bg)",
            border: "1px solid var(--success)",
            borderRadius: "var(--r-xl)",
          }}
        >
          <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 700, color: "var(--ink)" }}>
            Vérifiez votre boîte mail
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "14px", lineHeight: 1.55, color: "var(--ink-2)" }}>
            Si un compte est associé à <strong>{email.trim()}</strong>, un lien de connexion vient d&apos;être
            envoyé. Il expire dans 15 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ margin: "28px 0 0" }}>
          <div
            style={{
              display: "flex",
              gap: "8px",
              padding: "6px",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              borderRadius: "var(--r-xl)",
              boxShadow: "var(--sh-sm)",
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              aria-label="Votre adresse e-mail"
              className="input-field"
              style={{
                flex: 1,
                padding: "14px 16px",
                border: "none",
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                outline: "none",
                background: "transparent",
                color: "var(--ink)",
                borderRadius: "var(--r-md)",
              }}
            />
            <button
              type="submit"
              disabled={status === "sending" || !email.trim()}
              className="cta-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "14px 22px",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                fontWeight: 600,
                borderRadius: "var(--r-md)",
                cursor: status === "sending" ? "default" : "pointer",
                whiteSpace: "nowrap",
                opacity: status === "sending" || !email.trim() ? 0.6 : 1,
              }}
            >
              {status === "sending" ? "Envoi…" : "Recevoir le lien"}
            </button>
          </div>

          {status === "error" && (
            <p style={{ margin: "12px 4px 0", fontSize: "13px", color: "var(--warning)" }}>
              Une erreur est survenue. Réessayez dans un instant.
            </p>
          )}

          <p style={{ margin: "16px 4px 0", fontSize: "12px", lineHeight: 1.5, color: "var(--ink-4)" }}>
            En continuant, vous acceptez de recevoir un e-mail de connexion. Nous ne stockons jamais de mot de passe.
          </p>
        </form>
      )}
    </main>
  );
}

"use client";

import { Suspense, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { updateProfile } from "@/lib/comparator-api";

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

function BienvenueInner() {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next");
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/compte/feed";

  const [firstName, setFirstName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const value = firstName.trim();
    setSaving(true);
    try {
      if (value) await updateProfile({ firstName: value });
    } catch {
      // Étape optionnelle : on poursuit même en cas d'échec réseau.
    } finally {
      router.replace(next);
    }
  }

  function skip() {
    if (saving) return;
    router.replace(next);
  }

  return (
    <main style={{ maxWidth: "520px", margin: "0 auto", padding: "72px var(--page-padding-x) 96px" }}>
      <div style={eyebrowStyle}>
        <span style={dotStyle} />
        Bienvenue
      </div>

      <h1
        className="hero-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(32px, 4.8vw, 48px)",
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 1.0,
          color: "var(--ink)",
          margin: "22px 0 0",
          textWrap: "balance",
        }}
      >
        Comment on{" "}
        <em
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 400,
            color: "var(--ink-2)",
            letterSpacing: "-0.02em",
          }}
        >
          t&apos;appelle ?
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
        Juste un prénom, pour personnaliser un peu. Vous pourrez le changer à tout moment.
      </p>

      <form onSubmit={save} style={{ margin: "28px 0 0" }}>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Votre prénom"
          aria-label="Votre prénom"
          autoFocus
          maxLength={80}
          className="input-field"
          style={{
            width: "100%",
            padding: "16px 18px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            outline: "none",
            color: "var(--ink)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--sh-sm)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "24px 0 0", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={saving}
            className="cta-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "14px 24px",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: 600,
              borderRadius: "var(--r-lg)",
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Un instant…" : "Continuer"}
          </button>
          <button
            type="button"
            onClick={skip}
            disabled={saving}
            style={{
              background: "none",
              border: "none",
              padding: "8px 4px",
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--ink-3)",
              cursor: saving ? "default" : "pointer",
            }}
          >
            Plus tard
          </button>
        </div>
      </form>
    </main>
  );
}

export default function BienvenuePage() {
  return (
    <Suspense fallback={null}>
      <BienvenueInner />
    </Suspense>
  );
}

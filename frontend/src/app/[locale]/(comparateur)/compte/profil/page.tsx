"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getProfile,
  updateProfile,
  deleteAccount,
  logout,
  type ComparatorProfile,
} from "@/lib/comparator-api";

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
const labelStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
  margin: "0 0 8px",
};
const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  border: "1px solid var(--line)",
  background: "var(--surface)",
  fontFamily: "var(--font-sans)",
  fontSize: "16px",
  outline: "none",
  color: "var(--ink)",
  borderRadius: "var(--r-lg)",
};

const COUNTRIES: { code: string; label: string }[] = [
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "GB", label: "Royaume-Uni" },
];

export default function ProfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ComparatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // Champs éditables
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState("FR");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await getProfile();
        if (!active) return;
        setProfile(p);
        setFirstName(p.firstName || "");
        setLastName(p.lastName || "");
        setCountryCode(p.countryCode || "FR");
        setMarketingOptIn(p.marketingOptIn === true);
      } catch (e) {
        if (!active) return;
        if ((e as { status?: number }).status === 401) setAuthError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    try {
      const updated = await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        countryCode,
        marketingOptIn,
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2800);
    } catch (e) {
      if ((e as { status?: number }).status === 401) setAuthError(true);
      else setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      await deleteAccount();
      router.replace("/compte");
    } catch {
      setDeleteError(true);
      setDeleting(false);
    }
  }

  if (authError) {
    return (
      <main style={{ maxWidth: "520px", margin: "0 auto", padding: "96px var(--page-padding-x)", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          Connexion requise
        </p>
        <p style={{ margin: "10px 0 22px", fontSize: "15px", color: "var(--ink-3)" }}>
          Connectez-vous pour gérer votre profil.
        </p>
        <Link href="/compte" className="cta-btn" style={{ display: "inline-flex", padding: "13px 22px", borderRadius: "var(--r-lg)", fontWeight: 600, textDecoration: "none" }}>
          Se connecter
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "560px", margin: "0 auto", padding: "56px var(--page-padding-x) 96px" }}>
      <div style={eyebrowStyle}>
        <span style={dotStyle} />
        Mon profil
      </div>

      <h1
        className="hero-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(32px, 4.6vw, 48px)",
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 1.0,
          color: "var(--ink)",
          margin: "22px 0 0",
          textWrap: "balance",
        }}
      >
        Vos{" "}
        <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)", letterSpacing: "-0.02em" }}>
          informations.
        </em>
      </h1>

      {loading ? (
        <p style={{ margin: "40px 0 0", fontSize: "15px", color: "var(--ink-3)" }}>Chargement…</p>
      ) : (
        <>
          <form onSubmit={save} style={{ margin: "36px 0 0", display: "flex", flexDirection: "column", gap: "22px" }}>
            <div>
              <label htmlFor="firstName" style={labelStyle}>Prénom</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Votre prénom"
                maxLength={80}
                className="input-field"
                style={fieldStyle}
              />
            </div>

            <div>
              <label htmlFor="lastName" style={labelStyle}>Nom (facultatif)</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Votre nom"
                maxLength={80}
                className="input-field"
                style={fieldStyle}
              />
            </div>

            <div>
              <label htmlFor="email" style={labelStyle}>E-mail</label>
              <input
                id="email"
                type="email"
                value={profile?.email || ""}
                readOnly
                aria-readonly={true}
                style={{ ...fieldStyle, color: "var(--ink-3)", background: "var(--surface-2, var(--surface))", cursor: "not-allowed" }}
              />
              <p style={{ margin: "8px 2px 0", fontSize: "12px", color: "var(--ink-4)" }}>
                L&apos;e-mail sert à vous connecter, il n&apos;est pas modifiable ici.
              </p>
            </div>

            <div>
              <label htmlFor="countryCode" style={labelStyle}>Pays préféré</label>
              <select
                id="countryCode"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="input-field"
                style={fieldStyle}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>

            <label
              htmlFor="marketingOptIn"
              className="card-hover"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "13px",
                padding: "16px 18px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-xl)",
                boxShadow: "var(--sh-xs)",
                cursor: "pointer",
              }}
            >
              <input
                id="marketingOptIn"
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "var(--accent)", cursor: "pointer" }}
              />
              <span>
                <span style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "15px", fontWeight: 600, color: "var(--ink)" }}>
                  Recevoir les alertes baisses de prix
                </span>
                <span style={{ display: "block", margin: "4px 0 0", fontSize: "13px", lineHeight: 1.5, color: "var(--ink-3)" }}>
                  Un e-mail quand un produit que vous suivez baisse. Désactivable à tout moment.
                </span>
              </span>
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
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
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
              {saved && <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--success, var(--accent))" }}>Enregistré ✓</span>}
              {saveError && <span style={{ fontSize: "13px", color: "var(--warning)" }}>Échec, réessayez.</span>}
            </div>
          </form>

          {/* Déconnexion */}
          <div style={{ margin: "40px 0 0", paddingTop: "28px", borderTop: "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={async () => {
                try { await logout(); } catch { /* no-op */ }
                router.replace("/compte");
              }}
              style={{
                background: "none",
                border: "1px solid var(--line)",
                padding: "11px 18px",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--ink-2)",
                borderRadius: "var(--r-lg)",
                cursor: "pointer",
              }}
            >
              Se déconnecter
            </button>
          </div>

          {/* Zone de suppression de compte (RGPD) */}
          <div
            style={{
              margin: "36px 0 0",
              padding: "22px",
              border: "1px solid var(--warning, var(--line))",
              background: "var(--warning-bg, var(--surface))",
              borderRadius: "var(--r-xl)",
            }}
          >
            <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
              Supprimer mon compte
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "13px", lineHeight: 1.55, color: "var(--ink-2)" }}>
              Suppression définitive de votre compte et de vos données (produits suivis, préférences).
              Cette action est irréversible.
            </p>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{
                  margin: "16px 0 0",
                  background: "none",
                  border: "1px solid var(--warning, var(--line))",
                  padding: "11px 18px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--warning, var(--ink))",
                  borderRadius: "var(--r-lg)",
                  cursor: "pointer",
                }}
              >
                Supprimer mon compte
              </button>
            ) : (
              <div style={{ margin: "16px 0 0" }}>
                <p style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>
                  Vous êtes sûr ? Cette action est définitive.
                </p>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={doDelete}
                    disabled={deleting}
                    style={{
                      background: "var(--warning, var(--ink))",
                      border: "none",
                      padding: "12px 20px",
                      fontFamily: "var(--font-sans)",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--paper, #fff)",
                      borderRadius: "var(--r-lg)",
                      cursor: deleting ? "default" : "pointer",
                      opacity: deleting ? 0.6 : 1,
                    }}
                  >
                    {deleting ? "Suppression…" : "Oui, supprimer définitivement"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    style={{
                      background: "none",
                      border: "1px solid var(--line)",
                      padding: "12px 20px",
                      fontFamily: "var(--font-sans)",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      borderRadius: "var(--r-lg)",
                      cursor: deleting ? "default" : "pointer",
                    }}
                  >
                    Annuler
                  </button>
                </div>
                {deleteError && (
                  <p style={{ margin: "12px 0 0", fontSize: "13px", color: "var(--warning)" }}>
                    La suppression a échoué. Réessayez dans un instant.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

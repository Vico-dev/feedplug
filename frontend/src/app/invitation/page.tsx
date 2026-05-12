"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, CheckCircle, AlertCircle, Mail } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

const API_URL = API_BASE_URL;

function InvitationForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [autoLoggedIn, setAutoLoggedIn] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--paper-2)",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            width: "100%",
            padding: "40px",
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid var(--line)",
            textAlign: "center",
          }}
        >
          <AlertCircle
            style={{ width: "48px", height: "48px", color: "var(--danger)", margin: "0 auto 16px" }}
          />
          <h1 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)", margin: "0 0 8px" }}>
            Lien invalide
          </h1>
          <p style={{ fontSize: "14px", color: "var(--ink-3)", margin: "0 0 24px" }}>
            Ce lien d&apos;invitation est invalide ou a expiré. Demandez une nouvelle invitation à
            votre équipe.
          </p>
          <Link
            href="/login"
            style={{
              fontSize: "14px",
              color: "var(--accent)",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--paper-2)",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            width: "100%",
            padding: "40px",
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid var(--line)",
            textAlign: "center",
          }}
        >
          <CheckCircle
            style={{ width: "48px", height: "48px", color: "var(--success)", margin: "0 auto 16px" }}
          />
          <h1 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)", margin: "0 0 8px" }}>
            Compte activé
          </h1>
          <p style={{ fontSize: "14px", color: "var(--ink-3)", margin: "0 0 24px" }}>
            {autoLoggedIn
              ? "Votre mot de passe a été défini. Vous êtes connecté et pouvez accéder au tableau de bord."
              : "Votre mot de passe a été défini. Connectez-vous pour accéder au tableau de bord."}
          </p>
          {autoLoggedIn ? (
            <Link
              href="/dashboard"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                backgroundColor: "var(--ink)",
                color: "white",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Accéder au tableau de bord
            </Link>
          ) : (
            <Link
              href="/login"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                backgroundColor: "var(--ink)",
                color: "white",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Se connecter
            </Link>
          )}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/auth/accept-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data: { message?: string; user?: unknown } = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de l'activation");
      }

      if (data.user && typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(data.user));
      }
      setSuccess(true);
      setAutoLoggedIn(!!data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--paper-2)",
      }}
    >
      <div
        style={{
          maxWidth: "400px",
          width: "100%",
          padding: "40px",
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid var(--line)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <Mail style={{ width: "40px", height: "40px", color: "var(--accent)", margin: "0 auto 12px" }} />
          <h1 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)", margin: "0 0 8px" }}>
            Rejoindre l&apos;équipe FeedPlug
          </h1>
          <p style={{ fontSize: "14px", color: "var(--ink-3)", margin: 0 }}>
            Définissez votre mot de passe pour activer votre compte (8+ caractères, 1 majuscule, 1
            chiffre).
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "500",
                color: "var(--ink-2)",
                marginBottom: "6px",
              }}
            >
              Mot de passe
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "18px",
                  height: "18px",
                  color: "var(--ink-4)",
                }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                style={{
                  width: "100%",
                  padding: "12px 12px 12px 40px",
                  border: "1px solid var(--line-strong)",
                  borderRadius: "8px",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "500",
                color: "var(--ink-2)",
                marginBottom: "6px",
              }}
            >
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid var(--line-strong)",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: "13px", color: "var(--danger)", margin: "0 0 12px" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !password || !confirmPassword}
            style={{
              width: "100%",
              padding: "12px",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              color: "white",
              backgroundColor: isLoading ? "var(--line-strong)" : "var(--ink)",
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "Activation…" : "Activer mon compte"}
          </button>
        </form>

        <p style={{ fontSize: "12px", color: "var(--ink-4)", marginTop: "16px", textAlign: "center" }}>
          <Link href="/login" style={{ color: "var(--ink-3)", textDecoration: "none" }}>
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function InvitationPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--paper-2)",
          }}
        >
          Chargement…
        </div>
      }
    >
      <InvitationForm />
    </Suspense>
  );
}

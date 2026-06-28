"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addWatch, removeWatch, getWatchlist } from "@/lib/comparator-api";

/**
 * « Suivre le prix » — bouton client posé sur les cartes et la fiche produit.
 * - Connecté : ajoute/retire le produit de la watchlist (capture du prix à l'ajout côté backend).
 * - Non connecté (401) : redirige vers le tunnel magic-link `/compte`, en mémorisant
 *   la page de retour.
 *
 * Design system maison : style inline + variables CSS (pas de Tailwind brut).
 */
export default function WatchButton({
  groupId,
  country,
  variant = "default",
}: {
  groupId: string;
  country: string;
  variant?: "default" | "compact";
}) {
  const router = useRouter();
  const [watched, setWatched] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  // État initial best-effort : si l'utilisateur est connecté, on sait s'il suit déjà ce produit.
  useEffect(() => {
    let active = true;
    getWatchlist()
      .then((r) => {
        if (!active) return;
        setWatched(r.items.some((i) => i.groupId === groupId && i.country === country));
      })
      .catch(() => {
        /* 401 ou réseau : on laisse l'état par défaut (non suivi). */
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [groupId, country]);

  function goToLogin() {
    try {
      sessionStorage.setItem("cmp_return_to", window.location.pathname + window.location.search);
    } catch {
      /* sessionStorage indisponible : on continue sans mémoriser. */
    }
    router.push("/compte");
  }

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      if (watched) {
        await removeWatch(groupId, country);
        setWatched(false);
      } else {
        await addWatch(groupId, country);
        setWatched(true);
      }
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) {
        goToLogin();
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  const compact = variant === "compact";
  const label = watched ? "Suivi" : "Suivre le prix";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={watched}
      aria-label={watched ? "Ne plus suivre ce prix" : "Suivre le prix de ce produit"}
      className="card-hover"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        height: compact ? "34px" : "40px",
        padding: compact ? "0 12px" : "0 16px",
        borderRadius: "var(--r-lg)",
        fontFamily: "var(--font-sans)",
        fontSize: compact ? "13px" : "14px",
        fontWeight: 600,
        cursor: loading ? "default" : "pointer",
        whiteSpace: "nowrap",
        background: watched ? "var(--accent-bg)" : "var(--surface)",
        color: watched ? "var(--accent-2)" : "var(--ink)",
        border: `1px solid ${watched ? "var(--accent)" : "var(--line)"}`,
        opacity: loading ? 0.6 : hydrated ? 1 : 0.85,
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill={watched ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: compact ? "15px" : "16px", height: compact ? "15px" : "16px" }}
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {label}
    </button>
  );
}

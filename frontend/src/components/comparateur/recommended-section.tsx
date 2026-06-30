"use client";

/**
 * RecommendedSection — section « Recommandé pour toi » (perso conso).
 *
 * Composant CLIENT autonome : fetch authentifié des recommandations (intérêts + affinité
 * marques). Ne rend RIEN si l'user n'est pas connecté (401) ou n'a pas encore d'intérêts
 * (liste vide) — ce qui préserve intégralement le SSR public de la home. Embarquable sur la
 * home conso et sur compte/feed sans casser le rendu serveur.
 *
 * Design system maison (inline + vars CSS + classes globales). Pas de Tailwind.
 */

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getRecommendations, formatPrice, type RecommendationItem } from "@/lib/comparator-api";

const clamp2: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

function merchantLabel(count: number): string {
  return count <= 1 ? "1 marchand" : `${count} marchands`;
}

function RecoCard({ item, country }: { item: RecommendationItem; country: string }) {
  const multi = item.merchantCount > 1;
  const deal = item.rrpDropPct != null && item.rrpDropPct < -1;
  return (
    <Link
      href={`/comparateur/produit/${item.id}?country=${country}`}
      className="card-hover"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--surface)",
        borderRadius: "var(--r-xl)",
        boxShadow: "var(--sh-sm)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          position: "relative",
          height: "160px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--paper-2)",
        }}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            style={{ height: "100%", width: "100%", objectFit: "contain", padding: "16px" }}
          />
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ink-4)" }}>sans visuel</span>
        )}
        {deal && (
          <span
            style={{
              position: "absolute",
              left: "12px",
              top: "12px",
              padding: "4px 10px",
              borderRadius: "var(--r-pill)",
              background: "var(--success-bg)",
              color: "var(--success)",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {Math.round(item.rrpDropPct as number)}%
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "14px 16px 16px" }}>
        {item.brand && (
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--ink-4)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.brand}
          </p>
        )}
        <p
          style={{
            ...clamp2,
            margin: "6px 0 0",
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            fontWeight: 500,
            lineHeight: 1.35,
            color: "var(--ink)",
          }}
        >
          {item.title}
        </p>
        <div style={{ marginTop: "auto", paddingTop: "14px" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-3)" }}>à partir de</p>
          <p
            style={{
              margin: "2px 0 0",
              fontFamily: "var(--font-display)",
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            {formatPrice(item.lowestPrice, item.currency)}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--ink-3)" }}>
            {multi ? `chez ${merchantLabel(item.merchantCount)}` : "Vendu par 1 marchand"}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function RecommendedSection({ country = "FR", limit = 8 }: { country?: string; limit?: number }) {
  const [items, setItems] = useState<RecommendationItem[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getRecommendations({ country, limit });
        if (active) setItems(res.items || []);
      } catch {
        // 401 (non connecté) ou erreur réseau : on ne rend rien, silencieux.
        if (active) setItems([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [country, limit]);

  // Rien à afficher tant que pas chargé, ou si aucune reco (non connecté / pas d'intérêts).
  if (!items || items.length === 0) return null;

  return (
    <section style={{ margin: "8px 0 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 20px" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "34px",
            height: "34px",
            borderRadius: "var(--r-lg)",
            background: "var(--accent-bg)",
            color: "var(--accent-2)",
          }}
        >
          <Sparkles style={{ width: "18px", height: "18px" }} aria-hidden={true} />
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(20px, 2.6vw, 26px)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "var(--ink)",
          }}
        >
          Recommandé pour vous
        </h2>
      </div>
      <div
        className="rg4"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}
      >
        {items.map((it) => (
          <RecoCard key={it.id} item={it} country={country} />
        ))}
      </div>
    </section>
  );
}

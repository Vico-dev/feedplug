"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  getWatchlist,
  removeWatch,
  formatPrice,
  type WatchlistItem,
} from "@/lib/comparator-api";
import PushOptIn from "@/components/comparateur/push-opt-in";

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
const dropPill: CSSProperties = {
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

/** Mini évolution 2 points (prix au suivi -> prix courant). */
function MiniTrend({ from, to }: { from: number | null; to: number | null }) {
  if (from == null || to == null) {
    return <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink-4)" }}>—</span>;
  }
  const down = to < from;
  const flat = to === from;
  const color = flat ? "var(--ink-4)" : down ? "var(--success)" : "var(--warning)";
  const w = 72;
  const h = 28;
  const y1 = from >= to ? 6 : h - 6;
  const y2 = from >= to ? h - 6 : 6;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Évolution depuis le suivi" style={{ width: `${w}px`, height: `${h}px`, color, display: "block" }}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={`4,${y1} ${w - 4},${y2}`} />
      <circle cx={w - 4} cy={y2} r="3" fill="currentColor" />
    </svg>
  );
}

export default function MesProduitsPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    let active = true;
    getWatchlist()
      .then((r) => {
        if (active) setItems(r.items || []);
      })
      .catch((e) => {
        if (active && (e as { status?: number }).status === 401) setAuthError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function unwatch(item: WatchlistItem) {
    try {
      await removeWatch(item.groupId, item.country);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      /* best-effort : on laisse l'item si l'appel échoue. */
    }
  }

  if (authError) {
    return (
      <main style={{ maxWidth: "520px", margin: "0 auto", padding: "96px var(--page-padding-x)", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          Connexion requise
        </p>
        <p style={{ margin: "10px 0 22px", fontSize: "15px", color: "var(--ink-3)" }}>
          Connectez-vous pour retrouver les produits que vous suivez.
        </p>
        <Link href="/compte" className="cta-btn" style={{ display: "inline-flex", padding: "13px 22px", borderRadius: "var(--r-lg)", fontWeight: 600, textDecoration: "none" }}>
          Se connecter
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "880px", margin: "0 auto", padding: "56px var(--page-padding-x) 96px" }}>
      <div style={eyebrowStyle}>
        <span style={dotStyle} />
        Mon compte
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "12px", margin: "22px 0 0" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 4.6vw, 48px)",
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 1.0,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Mes{" "}
          <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)", letterSpacing: "-0.02em" }}>
            produits
          </em>
        </h1>
        <Link href="/compte/feed" style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
          Mon feed →
        </Link>
      </div>

      {/* Opt-in aux alertes push (baisse de prix) — en tête de la watchlist. */}
      <PushOptIn />

      {loading ? (
        <p style={{ margin: "40px 0 0", fontSize: "15px", color: "var(--ink-3)" }}>Chargement…</p>
      ) : items.length === 0 ? (
        <div
          style={{
            margin: "36px 0 0",
            textAlign: "center",
            padding: "64px 24px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-2xl)",
            boxShadow: "var(--sh-xs)",
          }}
        >
          <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--ink)" }}>
            Vous ne suivez aucun produit
          </p>
          <p style={{ margin: "6px 0 20px", fontSize: "14px", color: "var(--ink-3)" }}>
            Cliquez sur « Suivre le prix » sur un produit pour être alerté des baisses.
          </p>
          <Link href="/comparateur" className="cta-btn" style={{ display: "inline-flex", padding: "12px 20px", borderRadius: "var(--r-lg)", fontWeight: 600, textDecoration: "none" }}>
            Explorer le comparateur
          </Link>
        </div>
      ) : (
        <div style={{ margin: "36px 0 0", display: "flex", flexDirection: "column", gap: "10px" }}>
          {items.map((it) => {
            const dropped = it.dropPct != null && it.dropPct < 0;
            return (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "16px",
                  padding: "14px 18px",
                  background: "var(--surface)",
                  border: `1px solid ${dropped ? "var(--success)" : "var(--line)"}`,
                  borderRadius: "var(--r-xl)",
                  boxShadow: "var(--sh-xs)",
                }}
              >
                <Link
                  href={`/comparateur/produit/${it.groupId}?country=${it.country}`}
                  style={{
                    height: "56px",
                    width: "56px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--paper-2)",
                    borderRadius: "var(--r-lg)",
                    overflow: "hidden",
                  }}
                >
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt={it.title} style={{ height: "100%", width: "100%", objectFit: "contain", padding: "6px" }} />
                  ) : (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink-4)" }}>—</span>
                  )}
                </Link>

                <div style={{ flex: 1, minWidth: "180px" }}>
                  {it.brand && (
                    <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-4)" }}>
                      {it.brand}
                    </p>
                  )}
                  <Link
                    href={`/comparateur/produit/${it.groupId}?country=${it.country}`}
                    style={{ display: "block", margin: "3px 0 0", fontFamily: "var(--font-sans)", fontSize: "15px", fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}
                  >
                    {it.title}
                  </Link>
                  {dropped && (
                    <span style={{ ...dropPill, marginTop: "8px" }}>{it.dropPct}% depuis le suivi</span>
                  )}
                </div>

                <MiniTrend from={it.priceAtAdd} to={it.currentPrice} />

                <div style={{ textAlign: "right", minWidth: "96px" }}>
                  <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>
                    {formatPrice(it.currentPrice, it.currency)}
                  </p>
                  {it.priceAtAdd != null && (
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--ink-4)" }}>
                      au suivi {formatPrice(it.priceAtAdd, it.currency)}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => unwatch(it)}
                  aria-label="Ne plus suivre"
                  className="card-hover"
                  style={{
                    flexShrink: 0,
                    height: "34px",
                    padding: "0 12px",
                    borderRadius: "var(--r-lg)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: "var(--surface)",
                    color: "var(--ink-3)",
                    border: "1px solid var(--line)",
                  }}
                >
                  Retirer
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import {
  getProduct,
  getPriceHistory,
  buildVisitUrl,
  formatPrice,
  type PriceHistoryPoint,
} from "@/lib/comparator-api";
import CountrySelector from "@/components/comparateur/country-selector";
import WatchButton from "@/components/comparateur/watch-button";

export const revalidate = 600;

type Params = Promise<{ locale: string; id: string }>;
type Search = Promise<{ country?: string }>;

function normCountry(c?: string): string {
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : "FR";
}

/** "1 marchand" / "3 marchands" — jamais "1 marchands". */
function merchantLabel(count: number): string {
  return count <= 1 ? "1 marchand" : `${count} marchands`;
}

const successPill: CSSProperties = {
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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const { id } = await params;
  const country = normCountry((await searchParams).country);
  const data = await getProduct(id, country);
  if (!data) return { title: "Produit introuvable", robots: { index: false } };
  const { product, offers, indexable } = data;
  const low = offers[0];
  const title = `${product.title}${product.brand ? " · " + product.brand : ""} — comparez ${offers.length} marchands`;
  const description = low
    ? `${product.title} à partir de ${formatPrice(low.price, low.currency)} chez ${offers.length} marchands. Comparez les prix et l'historique.`
    : `Comparez les prix de ${product.title}.`;
  return { title, description, robots: { index: indexable, follow: true } };
}

function Sparkline({ points }: { points: PriceHistoryPoint[] }) {
  if (points.length < 2) return null;
  const w = 640;
  const h = 64;
  const pad = 4;
  const prices = points.map((p) => p.lowestPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - (p.lowestPrice - min) / span) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaPath = `M ${coords[0]} L ${coords.join(" L ")} L ${(w - pad).toFixed(1)},${h} L ${pad},${h} Z`;
  const [lx, ly] = coords[coords.length - 1].split(",");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Évolution du prix le plus bas"
      style={{ height: "64px", width: "100%", color: "var(--accent)", display: "block" }}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-fill)" stroke="none" />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(" ")}
      />
      <circle cx={lx} cy={ly} r="4" fill="currentColor" />
    </svg>
  );
}

export default async function ComparatorProductPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const country = normCountry((await searchParams).country);
  const [data, history] = await Promise.all([
    getProduct(id, country),
    getPriceHistory(id, country),
  ]);
  if (!data) notFound();

  const { product, offers, signals } = data;
  const lowest = offers[0] ?? null;
  const points = history?.points ?? [];
  const multi = offers.length > 1;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    brand: product.brand ?? undefined,
    image: product.imageUrl ?? undefined,
    gtin: product.gtin ?? undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: lowest?.currency ?? undefined,
      lowPrice: lowest?.price ?? undefined,
      highPrice: offers[offers.length - 1]?.price ?? undefined,
      offerCount: offers.length,
    },
  };

  return (
    <main style={{ maxWidth: "880px", margin: "0 auto", padding: "40px var(--page-padding-x) 80px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <Link
          href={`/comparateur?country=${country}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--ink-3)",
            textDecoration: "none",
          }}
        >
          <span aria-hidden="true">&larr;</span> Comparateur
        </Link>
        <CountrySelector country={country} />
      </div>

      {/* En-tête produit */}
      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          padding: "24px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--sh-sm)",
        }}
      >
        <div
          style={{
            height: "160px",
            width: "160px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--paper-2)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              style={{ height: "100%", width: "100%", objectFit: "contain", padding: "14px" }}
            />
          ) : (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ink-4)" }}>
              sans visuel
            </span>
          )}
        </div>

        <div style={{ minWidth: "260px", flex: 1 }}>
          {product.brand && (
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: "var(--r-pill)",
                background: "var(--paper-2)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--ink-3)",
              }}
            >
              {product.brand}
            </span>
          )}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(24px, 3vw, 32px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "var(--ink)",
              margin: "10px 0 0",
            }}
          >
            {product.title}
          </h1>
          {product.gtin && (
            <p style={{ margin: "8px 0 0", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ink-4)" }}>
              GTIN {product.gtin}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px", margin: "18px 0 0" }}>
            <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>à partir de</span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(30px, 4vw, 40px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--ink)",
              }}
            >
              {formatPrice(lowest?.price ?? null, lowest?.currency ?? null)}
            </span>
            <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>
              {multi ? `chez ${merchantLabel(offers.length)}` : "Vendu par 1 marchand"}
            </span>
          </div>

          {signals && (signals.isAtLowest || (signals.pctVs30d != null && signals.pctVs30d < 0)) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "12px 0 0" }}>
              {signals.isAtLowest && <span style={successPill}>Au plus bas sur 90 j</span>}
              {signals.pctVs30d != null && signals.pctVs30d < 0 && (
                <span style={successPill}>{signals.pctVs30d}% vs le mois dernier</span>
              )}
            </div>
          )}

          {lowest && (
            <a
              href={buildVisitUrl(lowest.offerId, country)}
              target="_blank"
              rel="nofollow sponsored noopener"
              className="cta-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                margin: "20px 0 0",
                padding: "13px 22px",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                fontWeight: 600,
                borderRadius: "var(--r-lg)",
                textDecoration: "none",
              }}
            >
              {multi ? "Voir la meilleure offre" : "Voir l'offre"}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 400, opacity: 0.7 }}>
                {lowest.merchant}
              </span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          )}
          <div style={{ margin: "14px 0 0" }}>
            <WatchButton groupId={product.id} country={country} />
          </div>
        </div>
      </section>

      {/* Historique */}
      {points.length >= 2 && (
        <section
          style={{
            margin: "16px 0 0",
            padding: "18px 24px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--sh-xs)",
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--ink-3)" }}>
            Évolution du prix le plus bas
            <span style={{ color: "var(--ink-4)" }}> · {points.length} jours</span>
          </p>
          <Sparkline points={points} />
        </section>
      )}

      {/* Offres */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "36px 0 14px" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)" }}>
          Offres marchands
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-3)" }}>
          {multi ? `${merchantLabel(offers.length)} · triées par prix` : merchantLabel(offers.length)}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {offers.map((o) => (
          <div
            key={o.offerId}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "16px",
              padding: "14px 18px",
              background: "var(--surface)",
              borderRadius: "var(--r-xl)",
              boxShadow: "var(--sh-xs)",
              border: o.bestValue ? "1.5px solid var(--accent)" : "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "180px" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "15px", fontWeight: 600, color: "var(--ink)" }}>
                {o.merchant}
              </span>
              {o.bestValue && (
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: "var(--r-pill)",
                    background: "var(--accent-bg)",
                    color: "var(--accent-2)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  Meilleur prix
                </span>
              )}
              <span style={{ fontSize: "12px", color: o.inStock ? "var(--ink-3)" : "var(--warning)" }}>
                {o.inStock ? "En stock" : "Rupture"}
              </span>
            </div>

            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}
            >
              {formatPrice(o.price, o.currency)}
            </div>

            <a
              href={buildVisitUrl(o.offerId, country)}
              target="_blank"
              rel="nofollow sponsored noopener"
              className={o.bestValue ? "cta-btn" : "card-hover"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "40px",
                padding: "0 18px",
                borderRadius: "var(--r-lg)",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                whiteSpace: "nowrap",
                ...(o.bestValue
                  ? {}
                  : { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" }),
              }}
            >
              Voir l&apos;offre
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}

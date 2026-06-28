import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { searchProducts, formatPrice, type SearchItem } from "@/lib/comparator-api";
import CountrySelector from "@/components/comparateur/country-selector";
import AssistPanel from "@/components/comparateur/assist-panel";

export const revalidate = 300;

type Search = Promise<{ q?: string; country?: string; sort?: string }>;

function normCountry(c?: string): string {
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : "FR";
}

/** "1 marchand" / "3 marchands" — jamais "1 marchands". */
function merchantLabel(count: number): string {
  return count <= 1 ? "1 marchand" : `${count} marchands`;
}

const POPULAR: { label: string; q: string }[] = [
  { label: "Acer", q: "acer" },
  { label: "Ordinateur portable", q: "ordinateur" },
  { label: "Nintendo Switch", q: "switch" },
  { label: "Jeux vidéo", q: "jeu" },
  { label: "Sacs", q: "sac" },
];

export const metadata: Metadata = {
  title: "Comparateur de prix — Feedplug",
  description:
    "Comparez les prix de milliers de produits chez plusieurs marchands, avec l'historique des prix. Indépendant et gratuit.",
};

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

const clamp2: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

function ProductCard({ item, country }: { item: SearchItem; country: string }) {
  const multi = item.merchantCount > 1;
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
          height: "176px",
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
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ink-4)" }}>
            sans visuel
          </span>
        )}
        {multi && (
          <span
            style={{
              position: "absolute",
              left: "12px",
              top: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "var(--r-pill)",
              background: "var(--success-bg)",
              color: "var(--success)",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {item.merchantCount} offres
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "16px" }}>
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

        <div style={{ marginTop: "auto", paddingTop: "16px" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-3)" }}>à partir de</p>
          <p
            style={{
              margin: "2px 0 0",
              fontFamily: "var(--font-display)",
              fontSize: "24px",
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

export default async function ComparatorSearchPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const country = normCountry(sp.country);
  const sort = sp.sort || "relevance";
  const data = q ? await searchProducts({ q, country, sort, limit: 24 }) : null;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <main
      style={{
        maxWidth: "1080px",
        margin: "0 auto",
        padding: "56px var(--page-padding-x) 80px",
      }}
    >
      {/* Hero */}
      <header style={{ marginBottom: "44px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={eyebrowStyle}>
            <span style={dotStyle} />
            Comparateur de prix
          </div>
          <CountrySelector country={country} />
        </div>

        <h1
          className="hero-h"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(40px, 5vw, 64px)",
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 0.98,
            color: "var(--ink)",
            margin: "22px 0 0",
            maxWidth: "720px",
            textWrap: "balance",
          }}
        >
          Comparez les prix,{" "}
          <em
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: 400,
              color: "var(--ink-2)",
              letterSpacing: "-0.02em",
            }}
          >
            achetez au bon moment.
          </em>
        </h1>

        <p
          className="hero-p"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "19px",
            lineHeight: 1.55,
            color: "var(--ink-2)",
            margin: "20px 0 0",
            maxWidth: "620px",
          }}
        >
          Des milliers de produits comparés chez plusieurs marchands, avec l&apos;historique des
          prix. Indépendant et gratuit.
        </p>

        {/* Recherche */}
        <form
          action="/comparateur"
          method="get"
          role="search"
          className="hero-f"
          style={{ maxWidth: "620px", margin: "28px 0 0" }}
        >
          <input type="hidden" name="country" value={country} />
          <div
            className="rform"
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
            <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "14px",
                  width: "18px",
                  height: "18px",
                  color: "var(--ink-4)",
                  pointerEvents: "none",
                }}
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                name="q"
                defaultValue={q}
                placeholder="Rechercher un produit, une marque…"
                aria-label="Rechercher un produit"
                className="input-field"
                style={{
                  flex: 1,
                  padding: "14px 16px 14px 42px",
                  border: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "16px",
                  outline: "none",
                  background: "transparent",
                  color: "var(--ink)",
                  borderRadius: "var(--r-md)",
                }}
              />
            </div>
            <button
              type="submit"
              className="cta-btn"
              style={{
                padding: "14px 22px",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                fontWeight: 600,
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Rechercher
            </button>
          </div>
        </form>

        {/* Recherches populaires */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
            margin: "16px 0 0",
          }}
        >
          <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>Populaires&nbsp;:</span>
          {POPULAR.map((p) => (
            <Link
              key={p.q}
              href={`/comparateur?q=${encodeURIComponent(p.q)}&country=${country}`}
              style={{
                padding: "5px 12px",
                borderRadius: "var(--r-pill)",
                border: "1px solid var(--line)",
                background: "var(--surface)",
                fontSize: "13px",
                color: "var(--ink-2)",
                textDecoration: "none",
              }}
            >
              {p.label}
            </Link>
          ))}
        </div>

        <AssistPanel country={country} />
      </header>

      {/* Compteur résultats */}
      {q && (
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "var(--ink-3)" }}>
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{total}</span> résultat
          {total > 1 ? "s" : ""} pour «&nbsp;{q}&nbsp;»
        </p>
      )}

      {items.length > 0 && (
        <div
          className="rg4"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "16px",
          }}
        >
          {items.map((it) => (
            <ProductCard key={it.id} item={it} country={country} />
          ))}
        </div>
      )}

      {/* Recherche sans résultat */}
      {q && items.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-2xl)",
            boxShadow: "var(--sh-xs)",
          }}
        >
          <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)" }}>
            Aucun produit trouvé
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--ink-3)" }}>
            Essayez un autre terme ou une marque pour «&nbsp;{q}&nbsp;».
          </p>
        </div>
      )}

      {/* État initial : valeur + catégories */}
      {!q && (
        <>
          <div
            className="rg3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "1px",
              background: "var(--line)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-2xl)",
              overflow: "hidden",
            }}
          >
            {[
              { t: "Plusieurs marchands", s: "Le même produit comparé d'un marchand à l'autre." },
              { t: "Historique des prix", s: "Voyez si c'est le bon moment pour acheter." },
              { t: "Indépendant", s: "Gratuit, sans tri sponsorisé. Vous d'abord." },
            ].map((f) => (
              <div key={f.t} style={{ background: "var(--surface)", padding: "24px" }}>
                <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 600, color: "var(--ink)" }}>
                  {f.t}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "14px", lineHeight: 1.5, color: "var(--ink-3)" }}>
                  {f.s}
                </p>
              </div>
            ))}
          </div>

          <p style={{ margin: "36px 0 14px", fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)" }}>
            Commencez par une catégorie
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {POPULAR.map((p) => (
              <Link
                key={p.q}
                href={`/comparateur?q=${encodeURIComponent(p.q)}&country=${country}`}
                className="card-hover"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 18px",
                  background: "var(--surface)",
                  borderRadius: "var(--r-lg)",
                  boxShadow: "var(--sh-xs)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  textDecoration: "none",
                }}
              >
                {p.label}
                <span aria-hidden="true" style={{ color: "var(--ink-4)" }}>
                  &rarr;
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

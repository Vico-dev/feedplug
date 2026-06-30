import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Laptop, Gamepad2, ShoppingBag, Sparkles, Search, ArrowRight } from "lucide-react";
import { searchProducts, formatPrice, type SearchItem } from "@/lib/comparator-api";
import CountrySelector from "@/components/comparateur/country-selector";
import AssistPanel from "@/components/comparateur/assist-panel";
import WatchButton from "@/components/comparateur/watch-button";
import RecommendedSection from "@/components/comparateur/recommended-section";
import { seo } from "@/lib/seo";

export const revalidate = 300;

type Search = Promise<{ q?: string; country?: string; sort?: string }>;

function normCountry(c?: string): string {
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : "FR";
}

/** "1 marchand" / "3 marchands" — jamais "1 marchands". */
function merchantLabel(count: number): string {
  return count <= 1 ? "1 marchand" : `${count} marchands`;
}

type Cat = { label: string; q: string; Icon: typeof Laptop };
const CATEGORIES: Cat[] = [
  { label: "Informatique", q: "acer", Icon: Laptop },
  { label: "Jeux vidéo", q: "jeu", Icon: Gamepad2 },
  { label: "Maroquinerie", q: "sac", Icon: ShoppingBag },
  { label: "Parfums", q: "parfum", Icon: Sparkles },
];

export const metadata: Metadata = {
  title: "Comparateur de prix — Feedplug",
  description:
    "Comparez les prix de milliers de produits chez plusieurs marchands, avec l'historique des prix. Indépendant et gratuit.",
  // La home conso EST le comparateur (apex / rewrite → /comparateur). Le
  // canonical pointe donc explicitement vers la racine de l'apex, jamais vers
  // /comparateur (qui 301 vers /). hreflang fr|en|es cohérents sur l'apex.
  alternates: {
    canonical: `${seo.siteUrl}/`,
    languages: {
      fr: `${seo.siteUrl}/`,
      en: `${seo.siteUrl}/en`,
      es: `${seo.siteUrl}/es`,
      "x-default": `${seo.siteUrl}/`,
    },
  },
  robots: { index: true, follow: true },
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
const sectionTitle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(22px, 2.6vw, 28px)",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: "var(--ink)",
  margin: 0,
};

function ProductCard({ item, country }: { item: SearchItem; country: string }) {
  const multi = item.merchantCount > 1;
  return (
    <div style={{ position: "relative", display: "flex" }}>
    <Link
      href={`/comparateur/produit/${item.id}?country=${country}`}
      className="card-hover"
      style={{
        flex: 1,
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
      <div style={{ position: "absolute", top: "10px", right: "10px", zIndex: 2 }}>
        <WatchButton groupId={item.id} country={country} variant="compact" />
      </div>
    </div>
  );
}

function CategoryTile({ cat, country }: { cat: Cat; country: string }) {
  const { Icon } = cat;
  return (
    <Link
      href={`/comparateur?q=${encodeURIComponent(cat.q)}&country=${country}`}
      className="card-hover"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "18px 20px",
        background: "var(--surface)",
        borderRadius: "var(--r-xl)",
        boxShadow: "var(--sh-xs)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "44px",
          height: "44px",
          borderRadius: "var(--r-lg)",
          background: "var(--accent-bg)",
          color: "var(--accent-2)",
          flexShrink: 0,
        }}
      >
        <Icon style={{ width: "21px", height: "21px" }} aria-hidden="true" />
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "16px", fontWeight: 600, color: "var(--ink)" }}>
        {cat.label}
      </span>
      <ArrowRight style={{ width: "16px", height: "16px", color: "var(--ink-4)", marginLeft: "auto" }} aria-hidden="true" />
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

  // Page d'accueil : rangées de produits réelles par catégorie (n'affiche que celles qui ont des résultats).
  const featured = q
    ? []
    : (
        await Promise.all(
          CATEGORIES.map((c) =>
            searchProducts({ q: c.q, country, limit: 4 }).then((r) => ({
              cat: c,
              items: r?.items ?? [],
              total: r?.total ?? 0,
            })),
          ),
        )
      )
        .filter((r) => r.items.length > 0)
        .slice(0, 4);

  return (
    <main style={{ maxWidth: "1120px", margin: "0 auto", padding: "0 var(--page-padding-x) 96px" }}>
      {/* Hero */}
      <header style={{ paddingTop: "56px", marginBottom: "40px" }}>
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
            fontSize: "clamp(40px, 5.4vw, 68px)",
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 0.98,
            color: "var(--ink)",
            margin: "22px 0 0",
            maxWidth: "760px",
            textWrap: "balance",
          }}
        >
          Le bon prix,{" "}
          <em
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: 400,
              color: "var(--ink-2)",
              letterSpacing: "-0.02em",
            }}
          >
            au bon moment.
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
          Comparez des milliers de produits chez plusieurs marchands et suivez l&apos;historique des
          prix. Indépendant et gratuit.
        </p>

        <form
          action="/comparateur"
          method="get"
          role="search"
          className="hero-f"
          style={{ maxWidth: "640px", margin: "28px 0 0" }}
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
              <Search
                aria-hidden="true"
                style={{ position: "absolute", left: "14px", width: "18px", height: "18px", color: "var(--ink-4)", pointerEvents: "none" }}
              />
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
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
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
              <ArrowRight style={{ width: "15px", height: "15px" }} aria-hidden="true" />
            </button>
          </div>
        </form>

        {q && <AssistPanel country={country} />}
      </header>

      {/* ───────── Mode recherche ───────── */}
      {q && (
        <>
          <p style={{ margin: "0 0 20px", fontSize: "14px", color: "var(--ink-3)" }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>{total}</span> résultat
            {total > 1 ? "s" : ""} pour «&nbsp;{q}&nbsp;»
          </p>

          {items.length > 0 ? (
            <div className="rg4" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
              {items.map((it) => (
                <ProductCard key={it.id} item={it} country={country} />
              ))}
            </div>
          ) : (
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
        </>
      )}

      {/* ───────── Page d'accueil ───────── */}
      {!q && (
        <>
          {/* Recommandé pour vous — section CLIENT, ne s'affiche que si connecté + intérêts.
              Préserve le SSR public (le composant ne rend rien sinon). */}
          <div style={{ marginBottom: "56px" }}>
            <RecommendedSection country={country} limit={8} />
          </div>

          {/* Catégories */}
          <section style={{ marginBottom: "56px" }}>
            <div className="rg4" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
              {CATEGORIES.map((c) => (
                <CategoryTile key={c.q} cat={c} country={country} />
              ))}
            </div>
          </section>

          {/* Rangées de produits réelles */}
          {featured.map(({ cat, items: rowItems, total: rowTotal }) => (
            <section key={cat.q} style={{ marginBottom: "56px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "20px", gap: "16px" }}>
                <h2 style={sectionTitle}>{cat.label}</h2>
                <Link
                  href={`/comparateur?q=${encodeURIComponent(cat.q)}&country=${country}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 600, color: "var(--accent)", textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  Tout voir ({rowTotal}) <ArrowRight style={{ width: "15px", height: "15px" }} aria-hidden="true" />
                </Link>
              </div>
              <div className="rg4" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
                {rowItems.map((it) => (
                  <ProductCard key={it.id} item={it} country={country} />
                ))}
              </div>
            </section>
          ))}

          {/* Comment ça marche */}
          <section style={{ marginBottom: "56px" }}>
            <h2 style={{ ...sectionTitle, marginBottom: "24px" }}>Comment ça marche</h2>
            <div className="rg3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" }}>
              {[
                { n: "01", t: "Recherchez", s: "Tapez un produit ou une marque. On rassemble les offres de plusieurs marchands." },
                { n: "02", t: "Comparez", s: "Prix, marchands et historique sur 90 jours, côte à côte, sans tri sponsorisé." },
                { n: "03", t: "Achetez malin", s: "Partez chez le marchand au meilleur prix, au moment où le prix est bas." },
              ].map((step) => (
                <div key={step.n} style={{ padding: "24px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-xs)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 500, color: "var(--accent)", letterSpacing: "0.1em" }}>
                    {step.n}
                  </span>
                  <p style={{ margin: "12px 0 0", fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>
                    {step.t}
                  </p>
                  <p style={{ margin: "8px 0 0", fontSize: "14px", lineHeight: 1.55, color: "var(--ink-3)" }}>{step.s}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Confiance */}
          <section
            style={{
              padding: "36px",
              background: "var(--ink)",
              borderRadius: "var(--r-2xl)",
              color: "var(--paper)",
            }}
          >
            <div className="rg3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "28px" }}>
              {[
                { t: "Plusieurs marchands", s: "Le même produit comparé d'un marchand à l'autre, en un coup d'œil." },
                { t: "Historique des prix", s: "Voyez si le prix est au plus bas avant d'acheter." },
                { t: "100% indépendant", s: "Gratuit, sans classement payé. Votre intérêt d'abord." },
              ].map((f) => (
                <div key={f.t}>
                  <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--paper)" }}>
                    {f.t}
                  </p>
                  <p style={{ margin: "8px 0 0", fontSize: "14px", lineHeight: 1.55, color: "var(--ink-4)" }}>{f.s}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

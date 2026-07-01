import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getPublicDeals, formatPrice, type DealItem } from "@/lib/comparator-api";
import { seo } from "@/lib/seo";

export const revalidate = 300;

type Search = Promise<{ country?: string }>;

function normCountry(c?: string): string {
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : "FR";
}

export const metadata: Metadata = {
  title: "Bons plans — les plus fortes baisses de prix | Feedplug",
  description:
    "Les plus fortes baisses de prix du moment, tous marchands confondus. Mises à jour en continu, sans inscription. Indépendant et gratuit.",
  alternates: {
    canonical: `${seo.siteUrl}/deals`,
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
const dropPill: CSSProperties = {
  position: "absolute",
  left: "12px",
  top: "12px",
  padding: "4px 10px",
  borderRadius: "var(--r-pill)",
  background: "var(--success-bg)",
  color: "var(--success)",
  fontSize: "12px",
  fontWeight: 600,
};

/** Meilleure (plus négative) des deux baisses disponibles, sinon null. */
function bestDrop(it: DealItem): number | null {
  const vals = [it.pctVs30d, it.rrpDropPct].filter(
    (v): v is number => typeof v === "number" && v < 0,
  );
  if (vals.length === 0) return null;
  return Math.min(...vals);
}

function DealCard({ item, country }: { item: DealItem; country: string }) {
  const multi = item.merchantCount > 1;
  const drop = bestDrop(item);
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
        {drop != null && <span style={dropPill}>{drop}%</span>}
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
            {multi ? `chez ${item.merchantCount} marchands` : "Vendu par 1 marchand"}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default async function DealsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const country = normCountry(sp.country);

  const data = await getPublicDeals({ country, limit: 48 });
  const items = data?.items ?? [];

  return (
    <main
      style={{ maxWidth: "1120px", margin: "0 auto", padding: "56px var(--page-padding-x) 96px" }}
    >
      <div style={eyebrowStyle}>
        <span style={dotStyle} />
        Bons plans
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
          margin: "22px 0 0",
        }}
      >
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
          Les plus fortes{" "}
          <em
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: 400,
              color: "var(--ink-2)",
              letterSpacing: "-0.02em",
            }}
          >
            baisses
          </em>
        </h1>
        <Link
          href="/comparateur"
          style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}
        >
          Rechercher un produit
        </Link>
      </div>

      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "16px",
          lineHeight: 1.55,
          color: "var(--ink-2)",
          margin: "16px 0 0",
          maxWidth: "560px",
        }}
      >
        Les meilleures baisses de prix du moment, tous marchands confondus. Sans inscription.
      </p>

      {items.length === 0 ? (
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
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            Aucun bon plan pour l&apos;instant
          </p>
          <p style={{ margin: "6px 0 20px", fontSize: "14px", color: "var(--ink-3)" }}>
            Revenez bientôt : les baisses de prix sont mises à jour en continu.
          </p>
          <Link
            href="/comparateur"
            className="cta-btn"
            style={{ display: "inline-flex", padding: "12px 20px", borderRadius: "var(--r-lg)", fontWeight: 600, textDecoration: "none" }}
          >
            Rechercher un produit
          </Link>
        </div>
      ) : (
        <div
          className="rg4"
          style={{ margin: "36px 0 0", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}
        >
          {items.map((it) => (
            <DealCard key={it.id} item={it} country={country} />
          ))}
        </div>
      )}
    </main>
  );
}

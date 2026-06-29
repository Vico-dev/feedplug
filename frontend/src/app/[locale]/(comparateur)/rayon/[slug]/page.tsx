import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getCategory, formatPrice, type SearchItem } from "@/lib/comparator-api";
import WatchButton from "@/components/comparateur/watch-button";

export const revalidate = 300;

type Params = Promise<{ locale: string; slug: string }>;
type Search = Promise<{ country?: string }>;

function normCountry(c?: string): string {
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : "FR";
}
function merchantLabel(count: number): string {
  return count <= 1 ? "1 marchand" : `${count} marchands`;
}

const clamp2: CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { slug } = await params;
  const country = normCountry((await searchParams).country);
  const data = await getCategory(slug, country);
  if (!data) return { title: "Rayon introuvable", robots: { index: false } };
  const label = data.category.labelfr;
  return {
    title: `${label} — comparateur de prix | Feedplug`,
    description: `Comparez les prix de ${data.total} produits du rayon ${label} chez plusieurs marchands, avec l'historique des prix.`,
    robots: { index: data.total > 0, follow: true },
  };
}

function ProductCard({ item, country }: { item: SearchItem; country: string }) {
  const multi = item.merchantCount > 1;
  return (
    <div style={{ position: "relative", display: "flex" }}>
      <Link href={`/comparateur/produit/${item.id}?country=${country}`} className="card-hover" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-sm)", textDecoration: "none", color: "inherit" }}>
        <div style={{ position: "relative", height: "176px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper-2)" }}>
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.title} loading="lazy" style={{ height: "100%", width: "100%", objectFit: "contain", padding: "16px" }} />
          ) : (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ink-4)" }}>sans visuel</span>
          )}
          {multi && (
            <span style={{ position: "absolute", left: "12px", top: "12px", padding: "4px 10px", borderRadius: "var(--r-pill)", background: "var(--success-bg)", color: "var(--success)", fontSize: "12px", fontWeight: 600 }}>{item.merchantCount} offres</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "16px" }}>
          {item.brand && <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.brand}</p>}
          <p style={{ ...clamp2, margin: "6px 0 0", fontFamily: "var(--font-sans)", fontSize: "15px", fontWeight: 500, lineHeight: 1.35, color: "var(--ink)" }}>{item.title}</p>
          <div style={{ marginTop: "auto", paddingTop: "16px" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-3)" }}>à partir de</p>
            <p style={{ margin: "2px 0 0", fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>{formatPrice(item.lowestPrice, item.currency)}</p>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--ink-3)" }}>{multi ? `chez ${merchantLabel(item.merchantCount)}` : "Vendu par 1 marchand"}</p>
          </div>
        </div>
      </Link>
      <div style={{ position: "absolute", top: "10px", right: "10px", zIndex: 2 }}>
        <WatchButton groupId={item.id} country={country} variant="compact" />
      </div>
    </div>
  );
}

export default async function RayonPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const country = normCountry((await searchParams).country);
  const data = await getCategory(slug, country, { limit: 48 });
  if (!data) notFound();

  const { category, items, total } = data;

  return (
    <main style={{ maxWidth: "1120px", margin: "0 auto", padding: "48px var(--page-padding-x) 80px" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 500, color: "var(--ink-3)", textDecoration: "none" }}>
        <span aria-hidden="true">&larr;</span> Tous les rayons
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 4.5vw, 52px)", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.0, color: "var(--ink)", margin: "14px 0 0" }}>
        {category.labelfr}
      </h1>
      <p style={{ margin: "12px 0 0", fontSize: "15px", color: "var(--ink-3)" }}>
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{total}</span> produit{total > 1 ? "s" : ""} comparé{total > 1 ? "s" : ""}
      </p>

      {items.length > 0 ? (
        <div className="rg4" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px", marginTop: "28px" }}>
          {items.map((it) => <ProductCard key={it.id} item={it} country={country} />)}
        </div>
      ) : (
        <div style={{ marginTop: "28px", textAlign: "center", padding: "64px 24px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", boxShadow: "var(--sh-xs)" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)" }}>Bientôt des produits ici</p>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--ink-3)" }}>
            Ce rayon s&apos;enrichit au fil des marchands.{" "}
            <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>Voir d&apos;autres rayons</Link>
          </p>
        </div>
      )}
    </main>
  );
}

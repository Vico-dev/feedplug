import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProduct,
  getPriceHistory,
  buildVisitUrl,
  formatPrice,
  type PriceHistoryPoint,
} from "@/lib/comparator-api";

export const revalidate = 600;

type Params = Promise<{ locale: string; id: string }>;
type Search = Promise<{ country?: string }>;

function normCountry(c?: string): string {
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : "FR";
}

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
  const [lx, ly] = coords[coords.length - 1].split(",");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full text-blue-600" preserveAspectRatio="none" role="img" aria-label="Évolution du prix le plus bas">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={coords.join(" ")} />
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
  const [data, history] = await Promise.all([getProduct(id, country), getPriceHistory(id, country)]);
  if (!data) notFound();

  const { product, offers, signals } = data;
  const lowest = offers[0] ?? null;
  const points = history?.points ?? [];

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
    <main className="mx-auto max-w-3xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="flex items-start gap-5 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.title} className="h-full w-full object-contain" />
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {product.brand && (
            <span className="inline-block rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600">{product.brand}</span>
          )}
          <h1 className="mt-2 text-xl font-medium text-gray-900">{product.title}</h1>
          {product.gtin && <p className="mt-1 font-mono text-xs text-gray-400">GTIN {product.gtin}</p>}

          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-sm text-gray-500">à partir de</span>
            <span className="text-2xl font-medium text-gray-900">{formatPrice(lowest?.price ?? null, lowest?.currency ?? null)}</span>
            <span className="text-sm text-gray-500">chez {offers.length} marchands</span>
          </div>

          {signals && (
            <div className="mt-2 flex flex-wrap gap-2">
              {signals.isAtLowest && (
                <span className="rounded bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">Au plus bas depuis 90 jours</span>
              )}
              {signals.pctVs30d != null && signals.pctVs30d < 0 && (
                <span className="rounded bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  {signals.pctVs30d}% vs le mois dernier
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {points.length >= 2 && (
        <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3">
          <p className="mb-1 text-sm text-gray-500">Évolution du prix le plus bas · {points.length} jours</p>
          <Sparkline points={points} />
        </div>
      )}

      <p className="mb-2 mt-6 text-sm text-gray-500">
        {offers.length} marchands proposent ce produit · trié par meilleur prix
      </p>

      <div className="flex flex-col gap-2">
        {offers.map((o) => (
          <div
            key={o.offerId}
            className={`flex items-center gap-4 rounded-xl bg-white p-3 px-4 ${o.bestValue ? "border-2 border-blue-500" : "border border-gray-200"}`}
          >
            <div className="w-24 shrink-0 text-sm font-medium text-gray-900">{o.merchant}</div>
            <div className="min-w-0 flex-1 text-xs text-gray-500">
              {o.bestValue && <span className="mr-2 rounded bg-blue-50 px-2 py-0.5 text-blue-700">Meilleur prix</span>}
              <span className={o.inStock ? "text-gray-500" : "text-amber-600"}>{o.inStock ? "En stock" : "Rupture"}</span>
            </div>
            <div className="w-20 text-right text-base font-medium text-gray-900">{formatPrice(o.price, o.currency)}</div>
            <a
              href={buildVisitUrl(o.offerId, country)}
              target="_blank"
              rel="nofollow sponsored noopener"
              className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Voir l&apos;offre
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}

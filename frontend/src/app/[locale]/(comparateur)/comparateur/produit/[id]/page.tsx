import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProduct,
  getPriceHistory,
  buildVisitUrl,
  formatPrice,
  type PriceHistoryPoint,
} from "@/lib/comparator-api";
import CountrySelector from "@/components/comparateur/country-selector";

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
      className="h-16 w-full text-steel"
      preserveAspectRatio="none"
      role="img"
      aria-label="Évolution du prix le plus bas"
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
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/comparateur?country=${country}`}
          className="inline-flex items-center gap-1.5 text-fs-14 font-medium text-ink-3 transition-colors duration-base ease-ds hover:text-ink"
        >
          <span aria-hidden="true">&larr;</span> Comparateur
        </Link>
        <CountrySelector country={country} />
      </div>

      {/* En-tête produit */}
      <section className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-5 shadow-sm sm:flex-row sm:items-start sm:p-6">
        <div className="flex h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper-2 sm:h-36 sm:w-36">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              className="h-full w-full object-contain p-3"
            />
          ) : (
            <span className="font-mono text-fs-12 text-ink-4">sans visuel</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {product.brand && (
            <span className="inline-block rounded-pill bg-paper-2 px-2.5 py-1 font-mono text-fs-12 uppercase tracking-wider text-ink-3">
              {product.brand}
            </span>
          )}
          <h1 className="mt-2 font-display text-fs-24 font-bold leading-tight tracking-tight text-ink sm:text-fs-30">
            {product.title}
          </h1>
          {product.gtin && (
            <p className="mt-1.5 font-mono text-fs-12 text-ink-4">GTIN {product.gtin}</p>
          )}

          <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-fs-13 text-ink-3">à partir de</span>
            <span className="font-display text-fs-36 font-bold tracking-tight text-ink">
              {formatPrice(lowest?.price ?? null, lowest?.currency ?? null)}
            </span>
            <span className="text-fs-13 text-ink-3">
              {multi ? `chez ${merchantLabel(offers.length)}` : "Vendu par 1 marchand"}
            </span>
          </div>

          {signals && (
            <div className="mt-3 flex flex-wrap gap-2">
              {signals.isAtLowest && (
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-2.5 py-1 text-fs-12 font-semibold text-success">
                  <span className="h-1.5 w-1.5 rounded-pill bg-success" />
                  Au plus bas sur 90 j
                </span>
              )}
              {signals.pctVs30d != null && signals.pctVs30d < 0 && (
                <span className="rounded-pill bg-success-soft px-2.5 py-1 text-fs-12 font-semibold text-success">
                  {signals.pctVs30d}% vs le mois dernier
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Sparkline historique */}
      {points.length >= 2 && (
        <section className="mt-4 rounded-xl border border-line bg-surface px-5 py-4 shadow-xs">
          <p className="mb-2 text-fs-13 text-ink-3">
            Évolution du prix le plus bas
            <span className="text-ink-4"> · {points.length} jours</span>
          </p>
          <Sparkline points={points} />
        </section>
      )}

      {/* Offres marchands */}
      <div className="mb-3 mt-8 flex items-baseline justify-between">
        <h2 className="font-display text-fs-18 font-semibold text-ink">Offres marchands</h2>
        <p className="text-fs-13 text-ink-3">
          {multi ? `${merchantLabel(offers.length)} · triées par prix` : merchantLabel(offers.length)}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {offers.map((o) => (
          <div
            key={o.offerId}
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-surface p-3 px-4 shadow-xs transition duration-base ease-ds sm:flex-nowrap ${
              o.bestValue
                ? "border-2 border-steel"
                : "border border-line hover:border-line-strong"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="truncate text-fs-15 font-semibold text-ink">{o.merchant}</span>
              {o.bestValue && (
                <span className="shrink-0 rounded-pill bg-steel-soft px-2 py-0.5 text-fs-12 font-semibold text-steel-hover">
                  Meilleur prix
                </span>
              )}
              <span
                className={`shrink-0 text-fs-12 ${o.inStock ? "text-ink-3" : "text-warning"}`}
              >
                {o.inStock ? "En stock" : "Rupture"}
              </span>
            </div>

            <div className="text-right font-display text-fs-18 font-bold tracking-tight text-ink">
              {formatPrice(o.price, o.currency)}
            </div>

            <a
              href={buildVisitUrl(o.offerId, country)}
              target="_blank"
              rel="nofollow sponsored noopener"
              className={`inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-fs-14 font-semibold transition duration-base ease-ds focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                o.bestValue
                  ? "bg-ink text-paper hover:bg-ink-2 focus-visible:ring-ink"
                  : "border border-line bg-surface text-ink hover:bg-paper-2 focus-visible:ring-ink"
              }`}
            >
              Voir l&apos;offre
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}

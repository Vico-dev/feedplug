import Link from "next/link";
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Comparateur de prix — Feedplug",
  description:
    "Comparez les prix de milliers de produits chez plusieurs marchands, avec l'historique des prix.",
};

function ProductCard({ item, country }: { item: SearchItem; country: string }) {
  const multi = item.merchantCount > 1;
  return (
    <Link
      href={`/comparateur/produit/${item.id}?country=${country}`}
      className="group flex flex-col rounded-xl border border-line bg-surface p-3 shadow-xs transition duration-base ease-ds hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel focus-visible:ring-offset-2"
    >
      <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg bg-paper-2">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-contain p-2 transition-transform duration-slow ease-ds group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <span className="font-mono text-fs-12 text-ink-4">sans visuel</span>
        )}
        {multi && (
          <span className="absolute left-2 top-2 rounded-pill bg-steel-soft px-2 py-0.5 text-fs-12 font-semibold text-steel-hover">
            {item.merchantCount} offres
          </span>
        )}
      </div>

      {item.brand && (
        <p className="mt-3 truncate font-mono text-fs-12 uppercase tracking-wider text-ink-4">
          {item.brand}
        </p>
      )}
      <p className="mt-1 line-clamp-2 text-fs-14 font-medium leading-snug text-ink">
        {item.title}
      </p>

      <div className="mt-auto pt-3">
        <p className="text-fs-12 text-ink-3">à partir de</p>
        <p className="font-display text-fs-20 font-bold tracking-tight text-ink">
          {formatPrice(item.lowestPrice, item.currency)}
        </p>
        <p className="mt-0.5 text-fs-12 text-ink-3">
          {multi ? `chez ${merchantLabel(item.merchantCount)}` : "Vendu par 1 marchand"}
        </p>
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
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      {/* Hero */}
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1.5 font-mono text-fs-12 font-medium uppercase tracking-[0.14em] text-ink-3">
              <span className="h-1.5 w-1.5 rounded-pill bg-steel shadow-[0_0_0_4px_var(--accent-bg)]" />
              Comparateur de prix
            </span>
            <h1 className="mt-4 font-display text-fs-36 font-bold leading-[1.02] tracking-tight text-ink sm:text-fs-44">
              Le meilleur prix, chez plusieurs marchands.
            </h1>
            <p className="mt-3 max-w-xl text-fs-16 leading-relaxed text-ink-2">
              Comparez des milliers de produits et suivez l&apos;historique des prix avant
              d&apos;acheter.
            </p>
          </div>
          <CountrySelector country={country} />
        </div>

        {/* Barre de recherche */}
        <form
          action="/comparateur"
          method="get"
          className="mt-6 flex flex-col gap-2 sm:flex-row"
          role="search"
        >
          <input type="hidden" name="country" value={country} />
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              name="q"
              defaultValue={q}
              placeholder="Rechercher un produit…"
              aria-label="Rechercher un produit"
              className="h-12 w-full rounded-lg border border-line bg-surface pl-11 pr-4 text-fs-15 text-ink shadow-xs outline-none transition duration-base ease-ds placeholder:text-ink-4 focus:border-steel focus:ring-2 focus:ring-steel/30"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-ink px-6 text-fs-15 font-semibold text-paper transition duration-base ease-ds hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            Rechercher
          </button>
        </form>

        <AssistPanel country={country} />
      </header>

      {/* Résultats */}
      {q && (
        <p className="mb-4 text-fs-14 text-ink-3">
          <span className="font-semibold text-ink">{total}</span> résultat
          {total > 1 ? "s" : ""} pour «&nbsp;{q}&nbsp;»
        </p>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <ProductCard key={it.id} item={it} country={country} />
          ))}
        </div>
      )}

      {/* État vide : recherche sans résultat */}
      {q && items.length === 0 && (
        <div className="rounded-xl border border-line bg-surface px-6 py-16 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-pill bg-paper-2 text-ink-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <p className="font-display text-fs-18 font-semibold text-ink">Aucun produit trouvé</p>
          <p className="mt-1 text-fs-14 text-ink-3">
            Essayez un autre terme ou une marque pour «&nbsp;{q}&nbsp;».
          </p>
        </div>
      )}

      {/* État initial : pas de recherche */}
      {!q && (
        <div className="rounded-xl border border-dashed border-line bg-paper px-6 py-16 text-center">
          <p className="font-display text-fs-18 font-semibold text-ink">
            Commencez votre comparaison
          </p>
          <p className="mt-1 text-fs-14 text-ink-3">
            Recherchez un produit ci-dessus pour voir les offres des marchands.
          </p>
        </div>
      )}
    </main>
  );
}

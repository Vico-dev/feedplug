import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
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

function TrustItem({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-steel-soft text-steel">
        {icon}
      </span>
      <div>
        <p className="text-fs-14 font-semibold text-ink">{title}</p>
        <p className="text-fs-13 text-ink-3">{sub}</p>
      </div>
    </div>
  );
}

function ProductCard({ item, country }: { item: SearchItem; country: string }) {
  const multi = item.merchantCount > 1;
  return (
    <Link
      href={`/comparateur/produit/${item.id}?country=${country}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition duration-base ease-ds hover:-translate-y-1 hover:border-steel/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel focus-visible:ring-offset-2"
    >
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-paper-2">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-contain p-4 transition-transform duration-slow ease-ds group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <span className="font-mono text-fs-12 uppercase tracking-wider text-ink-4">
            sans visuel
          </span>
        )}
        {multi && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-success-soft px-2.5 py-1 text-fs-12 font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-pill bg-success" />
            {item.merchantCount} offres
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {item.brand && (
          <p className="truncate font-mono text-fs-12 uppercase tracking-wider text-ink-4">
            {item.brand}
          </p>
        )}
        <p className="mt-1.5 line-clamp-2 text-fs-15 font-medium leading-snug text-ink">
          {item.title}
        </p>

        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <p className="text-fs-12 text-ink-3">à partir de</p>
            <p className="font-display text-fs-24 font-bold leading-none tracking-tight text-ink">
              {formatPrice(item.lowestPrice, item.currency)}
            </p>
            <p className="mt-1 text-fs-12 text-ink-3">
              {multi ? `chez ${merchantLabel(item.merchantCount)}` : "Vendu par 1 marchand"}
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-paper-2 text-ink-3 transition duration-base ease-ds group-hover:bg-steel group-hover:text-surface">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
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
    <main className="w-full">
      {/* Hero — bandeau teinté */}
      <section className="relative overflow-hidden bg-gradient-to-b from-steel-soft to-transparent">
        <div className="mx-auto w-full max-w-5xl px-5 pb-10 pt-12 sm:px-8 sm:pt-16">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-pill border border-steel/20 bg-surface px-3 py-1.5 font-mono text-fs-12 font-medium uppercase tracking-[0.14em] text-steel-hover">
              <span className="h-1.5 w-1.5 rounded-pill bg-steel" />
              Comparateur de prix
            </span>
            <CountrySelector country={country} />
          </div>

          <h1 className="mt-5 max-w-2xl font-display text-fs-36 font-bold leading-[1.03] tracking-tight text-ink sm:text-fs-44">
            Comparez les prix,<br className="hidden sm:block" /> achetez au bon moment.
          </h1>
          <p className="mt-4 max-w-xl text-fs-16 leading-relaxed text-ink-2">
            Des milliers de produits comparés chez plusieurs marchands, avec l&apos;historique des
            prix. Indépendant et gratuit.
          </p>

          {/* Barre de recherche */}
          <form
            action="/comparateur"
            method="get"
            className="mt-7 flex flex-col gap-2.5 sm:flex-row"
            role="search"
          >
            <input type="hidden" name="country" value={country} />
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-4"
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
                placeholder="Rechercher un produit, une marque…"
                aria-label="Rechercher un produit"
                className="h-14 w-full rounded-xl border border-line bg-surface pl-12 pr-4 text-fs-16 text-ink shadow-sm outline-none transition duration-base ease-ds placeholder:text-ink-4 focus:border-steel focus:ring-4 focus:ring-steel/15"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-14 items-center justify-center rounded-xl bg-ink px-7 text-fs-16 font-semibold text-paper shadow-sm transition duration-base ease-ds hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              Rechercher
            </button>
          </form>

          {/* Recherches populaires */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-fs-13 text-ink-3">Populaires&nbsp;:</span>
            {POPULAR.map((p) => (
              <Link
                key={p.q}
                href={`/comparateur?q=${encodeURIComponent(p.q)}&country=${country}`}
                className="rounded-pill border border-line bg-surface px-3 py-1 text-fs-13 text-ink-2 transition duration-base ease-ds hover:border-steel/40 hover:bg-steel-soft hover:text-steel-hover"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        <AssistPanel country={country} />

        {/* Résultats */}
        {q && (
          <p className="mb-5 mt-8 text-fs-14 text-ink-3">
            <span className="font-semibold text-ink">{total}</span> résultat
            {total > 1 ? "s" : ""} pour «&nbsp;{q}&nbsp;»
          </p>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-4 pb-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((it) => (
              <ProductCard key={it.id} item={it} country={country} />
            ))}
          </div>
        )}

        {/* État vide : recherche sans résultat */}
        {q && items.length === 0 && (
          <div className="rounded-2xl border border-line bg-surface px-6 py-16 text-center shadow-xs">
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

        {/* État initial : pas de recherche → valeur + entrées populaires */}
        {!q && (
          <>
            <div className="mt-10 grid gap-6 rounded-2xl border border-line bg-surface p-6 shadow-xs sm:grid-cols-3 sm:p-8">
              <TrustItem
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                }
                title="Plusieurs marchands"
                sub="Le même produit comparé d'un marchand à l'autre."
              />
              <TrustItem
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                    <path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" />
                  </svg>
                }
                title="Historique des prix"
                sub="Voyez si c'est le bon moment pour acheter."
              />
              <TrustItem
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                    <path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" />
                  </svg>
                }
                title="Indépendant"
                sub="Gratuit, sans tri sponsorisé. Vous d'abord."
              />
            </div>

            <div className="mt-8 mb-2">
              <p className="mb-3 font-display text-fs-18 font-semibold text-ink">
                Commencez par une catégorie
              </p>
              <div className="flex flex-wrap gap-3">
                {POPULAR.map((p) => (
                  <Link
                    key={p.q}
                    href={`/comparateur?q=${encodeURIComponent(p.q)}&country=${country}`}
                    className="group inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-fs-15 font-medium text-ink shadow-xs transition duration-base ease-ds hover:-translate-y-0.5 hover:border-steel/40 hover:shadow-md"
                  >
                    {p.label}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-ink-4 transition group-hover:translate-x-0.5 group-hover:text-steel" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

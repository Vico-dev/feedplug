import Link from "next/link";
import type { Metadata } from "next";
import { searchProducts, formatPrice } from "@/lib/comparator-api";

export const revalidate = 300;

type Search = Promise<{ q?: string; country?: string; sort?: string }>;

function normCountry(c?: string): string {
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : "FR";
}

export const metadata: Metadata = {
  title: "Comparateur de prix — Feedplug",
  description: "Comparez les prix de milliers de produits chez plusieurs marchands, avec l'historique des prix.",
};

export default async function ComparatorSearchPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const country = normCountry(sp.country);
  const sort = sp.sort || "relevance";
  const data = q ? await searchProducts({ q, country, sort, limit: 24 }) : null;
  const items = data?.items ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-medium text-gray-900">Comparateur de prix</h1>
      <p className="mt-1 text-sm text-gray-500">Le meilleur prix de chaque produit, chez plusieurs marchands.</p>

      <form action="/comparateur" method="get" className="mt-4 flex gap-2">
        <input type="hidden" name="country" value={country} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher un produit…"
          className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm"
          aria-label="Rechercher un produit"
        />
        <button type="submit" className="h-10 rounded-lg border border-gray-300 px-4 text-sm hover:bg-gray-50">
          Rechercher
        </button>
      </form>

      {q && (
        <p className="mt-4 text-sm text-gray-500">
          {data?.total ?? 0} résultat{(data?.total ?? 0) > 1 ? "s" : ""} pour «&nbsp;{q}&nbsp;»
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <Link
            key={it.id}
            href={`/comparateur/produit/${it.id}?country=${country}`}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-3 hover:border-gray-300"
          >
            <div className="flex h-28 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
              {it.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.imageUrl} alt={it.title} className="h-full w-full object-contain" />
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-gray-900">{it.title}</p>
            {it.brand && <p className="text-xs text-gray-400">{it.brand}</p>}
            <div className="mt-auto pt-2">
              <p className="text-base font-medium text-gray-900">{formatPrice(it.lowestPrice, it.currency)}</p>
              <p className="text-xs text-gray-500">{it.merchantCount} marchands</p>
            </div>
          </Link>
        ))}
      </div>

      {q && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">Aucun produit trouvé pour cette recherche.</p>
      )}
    </main>
  );
}

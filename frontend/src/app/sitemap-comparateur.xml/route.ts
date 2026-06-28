import { searchProducts } from "@/lib/comparator-api";

// Sitemap du COMPARATEUR conso — ancré sur l'apex (feedplug.com).
// Exposé en Route Handler (et non via app/sitemap.ts, déjà pris par le sitemap
// marketing) pour pouvoir énumérer les fiches produit indexables au build/ISR.
//   URL : https://feedplug.com/sitemap-comparateur.xml
export const revalidate = 3600; // 1 h : suit le rythme d'indexation conso

const APEX_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://feedplug.com";

// Requêtes des catégories mises en avant sur la home comparateur (cf.
// CATEGORIES dans (comparateur)/comparateur/page.tsx). Servent d'amorce pour
// remonter des fiches indexables sans endpoint sitemap dédié côté backend.
const CATEGORY_QUERIES = ["acer", "jeu", "sac", "parfum"];
const PRODUCTS_PER_CATEGORY = 50;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type Entry = { loc: string; changefreq: string; priority: string };

async function collectProductEntries(): Promise<Entry[]> {
  const seen = new Set<string>();
  const entries: Entry[] = [];
  // Best-effort : si l'API comparateur est injoignable au build, on dégrade
  // proprement vers le sitemap statique (home + /comparateur + catégories).
  await Promise.all(
    CATEGORY_QUERIES.map(async (q) => {
      const res = await searchProducts({ q, country: "FR", limit: PRODUCTS_PER_CATEGORY });
      if (!res?.items) return;
      for (const item of res.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        entries.push({
          loc: `${APEX_URL}/comparateur/produit/${encodeURIComponent(item.id)}`,
          changefreq: "daily",
          priority: "0.6",
        });
      }
    })
  );
  return entries;
}

export async function GET() {
  const staticEntries: Entry[] = [
    { loc: `${APEX_URL}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${APEX_URL}/en`, changefreq: "daily", priority: "0.9" },
    { loc: `${APEX_URL}/es`, changefreq: "daily", priority: "0.9" },
    { loc: `${APEX_URL}/comparateur`, changefreq: "daily", priority: "0.9" },
    // Pages catégorie = recherche pré-filtrée sur la home conso (indexables)
    ...CATEGORY_QUERIES.map((q) => ({
      loc: `${APEX_URL}/?q=${encodeURIComponent(q)}`,
      changefreq: "weekly",
      priority: "0.7",
    })),
  ];

  let productEntries: Entry[] = [];
  try {
    productEntries = await collectProductEntries();
  } catch {
    productEntries = [];
  }

  const all = [...staticEntries, ...productEntries];
  const lastmod = new Date().toISOString();

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    all
      .map(
        (e) =>
          `  <url><loc>${xmlEscape(e.loc)}</loc><lastmod>${lastmod}</lastmod>` +
          `<changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

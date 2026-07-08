import { getCategory } from "@/lib/comparator-api";

// Sitemap du COMPARATEUR conso — ancré sur l'apex (feedplug.com).
// Exposé en Route Handler (et non via app/sitemap.ts, déjà pris par le sitemap
// marketing) pour pouvoir énumérer les fiches produit indexables au build/ISR.
//   URL : https://feedplug.com/sitemap-comparateur.xml
export const revalidate = 3600; // 1 h : suit le rythme d'indexation conso

const APEX_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://feedplug.com";

// Rayons de la taxonomie maison (cf. RAYONS dans
// components/comparateur/comparateur-header.tsx). Un rayon n'est listé que
// s'il a des produits (sinon page « thin » sans intérêt pour le crawl).
const RAYON_SLUGS = [
  "informatique",
  "telephonie",
  "tv-son",
  "electromenager",
  "jeux-video",
  "maison-deco",
  "mode",
  "beaute-parfums",
  "sport",
  "jouets",
];

const PAGE_SIZE = 48; // taille de page de l'API catégorie (alignée sur la page rayon)
const MAX_PRODUCT_URLS = 8000; // plafond fiches : reste sous les 10 000 URLs / sitemap
const MAX_PAGES_PER_RAYON = 60; // garde-fou anti-boucle si l'API renvoie un total incohérent

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type Entry = { loc: string; changefreq: string; priority: string };

// Énumère les rayons non vides + TOUTES leurs fiches produit (dédupliquées,
// un produit pouvant apparaître dans plusieurs rayons) en paginant l'API
// catégorie. Best-effort : un rayon injoignable est simplement ignoré
// (getCategory renvoie null sans jeter) et on dégrade vers le statique.
async function collectCatalogEntries(): Promise<{
  rayonEntries: Entry[];
  productEntries: Entry[];
}> {
  const seen = new Set<string>();
  const rayonEntries: Entry[] = [];
  const productEntries: Entry[] = [];

  const pushProducts = (items: { id: string }[]) => {
    for (const item of items) {
      if (seen.has(item.id) || productEntries.length >= MAX_PRODUCT_URLS) continue;
      seen.add(item.id);
      productEntries.push({
        loc: `${APEX_URL}/comparateur/produit/${encodeURIComponent(item.id)}`,
        changefreq: "daily",
        priority: "0.6",
      });
    }
  };

  await Promise.all(
    RAYON_SLUGS.map(async (slug) => {
      const first = await getCategory(slug, "FR", { limit: PAGE_SIZE });
      if (!first || first.total <= 0) return; // rayon vide ou API muette : URL non exposée
      rayonEntries.push({
        loc: `${APEX_URL}/rayon/${slug}`,
        changefreq: "daily",
        priority: "0.8",
      });
      pushProducts(first.items);
      let offset = first.items.length;
      let pages = 1;
      while (
        offset < first.total &&
        pages < MAX_PAGES_PER_RAYON &&
        productEntries.length < MAX_PRODUCT_URLS
      ) {
        const page = await getCategory(slug, "FR", { limit: PAGE_SIZE, offset });
        if (!page || page.items.length === 0) break;
        pushProducts(page.items);
        offset += page.items.length;
        pages += 1;
      }
    })
  );

  return { rayonEntries, productEntries };
}

export async function GET() {
  // Pages statiques de l'apex conso (home = comparateur, rewrite / → /comparateur).
  const staticEntries: Entry[] = [
    { loc: `${APEX_URL}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${APEX_URL}/en`, changefreq: "daily", priority: "0.9" },
    { loc: `${APEX_URL}/es`, changefreq: "daily", priority: "0.9" },
    { loc: `${APEX_URL}/comparateur`, changefreq: "daily", priority: "0.9" },
    { loc: `${APEX_URL}/deals`, changefreq: "daily", priority: "0.8" },
    { loc: `${APEX_URL}/transparence`, changefreq: "monthly", priority: "0.3" },
    { loc: `${APEX_URL}/confidentialite`, changefreq: "monthly", priority: "0.3" },
  ];

  let rayonEntries: Entry[] = [];
  let productEntries: Entry[] = [];
  try {
    ({ rayonEntries, productEntries } = await collectCatalogEntries());
  } catch {
    // API injoignable au build : on dégrade proprement vers le sitemap statique.
    rayonEntries = [];
    productEntries = [];
  }

  const all = [...staticEntries, ...rayonEntries, ...productEntries];
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

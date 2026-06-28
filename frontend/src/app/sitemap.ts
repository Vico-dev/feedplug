import type { MetadataRoute } from "next";

// Sitemap MARKETING B2B — toutes les URLs sont ancrées sur l'hôte marketing
// (pro.feedplug.com depuis le rehoming de domaine). Sert /sitemap.xml.
// Le comparateur conso a son propre sitemap apex : /sitemap-comparateur.xml.
const baseUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://feedplug.com";

const docPaths = [
  "",
  "/sources",
  "/catalogue",
  "/enrichissement",
  "/score",
  "/export",
  "/dashboard",
  "/compte",
  "/demarrage",
  "/faq",
  "/glossaire",
  "/roadmap",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Home marketing B2B (/) + EN (/en) + ES (/es) — sur pro.feedplug.com
  const homeEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/en`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/es`, lastModified, changeFrequency: "weekly", priority: 1 },
  ];

  // Intégrations (FR + EN + ES)
  const integrationsEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/integrations`, lastModified, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/en/integrations`, lastModified, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/es/integrations`, lastModified, changeFrequency: "weekly", priority: 0.85 },
  ];

  // Landing pages marketing (FR + EN + ES)
  const lpPaths = [
    "/optimiser-flux-google-shopping",
    "/optimiser-flux-google-shopping-shopify",
    "/corriger-erreurs-google-merchant-center",
    "/optimiser-flux-amazon",
    "/feed-produit-amazon-shopify",
    "/gestion-flux-produits-marketplaces",
    "/optimiser-flux-rakuten",
    "/optimiser-flux-cdiscount",
    "/diffusion-nouveaux-canaux",
    "/distribution-assistants-ia",
    "/feed-produit-chatgpt",
    "/feedplug-vs-channable",
    "/feedplug-vs-shoppingfeed",
    "/comparatif-outils-feed-produits",
  ];
  const lpEntries: MetadataRoute.Sitemap = [
    ...lpPaths.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...lpPaths.map((path) => ({
      url: `${baseUrl}/en${path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...lpPaths.map((path) => ({
      url: `${baseUrl}/es${path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];

  const docEntries: MetadataRoute.Sitemap = docPaths.map((path) => ({
    url: `${baseUrl}/docs${path}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 0.9 : 0.7,
  }));

  return [...homeEntries, ...integrationsEntries, ...lpEntries, ...docEntries];
}

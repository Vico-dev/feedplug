/**
 * Configuration SEO partagée
 * - /og-image : image OG 1200×630 générée dynamiquement (remplaçable par /public/og-image.png)
 * - /logo : logo 200×200 pour schémas JSON-LD (remplaçable par /public/logo.png)
 */

// Apex conso : feedplug.com — sert le comparateur public.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://feedplug.com";
// Hôte marketing B2B : pro.feedplug.com — base des canonicals/OG des pages
// marketing & docs depuis le rehoming de domaine. Fallback sur l'apex tant que
// la variable n'est pas définie (rétro-compat avant bascule DNS).
const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || siteUrl;

export const seo = {
  /** Apex conso (comparateur). */
  siteUrl,
  /**
   * Base canonique du marketing B2B (pro.feedplug.com). À utiliser pour TOUTES
   * les métadonnées des pages marketing & docs (canonical, OG url, hreflang,
   * JSON-LD Organization/WebSite). Le comparateur/conso garde `siteUrl`.
   */
  marketingUrl,
  // OG/logo servis sous l'hôte marketing (les assets vivent aussi sur l'apex,
  // mais l'image OG de référence du site B2B est ancrée sur pro.).
  ogImage: `${marketingUrl}/og-image`,
  logo: `${marketingUrl}/logo`,
  defaultImages: {
    width: 1200,
    height: 630,
    alt: "FeedPlug - Gestion flux produits multi-canaux",
  },
  /** Liens réseaux sociaux pour le schéma Organization (sameAs) — à compléter */
  socialUrls: [
    "https://www.linkedin.com/company/feedplug",
    "https://twitter.com/feedplug",
  ] as string[],
} as const;

/** Crée des métadonnées complètes pour une page doc (OG, Twitter, canonical) */
export function createDocMetadata(
  title: string,
  description: string,
  path: string,
  keywords?: string[]
): import("next").Metadata {
  const url = `${seo.marketingUrl}/docs${path}`;
  return {
    title,
    description,
    keywords: keywords ?? [],
    openGraph: {
      title: `${title} | FeedPlug`,
      description,
      url,
      type: "website" as const,
      siteName: "FeedPlug",
      images: [
        {
          url: seo.ogImage,
          width: seo.defaultImages.width,
          height: seo.defaultImages.height,
          alt: seo.defaultImages.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: `${title} | FeedPlug`,
      description,
      images: [seo.ogImage],
    },
    alternates: { canonical: url },
    robots: { index: true, follow: true },
  };
}

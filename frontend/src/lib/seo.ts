/**
 * Configuration SEO partagée
 * - /og-image : image OG 1200×630 générée dynamiquement (remplaçable par /public/og-image.png)
 * - /logo : logo 200×200 pour schémas JSON-LD (remplaçable par /public/logo.png)
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://feedplug.com";

export const seo = {
  siteUrl,
  ogImage: `${siteUrl}/og-image`,
  logo: `${siteUrl}/logo`,
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
  const url = `${seo.siteUrl}/docs${path}`;
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

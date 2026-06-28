import type { Metadata } from "next";
import DocsShell from "./DocsShell";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Centralisez vos catalogues produits, optimisez vos fiches avec l'IA et diffusez sur Google Shopping et vos canaux. Guides et fonctionnalités FeedPlug.",
  keywords: [
    "feed produit",
    "Google Merchant Center",
    "Google Shopping",
    "optimisation catalogue",
    "enrichissement produit",
    "flux produits",
    "FeedPlug",
  ],
  openGraph: {
    title: "Documentation | FeedPlug",
    description:
      "Centralisez vos catalogues, optimisez vos fiches avec l'IA et diffusez sur Google Shopping. Fonctionnalités et guides FeedPlug.",
    url: `${seo.marketingUrl}/docs`,
    type: "website",
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
    card: "summary_large_image",
    title: "Documentation | FeedPlug",
    description:
      "Centralisez vos catalogues, optimisez vos fiches avec l'IA et diffusez sur Google Shopping. FeedPlug.",
    images: [seo.ogImage],
  },
  alternates: {
    canonical: `${seo.marketingUrl}/docs`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DocsShell>{children}</DocsShell>;
}

import type { Metadata } from "next";
import {
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  createLPMetadata,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/gestion-flux-produits-marketplaces",
  fr: {
    title: "Gestion flux produits marketplaces | FeedPlug",
    description:
      "Centralisez votre catalogue et diffusez vos flux produits vers Amazon, Cdiscount, Rakuten, Fnac ou Mirakl. Scorez les fiches et adaptez chaque export par marketplace.",
    keywords: [
      "gestion flux produits marketplaces",
      "feed management marketplace",
      "catalogue multi marketplace",
      "flux produits amazon cdiscount rakuten",
      "export produits marketplaces",
      "marketplace product feed",
    ],
  },
  en: {
    title: "Marketplace product feed management | FeedPlug",
    description:
      "Centralize your catalog and distribute product feeds to Amazon, Cdiscount, Rakuten, Fnac, or Mirakl. Score listings and adapt each export per marketplace.",
    keywords: [
      "marketplace product feed management",
      "feed management marketplace",
      "multi marketplace catalog",
      "amazon cdiscount rakuten product feed",
      "marketplace export",
      "product feed marketplace",
    ],
  },
  es: {
    title: "Gestion de feeds de productos para marketplaces | FeedPlug",
    description:
      "Centraliza tu catalogo y distribuye feeds de productos a Amazon, Cdiscount, Rakuten, Fnac o Mirakl. Puntua fichas y adapta cada exportacion por marketplace.",
    keywords: [
      "gestion feeds productos marketplaces",
      "feed management marketplace",
      "catalogo multi marketplace",
      "feed amazon cdiscount rakuten",
      "exportacion productos marketplaces",
      "marketplace product feed",
    ],
  },
  breadcrumbNameFr: "Gestion flux produits marketplaces",
  breadcrumbNameEn: "Marketplace product feed management",
  breadcrumbNameEs: "Gestion feeds de productos para marketplaces",
  howToNameFr: "Comment gerer ses flux produits pour les marketplaces",
  howToNameEn: "How to manage product feeds for marketplaces",
  howToNameEs: "Como gestionar feeds de productos para marketplaces",
  howToDescFr:
    "Centralisez le catalogue, scorez vos fiches, adaptez les attributs par marketplace et diffusez des exports plus propres vers Amazon, Cdiscount, Rakuten ou Mirakl.",
  howToDescEn:
    "Centralize the catalog, score listings, adapt attributes per marketplace, and distribute cleaner exports to Amazon, Cdiscount, Rakuten, or Mirakl.",
  howToDescEs:
    "Centraliza el catalogo, puntua fichas, adapta atributos por marketplace y distribuye exportaciones mas limpias a Amazon, Cdiscount, Rakuten o Mirakl.",
  steps: [
    {
      nameFr: "Centraliser le catalogue",
      nameEn: "Centralize the catalog",
      nameEs: "Centralizar el catalogo",
      textFr:
        "Regroupez vos produits, variantes, prix, images et disponibilites dans une base unique.",
      textEn:
        "Gather products, variants, prices, images, and availability in one source of truth.",
      textEs:
        "Reune productos, variantes, precios, imagenes y stock en una base unica.",
    },
    {
      nameFr: "Scorez les fiches produit",
      nameEn: "Score product listings",
      nameEs: "Puntuar fichas de producto",
      textFr:
        "Priorisez les fiches les plus faibles avant diffusion avec un scoring produit lisible.",
      textEn:
        "Prioritize the weakest listings before distribution with readable product scoring.",
      textEs:
        "Prioriza las fichas mas debiles antes de publicar con un scoring de producto claro.",
    },
    {
      nameFr: "Adapter les attributs par marketplace",
      nameEn: "Adapt attributes per marketplace",
      nameEs: "Adaptar atributos por marketplace",
      textFr:
        "Renforcez les champs utiles a Amazon, Cdiscount, Rakuten, Fnac ou Mirakl sans dupliquer tout le catalogue.",
      textEn:
        "Strengthen attributes for Amazon, Cdiscount, Rakuten, Fnac, or Mirakl without duplicating the whole catalog.",
      textEs:
        "Refuerza atributos para Amazon, Cdiscount, Rakuten, Fnac o Mirakl sin duplicar todo el catalogo.",
    },
    {
      nameFr: "Diffuser des exports plus propres",
      nameEn: "Distribute cleaner exports",
      nameEs: "Distribuir exportaciones mas limpias",
      textFr:
        "Publiez plusieurs flux marketplace a partir d'une source centrale plus stable et plus maintenable.",
      textEn:
        "Publish multiple marketplace feeds from one more stable and maintainable source layer.",
      textEs:
        "Publica varios feeds marketplace desde una capa central mas estable y mantenible.",
    },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = locale === "fr" ? "fr" : locale === "es" ? "es" : "en";
  return createLPMetadata(config, lang);
}

export default async function MarketplacesFeedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lang = locale === "fr" ? "fr" : locale === "es" ? "es" : "en";

  return (
    <>
      {createBreadcrumbJsonLd(config, lang)}
      {createHowToJsonLd(config, lang)}
      {children}
    </>
  );
}

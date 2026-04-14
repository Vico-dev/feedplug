import type { Metadata } from "next";
import {
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  createLPMetadata,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/feed-produit-amazon-shopify",
  fr: {
    title: "Feed produit Amazon Shopify | FeedPlug",
    description:
      "Exportez votre catalogue Shopify vers Amazon avec un feed produit structure. Scorez vos fiches, corrigez les attributs obligatoires et preparez Seller Central.",
    keywords: [
      "feed produit amazon shopify",
      "shopify amazon feed",
      "export shopify amazon",
      "seller central shopify",
      "flux amazon shopify",
      "amazon product feed shopify",
    ],
  },
  en: {
    title: "Amazon Shopify product feed | FeedPlug",
    description:
      "Export your Shopify catalog to Amazon with a structured product feed. Score listings, fix required attributes, and prepare Seller Central.",
    keywords: [
      "amazon shopify product feed",
      "shopify amazon feed",
      "shopify to amazon export",
      "seller central shopify",
      "amazon feed shopify",
      "amazon product feed",
    ],
  },
  es: {
    title: "Feed de productos Amazon Shopify | FeedPlug",
    description:
      "Exporta tu catalogo de Shopify a Amazon con un feed de productos estructurado. Puntua tus fichas, corrige atributos obligatorios y prepara Seller Central.",
    keywords: [
      "feed de productos amazon shopify",
      "shopify amazon feed",
      "exportar shopify amazon",
      "seller central shopify",
      "feed amazon shopify",
      "amazon product feed",
    ],
  },
  breadcrumbNameFr: "Feed produit Amazon Shopify",
  breadcrumbNameEn: "Amazon Shopify product feed",
  breadcrumbNameEs: "Feed de productos Amazon Shopify",
  howToNameFr: "Comment preparer un feed produit Amazon depuis Shopify",
  howToNameEn: "How to prepare an Amazon product feed from Shopify",
  howToNameEs: "Como preparar un feed de productos para Amazon desde Shopify",
  howToDescFr:
    "Connectez Shopify, scorez vos fiches produit, corrigez les attributs critiques et exportez un feed pret pour Amazon Seller Central.",
  howToDescEn:
    "Connect Shopify, score product listings, fix critical attributes, and export a feed ready for Amazon Seller Central.",
  howToDescEs:
    "Conecta Shopify, puntua tus fichas, corrige atributos criticos y exporta un feed listo para Amazon Seller Central.",
  steps: [
    {
      nameFr: "Connecter Shopify",
      nameEn: "Connect Shopify",
      nameEs: "Conectar Shopify",
      textFr:
        "Importez titres, variantes, prix, images, stock et liens produits depuis Shopify vers une base unique.",
      textEn:
        "Import titles, variants, prices, images, stock, and product links from Shopify into one source of truth.",
      textEs:
        "Importa titulos, variantes, precios, imagenes, stock y enlaces de producto desde Shopify a una base unica.",
    },
    {
      nameFr: "Scorez les fiches produit",
      nameEn: "Score product listings",
      nameEs: "Puntuar las fichas",
      textFr:
        "Reperez les fiches trop faibles pour Amazon grace au scoring produit et aux alertes de qualite.",
      textEn:
        "Spot listings that are too weak for Amazon with product scoring and quality alerts.",
      textEs:
        "Detecta fichas demasiado debiles para Amazon con scoring de producto y alertas de calidad.",
    },
    {
      nameFr: "Corriger les attributs Amazon",
      nameEn: "Fix Amazon attributes",
      nameEs: "Corregir atributos Amazon",
      textFr:
        "Renforcez marque, GTIN, variations, bullet points, prix et disponibilite avant export vers Seller Central.",
      textEn:
        "Strengthen brand, GTIN, variations, bullet points, price, and availability before exporting to Seller Central.",
      textEs:
        "Refuerza marca, GTIN, variaciones, bullet points, precio y stock antes de exportar a Seller Central.",
    },
    {
      nameFr: "Exporter vers Seller Central",
      nameEn: "Export to Seller Central",
      nameEs: "Exportar a Seller Central",
      textFr:
        "Diffusez un feed Amazon structure sans reconstruire manuellement le fichier a chaque mise a jour du catalogue.",
      textEn:
        "Publish a structured Amazon feed without rebuilding the file manually every time the catalog changes.",
      textEs:
        "Publica un feed Amazon estructurado sin reconstruir manualmente el archivo en cada cambio del catalogo.",
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

export default async function AmazonShopifyFeedLayout({
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

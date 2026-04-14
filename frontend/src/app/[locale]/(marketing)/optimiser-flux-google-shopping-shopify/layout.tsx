import type { Metadata } from "next";
import {
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  createLPMetadata,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/optimiser-flux-google-shopping-shopify",
  fr: {
    title: "Optimiser son flux Google Shopping depuis Shopify | FeedPlug",
    description:
      "Connectez Shopify, nettoyez votre catalogue, corrigez les erreurs Google Merchant Center et exportez un flux Google Shopping conforme avec FeedPlug.",
    keywords: [
      "flux Google Shopping Shopify",
      "Shopify Google Merchant Center",
      "optimiser flux Shopify Google Shopping",
      "corriger erreurs Merchant Center Shopify",
      "export flux Google Shopping Shopify",
      "feed produit Shopify Google",
    ],
  },
  en: {
    title: "Optimize your Google Shopping feed from Shopify | FeedPlug",
    description:
      "Connect Shopify, clean up your catalog, fix Google Merchant Center errors, and export a compliant Google Shopping feed with FeedPlug.",
    keywords: [
      "Shopify Google Shopping feed",
      "Shopify Google Merchant Center",
      "optimize Shopify Google Shopping feed",
      "fix Merchant Center errors Shopify",
      "Google Shopping export Shopify",
      "Shopify product feed Google",
    ],
  },
  es: {
    title: "Optimiza tu feed de Google Shopping desde Shopify | FeedPlug",
    description:
      "Conecta Shopify, limpia tu catalogo, corrige errores de Google Merchant Center y exporta un feed compatible con Google Shopping con FeedPlug.",
    keywords: [
      "feed Google Shopping Shopify",
      "Shopify Google Merchant Center",
      "optimizar feed Shopify Google Shopping",
      "corregir errores Merchant Center Shopify",
      "exportar feed Google Shopping Shopify",
      "feed de productos Shopify Google",
    ],
  },
  breadcrumbNameFr: "Flux Google Shopping Shopify",
  breadcrumbNameEn: "Shopify Google Shopping feed",
  breadcrumbNameEs: "Feed Google Shopping Shopify",
  howToNameFr: "Comment optimiser un flux Google Shopping depuis Shopify",
  howToNameEn: "How to optimize a Google Shopping feed from Shopify",
  howToNameEs: "Como optimizar un feed de Google Shopping desde Shopify",
  howToDescFr:
    "Connectez Shopify, priorisez les erreurs Merchant Center, enrichissez les fiches et exportez un flux Google Shopping conforme.",
  howToDescEn:
    "Connect Shopify, prioritize Merchant Center errors, enrich listings, and export a compliant Google Shopping feed.",
  howToDescEs:
    "Conecta Shopify, prioriza errores de Merchant Center, mejora tus fichas y exporta un feed compatible con Google Shopping.",
  steps: [
    {
      nameFr: "Connecter Shopify",
      nameEn: "Connect Shopify",
      nameEs: "Conectar Shopify",
      textFr:
        "Connectez votre boutique Shopify pour centraliser automatiquement titres, descriptions, prix, images et disponibilites.",
      textEn:
        "Connect your Shopify store to centralize titles, descriptions, prices, images, and availability automatically.",
      textEs:
        "Conecta tu tienda Shopify para centralizar titulos, descripciones, precios, imagenes y stock automaticamente.",
    },
    {
      nameFr: "Identifier les blocages GMC",
      nameEn: "Identify GMC blockers",
      nameEs: "Identificar bloqueos de GMC",
      textFr:
        "Reperez les produits rejetes ou incomplets grace au score de qualite et aux alertes de conformite.",
      textEn:
        "Spot rejected or incomplete products with quality scoring and compliance alerts.",
      textEs:
        "Detecta productos rechazados o incompletos con puntuacion de calidad y alertas de cumplimiento.",
    },
    {
      nameFr: "Enrichir les fiches",
      nameEn: "Enrich listings",
      nameEs: "Mejorar fichas",
      textFr:
        "Optimisez titres, descriptions et attributs strategiques pour mieux correspondre aux exigences Google Shopping.",
      textEn:
        "Optimize titles, descriptions, and strategic attributes to match Google Shopping requirements better.",
      textEs:
        "Optimiza titulos, descripciones y atributos clave para encajar mejor con Google Shopping.",
    },
    {
      nameFr: "Exporter le flux",
      nameEn: "Export the feed",
      nameEs: "Exportar el feed",
      textFr:
        "Generez un flux XML ou une URL de flux prete pour Google Merchant Center, avec mise a jour continue.",
      textEn:
        "Generate an XML feed or feed URL ready for Google Merchant Center, with ongoing updates.",
      textEs:
        "Genera un feed XML o una URL lista para Google Merchant Center, con actualizacion continua.",
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

export default async function ShopifyGoogleShoppingLayout({
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

import type { Metadata } from "next";
import {
  createLPMetadata,
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/optimiser-flux-cdiscount",
  fr: {
    title: "Optimiser son flux produit pour Cdiscount | FeedPlug",
    description:
      "Guide pour optimiser votre flux produit et vendre sur Cdiscount : conformité Pro Seller, enrichissement IA, export automatique. Méthode FeedPlug.",
    keywords: [
      "optimiser flux Cdiscount",
      "flux produit Cdiscount",
      "Pro Seller",
      "enrichissement feed produit",
      "export Cdiscount",
    ],
  },
  en: {
    title: "Optimize your product feed for Cdiscount | FeedPlug",
    description:
      "Guide to optimize your product feed and sell on Cdiscount: Pro Seller compliance, AI enrichment, automatic export. FeedPlug method.",
    keywords: [
      "optimize Cdiscount feed",
      "Cdiscount product feed",
      "Pro Seller",
      "product feed enrichment",
      "Cdiscount export",
    ],
  },
  es: {
    title: "Optimiza tu feed de productos para Cdiscount | FeedPlug",
    description:
      "Guia para optimizar tu feed de productos y vender en Cdiscount: cumplimiento de Pro Seller, enriquecimiento con IA y exportacion automatica. Metodo FeedPlug.",
    keywords: [
      "optimizar feed Cdiscount",
      "feed de productos Cdiscount",
      "Pro Seller",
      "enriquecimiento feed productos",
      "exportacion Cdiscount",
    ],
  },
  breadcrumbNameFr: "Optimiser son flux pour Cdiscount",
  breadcrumbNameEn: "Optimize your feed for Cdiscount",
  breadcrumbNameEs: "Optimiza tu feed para Cdiscount",
  howToNameFr: "Comment optimiser son flux produit pour Cdiscount",
  howToNameEn: "How to optimize your product feed for Cdiscount",
  howToNameEs: "Como optimizar tu feed de productos para Cdiscount",
  howToDescFr:
    "Guide en 4 étapes pour préparer votre catalogue Cdiscount : import, score, enrichissement IA, export Pro Seller.",
  howToDescEn:
    "4-step guide to prepare your Cdiscount catalog: import, score, AI enrichment, Pro Seller export.",
  howToDescEs:
    "Guia en 4 pasos para preparar tu catalogo de Cdiscount: importacion, puntuacion, enriquecimiento con IA y exportacion a Pro Seller.",
  steps: [
    { nameFr: "Import et centralisation", nameEn: "Import and centralization", nameEs: "Importacion y centralizacion", textFr: "Connectez Shopify ou votre fichier. FeedPlug agrège et synchronise vos données produits.", textEn: "Connect Shopify or your file. FeedPlug aggregates and syncs your product data.", textEs: "Conecta Shopify o tu archivo. FeedPlug agrega y sincroniza tus datos de producto." },
    { nameFr: "Score de qualité 0-100", nameEn: "Quality score 0-100", nameEs: "Puntuacion de calidad 0-100", textFr: "Score par dimension : titre, description, image, conformité. Priorisez les améliorations.", textEn: "Score per dimension: title, description, image, compliance. Prioritize improvements.", textEs: "Puntuacion por dimension: titulo, descripcion, imagen y cumplimiento. Prioriza las mejoras." },
    { nameFr: "Enrichissement IA", nameEn: "AI enrichment", nameEs: "Enriquecimiento con IA", textFr: "L'IA optimise titres et descriptions selon les bonnes pratiques Cdiscount.", textEn: "AI optimizes titles and descriptions per Cdiscount best practices.", textEs: "La IA optimiza titulos y descripciones segun las buenas practicas de Cdiscount." },
    { nameFr: "Export conforme Cdiscount", nameEn: "Cdiscount-compliant export", nameEs: "Exportacion compatible con Cdiscount", textFr: "Flux prêt pour Pro Seller. Format attendu, attributs obligatoires, mise à jour automatique.", textEn: "Feed ready for Pro Seller. Expected format, mandatory attributes, automatic updates.", textEs: "Feed listo para Pro Seller. Formato esperado, atributos obligatorios y actualizacion automatica." },
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

export default async function LPLayout({
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

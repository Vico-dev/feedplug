import type { Metadata } from "next";
import {
  createLPMetadata,
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/optimiser-flux-rakuten",
  fr: {
    title: "Optimiser son flux produit pour Rakuten | FeedPlug",
    description:
      "Guide pour optimiser votre flux produit et vendre sur Rakuten : conformité Seller Space, enrichissement IA, export automatique. Méthode FeedPlug.",
    keywords: [
      "optimiser flux Rakuten",
      "flux produit Rakuten",
      "Seller Space",
      "enrichissement feed produit",
      "export Rakuten",
    ],
  },
  en: {
    title: "Optimize your product feed for Rakuten | FeedPlug",
    description:
      "Guide to optimize your product feed and sell on Rakuten: Seller Space compliance, AI enrichment, automatic export. FeedPlug method.",
    keywords: [
      "optimize Rakuten feed",
      "Rakuten product feed",
      "Seller Space",
      "product feed enrichment",
      "Rakuten export",
    ],
  },
  es: {
    title: "Optimiza tu feed de productos para Rakuten | FeedPlug",
    description:
      "Guia para optimizar tu feed de productos y vender en Rakuten: cumplimiento de Seller Space, enriquecimiento con IA y exportacion automatica. Metodo FeedPlug.",
    keywords: [
      "optimizar feed Rakuten",
      "feed de productos Rakuten",
      "Seller Space",
      "enriquecimiento feed productos",
      "exportacion Rakuten",
    ],
  },
  breadcrumbNameFr: "Optimiser son flux pour Rakuten",
  breadcrumbNameEn: "Optimize your feed for Rakuten",
  breadcrumbNameEs: "Optimiza tu feed para Rakuten",
  howToNameFr: "Comment optimiser son flux produit pour Rakuten",
  howToNameEn: "How to optimize your product feed for Rakuten",
  howToNameEs: "Como optimizar tu feed de productos para Rakuten",
  howToDescFr:
    "Guide en 4 étapes pour préparer votre catalogue Rakuten : import, score, enrichissement IA, export Seller Space.",
  howToDescEn:
    "4-step guide to prepare your Rakuten catalog: import, score, AI enrichment, Seller Space export.",
  howToDescEs:
    "Guia en 4 pasos para preparar tu catalogo de Rakuten: importacion, puntuacion, enriquecimiento con IA y exportacion a Seller Space.",
  steps: [
    { nameFr: "Import et centralisation", nameEn: "Import and centralization", nameEs: "Importacion y centralizacion", textFr: "Connectez Shopify ou votre fichier. FeedPlug agrège et synchronise vos données produits.", textEn: "Connect Shopify or your file. FeedPlug aggregates and syncs your product data.", textEs: "Conecta Shopify o tu archivo. FeedPlug agrega y sincroniza tus datos de producto." },
    { nameFr: "Score de qualité 0-100", nameEn: "Quality score 0-100", nameEs: "Puntuacion de calidad 0-100", textFr: "Score par dimension : titre, description, image, conformité. Priorisez les améliorations.", textEn: "Score per dimension: title, description, image, compliance. Prioritize improvements.", textEs: "Puntuacion por dimension: titulo, descripcion, imagen y cumplimiento. Prioriza las mejoras." },
    { nameFr: "Enrichissement IA", nameEn: "AI enrichment", nameEs: "Enriquecimiento con IA", textFr: "L'IA optimise titres et descriptions selon les bonnes pratiques Rakuten.", textEn: "AI optimizes titles and descriptions per Rakuten best practices.", textEs: "La IA optimiza titulos y descripciones segun las buenas practicas de Rakuten." },
    { nameFr: "Export conforme Rakuten", nameEn: "Rakuten-compliant export", nameEs: "Exportacion compatible con Rakuten", textFr: "Flux prêt pour Seller Space. Format attendu, attributs obligatoires, mise à jour automatique.", textEn: "Feed ready for Seller Space. Expected format, mandatory attributes, automatic updates.", textEs: "Feed listo para Seller Space. Formato esperado, atributos obligatorios y actualizacion automatica." },
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

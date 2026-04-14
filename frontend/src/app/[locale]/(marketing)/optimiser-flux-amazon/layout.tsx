import type { Metadata } from "next";
import {
  createLPMetadata,
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/optimiser-flux-amazon",
  fr: {
    title: "Optimiser son flux produit pour Amazon | FeedPlug",
    description:
      "Guide pour optimiser votre flux produit et vendre sur Amazon : enrichissement IA, conformité catalogue, variantes, descriptions A+. Méthode FeedPlug.",
    keywords: [
      "optimiser flux Amazon",
      "flux produit Amazon",
      "Seller Central",
      "enrichissement feed produit",
      "catalogue Amazon",
      "export Amazon",
    ],
  },
  en: {
    title: "Optimize your product feed for Amazon | FeedPlug",
    description:
      "Guide to optimize your product feed and sell on Amazon: AI enrichment, catalog compliance, variants, A+ descriptions. FeedPlug method.",
    keywords: [
      "optimize Amazon feed",
      "Amazon product feed",
      "Seller Central",
      "product feed enrichment",
      "Amazon catalog",
      "Amazon export",
    ],
  },
  es: {
    title: "Optimiza tu feed de productos para Amazon | FeedPlug",
    description:
      "Guia para optimizar tu feed de productos y vender en Amazon: enriquecimiento con IA, cumplimiento del catalogo, variantes y descripciones A+. Metodo FeedPlug.",
    keywords: [
      "optimizar feed Amazon",
      "feed de productos Amazon",
      "Seller Central",
      "enriquecimiento feed productos",
      "catalogo Amazon",
      "exportacion Amazon",
    ],
  },
  breadcrumbNameFr: "Optimiser son flux pour Amazon",
  breadcrumbNameEn: "Optimize your feed for Amazon",
  breadcrumbNameEs: "Optimiza tu feed para Amazon",
  howToNameFr: "Comment optimiser son flux produit pour Amazon",
  howToNameEn: "How to optimize your product feed for Amazon",
  howToNameEs: "Como optimizar tu feed de productos para Amazon",
  howToDescFr:
    "Guide en 4 étapes pour préparer votre catalogue Amazon : import, score, enrichissement IA, export Seller Central.",
  howToDescEn:
    "4-step guide to prepare your Amazon catalog: import, score, AI enrichment, Seller Central export.",
  howToDescEs:
    "Guia en 4 pasos para preparar tu catalogo de Amazon: importacion, puntuacion, enriquecimiento con IA y exportacion a Seller Central.",
  steps: [
    { nameFr: "Import et centralisation", nameEn: "Import and centralization", nameEs: "Importacion y centralizacion", textFr: "Connectez Shopify ou votre fichier. FeedPlug agrège et synchronise vos données.", textEn: "Connect Shopify or your file. FeedPlug aggregates and syncs your data.", textEs: "Conecta Shopify o tu archivo. FeedPlug agrega y sincroniza tus datos." },
    { nameFr: "Score de qualité 0-100", nameEn: "Quality score 0-100", nameEs: "Puntuacion de calidad 0-100", textFr: "Score par dimension : titre, description, image, conformité. Priorisez les améliorations.", textEn: "Score per dimension: title, description, image, compliance. Prioritize improvements.", textEs: "Puntuacion por dimension: titulo, descripcion, imagen y cumplimiento. Prioriza las mejoras." },
    { nameFr: "Enrichissement IA", nameEn: "AI enrichment", nameEs: "Enriquecimiento con IA", textFr: "L'IA optimise titres, descriptions et bullet points selon les bonnes pratiques Amazon (A9).", textEn: "AI optimizes titles, descriptions and bullet points per Amazon A9 best practices.", textEs: "La IA optimiza titulos, descripciones y bullet points segun las buenas practicas de Amazon (A9)." },
    { nameFr: "Export conforme Amazon", nameEn: "Amazon-compliant export", nameEs: "Exportacion compatible con Amazon", textFr: "Flux prêt pour Seller Central. Attributs obligatoires, variantes, multi-marchés.", textEn: "Feed ready for Seller Central. Mandatory attributes, variants, multi-marketplace.", textEs: "Feed listo para Seller Central. Atributos obligatorios, variantes y varios mercados." },
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

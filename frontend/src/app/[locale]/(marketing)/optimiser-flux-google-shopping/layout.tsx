import type { Metadata } from "next";
import {
  createLPMetadata,
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/optimiser-flux-google-shopping",
  fr: {
    title: "Optimiser son flux produit pour Google Shopping | FeedPlug",
    description:
      "Guide pour optimiser votre flux produit et mieux diffuser sur Google Shopping : score qualité, enrichissement IA, conformité Merchant Center. Méthode FeedPlug.",
    keywords: [
      "optimiser flux Google Shopping",
      "flux produit Google",
      "Google Merchant Center",
      "enrichissement feed produit",
      "score qualité produits",
      "conformité Google Shopping",
    ],
  },
  en: {
    title: "Optimize your product feed for Google Shopping | FeedPlug",
    description:
      "Guide to optimize your product feed and distribute better on Google Shopping: quality score, AI enrichment, Merchant Center compliance. FeedPlug method.",
    keywords: [
      "optimize Google Shopping feed",
      "Google product feed",
      "Google Merchant Center",
      "product feed enrichment",
      "product quality score",
      "Google Shopping compliance",
    ],
  },
  es: {
    title: "Optimiza tu feed de productos para Google Shopping | FeedPlug",
    description:
      "Guia para optimizar tu feed de productos y mejorar tu distribucion en Google Shopping: puntuacion de calidad, enriquecimiento con IA y cumplimiento de Merchant Center. Metodo FeedPlug.",
    keywords: [
      "optimizar feed Google Shopping",
      "feed de productos Google",
      "Google Merchant Center",
      "enriquecimiento feed productos",
      "puntuacion calidad productos",
      "cumplimiento Google Shopping",
    ],
  },
  breadcrumbNameFr: "Optimiser son flux pour Google Shopping",
  breadcrumbNameEn: "Optimize your feed for Google Shopping",
  breadcrumbNameEs: "Optimiza tu feed para Google Shopping",
  howToNameFr: "Comment optimiser son flux produit pour Google Shopping",
  howToNameEn: "How to optimize your product feed for Google Shopping",
  howToNameEs: "Como optimizar tu feed de productos para Google Shopping",
  howToDescFr:
    "Guide en 4 étapes pour optimiser votre catalogue et exporter un flux conforme Google Merchant Center avec FeedPlug.",
  howToDescEn:
    "4-step guide to optimize your catalog and export a Google Merchant Center compliant feed with FeedPlug.",
  howToDescEs:
    "Guia en 4 pasos para optimizar tu catalogo y exportar un feed compatible con Google Merchant Center con FeedPlug.",
  steps: [
    {
      nameFr: "Import et centralisation",
      nameEn: "Import and centralization",
      nameEs: "Importacion y centralizacion",
      textFr:
        "Connectez votre boutique Shopify ou importez votre fichier d'export. FeedPlug agrège et synchronise vos données produits automatiquement.",
      textEn:
        "Connect your Shopify store or import your export file. FeedPlug aggregates and syncs your product data automatically.",
      textEs:
        "Conecta tu tienda Shopify o importa tu archivo de exportacion. FeedPlug agrega y sincroniza tus datos de producto automaticamente.",
    },
    {
      nameFr: "Score de qualité 0-100",
      nameEn: "Quality score 0-100",
      nameEs: "Puntuacion de calidad 0-100",
      textFr:
        "Chaque fiche reçoit un score par dimension (titre, description, image, conformité). Identifiez les priorités d'amélioration.",
      textEn:
        "Each listing gets a score per dimension (title, description, image, compliance). Identify improvement priorities.",
      textEs:
        "Cada ficha recibe una puntuacion por dimension (titulo, descripcion, imagen y cumplimiento). Identifica las mejoras prioritarias.",
    },
    {
      nameFr: "Enrichissement IA",
      nameEn: "AI enrichment",
      nameEs: "Enriquecimiento con IA",
      textFr:
        "L'IA optimise titres et descriptions selon les bonnes pratiques Google. Templates par secteur d'activité.",
      textEn:
        "AI optimizes titles and descriptions according to Google best practices. Templates by industry.",
      textEs:
        "La IA optimiza titulos y descripciones segun las buenas practicas de Google. Plantillas por sector.",
    },
    {
      nameFr: "Export conforme",
      nameEn: "Compliant export",
      nameEs: "Exportacion compatible",
      textFr:
        "Exportez un flux XML prêt pour Google Merchant Center. Mise à jour automatique, conformité garantie.",
      textEn:
        "Export an XML feed ready for Google Merchant Center. Automatic updates, guaranteed compliance.",
      textEs:
        "Exporta un feed XML listo para Google Merchant Center. Actualizaciones automaticas y cumplimiento garantizado.",
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

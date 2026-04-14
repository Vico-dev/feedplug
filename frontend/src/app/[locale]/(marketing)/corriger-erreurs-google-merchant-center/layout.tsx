import type { Metadata } from "next";
import {
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  createLPMetadata,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/corriger-erreurs-google-merchant-center",
  fr: {
    title: "Corriger erreurs Google Merchant Center | FeedPlug",
    description:
      "Corrigez vos erreurs Google Merchant Center avec un scoring produit clair. Identifiez les fiches bloquees, renforcez les attributs critiques et exportez un flux conforme.",
    keywords: [
      "corriger erreurs google merchant center",
      "erreurs merchant center",
      "gmc diagnostics",
      "produits rejetes google shopping",
      "corriger flux google shopping",
      "merchant center conformite",
    ],
  },
  en: {
    title: "Fix Google Merchant Center errors | FeedPlug",
    description:
      "Fix Google Merchant Center errors with clear product scoring. Identify blocked listings, strengthen critical attributes, and export a compliant feed.",
    keywords: [
      "fix google merchant center errors",
      "merchant center errors",
      "gmc diagnostics",
      "google shopping rejected products",
      "fix google shopping feed",
      "merchant center compliance",
    ],
  },
  es: {
    title: "Corregir errores de Google Merchant Center | FeedPlug",
    description:
      "Corrige errores de Google Merchant Center con un scoring de producto claro. Identifica fichas bloqueadas, mejora atributos criticos y exporta un feed compatible.",
    keywords: [
      "corregir errores google merchant center",
      "errores merchant center",
      "diagnostico gmc",
      "productos rechazados google shopping",
      "corregir feed google shopping",
      "cumplimiento merchant center",
    ],
  },
  breadcrumbNameFr: "Corriger erreurs Google Merchant Center",
  breadcrumbNameEn: "Fix Google Merchant Center errors",
  breadcrumbNameEs: "Corregir errores de Google Merchant Center",
  howToNameFr: "Comment corriger les erreurs Google Merchant Center",
  howToNameEn: "How to fix Google Merchant Center errors",
  howToNameEs: "Como corregir errores de Google Merchant Center",
  howToDescFr:
    "Centralisez le catalogue, scorez les fiches bloquees, corrigez les attributs critiques et exportez un flux Google Shopping conforme.",
  howToDescEn:
    "Centralize the catalog, score blocked listings, fix critical attributes, and export a compliant Google Shopping feed.",
  howToDescEs:
    "Centraliza el catalogo, puntua fichas bloqueadas, corrige atributos criticos y exporta un feed compatible con Google Shopping.",
  steps: [
    {
      nameFr: "Centraliser le catalogue",
      nameEn: "Centralize the catalog",
      nameEs: "Centralizar el catalogo",
      textFr:
        "Regroupez titres, descriptions, images, prix, disponibilites et attributs obligatoires dans une base unique.",
      textEn:
        "Gather titles, descriptions, images, prices, availability, and required attributes in one source of truth.",
      textEs:
        "Reune titulos, descripciones, imagenes, precios, stock y atributos obligatorios en una base unica.",
    },
    {
      nameFr: "Scorez les fiches bloquees",
      nameEn: "Score blocked listings",
      nameEs: "Puntuar fichas bloqueadas",
      textFr:
        "Le scoring produit et les alertes de conformite font remonter les produits rejetes ou incomplets.",
      textEn:
        "Product scoring and compliance alerts surface rejected or incomplete products.",
      textEs:
        "El scoring de producto y las alertas de cumplimiento detectan productos rechazados o incompletos.",
    },
    {
      nameFr: "Corriger les attributs critiques",
      nameEn: "Fix critical attributes",
      nameEs: "Corregir atributos criticos",
      textFr:
        "Renforcez GTIN, marque, categorie, titres, descriptions, images et disponibilite avant renvoi vers Merchant Center.",
      textEn:
        "Strengthen GTIN, brand, category, titles, descriptions, images, and availability before sending back to Merchant Center.",
      textEs:
        "Refuerza GTIN, marca, categoria, titulos, descripciones, imagenes y stock antes de reenviar a Merchant Center.",
    },
    {
      nameFr: "Exporter un flux conforme",
      nameEn: "Export a compliant feed",
      nameEs: "Exportar un feed compatible",
      textFr:
        "Republiez une URL de flux ou un export propre pour Google Shopping sans reconstruire le fichier manuellement.",
      textEn:
        "Republish a clean feed URL or export for Google Shopping without rebuilding the file manually.",
      textEs:
        "Republica una URL de feed o una exportacion limpia para Google Shopping sin reconstruir manualmente el archivo.",
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

export default async function MerchantCenterErrorsLayout({
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

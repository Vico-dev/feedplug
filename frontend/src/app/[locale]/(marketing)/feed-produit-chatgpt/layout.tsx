import type { Metadata } from "next";
import {
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  createLPMetadata,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/feed-produit-chatgpt",
  fr: {
    title: "Feed produit ChatGPT | FeedPlug",
    description:
      "Preparez un feed produit structure pour ChatGPT et les assistants IA. Scorez vos fiches, enrichissez les attributs utiles et diffusez un catalogue exploitable par les LLM.",
    keywords: [
      "feed produit chatgpt",
      "chatgpt product feed",
      "chatgpt merchants feed",
      "product feed spec openai",
      "catalogue produits llm",
      "flux produits assistants ia",
    ],
  },
  en: {
    title: "ChatGPT product feed | FeedPlug",
    description:
      "Prepare a structured product feed for ChatGPT and AI assistants. Score listings, enrich key attributes, and distribute a catalog usable by LLMs.",
    keywords: [
      "chatgpt product feed",
      "chatgpt merchants feed",
      "openai product feed spec",
      "llm product catalog",
      "ai assistant product feed",
      "chatgpt shopping feed",
    ],
  },
  es: {
    title: "Feed de productos ChatGPT | FeedPlug",
    description:
      "Prepara un feed de productos estructurado para ChatGPT y asistentes de IA. Puntua tus fichas, mejora atributos clave y distribuye un catalogo util para los LLM.",
    keywords: [
      "feed de productos chatgpt",
      "chatgpt merchants feed",
      "product feed spec openai",
      "catalogo productos llm",
      "feed productos asistentes ia",
      "chatgpt shopping feed",
    ],
  },
  breadcrumbNameFr: "Feed produit ChatGPT",
  breadcrumbNameEn: "ChatGPT product feed",
  breadcrumbNameEs: "Feed de productos ChatGPT",
  howToNameFr: "Comment preparer un feed produit pour ChatGPT",
  howToNameEn: "How to prepare a product feed for ChatGPT",
  howToNameEs: "Como preparar un feed de productos para ChatGPT",
  howToDescFr:
    "Centralisez votre catalogue, scorez vos fiches, enrichissez les attributs utiles et exportez un feed produit exploitable par ChatGPT.",
  howToDescEn:
    "Centralize your catalog, score listings, enrich useful attributes, and export a product feed usable by ChatGPT.",
  howToDescEs:
    "Centraliza tu catalogo, puntua tus fichas, mejora atributos utiles y exporta un feed de productos util para ChatGPT.",
  steps: [
    {
      nameFr: "Centraliser le catalogue",
      nameEn: "Centralize the catalog",
      nameEs: "Centralizar el catalogo",
      textFr:
        "Importez Shopify ou vos autres sources pour reunir titres, descriptions, images, prix et disponibilites dans une base unique.",
      textEn:
        "Import Shopify or other sources to gather titles, descriptions, images, prices, and availability in one source of truth.",
      textEs:
        "Importa Shopify u otras fuentes para reunir titulos, descripciones, imagenes, precios y stock en una unica base.",
    },
    {
      nameFr: "Scorez les fiches produit",
      nameEn: "Score product listings",
      nameEs: "Puntuar las fichas",
      textFr:
        "Identifiez les fiches trop faibles pour la recherche conversationnelle grace au scoring produit et aux alertes de qualite.",
      textEn:
        "Identify listings that are too weak for conversational discovery with product scoring and quality alerts.",
      textEs:
        "Detecta fichas demasiado debiles para la busqueda conversacional con scoring de producto y alertas de calidad.",
    },
    {
      nameFr: "Enrichir les attributs utiles",
      nameEn: "Enrich useful attributes",
      nameEs: "Mejorar atributos utiles",
      textFr:
        "Renforcez marque, type de produit, variantes, prix, disponibilite, liens et images pour rendre le catalogue interpretable par les assistants IA.",
      textEn:
        "Strengthen brand, product type, variants, price, availability, links, and images to make the catalog interpretable by AI assistants.",
      textEs:
        "Refuerza marca, tipo de producto, variantes, precio, disponibilidad, enlaces e imagenes para que el catalogo sea interpretable por los asistentes de IA.",
    },
    {
      nameFr: "Exporter un feed pret pour les LLM",
      nameEn: "Export an LLM-ready feed",
      nameEs: "Exportar un feed listo para LLM",
      textFr:
        "Diffusez un export structure pour ChatGPT, Perplexity et les autres assistants IA sans reconstruire un flux a part.",
      textEn:
        "Publish a structured export for ChatGPT, Perplexity, and other AI assistants without rebuilding a separate feed.",
      textEs:
        "Publica una exportacion estructurada para ChatGPT, Perplexity y otros asistentes de IA sin reconstruir un feed aparte.",
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

export default async function ChatGPTFeedLayout({
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

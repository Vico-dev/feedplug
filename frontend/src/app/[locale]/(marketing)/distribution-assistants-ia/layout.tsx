import type { Metadata } from "next";
import {
  createLPMetadata,
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/distribution-assistants-ia",
  fr: {
    title: "Distribution vers ChatGPT, Perplexity et les assistants IA | FeedPlug",
    description:
      "Préparez vos flux produits pour les assistants IA — ChatGPT, Perplexity, Gemini. Commerce agentic, Product Feed Spec, visibilité dans la découverte produits par IA.",
    keywords: [
      "flux produits ChatGPT",
      "commerce agentic",
      "feed ChatGPT Shopping",
      "Product Feed Spec",
      "distribution assistants IA",
      "ChatGPT marchands",
    ],
  },
  en: {
    title: "Distribution to ChatGPT, Perplexity and AI assistants | FeedPlug",
    description:
      "Prepare your product feeds for AI assistants — ChatGPT, Perplexity, Gemini. Agentic commerce, Product Feed Spec, visibility in AI product discovery.",
    keywords: [
      "ChatGPT product feed",
      "agentic commerce",
      "ChatGPT Shopping feed",
      "Product Feed Spec",
      "AI assistant distribution",
      "ChatGPT merchants",
    ],
  },
  es: {
    title: "Distribucion en ChatGPT, Perplexity y asistentes de IA | FeedPlug",
    description:
      "Prepara tus feeds de productos para asistentes de IA: ChatGPT, Perplexity y Gemini. Agentic commerce, Product Feed Spec y visibilidad en el descubrimiento de productos por IA.",
    keywords: [
      "feed de productos ChatGPT",
      "agentic commerce",
      "feed ChatGPT Shopping",
      "Product Feed Spec",
      "distribucion asistentes IA",
      "comerciantes ChatGPT",
    ],
  },
  breadcrumbNameFr: "Distribution assistants IA",
  breadcrumbNameEn: "AI assistant distribution",
  breadcrumbNameEs: "Distribucion en asistentes de IA",
  howToNameFr: "Comment diffuser ses produits dans les assistants IA",
  howToNameEn: "How to distribute products in AI assistants",
  howToNameEs: "Como distribuir productos en asistentes de IA",
  howToDescFr:
    "Guide pour préparer vos flux produits à la distribution vers ChatGPT, Perplexity et Gemini — commerce agentic, Product Feed Spec.",
  howToDescEn:
    "Guide to prepare your product feeds for distribution to ChatGPT, Perplexity and Gemini — agentic commerce, Product Feed Spec.",
  howToDescEs:
    "Guia para preparar tus feeds de productos para distribuirlos en ChatGPT, Perplexity y Gemini: agentic commerce y Product Feed Spec.",
  steps: [
    {
      nameFr: "Centraliser votre catalogue",
      nameEn: "Centralize your catalog",
      nameEs: "Centraliza tu catalogo",
      textFr: "Importez vos produits dans FeedPlug. Un seul catalogue pour tous les canaux.",
      textEn: "Import your products into FeedPlug. One catalog for all channels.",
      textEs: "Importa tus productos en FeedPlug. Un solo catalogo para todos los canales.",
    },
    {
      nameFr: "Exporter un flux conforme",
      nameEn: "Export a compliant feed",
      nameEs: "Exporta un feed compatible",
      textFr: "Générez un export JSON/CSV compatible Product Feed Spec OpenAI.",
      textEn: "Generate a JSON/CSV export compatible with OpenAI Product Feed Spec.",
      textEs: "Genera una exportacion JSON o CSV compatible con OpenAI Product Feed Spec.",
    },
    {
      nameFr: "Postuler au programme marchands",
      nameEn: "Apply to merchant program",
      nameEs: "Solicita el programa para comercios",
      textFr: "Inscrivez-vous sur chatgpt.com/merchants et livrez votre flux.",
      textEn: "Sign up at chatgpt.com/merchants and deliver your feed.",
      textEs: "Registrate en chatgpt.com/merchants y entrega tu feed.",
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

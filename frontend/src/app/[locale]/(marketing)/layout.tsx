import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { isActiveLocale } from "@/i18n/locales";
import { seo } from "@/lib/seo";

const titles: Record<string, string> = {
  fr: "FeedPlug — Gestion flux produits simple | Google Shopping, Amazon, marketplaces",
  en: "FeedPlug — Simple product feed management | Google Shopping, Amazon, marketplaces",
  es: "FeedPlug — Gestión simple de feeds de productos | Google Shopping, Amazon, marketplaces",
};

const descriptions: Record<string, string> = {
  fr: "Solution feed produits simple et efficace : Google Merchant Center, Google Shopping, Meta, Amazon et marketplaces (Cdiscount, Mirakl, Fnac). Centralisez, optimisez et distribuez vos catalogues en un seul outil.",
  en: "Simple, effective product feed solution: Google Merchant Center, Google Shopping, Meta, Amazon and marketplaces. Centralize, optimize and distribute your catalogs in one tool.",
  es: "Solución simple y eficaz de feeds de productos: Google Merchant Center, Google Shopping, Meta, Amazon y marketplaces. Centraliza, optimiza y distribuye tus catálogos en una sola herramienta.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = isActiveLocale(locale) ? locale : routing.defaultLocale;
  const canonicalPath = lang === routing.defaultLocale ? "/" : `/${lang}`;
  const canonicalUrl = `${seo.marketingUrl}${canonicalPath}`;

  return {
    title: titles[lang] || titles.fr,
    description: descriptions[lang] || descriptions.fr,
    keywords: lang === "fr"
      ? ["flux produits", "feed produits", "Google Merchant Center", "Google Shopping", "marketplaces", "Amazon", "Cdiscount", "Mirakl", "gestion flux produits", "optimisation feed"]
      : lang === "es"
      ? ["feed productos", "gestión feed", "Google Merchant Center", "Google Shopping", "marketplaces", "Amazon", "optimización feed"]
      : ["product feed", "feed management", "Google Merchant Center", "Google Shopping", "marketplaces", "Amazon", "feed optimization"],
    openGraph: {
      title: titles[lang] || titles.fr,
      description: descriptions[lang] || descriptions.fr,
      url: canonicalUrl,
      siteName: "FeedPlug",
      type: "website",
      locale: lang === "fr" ? "fr_FR" : lang === "es" ? "es_ES" : "en_GB",
      alternateLocale: lang === "fr" ? "en_GB" : lang === "es" ? "fr_FR" : "fr_FR",
      images: [
        {
          url: seo.ogImage,
          width: seo.defaultImages.width,
          height: seo.defaultImages.height,
          alt: seo.defaultImages.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: titles[lang] || titles.fr,
      description: descriptions[lang] || descriptions.fr,
      images: [seo.ogImage],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        fr: `${seo.marketingUrl}/`,
        en: `${seo.marketingUrl}/en`,
        es: `${seo.marketingUrl}/es`,
        "x-default": `${seo.marketingUrl}/`,
      },
    },
    robots: { index: true, follow: true },
  };
}

const FAQ_ITEMS_FR = [
  { q: "Combien de temps faut-il pour être opérationnel ?", a: "La plupart des utilisateurs ont leur premier flux exporté en moins de 15 minutes : création de compte, connexion d'une source (Shopify ou fichier), synchronisation et export. Aucun développement ni intégration API nécessaire." },
  { q: "Quels canaux sont supportés ?", a: "Google Shopping (Merchant Center), Amazon, Meta (Facebook/Instagram), Cdiscount, Rakuten, Fnac, Mirakl et ChatGPT. Chaque canal reçoit un flux adapté à ses exigences — attributs, formats, catégories." },
  { q: "Ai-je besoin d'un développeur ou de compétences techniques ?", a: "Non. L'interface FeedPlug est conçue pour les équipes e-commerce et marketing. Pas d'API à intégrer, pas de code. Configuration guidée, export en un clic." },
  { q: "Comment fonctionne l'optimisation IA ?", a: "L'IA analyse vos fiches produits et génère des titres et descriptions optimisés pour chaque canal (mots-clés, longueur, format). Chaque plateforme reçoit un contenu unique — fini le duplicate content entre vos canaux." },
  { q: "Pourquoi FeedPlug plutôt qu'un tableur ou une solution maison ?", a: "Un tableur oblige à maintenir plusieurs fichiers, reformater pour chaque canal et gérer les erreurs manuellement. FeedPlug centralise un seul catalogue, adapte automatiquement les formats, calcule un score qualité et alerte en cas d'erreur." },
  { q: "Y a-t-il un essai gratuit ?", a: "Oui, 30 jours d'essai gratuit sans carte bancaire. Vous pouvez tester toutes les fonctionnalités : import, scoring, enrichissement IA et export multi-canal." },
];
const FAQ_ITEMS_EN = [
  { q: "How long does it take to get started?", a: "Most users have their first feed exported in under 15 minutes: account creation, source connection (Shopify or file), sync, and export. No development or API integration required." },
  { q: "Which channels are supported?", a: "Google Shopping (Merchant Center), Amazon, Meta (Facebook/Instagram), Cdiscount, Rakuten, Fnac, Mirakl, and ChatGPT. Each channel receives a feed adapted to its requirements." },
  { q: "Do I need a developer or technical skills?", a: "No. FeedPlug is designed for e-commerce and marketing teams. No API to integrate, no code. Guided setup, one-click export." },
  { q: "How does AI optimization work?", a: "AI analyzes your product listings and generates optimized titles and descriptions for each channel (keywords, length, format). Each platform receives unique content — no more duplicate content across channels." },
  { q: "Why FeedPlug instead of a spreadsheet or custom solution?", a: "Spreadsheets require maintaining multiple files, manual reformatting for each channel, and error handling. FeedPlug centralizes one catalog, adapts formats automatically, calculates quality scores, and alerts on errors." },
  { q: "Is there a free trial?", a: "Yes, 30-day free trial with no credit card required. You can test all features: import, scoring, AI enrichment, and multi-channel export." },
];
const FAQ_ITEMS_ES = [
  { q: "¿Cuánto tiempo se tarda en estar operativo?", a: "La mayoría de usuarios tienen su primer feed exportado en menos de 15 minutos: creación de cuenta, conexión de fuente (Shopify o archivo), sincronización y exportación. Sin desarrollo ni integración API." },
  { q: "¿Qué canales son compatibles?", a: "Google Shopping (Merchant Center), Amazon, Meta (Facebook/Instagram), Cdiscount, Rakuten, Fnac, Mirakl y ChatGPT. Cada canal recibe un feed adaptado a sus requisitos." },
  { q: "¿Necesito un desarrollador o conocimientos técnicos?", a: "No. FeedPlug está diseñado para equipos de e-commerce y marketing. Sin API que integrar, sin código. Configuración guiada, exportación en un clic." },
  { q: "¿Cómo funciona la optimización IA?", a: "La IA analiza tus fichas de producto y genera títulos y descripciones optimizados para cada canal (palabras clave, longitud, formato). Cada plataforma recibe contenido único." },
  { q: "¿Por qué FeedPlug en vez de una hoja de cálculo?", a: "Las hojas de cálculo requieren mantener múltiples archivos, reformatear para cada canal y gestionar errores manualmente. FeedPlug centraliza un catálogo, adapta formatos automáticamente y calcula puntuaciones de calidad." },
  { q: "¿Hay una prueba gratuita?", a: "Sí, 30 días de prueba gratuita sin tarjeta de crédito. Puedes probar todas las funciones: importación, scoring, enriquecimiento IA y exportación multi-canal." },
];

const ORG_DESCRIPTIONS: Record<string, string> = {
  fr: "Plateforme de gestion des flux produits : Google Shopping, Google Merchant Center, Meta, Amazon et marketplaces (Cdiscount, Mirakl, Fnac). Simple, efficace et data-centric.",
  en: "Product feed management platform: Google Shopping, Google Merchant Center, Meta, Amazon and marketplaces. Simple, effective and data-centric.",
  es: "Plataforma de gestión de feeds de productos: Google Shopping, Google Merchant Center, Meta, Amazon y marketplaces. Simple, eficaz y centrada en datos.",
};
const APP_DESCRIPTIONS: Record<string, string> = {
  fr: "FeedPlug est une plateforme de gestion des flux produits : centralisation catalogue, enrichissement IA, score de qualité, export vers Google Shopping, Amazon, Cdiscount, Rakuten et marketplaces.",
  en: "FeedPlug is a product feed management platform: catalog centralization, AI enrichment, quality scoring, export to Google Shopping, Amazon, Cdiscount, Rakuten and marketplaces.",
  es: "FeedPlug es una plataforma de gestión de feeds de productos: centralización de catálogo, enriquecimiento con IA, puntuación de calidad, exportación a Google Shopping, Amazon, Cdiscount, Rakuten y marketplaces.",
};

function JsonLdHome({ locale }: { locale: string }) {
  const lang = isActiveLocale(locale) ? locale : routing.defaultLocale;
  const faqItems = lang === "fr" ? FAQ_ITEMS_FR : lang === "es" ? FAQ_ITEMS_ES : FAQ_ITEMS_EN;
  const organization: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "FeedPlug",
    url: seo.marketingUrl,
    logo: seo.logo,
    description: ORG_DESCRIPTIONS[lang] ?? ORG_DESCRIPTIONS.en,
  };
  if (seo.socialUrls.length > 0) {
    organization.sameAs = seo.socialUrls;
  }
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "FeedPlug",
    url: seo.marketingUrl,
    inLanguage: lang === "fr" ? "fr" : lang === "es" ? "es" : "en",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", url: `${seo.marketingUrl}/docs` },
      "query-input": "required name=q",
    },
  };
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FeedPlug",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: seo.marketingUrl,
    description: APP_DESCRIPTIONS[lang] ?? APP_DESCRIPTIONS.en,
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organization),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApp),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(website),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqPage),
        }}
      />
    </>
  );
}

export default async function MarketingLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <JsonLdHome locale={locale} />
      {/* GoogleAnalytics est désormais monté globalement dans le root layout. */}
      {children}
    </>
  );
}

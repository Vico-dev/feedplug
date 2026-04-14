import type { Metadata } from "next";
import {
  createLPMetadata,
  createBreadcrumbJsonLd,
  createHowToJsonLd,
  type LPMetaConfig,
} from "@/lib/lp-metadata";

const config: LPMetaConfig = {
  path: "/diffusion-nouveaux-canaux",
  fr: {
    title: "Diffusion sur de nouveaux canaux et marchés | FeedPlug",
    description:
      "Déployez vos produits sur Amazon, Cdiscount, Fnac, l'Italie, l'Espagne… en 5 minutes. FeedPlug adapte votre flux à chaque canal et marché — sans développement.",
    keywords: [
      "diffusion multi-canal",
      "nouveaux marchés",
      "export catalogue",
      "marketplaces",
      "traduction flux",
      "expansion internationale",
    ],
  },
  en: {
    title: "Distribution to new channels and markets | FeedPlug",
    description:
      "Deploy your products to Amazon, Cdiscount, Fnac, Italy, Spain… in 5 minutes. FeedPlug adapts your feed to each channel and market — no development.",
    keywords: [
      "multi-channel distribution",
      "new markets",
      "catalog export",
      "marketplaces",
      "feed translation",
      "international expansion",
    ],
  },
  es: {
    title: "Distribucion en nuevos canales y mercados | FeedPlug",
    description:
      "Despliega tus productos en Amazon, Cdiscount, Fnac, Italia o Espana en 5 minutos. FeedPlug adapta tu feed a cada canal y mercado, sin desarrollo.",
    keywords: [
      "distribucion multicanal",
      "nuevos mercados",
      "exportacion catalogo",
      "marketplaces",
      "traduccion feed",
      "expansion internacional",
    ],
  },
  breadcrumbNameFr: "Diffusion nouveaux canaux et marchés",
  breadcrumbNameEn: "Distribution to new channels and markets",
  breadcrumbNameEs: "Distribucion en nuevos canales y mercados",
  howToNameFr: "Comment diffuser sur de nouveaux canaux et marchés",
  howToNameEn: "How to distribute to new channels and markets",
  howToNameEs: "Como distribuir en nuevos canales y mercados",
  howToDescFr:
    "Guide pour déployer votre catalogue sur de nouveaux canaux (Amazon, Cdiscount, Fnac) et marchés (Italie, Espagne, etc.) en 5 minutes avec FeedPlug.",
  howToDescEn:
    "Guide to deploy your catalog to new channels (Amazon, Cdiscount, Fnac) and markets (Italy, Spain, etc.) in 5 minutes with FeedPlug.",
  howToDescEs:
    "Guia para desplegar tu catalogo en nuevos canales (Amazon, Cdiscount, Fnac) y mercados (Italia, Espana, etc.) en 5 minutos con FeedPlug.",
  steps: [
    { nameFr: "Connecter votre catalogue", nameEn: "Connect your catalog", nameEs: "Conecta tu catalogo", textFr: "Importez depuis Shopify ou un fichier. FeedPlug centralise vos données produits.", textEn: "Import from Shopify or a file. FeedPlug centralizes your product data.", textEs: "Importa desde Shopify o desde un archivo. FeedPlug centraliza tus datos de producto." },
    { nameFr: "Choisir le canal ou le marché", nameEn: "Choose channel or market", nameEs: "Elige el canal o el mercado", textFr: "Sélectionnez le canal (Amazon, Cdiscount, Fnac) ou le marché cible (Italie, Espagne, Allemagne).", textEn: "Select the channel (Amazon, Cdiscount, Fnac) or target market (Italy, Spain, Germany).", textEs: "Selecciona el canal (Amazon, Cdiscount, Fnac) o el mercado objetivo (Italia, Espana, Alemania)." },
    { nameFr: "Adaptation automatique", nameEn: "Automatic adaptation", nameEs: "Adaptacion automatica", textFr: "FeedPlug adapte les attributs, formats et traduit à la volée si besoin.", textEn: "FeedPlug adapts attributes, formats and translates on the fly if needed.", textEs: "FeedPlug adapta atributos, formatos y traduce al instante si hace falta." },
    { nameFr: "Export et mise en ligne", nameEn: "Export and go-live", nameEs: "Exportacion y lanzamiento", textFr: "Exportez le flux prêt pour la plateforme. Mise à jour automatique.", textEn: "Export the feed ready for the platform. Automatic updates.", textEs: "Exporta el feed listo para la plataforma. Actualizaciones automaticas." },
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

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Link2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { createFaqJsonLd } from "@/lib/lp-metadata";
import { Link } from "@/i18n/routing";

type Locale = "fr" | "en" | "es";

type Step = {
  title: string;
  body: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

type PageCopy = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPanelTitle: string;
  heroPanelItems: string[];
  primaryCta: string;
  secondaryCta: string;
  trust: string[];
  painTitle: string;
  pains: string[];
  methodTitle: string;
  methodSubtitle: string;
  steps: Step[];
  benefitsTitle: string;
  benefits: string[];
  errorsTitle: string;
  errorsIntro: string;
  errors: string[];
  linksTitle: string;
  linksIntro: string;
  ctaTitle: string;
  ctaBody: string;
  footerHome: string;
  footerDocs: string;
  footerExport: string;
};

type ScreenCopy = {
  panelEyebrow: string;
  sourceLabel: string;
  sourceMeta: string;
  optimizeLabel: string;
  optimizeMeta: string;
  exportLabel: string;
  exportMeta: string;
  resultTitle: string;
  scoringInsight: string;
  scoreDelta: string;
  issuesDelta: string;
  readinessLabel: string;
  liveLabel: string;
};

type FAQCopy = {
  title: string;
  intro: string;
  items: FAQItem[];
};

type ProofCopy = {
  title: string;
  intro: string;
  detectTitle: string;
  detectIntro: string;
  detectItems: string[];
  beforeTitle: string;
  beforeItems: string[];
  afterTitle: string;
  afterItems: string[];
  gainsTitle: string;
  gains: string[];
};

const COPY: Record<Locale, PageCopy> = {
  fr: {
    heroEyebrow: "Google Shopping + Shopify",
    heroTitle: "Optimisez votre flux Google Shopping depuis Shopify",
    heroSubtitle:
      "Connectez Shopify, scorez chaque fiche produit, corrigez les erreurs Google Merchant Center et exportez un flux conforme sans refaire vos fiches a la main.",
    heroPanelTitle: "Pipeline FeedPlug",
    heroPanelItems: [
      "Catalogue Shopify synchronise en continu",
      "Priorisation des fiches bloquees ou faibles",
      "Enrichissement titres, descriptions et attributs",
      "Export Google Shopping pret pour Merchant Center",
    ],
    primaryCta: "Demander une demo",
    secondaryCta: "Voir le guide export",
    trust: ["Shopify comme source unique", "Scoring produit 0-100", "Conformite Merchant Center"],
    painTitle: "Les blocages frequents entre Shopify et Google Shopping",
    pains: [
      "Shopify seul ne corrige pas les problemes de conformite Merchant Center.",
      "Les titres, descriptions, GTIN, categories et images restent souvent incomplets pour Google Shopping.",
      "Les erreurs GMC bloquent la diffusion et consomment du temps cote e-commerce ou acquisition.",
      "Quand le catalogue bouge souvent, les exports manuels deviennent vite fragiles.",
    ],
    methodTitle: "La methode FeedPlug pour Shopify vers Google Shopping",
    methodSubtitle:
      "Une methode simple pour relier votre boutique Shopify a Google Shopping, prioriser les blocages et fiabiliser les mises a jour sans multiplier les fichiers.",
    steps: [
      {
        title: "Connectez Shopify comme source principale",
        body: "FeedPlug recupere votre catalogue, vos variantes, vos prix, vos images et vos disponibilites. Les donnees restent synchronisees au lieu d'etre recopiees dans plusieurs fichiers.",
      },
      {
        title: "Detectez les produits a risque pour Merchant Center",
        body: "Le score et les controles de conformite mettent en avant les fiches avec attributs manquants, titres faibles, descriptions pauvres ou images insuffisantes.",
      },
      {
        title: "Enrichissez les fiches avant diffusion",
        body: "Vous optimisez les titres, descriptions et attributs critiques pour Google Shopping. L'objectif n'est pas d'ajouter du texte partout, mais de corriger ce qui bloque vraiment la diffusion.",
      },
      {
        title: "Exportez un flux Google Shopping propre",
        body: "Vous publiez une URL de flux ou un export pret pour Google Merchant Center. Quand Shopify change, le flux suit sans devoir reconstruire un fichier a chaque mise a jour.",
      },
    ],
    benefitsTitle: "Ce que FeedPlug vous apporte concretement",
    benefits: [
      "FeedPlug relie Shopify et Google Shopping sans imposer un workflow technique lourd.",
      "Les erreurs Google Merchant Center deviennent actionnables au niveau produit.",
      "Le catalogue Shopify sert de base unique pour Google Shopping et les autres canaux.",
      "Le gain principal est la reduction des rejets et du temps passe a maintenir le flux.",
    ],
    errorsTitle: "Les erreurs Google Merchant Center les plus frequentes",
    errorsIntro:
      "Si votre catalogue Shopify alimente Google Shopping, ce sont souvent ces points qui freinent la diffusion ou la performance.",
    errors: [
      "GTIN, MPN ou marque manquants",
      "Titre produit trop faible ou peu descriptif",
      "Description insuffisante pour Google Shopping",
      "Image non conforme ou de qualite trop faible",
      "Categorie Google Product Category mal renseignee",
      "Disponibilite, prix ou variantes mal synchronises depuis Shopify",
    ],
    linksTitle: "Pour aller plus loin",
    linksIntro:
      "Retrouvez les autres pages utiles pour connecter vos canaux, optimiser votre flux Google Shopping et comprendre vos exports.",
    ctaTitle: "Besoin d'un flux Shopify propre pour Google Shopping ?",
    ctaBody:
      "Demandez une demo FeedPlug, ou consultez le guide d'export pour voir comment brancher Merchant Center proprement.",
    footerHome: "Accueil",
    footerDocs: "Documentation",
    footerExport: "Guide export",
  },
  en: {
    heroEyebrow: "Google Shopping + Shopify",
    heroTitle: "Optimize your Google Shopping feed from Shopify",
    heroSubtitle:
      "Connect Shopify, score every product listing, fix Google Merchant Center errors, and export a compliant feed without rebuilding product data manually.",
    heroPanelTitle: "FeedPlug workflow",
    heroPanelItems: [
      "Shopify catalog synced continuously",
      "Prioritized blocked or weak listings",
      "Titles, descriptions, and attributes enriched",
      "Google Shopping export ready for Merchant Center",
    ],
    primaryCta: "Request a demo",
    secondaryCta: "View export guide",
    trust: ["Shopify as single source", "Product scoring 0-100", "Merchant Center compliance"],
    painTitle: "Common blockers between Shopify and Google Shopping",
    pains: [
      "Shopify alone does not fix Merchant Center compliance issues.",
      "Titles, descriptions, GTINs, categories, and images are often incomplete for Google Shopping.",
      "GMC errors block distribution and waste time for e-commerce or acquisition teams.",
      "When the catalog changes often, manual exports become fragile very quickly.",
    ],
    methodTitle: "The FeedPlug method for Shopify to Google Shopping",
    methodSubtitle:
      "A single workflow to connect your Shopify store to Google Shopping, prioritize blockers, and make updates repeatable without multiplying spreadsheets.",
    steps: [
      {
        title: "Connect Shopify as your primary source",
        body: "FeedPlug pulls your catalog, variants, prices, images, and availability. Data stays synchronized instead of being duplicated across multiple files.",
      },
      {
        title: "Detect Merchant Center blockers",
        body: "Quality scoring and compliance checks highlight listings with missing attributes, weak titles, poor descriptions, or insufficient images.",
      },
      {
        title: "Enrich listings before distribution",
        body: "You optimize titles, descriptions, and critical attributes for Google Shopping. The goal is not to add content everywhere, but to fix what really blocks distribution.",
      },
      {
        title: "Export a clean Google Shopping feed",
        body: "You publish a feed URL or export ready for Google Merchant Center. When Shopify changes, the feed stays current without rebuilding files manually.",
      },
    ],
    benefitsTitle: "What FeedPlug helps you improve",
    benefits: [
      "FeedPlug connects Shopify and Google Shopping without a heavy technical workflow.",
      "Google Merchant Center errors become actionable at the product level.",
      "Your Shopify catalog becomes the single source for Google Shopping and other channels.",
      "The main gain is fewer rejections and less time spent maintaining the feed.",
    ],
    errorsTitle: "Most common Merchant Center issues",
    errorsIntro:
      "If your Shopify catalog powers Google Shopping, these are often the issues that slow down distribution or hurt performance.",
    errors: [
      "Missing GTIN, MPN, or brand",
      "Product titles that are too weak or not descriptive enough",
      "Descriptions that are insufficient for Google Shopping",
      "Images that are non-compliant or too low quality",
      "Incorrect Google Product Category mapping",
      "Availability, pricing, or variants not synchronized correctly from Shopify",
    ],
    linksTitle: "Explore related pages",
    linksIntro:
      "Use these pages to connect channels, optimize your Google Shopping feed, and understand how your exports work.",
    ctaTitle: "Need a cleaner Shopify feed for Google Shopping?",
    ctaBody:
      "Request a FeedPlug demo or review the export guide to see how to connect Merchant Center properly.",
    footerHome: "Home",
    footerDocs: "Documentation",
    footerExport: "Export guide",
  },
  es: {
    heroEyebrow: "Google Shopping + Shopify",
    heroTitle: "Optimiza tu feed de Google Shopping desde Shopify",
    heroSubtitle:
      "Conecta Shopify, puntua cada ficha de producto, corrige errores de Google Merchant Center y exporta un feed compatible sin rehacer tus fichas manualmente.",
    heroPanelTitle: "Flujo FeedPlug",
    heroPanelItems: [
      "Catalogo Shopify sincronizado",
      "Fichas bloqueadas o debiles priorizadas",
      "Titulos, descripciones y atributos mejorados",
      "Exportacion lista para Merchant Center",
    ],
    primaryCta: "Solicitar una demo",
    secondaryCta: "Ver guia de exportacion",
    trust: ["Shopify como fuente unica", "Scoring de producto 0-100", "Cumplimiento Merchant Center"],
    painTitle: "Bloqueos frecuentes entre Shopify y Google Shopping",
    pains: [
      "Shopify por si solo no corrige los problemas de cumplimiento de Merchant Center.",
      "Titulos, descripciones, GTIN, categorias e imagenes suelen quedar incompletos para Google Shopping.",
      "Los errores de GMC bloquean la difusion y consumen tiempo del equipo e-commerce o de adquisicion.",
      "Cuando el catalogo cambia a menudo, las exportaciones manuales se vuelven fragiles rapidamente.",
    ],
    methodTitle: "El metodo FeedPlug para pasar de Shopify a Google Shopping",
    methodSubtitle:
      "Un flujo de trabajo unico para conectar tu tienda Shopify con Google Shopping, priorizar bloqueos y mantener el catalogo actualizado sin multiplicar archivos.",
    steps: [
      {
        title: "Conecta Shopify como fuente principal",
        body: "FeedPlug recupera tu catalogo, variantes, precios, imagenes y stock. Los datos permanecen sincronizados en lugar de duplicarse en varios archivos.",
      },
      {
        title: "Detecta bloqueos de Merchant Center",
        body: "La puntuacion de calidad y los controles de cumplimiento destacan fichas con atributos incompletos, titulos debiles, descripciones pobres o imagenes insuficientes.",
      },
      {
        title: "Mejora las fichas antes de publicar",
        body: "Optimizas titulos, descripciones y atributos criticos para Google Shopping. El objetivo no es anadir texto en todas partes, sino corregir lo que realmente bloquea la difusion.",
      },
      {
        title: "Exporta un feed limpio para Google Shopping",
        body: "Publicas una URL de feed o una exportacion lista para Google Merchant Center. Cuando Shopify cambia, el feed sigue actualizado sin reconstruir archivos manualmente.",
      },
    ],
    benefitsTitle: "Lo que FeedPlug te aporta en la practica",
    benefits: [
      "FeedPlug conecta Shopify y Google Shopping sin imponer un proceso tecnico pesado.",
      "Los errores de Google Merchant Center se vuelven accionables a nivel de producto.",
      "Tu catalogo de Shopify se convierte en la base unica para Google Shopping y otros canales.",
      "La ganancia principal es reducir rechazos y tiempo de mantenimiento del feed.",
    ],
    errorsTitle: "Errores de Merchant Center mas frecuentes",
    errorsIntro:
      "Si tu catalogo de Shopify alimenta Google Shopping, estos son los puntos que suelen frenar la difusion o el rendimiento.",
    errors: [
      "GTIN, MPN o marca ausentes",
      "Titulo de producto demasiado debil o poco descriptivo",
      "Descripcion insuficiente para Google Shopping",
      "Imagen no compatible o de calidad demasiado baja",
      "Google Product Category mal configurada",
      "Stock, precio o variantes mal sincronizados desde Shopify",
    ],
    linksTitle: "Para seguir avanzando",
    linksIntro:
      "Consulta estas paginas para conectar canales, optimizar tu feed de Google Shopping y entender mejor tus exportaciones.",
    ctaTitle: "Necesitas un feed de Shopify mas limpio para Google Shopping?",
    ctaBody:
      "Solicita una demo de FeedPlug o consulta la guia de exportacion para ver como conectar Merchant Center correctamente.",
    footerHome: "Inicio",
    footerDocs: "Documentacion",
    footerExport: "Guia de exportacion",
  },
};

const STEP_ICONS = [Link2, ShieldCheck, Settings2, RefreshCw];

const SCREEN_COPY: Record<Locale, ScreenCopy> = {
  fr: {
    panelEyebrow: "De Shopify vers Google Shopping",
    sourceLabel: "Catalogue Shopify synchronise",
    sourceMeta: "Variantes, prix, images et disponibilites centralises.",
    optimizeLabel: "FeedPlug corrige et enrichit",
    optimizeMeta: "Scoring produit, titres, GTIN, categories et attributs prioritaires.",
    exportLabel: "Flux Google Shopping propre",
    exportMeta: "Export XML conforme pour Merchant Center.",
    resultTitle: "Le gain visible en un coup d'oeil",
    scoringInsight: "Scoring produit fiche par fiche pour prioriser les corrections",
    scoreDelta: "+29 pts sur le score catalogue",
    issuesDelta: "12 blocages Merchant Center traites",
    readinessLabel: "Pret pour Merchant Center",
    liveLabel: "Flux live",
  },
  en: {
    panelEyebrow: "From Shopify to Google Shopping",
    sourceLabel: "Shopify catalog synced",
    sourceMeta: "Variants, prices, images, and availability centralized.",
    optimizeLabel: "FeedPlug fixes and enriches",
    optimizeMeta: "Product scoring, titles, GTINs, categories, and priority attributes improved.",
    exportLabel: "Clean Google Shopping feed",
    exportMeta: "Compliant XML export ready for Merchant Center.",
    resultTitle: "Visible value at a glance",
    scoringInsight: "Product-level scoring to prioritize what to fix first",
    scoreDelta: "+29 pts on catalog score",
    issuesDelta: "12 Merchant Center blockers handled",
    readinessLabel: "Merchant Center ready",
    liveLabel: "Live feed",
  },
  es: {
    panelEyebrow: "De Shopify a Google Shopping",
    sourceLabel: "Catalogo Shopify sincronizado",
    sourceMeta: "Variantes, precios, imagenes y stock centralizados.",
    optimizeLabel: "FeedPlug corrige y enriquece",
    optimizeMeta: "Scoring de producto, titulos, GTIN, categorias y atributos prioritarios optimizados.",
    exportLabel: "Feed limpio para Google Shopping",
    exportMeta: "Exportacion XML compatible con Merchant Center.",
    resultTitle: "Valor visible de inmediato",
    scoringInsight: "Scoring por ficha para priorizar que corregir primero",
    scoreDelta: "+29 pts en el score del catalogo",
    issuesDelta: "12 bloqueos de Merchant Center tratados",
    readinessLabel: "Listo para Merchant Center",
    liveLabel: "Feed live",
  },
};

const FAQ_COPY: Record<Locale, FAQCopy> = {
  fr: {
    title: "Questions frequentes sur Shopify et Google Shopping",
    intro:
      "Ces questions reviennent souvent quand une boutique Shopify veut fiabiliser son flux Google Shopping et reduire les rejets Merchant Center.",
    items: [
      {
        question: "Comment connecter Shopify a Google Merchant Center sans multiplier les fichiers ?",
        answer:
          "FeedPlug garde Shopify comme source principale, centralise les attributs utiles et publie un export Google Shopping qui suit les mises a jour du catalogue.",
      },
      {
        question: "Pourquoi des produits Shopify sont-ils rejetes dans Google Merchant Center ?",
        answer:
          "Les rejets viennent souvent de GTIN, marque, categories, titres, images ou disponibilites incomplets. Le scoring produit aide a reperer les fiches qui bloquent vraiment la diffusion.",
      },
      {
        question: "A quoi sert le scoring produit pour Google Shopping ?",
        answer:
          "Il permet de prioriser les fiches a corriger au lieu de relire tout le catalogue. Vous voyez rapidement quels produits sont trop faibles ou trop risques pour Merchant Center.",
      },
      {
        question: "Peut-on reutiliser le meme catalogue Shopify pour d'autres canaux ?",
        answer:
          "Oui. Une fois le catalogue structure et enrichi, la meme base peut servir Google Shopping, Amazon ou d'autres canaux sans recreer un flux manuel a chaque fois.",
      },
    ],
  },
  en: {
    title: "Frequently asked questions about Shopify and Google Shopping",
    intro:
      "These questions come up often when a Shopify store wants a more reliable Google Shopping feed and fewer Merchant Center rejections.",
    items: [
      {
        question: "How do you connect Shopify to Google Merchant Center without multiplying files?",
        answer:
          "FeedPlug keeps Shopify as the main source, centralizes the useful attributes, and publishes a Google Shopping export that follows catalog updates automatically.",
      },
      {
        question: "Why are Shopify products rejected in Google Merchant Center?",
        answer:
          "Rejections often come from incomplete GTINs, brands, categories, titles, images, or availability. Product scoring helps surface the listings that truly block distribution.",
      },
      {
        question: "What is product scoring useful for in Google Shopping?",
        answer:
          "It helps you prioritize what to fix instead of reviewing the full catalog manually. You quickly see which listings are too weak or too risky for Merchant Center.",
      },
      {
        question: "Can the same Shopify catalog be reused for other channels?",
        answer:
          "Yes. Once the catalog is structured and enriched, the same base can support Google Shopping, Amazon, and other channels without rebuilding a manual feed each time.",
      },
    ],
  },
  es: {
    title: "Preguntas frecuentes sobre Shopify y Google Shopping",
    intro:
      "Estas preguntas aparecen a menudo cuando una tienda Shopify quiere hacer mas fiable su feed de Google Shopping y reducir rechazos en Merchant Center.",
    items: [
      {
        question: "Como conectar Shopify con Google Merchant Center sin multiplicar archivos?",
        answer:
          "FeedPlug mantiene Shopify como fuente principal, centraliza los atributos utiles y publica una exportacion de Google Shopping que sigue las actualizaciones del catalogo.",
      },
      {
        question: "Por que se rechazan productos Shopify en Google Merchant Center?",
        answer:
          "Los rechazos suelen venir de GTIN, marca, categorias, titulos, imagenes o stock incompletos. El scoring de producto ayuda a detectar las fichas que realmente bloquean la difusion.",
      },
      {
        question: "Para que sirve el scoring de producto en Google Shopping?",
        answer:
          "Permite priorizar que corregir en lugar de revisar todo el catalogo manualmente. Ves rapido que fichas son demasiado debiles o arriesgadas para Merchant Center.",
      },
      {
        question: "Se puede reutilizar el mismo catalogo Shopify para otros canales?",
        answer:
          "Si. Una vez estructurado y enriquecido, el mismo catalogo puede servir para Google Shopping, Amazon y otros canales sin rehacer un feed manual cada vez.",
      },
    ],
  },
};

const PROOF_COPY: Record<Locale, ProofCopy> = {
  fr: {
    title: "Exemple concret sur un produit Shopify avant diffusion",
    intro:
      "Voici le type de fiche que FeedPlug aide a fiabiliser avant export vers Google Shopping et Google Merchant Center.",
    detectTitle: "Ce que FeedPlug remonte avant export",
    detectIntro:
      "Sur une fiche Shopify encore trop faible pour Google Shopping, FeedPlug fait remonter les points qui bloquent la conformite ou la diffusion.",
    detectItems: [
      "Titre trop court pour Google Shopping",
      "GTIN manquant sur la variante principale",
      "Categorie Google Product Category non renseignee",
      "Image exploitable sur Shopify, mais trop faible pour Merchant Center",
    ],
    beforeTitle: "Avant",
    beforeItems: [
      "Titre: Runner Air",
      "Marque absente du titre",
      "GTIN manquant",
      "Categorie Google vide",
      "Score produit: 46/100",
    ],
    afterTitle: "Apres priorisation FeedPlug",
    afterItems: [
      "Titre enrichi avec marque, type et attributs utiles",
      "GTIN renseigne au bon niveau variante",
      "Categorie Google clarifiee",
      "Produits bloques ou faibles visibles fiche par fiche",
      "Score produit: 81/100",
    ],
    gainsTitle: "Ce que l'equipe gagne",
    gains: [
      "Une lecture immediate des produits Shopify a corriger",
      "Moins d'allers-retours manuels entre Shopify et Merchant Center",
      "Un flux Google Shopping plus propre a republier et maintenir",
    ],
  },
  en: {
    title: "Concrete example on a Shopify product before distribution",
    intro:
      "This is the kind of listing FeedPlug helps stabilize before exporting to Google Shopping and Google Merchant Center.",
    detectTitle: "What FeedPlug surfaces before export",
    detectIntro:
      "On a Shopify listing that is still too weak for Google Shopping, FeedPlug highlights the points that block compliance or distribution.",
    detectItems: [
      "Title too short for Google Shopping",
      "GTIN missing on the main variant",
      "Google Product Category not mapped",
      "Image usable on Shopify but too weak for Merchant Center",
    ],
    beforeTitle: "Before",
    beforeItems: [
      "Title: Runner Air",
      "Brand missing from title",
      "GTIN missing",
      "Google category empty",
      "Product score: 46/100",
    ],
    afterTitle: "After FeedPlug prioritization",
    afterItems: [
      "Title enriched with brand, type, and useful attributes",
      "GTIN completed at the right variant level",
      "Google category clarified",
      "Blocked or weak products visible listing by listing",
      "Product score: 81/100",
    ],
    gainsTitle: "What the team gains",
    gains: [
      "An immediate view of which Shopify products need fixing",
      "Less manual back and forth between Shopify and Merchant Center",
      "A cleaner Google Shopping feed to republish and maintain",
    ],
  },
  es: {
    title: "Ejemplo concreto sobre un producto Shopify antes de publicar",
    intro:
      "Este es el tipo de ficha que FeedPlug ayuda a estabilizar antes de exportar a Google Shopping y Google Merchant Center.",
    detectTitle: "Lo que FeedPlug detecta antes de exportar",
    detectIntro:
      "En una ficha Shopify todavia demasiado debil para Google Shopping, FeedPlug destaca los puntos que bloquean el cumplimiento o la difusion.",
    detectItems: [
      "Titulo demasiado corto para Google Shopping",
      "GTIN ausente en la variante principal",
      "Google Product Category sin mapear",
      "Imagen usable en Shopify pero demasiado debil para Merchant Center",
    ],
    beforeTitle: "Antes",
    beforeItems: [
      "Titulo: Runner Air",
      "Marca ausente en el titulo",
      "GTIN ausente",
      "Categoria Google vacia",
      "Scoring de producto: 46/100",
    ],
    afterTitle: "Despues de la priorizacion FeedPlug",
    afterItems: [
      "Titulo enriquecido con marca, tipo y atributos utiles",
      "GTIN completado al nivel correcto de variante",
      "Categoria Google aclarada",
      "Productos bloqueados o debiles visibles ficha por ficha",
      "Scoring de producto: 81/100",
    ],
    gainsTitle: "Lo que gana el equipo",
    gains: [
      "Una vision inmediata de que productos Shopify corregir",
      "Menos idas y vueltas manuales entre Shopify y Merchant Center",
      "Un feed de Google Shopping mas limpio para republicar y mantener",
    ],
  },
};

function getCopy(locale: string): PageCopy {
  if (locale === "fr" || locale === "en" || locale === "es") {
    return COPY[locale];
  }
  return COPY.en;
}

function getScreenCopy(locale: string): ScreenCopy {
  if (locale === "fr" || locale === "en" || locale === "es") {
    return SCREEN_COPY[locale];
  }
  return SCREEN_COPY.en;
}

function getFaqCopy(locale: string): FAQCopy {
  if (locale === "fr" || locale === "en" || locale === "es") {
    return FAQ_COPY[locale];
  }
  return FAQ_COPY.en;
}

function getProofCopy(locale: string): ProofCopy {
  if (locale === "fr" || locale === "en" || locale === "es") {
    return PROOF_COPY[locale];
  }
  return PROOF_COPY.en;
}

export default async function ShopifyGoogleShoppingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = getCopy(locale);
  const screenCopy = getScreenCopy(locale);
  const faqCopy = getFaqCopy(locale);
  const proofCopy = getProofCopy(locale);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "#111827" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .shopify-lp-shell { font-family: var(--font-geist-sans), sans-serif; }
            .shopify-lp-fade {
              animation: shopifyLpFadeUp .7s ease-out forwards;
            }
            .shopify-lp-delay-1 { animation-delay: .08s; opacity: 0; }
            .shopify-lp-delay-2 { animation-delay: .16s; opacity: 0; }
            .shopify-lp-delay-3 { animation-delay: .24s; opacity: 0; }
            .shopify-lp-card {
              transition: transform .2s ease, box-shadow .25s ease, border-color .2s ease;
            }
	            .shopify-lp-card:hover {
	              transform: translateY(-3px);
	              box-shadow: 0 16px 48px rgba(15, 23, 42, 0.08);
	              border-color: #cbd5e1;
	            }
	            .shopify-lp-dashboard {
	              position: relative;
	            }
	            .shopify-lp-dashboard-shell {
	              position: relative;
	              overflow: hidden;
	              border-radius: 28px;
	              background:
	                linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.94) 100%);
	              border: 1px solid rgba(148,163,184,0.18);
	              box-shadow:
	                0 24px 60px rgba(2, 6, 23, 0.34),
	                inset 0 1px 0 rgba(255,255,255,0.08);
	            }
	            .shopify-lp-dashboard-shell::before {
	              content: "";
	              position: absolute;
	              inset: -30% 35% auto -10%;
	              height: 260px;
	              background: radial-gradient(circle, rgba(59,130,246,0.35) 0%, rgba(59,130,246,0) 70%);
	              pointer-events: none;
	            }
	            .shopify-lp-dashboard-shell::after {
	              content: "";
	              position: absolute;
	              inset: auto -14% -24% 44%;
	              width: 260px;
	              height: 260px;
	              background: radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0) 72%);
	              pointer-events: none;
	            }
	            .shopify-lp-dashboard-pulse {
	              animation: shopifyLpPulse 1.9s ease-in-out infinite;
	            }
	            .shopify-lp-dashboard-gridline {
	              position: absolute;
	              inset: 0;
	              background-image:
	                linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px),
	                linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px);
	              background-size: 100% 54px, 54px 100%;
	              mask-image: linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0));
	              pointer-events: none;
	            }
	            .shopify-lp-dashboard-glow {
	              position: absolute;
	              border-radius: 999px;
	              filter: blur(24px);
	              pointer-events: none;
	            }
	            .shopify-lp-showcase-grid {
	              grid-template-columns: minmax(0, 1fr);
	            }
	            .shopify-lp-showcase-flow {
	              display: grid;
	              gap: 12px;
	            }
	            @keyframes shopifyLpFadeUp {
	              from { opacity: 0; transform: translateY(18px); }
	              to { opacity: 1; transform: translateY(0); }
	            }
	            @keyframes shopifyLpPulse {
	              0%, 100% { transform: scale(1); opacity: 1; }
	              50% { transform: scale(1.16); opacity: .78; }
	            }
	            @media (max-width: 920px) {
	              .shopify-lp-hero-grid { grid-template-columns: 1fr !important; }
	              .shopify-lp-two-col { grid-template-columns: 1fr !important; }
	              .shopify-lp-hero-aside { max-width: 100% !important; }
	            }
	            @media (max-width: 768px) {
	              .shopify-lp-section { padding-left: 24px !important; padding-right: 24px !important; }
	              .shopify-lp-hero { padding: 112px 24px 72px !important; }
	              .shopify-lp-grid-4 { grid-template-columns: 1fr !important; }
	              .shopify-lp-grid-3 { grid-template-columns: 1fr !important; }
	              .shopify-lp-showcase-result { grid-template-columns: 1fr !important; }
	            }
            @media (max-width: 480px) {
              .shopify-lp-hero { padding: 96px 20px 56px !important; }
              .shopify-lp-section { padding-left: 20px !important; padding-right: 20px !important; }
            }
          `,
        }}
      />
      {createFaqJsonLd(faqCopy.items)}

      <div className="shopify-lp-shell">
        <MarketingHeader />

	        <section
	          className="shopify-lp-hero shopify-lp-section"
	          style={{
	            position: "relative",
	            padding: "120px 48px 88px",
	            background:
	              "radial-gradient(circle at top right, rgba(59,130,246,0.18), transparent 28%), radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 24%), #111827",
	            overflow: "hidden",
	          }}
	        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(17,24,39,0) 28%, rgba(17,24,39,0.16) 100%)",
            }}
          />

          <div
            className="shopify-lp-hero-grid"
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: 1180,
	              margin: "0 auto",
	              display: "grid",
	              gridTemplateColumns: "minmax(0, 1fr) minmax(420px, 520px)",
	              gap: 48,
	              alignItems: "center",
	            }}
	          >
	            <div>
              <div
                className="shopify-lp-fade"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.82)",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 24,
                }}
              >
                <ShoppingBag style={{ width: 16, height: 16 }} />
                {copy.heroEyebrow}
              </div>

              <h1
                className="shopify-lp-fade shopify-lp-delay-1"
                style={{
                  margin: "0 0 22px",
                  maxWidth: 760,
                  fontSize: "clamp(40px, 5vw, 62px)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.04em",
                  fontWeight: 650,
                  color: "#ffffff",
                }}
              >
                {copy.heroTitle}
              </h1>

              <p
                className="shopify-lp-fade shopify-lp-delay-2"
                style={{
                  margin: "0 0 34px",
                  maxWidth: 670,
                  fontSize: 18,
                  lineHeight: 1.72,
                  color: "rgba(255,255,255,0.62)",
                }}
              >
                {copy.heroSubtitle}
              </p>

              <div
                className="shopify-lp-fade shopify-lp-delay-3"
                style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 }}
              >
                <Link href="/demo?source=use_case_demo" style={primaryHeroCtaStyle}>
                  {copy.primaryCta}
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </Link>
                <Link href="/docs/export" style={secondaryHeroCtaStyle}>
                  {copy.secondaryCta}
                </Link>
              </div>

              <div
                className="shopify-lp-fade shopify-lp-delay-3"
                style={{ display: "flex", flexWrap: "wrap", gap: 12 }}
              >
                {copy.trust.map((item) => (
                  <span
                    key={item}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 14px",
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.76)",
                      fontSize: 14,
                    }}
                  >
                    <CheckCircle2 style={{ width: 14, height: 14, color: "#34d399" }} />
                    {item}
                  </span>
                ))}
              </div>
            </div>

	            <aside
		              className="shopify-lp-fade shopify-lp-delay-3 shopify-lp-hero-aside"
		              style={{ position: "relative", maxWidth: 520, width: "100%", marginLeft: "auto" }}
		            >
		              <FeedPlugShowcase copy={screenCopy} />
		            </aside>
	          </div>
	        </section>

        <section className="shopify-lp-section" style={{ padding: "88px 48px", backgroundColor: "#ffffff" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 38px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                margin: "0 0 34px",
                color: "#111827",
              }}
            >
              {copy.painTitle}
            </h2>

            <div
              className="shopify-lp-grid-4"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 18,
              }}
            >
              {copy.pains.map((item) => (
                <div
                  key={item}
                  className="shopify-lp-card"
                  style={{
                    padding: 24,
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <AlertCircle style={{ width: 18, height: 18, color: "#dc2626", marginBottom: 14 }} />
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#475569" }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="shopify-lp-section"
          style={{
            padding: "88px 48px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #e5e7eb",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 38px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                margin: "0 0 14px",
                color: "#111827",
              }}
            >
              {copy.methodTitle}
            </h2>
            <p
              style={{
                maxWidth: 760,
                margin: "0 0 34px",
                fontSize: 17,
                lineHeight: 1.72,
                color: "#64748b",
              }}
            >
              {copy.methodSubtitle}
            </p>

            <div
              className="shopify-lp-grid-4"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 20,
              }}
            >
              {copy.steps.map((step, index) => {
                const Icon = STEP_ICONS[index];

                return (
                  <div
                    key={step.title}
                    className="shopify-lp-card"
                    style={{
                      padding: 26,
                      borderRadius: 16,
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: "#e0e7ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 18,
                      }}
                    >
                      <Icon style={{ width: 20, height: 20, color: "#1d4ed8" }} />
                    </div>
                    <h3
                      style={{
                        margin: "0 0 10px",
                        fontSize: 18,
                        lineHeight: 1.38,
                        fontWeight: 650,
                        color: "#0f172a",
                      }}
                    >
                      {step.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.72, color: "#64748b" }}>{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="shopify-lp-section" style={{ padding: "88px 48px", backgroundColor: "#ffffff" }}>
          <div
            className="shopify-lp-two-col"
            style={{
              maxWidth: 1080,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.95fr)",
              gap: 28,
            }}
          >
            <div
              className="shopify-lp-card"
              style={{
                padding: 30,
                borderRadius: 18,
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                }}
              >
                <Sparkles style={{ width: 22, height: 22, color: "#111827" }} />
              </div>
              <h2
                style={{
                  margin: "0 0 18px",
                  fontSize: "clamp(24px, 3vw, 32px)",
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  color: "#111827",
                }}
              >
                {copy.benefitsTitle}
              </h2>
              <div style={{ display: "grid", gap: 14 }}>
                {copy.benefits.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <CheckCircle2 style={{ width: 18, height: 18, color: "#16a34a", flexShrink: 0, marginTop: 3 }} />
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.72, color: "#475569" }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="shopify-lp-card"
              style={{
                padding: 30,
                borderRadius: 18,
                backgroundColor: "#111827",
                color: "#ffffff",
                border: "1px solid #0f172a",
              }}
            >
              <h2
                style={{
                  margin: "0 0 12px",
                  fontSize: "clamp(24px, 3vw, 32px)",
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                }}
              >
                {copy.errorsTitle}
              </h2>
              <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.72, color: "#cbd5e1" }}>
                {copy.errorsIntro}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10 }}>
                {copy.errors.map((item) => (
                  <li key={item} style={{ fontSize: 15, lineHeight: 1.72, color: "#ffffff" }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          className="shopify-lp-section"
          style={{
            padding: "88px 48px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #e5e7eb",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(28px, 4vw, 36px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "#111827",
              }}
            >
              {proofCopy.title}
            </h2>
            <p style={{ maxWidth: 760, margin: "0 0 24px", fontSize: 16, lineHeight: 1.72, color: "#64748b" }}>
              {proofCopy.intro}
            </p>

            <div
              className="shopify-lp-two-col"
              style={{
                maxWidth: 1080,
                margin: "0 auto",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.95fr)",
                gap: 28,
              }}
            >
              <div
                className="shopify-lp-card"
                style={{
                  padding: 30,
                  borderRadius: 18,
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    backgroundColor: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 18,
                  }}
                >
                  <AlertCircle style={{ width: 22, height: 22, color: "#2563eb" }} />
                </div>
                <h3
                  style={{
                    margin: "0 0 18px",
                    fontSize: "clamp(24px, 3vw, 32px)",
                    fontWeight: 600,
                    letterSpacing: "-0.03em",
                    color: "#111827",
                  }}
                >
                  {proofCopy.detectTitle}
                </h3>
                <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.72, color: "#64748b" }}>
                  {proofCopy.detectIntro}
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10 }}>
                  {proofCopy.detectItems.map((item) => (
                    <li key={item} style={{ fontSize: 15, lineHeight: 1.72, color: "#475569" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                <div
                  className="shopify-lp-card"
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#dc2626", marginBottom: 12 }}>
                    {proofCopy.beforeTitle}
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {proofCopy.beforeItems.map((item) => (
                      <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <AlertCircle style={{ width: 16, height: 16, color: "#dc2626", flexShrink: 0, marginTop: 4 }} />
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.72, color: "#475569" }}>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="shopify-lp-card"
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    backgroundColor: "#0f172a",
                    border: "1px solid #0f172a",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5eead4", marginBottom: 12 }}>
                    {proofCopy.afterTitle}
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {proofCopy.afterItems.map((item) => (
                      <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <CheckCircle2 style={{ width: 16, height: 16, color: "#34d399", flexShrink: 0, marginTop: 4 }} />
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.72, color: "#e2e8f0" }}>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="shopify-lp-grid-3"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 18,
                marginTop: 20,
              }}
            >
              {proofCopy.gains.map((item) => (
                <div
                  key={item}
                  className="shopify-lp-card"
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <CheckCircle2 style={{ width: 18, height: 18, color: "#16a34a", flexShrink: 0, marginTop: 4 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>
                        {proofCopy.gainsTitle}
                      </div>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.72, color: "#475569" }}>{item}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="shopify-lp-section"
          style={{
            padding: "88px 48px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(28px, 4vw, 36px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "#111827",
              }}
            >
              {copy.linksTitle}
            </h2>
            <p style={{ maxWidth: 760, margin: "0 0 24px", fontSize: 16, lineHeight: 1.72, color: "#64748b" }}>
              {copy.linksIntro}
            </p>

            <div
              className="shopify-lp-grid-3"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 18,
              }}
            >
              <Link href="/integrations" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/integrations</span>
                <span style={linkCardTextStyle}>Voir les canaux et integrations relies a votre catalogue.</span>
              </Link>
              <Link href="/optimiser-flux-google-shopping" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/optimiser-flux-google-shopping</span>
                <span style={linkCardTextStyle}>Revenir sur la page plus large dediee a Google Shopping.</span>
              </Link>
              <Link href="/docs/export" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/docs/export</span>
                <span style={linkCardTextStyle}>Consulter le detail des exports, du format et de Merchant Center.</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="shopify-lp-section" style={{ padding: "88px 48px", backgroundColor: "#ffffff" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(28px, 4vw, 36px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "#111827",
              }}
            >
              {faqCopy.title}
            </h2>
            <p style={{ maxWidth: 760, margin: "0 0 24px", fontSize: 16, lineHeight: 1.72, color: "#64748b" }}>
              {faqCopy.intro}
            </p>

            <div style={{ display: "grid", gap: 16 }}>
              {faqCopy.items.map((item) => (
                <div
                  key={item.question}
                  className="shopify-lp-card"
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <h3 style={{ margin: "0 0 10px", fontSize: 18, lineHeight: 1.45, fontWeight: 650, color: "#0f172a" }}>
                    {item.question}
                  </h3>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.72, color: "#64748b" }}>{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="shopify-lp-section"
          style={{
            padding: "104px 48px",
            backgroundColor: "#111827",
            borderTop: "1px solid #0f172a",
          }}
        >
          <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
            <h2
              style={{
                margin: "0 0 14px",
                fontSize: "clamp(30px, 4vw, 42px)",
                lineHeight: 1.12,
                letterSpacing: "-0.03em",
                fontWeight: 600,
                color: "#ffffff",
              }}
            >
              {copy.ctaTitle}
            </h2>
            <p style={{ margin: "0 0 30px", fontSize: 17, lineHeight: 1.72, color: "rgba(255,255,255,0.58)" }}>
              {copy.ctaBody}
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/demo?source=use_case_demo" style={primaryDarkCtaStyle}>
                {copy.primaryCta}
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
              <Link href="/docs/export" style={secondaryDarkCtaStyle}>
                {copy.secondaryCta}
              </Link>
            </div>
          </div>
        </section>

        <footer
          className="shopify-lp-section"
          style={{
            padding: "56px 48px",
            backgroundColor: "#ffffff",
            borderTop: "1px solid #f3f4f6",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 24,
            }}
          >
            <div style={{ maxWidth: 280 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 10 }}>FeedPlug</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#6b7280" }}>{copy.heroSubtitle}</p>
            </div>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Link href="/" style={footerLinkStyle}>
                {copy.footerHome}
              </Link>
              <Link href="/docs" style={footerLinkStyle}>
                {copy.footerDocs}
              </Link>
              <Link href="/docs/export" style={footerLinkStyle}>
                {copy.footerExport}
              </Link>
              <Link href="/optimiser-flux-google-shopping" style={footerLinkStyle}>
                Google Shopping
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

const primaryHeroCtaStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "15px 24px",
  borderRadius: 10,
  backgroundColor: "#ffffff",
  color: "#111827",
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 600,
} satisfies React.CSSProperties;

const secondaryHeroCtaStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "15px 24px",
  borderRadius: 10,
  backgroundColor: "rgba(255,255,255,0.06)",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 600,
  border: "1px solid rgba(255,255,255,0.12)",
} satisfies React.CSSProperties;

const linkCardStyle = {
  display: "grid",
  gap: 10,
  padding: 24,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  backgroundColor: "#ffffff",
  textDecoration: "none",
} satisfies React.CSSProperties;

const linkCardLabelStyle = {
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
} satisfies React.CSSProperties;

const linkCardTextStyle = {
  fontSize: 15,
  lineHeight: 1.72,
  color: "#64748b",
} satisfies React.CSSProperties;

const primaryDarkCtaStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "15px 24px",
  borderRadius: 10,
  backgroundColor: "#ffffff",
  color: "#111827",
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 600,
} satisfies React.CSSProperties;

const secondaryDarkCtaStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "15px 24px",
  borderRadius: 10,
  backgroundColor: "transparent",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 600,
  border: "1px solid rgba(255,255,255,0.24)",
} satisfies React.CSSProperties;

const footerLinkStyle = {
  color: "#6b7280",
  textDecoration: "none",
  fontSize: 14,
} satisfies React.CSSProperties;

function FeedPlugShowcase({ copy }: { copy: ScreenCopy }) {
  return (
    <div className="shopify-lp-dashboard">
      <div
        className="shopify-lp-dashboard-glow"
        style={{
          top: -18,
          right: 22,
          width: 140,
          height: 140,
          background: "rgba(96,165,250,0.22)",
        }}
      />
      <div
        className="shopify-lp-dashboard-glow"
        style={{
          bottom: 18,
          left: 6,
          width: 148,
          height: 148,
          background: "rgba(52,211,153,0.16)",
        }}
      />

      <div className="shopify-lp-dashboard-shell">
        <div className="shopify-lp-dashboard-gridline" />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: 26,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(148,163,184,0.14)",
              marginBottom: 18,
            }}
          >
            <Sparkles style={{ width: 14, height: 14, color: "#bfdbfe" }} />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226,232,240,0.7)" }}>
              {copy.panelEyebrow}
            </span>
          </div>

          <div className="shopify-lp-showcase-flow">
            <SimpleStep
              icon={<ShoppingBag style={{ width: 18, height: 18, color: "#bfdbfe" }} />}
              index="01"
              title={copy.sourceLabel}
              meta={copy.sourceMeta}
            />
            <SimpleStep
              icon={<Sparkles style={{ width: 18, height: 18, color: "#bbf7d0" }} />}
              index="02"
              title={copy.optimizeLabel}
              meta={copy.optimizeMeta}
              highlighted
            />
            <SimpleStep
              icon={<RefreshCw style={{ width: 18, height: 18, color: "#bfdbfe" }} />}
              index="03"
              title={copy.exportLabel}
              meta={copy.exportMeta}
            />
          </div>

          <div
            className="shopify-lp-showcase-result"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 132px) minmax(0, 1fr)",
              gap: 16,
              marginTop: 18,
              padding: 18,
              borderRadius: 22,
              background: "linear-gradient(180deg, rgba(8,47,73,0.62), rgba(15,23,42,0.84))",
              border: "1px solid rgba(125,211,252,0.16)",
            }}
          >
            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(148,163,184,0.14)",
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226,232,240,0.54)", marginBottom: 8 }}>
                Score
              </div>
              <div style={{ fontSize: 40, lineHeight: 1, fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>81</div>
              <div style={{ fontSize: 12, color: "rgba(226,232,240,0.5)" }}>sur 100</div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(191,219,254,0.72)" }}>
                {copy.resultTitle}
              </div>
              <ResultRow label={copy.scoringInsight} tone="violet" />
              <ResultRow label={copy.scoreDelta} tone="blue" />
              <ResultRow label={copy.issuesDelta} tone="emerald" />
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  width: "fit-content",
                  padding: "10px 12px",
                  borderRadius: 999,
                  backgroundColor: "rgba(52,211,153,0.12)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  color: "#d1fae5",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span
                  className="shopify-lp-dashboard-pulse"
                  style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#34d399" }}
                />
                {copy.readinessLabel}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimpleStep({
  icon,
  index,
  title,
  meta,
}: {
  icon: React.ReactNode;
  index: string;
  title: string;
  meta: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className="shopify-lp-card"
      style={{
        padding: 18,
        borderRadius: 20,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(148,163,184,0.14)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "42px 1fr", gap: 14, alignItems: "start" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(148,163,184,0.66)", marginBottom: 6 }}>
            {index}
          </div>
          <div style={{ fontSize: 18, lineHeight: 1.35, fontWeight: 650, color: "#ffffff", marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(226,232,240,0.62)" }}>{meta}</div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, tone }: { label: string; tone: "blue" | "emerald" | "violet" }) {
  const toneMap = {
    blue: {
      border: "rgba(96,165,250,0.18)",
      background: "rgba(96,165,250,0.08)",
      dot: "#60a5fa",
    },
    emerald: {
      border: "rgba(52,211,153,0.18)",
      background: "rgba(52,211,153,0.08)",
      dot: "#34d399",
    },
    violet: {
      border: "rgba(167,139,250,0.18)",
      background: "rgba(167,139,250,0.08)",
      dot: "#a78bfa",
    },
  } satisfies Record<string, { border: string; background: string; dot: string }>;

  const colors = toneMap[tone];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 16,
        background: colors.background,
        border: `1px solid ${colors.border}`,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: colors.dot }} />
      <span style={{ fontSize: 14, lineHeight: 1.55, color: "#f8fafc" }}>{label}</span>
    </div>
  );
}

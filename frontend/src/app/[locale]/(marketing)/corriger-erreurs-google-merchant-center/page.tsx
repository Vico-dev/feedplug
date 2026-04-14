import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldCheck,
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
  footerShopping: string;
};

type ScreenCopy = {
  eyebrow: string;
  stageSource: string;
  stageSourceMeta: string;
  stageScore: string;
  stageScoreMeta: string;
  stageExport: string;
  stageExportMeta: string;
  scoreLabel: string;
  scoreMeta: string;
  issueLabel: string;
  issueItems: string[];
  resultTitle: string;
  resultBody: string;
  answerTitle: string;
  answerBody: string;
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
    heroEyebrow: "Google Merchant Center",
    heroTitle: "Corrigez vos erreurs Google Merchant Center",
    heroSubtitle:
      "Scorez chaque fiche produit, identifiez les rejets et attributs manquants, puis republiez un flux Google Shopping conforme sans corriger a l'aveugle.",
    primaryCta: "Demander une demo",
    secondaryCta: "Voir la page Google Shopping",
    trust: ["Scoring produit 0-100", "Blocages Merchant Center visibles", "Flux pret a republier"],
    painTitle: "Pourquoi les erreurs Merchant Center prennent vite trop de temps",
    pains: [
      "Les diagnostics Google Merchant Center disent qu'un produit bloque, mais pas toujours quelle correction prioriser en premier.",
      "GTIN, marque, categorie, image, prix ou disponibilite peuvent etre invalides ou incomplets sur des dizaines de fiches.",
      "Sans scoring produit, les rejets restent disperses et l'equipe corrige le catalogue sans ordre clair.",
      "Quand la source change souvent, les memes erreurs reviennent si le flux n'est pas reconstruit proprement.",
    ],
    methodTitle: "La methode FeedPlug pour corriger Merchant Center",
    methodSubtitle:
      "FeedPlug transforme les erreurs Google Merchant Center en priorites produit concretes, relie les blocages a la fiche concernee et facilite la republication d'un flux plus propre.",
    steps: [
      {
        title: "Centralisez les donnees produit",
        body: "Le catalogue, les attributs critiques et les contenus restent regroupes dans une base unique avant export vers Google Shopping.",
      },
      {
        title: "Scorez les fiches bloquees",
        body: "Le scoring produit et les controles de conformite font remonter les fiches rejetees, trop faibles ou incompletes pour Merchant Center.",
      },
      {
        title: "Corrigez ce qui bloque vraiment",
        body: "Vous priorisez GTIN, marque, categorie, titre, description, image, disponibilite et autres champs utiles avant republication.",
      },
      {
        title: "Republiez un flux plus propre",
        body: "Le flux Google Shopping repart avec des fiches mieux structurees et suit les mises a jour du catalogue plus proprement.",
      },
    ],
    benefitsTitle: "Ce que FeedPlug apporte concretement",
    benefits: [
      "Les erreurs Merchant Center deviennent actionnables au niveau produit, pas seulement au niveau du flux.",
      "Le scoring produit aide a traiter d'abord les fiches les plus risquees ou les plus faibles.",
      "Le meme catalogue peut servir Google Shopping et les autres canaux sans multiplier les fichiers correctifs.",
      "Vous reduisez les corrections manuelles repetitives et les allers-retours entre diagnostics GMC et catalogue source.",
    ],
    errorsTitle: "Les erreurs Google Merchant Center les plus frequentes",
    errorsIntro:
      "Ce sont souvent ces points qui bloquent la diffusion ou degradent la qualite du flux Google Shopping.",
    errors: [
      "GTIN, marque ou MPN manquants",
      "Titre produit trop faible, trop court ou peu descriptif",
      "Description insuffisante ou mal structuree",
      "Image absente, de faible qualite ou non conforme",
      "Categorie Google Product Category mal renseignee",
      "Prix, disponibilite ou variantes mal synchronises",
    ],
    linksTitle: "Pour aller plus loin",
    linksIntro:
      "Retrouvez les pages utiles pour comprendre le scoring, l'optimisation Google Shopping et les flux Shopify lies a Merchant Center.",
    ctaTitle: "Besoin de corriger vos erreurs Merchant Center plus vite ?",
    ctaBody:
      "Demandez une demo FeedPlug ou revenez sur la page Google Shopping pour voir comment le scoring produit priorise les corrections.",
    footerHome: "Accueil",
    footerDocs: "Documentation",
    footerShopping: "Google Shopping",
  },
  en: {
    heroEyebrow: "Google Merchant Center",
    heroTitle: "Fix your Google Merchant Center errors",
    heroSubtitle:
      "Score every product listing, identify rejections and missing attributes, then republish a compliant Google Shopping feed without fixing issues blindly.",
    primaryCta: "Request a demo",
    secondaryCta: "View Google Shopping page",
    trust: ["Product scoring 0-100", "Merchant Center blockers visible", "Feed ready to republish"],
    painTitle: "Why Merchant Center errors quickly become time-consuming",
    pains: [
      "Google Merchant Center diagnostics show that a product is blocked, but not always what to fix first.",
      "GTIN, brand, category, image, price, or availability can be invalid or incomplete across dozens of listings.",
      "Without product scoring, rejections stay scattered and teams fix the catalog without a clear order.",
      "When the source changes often, the same issues keep coming back if the feed is not rebuilt properly.",
    ],
    methodTitle: "The FeedPlug method to fix Merchant Center",
    methodSubtitle:
      "FeedPlug turns Google Merchant Center errors into concrete product priorities, connects blockers to the affected listing, and helps republish a cleaner feed.",
    steps: [
      {
        title: "Centralize product data",
        body: "Catalog data, critical attributes, and content stay in one place before export to Google Shopping.",
      },
      {
        title: "Score blocked listings",
        body: "Product scoring and compliance checks surface listings that are rejected, weak, or incomplete for Merchant Center.",
      },
      {
        title: "Fix what really blocks distribution",
        body: "You prioritize GTIN, brand, category, title, description, image, availability, and other useful fields before republishing.",
      },
      {
        title: "Republish a cleaner feed",
        body: "The Google Shopping feed goes back out with better-structured listings and follows catalog updates more reliably.",
      },
    ],
    benefitsTitle: "What FeedPlug improves in practice",
    benefits: [
      "Merchant Center errors become actionable at the product level, not just the feed level.",
      "Product scoring helps treat the riskiest or weakest listings first.",
      "The same catalog can serve Google Shopping and other channels without multiplying corrective files.",
      "You reduce repetitive manual fixes and back-and-forth between GMC diagnostics and the source catalog.",
    ],
    errorsTitle: "Most common Google Merchant Center issues",
    errorsIntro:
      "These are often the points that block distribution or degrade Google Shopping feed quality.",
    errors: [
      "Missing GTIN, brand, or MPN",
      "Product title too weak, too short, or not descriptive enough",
      "Description insufficient or poorly structured",
      "Missing, low-quality, or non-compliant image",
      "Incorrect Google Product Category",
      "Price, availability, or variants not synchronized correctly",
    ],
    linksTitle: "Explore related pages",
    linksIntro:
      "Use these pages to understand scoring, Google Shopping optimization, and Shopify-to-Merchant-Center workflows.",
    ctaTitle: "Need to fix Merchant Center errors faster?",
    ctaBody:
      "Request a FeedPlug demo or review the Google Shopping page to see how product scoring prioritizes what to fix.",
    footerHome: "Home",
    footerDocs: "Documentation",
    footerShopping: "Google Shopping",
  },
  es: {
    heroEyebrow: "Google Merchant Center",
    heroTitle: "Corrige tus errores de Google Merchant Center",
    heroSubtitle:
      "Puntua cada ficha de producto, identifica rechazos y atributos faltantes, y vuelve a publicar un feed compatible para Google Shopping sin corregir a ciegas.",
    primaryCta: "Solicitar una demo",
    secondaryCta: "Ver la pagina Google Shopping",
    trust: ["Scoring de producto 0-100", "Bloqueos de Merchant Center visibles", "Feed listo para republicar"],
    painTitle: "Por que los errores de Merchant Center consumen tiempo muy rapido",
    pains: [
      "Los diagnosticos de Google Merchant Center indican que un producto bloquea, pero no siempre que corregir primero.",
      "GTIN, marca, categoria, imagen, precio o stock pueden ser invalidos o incompletos en muchas fichas.",
      "Sin scoring de producto, los rechazos quedan dispersos y el equipo corrige el catalogo sin un orden claro.",
      "Cuando la fuente cambia a menudo, los mismos errores vuelven si el feed no se reconstruye bien.",
    ],
    methodTitle: "El metodo FeedPlug para corregir Merchant Center",
    methodSubtitle:
      "FeedPlug convierte los errores de Google Merchant Center en prioridades concretas por producto, vincula cada bloqueo con la ficha afectada y facilita republicar un feed mas limpio.",
    steps: [
      {
        title: "Centraliza los datos de producto",
        body: "El catalogo, los atributos criticos y los contenidos se mantienen en una base unica antes de exportar a Google Shopping.",
      },
      {
        title: "Puntua las fichas bloqueadas",
        body: "El scoring de producto y los controles de cumplimiento detectan fichas rechazadas, debiles o incompletas para Merchant Center.",
      },
      {
        title: "Corrige lo que realmente bloquea",
        body: "Priorizas GTIN, marca, categoria, titulo, descripcion, imagen, stock y otros campos utiles antes de republicar.",
      },
      {
        title: "Republica un feed mas limpio",
        body: "El feed de Google Shopping vuelve a salir con fichas mejor estructuradas y sigue mejor las actualizaciones del catalogo.",
      },
    ],
    benefitsTitle: "Lo que FeedPlug mejora en la practica",
    benefits: [
      "Los errores de Merchant Center se vuelven accionables a nivel producto, no solo a nivel feed.",
      "El scoring de producto ayuda a tratar primero las fichas mas debiles o arriesgadas.",
      "El mismo catalogo puede alimentar Google Shopping y otros canales sin multiplicar archivos correctivos.",
      "Reduces correcciones manuales repetitivas y los viajes entre diagnosticos de GMC y catalogo fuente.",
    ],
    errorsTitle: "Errores de Google Merchant Center mas frecuentes",
    errorsIntro:
      "Estos suelen ser los puntos que bloquean la difusion o degradan la calidad del feed de Google Shopping.",
    errors: [
      "GTIN, marca o MPN ausentes",
      "Titulo demasiado debil, corto o poco descriptivo",
      "Descripcion insuficiente o mal estructurada",
      "Imagen ausente, de baja calidad o no compatible",
      "Google Product Category incorrecta",
      "Precio, stock o variantes mal sincronizados",
    ],
    linksTitle: "Para seguir avanzando",
    linksIntro:
      "Usa estas paginas para entender el scoring, la optimizacion de Google Shopping y los flujos Shopify hacia Merchant Center.",
    ctaTitle: "Necesitas corregir errores de Merchant Center mas rapido?",
    ctaBody:
      "Solicita una demo de FeedPlug o revisa la pagina Google Shopping para ver como el scoring de producto prioriza que corregir.",
    footerHome: "Inicio",
    footerDocs: "Documentacion",
    footerShopping: "Google Shopping",
  },
};

const SCREEN_COPY: Record<Locale, ScreenCopy> = {
  fr: {
    eyebrow: "De l'erreur au flux republiable",
    stageSource: "Catalogue centralise",
    stageSourceMeta: "Titres, prix, images, stock et attributs critiques regroupes.",
    stageScore: "Scoring produit et conformite",
    stageScoreMeta: "Les fiches rejetees ou faibles remontent tout de suite.",
    stageExport: "Flux Google Shopping propre",
    stageExportMeta: "Export ou URL de flux pret pour Merchant Center.",
    scoreLabel: "Scoring produit",
    scoreMeta: "78 / 100 sur la fiche la plus prioritaire",
    issueLabel: "Blocages detectes",
    issueItems: ["GTIN manquant", "Categorie trop generale", "Image a renforcer"],
    resultTitle: "Ce que l'equipe voit tout de suite",
    resultBody: "Les produits a corriger, le type de blocage et l'ordre de priorite avant republication.",
    answerTitle: "Pret pour Merchant Center",
    answerBody: "Les attributs critiques sont plus lisibles, le scoring est meilleur et le flux peut repartir plus proprement.",
  },
  en: {
    eyebrow: "From error to republishable feed",
    stageSource: "Centralized catalog",
    stageSourceMeta: "Titles, prices, images, stock, and critical attributes grouped in one place.",
    stageScore: "Product scoring and compliance",
    stageScoreMeta: "Rejected or weak listings surface immediately.",
    stageExport: "Clean Google Shopping feed",
    stageExportMeta: "Feed URL or export ready for Merchant Center.",
    scoreLabel: "Product scoring",
    scoreMeta: "78 / 100 on the highest-priority listing",
    issueLabel: "Detected blockers",
    issueItems: ["Missing GTIN", "Category too broad", "Image needs improvement"],
    resultTitle: "What the team sees immediately",
    resultBody: "Which products to fix, what blocker type is involved, and what to prioritize before republishing.",
    answerTitle: "Ready for Merchant Center",
    answerBody: "Critical attributes are clearer, scoring improves, and the feed can be republished more cleanly.",
  },
  es: {
    eyebrow: "Del error al feed republicable",
    stageSource: "Catalogo centralizado",
    stageSourceMeta: "Titulos, precios, imagenes, stock y atributos criticos reunidos.",
    stageScore: "Scoring de producto y cumplimiento",
    stageScoreMeta: "Las fichas rechazadas o debiles aparecen enseguida.",
    stageExport: "Feed limpio para Google Shopping",
    stageExportMeta: "URL de feed o exportacion lista para Merchant Center.",
    scoreLabel: "Scoring de producto",
    scoreMeta: "78 / 100 en la ficha mas prioritaria",
    issueLabel: "Bloqueos detectados",
    issueItems: ["GTIN ausente", "Categoria demasiado general", "Imagen a reforzar"],
    resultTitle: "Lo que el equipo ve de inmediato",
    resultBody: "Que productos corregir, que tipo de bloqueo hay y que priorizar antes de republicar.",
    answerTitle: "Listo para Merchant Center",
    answerBody: "Los atributos criticos estan mas claros, el scoring mejora y el feed puede republicarse con mas limpieza.",
  },
};

const FAQ_COPY: Record<Locale, FAQCopy> = {
  fr: {
    title: "Questions frequentes sur les erreurs Google Merchant Center",
    intro:
      "Ces questions reviennent souvent quand une equipe veut comprendre quels rejets corriger en premier et comment republier un flux propre.",
    items: [
      {
        question: "Pourquoi Google Merchant Center rejette-t-il autant de produits ?",
        answer:
          "Les rejets viennent souvent de GTIN, marque, categorie, image, titre, description, prix ou disponibilite incomplets. Le probleme n'est pas seulement le flux, mais la qualite fiche par fiche.",
      },
      {
        question: "Quelles erreurs faut-il corriger en premier ?",
        answer:
          "Il faut commencer par les fiches qui bloquent la diffusion ou degradent le plus le catalogue. Le scoring produit aide a prioriser les produits les plus faibles au lieu de corriger sans ordre.",
      },
      {
        question: "Le scoring produit remplace-t-il les diagnostics Merchant Center ?",
        answer:
          "Non. Il les rend plus actionnables en reliant les erreurs et manques de conformite a chaque fiche produit, avec un ordre de traitement plus clair.",
      },
      {
        question: "Faut-il reconstruire tout le flux apres correction ?",
        answer:
          "Pas forcement. L'objectif est plutot de republier un flux plus propre depuis une base catalogue fiabilisee, afin que les corrections tiennent dans le temps.",
      },
    ],
  },
  en: {
    title: "Frequently asked questions about Google Merchant Center errors",
    intro:
      "These questions come up often when a team wants to understand what to fix first and how to republish a cleaner feed.",
    items: [
      {
        question: "Why does Google Merchant Center reject so many products?",
        answer:
          "Rejections often come from incomplete GTINs, brands, categories, images, titles, descriptions, prices, or availability. The issue is not only the feed itself, but the quality of each listing.",
      },
      {
        question: "Which errors should be fixed first?",
        answer:
          "Start with the listings that block distribution or hurt catalog quality the most. Product scoring helps prioritize the weakest products instead of fixing issues in random order.",
      },
      {
        question: "Does product scoring replace Merchant Center diagnostics?",
        answer:
          "No. It makes them actionable by connecting the errors and compliance gaps to each product listing, with a clearer order of execution.",
      },
      {
        question: "Do you need to rebuild the entire feed after fixing errors?",
        answer:
          "Not necessarily. The goal is to republish a cleaner feed from a more reliable catalog base so the corrections hold over time.",
      },
    ],
  },
  es: {
    title: "Preguntas frecuentes sobre errores de Google Merchant Center",
    intro:
      "Estas preguntas aparecen a menudo cuando un equipo quiere entender que rechazos corregir primero y como republicar un feed mas limpio.",
    items: [
      {
        question: "Por que Google Merchant Center rechaza tantos productos?",
        answer:
          "Los rechazos suelen venir de GTIN, marca, categoria, imagen, titulo, descripcion, precio o stock incompletos. El problema no es solo el feed, sino la calidad ficha por ficha.",
      },
      {
        question: "Que errores conviene corregir primero?",
        answer:
          "Hay que empezar por las fichas que bloquean la difusion o degradan mas la calidad del catalogo. El scoring de producto ayuda a priorizar los productos mas debiles en lugar de corregir sin orden.",
      },
      {
        question: "El scoring de producto sustituye los diagnosticos de Merchant Center?",
        answer:
          "No. Los vuelve mas accionables al vincular errores y faltas de cumplimiento con cada ficha de producto, con un orden de trabajo mas claro.",
      },
      {
        question: "Hace falta reconstruir todo el feed despues de corregir errores?",
        answer:
          "No siempre. La idea es republicar un feed mas limpio desde una base de catalogo mas fiable para que las correcciones duren en el tiempo.",
      },
    ],
  },
};

const PROOF_COPY: Record<Locale, ProofCopy> = {
  fr: {
    title: "Exemple concret sur une fiche produit a corriger",
    intro:
      "Voici a quoi ressemble une fiche produit avant correction, puis apres priorisation dans FeedPlug avant republication vers Google Merchant Center.",
    detectTitle: "Ce que FeedPlug detecte sur une fiche a corriger",
    detectIntro:
      "Exemple typique sur une fiche produit avant correction, quand Merchant Center rejette ou fragilise la diffusion.",
    detectItems: [
      "GTIN absent ou incomplet",
      "Titre trop court et peu descriptif",
      "Categorie Google non renseignee",
      "Image exploitable cote boutique, mais trop faible pour Merchant Center",
    ],
    beforeTitle: "Avant",
    beforeItems: [
      "Titre: Runner",
      "Marque absente",
      "GTIN manquant",
      "Categorie vide",
      "Score produit: 42/100",
    ],
    afterTitle: "Apres priorisation FeedPlug",
    afterItems: [
      "Titre enrichi avec marque, type et attributs utiles",
      "GTIN et marque renseignes",
      "Categorie Google clarifiee",
      "Blocages Merchant Center rendus visibles fiche par fiche",
      "Score produit: 78/100",
    ],
    gainsTitle: "Ce que l'utilisateur gagne concretement",
    gains: [
      "Une priorisation claire au niveau produit",
      "Moins d'allers-retours entre diagnostics GMC et catalogue source",
      "Un flux plus propre a republier sans corriger a l'aveugle",
    ],
  },
  en: {
    title: "Concrete example on a product listing to fix",
    intro:
      "This shows what a product listing looks like before correction, then after prioritization in FeedPlug before republishing to Google Merchant Center.",
    detectTitle: "What FeedPlug detects on a listing that needs fixing",
    detectIntro:
      "A typical example on a product listing before correction, when Merchant Center rejects or weakens distribution.",
    detectItems: [
      "Missing or incomplete GTIN",
      "Title too short and not descriptive enough",
      "Google category not mapped",
      "Image usable on-site but too weak for Merchant Center",
    ],
    beforeTitle: "Before",
    beforeItems: [
      "Title: Runner",
      "Brand missing",
      "GTIN missing",
      "Category empty",
      "Product score: 42/100",
    ],
    afterTitle: "After FeedPlug prioritization",
    afterItems: [
      "Title enriched with brand, type, and useful attributes",
      "GTIN and brand completed",
      "Google category clarified",
      "Merchant Center blockers made visible product by product",
      "Product score: 78/100",
    ],
    gainsTitle: "What the user gains in practice",
    gains: [
      "Clear product-level prioritization",
      "Less back and forth between GMC diagnostics and the source catalog",
      "A cleaner feed to republish without fixing issues blindly",
    ],
  },
  es: {
    title: "Ejemplo concreto sobre una ficha de producto a corregir",
    intro:
      "Asi se ve una ficha de producto antes de corregirla y despues de priorizarla en FeedPlug antes de republicar en Google Merchant Center.",
    detectTitle: "Lo que FeedPlug detecta en una ficha a corregir",
    detectIntro:
      "Ejemplo tipico en una ficha de producto antes de corregir, cuando Merchant Center rechaza o debilita la difusion.",
    detectItems: [
      "GTIN ausente o incompleto",
      "Titulo demasiado corto y poco descriptivo",
      "Categoria Google sin mapear",
      "Imagen usable en la tienda pero demasiado debil para Merchant Center",
    ],
    beforeTitle: "Antes",
    beforeItems: [
      "Titulo: Runner",
      "Marca ausente",
      "GTIN ausente",
      "Categoria vacia",
      "Scoring de producto: 42/100",
    ],
    afterTitle: "Despues de la priorizacion FeedPlug",
    afterItems: [
      "Titulo enriquecido con marca, tipo y atributos utiles",
      "GTIN y marca completados",
      "Categoria Google aclarada",
      "Bloqueos de Merchant Center visibles ficha por ficha",
      "Scoring de producto: 78/100",
    ],
    gainsTitle: "Lo que gana el usuario en la practica",
    gains: [
      "Priorizacion clara a nivel producto",
      "Menos idas y vueltas entre diagnosticos de GMC y catalogo fuente",
      "Un feed mas limpio para republicar sin corregir a ciegas",
    ],
  },
};

const STEP_ICONS = [Database, BarChart3, ShieldCheck, RefreshCw];

function getCopy(locale: string): PageCopy {
  if (locale === "fr" || locale === "en" || locale === "es") return COPY[locale];
  return COPY.en;
}

function getScreenCopy(locale: string): ScreenCopy {
  if (locale === "fr" || locale === "en" || locale === "es") return SCREEN_COPY[locale];
  return SCREEN_COPY.en;
}

function getFaqCopy(locale: string): FAQCopy {
  if (locale === "fr" || locale === "en" || locale === "es") return FAQ_COPY[locale];
  return FAQ_COPY.en;
}

function getProofCopy(locale: string): ProofCopy {
  if (locale === "fr" || locale === "en" || locale === "es") return PROOF_COPY[locale];
  return PROOF_COPY.en;
}

export default async function MerchantCenterErrorsPage({
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
            .gmc-errors-shell { font-family: var(--font-geist-sans), sans-serif; }
            .gmc-errors-fade { animation: gmcErrorsFadeUp .72s ease-out forwards; }
            .gmc-errors-delay-1 { animation-delay: .08s; opacity: 0; }
            .gmc-errors-delay-2 { animation-delay: .16s; opacity: 0; }
            .gmc-errors-delay-3 { animation-delay: .24s; opacity: 0; }
            .gmc-errors-card { transition: transform .2s ease, box-shadow .25s ease, border-color .2s ease; }
            .gmc-errors-card:hover { transform: translateY(-3px); box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08); border-color: #cbd5e1; }
            .gmc-errors-visual-shell {
              position: relative;
              overflow: hidden;
              border-radius: 28px;
              background: linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.96) 100%);
              border: 1px solid rgba(148,163,184,0.16);
              box-shadow: 0 28px 72px rgba(2, 6, 23, 0.34), inset 0 1px 0 rgba(255,255,255,0.07);
            }
            .gmc-errors-visual-shell::before {
              content: "";
              position: absolute;
              inset: -18% 52% auto -8%;
              height: 220px;
              background: radial-gradient(circle, rgba(59,130,246,0.24) 0%, rgba(59,130,246,0) 72%);
              pointer-events: none;
            }
            .gmc-errors-visual-shell::after {
              content: "";
              position: absolute;
              inset: auto -10% -24% 44%;
              width: 220px;
              height: 220px;
              background: radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0) 72%);
              pointer-events: none;
            }
            .gmc-errors-gridline {
              position: absolute;
              inset: 0;
              background-image: linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px);
              background-size: 100% 54px, 54px 100%;
              mask-image: linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0));
              pointer-events: none;
            }
            .gmc-errors-pulse { animation: gmcErrorsPulse 1.9s ease-in-out infinite; }
            @keyframes gmcErrorsFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes gmcErrorsPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.16); opacity: .76; } }
            @media (max-width: 920px) {
              .gmc-errors-hero-grid { grid-template-columns: 1fr !important; }
              .gmc-errors-two-col { grid-template-columns: 1fr !important; }
            }
            @media (max-width: 768px) {
              .gmc-errors-hero { padding: 112px 24px 72px !important; }
              .gmc-errors-section { padding-left: 24px !important; padding-right: 24px !important; }
              .gmc-errors-grid-4 { grid-template-columns: 1fr !important; }
              .gmc-errors-grid-3 { grid-template-columns: 1fr !important; }
            }
            @media (max-width: 480px) {
              .gmc-errors-hero { padding: 96px 20px 56px !important; }
              .gmc-errors-section { padding-left: 20px !important; padding-right: 20px !important; }
            }
          `,
        }}
      />
      {createFaqJsonLd(faqCopy.items)}

      <div className="gmc-errors-shell">
        <MarketingHeader />

        <section
          className="gmc-errors-hero gmc-errors-section"
          style={{
            position: "relative",
            padding: "120px 48px 88px",
            background:
              "radial-gradient(circle at top right, rgba(59,130,246,0.18), transparent 28%), radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 24%), #111827",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(17,24,39,0) 28%, rgba(17,24,39,0.18) 100%)" }} />
          <div
            className="gmc-errors-hero-grid"
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
              <div className="gmc-errors-fade" style={eyebrowStyle}>
                <ShieldCheck style={{ width: 16, height: 16 }} />
                {copy.heroEyebrow}
              </div>
              <h1 className="gmc-errors-fade gmc-errors-delay-1" style={heroTitleStyle}>
                {copy.heroTitle}
              </h1>
              <p className="gmc-errors-fade gmc-errors-delay-2" style={heroSubtitleStyle}>
                {copy.heroSubtitle}
              </p>
              <div className="gmc-errors-fade gmc-errors-delay-3" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 }}>
                <Link href="/demo?source=use_case_demo" style={primaryHeroCtaStyle}>
                  {copy.primaryCta}
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </Link>
                <Link href="/optimiser-flux-google-shopping" style={secondaryHeroCtaStyle}>
                  {copy.secondaryCta}
                </Link>
              </div>
              <div className="gmc-errors-fade gmc-errors-delay-3" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {copy.trust.map((item) => (
                  <span key={item} style={trustBadgeStyle}>
                    <CheckCircle2 style={{ width: 14, height: 14, color: "#34d399" }} />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <aside className="gmc-errors-fade gmc-errors-delay-3" style={{ width: "100%", marginLeft: "auto" }}>
              <MerchantCenterShowcase copy={screenCopy} />
            </aside>
          </div>
        </section>

        <section className="gmc-errors-section" style={sectionWhiteStyle}>
          <div style={sectionWrapStyle}>
            <h2 style={sectionTitleStyle}>{copy.painTitle}</h2>
            <div className="gmc-errors-grid-4" style={grid4Style}>
              {copy.pains.map((item) => (
                <div key={item} className="gmc-errors-card" style={whiteCardStyle}>
                  <AlertCircle style={{ width: 18, height: 18, color: "#2563eb", marginBottom: 14 }} />
                  <p style={cardParagraphStyle}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="gmc-errors-section" style={sectionAltStyle}>
          <div style={sectionWrapStyle}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 14 }}>{copy.methodTitle}</h2>
            <p style={sectionIntroStyle}>{copy.methodSubtitle}</p>
            <div className="gmc-errors-grid-4" style={grid4Style}>
              {copy.steps.map((step, index) => {
                const Icon = STEP_ICONS[index];
                return (
                  <div key={step.title} className="gmc-errors-card" style={stepCardStyle}>
                    <div style={stepIconWrapStyle}>
                      <Icon style={{ width: 20, height: 20, color: "#1d4ed8" }} />
                    </div>
                    <h3 style={stepTitleStyle}>{step.title}</h3>
                    <p style={cardParagraphMutedStyle}>{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="gmc-errors-section" style={sectionWhiteStyle}>
          <div className="gmc-errors-two-col" style={twoColStyle}>
            <div className="gmc-errors-card" style={benefitCardStyle}>
              <div style={benefitIconStyle}>
                <Sparkles style={{ width: 22, height: 22, color: "#111827" }} />
              </div>
              <h2 style={twoColTitleStyle}>{copy.benefitsTitle}</h2>
              <div style={{ display: "grid", gap: 14 }}>
                {copy.benefits.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <CheckCircle2 style={{ width: 18, height: 18, color: "#16a34a", flexShrink: 0, marginTop: 3 }} />
                    <p style={cardParagraphStyle}>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="gmc-errors-card" style={darkCardStyle}>
              <h2 style={darkTitleStyle}>{copy.errorsTitle}</h2>
              <p style={darkIntroStyle}>{copy.errorsIntro}</p>
              <ul style={darkListStyle}>
                {copy.errors.map((item) => (
                  <li key={item} style={darkListItemStyle}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="gmc-errors-section" style={sectionAltStyle}>
          <div style={sectionWrapStyle}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 12 }}>{proofCopy.title}</h2>
            <p style={{ ...sectionIntroStyle, marginBottom: 24 }}>{proofCopy.intro}</p>

            <div className="gmc-errors-two-col" style={twoColStyle}>
              <div className="gmc-errors-card" style={benefitCardStyle}>
                <div style={benefitIconStyle}>
                  <AlertCircle style={{ width: 22, height: 22, color: "#2563eb" }} />
                </div>
                <h3 style={twoColTitleStyle}>{proofCopy.detectTitle}</h3>
                <p style={{ ...cardParagraphMutedStyle, marginBottom: 18 }}>{proofCopy.detectIntro}</p>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10 }}>
                  {proofCopy.detectItems.map((item) => (
                    <li key={item} style={cardParagraphStyle}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                <div className="gmc-errors-card" style={whiteCardStyle}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#dc2626", marginBottom: 12 }}>
                    {proofCopy.beforeTitle}
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {proofCopy.beforeItems.map((item) => (
                      <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <AlertCircle style={{ width: 16, height: 16, color: "#dc2626", flexShrink: 0, marginTop: 4 }} />
                        <p style={cardParagraphStyle}>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="gmc-errors-card" style={{ ...darkCardStyle, backgroundColor: "#0f172a" }}>
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

            <div className="gmc-errors-grid-3" style={{ ...grid3Style, marginTop: 20 }}>
              {proofCopy.gains.map((item) => (
                <div key={item} className="gmc-errors-card" style={whiteCardStyle}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <CheckCircle2 style={{ width: 18, height: 18, color: "#16a34a", flexShrink: 0, marginTop: 4 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>
                        {proofCopy.gainsTitle}
                      </div>
                      <p style={cardParagraphStyle}>{item}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="gmc-errors-section" style={sectionAltStyle}>
          <div style={sectionWrapStyle}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 12 }}>{copy.linksTitle}</h2>
            <p style={{ ...sectionIntroStyle, marginBottom: 24 }}>{copy.linksIntro}</p>
            <div className="gmc-errors-grid-3" style={grid3Style}>
              <Link href="/optimiser-flux-google-shopping" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/optimiser-flux-google-shopping</span>
                <span style={linkCardTextStyle}>Revenir sur la page plus large dediee a Google Shopping et a la conformite.</span>
              </Link>
              <Link href="/optimiser-flux-google-shopping-shopify" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/optimiser-flux-google-shopping-shopify</span>
                <span style={linkCardTextStyle}>Voir le cas Shopify vers Merchant Center avec scoring produit et flux conforme.</span>
              </Link>
              <Link href="/docs/score" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/docs/score</span>
                <span style={linkCardTextStyle}>Comprendre comment FeedPlug priorise les produits a corriger avec son score 0-100.</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="gmc-errors-section" style={sectionWhiteStyle}>
          <div style={sectionWrapStyle}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 12 }}>{faqCopy.title}</h2>
            <p style={{ ...sectionIntroStyle, marginBottom: 24 }}>{faqCopy.intro}</p>
            <div style={{ display: "grid", gap: 16 }}>
              {faqCopy.items.map((item) => (
                <div key={item.question} className="gmc-errors-card" style={whiteCardStyle}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 18, lineHeight: 1.45, fontWeight: 650, color: "#0f172a" }}>
                    {item.question}
                  </h3>
                  <p style={cardParagraphMutedStyle}>{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="gmc-errors-section" style={ctaDarkSectionStyle}>
          <div style={ctaWrapStyle}>
            <h2 style={ctaTitleStyle}>{copy.ctaTitle}</h2>
            <p style={ctaBodyStyle}>{copy.ctaBody}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/demo?source=use_case_demo" style={primaryDarkCtaStyle}>
                {copy.primaryCta}
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
              <Link href="/optimiser-flux-google-shopping" style={secondaryDarkCtaStyle}>
                {copy.secondaryCta}
              </Link>
            </div>
          </div>
        </section>

        <footer className="gmc-errors-section" style={footerStyle}>
          <div style={footerWrapStyle}>
            <div style={{ maxWidth: 320 }}>
              <div style={footerBrandStyle}>FeedPlug</div>
              <p style={footerBodyStyle}>{copy.heroSubtitle}</p>
            </div>
            <div style={footerLinksWrapStyle}>
              <Link href="/" style={footerLinkStyle}>
                {copy.footerHome}
              </Link>
              <Link href="/docs" style={footerLinkStyle}>
                {copy.footerDocs}
              </Link>
              <Link href="/optimiser-flux-google-shopping" style={footerLinkStyle}>
                {copy.footerShopping}
              </Link>
              <Link href="/docs/score" style={footerLinkStyle}>
                /docs/score
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function MerchantCenterShowcase({ copy }: { copy: ScreenCopy }) {
  return (
    <div className="gmc-errors-visual-shell">
      <div className="gmc-errors-gridline" />
      <div style={{ position: "relative", zIndex: 1, padding: 26 }}>
        <div style={visualEyebrowStyle}>
          <Sparkles style={{ width: 14, height: 14, color: "#bfdbfe" }} />
          <span style={visualEyebrowTextStyle}>{copy.eyebrow}</span>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <VisualStage
            icon={<Database style={{ width: 18, height: 18, color: "#bfdbfe" }} />}
            title={copy.stageSource}
            meta={copy.stageSourceMeta}
          />
          <VisualStage
            icon={<BarChart3 style={{ width: 18, height: 18, color: "#99f6e4" }} />}
            title={copy.stageScore}
            meta={copy.stageScoreMeta}
            active
          />
          <VisualStage
            icon={<RefreshCw style={{ width: 18, height: 18, color: "#bfdbfe" }} />}
            title={copy.stageExport}
            meta={copy.stageExportMeta}
          />
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 148px) minmax(0, 1fr)" }}>
          <div style={visualScoreCardStyle}>
            <div style={visualScoreLabelStyle}>{copy.scoreLabel}</div>
            <div style={visualScoreValueStyle}>78</div>
            <div style={visualScoreMetaStyle}>{copy.scoreMeta}</div>
          </div>
          <div style={visualPanelStyle}>
            <div style={visualPanelLabelStyle}>{copy.issueLabel}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {copy.issueItems.map((item) => (
                <div key={item} style={visualIssueItemStyle}>
                  <span className="gmc-errors-pulse" style={visualDotStyle} />
                  <span style={visualIssueTextStyle}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          <VisualNote title={copy.resultTitle} body={copy.resultBody} />
          <VisualNote title={copy.answerTitle} body={copy.answerBody} highlight />
        </div>
      </div>
    </div>
  );
}

function VisualStage({
  icon,
  title,
  meta,
  active = false,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  active?: boolean;
}) {
  return (
    <div
      className="gmc-errors-card"
      style={{
        padding: 18,
        borderRadius: 20,
        background: active ? "rgba(34,211,238,0.09)" : "rgba(255,255,255,0.04)",
        border: active ? "1px solid rgba(103,232,249,0.2)" : "1px solid rgba(148,163,184,0.14)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "42px 1fr", gap: 14, alignItems: "start" }}>
        <div style={visualStageIconWrapStyle}>{icon}</div>
        <div>
          <div style={visualStageTitleStyle}>{title}</div>
          <div style={visualStageMetaStyle}>{meta}</div>
        </div>
      </div>
    </div>
  );
}

function VisualNote({
  title,
  body,
  highlight = false,
}: {
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 18,
        background: highlight ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.04)",
        border: highlight ? "1px solid rgba(45,212,191,0.16)" : "1px solid rgba(148,163,184,0.14)",
      }}
    >
      <div style={visualNoteTitleStyle}>{title}</div>
      <div style={visualNoteBodyStyle}>{body}</div>
    </div>
  );
}

const sectionWrapStyle = { maxWidth: 1080, margin: "0 auto" } satisfies React.CSSProperties;
const sectionWhiteStyle = { padding: "88px 48px", backgroundColor: "#ffffff" } satisfies React.CSSProperties;
const sectionAltStyle = {
  padding: "88px 48px",
  backgroundColor: "#f8fafc",
  borderTop: "1px solid #e5e7eb",
  borderBottom: "1px solid #e5e7eb",
} satisfies React.CSSProperties;
const sectionTitleStyle = {
  fontSize: "clamp(28px, 4vw, 38px)",
  fontWeight: 600,
  letterSpacing: "-0.03em",
  margin: "0 0 34px",
  color: "#111827",
} satisfies React.CSSProperties;
const sectionIntroStyle = {
  maxWidth: 760,
  margin: "0 0 34px",
  fontSize: 17,
  lineHeight: 1.72,
  color: "#64748b",
} satisfies React.CSSProperties;
const grid4Style = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 20,
} satisfies React.CSSProperties;
const grid3Style = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 18,
} satisfies React.CSSProperties;
const whiteCardStyle = {
  padding: 24,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  backgroundColor: "#ffffff",
} satisfies React.CSSProperties;
const stepCardStyle = {
  padding: 26,
  borderRadius: 16,
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
} satisfies React.CSSProperties;
const cardParagraphStyle = { margin: 0, fontSize: 15, lineHeight: 1.72, color: "#475569" } satisfies React.CSSProperties;
const cardParagraphMutedStyle = { margin: 0, fontSize: 15, lineHeight: 1.72, color: "#64748b" } satisfies React.CSSProperties;
const stepIconWrapStyle = {
  width: 42,
  height: 42,
  borderRadius: 12,
  backgroundColor: "#e0e7ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 18,
} satisfies React.CSSProperties;
const stepTitleStyle = {
  margin: "0 0 10px",
  fontSize: 18,
  lineHeight: 1.38,
  fontWeight: 650,
  color: "#0f172a",
} satisfies React.CSSProperties;
const twoColStyle = {
  maxWidth: 1080,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.95fr)",
  gap: 28,
} satisfies React.CSSProperties;
const benefitCardStyle = { padding: 30, borderRadius: 18, backgroundColor: "#ffffff", border: "1px solid #e5e7eb" } satisfies React.CSSProperties;
const benefitIconStyle = {
  width: 46,
  height: 46,
  borderRadius: 14,
  backgroundColor: "#f3f4f6",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 18,
} satisfies React.CSSProperties;
const twoColTitleStyle = {
  margin: "0 0 18px",
  fontSize: "clamp(24px, 3vw, 32px)",
  fontWeight: 600,
  letterSpacing: "-0.03em",
  color: "#111827",
} satisfies React.CSSProperties;
const darkCardStyle = { padding: 30, borderRadius: 18, backgroundColor: "#111827", color: "#ffffff", border: "1px solid #0f172a" } satisfies React.CSSProperties;
const darkTitleStyle = { margin: "0 0 12px", fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 600, letterSpacing: "-0.03em" } satisfies React.CSSProperties;
const darkIntroStyle = { margin: "0 0 18px", fontSize: 15, lineHeight: 1.72, color: "#cbd5e1" } satisfies React.CSSProperties;
const darkListStyle = { margin: 0, paddingLeft: 18, display: "grid", gap: 10 } satisfies React.CSSProperties;
const darkListItemStyle = { fontSize: 15, lineHeight: 1.72, color: "#ffffff" } satisfies React.CSSProperties;
const linkCardStyle = {
  display: "grid",
  gap: 10,
  padding: 24,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  backgroundColor: "#ffffff",
  textDecoration: "none",
} satisfies React.CSSProperties;
const linkCardLabelStyle = { fontSize: 14, fontWeight: 700, color: "#111827" } satisfies React.CSSProperties;
const linkCardTextStyle = { fontSize: 15, lineHeight: 1.72, color: "#64748b" } satisfies React.CSSProperties;
const ctaDarkSectionStyle = { padding: "104px 48px", backgroundColor: "#111827", borderTop: "1px solid #0f172a" } satisfies React.CSSProperties;
const ctaWrapStyle = { maxWidth: 760, margin: "0 auto", textAlign: "center" } satisfies React.CSSProperties;
const ctaTitleStyle = {
  margin: "0 0 14px",
  fontSize: "clamp(30px, 4vw, 42px)",
  lineHeight: 1.12,
  letterSpacing: "-0.03em",
  fontWeight: 600,
  color: "#ffffff",
} satisfies React.CSSProperties;
const ctaBodyStyle = { margin: "0 0 30px", fontSize: 17, lineHeight: 1.72, color: "rgba(255,255,255,0.58)" } satisfies React.CSSProperties;
const footerStyle = { padding: "56px 48px", backgroundColor: "#ffffff", borderTop: "1px solid #f3f4f6" } satisfies React.CSSProperties;
const footerWrapStyle = { maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24 } satisfies React.CSSProperties;
const footerBrandStyle = { fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 10 } satisfies React.CSSProperties;
const footerBodyStyle = { margin: 0, fontSize: 14, lineHeight: 1.65, color: "#6b7280" } satisfies React.CSSProperties;
const footerLinksWrapStyle = { display: "flex", gap: 24, flexWrap: "wrap" } satisfies React.CSSProperties;
const footerLinkStyle = { color: "#6b7280", textDecoration: "none", fontSize: 14 } satisfies React.CSSProperties;
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
const eyebrowStyle = {
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
} satisfies React.CSSProperties;
const heroTitleStyle = {
  margin: "0 0 22px",
  maxWidth: 760,
  fontSize: "clamp(40px, 5vw, 62px)",
  lineHeight: 1.04,
  letterSpacing: "-0.04em",
  fontWeight: 650,
  color: "#ffffff",
} satisfies React.CSSProperties;
const heroSubtitleStyle = {
  margin: "0 0 34px",
  maxWidth: 680,
  fontSize: 18,
  lineHeight: 1.72,
  color: "rgba(255,255,255,0.62)",
} satisfies React.CSSProperties;
const trustBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.76)",
  fontSize: 14,
} satisfies React.CSSProperties;
const visualEyebrowStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(148,163,184,0.14)",
  marginBottom: 18,
} satisfies React.CSSProperties;
const visualEyebrowTextStyle = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(226,232,240,0.7)",
} satisfies React.CSSProperties;
const visualStageIconWrapStyle = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
} satisfies React.CSSProperties;
const visualStageTitleStyle = { fontSize: 18, lineHeight: 1.35, fontWeight: 650, color: "#ffffff", marginBottom: 8 } satisfies React.CSSProperties;
const visualStageMetaStyle = { fontSize: 14, lineHeight: 1.65, color: "rgba(226,232,240,0.62)" } satisfies React.CSSProperties;
const visualScoreCardStyle = {
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(148,163,184,0.14)",
} satisfies React.CSSProperties;
const visualScoreLabelStyle = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226,232,240,0.54)", marginBottom: 8 } satisfies React.CSSProperties;
const visualScoreValueStyle = { fontSize: 40, lineHeight: 1, fontWeight: 700, color: "#ffffff", marginBottom: 8 } satisfies React.CSSProperties;
const visualScoreMetaStyle = { fontSize: 12, lineHeight: 1.6, color: "rgba(226,232,240,0.58)" } satisfies React.CSSProperties;
const visualPanelStyle = {
  padding: 16,
  borderRadius: 18,
  background: "linear-gradient(180deg, rgba(8,47,73,0.58), rgba(15,23,42,0.84))",
  border: "1px solid rgba(125,211,252,0.16)",
} satisfies React.CSSProperties;
const visualPanelLabelStyle = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(148,163,184,0.7)", marginBottom: 10 } satisfies React.CSSProperties;
const visualIssueItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.12)",
} satisfies React.CSSProperties;
const visualDotStyle = { width: 8, height: 8, borderRadius: 999, backgroundColor: "#2dd4bf" } satisfies React.CSSProperties;
const visualIssueTextStyle = { fontSize: 14, lineHeight: 1.55, color: "#f8fafc" } satisfies React.CSSProperties;
const visualNoteTitleStyle = { fontSize: 14, fontWeight: 650, color: "#ffffff", marginBottom: 6 } satisfies React.CSSProperties;
const visualNoteBodyStyle = { fontSize: 14, lineHeight: 1.65, color: "rgba(226,232,240,0.64)" } satisfies React.CSSProperties;

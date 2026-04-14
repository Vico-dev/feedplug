import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  FileJson2,
  Search,
  Sparkles,
  Tags,
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
  requirementsTitle: string;
  requirementsIntro: string;
  requirements: string[];
  linksTitle: string;
  linksIntro: string;
  ctaTitle: string;
  ctaBody: string;
  footerHome: string;
  footerDocs: string;
  footerAI: string;
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
  qualityLabel: string;
  qualityItems: string[];
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

const COPY: Record<Locale, PageCopy> = {
  fr: {
    heroEyebrow: "ChatGPT + assistants IA",
    heroTitle: "Diffusez votre feed produit dans ChatGPT",
    heroSubtitle:
      "Centralisez votre catalogue, scorez chaque fiche produit, enrichissez les attributs utiles et exportez un feed exploitable par ChatGPT sans reconstruire un canal a part.",
    primaryCta: "Demander une demo",
    secondaryCta: "Voir la page assistants IA",
    trust: ["Scoring produit 0-100", "Catalogue structure", "Feed pret pour les LLM"],
    painTitle: "Pourquoi un catalogue e-commerce n'est pas automatiquement exploitable par ChatGPT",
    pains: [
      "Un flux classique contient souvent assez d'information pour afficher un produit, mais pas assez pour alimenter une recherche conversationnelle fiable.",
      "Les titres, variantes, usages, marques et attributs utiles sont frequemment incomplets au niveau fiche produit.",
      "Sans scoring produit, il est difficile de savoir quelles fiches sont trop faibles pour les assistants IA et quelles corrections prioriser.",
      "Multiplier les exports dedies par canal cree vite des feeds fragiles a mesure que les usages IA evoluent.",
    ],
    methodTitle: "La methode FeedPlug pour preparer un feed produit ChatGPT",
    methodSubtitle:
      "FeedPlug part de votre catalogue existant, score la qualite de chaque fiche et produit un export structure exploitable par ChatGPT, Perplexity et les autres assistants IA.",
    steps: [
      {
        title: "Centralisez vos sources produit",
        body: "Shopify et les autres sources alimentent une base unique avec titres, descriptions, images, prix, liens, disponibilites et variantes.",
      },
      {
        title: "Scorez chaque fiche produit",
        body: "Le scoring produit met en avant les fiches trop pauvres, trop floues ou mal structurees pour la recherche conversationnelle.",
      },
      {
        title: "Renforcez les attributs utiles",
        body: "Marque, type, usages, variantes, prix, disponibilite, images et liens sont enrichis pour rendre le catalogue lisible par les LLM.",
      },
      {
        title: "Diffusez un export pret pour les assistants IA",
        body: "Vous publiez un feed structure sans reconstruire un flux separe pour chaque canal IA qui emerge.",
      },
    ],
    benefitsTitle: "Ce que FeedPlug apporte a votre feed ChatGPT",
    benefits: [
      "Le scoring produit permet de prioriser les fiches a corriger au lieu d'ouvrir le catalogue au hasard.",
      "Le catalogue reste exploitable pour ChatGPT tout en servant aussi vos autres canaux e-commerce.",
      "Les donnees produit deviennent plus lisibles, plus coherentes et plus faciles a maintenir dans le temps.",
      "Vous evitez de bricoler un export IA a la main a chaque evolution du catalogue.",
    ],
    requirementsTitle: "Ce qu'un feed produit exploitable par ChatGPT doit contenir",
    requirementsIntro:
      "Pour qu'un assistant IA comprenne votre offre, il faut plus qu'un simple SKU et un prix. Le feed doit rester interpretable, propre et riche au niveau produit.",
    requirements: [
      "Titre produit explicite avec marque, type et signaux distinctifs",
      "Descriptions et attributs lisibles pour comprendre l'usage du produit",
      "Prix, disponibilite, variantes et liens produits a jour",
      "Images et informations produits coherentes entre les sources",
      "Scoring produit pour reperer les fiches faibles avant diffusion",
      "Export structure reutilisable pour les assistants IA et futurs canaux",
    ],
    linksTitle: "Pour aller plus loin",
    linksIntro:
      "Retrouvez les autres pages utiles pour vos canaux IA, vos exports et vos integrations catalogue.",
    ctaTitle: "Besoin d'un feed produit propre pour ChatGPT ?",
    ctaBody:
      "Demandez une demo FeedPlug ou consultez la page assistants IA pour voir comment structurer votre catalogue avant diffusion.",
    footerHome: "Accueil",
    footerDocs: "Documentation",
    footerAI: "Assistants IA",
  },
  en: {
    heroEyebrow: "ChatGPT + AI assistants",
    heroTitle: "Distribute your product feed in ChatGPT",
    heroSubtitle:
      "Centralize your catalog, score every product listing, enrich useful attributes, and export a feed ChatGPT can actually use without rebuilding a separate channel.",
    primaryCta: "Request a demo",
    secondaryCta: "View AI assistants page",
    trust: ["Product scoring 0-100", "Structured catalog", "LLM-ready feed"],
    painTitle: "Why an e-commerce catalog is not automatically usable by ChatGPT",
    pains: [
      "A standard feed may be enough to display a product, but not enough to power reliable conversational discovery.",
      "Titles, variants, use cases, brands, and useful attributes are often incomplete at the product level.",
      "Without product scoring, it is hard to know which listings are too weak for AI assistants and what to fix first.",
      "Multiplying dedicated exports quickly creates fragile feeds as AI channels evolve.",
    ],
    methodTitle: "The FeedPlug method to prepare a ChatGPT product feed",
    methodSubtitle:
      "FeedPlug starts from your existing catalog, scores each listing, and publishes a structured export usable by ChatGPT, Perplexity, and other AI assistants.",
    steps: [
      {
        title: "Centralize your product sources",
        body: "Shopify and other sources feed a single layer with titles, descriptions, images, prices, links, availability, and variants.",
      },
      {
        title: "Score every product listing",
        body: "Product scoring highlights listings that are too weak, too vague, or too poorly structured for conversational discovery.",
      },
      {
        title: "Strengthen useful attributes",
        body: "Brand, type, use cases, variants, price, availability, images, and links are enriched so LLMs can interpret the catalog correctly.",
      },
      {
        title: "Publish an assistant-ready export",
        body: "You publish one structured feed without rebuilding a separate flow for every new AI channel.",
      },
    ],
    benefitsTitle: "What FeedPlug improves for your ChatGPT feed",
    benefits: [
      "Product scoring helps you prioritize weak listings instead of reviewing the catalog blindly.",
      "Your catalog stays usable for ChatGPT while still supporting your other commerce channels.",
      "Product data becomes clearer, more consistent, and easier to maintain over time.",
      "You avoid hand-built AI exports every time the catalog changes.",
    ],
    requirementsTitle: "What a ChatGPT-usable product feed should contain",
    requirementsIntro:
      "For an AI assistant to understand your offer, a SKU and a price are not enough. The feed must stay interpretable, clean, and rich at the product level.",
    requirements: [
      "Explicit product titles with brand, type, and differentiating signals",
      "Readable descriptions and attributes that explain product use",
      "Up-to-date prices, availability, variants, and product links",
      "Consistent images and product information across sources",
      "Product scoring to spot weak listings before distribution",
      "A structured export reusable across AI assistants and future channels",
    ],
    linksTitle: "Explore related pages",
    linksIntro:
      "Use these pages to understand AI distribution, exports, and catalog integrations.",
    ctaTitle: "Need a cleaner product feed for ChatGPT?",
    ctaBody:
      "Request a FeedPlug demo or review the AI assistants page to see how to structure your catalog before distribution.",
    footerHome: "Home",
    footerDocs: "Documentation",
    footerAI: "AI assistants",
  },
  es: {
    heroEyebrow: "ChatGPT + asistentes IA",
    heroTitle: "Distribuye tu feed de productos en ChatGPT",
    heroSubtitle:
      "Centraliza tu catalogo, puntua cada ficha de producto, mejora los atributos utiles y exporta un feed que ChatGPT pueda usar sin reconstruir un canal aparte.",
    primaryCta: "Solicitar una demo",
    secondaryCta: "Ver la pagina de asistentes IA",
    trust: ["Scoring de producto 0-100", "Catalogo estructurado", "Feed listo para LLM"],
    painTitle: "Por que un catalogo e-commerce no es automaticamente usable por ChatGPT",
    pains: [
      "Un feed clasico suele bastar para mostrar un producto, pero no para una busqueda conversacional fiable.",
      "Titulos, variantes, usos, marcas y atributos utiles suelen estar incompletos a nivel ficha.",
      "Sin scoring de producto es dificil saber que fichas son demasiado debiles para asistentes IA y que corregir primero.",
      "Multiplicar exportaciones dedicadas crea feeds fragiles a medida que evolucionan los canales IA.",
    ],
    methodTitle: "El metodo FeedPlug para preparar un feed de productos para ChatGPT",
    methodSubtitle:
      "FeedPlug parte de tu catalogo actual, puntua cada ficha y publica una exportacion estructurada util para ChatGPT, Perplexity y otros asistentes IA.",
    steps: [
      {
        title: "Centraliza tus fuentes de producto",
        body: "Shopify y otras fuentes alimentan una capa unica con titulos, descripciones, imagenes, precios, enlaces, stock y variantes.",
      },
      {
        title: "Puntua cada ficha de producto",
        body: "El scoring de producto destaca fichas demasiado debiles, vagas o mal estructuradas para la busqueda conversacional.",
      },
      {
        title: "Refuerza los atributos utiles",
        body: "Marca, tipo, usos, variantes, precio, stock, imagenes y enlaces se mejoran para que los LLM interpreten el catalogo correctamente.",
      },
      {
        title: "Publica una exportacion lista para asistentes IA",
        body: "Publicas un feed estructurado sin reconstruir un flujo separado para cada nuevo canal IA.",
      },
    ],
    benefitsTitle: "Lo que FeedPlug mejora para tu feed ChatGPT",
    benefits: [
      "El scoring de producto ayuda a priorizar fichas debiles en lugar de revisar el catalogo a ciegas.",
      "Tu catalogo sigue siendo util para ChatGPT y para tus otros canales de comercio.",
      "Los datos de producto se vuelven mas claros, coherentes y faciles de mantener.",
      "Evitas rehacer una exportacion IA manual cada vez que cambia el catalogo.",
    ],
    requirementsTitle: "Lo que debe contener un feed de productos usable por ChatGPT",
    requirementsIntro:
      "Para que un asistente IA entienda tu oferta, no basta con un SKU y un precio. El feed debe ser interpretable, limpio y rico a nivel producto.",
    requirements: [
      "Titulos de producto explicitos con marca, tipo y senales diferenciadoras",
      "Descripciones y atributos legibles para entender el uso del producto",
      "Precios, stock, variantes y enlaces actualizados",
      "Imagenes e informacion de producto coherentes entre fuentes",
      "Scoring de producto para detectar fichas debiles antes de publicar",
      "Una exportacion estructurada reutilizable para asistentes IA y nuevos canales",
    ],
    linksTitle: "Para seguir avanzando",
    linksIntro: "Usa estas paginas para entender la difusion IA, las exportaciones y las integraciones de catalogo.",
    ctaTitle: "Necesitas un feed de productos mas limpio para ChatGPT?",
    ctaBody:
      "Solicita una demo de FeedPlug o consulta la pagina de asistentes IA para ver como estructurar tu catalogo antes de publicarlo.",
    footerHome: "Inicio",
    footerDocs: "Documentacion",
    footerAI: "Asistentes IA",
  },
};

const SCREEN_COPY: Record<Locale, ScreenCopy> = {
  fr: {
    eyebrow: "De votre catalogue vers ChatGPT",
    stageSource: "Catalogue centralise",
    stageSourceMeta: "Titres, variantes, prix, images et disponibilites unifies.",
    stageScore: "Scoring produit",
    stageScoreMeta: "Chaque fiche est evaluee avant diffusion vers les assistants IA.",
    stageExport: "Feed ChatGPT pret",
    stageExportMeta: "Export structure, stable et reutilisable pour les LLM.",
    scoreLabel: "Scoring produit",
    scoreMeta: "84 / 100 sur la fiche prioritaire",
    qualityLabel: "Qualite fiche",
    qualityItems: ["Marque explicite", "Attributs complets", "Lien et image propres"],
    resultTitle: "Ce que capte immediatement le client",
    resultBody: "Un catalogue plus lisible, des fiches mieux structurees et un feed pret pour la recherche conversationnelle.",
    answerTitle: "Pret a repondre dans ChatGPT",
    answerBody: "Produit, usage, disponibilite et lien fiche peuvent etre interpretes sans bricolage manuel.",
  },
  en: {
    eyebrow: "From your catalog into ChatGPT",
    stageSource: "Centralized catalog",
    stageSourceMeta: "Titles, variants, prices, images, and availability unified.",
    stageScore: "Product scoring",
    stageScoreMeta: "Each listing is scored before distribution to AI assistants.",
    stageExport: "ChatGPT-ready feed",
    stageExportMeta: "Structured, stable export reusable across LLM channels.",
    scoreLabel: "Product scoring",
    scoreMeta: "84 / 100 on the priority listing",
    qualityLabel: "Listing quality",
    qualityItems: ["Explicit brand", "Complete attributes", "Clean link and image"],
    resultTitle: "What the client sees immediately",
    resultBody: "A clearer catalog, better-structured listings, and a feed ready for conversational discovery.",
    answerTitle: "Ready to answer in ChatGPT",
    answerBody: "Product, usage, availability, and link data can be interpreted without manual patchwork.",
  },
  es: {
    eyebrow: "De tu catalogo hacia ChatGPT",
    stageSource: "Catalogo centralizado",
    stageSourceMeta: "Titulos, variantes, precios, imagenes y stock unificados.",
    stageScore: "Scoring de producto",
    stageScoreMeta: "Cada ficha se puntua antes de difundirse a asistentes IA.",
    stageExport: "Feed listo para ChatGPT",
    stageExportMeta: "Exportacion estructurada, estable y reutilizable para LLM.",
    scoreLabel: "Scoring de producto",
    scoreMeta: "84 / 100 en la ficha prioritaria",
    qualityLabel: "Calidad de ficha",
    qualityItems: ["Marca explicita", "Atributos completos", "Enlace e imagen limpios"],
    resultTitle: "Lo que el cliente entiende de inmediato",
    resultBody: "Un catalogo mas claro, fichas mejor estructuradas y un feed listo para la busqueda conversacional.",
    answerTitle: "Listo para responder en ChatGPT",
    answerBody: "Producto, uso, disponibilidad y enlace pueden interpretarse sin bricolaje manual.",
  },
};

const FAQ_COPY: Record<Locale, FAQCopy> = {
  fr: {
    title: "Questions frequentes sur les feeds produit pour ChatGPT",
    intro:
      "Ces questions reviennent souvent quand une marque veut rendre son catalogue plus lisible pour ChatGPT, Perplexity et les autres assistants IA.",
    items: [
      {
        question: "ChatGPT peut-il exploiter un feed produit classique tel quel ?",
        answer:
          "Pas vraiment. Un feed classique peut suffire pour afficher un produit, mais pas toujours pour une recherche conversationnelle. Il faut un niveau de structure et de clarte plus eleve au niveau fiche.",
      },
      {
        question: "Que doit contenir un feed produit exploitable par ChatGPT ?",
        answer:
          "Il faut des titres explicites, des attributs lisibles, des usages clairs, des variantes, des prix, des disponibilites et des liens produits coherents pour que le modele comprenne l'offre.",
      },
      {
        question: "Pourquoi le scoring produit compte pour les assistants IA ?",
        answer:
          "Le scoring produit aide a reperer les fiches trop pauvres, trop floues ou mal structurees avant diffusion. Vous savez quelles fiches renforcer en priorite.",
      },
      {
        question: "Faut-il creer un export distinct pour chaque canal IA ?",
        answer:
          "Pas idealement. Le but est plutot de partir d'une base catalogue propre et de publier un export structure reutilisable a mesure que de nouveaux canaux IA apparaissent.",
      },
    ],
  },
  en: {
    title: "Frequently asked questions about product feeds for ChatGPT",
    intro:
      "These questions come up often when a brand wants a catalog that is easier for ChatGPT, Perplexity, and other AI assistants to understand.",
    items: [
      {
        question: "Can ChatGPT use a standard product feed as-is?",
        answer:
          "Not really. A standard feed may be enough to display a product, but not always enough for conversational discovery. You need more structure and clarity at the listing level.",
      },
      {
        question: "What should a ChatGPT-usable product feed contain?",
        answer:
          "It should include explicit titles, readable attributes, clear use cases, variants, prices, availability, and consistent product links so the model can interpret the offer correctly.",
      },
      {
        question: "Why does product scoring matter for AI assistants?",
        answer:
          "Product scoring helps identify listings that are too weak, too vague, or too poorly structured before distribution. You see which products need to be improved first.",
      },
      {
        question: "Do you need a separate export for every AI channel?",
        answer:
          "Ideally no. The goal is to start from a clean catalog base and publish a structured export that remains reusable as new AI channels appear.",
      },
    ],
  },
  es: {
    title: "Preguntas frecuentes sobre feeds de producto para ChatGPT",
    intro:
      "Estas preguntas aparecen a menudo cuando una marca quiere que su catalogo sea mas legible para ChatGPT, Perplexity y otros asistentes IA.",
    items: [
      {
        question: "Puede ChatGPT usar un feed de producto clasico tal cual?",
        answer:
          "No del todo. Un feed clasico puede bastar para mostrar un producto, pero no siempre para una busqueda conversacional. Hace falta mas estructura y claridad a nivel ficha.",
      },
      {
        question: "Que debe contener un feed de producto usable por ChatGPT?",
        answer:
          "Debe incluir titulos explicitos, atributos legibles, usos claros, variantes, precios, stock y enlaces coherentes para que el modelo entienda correctamente la oferta.",
      },
      {
        question: "Por que importa el scoring de producto para asistentes IA?",
        answer:
          "El scoring de producto ayuda a detectar fichas demasiado debiles, vagas o mal estructuradas antes de publicar. Ves que productos reforzar primero.",
      },
      {
        question: "Hace falta una exportacion distinta para cada canal IA?",
        answer:
          "Idealmente no. La idea es partir de una base de catalogo limpia y publicar una exportacion estructurada reutilizable a medida que aparecen nuevos canales IA.",
      },
    ],
  },
};

const STEP_ICONS = [Database, Sparkles, Tags, FileJson2];

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

export default async function ChatGPTProductFeedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = getCopy(locale);
  const screenCopy = getScreenCopy(locale);
  const faqCopy = getFaqCopy(locale);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "#111827" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .chatgpt-feed-shell { font-family: var(--font-geist-sans), sans-serif; }
            .chatgpt-feed-fade { animation: chatgptFeedFadeUp .72s ease-out forwards; }
            .chatgpt-feed-delay-1 { animation-delay: .08s; opacity: 0; }
            .chatgpt-feed-delay-2 { animation-delay: .16s; opacity: 0; }
            .chatgpt-feed-delay-3 { animation-delay: .24s; opacity: 0; }
            .chatgpt-feed-card {
              transition: transform .2s ease, box-shadow .25s ease, border-color .2s ease;
            }
            .chatgpt-feed-card:hover {
              transform: translateY(-3px);
              box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08);
              border-color: #cbd5e1;
            }
            .chatgpt-feed-visual-shell {
              position: relative;
              overflow: hidden;
              border-radius: 28px;
              background: linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.96) 100%);
              border: 1px solid rgba(148,163,184,0.16);
              box-shadow: 0 28px 72px rgba(2, 6, 23, 0.34), inset 0 1px 0 rgba(255,255,255,0.07);
            }
            .chatgpt-feed-visual-shell::before {
              content: "";
              position: absolute;
              inset: -18% 48% auto -8%;
              height: 220px;
              background: radial-gradient(circle, rgba(59,130,246,0.24) 0%, rgba(59,130,246,0) 72%);
              pointer-events: none;
            }
            .chatgpt-feed-visual-shell::after {
              content: "";
              position: absolute;
              inset: auto -10% -24% 44%;
              width: 220px;
              height: 220px;
              background: radial-gradient(circle, rgba(45,212,191,0.18) 0%, rgba(45,212,191,0) 72%);
              pointer-events: none;
            }
            .chatgpt-feed-gridline {
              position: absolute;
              inset: 0;
              background-image:
                linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px);
              background-size: 100% 54px, 54px 100%;
              mask-image: linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0));
              pointer-events: none;
            }
            .chatgpt-feed-pulse { animation: chatgptFeedPulse 1.9s ease-in-out infinite; }
            @keyframes chatgptFeedFadeUp {
              from { opacity: 0; transform: translateY(18px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes chatgptFeedPulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.16); opacity: .76; }
            }
            @media (max-width: 920px) {
              .chatgpt-feed-hero-grid { grid-template-columns: 1fr !important; }
              .chatgpt-feed-two-col { grid-template-columns: 1fr !important; }
            }
            @media (max-width: 768px) {
              .chatgpt-feed-hero { padding: 112px 24px 72px !important; }
              .chatgpt-feed-section { padding-left: 24px !important; padding-right: 24px !important; }
              .chatgpt-feed-grid-4 { grid-template-columns: 1fr !important; }
              .chatgpt-feed-grid-3 { grid-template-columns: 1fr !important; }
            }
            @media (max-width: 480px) {
              .chatgpt-feed-hero { padding: 96px 20px 56px !important; }
              .chatgpt-feed-section { padding-left: 20px !important; padding-right: 20px !important; }
            }
          `,
        }}
      />
      {createFaqJsonLd(faqCopy.items)}

      <div className="chatgpt-feed-shell">
        <MarketingHeader />

        <section
          className="chatgpt-feed-hero chatgpt-feed-section"
          style={{
            position: "relative",
            padding: "120px 48px 88px",
            background:
              "radial-gradient(circle at top right, rgba(59,130,246,0.18), transparent 28%), radial-gradient(circle at bottom left, rgba(45,212,191,0.12), transparent 24%), #111827",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(17,24,39,0) 28%, rgba(17,24,39,0.18) 100%)",
            }}
          />

          <div
            className="chatgpt-feed-hero-grid"
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
                className="chatgpt-feed-fade"
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
                <Bot style={{ width: 16, height: 16 }} />
                {copy.heroEyebrow}
              </div>

              <h1
                className="chatgpt-feed-fade chatgpt-feed-delay-1"
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
                className="chatgpt-feed-fade chatgpt-feed-delay-2"
                style={{
                  margin: "0 0 34px",
                  maxWidth: 680,
                  fontSize: 18,
                  lineHeight: 1.72,
                  color: "rgba(255,255,255,0.62)",
                }}
              >
                {copy.heroSubtitle}
              </p>

              <div
                className="chatgpt-feed-fade chatgpt-feed-delay-3"
                style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 }}
              >
                <Link href="/demo?source=use_case_demo" style={primaryHeroCtaStyle}>
                  {copy.primaryCta}
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </Link>
                <Link href="/distribution-assistants-ia" style={secondaryHeroCtaStyle}>
                  {copy.secondaryCta}
                </Link>
              </div>

              <div
                className="chatgpt-feed-fade chatgpt-feed-delay-3"
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

            <aside className="chatgpt-feed-fade chatgpt-feed-delay-3" style={{ width: "100%", marginLeft: "auto" }}>
              <ChatGPTFeedShowcase copy={screenCopy} />
            </aside>
          </div>
        </section>

        <section className="chatgpt-feed-section" style={{ padding: "88px 48px", backgroundColor: "#ffffff" }}>
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
              className="chatgpt-feed-grid-4"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 18,
              }}
            >
              {copy.pains.map((item) => (
                <div
                  key={item}
                  className="chatgpt-feed-card"
                  style={{
                    padding: 24,
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <Search style={{ width: 18, height: 18, color: "#2563eb", marginBottom: 14 }} />
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#475569" }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="chatgpt-feed-section"
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
              className="chatgpt-feed-grid-4"
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
                    className="chatgpt-feed-card"
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
                        backgroundColor: "#e0f2fe",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 18,
                      }}
                    >
                      <Icon style={{ width: 20, height: 20, color: "#0369a1" }} />
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

        <section className="chatgpt-feed-section" style={{ padding: "88px 48px", backgroundColor: "#ffffff" }}>
          <div
            className="chatgpt-feed-two-col"
            style={{
              maxWidth: 1080,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.95fr)",
              gap: 28,
            }}
          >
            <div
              className="chatgpt-feed-card"
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
              className="chatgpt-feed-card"
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
                {copy.requirementsTitle}
              </h2>
              <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.72, color: "#cbd5e1" }}>
                {copy.requirementsIntro}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10 }}>
                {copy.requirements.map((item) => (
                  <li key={item} style={{ fontSize: 15, lineHeight: 1.72, color: "#ffffff" }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          className="chatgpt-feed-section"
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
              className="chatgpt-feed-grid-3"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 18,
              }}
            >
              <Link href="/distribution-assistants-ia" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/distribution-assistants-ia</span>
                <span style={linkCardTextStyle}>Voir la page plus large dediee aux canaux conversationnels et assistants IA.</span>
              </Link>
              <Link href="/docs/export" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/docs/export</span>
                <span style={linkCardTextStyle}>Comprendre le role des exports structures et des formats de diffusion.</span>
              </Link>
              <Link href="/integrations" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/integrations</span>
                <span style={linkCardTextStyle}>Retrouver les sources catalogue et canaux relies a FeedPlug.</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="chatgpt-feed-section" style={{ padding: "88px 48px", backgroundColor: "#ffffff" }}>
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
                  className="chatgpt-feed-card"
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
          className="chatgpt-feed-section"
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
              <Link href="/distribution-assistants-ia" style={secondaryDarkCtaStyle}>
                {copy.secondaryCta}
              </Link>
            </div>
          </div>
        </section>

        <footer
          className="chatgpt-feed-section"
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
            <div style={{ maxWidth: 320 }}>
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
              <Link href="/distribution-assistants-ia" style={footerLinkStyle}>
                {copy.footerAI}
              </Link>
              <Link href="/docs/export" style={footerLinkStyle}>
                /docs/export
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

function ChatGPTFeedShowcase({ copy }: { copy: ScreenCopy }) {
  return (
    <div className="chatgpt-feed-visual-shell">
      <div className="chatgpt-feed-gridline" />

      <div style={{ position: "relative", zIndex: 1, padding: 26 }}>
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
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(226,232,240,0.7)",
            }}
          >
            {copy.eyebrow}
          </span>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <VisualStage
            icon={<Database style={{ width: 18, height: 18, color: "#bfdbfe" }} />}
            title={copy.stageSource}
            meta={copy.stageSourceMeta}
          />
          <VisualStage
            icon={<Sparkles style={{ width: 18, height: 18, color: "#99f6e4" }} />}
            title={copy.stageScore}
            meta={copy.stageScoreMeta}
            active
          />
          <VisualStage
            icon={<Bot style={{ width: 18, height: 18, color: "#bfdbfe" }} />}
            title={copy.stageExport}
            meta={copy.stageExportMeta}
          />
        </div>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(0, 148px) minmax(0, 1fr)",
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
              {copy.scoreLabel}
            </div>
            <div style={{ fontSize: 40, lineHeight: 1, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>84</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(226,232,240,0.58)" }}>{copy.scoreMeta}</div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: "linear-gradient(180deg, rgba(8,47,73,0.58), rgba(15,23,42,0.84))",
              border: "1px solid rgba(125,211,252,0.16)",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(148,163,184,0.7)", marginBottom: 10 }}>
              {copy.qualityLabel}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {copy.qualityItems.map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(148,163,184,0.12)",
                  }}
                >
                  <span
                    className="chatgpt-feed-pulse"
                    style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#2dd4bf" }}
                  />
                  <span style={{ fontSize: 14, lineHeight: 1.55, color: "#f8fafc" }}>{item}</span>
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
      className="chatgpt-feed-card"
      style={{
        padding: 18,
        borderRadius: 20,
        background: active ? "rgba(34,211,238,0.09)" : "rgba(255,255,255,0.04)",
        border: active ? "1px solid rgba(103,232,249,0.2)" : "1px solid rgba(148,163,184,0.14)",
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
          <div style={{ fontSize: 18, lineHeight: 1.35, fontWeight: 650, color: "#ffffff", marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(226,232,240,0.62)" }}>{meta}</div>
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
      <div style={{ fontSize: 14, fontWeight: 650, color: "#ffffff", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(226,232,240,0.64)" }}>{body}</div>
    </div>
  );
}

import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  PackageCheck,
  RefreshCw,
  ScanSearch,
  ShoppingCart,
  Sparkles,
  Tags,
} from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { createFaqJsonLd } from "@/lib/lp-metadata";
import { getAuditCta } from "@/lib/audit-cta";
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
  footerAmazon: string;
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
    heroEyebrow: "Amazon + Shopify",
    heroTitle: "Exportez votre catalogue Shopify vers Amazon",
    heroSubtitle:
      "Connectez Shopify, scorez chaque fiche produit, corrigez les attributs critiques Amazon et diffusez un feed Seller Central propre sans refaire vos fiches a la main.",
    primaryCta: "Demander une demo",
    secondaryCta: "Voir la page Amazon",
    trust: ["Scoring produit 0-100", "Variantes et GTIN verifies", "Feed pret pour Seller Central"],
    painTitle: "Les blocages frequents entre Shopify et Amazon",
    pains: [
      "Shopify ne suffit pas a preparer seul un catalogue propre pour Amazon et Seller Central.",
      "Les variantes, GTIN, marques, bullet points et attributs attendus par Amazon restent souvent incomplets au niveau fiche.",
      "Sans scoring produit, il est difficile de prioriser les fiches qui vont bloquer ou sous-performer sur Amazon.",
      "Quand le catalogue evolue vite, les exports manuels deviennent fragiles et les erreurs reviennent a chaque mise a jour.",
    ],
    methodTitle: "La methode FeedPlug pour passer de Shopify a Amazon",
    methodSubtitle:
      "FeedPlug centralise votre catalogue Shopify, score les fiches a risque, renforce les attributs utiles a Amazon et produit un export plus stable pour Seller Central.",
    steps: [
      {
        title: "Connectez Shopify comme source principale",
        body: "FeedPlug recupere titres, variantes, prix, images, stock et liens produits dans une base unique qui reste synchronisee.",
      },
      {
        title: "Scorez chaque fiche produit",
        body: "Le scoring produit met en avant les fiches trop faibles pour Amazon et les dimensions qui doivent etre renforcees avant export.",
      },
      {
        title: "Corrigez les attributs critiques Amazon",
        body: "Marque, GTIN, variations, bullet points, prix, stock et descriptifs sont consolides pour limiter les blocages et clarifier la fiche.",
      },
      {
        title: "Exportez un feed Seller Central plus propre",
        body: "Vous publiez un feed Amazon structure qui suit les changements Shopify sans devoir reconstruire un fichier manuellement.",
      },
    ],
    benefitsTitle: "Ce que FeedPlug apporte a votre feed Amazon Shopify",
    benefits: [
      "Le scoring produit permet de prioriser les fiches Amazon a corriger au lieu de parcourir le catalogue au hasard.",
      "Votre catalogue Shopify devient une source unique pour Amazon et vos autres canaux.",
      "Les variantes, attributs obligatoires et informations produit restent plus coherents dans le temps.",
      "Vous reduisez le temps passe a corriger des exports manuels et a reconstituer les memes champs a chaque mise a jour.",
    ],
    requirementsTitle: "Ce qu'un feed Amazon propre depuis Shopify doit contenir",
    requirementsIntro:
      "Pour qu'un catalogue Shopify soit exploitable sur Amazon, il faut un niveau de structure superieur a un simple export produit. Le feed doit rester lisible, complet et actionnable dans Seller Central.",
    requirements: [
      "Titres produits clairs avec marque, type et signaux differenciants",
      "GTIN, marque, variations et attributs obligatoires correctement renseignes",
      "Prix, disponibilite, images et liens produits a jour",
      "Bullet points et descriptifs plus lisibles pour Amazon",
      "Scoring produit pour reperer les fiches faibles avant diffusion",
      "Export structure qui suit les mises a jour Shopify sans bricolage manuel",
    ],
    linksTitle: "Pour aller plus loin",
    linksIntro:
      "Retrouvez les pages utiles pour vos exports Amazon, vos integrations catalogue et la page Amazon plus generale.",
    ctaTitle: "Besoin d'un feed Amazon propre depuis Shopify ?",
    ctaBody:
      "Demandez une demo FeedPlug ou consultez la page Amazon pour voir comment structurer vos fiches avant export vers Seller Central.",
    footerHome: "Accueil",
    footerDocs: "Documentation",
    footerAmazon: "Amazon",
  },
  en: {
    heroEyebrow: "Amazon + Shopify",
    heroTitle: "Export your Shopify catalog to Amazon",
    heroSubtitle:
      "Connect Shopify, score every product listing, fix critical Amazon attributes, and publish a cleaner Seller Central feed without rebuilding listings manually.",
    primaryCta: "Request a demo",
    secondaryCta: "View Amazon page",
    trust: ["Product scoring 0-100", "Variants and GTIN checked", "Seller Central-ready feed"],
    painTitle: "Common blockers between Shopify and Amazon",
    pains: [
      "Shopify alone does not prepare a clean catalog for Amazon and Seller Central.",
      "Variants, GTINs, brands, bullet points, and Amazon-specific attributes are often incomplete at the listing level.",
      "Without product scoring, it is hard to prioritize listings that will block or underperform on Amazon.",
      "When the catalog changes quickly, manual exports become fragile and the same errors keep coming back.",
    ],
    methodTitle: "The FeedPlug method from Shopify to Amazon",
    methodSubtitle:
      "FeedPlug centralizes your Shopify catalog, scores risky listings, strengthens Amazon-relevant attributes, and outputs a more stable export for Seller Central.",
    steps: [
      {
        title: "Connect Shopify as your main source",
        body: "FeedPlug pulls titles, variants, prices, images, stock, and product links into one synchronized layer.",
      },
      {
        title: "Score every listing",
        body: "Product scoring highlights weak Amazon listings and the quality dimensions that need to be improved before export.",
      },
      {
        title: "Fix critical Amazon attributes",
        body: "Brand, GTIN, variations, bullet points, price, stock, and descriptions are strengthened to reduce blockers and clarify the listing.",
      },
      {
        title: "Export a cleaner Seller Central feed",
        body: "You publish a structured Amazon feed that follows Shopify changes without rebuilding files manually.",
      },
    ],
    benefitsTitle: "What FeedPlug improves for your Amazon Shopify feed",
    benefits: [
      "Product scoring helps you prioritize Amazon listings instead of reviewing the catalog blindly.",
      "Your Shopify catalog becomes a single source for Amazon and your other channels.",
      "Variants, required attributes, and product information stay more consistent over time.",
      "You spend less time fixing manual exports and recreating the same fields after each update.",
    ],
    requirementsTitle: "What a clean Amazon feed from Shopify should contain",
    requirementsIntro:
      "For a Shopify catalog to work on Amazon, it needs more structure than a basic product export. The feed must stay readable, complete, and actionable in Seller Central.",
    requirements: [
      "Clear product titles with brand, type, and differentiating signals",
      "Correct GTIN, brand, variations, and required attributes",
      "Up-to-date prices, availability, images, and product links",
      "Better bullet points and descriptions for Amazon",
      "Product scoring to spot weak listings before distribution",
      "A structured export that follows Shopify updates without manual patchwork",
    ],
    linksTitle: "Explore related pages",
    linksIntro:
      "Use these pages for Amazon exports, catalog integrations, and the broader Amazon landing page.",
    ctaTitle: "Need a cleaner Amazon feed from Shopify?",
    ctaBody:
      "Request a FeedPlug demo or review the Amazon page to see how to structure your listings before exporting to Seller Central.",
    footerHome: "Home",
    footerDocs: "Documentation",
    footerAmazon: "Amazon",
  },
  es: {
    heroEyebrow: "Amazon + Shopify",
    heroTitle: "Exporta tu catalogo de Shopify a Amazon",
    heroSubtitle:
      "Conecta Shopify, puntua cada ficha de producto, corrige atributos criticos de Amazon y publica un feed mas limpio para Seller Central sin rehacer fichas manualmente.",
    primaryCta: "Solicitar una demo",
    secondaryCta: "Ver la pagina Amazon",
    trust: ["Scoring de producto 0-100", "Variantes y GTIN verificados", "Feed listo para Seller Central"],
    painTitle: "Bloqueos frecuentes entre Shopify y Amazon",
    pains: [
      "Shopify por si solo no prepara un catalogo limpio para Amazon y Seller Central.",
      "Las variantes, GTIN, marcas, bullet points y atributos esperados por Amazon suelen quedar incompletos a nivel ficha.",
      "Sin scoring de producto es dificil priorizar las fichas que bloquearan o rendiran mal en Amazon.",
      "Cuando el catalogo cambia rapido, las exportaciones manuales se vuelven fragiles y los mismos errores reaparecen.",
    ],
    methodTitle: "El metodo FeedPlug para pasar de Shopify a Amazon",
    methodSubtitle:
      "FeedPlug centraliza tu catalogo Shopify, puntua las fichas con riesgo, refuerza atributos utiles para Amazon y genera una exportacion mas estable para Seller Central.",
    steps: [
      {
        title: "Conecta Shopify como fuente principal",
        body: "FeedPlug recupera titulos, variantes, precios, imagenes, stock y enlaces de producto en una capa unica sincronizada.",
      },
      {
        title: "Puntua cada ficha de producto",
        body: "El scoring de producto destaca las fichas mas debiles para Amazon y las dimensiones que hay que reforzar antes de exportar.",
      },
      {
        title: "Corrige atributos criticos de Amazon",
        body: "Marca, GTIN, variaciones, bullet points, precio, stock y descripciones se refuerzan para reducir bloqueos y aclarar la ficha.",
      },
      {
        title: "Exporta un feed mas limpio para Seller Central",
        body: "Publicas un feed Amazon estructurado que sigue los cambios de Shopify sin reconstruir archivos manualmente.",
      },
    ],
    benefitsTitle: "Lo que FeedPlug mejora para tu feed Amazon Shopify",
    benefits: [
      "El scoring de producto ayuda a priorizar fichas Amazon en lugar de revisar el catalogo a ciegas.",
      "Tu catalogo Shopify se convierte en una fuente unica para Amazon y otros canales.",
      "Las variantes, atributos obligatorios e informacion de producto se mantienen mas coherentes con el tiempo.",
      "Reduces el tiempo dedicado a corregir exportaciones manuales y reconstruir los mismos campos en cada cambio.",
    ],
    requirementsTitle: "Lo que debe contener un feed Amazon limpio desde Shopify",
    requirementsIntro:
      "Para que un catalogo Shopify funcione en Amazon, necesita mas estructura que una exportacion basica. El feed debe seguir siendo legible, completo y accionable en Seller Central.",
    requirements: [
      "Titulos claros con marca, tipo y senales diferenciadoras",
      "GTIN, marca, variaciones y atributos obligatorios correctos",
      "Precios, stock, imagenes y enlaces actualizados",
      "Bullet points y descripciones mas utiles para Amazon",
      "Scoring de producto para detectar fichas debiles antes de publicar",
      "Una exportacion estructurada que siga las actualizaciones de Shopify sin bricolaje manual",
    ],
    linksTitle: "Para seguir avanzando",
    linksIntro:
      "Usa estas paginas para exportaciones Amazon, integraciones de catalogo y la landing Amazon mas general.",
    ctaTitle: "Necesitas un feed Amazon mas limpio desde Shopify?",
    ctaBody:
      "Solicita una demo de FeedPlug o consulta la pagina Amazon para ver como estructurar tus fichas antes de exportar a Seller Central.",
    footerHome: "Inicio",
    footerDocs: "Documentacion",
    footerAmazon: "Amazon",
  },
};

const SCREEN_COPY: Record<Locale, ScreenCopy> = {
  fr: {
    eyebrow: "De Shopify vers Amazon",
    stageSource: "Catalogue Shopify synchronise",
    stageSourceMeta: "Titres, variantes, prix, images et stock centralises.",
    stageScore: "Scoring produit et conformite",
    stageScoreMeta: "Les fiches trop faibles pour Amazon remontent tout de suite.",
    stageExport: "Feed Seller Central pret",
    stageExportMeta: "Export structure et plus stable pour Amazon.",
    scoreLabel: "Scoring produit",
    scoreMeta: "82 / 100 sur la fiche prioritaire",
    qualityLabel: "Qualite fiche Amazon",
    qualityItems: ["GTIN present", "Variantes propres", "Bullet points renforces"],
    resultTitle: "Ce que l'equipe voit tout de suite",
    resultBody: "Les fiches Amazon a corriger, les attributs manquants et les priorites avant export.",
    answerTitle: "Pret pour Seller Central",
    answerBody: "Titre, marque, variations, prix, stock et liens produits sont lisibles et reutilisables dans Amazon.",
  },
  en: {
    eyebrow: "From Shopify to Amazon",
    stageSource: "Shopify catalog synced",
    stageSourceMeta: "Titles, variants, prices, images, and stock centralized.",
    stageScore: "Product scoring and compliance",
    stageScoreMeta: "Weak Amazon listings surface immediately.",
    stageExport: "Seller Central-ready feed",
    stageExportMeta: "Structured, more stable export for Amazon.",
    scoreLabel: "Product scoring",
    scoreMeta: "82 / 100 on the priority listing",
    qualityLabel: "Amazon listing quality",
    qualityItems: ["GTIN present", "Clean variants", "Stronger bullet points"],
    resultTitle: "What the team sees immediately",
    resultBody: "Which Amazon listings to fix, which attributes are missing, and what to prioritize before export.",
    answerTitle: "Ready for Seller Central",
    answerBody: "Title, brand, variations, price, stock, and product links are readable and reusable inside Amazon.",
  },
  es: {
    eyebrow: "De Shopify a Amazon",
    stageSource: "Catalogo Shopify sincronizado",
    stageSourceMeta: "Titulos, variantes, precios, imagenes y stock centralizados.",
    stageScore: "Scoring de producto y cumplimiento",
    stageScoreMeta: "Las fichas mas debiles para Amazon aparecen enseguida.",
    stageExport: "Feed listo para Seller Central",
    stageExportMeta: "Exportacion estructurada y mas estable para Amazon.",
    scoreLabel: "Scoring de producto",
    scoreMeta: "82 / 100 en la ficha prioritaria",
    qualityLabel: "Calidad de ficha Amazon",
    qualityItems: ["GTIN presente", "Variantes limpias", "Bullet points reforzados"],
    resultTitle: "Lo que el equipo ve de inmediato",
    resultBody: "Que fichas Amazon corregir, que atributos faltan y que priorizar antes de exportar.",
    answerTitle: "Listo para Seller Central",
    answerBody: "Titulo, marca, variaciones, precio, stock y enlaces de producto quedan legibles y reutilizables en Amazon.",
  },
};

const FAQ_COPY: Record<Locale, FAQCopy> = {
  fr: {
    title: "Questions frequentes sur Amazon et Shopify",
    intro:
      "Ces questions reviennent souvent quand une marque veut structurer un feed Seller Central sans perdre le lien avec son catalogue Shopify.",
    items: [
      {
        question: "Comment envoyer un catalogue Shopify vers Amazon Seller Central ?",
        answer:
          "Il faut partir d'une source catalogue fiable, renforcer les attributs critiques Amazon et publier un export structure qui suit les changements Shopify au lieu d'un fichier manuel ponctuel.",
      },
      {
        question: "Quels champs bloquent le plus souvent un feed Amazon ?",
        answer:
          "Les blocages viennent souvent du GTIN, de la marque, des variations, des bullet points, des images, du prix ou du stock. Ces dimensions doivent etre propres au niveau produit.",
      },
      {
        question: "Pourquoi le scoring produit est-il utile pour Amazon ?",
        answer:
          "Il aide a voir rapidement quelles fiches sont trop faibles ou trop incompletes pour Seller Central. Vous priorisez les produits a corriger au lieu de reprendre tout le catalogue.",
      },
      {
        question: "Le meme catalogue peut-il servir Amazon et d'autres canaux ?",
        answer:
          "Oui. Une base produit bien structuree peut alimenter Amazon, Google Shopping et d'autres canaux sans recreer la meme logique d'export a chaque fois.",
      },
    ],
  },
  en: {
    title: "Frequently asked questions about Amazon and Shopify",
    intro:
      "These questions come up often when a brand wants a cleaner Seller Central feed without losing the connection to its Shopify catalog.",
    items: [
      {
        question: "How do you send a Shopify catalog to Amazon Seller Central?",
        answer:
          "You need a reliable catalog source, stronger Amazon-critical attributes, and a structured export that follows Shopify changes instead of a one-off manual file.",
      },
      {
        question: "Which fields most often block an Amazon feed?",
        answer:
          "Blockers often come from GTIN, brand, variations, bullet points, images, price, or stock. Those dimensions need to be solid at the product level.",
      },
      {
        question: "Why is product scoring useful for Amazon?",
        answer:
          "It helps you see which listings are too weak or incomplete for Seller Central. You prioritize what to fix instead of reworking the entire catalog.",
      },
      {
        question: "Can the same catalog support Amazon and other channels?",
        answer:
          "Yes. A well-structured product base can support Amazon, Google Shopping, and other channels without rebuilding the same export logic every time.",
      },
    ],
  },
  es: {
    title: "Preguntas frecuentes sobre Amazon y Shopify",
    intro:
      "Estas preguntas aparecen a menudo cuando una marca quiere estructurar un feed de Seller Central sin perder el vinculo con su catalogo Shopify.",
    items: [
      {
        question: "Como enviar un catalogo Shopify a Amazon Seller Central?",
        answer:
          "Hace falta partir de una fuente de catalogo fiable, reforzar los atributos criticos de Amazon y publicar una exportacion estructurada que siga los cambios de Shopify en lugar de un archivo manual puntual.",
      },
      {
        question: "Que campos bloquean mas a menudo un feed Amazon?",
        answer:
          "Los bloqueos suelen venir del GTIN, la marca, las variaciones, los bullet points, las imagenes, el precio o el stock. Estas dimensiones deben estar limpias a nivel producto.",
      },
      {
        question: "Por que el scoring de producto es util para Amazon?",
        answer:
          "Ayuda a ver rapido que fichas son demasiado debiles o incompletas para Seller Central. Priorizas que corregir en lugar de rehacer todo el catalogo.",
      },
      {
        question: "Puede el mismo catalogo servir para Amazon y otros canales?",
        answer:
          "Si. Una base de producto bien estructurada puede alimentar Amazon, Google Shopping y otros canales sin rehacer la misma logica de exportacion cada vez.",
      },
    ],
  },
};

const STEP_ICONS = [Boxes, Sparkles, Tags, RefreshCw];

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

export default async function AmazonShopifyFeedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = getCopy(locale);
  const auditCta = getAuditCta(locale);
  const screenCopy = getScreenCopy(locale);
  const faqCopy = getFaqCopy(locale);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "var(--ink)" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .amazon-shopify-shell { font-family: var(--font-sans), sans-serif; }
            .amazon-shopify-fade { animation: amazonShopifyFadeUp .72s ease-out forwards; }
            .amazon-shopify-delay-1 { animation-delay: .08s; opacity: 0; }
            .amazon-shopify-delay-2 { animation-delay: .16s; opacity: 0; }
            .amazon-shopify-delay-3 { animation-delay: .24s; opacity: 0; }
            .amazon-shopify-card {
              transition: transform .2s ease, box-shadow .25s ease, border-color .2s ease;
            }
            .amazon-shopify-card:hover {
              transform: translateY(-3px);
              box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08);
              border-color: var(--line-strong);
            }
            .amazon-shopify-visual-shell {
              position: relative;
              overflow: hidden;
              border-radius: 28px;
              background: linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.96) 100%);
              border: 1px solid rgba(148,163,184,0.16);
              box-shadow: 0 28px 72px rgba(2, 6, 23, 0.34), inset 0 1px 0 rgba(255,255,255,0.07);
            }
            .amazon-shopify-visual-shell::before {
              content: "";
              position: absolute;
              inset: -18% 52% auto -8%;
              height: 220px;
              background: radial-gradient(circle, rgba(245,158,11,0.24) 0%, rgba(245,158,11,0) 72%);
              pointer-events: none;
            }
            .amazon-shopify-visual-shell::after {
              content: "";
              position: absolute;
              inset: auto -10% -24% 44%;
              width: 220px;
              height: 220px;
              background: radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 72%);
              pointer-events: none;
            }
            .amazon-shopify-gridline {
              position: absolute;
              inset: 0;
              background-image:
                linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px);
              background-size: 100% 54px, 54px 100%;
              mask-image: linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0));
              pointer-events: none;
            }
            .amazon-shopify-pulse { animation: amazonShopifyPulse 1.9s ease-in-out infinite; }
            @keyframes amazonShopifyFadeUp {
              from { opacity: 0; transform: translateY(18px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes amazonShopifyPulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.16); opacity: .76; }
            }
            @media (max-width: 920px) {
              .amazon-shopify-hero-grid { grid-template-columns: 1fr !important; }
              .amazon-shopify-two-col { grid-template-columns: 1fr !important; }
            }
            @media (max-width: 768px) {
              .amazon-shopify-hero { padding: 112px 24px 72px !important; }
              .amazon-shopify-section { padding-left: 24px !important; padding-right: 24px !important; }
              .amazon-shopify-grid-4 { grid-template-columns: 1fr !important; }
              .amazon-shopify-grid-3 { grid-template-columns: 1fr !important; }
            }
            @media (max-width: 480px) {
              .amazon-shopify-hero { padding: 96px 20px 56px !important; }
              .amazon-shopify-section { padding-left: 20px !important; padding-right: 20px !important; }
            }
          `,
        }}
      />
      {createFaqJsonLd(faqCopy.items)}

      <div className="amazon-shopify-shell">
        <MarketingHeader />

        <section
          className="amazon-shopify-hero amazon-shopify-section"
          style={{
            position: "relative",
            padding: "120px 48px 88px",
            background:
              "radial-gradient(circle at top right, rgba(245,158,11,0.18), transparent 28%), radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 24%), var(--ink)",
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
            className="amazon-shopify-hero-grid"
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
                className="amazon-shopify-fade"
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
                <ShoppingCart style={{ width: 16, height: 16 }} />
                {copy.heroEyebrow}
              </div>

              <h1
                className="amazon-shopify-fade amazon-shopify-delay-1"
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
                className="amazon-shopify-fade amazon-shopify-delay-2"
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
                className="amazon-shopify-fade amazon-shopify-delay-3"
                style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 }}
              >
                <Link href={auditCta.href} style={primaryHeroCtaStyle}>
                  {auditCta.label}
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </Link>
                <Link href="/optimiser-flux-amazon" style={secondaryHeroCtaStyle}>
                  {copy.secondaryCta}
                </Link>
              </div>

              <div
                className="amazon-shopify-fade amazon-shopify-delay-3"
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
                    <CheckCircle2 style={{ width: 14, height: 14, color: "var(--warning)" }} />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <aside className="amazon-shopify-fade amazon-shopify-delay-3" style={{ width: "100%", marginLeft: "auto" }}>
              <AmazonShopifyShowcase copy={screenCopy} />
            </aside>
          </div>
        </section>

        <section className="amazon-shopify-section" style={{ padding: "88px 48px", backgroundColor: "#ffffff" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 38px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                margin: "0 0 34px",
                color: "var(--ink)",
              }}
            >
              {copy.painTitle}
            </h2>

            <div
              className="amazon-shopify-grid-4"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 18,
              }}
            >
              {copy.pains.map((item) => (
                <div
                  key={item}
                  className="amazon-shopify-card"
                  style={{
                    padding: 24,
                    borderRadius: 14,
                    border: "1px solid var(--line)",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <ScanSearch style={{ width: 18, height: 18, color: "var(--warning)", marginBottom: 14 }} />
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--ink-2)" }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="amazon-shopify-section"
          style={{
            padding: "88px 48px",
            backgroundColor: "var(--paper-2)",
            borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 38px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                margin: "0 0 14px",
                color: "var(--ink)",
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
                color: "var(--ink-3)",
              }}
            >
              {copy.methodSubtitle}
            </p>

            <div
              className="amazon-shopify-grid-4"
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
                    className="amazon-shopify-card"
                    style={{
                      padding: 26,
                      borderRadius: 16,
                      backgroundColor: "#ffffff",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: "var(--warning-bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 18,
                      }}
                    >
                      <Icon style={{ width: 20, height: 20, color: "#c2410c" }} />
                    </div>
                    <h3
                      style={{
                        margin: "0 0 10px",
                        fontSize: 18,
                        lineHeight: 1.38,
                        fontWeight: 650,
                        color: "var(--ink)",
                      }}
                    >
                      {step.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.72, color: "var(--ink-3)" }}>{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="amazon-shopify-section" style={{ padding: "88px 48px", backgroundColor: "#ffffff" }}>
          <div
            className="amazon-shopify-two-col"
            style={{
              maxWidth: 1080,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.95fr)",
              gap: 28,
            }}
          >
            <div
              className="amazon-shopify-card"
              style={{
                padding: 30,
                borderRadius: 18,
                backgroundColor: "#ffffff",
                border: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: "var(--warning-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                }}
              >
                <Sparkles style={{ width: 22, height: 22, color: "var(--warning)" }} />
              </div>
              <h2
                style={{
                  margin: "0 0 18px",
                  fontSize: "clamp(24px, 3vw, 32px)",
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  color: "var(--ink)",
                }}
              >
                {copy.benefitsTitle}
              </h2>
              <div style={{ display: "grid", gap: 14 }}>
                {copy.benefits.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <CheckCircle2 style={{ width: 18, height: 18, color: "var(--success)", flexShrink: 0, marginTop: 3 }} />
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.72, color: "var(--ink-2)" }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="amazon-shopify-card"
              style={{
                padding: 30,
                borderRadius: 18,
                backgroundColor: "var(--ink)",
                color: "#ffffff",
                border: "1px solid var(--ink)",
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
              <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.72, color: "var(--line-strong)" }}>
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
          className="amazon-shopify-section"
          style={{
            padding: "88px 48px",
            backgroundColor: "var(--paper-2)",
            borderTop: "1px solid var(--line)",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(28px, 4vw, 36px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "var(--ink)",
              }}
            >
              {copy.linksTitle}
            </h2>
            <p style={{ maxWidth: 760, margin: "0 0 24px", fontSize: 16, lineHeight: 1.72, color: "var(--ink-3)" }}>
              {copy.linksIntro}
            </p>

            <div
              className="amazon-shopify-grid-3"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 18,
              }}
            >
              <Link href="/integrations" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/integrations</span>
                <span style={linkCardTextStyle}>Voir les sources catalogue et canaux relies a votre export Amazon.</span>
              </Link>
              <Link href="/optimiser-flux-amazon" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/optimiser-flux-amazon</span>
                <span style={linkCardTextStyle}>Revenir sur la page plus large dediee a l&apos;optimisation Amazon.</span>
              </Link>
              <Link href="/docs/export" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/docs/export</span>
                <span style={linkCardTextStyle}>Comprendre les exports multi-canaux et le role de Seller Central.</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="amazon-shopify-section" style={{ padding: "88px 48px", backgroundColor: "#ffffff" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(28px, 4vw, 36px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "var(--ink)",
              }}
            >
              {faqCopy.title}
            </h2>
            <p style={{ maxWidth: 760, margin: "0 0 24px", fontSize: 16, lineHeight: 1.72, color: "var(--ink-3)" }}>
              {faqCopy.intro}
            </p>

            <div style={{ display: "grid", gap: 16 }}>
              {faqCopy.items.map((item) => (
                <div
                  key={item.question}
                  className="amazon-shopify-card"
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <h3 style={{ margin: "0 0 10px", fontSize: 18, lineHeight: 1.45, fontWeight: 650, color: "var(--ink)" }}>
                    {item.question}
                  </h3>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.72, color: "var(--ink-3)" }}>{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="amazon-shopify-section"
          style={{
            padding: "104px 48px",
            backgroundColor: "var(--ink)",
            borderTop: "1px solid var(--ink)",
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
              <Link href={auditCta.href} style={primaryDarkCtaStyle}>
                {auditCta.label}
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
              <Link href="/optimiser-flux-amazon" style={secondaryDarkCtaStyle}>
                {copy.secondaryCta}
              </Link>
            </div>
          </div>
        </section>

        <footer
          className="amazon-shopify-section"
          style={{
            padding: "56px 48px",
            backgroundColor: "#ffffff",
            borderTop: "1px solid var(--paper-2)",
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
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>FeedPlug</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "var(--ink-3)" }}>{copy.heroSubtitle}</p>
            </div>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Link href="/" style={footerLinkStyle}>
                {copy.footerHome}
              </Link>
              <Link href="/docs" style={footerLinkStyle}>
                {copy.footerDocs}
              </Link>
              <Link href="/optimiser-flux-amazon" style={footerLinkStyle}>
                {copy.footerAmazon}
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
  color: "var(--ink)",
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
  border: "1px solid var(--line)",
  backgroundColor: "#ffffff",
  textDecoration: "none",
} satisfies React.CSSProperties;

const linkCardLabelStyle = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--ink)",
} satisfies React.CSSProperties;

const linkCardTextStyle = {
  fontSize: 15,
  lineHeight: 1.72,
  color: "var(--ink-3)",
} satisfies React.CSSProperties;

const primaryDarkCtaStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "15px 24px",
  borderRadius: 10,
  backgroundColor: "#ffffff",
  color: "var(--ink)",
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
  color: "var(--ink-3)",
  textDecoration: "none",
  fontSize: 14,
} satisfies React.CSSProperties;

function AmazonShopifyShowcase({ copy }: { copy: ScreenCopy }) {
  return (
    <div className="amazon-shopify-visual-shell">
      <div className="amazon-shopify-gridline" />

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
          <Sparkles style={{ width: 14, height: 14, color: "var(--warning)" }} />
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
            icon={<Boxes style={{ width: 18, height: 18, color: "var(--accent-bg)" }} />}
            title={copy.stageSource}
            meta={copy.stageSourceMeta}
          />
          <VisualStage
            icon={<Sparkles style={{ width: 18, height: 18, color: "#FDE68A" }} />}
            title={copy.stageScore}
            meta={copy.stageScoreMeta}
            active
          />
          <VisualStage
            icon={<PackageCheck style={{ width: 18, height: 18, color: "var(--accent-bg)" }} />}
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
            <div style={{ fontSize: 40, lineHeight: 1, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>82</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(226,232,240,0.58)" }}>{copy.scoreMeta}</div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: "linear-gradient(180deg, rgba(120,53,15,0.42), rgba(15,23,42,0.84))",
              border: "1px solid rgba(251,191,36,0.16)",
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
                    className="amazon-shopify-pulse"
                    style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "var(--warning)" }}
                  />
                  <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--paper-2)" }}>{item}</span>
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
      className="amazon-shopify-card"
      style={{
        padding: 18,
        borderRadius: 20,
        background: active ? "rgba(245,158,11,0.09)" : "rgba(255,255,255,0.04)",
        border: active ? "1px solid rgba(251,191,36,0.2)" : "1px solid rgba(148,163,184,0.14)",
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
        background: highlight ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.04)",
        border: highlight ? "1px solid rgba(245,158,11,0.16)" : "1px solid rgba(148,163,184,0.14)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 650, color: "#ffffff", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(226,232,240,0.64)" }}>{body}</div>
    </div>
  );
}

import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Globe,
  PackageCheck,
  RefreshCw,
  Share2,
  Sparkles,
  Store,
  Target,
} from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { getAuditCta } from "@/lib/audit-cta";
import { Link } from "@/i18n/routing";

type Locale = "fr" | "en" | "es";
type Step = { title: string; body: string };
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
  footerIntegrations: string;
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
  channelsLabel: string;
  channels: string[];
  resultTitle: string;
  resultBody: string;
  answerTitle: string;
  answerBody: string;
};

const COPY: Record<Locale, PageCopy> = {
  fr: {
    heroEyebrow: "Marketplaces",
    heroTitle: "Gerez vos flux produits pour les marketplaces",
    heroSubtitle:
      "Centralisez votre catalogue, scorez chaque fiche produit et diffusez des exports adaptes a Amazon, Cdiscount, Rakuten, Fnac ou Mirakl sans multiplier les fichiers.",
    primaryCta: "Demander une demo",
    secondaryCta: "Voir les integrations",
    trust: ["Un catalogue central", "Scoring produit 0-100", "Exports par marketplace"],
    painTitle: "Pourquoi la gestion multi-marketplaces devient vite chaotique",
    pains: [
      "Chaque marketplace attend ses propres attributs, variantes, categories et formats d'export.",
      "Sans catalogue central, les corrections se dupliquent entre Amazon, Cdiscount, Rakuten, Fnac ou Mirakl.",
      "Sans scoring produit, il est difficile de savoir quelles fiches doivent etre traitees avant diffusion multi-canal.",
      "Plus le nombre de canaux augmente, plus les exports manuels deviennent fragiles et couteux a maintenir.",
    ],
    methodTitle: "La methode FeedPlug pour les flux marketplaces",
    methodSubtitle:
      "FeedPlug garde une base catalogue unique, priorise les fiches faibles avec le scoring produit et declenche des exports plus propres pour chaque marketplace.",
    steps: [
      {
        title: "Centralisez le catalogue",
        body: "Produits, variantes, prix, images, stock et contenus restent dans une base source unique.",
      },
      {
        title: "Scorez les fiches produit",
        body: "Le scoring produit fait remonter les fiches les plus faibles avant diffusion sur plusieurs marketplaces.",
      },
      {
        title: "Adaptez les attributs par canal",
        body: "Chaque export est ajuste selon les attentes d'Amazon, Cdiscount, Rakuten, Fnac ou Mirakl sans recopier tout le catalogue.",
      },
      {
        title: "Publiez des flux plus stables",
        body: "Les mises a jour de la source se repercutent plus proprement sur chaque marketplace sans reconstruire des fichiers a la main.",
      },
    ],
    benefitsTitle: "Ce que FeedPlug apporte a votre organisation marketplace",
    benefits: [
      "Un meme catalogue alimente plusieurs marketplaces sans changer votre logique source.",
      "Le scoring produit permet de traiter en priorite les fiches qui mettraient en risque plusieurs canaux a la fois.",
      "Les exports restent plus coherents entre marketplaces meme quand le catalogue evolue vite.",
      "Vous reduisez le nombre de fichiers, de manipulations manuelles et de corrections dispersees par canal.",
    ],
    requirementsTitle: "Ce qu'une gestion propre des flux marketplaces doit couvrir",
    requirementsIntro:
      "Pour gerer plusieurs marketplaces sans chaos, il faut plus qu'un simple export par canal. Il faut une base catalogue lisible, un scoring exploitable et des adaptations par plateforme.",
    requirements: [
      "Une source catalogue unique pour produits, variantes, prix, images et stock",
      "Un scoring produit pour prioriser les fiches les plus faibles avant diffusion",
      "Des attributs adaptes par marketplace sans dupliquer tout le catalogue",
      "Des exports reutilisables vers Amazon, Cdiscount, Rakuten, Fnac ou Mirakl",
      "Une logique de mise a jour qui suit les changements source sans bricolage manuel",
      "Un maillage clair entre catalogue, score, export et integrations",
    ],
    linksTitle: "Pour aller plus loin",
    linksIntro:
      "Retrouvez les pages utiles pour vos integrations, votre export Amazon Shopify et les canaux en cours d'ouverture.",
    ctaTitle: "Besoin d'une gestion plus propre de vos flux marketplaces ?",
    ctaBody:
      "Demandez une demo FeedPlug ou parcourez les integrations pour voir comment centraliser votre catalogue avant diffusion multi-marketplaces.",
    footerHome: "Accueil",
    footerDocs: "Documentation",
    footerIntegrations: "Integrations",
  },
  en: {
    heroEyebrow: "Marketplaces",
    heroTitle: "Manage your product feeds for marketplaces",
    heroSubtitle:
      "Centralize your catalog, score every product listing, and distribute exports adapted to Amazon, Cdiscount, Rakuten, Fnac, or Mirakl without multiplying files.",
    primaryCta: "Request a demo",
    secondaryCta: "View integrations",
    trust: ["One central catalog", "Product scoring 0-100", "Per-marketplace exports"],
    painTitle: "Why multi-marketplace management quickly becomes chaotic",
    pains: [
      "Each marketplace expects its own attributes, variants, categories, and export format.",
      "Without a central catalog, fixes get duplicated across Amazon, Cdiscount, Rakuten, Fnac, or Mirakl.",
      "Without product scoring, it is hard to know which listings must be improved before multi-channel distribution.",
      "The more channels you add, the more fragile and costly manual exports become.",
    ],
    methodTitle: "The FeedPlug method for marketplace feeds",
    methodSubtitle:
      "FeedPlug keeps one source catalog, prioritizes weak listings with product scoring, and produces cleaner exports for each marketplace.",
    steps: [
      {
        title: "Centralize the catalog",
        body: "Products, variants, prices, images, stock, and content stay in one source layer.",
      },
      {
        title: "Score product listings",
        body: "Product scoring surfaces the weakest listings before they are distributed to multiple marketplaces.",
      },
      {
        title: "Adapt attributes per channel",
        body: "Each export is adjusted to Amazon, Cdiscount, Rakuten, Fnac, or Mirakl without copying the whole catalog.",
      },
      {
        title: "Publish more stable feeds",
        body: "Source updates flow more cleanly to each marketplace without rebuilding files by hand.",
      },
    ],
    benefitsTitle: "What FeedPlug improves for your marketplace operations",
    benefits: [
      "One catalog feeds multiple marketplaces without changing your source logic.",
      "Product scoring helps treat the listings that could put several channels at risk first.",
      "Exports stay more consistent across marketplaces even when the catalog changes quickly.",
      "You reduce the number of files, manual manipulations, and scattered per-channel fixes.",
    ],
    requirementsTitle: "What clean marketplace feed management should cover",
    requirementsIntro:
      "Managing several marketplaces without chaos requires more than one export per channel. You need a readable catalog base, usable scoring, and per-platform adaptation.",
    requirements: [
      "A single catalog source for products, variants, prices, images, and stock",
      "Product scoring to prioritize weak listings before distribution",
      "Marketplace-specific attributes without duplicating the whole catalog",
      "Reusable exports to Amazon, Cdiscount, Rakuten, Fnac, or Mirakl",
      "An update flow that follows source changes without manual patchwork",
      "Clear links between catalog, score, export, and integrations",
    ],
    linksTitle: "Explore related pages",
    linksIntro:
      "Use these pages for integrations, Amazon Shopify export workflows, and new channel expansion.",
    ctaTitle: "Need cleaner marketplace feed management?",
    ctaBody:
      "Request a FeedPlug demo or browse integrations to see how to centralize your catalog before multi-marketplace distribution.",
    footerHome: "Home",
    footerDocs: "Documentation",
    footerIntegrations: "Integrations",
  },
  es: {
    heroEyebrow: "Marketplaces",
    heroTitle: "Gestiona tus feeds de productos para marketplaces",
    heroSubtitle:
      "Centraliza tu catalogo, puntua cada ficha de producto y distribuye exportaciones adaptadas a Amazon, Cdiscount, Rakuten, Fnac o Mirakl sin multiplicar archivos.",
    primaryCta: "Solicitar una demo",
    secondaryCta: "Ver integraciones",
    trust: ["Un catalogo central", "Scoring de producto 0-100", "Exportaciones por marketplace"],
    painTitle: "Por que la gestion multi-marketplace se vuelve caotica muy rapido",
    pains: [
      "Cada marketplace exige sus propios atributos, variantes, categorias y formato de exportacion.",
      "Sin un catalogo central, las correcciones se duplican entre Amazon, Cdiscount, Rakuten, Fnac o Mirakl.",
      "Sin scoring de producto es dificil saber que fichas deben mejorarse antes de distribuir en varios canales.",
      "Cuantos mas canales anades, mas fragiles y costosas se vuelven las exportaciones manuales.",
    ],
    methodTitle: "El metodo FeedPlug para feeds de marketplaces",
    methodSubtitle:
      "FeedPlug conserva una base catalogo unica, prioriza fichas debiles con scoring de producto y genera exportaciones mas limpias para cada marketplace.",
    steps: [
      {
        title: "Centraliza el catalogo",
        body: "Productos, variantes, precios, imagenes, stock y contenidos se mantienen en una unica capa fuente.",
      },
      {
        title: "Puntua las fichas de producto",
        body: "El scoring de producto detecta las fichas mas debiles antes de distribuirlas a varios marketplaces.",
      },
      {
        title: "Adapta atributos por canal",
        body: "Cada exportacion se ajusta a Amazon, Cdiscount, Rakuten, Fnac o Mirakl sin copiar todo el catalogo.",
      },
      {
        title: "Publica feeds mas estables",
        body: "Las actualizaciones de la fuente fluyen con mas limpieza a cada marketplace sin reconstruir archivos a mano.",
      },
    ],
    benefitsTitle: "Lo que FeedPlug mejora para tu operacion marketplace",
    benefits: [
      "Un mismo catalogo alimenta varios marketplaces sin cambiar tu logica fuente.",
      "El scoring de producto ayuda a tratar primero las fichas que pondrian en riesgo varios canales a la vez.",
      "Las exportaciones se mantienen mas coherentes entre marketplaces aunque el catalogo cambie rapido.",
      "Reduces archivos, manipulaciones manuales y correcciones dispersas por canal.",
    ],
    requirementsTitle: "Lo que debe cubrir una gestion limpia de feeds marketplace",
    requirementsIntro:
      "Gestionar varios marketplaces sin caos requiere mas que una exportacion por canal. Hace falta una base catalogo legible, un scoring util y adaptaciones por plataforma.",
    requirements: [
      "Una fuente catalogo unica para productos, variantes, precios, imagenes y stock",
      "Scoring de producto para priorizar fichas debiles antes de publicar",
      "Atributos adaptados por marketplace sin duplicar todo el catalogo",
      "Exportaciones reutilizables a Amazon, Cdiscount, Rakuten, Fnac o Mirakl",
      "Un flujo de actualizacion que siga los cambios de la fuente sin bricolaje manual",
      "Enlaces claros entre catalogo, score, exportacion e integraciones",
    ],
    linksTitle: "Para seguir avanzando",
    linksIntro:
      "Usa estas paginas para integraciones, exportacion Amazon Shopify y apertura de nuevos canales.",
    ctaTitle: "Necesitas una gestion mas limpia de tus feeds marketplace?",
    ctaBody:
      "Solicita una demo de FeedPlug o consulta las integraciones para ver como centralizar tu catalogo antes de distribuir en varios marketplaces.",
    footerHome: "Inicio",
    footerDocs: "Documentacion",
    footerIntegrations: "Integraciones",
  },
};

const SCREEN_COPY: Record<Locale, ScreenCopy> = {
  fr: {
    eyebrow: "Une base catalogue, plusieurs sorties",
    stageSource: "Catalogue centralise",
    stageSourceMeta: "Produits, variantes, prix, images et stock unifies.",
    stageScore: "Scoring produit",
    stageScoreMeta: "Les fiches faibles remontent avant diffusion multi-marketplaces.",
    stageExport: "Exports marketplace adaptes",
    stageExportMeta: "Amazon, Cdiscount, Rakuten, Fnac ou Mirakl a partir de la meme base.",
    scoreLabel: "Scoring produit",
    scoreMeta: "80 / 100 sur la gamme prioritaire",
    channelsLabel: "Canaux diffuses",
    channels: ["Amazon", "Cdiscount", "Rakuten", "Mirakl"],
    resultTitle: "Ce que l'equipe voit tout de suite",
    resultBody: "Les fiches a renforcer avant diffusion et les canaux qui seront alimentes a partir de la meme base.",
    answerTitle: "Pret pour plusieurs marketplaces",
    answerBody: "Le catalogue reste central, les exports sont adaptes par canal et la maintenance devient plus supportable.",
  },
  en: {
    eyebrow: "One catalog base, multiple outputs",
    stageSource: "Centralized catalog",
    stageSourceMeta: "Products, variants, prices, images, and stock unified.",
    stageScore: "Product scoring",
    stageScoreMeta: "Weak listings surface before multi-marketplace distribution.",
    stageExport: "Adapted marketplace exports",
    stageExportMeta: "Amazon, Cdiscount, Rakuten, Fnac, or Mirakl from the same base.",
    scoreLabel: "Product scoring",
    scoreMeta: "80 / 100 on the priority range",
    channelsLabel: "Distributed channels",
    channels: ["Amazon", "Cdiscount", "Rakuten", "Mirakl"],
    resultTitle: "What the team sees immediately",
    resultBody: "Which listings must be strengthened before distribution and which channels will be fed from the same base.",
    answerTitle: "Ready for multiple marketplaces",
    answerBody: "The catalog stays central, exports adapt per channel, and maintenance becomes more sustainable.",
  },
  es: {
    eyebrow: "Una base catalogo, varias salidas",
    stageSource: "Catalogo centralizado",
    stageSourceMeta: "Productos, variantes, precios, imagenes y stock unificados.",
    stageScore: "Scoring de producto",
    stageScoreMeta: "Las fichas debiles aparecen antes de la distribucion multi-marketplace.",
    stageExport: "Exportaciones adaptadas por marketplace",
    stageExportMeta: "Amazon, Cdiscount, Rakuten, Fnac o Mirakl desde la misma base.",
    scoreLabel: "Scoring de producto",
    scoreMeta: "80 / 100 en la gama prioritaria",
    channelsLabel: "Canales distribuidos",
    channels: ["Amazon", "Cdiscount", "Rakuten", "Mirakl"],
    resultTitle: "Lo que el equipo ve de inmediato",
    resultBody: "Que fichas reforzar antes de publicar y que canales se alimentaran desde la misma base.",
    answerTitle: "Listo para varios marketplaces",
    answerBody: "El catalogo sigue siendo central, las exportaciones se adaptan por canal y el mantenimiento se vuelve mas soportable.",
  },
};

const MARKET_STEP_ICONS = [Boxes, Target, Store, RefreshCw];

function getMarketCopy(locale: string): PageCopy {
  if (locale === "fr" || locale === "en" || locale === "es") return COPY[locale];
  return COPY.en;
}
function getMarketScreenCopy(locale: string): ScreenCopy {
  if (locale === "fr" || locale === "en" || locale === "es") return SCREEN_COPY[locale];
  return SCREEN_COPY.en;
}

export default async function MarketplacesFeedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = getMarketCopy(locale);
  const auditCta = getAuditCta(locale);
  const screenCopy = getMarketScreenCopy(locale);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "var(--ink)" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .marketplaces-shell { font-family: var(--font-sans), sans-serif; }
            .marketplaces-fade { animation: marketplacesFadeUp .72s ease-out forwards; }
            .marketplaces-delay-1 { animation-delay: .08s; opacity: 0; }
            .marketplaces-delay-2 { animation-delay: .16s; opacity: 0; }
            .marketplaces-delay-3 { animation-delay: .24s; opacity: 0; }
            .marketplaces-card { transition: transform .2s ease, box-shadow .25s ease, border-color .2s ease; }
            .marketplaces-card:hover { transform: translateY(-3px); box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08); border-color: var(--line-strong); }
            .marketplaces-visual-shell {
              position: relative;
              overflow: hidden;
              border-radius: 28px;
              background: linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.96) 100%);
              border: 1px solid rgba(148,163,184,0.16);
              box-shadow: 0 28px 72px rgba(2, 6, 23, 0.34), inset 0 1px 0 rgba(255,255,255,0.07);
            }
            .marketplaces-visual-shell::before {
              content: "";
              position: absolute;
              inset: -18% 52% auto -8%;
              height: 220px;
              background: radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0) 72%);
              pointer-events: none;
            }
            .marketplaces-visual-shell::after {
              content: "";
              position: absolute;
              inset: auto -10% -24% 44%;
              width: 220px;
              height: 220px;
              background: radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 72%);
              pointer-events: none;
            }
            .marketplaces-gridline {
              position: absolute;
              inset: 0;
              background-image: linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px);
              background-size: 100% 54px, 54px 100%;
              mask-image: linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0));
              pointer-events: none;
            }
            .marketplaces-pulse { animation: marketplacesPulse 1.9s ease-in-out infinite; }
            @keyframes marketplacesFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes marketplacesPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.16); opacity: .76; } }
            @media (max-width: 920px) {
              .marketplaces-hero-grid { grid-template-columns: 1fr !important; }
              .marketplaces-two-col { grid-template-columns: 1fr !important; }
            }
            @media (max-width: 768px) {
              .marketplaces-hero { padding: 112px 24px 72px !important; }
              .marketplaces-section { padding-left: 24px !important; padding-right: 24px !important; }
              .marketplaces-grid-4 { grid-template-columns: 1fr !important; }
              .marketplaces-grid-3 { grid-template-columns: 1fr !important; }
            }
            @media (max-width: 480px) {
              .marketplaces-hero { padding: 96px 20px 56px !important; }
              .marketplaces-section { padding-left: 20px !important; padding-right: 20px !important; }
            }
          `,
        }}
      />

      <div className="marketplaces-shell">
        <MarketingHeader />
        <section
          className="marketplaces-hero marketplaces-section"
          style={{
            position: "relative",
            padding: "120px 48px 88px",
            background:
              "radial-gradient(circle at top right, rgba(16,185,129,0.18), transparent 28%), radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 24%), var(--ink)",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(17,24,39,0) 28%, rgba(17,24,39,0.18) 100%)" }} />
          <div className="marketplaces-hero-grid" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(420px, 520px)", gap: 48, alignItems: "center" }}>
            <div>
              <div className="marketplaces-fade" style={eyebrowStyle}>
                <Globe style={{ width: 16, height: 16 }} />
                {copy.heroEyebrow}
              </div>
              <h1 className="marketplaces-fade marketplaces-delay-1" style={heroTitleStyle}>
                {copy.heroTitle}
              </h1>
              <p className="marketplaces-fade marketplaces-delay-2" style={heroSubtitleStyle}>
                {copy.heroSubtitle}
              </p>
              <div className="marketplaces-fade marketplaces-delay-3" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 }}>
                <Link href={auditCta.href} style={primaryHeroCtaStyle}>
                  {auditCta.label}
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </Link>
                <Link href="/integrations" style={secondaryHeroCtaStyle}>
                  {copy.secondaryCta}
                </Link>
              </div>
              <div className="marketplaces-fade marketplaces-delay-3" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {copy.trust.map((item) => (
                  <span key={item} style={trustBadgeStyle}>
                    <CheckCircle2 style={{ width: 14, height: 14, color: "var(--success)" }} />
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <aside className="marketplaces-fade marketplaces-delay-3" style={{ width: "100%", marginLeft: "auto" }}>
              <MarketplacesShowcase copy={screenCopy} />
            </aside>
          </div>
        </section>

        <section className="marketplaces-section" style={sectionWhiteStyle}>
          <div style={sectionWrapStyle}>
            <h2 style={sectionTitleStyle}>{copy.painTitle}</h2>
            <div className="marketplaces-grid-4" style={grid4Style}>
              {copy.pains.map((item) => (
                <div key={item} className="marketplaces-card" style={whiteCardStyle}>
                  <Share2 style={{ width: 18, height: 18, color: "#2A6FE8", marginBottom: 14 }} />
                  <p style={cardParagraphStyle}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="marketplaces-section" style={sectionAltStyle}>
          <div style={sectionWrapStyle}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 14 }}>{copy.methodTitle}</h2>
            <p style={sectionIntroStyle}>{copy.methodSubtitle}</p>
            <div className="marketplaces-grid-4" style={grid4Style}>
              {copy.steps.map((step, index) => {
                const Icon = MARKET_STEP_ICONS[index];
                return (
                  <div key={step.title} className="marketplaces-card" style={stepCardStyle}>
                    <div style={{ ...stepIconWrapStyle, backgroundColor: "var(--success-bg)" }}>
                      <Icon style={{ width: 20, height: 20, color: "var(--success)" }} />
                    </div>
                    <h3 style={stepTitleStyle}>{step.title}</h3>
                    <p style={cardParagraphMutedStyle}>{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="marketplaces-section" style={sectionWhiteStyle}>
          <div className="marketplaces-two-col" style={twoColStyle}>
            <div className="marketplaces-card" style={benefitCardStyle}>
              <div style={benefitIconStyle}>
                <Sparkles style={{ width: 22, height: 22, color: "var(--ink)" }} />
              </div>
              <h2 style={twoColTitleStyle}>{copy.benefitsTitle}</h2>
              <div style={{ display: "grid", gap: 14 }}>
                {copy.benefits.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <CheckCircle2 style={{ width: 18, height: 18, color: "var(--success)", flexShrink: 0, marginTop: 3 }} />
                    <p style={cardParagraphStyle}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="marketplaces-card" style={darkCardStyle}>
              <h2 style={darkTitleStyle}>{copy.requirementsTitle}</h2>
              <p style={darkIntroStyle}>{copy.requirementsIntro}</p>
              <ul style={darkListStyle}>
                {copy.requirements.map((item) => (
                  <li key={item} style={darkListItemStyle}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="marketplaces-section" style={sectionAltStyle}>
          <div style={sectionWrapStyle}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 12 }}>{copy.linksTitle}</h2>
            <p style={{ ...sectionIntroStyle, marginBottom: 24 }}>{copy.linksIntro}</p>
            <div className="marketplaces-grid-3" style={grid3Style}>
              <Link href="/integrations" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/integrations</span>
                <span style={linkCardTextStyle}>Voir les canaux et sources relies a votre catalogue central.</span>
              </Link>
              <Link href="/feed-produit-amazon-shopify" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/feed-produit-amazon-shopify</span>
                <span style={linkCardTextStyle}>Consulter le cas Shopify vers Amazon avec scoring produit et Seller Central.</span>
              </Link>
              <Link href="/diffusion-nouveaux-canaux" style={linkCardStyle}>
                <span style={linkCardLabelStyle}>/diffusion-nouveaux-canaux</span>
                <span style={linkCardTextStyle}>Explorer l&apos;ouverture de nouveaux canaux et la logique de diffusion multi-sorties.</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="marketplaces-section" style={ctaDarkSectionStyle}>
          <div style={ctaWrapStyle}>
            <h2 style={ctaTitleStyle}>{copy.ctaTitle}</h2>
            <p style={ctaBodyStyle}>{copy.ctaBody}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href={auditCta.href} style={primaryDarkCtaStyle}>
                {auditCta.label}
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
              <Link href="/integrations" style={secondaryDarkCtaStyle}>
                {copy.secondaryCta}
              </Link>
            </div>
          </div>
        </section>

        <footer className="marketplaces-section" style={footerStyle}>
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
              <Link href="/integrations" style={footerLinkStyle}>
                {copy.footerIntegrations}
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

function MarketplacesShowcase({ copy }: { copy: ScreenCopy }) {
  return (
    <div className="marketplaces-visual-shell">
      <div className="marketplaces-gridline" />
      <div style={{ position: "relative", zIndex: 1, padding: 26 }}>
        <div style={visualEyebrowStyle}>
          <Sparkles style={{ width: 14, height: 14, color: "#BBF7D0" }} />
          <span style={visualEyebrowTextStyle}>{copy.eyebrow}</span>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <VisualStage
            icon={<Boxes style={{ width: 18, height: 18, color: "var(--accent-bg)" }} />}
            title={copy.stageSource}
            meta={copy.stageSourceMeta}
          />
          <VisualStage
            icon={<Target style={{ width: 18, height: 18, color: "#BBF7D0" }} />}
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

        <div style={{ marginTop: 18, display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 148px) minmax(0, 1fr)" }}>
          <div style={visualScoreCardStyle}>
            <div style={visualScoreLabelStyle}>{copy.scoreLabel}</div>
            <div style={visualScoreValueStyle}>80</div>
            <div style={visualScoreMetaStyle}>{copy.scoreMeta}</div>
          </div>
          <div style={visualPanelStyle}>
            <div style={visualPanelLabelStyle}>{copy.channelsLabel}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {copy.channels.map((item) => (
                <div key={item} style={visualIssueItemStyle}>
                  <span className="marketplaces-pulse" style={visualDotStyle} />
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
      className="marketplaces-card"
      style={{
        padding: 18,
        borderRadius: 20,
        background: active ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
        border: active ? "1px solid rgba(134,239,172,0.2)" : "1px solid rgba(148,163,184,0.14)",
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
        background: highlight ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
        border: highlight ? "1px solid rgba(34,197,94,0.16)" : "1px solid rgba(148,163,184,0.14)",
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
  backgroundColor: "var(--paper-2)",
  borderTop: "1px solid var(--line)",
  borderBottom: "1px solid var(--line)",
} satisfies React.CSSProperties;
const sectionTitleStyle = {
  fontSize: "clamp(28px, 4vw, 38px)",
  fontWeight: 600,
  letterSpacing: "-0.03em",
  margin: "0 0 34px",
  color: "var(--ink)",
} satisfies React.CSSProperties;
const sectionIntroStyle = {
  maxWidth: 760,
  margin: "0 0 34px",
  fontSize: 17,
  lineHeight: 1.72,
  color: "var(--ink-3)",
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
  border: "1px solid var(--line)",
  backgroundColor: "#ffffff",
} satisfies React.CSSProperties;
const stepCardStyle = {
  padding: 26,
  borderRadius: 16,
  backgroundColor: "#ffffff",
  border: "1px solid var(--line)",
} satisfies React.CSSProperties;
const cardParagraphStyle = { margin: 0, fontSize: 15, lineHeight: 1.72, color: "var(--ink-2)" } satisfies React.CSSProperties;
const cardParagraphMutedStyle = { margin: 0, fontSize: 15, lineHeight: 1.72, color: "var(--ink-3)" } satisfies React.CSSProperties;
const stepIconWrapStyle = {
  width: 42,
  height: 42,
  borderRadius: 12,
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
  color: "var(--ink)",
} satisfies React.CSSProperties;
const twoColStyle = {
  maxWidth: 1080,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.95fr)",
  gap: 28,
} satisfies React.CSSProperties;
const benefitCardStyle = { padding: 30, borderRadius: 18, backgroundColor: "#ffffff", border: "1px solid var(--line)" } satisfies React.CSSProperties;
const benefitIconStyle = {
  width: 46,
  height: 46,
  borderRadius: 14,
  backgroundColor: "var(--paper-2)",
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
  color: "var(--ink)",
} satisfies React.CSSProperties;
const darkCardStyle = { padding: 30, borderRadius: 18, backgroundColor: "var(--ink)", color: "#ffffff", border: "1px solid var(--ink)" } satisfies React.CSSProperties;
const darkTitleStyle = { margin: "0 0 12px", fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 600, letterSpacing: "-0.03em" } satisfies React.CSSProperties;
const darkIntroStyle = { margin: "0 0 18px", fontSize: 15, lineHeight: 1.72, color: "var(--line-strong)" } satisfies React.CSSProperties;
const darkListStyle = { margin: 0, paddingLeft: 18, display: "grid", gap: 10 } satisfies React.CSSProperties;
const darkListItemStyle = { fontSize: 15, lineHeight: 1.72, color: "#ffffff" } satisfies React.CSSProperties;
const linkCardStyle = {
  display: "grid",
  gap: 10,
  padding: 24,
  borderRadius: 16,
  border: "1px solid var(--line)",
  backgroundColor: "#ffffff",
  textDecoration: "none",
} satisfies React.CSSProperties;
const linkCardLabelStyle = { fontSize: 14, fontWeight: 700, color: "var(--ink)" } satisfies React.CSSProperties;
const linkCardTextStyle = { fontSize: 15, lineHeight: 1.72, color: "var(--ink-3)" } satisfies React.CSSProperties;
const ctaDarkSectionStyle = { padding: "104px 48px", backgroundColor: "var(--ink)", borderTop: "1px solid var(--ink)" } satisfies React.CSSProperties;
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
const footerStyle = { padding: "56px 48px", backgroundColor: "#ffffff", borderTop: "1px solid var(--paper-2)" } satisfies React.CSSProperties;
const footerWrapStyle = { maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24 } satisfies React.CSSProperties;
const footerBrandStyle = { fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 10 } satisfies React.CSSProperties;
const footerBodyStyle = { margin: 0, fontSize: 14, lineHeight: 1.65, color: "var(--ink-3)" } satisfies React.CSSProperties;
const footerLinksWrapStyle = { display: "flex", gap: 24, flexWrap: "wrap" } satisfies React.CSSProperties;
const footerLinkStyle = { color: "var(--ink-3)", textDecoration: "none", fontSize: 14 } satisfies React.CSSProperties;
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
const visualDotStyle = { width: 8, height: 8, borderRadius: 999, backgroundColor: "var(--success)" } satisfies React.CSSProperties;
const visualIssueTextStyle = { fontSize: 14, lineHeight: 1.55, color: "var(--paper-2)" } satisfies React.CSSProperties;
const visualNoteTitleStyle = { fontSize: 14, fontWeight: 650, color: "#ffffff", marginBottom: 6 } satisfies React.CSSProperties;
const visualNoteBodyStyle = { fontSize: 14, lineHeight: 1.65, color: "rgba(226,232,240,0.64)" } satisfies React.CSSProperties;

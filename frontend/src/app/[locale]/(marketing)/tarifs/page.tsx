"use client";

import { useState, useMemo } from "react";
import { CheckCircle, Sparkles, Shield, Zap, ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { formatCurrency } from "@/lib/format";
import { getCurrencyForLocale } from "@/config/plans";
import { trackEvent } from "@/components/analytics/GoogleAnalytics";
import {
  PRODUCT_TIERS,
  CHANNEL_OPTIONS,
  CHANNEL_PLATFORMS,
  PRICING_GRID_EUR,
  ADDON_IA_PRICE_EUR,
  getProductTierLabel,
  getPriceFromGrid,
  type ProductTier,
  type ChannelCount,
} from "@/config/pricing-grid-v2";

const MAX_SELECTABLE_CHANNELS = 5;

export default function TarifsPage() {
  const locale = useLocale();
  const t = useTranslations("tarifs");
  const currency = getCurrencyForLocale(locale);
  const isEUR = currency === "EUR";
  const featuredCopy =
    locale === "es"
      ? {
          title: "Paginas utiles segun tu caso",
          intro:
            "Antes de lanzar o escalar un canal, estas paginas ayudan a entender donde FeedPlug aporta mas valor segun tu flujo de productos.",
          cards: [
            {
              href: "/optimiser-flux-google-shopping-shopify",
              label: "Shopify + Google Shopping",
              body: "Conecta Shopify, puntua cada ficha y publica un feed limpio para Merchant Center.",
            },
            {
              href: "/corriger-erreurs-google-merchant-center",
              label: "Errores Merchant Center",
              body: "Prioriza rechazos, atributos faltantes y problemas de conformidad producto por producto.",
            },
            {
              href: "/feed-produit-amazon-shopify",
              label: "Amazon + Shopify",
              body: "Estructura variantes, GTIN y atributos criticos antes de exportar a Seller Central.",
            },
            {
              href: "/feed-produit-chatgpt",
              label: "Feed ChatGPT",
              body: "Prepara un catalogo mas legible para ChatGPT, Perplexity y otros asistentes IA.",
            },
            {
              href: "/feedplug-vs-channable",
              label: "FeedPlug vs Channable",
              body: "Compara un enfoque mas simple frente a una suite historica mas densa.",
            },
          ],
        }
      : locale === "en"
        ? {
            title: "Useful pages for your use case",
            intro:
              "Before launching or scaling a channel, these pages help clarify where FeedPlug adds the most value for your product feed workflow.",
            cards: [
              {
                href: "/optimiser-flux-google-shopping-shopify",
                label: "Shopify + Google Shopping",
                body: "Connect Shopify, score each listing, and publish a cleaner Merchant Center feed.",
              },
              {
                href: "/corriger-erreurs-google-merchant-center",
                label: "Merchant Center errors",
                body: "Prioritize rejections, missing attributes, and compliance issues at the product level.",
              },
              {
                href: "/feed-produit-amazon-shopify",
                label: "Amazon + Shopify",
                body: "Structure variants, GTINs, and critical attributes before exporting to Seller Central.",
              },
              {
                href: "/feed-produit-chatgpt",
                label: "ChatGPT feed",
                body: "Prepare a catalog that is easier for ChatGPT, Perplexity, and other AI assistants to use.",
              },
              {
                href: "/feedplug-vs-channable",
                label: "FeedPlug vs Channable",
                body: "Compare a simpler workflow against a denser established suite.",
              },
            ],
          }
        : {
            title: "Pages utiles selon votre cas",
            intro:
              "Avant de lancer ou d'accelerer un canal, ces pages aident a comprendre ou FeedPlug apporte le plus de valeur selon votre flux produit.",
            cards: [
              {
                href: "/optimiser-flux-google-shopping-shopify",
                label: "Shopify + Google Shopping",
                body: "Connectez Shopify, scorez chaque fiche et publiez un flux propre pour Merchant Center.",
              },
              {
                href: "/corriger-erreurs-google-merchant-center",
                label: "Erreurs Merchant Center",
                body: "Priorisez rejets, attributs manquants et problemes de conformite fiche par fiche.",
              },
              {
                href: "/feed-produit-amazon-shopify",
                label: "Amazon + Shopify",
                body: "Structurez variantes, GTIN et attributs critiques avant export vers Seller Central.",
              },
              {
                href: "/feed-produit-chatgpt",
                label: "Feed ChatGPT",
                body: "Preparez un catalogue plus lisible pour ChatGPT, Perplexity et les autres assistants IA.",
              },
              {
                href: "/feedplug-vs-channable",
                label: "FeedPlug vs Channable",
                body: "Comparez une approche plus simple face a une suite historique plus dense.",
              },
            ],
          };

  const [productTier, setProductTier] = useState<ProductTier>(1000);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>(["google", "meta"]);
  const [addonIA, setAddonIA] = useState(false);

  const channelCount = Math.min(
    Math.max(1, selectedPlatformIds.length),
    MAX_SELECTABLE_CHANNELS
  ) as ChannelCount;

  const basePrice = useMemo(() => {
    return getPriceFromGrid(productTier, channelCount);
  }, [productTier, channelCount]);

  const togglePlatform = (id: string) => {
    setSelectedPlatformIds((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length >= MAX_SELECTABLE_CHANNELS
          ? prev
          : [...prev, id]
    );
  };

  const addonIAPrice = isEUR ? ADDON_IA_PRICE_EUR : ADDON_IA_PRICE_EUR;
  const totalPrice = basePrice != null ? basePrice + (addonIA ? addonIAPrice : 0) : null;

  const isWithinGrid = basePrice != null;

  return (
    <>
      <MarketingHeader />
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#ffffff",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: "var(--ink)",
        }}
      >
        <section
          style={{
            padding: "132px 48px 72px",
            maxWidth: 1120,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: 40,
              padding: "40px 32px",
              borderRadius: 28,
              border: "1px solid var(--line)",
              background: "linear-gradient(180deg, var(--paper-2) 0%, #ffffff 100%)",
              boxShadow: "0 22px 64px rgba(15,23,42,0.06)",
            }}
          >
            <h1
              style={{
                fontSize: "clamp(38px, 5vw, 56px)",
                fontWeight: 620,
                lineHeight: 1.08,
                margin: "0 0 24px 0",
                letterSpacing: "-0.04em",
              }}
            >
              {t("title")}
            </h1>
            <p
              style={{
                fontSize: 20,
                color: "var(--ink-3)",
                margin: 0,
                maxWidth: 560,
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.6,
              }}
            >
              {t("subtitle")}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "24px 32px",
                marginTop: 32,
                fontSize: 14,
                color: "var(--ink-2)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Zap style={{ width: 18, height: 18, color: "var(--ink)", flexShrink: 0 }} />
                {t("badge1")}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Shield style={{ width: 18, height: 18, color: "var(--ink)", flexShrink: 0 }} />
                {t("badge2")}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle style={{ width: 18, height: 18, color: "var(--ink)", flexShrink: 0 }} />
                {t("badge3")}
              </span>
            </div>
          </div>

          <div
            className="tarifs-config-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: 32,
              alignItems: "start",
              marginBottom: 48,
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid var(--line)",
                borderRadius: 24,
                padding: 32,
                boxShadow: "0 16px 44px rgba(15,23,42,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <h2
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {t("configureTitle")}
                </h2>
                {productTier === 1000 && channelCount === 2 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      backgroundColor: "#fafafa",
                      border: "1px solid var(--line)",
                      padding: "4px 10px",
                      borderRadius: 999,
                      whiteSpace: "nowrap",
                      color: "var(--ink-2)",
                    }}
                  >
                    {t("mostPopular")}
                  </span>
                )}
              </div>

              <div style={{ marginBottom: 28 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--ink-2)",
                    marginBottom: 10,
                  }}
                >
                  {t("productCountLabel")}
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PRODUCT_TIERS.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setProductTier(tier)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 12,
                        border:
                          productTier === tier
                            ? "2px solid #0a0a0a"
                            : "1px solid var(--line)",
                        backgroundColor: productTier === tier ? "#fafafa" : "#fff",
                        fontSize: 14,
                        fontWeight: 500,
                        color: productTier === tier ? "#0a0a0a" : "var(--ink-2)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {t("upTo", { value: getProductTierLabel(tier) })}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 8, marginBottom: 0 }}>
                  {t("over50k")}{" "}
                  <Link href="/demo?source=pricing_contact" style={{ color: "#0a0a0a", textDecoration: "underline" }}>
                    {t("contactUs")}
                  </Link>{" "}
                  {t("forQuote")}
                </p>
              </div>

              <div style={{ marginBottom: 28 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--ink-2)",
                    marginBottom: 10,
                  }}
                >
                  {t("channelsLabel")}
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 10,
                  }}
                >
                  {CHANNEL_PLATFORMS.map((platform) => {
                    const selected = selectedPlatformIds.includes(platform.id);
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => togglePlatform(platform.id)}
                        title={platform.name}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          padding: "10px 8px",
                          borderRadius: 12,
                          border: selected
                            ? "2px solid #0a0a0a"
                            : "1px solid var(--line)",
                          backgroundColor: selected ? "#fafafa" : "#fff",
                          cursor:
                            selected || selectedPlatformIds.length < MAX_SELECTABLE_CHANNELS
                              ? "pointer"
                              : "default",
                          transition: "all 0.15s",
                          opacity:
                            !selected && selectedPlatformIds.length >= MAX_SELECTABLE_CHANNELS
                              ? 0.5
                              : 1,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 4,
                            backgroundColor: platform.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: platform.initial.length > 1 ? 10 : 14,
                            fontWeight: 700,
                            color: "#0a0a0a",
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {platform.initial}
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--ink-2)",
                            textAlign: "center",
                            lineHeight: 1.2,
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {platform.name.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10, marginBottom: 0 }}>
                  {t("channelsSelected", { count: selectedPlatformIds.length })}
                  {". "}
                  {t("moreChannelsDevis")}
                </p>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: "var(--paper-2)",
                  border: "1px solid var(--line)",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={addonIA}
                    onChange={(e) => setAddonIA(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "#0a0a0a" }}
                  />
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Sparkles style={{ width: 18, height: 18, color: "#0a0a0a" }} />
                    <strong style={{ fontSize: 14 }}>{t("addonIATitle")}</strong>
                    <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
                      {t("addonIADesc")}
                    </span>
                  </span>
                </label>
                <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "6px 0 0 30px" }}>
                  +{formatCurrency(ADDON_IA_PRICE_EUR, "EUR", locale)} {t("addonPricePerMonth")}
                </p>
              </div>
            </div>

            <div
              className="tarifs-sticky-box"
              style={{
                backgroundColor: "var(--ink)",
                borderRadius: 24,
                padding: 32,
                color: "#fff",
                position: "sticky",
                top: 100,
                border: "1px solid var(--ink)",
                boxShadow: "0 20px 48px rgba(15,23,42,0.16)",
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.7)",
                  margin: "0 0 8px 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {t("yourPlan")}
              </p>
              {isWithinGrid ? (
                <>
                  <p
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      margin: "0 0 4px 0",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {formatCurrency(totalPrice!, isEUR ? "EUR" : "EUR", locale)}
                    <span style={{ fontSize: 18, fontWeight: 400, opacity: 0.9 }}>
                      {" "}
                      {t("perMonthHT")}
                    </span>
                  </p>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", margin: "0 0 24px 0" }}>
                    {t("productsAndChannels", {
                      products: getProductTierLabel(productTier),
                      channels: channelCount,
                      channelLabel: channelCount > 1 ? t("channels") : t("channel"),
                    })}
                    {addonIA && t("addonIncluded")}
                  </p>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0 0 24px 0",
                      fontSize: 14,
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    <li style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <CheckCircle style={{ width: 18, height: 18, flexShrink: 0, opacity: 0.9 }} />
                      {t("featureImport")}
                    </li>
                    <li style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <CheckCircle style={{ width: 18, height: 18, flexShrink: 0, opacity: 0.9 }} />
                      {t("featureExport", {
                        count: channelCount,
                        channelLabel: channelCount > 1 ? t("channels") : t("channel"),
                      })}
                    </li>
                    {addonIA && (
                      <li style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <CheckCircle style={{ width: 18, height: 18, flexShrink: 0, opacity: 0.9 }} />
                        {t("featureIA")}
                      </li>
                    )}
                  </ul>
                  <Link
                    href="/register"
                    className="tarifs-cta-primary"
                    onClick={() => trackEvent("begin_checkout", {
                      currency: "EUR",
                      value: totalPrice ?? 0,
                      items: `${productTier}_${channelCount}ch${addonIA ? "_ia" : ""}`,
                    })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      textAlign: "center",
                      padding: "16px 24px",
                      borderRadius: 14,
                      fontSize: 15,
                      fontWeight: 600,
                      backgroundColor: "#fff",
                      color: "var(--ink)",
                      textDecoration: "none",
                      transition: "opacity 0.2s, transform 0.15s",
                    }}
                  >
                    {t("ctaStartTrial")}
                    <ArrowRight style={{ width: 18, height: 18 }} />
                  </Link>
                  <p
                    style={{
                      textAlign: "center",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.6)",
                      margin: "14px 0 0 0",
                    }}
                  >
                    {t("noCardCancel")}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 20, fontWeight: 600, margin: "0 0 12px 0" }}>
                    {t("onQuoteTitle")}
                  </p>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", margin: "0 0 24px 0" }}>
                    {t("onQuoteDesc")}
                  </p>
                  <Link
                    href="/demo?source=pricing_contact"
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "14px 24px",
                      borderRadius: 14,
                      fontSize: 15,
                      fontWeight: 600,
                      backgroundColor: "#fff",
                      color: "var(--ink)",
                      textDecoration: "none",
                    }}
                  >
                    {t("contactUs")}
                  </Link>
                </>
              )}
            </div>
          </div>

          <details
            style={{
              backgroundColor: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 20,
              padding: "20px 24px",
              marginTop: 24,
            }}
          >
            <summary
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink-2)",
                cursor: "pointer",
              }}
            >
              {t("viewGridSummary")}
            </summary>
            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--line)", color: "var(--ink-2)" }}>
                      {t("products")}
                    </th>
                    {CHANNEL_OPTIONS.map((n) => (
                      <th key={n} style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", color: "var(--ink-2)" }}>
                        {n} {n > 1 ? t("channels") : t("channel")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRODUCT_TIERS.map((tier) => (
                    <tr key={tier}>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f5f5f5", fontWeight: 500 }}>
                        {t("upTo", { value: getProductTierLabel(tier) })}
                      </td>
                      {CHANNEL_OPTIONS.map((ch) => (
                        <td key={ch} style={{ padding: "10px 12px", borderBottom: "1px solid #f5f5f5" }}>
                          {PRICING_GRID_EUR[tier][ch]} €
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 12, marginBottom: 0 }}>
              {t("addonGridNote")}
            </p>
          </details>

          {isWithinGrid && (
            <div style={{ textAlign: "center", marginTop: 32 }}>
              <Link
                href="/register"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "16px 32px",
                  borderRadius: 2,
                  fontSize: 16,
                  fontWeight: 500,
                  backgroundColor: "#0a0a0a",
                  color: "#fff",
                  textDecoration: "none",
                  transition: "opacity 0.2s",
                }}
              >
                {t("ctaStartTrial")}
                <ArrowRight style={{ width: 18, height: 18 }} />
              </Link>
            </div>
          )}

          <p
            style={{
              textAlign: "center",
              fontSize: 14,
              color: "var(--ink-3)",
              marginTop: 40,
            }}
          >
            {t("trialNote")}
          </p>

          <section
            style={{
              marginTop: 56,
              paddingTop: 40,
              borderTop: "1px solid var(--line)",
            }}
          >
            <h2
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "0 0 12px 0",
                textAlign: "center",
              }}
            >
              {featuredCopy.title}
            </h2>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.7,
                color: "var(--ink-3)",
                margin: "0 auto 28px",
                maxWidth: 760,
                textAlign: "center",
              }}
            >
              {featuredCopy.intro}
            </p>
            <div
              className="tarifs-config-grid-links"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 16,
              }}
            >
              {featuredCopy.cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  style={{
                    padding: 24,
                    borderRadius: 2,
                    border: "1px solid var(--line)",
                    backgroundColor: "#fff",
                    textDecoration: "none",
                    color: "#0a0a0a",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                    Landing page
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 10 }}>
                    {card.label}
                  </div>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--ink-2)" }}>{card.body}</p>
                </Link>
              ))}
            </div>
          </section>
        </section>
      </main>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .tarifs-cta-primary:hover { opacity: 0.92; transform: translateY(-1px); }
            @media (max-width: 900px) {
              .tarifs-config-grid { grid-template-columns: 1fr !important; }
              .tarifs-config-grid-links { grid-template-columns: 1fr !important; }
              .tarifs-sticky-box { position: static !important; }
            }
          `,
        }}
      />
    </>
  );
}

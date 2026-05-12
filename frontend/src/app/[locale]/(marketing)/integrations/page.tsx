"use client";

import { useTranslations } from "next-intl";
import { Share2, ArrowLeft, ArrowRight, CheckCircle2, Layers3, Workflow } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { Link } from "@/i18n/routing";

const CHANNEL_KEYS = [
  "googleShopping",
  "meta",
  "amazon",
  "cdiscount",
  "mirakl",
  "fnac",
  "rakuten",
  "shopify",
] as const;

export default function IntegrationsPage() {
  const t = useTranslations("integrations");

  return (
    <>
      <MarketingHeader />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .integrations-hero-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.95fr);
              gap: 24px;
              align-items: stretch;
            }
            .integrations-stat-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 14px;
            }
            .integrations-channel-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 16px;
            }
            @media (max-width: 980px) {
              .integrations-hero-grid,
              .integrations-channel-grid {
                grid-template-columns: 1fr;
              }
            }
            @media (max-width: 720px) {
              .integrations-stat-grid {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />
      <main
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, rgba(148,163,184,0.12), transparent 24%), linear-gradient(180deg, var(--paper-2) 0%, #ffffff 28%)",
          padding: "128px 24px 96px",
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 28 }}>
          <section
            className="integrations-hero-grid"
            style={{}}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(226,232,240,0.9)",
                borderRadius: 30,
                padding: "40px 36px",
                boxShadow: "0 24px 70px rgba(15,23,42,0.06)",
              }}
            >
              <Link
                href="/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--ink-3)",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  marginBottom: 18,
                }}
              >
                <ArrowLeft size={16} /> {t("backToHome")}
              </Link>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "var(--paper-2)",
                  border: "1px solid var(--line)",
                  color: "var(--ink-2)",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 18,
                }}
              >
                <Share2 size={14} /> Intégrations FeedPlug
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(2.2rem, 4.2vw, 4.1rem)",
                  lineHeight: 0.97,
                  letterSpacing: "-0.055em",
                  color: "var(--ink)",
                }}
              >
                {t("title")}
              </h1>
              <p
                style={{
                  margin: "22px 0 0",
                  color: "var(--ink-2)",
                  fontSize: 17,
                  lineHeight: 1.75,
                  maxWidth: 680,
                }}
              >
                {t("description")}
              </p>

              <div
                className="integrations-stat-grid"
                style={{
                  marginTop: 28,
                }}
              >
                {[
                  { icon: Layers3, label: "Catalogue unique", value: "1 socle" },
                  { icon: Workflow, label: "Canaux activables", value: "8+" },
                  { icon: CheckCircle2, label: "Logique par canal", value: "Conforme" },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    style={{
                      borderRadius: 22,
                      border: "1px solid var(--line)",
                      background: "var(--paper)",
                      padding: "18px 18px 16px",
                    }}
                  >
                    <Icon size={18} style={{ color: "var(--ink)", marginBottom: 12 }} />
                    <div style={{ color: "var(--ink)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.04em" }}>{value}</div>
                    <div style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                borderRadius: 30,
                background: "var(--ink)",
                color: "var(--paper-2)",
                padding: "30px 28px",
                boxShadow: "0 24px 80px rgba(15,23,42,0.16)",
              }}
            >
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.62 }}>
                Parcours recommandés
              </div>
              <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                {[
                  {
                    href: "/optimiser-flux-google-shopping-shopify",
                    title: "Shopify vers Google Shopping",
                    body: "Connecter Shopify, corriger Merchant Center puis publier un flux propre.",
                  },
                  {
                    href: "/feed-produit-amazon-shopify",
                    title: "Shopify vers Amazon",
                    body: "Prioriser GTIN, variations et préparation Seller Central sans tableurs.",
                  },
                  {
                    href: "/gestion-flux-produits-marketplaces",
                    title: "Marketplaces",
                    body: "Adapter un catalogue unique à Amazon, Rakuten, Fnac, Mirakl ou Cdiscount.",
                  },
                  {
                    href: "/comparatif-outils-feed-produits",
                    title: "Comparatif outils feed",
                    body: "Comparer FeedPlug, Channable et Shoppingfeed selon votre niveau de complexite.",
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      textDecoration: "none",
                      borderRadius: 22,
                      border: "1px solid rgba(148,163,184,0.18)",
                      background: "rgba(255,255,255,0.04)",
                      padding: "18px 18px 16px",
                      color: "var(--paper-2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{item.title}</div>
                      <ArrowRight size={16} style={{ opacity: 0.75 }} />
                    </div>
                    <div style={{ marginTop: 8, lineHeight: 1.6, color: "rgba(248,250,252,0.75)", fontSize: 14 }}>
                      {item.body}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section
            style={{
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(226,232,240,0.9)",
              borderRadius: 30,
              padding: "32px 28px",
              boxShadow: "0 24px 70px rgba(15,23,42,0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.04em", color: "var(--ink)" }}>
                  Canaux et plateformes pris en charge
                </h2>
                <p style={{ margin: "10px 0 0", color: "var(--ink-3)", lineHeight: 1.7 }}>
                  Une même base catalogue, puis une logique d’adaptation propre à chaque destination.
                </p>
              </div>
              <Link href="/docs/export" style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "none", borderBottom: "1px solid var(--line-strong)", paddingBottom: 2 }}>
                {t("seeExportGuide")}
              </Link>
            </div>

            <div
              className="integrations-channel-grid"
              style={{}}
            >
              {CHANNEL_KEYS.map((key) => (
                <section
                  key={key}
                  style={{
                    padding: "22px 22px 20px",
                    border: "1px solid var(--line)",
                    borderRadius: 24,
                    backgroundColor: "var(--paper)",
                  }}
                >
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>
                    {t(`channelLabels.${key}`)}
                  </h2>
                  <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
                    {t(`channels.${key}`)}
                  </p>
                </section>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

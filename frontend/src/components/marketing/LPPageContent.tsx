"use client";

import React from "react";
import {
  ArrowRight,
  BarChart3,
  Sparkles,
  Upload,
  Share2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import MarketingHeader from "@/components/marketing/MarketingHeader";

const ICONS = [Upload, BarChart3, Sparkles, Share2];

type LPPageContentProps = {
  namespace: "lpGoogleShopping" | "lpAmazon" | "lpRakuten" | "lpCdiscount";
};

export function LPPageContent({ namespace }: LPPageContentProps) {
  const t = useTranslations(namespace);
  const isGoogleShoppingPage = namespace === "lpGoogleShopping";
  const isAmazonPage = namespace === "lpAmazon";

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "var(--ink)",
      }}
    >
      <MarketingHeader />

      <section
        style={{
          padding: "132px 48px 72px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            padding: "40px",
            borderRadius: 28,
            border: "1px solid var(--line)",
            background: "linear-gradient(180deg, var(--paper-2) 0%, #ffffff 100%)",
            boxShadow: "0 22px 64px rgba(15,23,42,0.06)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              backgroundColor: "#ffffff",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
              marginBottom: 20,
            }}
          >
            {t("hero.eyebrow")}
          </div>
          <h1
            style={{
              fontSize: "clamp(38px, 5vw, 56px)",
              fontWeight: 620,
              lineHeight: 1.06,
              marginBottom: 20,
              letterSpacing: "-0.04em",
              maxWidth: 820,
            }}
          >
            {t("hero.title")}
          </h1>
          <p
            style={{
              fontSize: 19,
              lineHeight: 1.72,
              color: "var(--ink-3)",
              marginBottom: 28,
              maxWidth: 760,
            }}
          >
            {t("hero.subtitle")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
            <Link
              href="/demo"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 18px",
                borderRadius: 12,
                backgroundColor: "var(--ink)",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {t("cta.button")}
              <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
            <Link
              href="/docs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 18px",
                borderRadius: 12,
                backgroundColor: "#ffffff",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {t("nav.docs")}
            </Link>
          </div>
        </div>
        {isGoogleShoppingPage ? (
          <div style={{ display: "grid", gap: 16, maxWidth: 760, marginTop: 20 }}>
            <div
              style={{
                padding: 22,
                border: "1px solid var(--accent-bg)",
                borderRadius: 18,
                backgroundColor: "#f8fbff",
              }}
            >
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--accent-2)",
                  letterSpacing: "0.01em",
                }}
              >
                Shopify
              </p>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: "var(--ink-2)",
                }}
              >
                Vous vendez deja sur Shopify ? Consultez notre page dediee pour connecter Shopify,
                corriger Merchant Center et publier un flux Google Shopping conforme.
              </p>
              <Link
                href="/optimiser-flux-google-shopping-shopify"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  color: "var(--ink)",
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Voir la page Shopify vers Google Shopping
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
            </div>

            <div
              style={{
                padding: 22,
                border: "1px solid var(--success-bg)",
                borderRadius: 18,
                backgroundColor: "#f6fff8",
              }}
            >
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--success)",
                  letterSpacing: "0.01em",
                }}
              >
                Merchant Center
              </p>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: "var(--ink-2)",
                }}
              >
                Vous voulez traiter les rejets et diagnostics Google plus vite ? Consultez la page dediee aux erreurs Merchant Center avec scoring produit et priorisation des blocages.
              </p>
              <Link
                href="/corriger-erreurs-google-merchant-center"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  color: "var(--ink)",
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Voir la page erreurs Merchant Center
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
            </div>
          </div>
        ) : null}
        {isAmazonPage ? (
          <div
            style={{
              padding: 22,
              border: "1px solid #FDE68A",
              borderRadius: 18,
              backgroundColor: "var(--warning-bg)",
              maxWidth: 760,
              marginTop: isGoogleShoppingPage ? 18 : 20,
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--warning)",
                letterSpacing: "0.01em",
              }}
            >
              Shopify
            </p>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 15,
                lineHeight: 1.7,
                color: "var(--ink-2)",
              }}
            >
              Vous vendez deja sur Shopify ? Consultez notre page dediee pour preparer un feed Amazon plus propre, verifier les variations et prioriser les fiches a corriger.
            </p>
            <Link
              href="/feed-produit-amazon-shopify"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                color: "var(--ink)",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Voir la page Shopify vers Amazon
              <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
          </div>
        ) : null}
      </section>

      <section
        style={{
          padding: "72px 48px",
          backgroundColor: "var(--paper-2)",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 620,
              marginBottom: 32,
              letterSpacing: "-0.02em",
            }}
          >
            {t("pain.title")}
          </h2>
          <ul
            style={{
              listStyle: "none",
              padding: 24,
              margin: 0,
              backgroundColor: "#ffffff",
              border: "1px solid var(--line)",
              borderRadius: 20,
            }}
          >
            {(t.raw("pain.items") as string[]).map((item, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: i === (t.raw("pain.items") as string[]).length - 1 ? 0 : 16,
                  fontSize: 16,
                  color: "var(--ink-2)",
                  lineHeight: 1.6,
                }}
              >
                <AlertCircle
                  style={{
                    width: 20,
                    height: 20,
                    color: "var(--danger)",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        style={{
          padding: "80px 48px",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(30px, 4vw, 40px)",
              fontWeight: 620,
              marginBottom: 16,
              letterSpacing: "-0.03em",
            }}
          >
            {t("solution.title")}
          </h2>
          <p
            style={{
              fontSize: 18,
              color: "var(--ink-2)",
              marginBottom: 48,
              lineHeight: 1.6,
            }}
          >
            {t("solution.subtitle")}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 32,
            }}
          >
            {ICONS.map((Icon, idx) => {
              const steps = t.raw("solution.steps") as {
                title: string;
                desc: string;
              }[];
              const step = steps[idx];
              return (
                <div
                  key={idx}
                  style={{
                    padding: 28,
                    border: "1px solid var(--line)",
                    borderRadius: 20,
                    backgroundColor: "var(--paper-2)",
                  }}
                >
                  <div style={{ marginBottom: 16 }}>
                    <Icon style={{ width: 28, height: 28 }} />
                  </div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    {step?.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 15,
                      color: "var(--ink-3)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {step?.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "80px 48px",
          backgroundColor: "var(--paper-2)",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 28px)",
              fontWeight: 620,
              marginBottom: 24,
              letterSpacing: "-0.02em",
            }}
          >
            {t("useCase.title")}
          </h2>
          <p
            style={{
              fontSize: 17,
              color: "var(--ink-2)",
              lineHeight: 1.7,
              marginBottom: 24,
            }}
          >
            {t("useCase.intro")}
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 24,
              margin: 0,
              backgroundColor: "#ffffff",
              border: "1px solid var(--line)",
              borderRadius: 20,
            }}
          >
            {(t.raw("useCase.results") as string[]).map((item, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: i === (t.raw("useCase.results") as string[]).length - 1 ? 0 : 12,
                  fontSize: 16,
                }}
              >
                <CheckCircle2
                  style={{
                    width: 20,
                    height: 20,
                    color: "var(--success)",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />
                <span style={{ color: "#0a0a0a", lineHeight: 1.6 }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        style={{
          padding: "80px 48px",
          backgroundColor: "#ffffff",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 28px)",
              fontWeight: 620,
              marginBottom: 32,
              letterSpacing: "-0.02em",
            }}
          >
            {t("faq.title")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(t.raw("faq.items") as { q: string; a: string }[]).map(
              (item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "20px 22px",
                    border: "1px solid var(--line)",
                    borderRadius: 18,
                    backgroundColor: "var(--paper-2)",
                  }}
                >
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      marginBottom: 8,
                      color: "var(--ink)",
                    }}
                  >
                    {item.q}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      color: "var(--ink-3)",
                      lineHeight: 1.6,
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section
        id="contact"
        style={{
          padding: "88px 48px",
          backgroundColor: "var(--ink)",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 36px)",
              fontWeight: 620,
              color: "#fff",
              marginBottom: 16,
              letterSpacing: "-0.03em",
            }}
          >
            {t("cta.title")}
          </h2>
          <p
            style={{
              fontSize: 18,
              color: "var(--line-strong)",
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            {t("cta.subtitle")}
          </p>
          <Link
            href="/demo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "15px 24px",
              backgroundColor: "#fff",
              color: "var(--ink)",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 12,
            }}
          >
            {t("cta.button")}
            <ArrowRight style={{ width: 18, height: 18 }} />
          </Link>
        </div>
      </section>

      <footer
        style={{
          padding: "48px 48px",
          backgroundColor: "var(--paper-2)",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: 16,
              fontWeight: 650,
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            FeedPlug
          </Link>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link
              href="/optimiser-flux-google-shopping"
              style={{
                color: "var(--ink-3)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Google Shopping
            </Link>
            <Link
              href="/optimiser-flux-amazon"
              style={{
                color: "var(--ink-3)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Amazon
            </Link>
            <Link
              href="/optimiser-flux-rakuten"
              style={{
                color: "var(--ink-3)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Rakuten
            </Link>
            <Link
              href="/optimiser-flux-cdiscount"
              style={{
                color: "var(--ink-3)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Cdiscount
            </Link>
            <Link
              href="/"
              style={{
                color: "var(--ink-3)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {t("nav.home")}
            </Link>
            <Link
              href="/docs"
              style={{
                color: "var(--ink-3)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {t("nav.docs")}
            </Link>
            <Link
              href="/docs/score"
              style={{
                color: "var(--ink-3)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {t("nav.docsScore")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

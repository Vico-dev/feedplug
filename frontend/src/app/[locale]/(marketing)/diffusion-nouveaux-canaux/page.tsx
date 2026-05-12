"use client";

import React from "react";
import {
  ArrowRight,
  Rocket,
  Globe,
  Zap,
  Clock,
  Target,
  CheckCircle,
  CheckCircle2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import WorldMapBackground from "@/components/marketing/WorldMapBackground";

const FEATURES_CANAUX_ICONS = [Clock, Zap, Target];
const FEATURES_MARCHES_ICONS = [Globe, Zap, CheckCircle];

export default function DiffusionNouveauxCanauxPage() {
  const t = useTranslations("lpDiffusionCanaux");

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#0a0a0a",
        position: "relative",
      }}
    >
      <MarketingHeader />

      <section
        style={{
          position: "relative",
          padding: "100px 48px 80px",
          overflow: "hidden",
        }}
      >
        <WorldMapBackground />
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontSize: "clamp(40px, 5vw, 56px)",
              fontWeight: 600,
              lineHeight: 1.15,
              marginBottom: 24,
              letterSpacing: "-0.02em",
              maxWidth: 700,
            }}
          >
            {t("hero.title")}
          </h1>
          <p
            style={{
              fontSize: 20,
              lineHeight: 1.65,
              color: "var(--ink-2)",
              marginBottom: 48,
              maxWidth: 600,
            }}
          >
            {t("hero.subtitle")}
          </p>
          <Link
            href="/demo?source=use_case_demo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 32px",
              backgroundColor: "#0a0a0a",
              color: "#fff",
              textDecoration: "none",
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 2,
            }}
          >
            {t("cta.button")}
            <ArrowRight style={{ width: 18, height: 18 }} />
          </Link>
        </div>
      </section>

      <section
        style={{
          padding: "80px 48px",
          backgroundColor: "#fafafa",
          borderTop: "1px solid var(--line)",
          position: "relative",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Rocket style={{ width: 28, height: 28 }} />
            <h2
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              {t("channels.title")}
            </h2>
          </div>
          <p
            style={{
              fontSize: 18,
              color: "var(--ink-2)",
              marginBottom: 48,
              lineHeight: 1.6,
              maxWidth: 700,
            }}
          >
            {t("channels.description")}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 32,
            }}
          >
            {(t.raw("channels.features") as { title: string; desc: string }[]).map(
              (f, i) => {
                const Icon = FEATURES_CANAUX_ICONS[i];
                return (
                  <div
                    key={i}
                    style={{
                      padding: 28,
                      border: "1px solid var(--line)",
                      borderRadius: 2,
                      backgroundColor: "#fff",
                    }}
                  >
                    <div style={{ marginBottom: 16 }}>
                      {Icon && <Icon style={{ width: 28, height: 28 }} />}
                    </div>
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        marginBottom: 8,
                      }}
                    >
                      {f.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 15,
                        color: "var(--ink-3)",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {f.desc}
                    </p>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "80px 48px",
          backgroundColor: "#ffffff",
          borderTop: "1px solid var(--line)",
          position: "relative",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Globe style={{ width: 28, height: 28 }} />
            <h2
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              {t("markets.title")}
            </h2>
          </div>
          <p
            style={{
              fontSize: 18,
              color: "var(--ink-2)",
              marginBottom: 48,
              lineHeight: 1.6,
              maxWidth: 700,
            }}
          >
            {t("markets.description")}
          </p>
          <p style={{ color: "var(--ink-3)", fontSize: 15, lineHeight: 1.7, marginBottom: 32, maxWidth: 760 }}>
            <Link href="/gestion-flux-produits-marketplaces" style={{ color: "#0a0a0a", textDecoration: "underline" }}>
              Guide gestion flux marketplaces
            </Link>
            {" : "}centraliser le catalogue et diffuser vers Amazon, Cdiscount, Rakuten, Fnac ou Mirakl depuis une base unique.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 32,
            }}
          >
            {(t.raw("markets.features") as { title: string; desc: string }[]).map(
              (f, i) => {
                const Icon = FEATURES_MARCHES_ICONS[i];
                return (
                  <div
                    key={i}
                    style={{
                      padding: 28,
                      border: "1px solid var(--line)",
                      borderRadius: 2,
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <div style={{ marginBottom: 16 }}>
                      {Icon && <Icon style={{ width: 28, height: 28 }} />}
                    </div>
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        marginBottom: 8,
                      }}
                    >
                      {f.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 15,
                        color: "var(--ink-3)",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {f.desc}
                    </p>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "80px 48px",
          backgroundColor: "#fafafa",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 28px)",
              fontWeight: 600,
              marginBottom: 24,
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
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(t.raw("useCase.results") as string[]).map((item, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: 12,
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
              fontWeight: 600,
              marginBottom: 32,
            }}
          >
            {t("faq.title")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {(t.raw("faq.items") as { q: string; a: string }[]).map(
              (item, i, arr) => (
                <div
                  key={i}
                  style={{
                    paddingBottom: 24,
                    borderBottom:
                      i < arr.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      marginBottom: 8,
                      color: "#0a0a0a",
                    }}
                  >
                    {item.q}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      color: "var(--ink-2)",
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
          padding: "80px 48px",
          backgroundColor: "#0a0a0a",
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
              fontWeight: 600,
              color: "#fff",
              marginBottom: 16,
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
            href="/demo?source=use_case_demo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 32px",
              backgroundColor: "#fff",
              color: "#0a0a0a",
              textDecoration: "none",
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 2,
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
          backgroundColor: "#fafafa",
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
              fontWeight: 500,
              color: "#0a0a0a",
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
          </div>
        </div>
      </footer>
    </div>
  );
}

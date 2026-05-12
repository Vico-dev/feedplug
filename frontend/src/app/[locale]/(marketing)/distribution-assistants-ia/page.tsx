"use client";

import React from "react";
import {
  ArrowRight,
  Sparkles,
  MessageSquare,
  Zap,
  CheckCircle,
  CheckCircle2,
  Database,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import MarketingHeader from "@/components/marketing/MarketingHeader";

const CHANNEL_ICONS = [MessageSquare, MessageSquare, Zap];

export default function DistributionAssistantsIAPage() {
  const t = useTranslations("lpAssistantsIA");
  const platforms = t.raw("channels.platforms") as {
    name: string;
    status: string;
    desc: string;
  }[];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#0a0a0a",
      }}
    >
      <MarketingHeader />

      {/* Hero */}
      <section
        style={{
          padding: "100px 48px 80px",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <Sparkles style={{ width: 24, height: 24 }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            {t("hero.badge")}
          </span>
        </div>
        <h1
          style={{
            fontSize: "clamp(36px, 5vw, 48px)",
            fontWeight: 600,
            lineHeight: 1.2,
            marginBottom: 24,
            letterSpacing: "-0.02em",
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
      </section>

      {/* Contexte */}
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
              fontSize: 28,
              fontWeight: 600,
              marginBottom: 24,
              letterSpacing: "-0.02em",
            }}
          >
            {t("context.title")}
          </h2>
          <p
            style={{
              fontSize: 18,
              color: "var(--ink-2)",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {t("context.description")}
          </p>
        </div>
      </section>

      {/* Canaux */}
      <section
        style={{
          padding: "80px 48px",
          backgroundColor: "#ffffff",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 600,
              marginBottom: 24,
              letterSpacing: "-0.02em",
            }}
          >
            {t("channels.title")}
          </h2>
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
            {platforms.map((p, i) => {
              const Icon = CHANNEL_ICONS[i] || MessageSquare;
              return (
                <div
                  key={p.name}
                  style={{
                    padding: 28,
                    border: "1px solid var(--line)",
                    borderRadius: 2,
                    backgroundColor: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 16,
                    }}
                  >
                    <Icon style={{ width: 28, height: 28 }} />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--success)",
                        backgroundColor: "var(--success-bg)",
                        padding: "4px 10px",
                        borderRadius: 2,
                      }}
                    >
                      {p.status}
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    {p.name}
                  </h3>
                  <p
                    style={{
                      fontSize: 15,
                      color: "var(--ink-3)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {p.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Commerce agentic */}
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
              fontSize: 28,
              fontWeight: 600,
              marginBottom: 24,
              letterSpacing: "-0.02em",
            }}
          >
            {t("agentic.title")}
          </h2>
          <p
            style={{
              fontSize: 18,
              color: "var(--ink-2)",
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            {t("agentic.description")}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(t.raw("agentic.points") as string[]).map((item, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: 16,
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

      {/* FeedPlug */}
      <section
        style={{
          padding: "80px 48px",
          backgroundColor: "#ffffff",
          borderTop: "1px solid var(--line)",
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
            <Database style={{ width: 28, height: 28 }} />
            <h2
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              {t("feedplug.title")}
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
            {t("feedplug.description")}
          </p>
          <div style={{ marginBottom: 28 }}>
            <Link
              href="/feed-produit-chatgpt"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 18px",
                border: "1px solid var(--accent-bg)",
                backgroundColor: "var(--accent-bg)",
                color: "#0a0a0a",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 2,
              }}
            >
              Voir la page feed produit ChatGPT
              <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 32,
            }}
          >
            {(t.raw("feedplug.features") as { title: string; desc: string }[]).map(
              (f, i) => (
                <div
                  key={i}
                  style={{
                    padding: 28,
                    border: "1px solid var(--line)",
                    borderRadius: 2,
                    backgroundColor: "#fafafa",
                  }}
                >
                  <CheckCircle
                    style={{
                      width: 24,
                      height: 24,
                      color: "#0a0a0a",
                      marginBottom: 16,
                    }}
                  />
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
              )
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
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

      {/* CTA */}
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

      {/* Footer */}
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
              style={{ color: "var(--ink-3)", fontSize: 14, textDecoration: "none" }}
            >
              Google Shopping
            </Link>
            <Link
              href="/optimiser-flux-amazon"
              style={{ color: "var(--ink-3)", fontSize: 14, textDecoration: "none" }}
            >
              Amazon
            </Link>
            <Link
              href="/distribution-assistants-ia"
              style={{ color: "var(--ink-3)", fontSize: 14, textDecoration: "none" }}
            >
              Assistants IA
            </Link>
            <Link
              href="/feed-produit-chatgpt"
              style={{ color: "var(--ink-3)", fontSize: 14, textDecoration: "none" }}
            >
              Feed ChatGPT
            </Link>
            <Link href="/" style={{ color: "var(--ink-3)", fontSize: 14, textDecoration: "none" }}>
              {t("nav.home")}
            </Link>
            <Link href="/docs" style={{ color: "var(--ink-3)", fontSize: 14, textDecoration: "none" }}>
              {t("nav.docs")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

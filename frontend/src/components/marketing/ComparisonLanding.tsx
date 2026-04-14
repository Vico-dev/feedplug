import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gauge,
  GitCompareArrows,
  Layers3,
  Sparkles,
} from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { Link } from "@/i18n/routing";
import { createFaqJsonLd, type FAQJsonLdItem } from "@/lib/lp-metadata";

type HeroStat = {
  value: string;
  label: string;
  detail: string;
};

type ComparisonRow = {
  label: string;
  feedplug: string;
  other: string;
};

type ProofCard = {
  title: string;
  body: string;
};

type RelatedLink = {
  href: string;
  label: string;
  body: string;
};

export type ComparisonLandingCopy = {
  backLabel: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  heroStats: HeroStat[];
  asideEyebrow: string;
  quickTitle: string;
  quickIntro: string;
  quickBullets: string[];
  fitTitle: string;
  fitIntro: string;
  feedplugTitle: string;
  feedplugBullets: string[];
  otherTitle: string;
  otherBullets: string[];
  tableTitle: string;
  tableIntro: string;
  tableFirstColumnLabel: string;
  columnLabels: {
    feedplug: string;
    other: string;
  };
  rows: ComparisonRow[];
  proofTitle: string;
  proofCards: ProofCard[];
  faqTitle: string;
  faqIntro: string;
  faqs: FAQJsonLdItem[];
  relatedTitle: string;
  relatedLinks: RelatedLink[];
  ctaTitle: string;
  ctaBody: string;
  ctaHref: string;
  ctaLabel: string;
};

export default function ComparisonLanding({
  copy,
}: {
  copy: ComparisonLandingCopy;
}) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", color: "#0f172a" }}>
      {createFaqJsonLd(copy.faqs)}
      <MarketingHeader />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .comparison-shell {
              font-family: var(--font-geist-sans), sans-serif;
            }
            .comparison-hero-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
              gap: 24px;
              align-items: stretch;
            }
            .comparison-stat-grid,
            .comparison-fit-grid,
            .comparison-proof-grid,
            .comparison-related-grid {
              display: grid;
              gap: 16px;
            }
            .comparison-stat-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
            .comparison-fit-grid,
            .comparison-proof-grid,
            .comparison-related-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .comparison-card {
              border: 1px solid rgba(226,232,240,0.92);
              border-radius: 28px;
              background: rgba(255,255,255,0.94);
              box-shadow: 0 24px 70px rgba(15,23,42,0.05);
            }
            .comparison-table {
              width: 100%;
              border-collapse: collapse;
            }
            .comparison-table th,
            .comparison-table td {
              padding: 18px 18px 18px 0;
              text-align: left;
              vertical-align: top;
              border-bottom: 1px solid #e2e8f0;
            }
            .comparison-table th {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #64748b;
              font-weight: 700;
            }
            .comparison-bullet-list {
              list-style: none;
              padding: 0;
              margin: 18px 0 0;
              display: grid;
              gap: 12px;
            }
            .comparison-bullet-item {
              display: flex;
              align-items: flex-start;
              gap: 10px;
              line-height: 1.65;
              color: #334155;
            }
            .comparison-link-card,
            .comparison-proof-card {
              text-decoration: none;
              color: inherit;
              transition: transform .18s ease, box-shadow .24s ease, border-color .2s ease;
            }
            .comparison-link-card:hover,
            .comparison-proof-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 18px 42px rgba(15,23,42,0.08);
              border-color: #cbd5e1;
            }
            @media (max-width: 980px) {
              .comparison-hero-grid,
              .comparison-fit-grid,
              .comparison-proof-grid,
              .comparison-related-grid,
              .comparison-stat-grid {
                grid-template-columns: 1fr !important;
              }
            }
            @media (max-width: 720px) {
              .comparison-shell {
                padding-left: 20px !important;
                padding-right: 20px !important;
              }
            }
          `,
        }}
      />
      <main className="comparison-shell" style={{ padding: "128px 24px 96px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 24 }}>
          <section className="comparison-hero-grid">
            <div
              className="comparison-card"
              style={{
                padding: "38px 36px",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
              }}
            >
              <Link
                href="/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#64748b",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  marginBottom: 18,
                }}
              >
                <ArrowLeft size={16} />
                {copy.backLabel}
              </Link>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1d4ed8",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 18,
                }}
              >
                <GitCompareArrows size={14} />
                {copy.eyebrow}
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(2.3rem, 4.8vw, 4.4rem)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.055em",
                  color: "#0f172a",
                  maxWidth: 720,
                }}
              >
                {copy.title}
              </h1>
              <p
                style={{
                  margin: "22px 0 0",
                  color: "#475569",
                  fontSize: 17,
                  lineHeight: 1.75,
                  maxWidth: 720,
                }}
              >
                {copy.subtitle}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 28 }}>
                <Link
                  href={copy.primaryHref}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 18px",
                    borderRadius: 16,
                    background: "#0f172a",
                    color: "#f8fafc",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  {copy.primaryLabel}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href={copy.secondaryHref}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 18px",
                    borderRadius: 16,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  {copy.secondaryLabel}
                </Link>
              </div>
              <div className="comparison-stat-grid" style={{ marginTop: 28 }}>
                {copy.heroStats.map((stat, index) => {
                  const Icon = index === 0 ? Gauge : index === 1 ? Layers3 : Sparkles;
                  return (
                    <div
                      key={stat.label}
                      style={{
                        borderRadius: 22,
                        border: "1px solid #e2e8f0",
                        background: "#fbfdff",
                        padding: "18px 18px 16px",
                      }}
                    >
                      <Icon size={18} style={{ color: "#0f172a", marginBottom: 12 }} />
                      <div
                        style={{
                          color: "#0f172a",
                          fontSize: 26,
                          fontWeight: 700,
                          letterSpacing: "-0.045em",
                        }}
                      >
                        {stat.value}
                      </div>
                      <div style={{ color: "#334155", fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                        {stat.label}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.55, marginTop: 6 }}>
                        {stat.detail}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside
              className="comparison-card"
              style={{
                padding: "30px 28px",
                background:
                  "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.94) 100%)",
                color: "#f8fafc",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  opacity: 0.74,
                }}
              >
                <Sparkles size={14} />
                {copy.asideEyebrow}
              </div>
              <h2 style={{ margin: "16px 0 10px", fontSize: 24, letterSpacing: "-0.03em" }}>
                {copy.quickTitle}
              </h2>
              <p style={{ margin: 0, color: "rgba(248,250,252,0.76)", lineHeight: 1.75 }}>
                {copy.quickIntro}
              </p>
              <ul className="comparison-bullet-list">
                {copy.quickBullets.map((item) => (
                  <li key={item} className="comparison-bullet-item" style={{ color: "rgba(248,250,252,0.92)" }}>
                    <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 3, color: "#93c5fd" }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </section>

          <section className="comparison-card" style={{ padding: "32px 28px" }}>
            <h2 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.045em" }}>{copy.fitTitle}</h2>
            <p style={{ margin: "12px 0 0", color: "#475569", lineHeight: 1.75, maxWidth: 820 }}>
              {copy.fitIntro}
            </p>
            <div className="comparison-fit-grid" style={{ marginTop: 24 }}>
              {[
                { title: copy.feedplugTitle, bullets: copy.feedplugBullets, accent: "#dbeafe", iconColor: "#1d4ed8" },
                { title: copy.otherTitle, bullets: copy.otherBullets, accent: "#ede9fe", iconColor: "#6d28d9" },
              ].map((column) => (
                <div
                  key={column.title}
                  style={{
                    borderRadius: 24,
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    padding: "24px 22px",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 999,
                      background: column.accent,
                      color: "#0f172a",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={14} style={{ color: column.iconColor }} />
                    {column.title}
                  </div>
                  <ul className="comparison-bullet-list">
                    {column.bullets.map((item) => (
                      <li key={item} className="comparison-bullet-item">
                        <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 3, color: column.iconColor }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="comparison-card" style={{ padding: "32px 28px" }}>
            <h2 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.045em" }}>{copy.tableTitle}</h2>
            <p style={{ margin: "12px 0 0", color: "#475569", lineHeight: 1.75, maxWidth: 840 }}>
              {copy.tableIntro}
            </p>
            <div style={{ overflowX: "auto", marginTop: 24 }}>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>{copy.tableFirstColumnLabel}</th>
                    <th>{copy.columnLabels.feedplug}</th>
                    <th>{copy.columnLabels.other}</th>
                  </tr>
                </thead>
                <tbody>
                  {copy.rows.map((row) => (
                    <tr key={row.label}>
                      <td style={{ minWidth: 160, fontWeight: 700, color: "#0f172a" }}>{row.label}</td>
                      <td style={{ minWidth: 260, color: "#334155", lineHeight: 1.7 }}>{row.feedplug}</td>
                      <td style={{ minWidth: 260, color: "#334155", lineHeight: 1.7 }}>{row.other}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 style={{ margin: "0 0 16px", fontSize: 30, letterSpacing: "-0.045em" }}>
              {copy.proofTitle}
            </h2>
            <div className="comparison-proof-grid">
              {copy.proofCards.map((card) => (
                <article
                  key={card.title}
                  className="comparison-card comparison-proof-card"
                  style={{ padding: "24px 22px" }}
                >
                  <h3 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.03em" }}>{card.title}</h3>
                  <p style={{ margin: "12px 0 0", color: "#475569", lineHeight: 1.7 }}>{card.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="comparison-card" style={{ padding: "32px 28px" }}>
            <h2 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.045em" }}>{copy.faqTitle}</h2>
            <p style={{ margin: "12px 0 0", color: "#475569", lineHeight: 1.75, maxWidth: 780 }}>
              {copy.faqIntro}
            </p>
            <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
              {copy.faqs.map((item, index) => (
                <article
                  key={item.question}
                  style={{
                    paddingTop: index === 0 ? 0 : 18,
                    borderTop: index === 0 ? "none" : "1px solid #e2e8f0",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 18, letterSpacing: "-0.02em" }}>{item.question}</h3>
                  <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.75 }}>{item.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 style={{ margin: "0 0 16px", fontSize: 30, letterSpacing: "-0.045em" }}>{copy.relatedTitle}</h2>
            <div className="comparison-related-grid">
              {copy.relatedLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="comparison-card comparison-link-card"
                  style={{ padding: "24px 22px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.03em" }}>{item.label}</h3>
                    <ArrowRight size={16} />
                  </div>
                  <p style={{ margin: "12px 0 0", color: "#475569", lineHeight: 1.7 }}>{item.body}</p>
                </Link>
              ))}
            </div>
          </section>

          <section
            className="comparison-card"
            style={{
              padding: "34px 30px",
              background:
                "linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 100%)",
              color: "#f8fafc",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.045em" }}>{copy.ctaTitle}</h2>
            <p style={{ margin: "12px 0 0", color: "rgba(248,250,252,0.74)", lineHeight: 1.75, maxWidth: 820 }}>
              {copy.ctaBody}
            </p>
            <Link
              href={copy.ctaHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                marginTop: 22,
                padding: "14px 18px",
                borderRadius: 16,
                background: "#f8fafc",
                color: "#0f172a",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              {copy.ctaLabel}
              <ArrowRight size={16} />
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}

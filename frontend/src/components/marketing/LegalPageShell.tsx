import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import MarketingHeader from "@/components/marketing/MarketingHeader";

type LegalPageShellProps = {
  isEn: boolean;
  title: string;
  description: string;
  bullets: string[];
  children?: ReactNode;
};

const LEGAL_LINKS = [
  { href: "/legal/mentions", labelFr: "Mentions légales", labelEn: "Legal information" },
  { href: "/legal/privacy", labelFr: "Confidentialité", labelEn: "Privacy" },
  { href: "/legal/terms", labelFr: "CGU", labelEn: "Terms" },
  { href: "/legal/cookies", labelFr: "Cookies", labelEn: "Cookies" },
];

export default function LegalPageShell({
  isEn,
  title,
  description,
  bullets,
  children,
}: LegalPageShellProps) {
  return (
    <>
      <MarketingHeader />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .legal-shell-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.8fr) minmax(260px, 0.9fr);
              gap: 24px;
            }
            @media (max-width: 980px) {
              .legal-shell-grid {
                grid-template-columns: 1fr;
              }
              .legal-shell-aside {
                position: static !important;
              }
            }
          `,
        }}
      />
      <main
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, rgba(148,163,184,0.10), transparent 28%), linear-gradient(180deg, var(--paper-2) 0%, #ffffff 28%)",
          padding: "128px 24px 96px",
        }}
      >
        <div
          className="legal-shell-grid"
          style={{
            maxWidth: 1040,
            margin: "0 auto",
          }}
        >
          <section
            style={{
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(226,232,240,0.9)",
              borderRadius: 28,
              boxShadow: "0 24px 70px rgba(15,23,42,0.06)",
              padding: "40px 36px",
            }}
          >
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
                fontWeight: 600,
                marginBottom: 20,
              }}
            >
              Cadre légal FeedPlug
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(2rem, 4vw, 3.1rem)",
                lineHeight: 1.02,
                letterSpacing: "-0.05em",
                color: "var(--ink)",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                margin: "20px 0 0",
                color: "var(--ink-2)",
                fontSize: 17,
                lineHeight: 1.75,
                maxWidth: 720,
              }}
            >
              {description}
            </p>

            <div
              style={{
                marginTop: 28,
                display: "grid",
                gap: 14,
              }}
            >
              {bullets.map((bullet) => (
                <div
                  key={bullet}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "15px 16px",
                    borderRadius: 18,
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    color: "var(--ink-2)",
                    lineHeight: 1.65,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--ink)",
                      marginTop: 10,
                      flexShrink: 0,
                    }}
                  />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>

            {children ? <div style={{ marginTop: 28 }}>{children}</div> : null}
          </section>

          <aside
            className="legal-shell-aside"
            style={{
              display: "grid",
              gap: 16,
              alignSelf: "start",
              position: "sticky",
              top: 112,
            }}
          >
            <section
              style={{
                background: "rgba(255,255,255,0.9)",
                border: "1px solid rgba(226,232,240,0.9)",
                borderRadius: 24,
                boxShadow: "0 16px 48px rgba(15,23,42,0.05)",
                padding: 24,
              }}
            >
              <div style={{ color: "var(--ink)", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                Liens utiles
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {LEGAL_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      textDecoration: "none",
                      color: "var(--ink-2)",
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: "1px solid var(--line)",
                      background: "var(--paper)",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {isEn ? link.labelEn : link.labelFr}
                  </Link>
                ))}
              </div>
            </section>

            <section
              style={{
                borderRadius: 24,
                background: "var(--ink)",
                color: "var(--paper-2)",
                padding: 24,
                boxShadow: "0 18px 50px rgba(15,23,42,0.16)",
              }}
            >
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.7 }}>
                Contact
              </div>
              <p style={{ margin: "10px 0 0", lineHeight: 1.7, color: "rgba(248,250,252,0.82)" }}>
                {isEn
                  ? "Need a contractual, data or compliance clarification? Contact the FeedPlug team directly."
                  : "Besoin d'une précision contractuelle, données ou conformité ? Contacte directement l'équipe FeedPlug."}
              </p>
              <a
                href="mailto:hello@feedplug.com"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  marginTop: 14,
                  color: "#ffffff",
                  fontWeight: 600,
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.28)",
                  paddingBottom: 2,
                }}
              >
                hello@feedplug.com
              </a>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { seo } from "@/lib/seo";

const DOC_LINKS: { href: string; label: string }[] = [
  { href: "/docs", label: "Vue d'ensemble" },
  { href: "/docs/sources", label: "Sources et import" },
  { href: "/docs/catalogue", label: "Catalogue" },
  { href: "/docs/enrichissement", label: "Enrichissement IA" },
  { href: "/docs/score", label: "Score FeedPlug" },
  { href: "/docs/export", label: "Export et flux" },
  { href: "/docs/dashboard", label: "Dashboard" },
  { href: "/docs/compte", label: "Compte et équipe" },
  { href: "/docs/demarrage", label: "Démarrer" },
  { href: "/docs/faq", label: "FAQ et dépannage" },
  { href: "/docs/glossaire", label: "Glossaire" },
  { href: "/docs/roadmap", label: "Roadmap" },
];

function BreadcrumbJsonLd({ pathname }: { pathname: string }) {
  const items: { name: string; url: string }[] = [
    { name: "Accueil", url: seo.siteUrl },
    { name: "Documentation", url: `${seo.siteUrl}/docs` },
  ];
  const match = DOC_LINKS.find((l) => pathname === l.href || (l.href !== "/docs" && pathname.startsWith(l.href)));
  if (match && match.href !== "/docs") {
    items.push({ name: match.label, url: `${seo.siteUrl}${match.href}` });
  }
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";

  return (
    <>
      <BreadcrumbJsonLd pathname={pathname} />
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(226,232,240,0.9)",
          boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#111827",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                boxShadow: "0 8px 20px rgba(15,23,42,0.14)",
              }}
            >
              FP
            </span>
            <span style={{ color: "#111827", fontSize: 17, fontWeight: 650, letterSpacing: "-0.03em" }}>
              FeedPlug
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Link href="/" style={{ color: "#475569", fontSize: 14, textDecoration: "none", fontWeight: 500 }}>
              Accueil
            </Link>
            <Link href="/tarifs" style={{ color: "#475569", fontSize: 14, textDecoration: "none", fontWeight: 500 }}>
              Tarifs
            </Link>
            <span style={{ color: "#0f172a", fontSize: 14, fontWeight: 700 }}>Documentation</span>
            <a
              href="https://app.feedplug.com/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: 14,
                fontWeight: 600,
                padding: "10px 14px",
                textDecoration: "none",
              }}
            >
              Accès client
            </a>
          </div>
        </div>
      </nav>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .docs-hero-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.65fr) minmax(260px, 0.85fr);
              gap: 24px;
              margin-bottom: 28px;
            }
            .docs-shell-grid {
              display: grid;
              grid-template-columns: 260px minmax(0, 1fr);
              gap: 24px;
              align-items: start;
            }
            @media (max-width: 1040px) {
              .docs-hero-grid,
              .docs-shell-grid {
                grid-template-columns: 1fr;
              }
              .docs-sidebar {
                position: static !important;
              }
            }
          `,
        }}
      />
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, rgba(148,163,184,0.11), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #ffffff 28%)",
          color: "#0a0a0a",
          padding: "128px 24px 96px",
        }}
      >
        <div style={{ maxWidth: 1380, margin: "0 auto" }}>
          <section
            className="docs-hero-grid"
            style={{}}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(226,232,240,0.9)",
                borderRadius: 30,
                boxShadow: "0 24px 70px rgba(15,23,42,0.06)",
                padding: "36px 34px",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                Documentation FeedPlug
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(2rem, 4vw, 3.6rem)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.05em",
                  color: "#0f172a",
                }}
              >
                Tout le socle produit, expliqué sans friction.
              </h1>
              <p
                style={{
                  margin: "18px 0 0",
                  color: "#475569",
                  fontSize: 17,
                  lineHeight: 1.75,
                  maxWidth: 760,
                }}
              >
                Guides d&apos;import, flux, catalogue, enrichissement et diffusion. Même logique visuelle que le site, mais avec une structure plus utilitaire pour trouver la bonne réponse vite.
              </p>
            </div>

            <div
              style={{
                borderRadius: 30,
                background: "#0f172a",
                color: "#f8fafc",
                padding: "28px 26px",
                boxShadow: "0 24px 80px rgba(15,23,42,0.16)",
              }}
            >
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.66 }}>
                Accès rapides
              </div>
              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                {[
                  { href: "/docs/demarrage", label: "Démarrer" },
                  { href: "/docs/sources", label: "Sources et import" },
                  { href: "/docs/export", label: "Export et flux" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      textDecoration: "none",
                      color: "#f8fafc",
                      borderRadius: 18,
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(148,163,184,0.16)",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <a
                href="https://app.feedplug.com/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  marginTop: 18,
                  color: "#ffffff",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.28)",
                  paddingBottom: 2,
                  fontWeight: 600,
                }}
              >
                Accès client
              </a>
            </div>
          </section>

          <div
            className="docs-shell-grid"
            style={{}}
          >
            <aside
              className="docs-sidebar"
              style={{
                position: "sticky",
                top: 112,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(226,232,240,0.9)",
                borderRadius: 28,
                boxShadow: "0 18px 56px rgba(15,23,42,0.05)",
                padding: 20,
              }}
            >
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8", marginBottom: 12 }}>
                Navigation
              </div>
              <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {DOC_LINKS.map(({ href, label }) => {
                  const isActive = pathname === href || (href !== "/docs" && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      style={{
                        padding: "11px 13px",
                        borderRadius: 16,
                        fontSize: 14,
                        textDecoration: "none",
                        color: isActive ? "#0f172a" : "#475569",
                        fontWeight: isActive ? 700 : 500,
                        backgroundColor: isActive ? "#f8fafc" : "transparent",
                        border: isActive ? "1px solid #e2e8f0" : "1px solid transparent",
                      }}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </aside>

            <main
              style={{
                minWidth: 0,
                background: "rgba(255,255,255,0.94)",
                border: "1px solid rgba(226,232,240,0.9)",
                borderRadius: 30,
                boxShadow: "0 24px 70px rgba(15,23,42,0.05)",
                padding: "32px 34px 56px",
              }}
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

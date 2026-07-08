import type { Metadata, Viewport } from "next";
import ComparateurHeader from "@/components/comparateur/comparateur-header";
import CookieConsent from "@/components/comparateur/cookie-consent";
import ComparateurFooter from "@/components/comparateur/comparateur-footer";
import PwaRegister from "@/components/pwa/pwa-register";
import { seo } from "@/lib/seo";

// PWA du comparateur B2C : manifest + theme-color (alignés sur
// public/manifest.webmanifest — background/theme_color #FAFAFA).
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#FAFAFA",
};

// JSON-LD WebSite + SearchAction (sitelinks searchbox) du comparateur conso,
// ancré sur l'apex — distinct du WebSite B2B du layout marketing (pro.).
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Feedplug",
  url: seo.siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: `${seo.siteUrl}/comparateur?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

/**
 * Chrome de marque du comparateur grand public (domaine feedplug.com).
 * Header B2C DÉDIÉ (recherche + mega-menu rayons), distinct du header B2B marketing.
 * Bandeau de consentement cookies (RGPD) en pied de page.
 */
export default async function ComparateurLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(180deg, var(--paper) 0%, var(--paper-2) 220px, var(--surface) 520px)",
        color: "var(--ink)",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <ComparateurHeader />
      {/* padding-top pour compenser le header fixe */}
      <div style={{ flex: 1, paddingTop: "88px" }}>{children}</div>
      <ComparateurFooter locale={locale} />
      <CookieConsent />
      {/* Service worker PWA — enregistré uniquement depuis le comparateur (prod only). */}
      <PwaRegister />
    </div>
  );
}

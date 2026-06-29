import ComparateurHeader from "@/components/comparateur/comparateur-header";
import CookieConsent from "@/components/comparateur/cookie-consent";
import ComparateurFooter from "@/components/comparateur/comparateur-footer";

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
      <ComparateurHeader />
      {/* padding-top pour compenser le header fixe */}
      <div style={{ flex: 1, paddingTop: "88px" }}>{children}</div>
      <ComparateurFooter locale={locale} />
      <CookieConsent />
    </div>
  );
}

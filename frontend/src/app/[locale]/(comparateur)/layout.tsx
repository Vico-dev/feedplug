import MarketingHeader from "@/components/marketing/MarketingHeader";
import ComparateurFooter from "@/components/comparateur/comparateur-footer";

/**
 * Chrome de marque pour le comparateur public.
 * Servi sur le domaine marketing feedplug.com : on réutilise le header
 * marketing (fixe, glassmorphique) et un footer de marque cohérent.
 * Le fond reprend le dégradé "paper" du marketing.
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
      <MarketingHeader />
      {/* padding-top pour compenser le header fixe */}
      <div style={{ flex: 1, paddingTop: "96px" }}>{children}</div>
      <ComparateurFooter locale={locale} />
    </div>
  );
}

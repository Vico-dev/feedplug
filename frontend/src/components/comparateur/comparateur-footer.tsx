import { Link } from "@/i18n/routing";

/**
 * Footer de marque pour le comparateur public (domaine feedplug.com).
 * Reprend le motif du footer marketing (page.tsx) : surface blanche,
 * colonnes ressources / légal, baseline de copyright.
 */
export default function ComparateurFooter({ locale }: { locale: string }) {
  const localePrefix = locale === "fr" ? "" : `/${locale}`;
  const isEn = locale === "en";

  const resources = [
    {
      href: `${localePrefix}/comparateur`,
      label: isEn ? "Price comparison" : "Comparateur de prix",
    },
    {
      href: `${localePrefix}/integrations`,
      label: isEn ? "Integrations" : "Intégrations",
    },
    {
      href: `${localePrefix}/tarifs`,
      label: isEn ? "Pricing" : "Tarifs",
    },
  ];

  return (
    <footer
      style={{
        padding: "56px 24px",
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "40px",
        }}
      >
        <div style={{ maxWidth: "280px" }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              marginBottom: "10px",
            }}
          >
            FeedPlug
          </div>
          <p style={{ fontSize: "14px", color: "var(--ink-3)", lineHeight: 1.6 }}>
            {isEn
              ? "Compare prices across merchants, with price history."
              : "Comparez les prix chez plusieurs marchands, avec l'historique des prix."}
          </p>
        </div>

        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--ink-4)",
              marginBottom: "14px",
            }}
          >
            {isEn ? "Resources" : "Ressources"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {resources.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{ fontSize: "14px", color: "var(--ink-3)", textDecoration: "none" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--ink-4)",
              marginBottom: "14px",
            }}
          >
            {isEn ? "Legal" : "Légal"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Link
              href="/confidentialite"
              style={{ fontSize: "14px", color: "var(--ink-3)", textDecoration: "none" }}
            >
              {isEn ? "Privacy policy" : "Politique de confidentialité"}
            </Link>
            <Link
              href="/transparence"
              style={{ fontSize: "14px", color: "var(--ink-3)", textDecoration: "none" }}
            >
              {isEn ? "Transparency" : "Transparence"}
            </Link>
            <Link
              href="/legal/terms"
              style={{ fontSize: "14px", color: "var(--ink-3)", textDecoration: "none" }}
            >
              {isEn ? "Terms" : "Conditions générales"}
            </Link>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: "1100px",
          margin: "28px auto 0",
          paddingTop: "20px",
          borderTop: "1px solid var(--line)",
          fontSize: "13px",
          color: "var(--ink-4)",
        }}
      >
        © {new Date().getFullYear()} FeedPlug. {isEn ? "All rights reserved." : "Tous droits réservés."}
      </div>
    </footer>
  );
}

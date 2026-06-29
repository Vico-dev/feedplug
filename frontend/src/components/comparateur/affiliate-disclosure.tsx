import Link from "next/link";

// Divulgation « lien affilié » réutilisable (obligation légale + exigence AWIN/adMission).
// `variant="inline"` : petite ligne discrète à poser près des boutons « Voir l'offre ».
// `variant="banner"` : encart, ex. en bas de fiche produit ou de liste d'offres.
export default function AffiliateDisclosure({ variant = "inline" }: { variant?: "inline" | "banner" }) {
  const text = (
    <>
      Lien affilié : si tu achètes via le comparateur, on peut toucher une commission,{" "}
      <strong>sans surcoût pour toi</strong>. Ça finance le service, qui reste indépendant.{" "}
      <Link href="/transparence" style={{ color: "var(--accent)", textDecoration: "none" }}>
        En savoir plus
      </Link>
    </>
  );

  if (variant === "banner") {
    return (
      <div
        role="note"
        style={{
          display: "flex",
          gap: "10px",
          padding: "12px 16px",
          background: "var(--paper-2)",
          borderRadius: "var(--r-lg)",
          fontSize: "13px",
          lineHeight: 1.5,
          color: "var(--ink-3)",
        }}
      >
        <span aria-hidden="true">🔗</span>
        <span>{text}</span>
      </div>
    );
  }

  return (
    <p role="note" style={{ margin: 0, fontSize: "12px", lineHeight: 1.5, color: "var(--ink-4)" }}>
      {text}
    </p>
  );
}

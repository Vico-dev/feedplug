import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Transparence — comment on gagne notre vie | Feedplug",
  description:
    "Le comparateur Feedplug est gratuit et indépendant. On gagne notre vie grâce aux liens affiliés (et bientôt au cashback), sans surcoût pour toi et sans classement payé.",
};

const eyebrow: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "9px",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};
const dot: CSSProperties = {
  width: "7px",
  height: "7px",
  borderRadius: "999px",
  backgroundColor: "var(--accent)",
  boxShadow: "0 0 0 4px var(--accent-bg)",
};
const h2: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "20px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "var(--ink)",
  margin: "0 0 8px",
};
const p: CSSProperties = { margin: 0, fontSize: "16px", lineHeight: 1.6, color: "var(--ink-2)" };

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: "24px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-xs)" }}>
      <h2 style={h2}>{title}</h2>
      <p style={p}>{children}</p>
    </section>
  );
}

export default function TransparencePage() {
  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "56px var(--page-padding-x) 80px" }}>
      <div style={eyebrow}><span style={dot} /> Transparence</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 5vw, 52px)", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.0, color: "var(--ink)", margin: "18px 0 0", maxWidth: "620px" }}>
        Comment on gagne notre vie,{" "}
        <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)" }}>sans te le cacher.</em>
      </h1>
      <p style={{ margin: "16px 0 0", fontSize: "18px", lineHeight: 1.55, color: "var(--ink-2)", maxWidth: "580px" }}>
        Un comparateur de prix n&apos;a de valeur que s&apos;il est honnête. Voici exactement comment Feedplug
        fonctionne et d&apos;où vient notre argent.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "36px" }}>
        <Block title="C'est gratuit pour toi">
          Comparer les prix, suivre l&apos;historique, créer un compte, suivre tes produits : tout est gratuit.
          On ne te facture jamais rien, et on ne revend pas tes données.
        </Block>

        <Block title="On se finance avec les liens affiliés">
          Quand tu cliques « Voir l&apos;offre » et que tu achètes chez un marchand, celui-ci nous verse une
          petite <strong>commission d&apos;affiliation</strong> — <strong>sans aucun surcoût pour toi</strong> (tu paies le même prix).
          C&apos;est ce qui fait vivre le service. Les liens menant à un marchand sont donc des liens monétisés.
        </Block>

        <Block title="Bientôt : on t'en reverse une partie (cashback)">
          On construit un système de <strong>cashback</strong> : une part de la commission te sera reversée sur ta
          cagnotte, retirable en bon d&apos;achat. Tu gagnes de l&apos;argent en achetant malin. (En cours de mise en place.)
        </Block>

        <Block title="Indépendant : aucun classement payé">
          Le tri se fait par <strong>prix et pertinence</strong>, jamais par « qui nous paie le plus ». Un marchand ne
          peut pas acheter une meilleure position. Si une fiche n&apos;a qu&apos;un seul marchand, on te le dit clairement.
        </Block>

        <Block title="Tes données">
          On ne collecte que le nécessaire (e-mail pour ton compte, produits suivis). Connexion par lien magique,
          sans mot de passe. Détails dans notre{" "}
          <Link href="/legal/privacy" style={{ color: "var(--accent)", textDecoration: "none" }}>politique de confidentialité</Link>{" "}
          et notre{" "}
          <Link href="/legal/cookies" style={{ color: "var(--accent)", textDecoration: "none" }}>politique cookies</Link>.
        </Block>
      </div>

      <p style={{ margin: "32px 0 0", fontSize: "14px", color: "var(--ink-3)" }}>
        Une question ? <Link href="/compte" style={{ color: "var(--accent)", textDecoration: "none" }}>Crée ton compte</Link> ou reviens{" "}
        <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>comparer les prix</Link>.
      </p>
    </main>
  );
}

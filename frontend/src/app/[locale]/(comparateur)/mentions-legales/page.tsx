import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Mentions légales | Feedplug",
  description:
    "Mentions légales du comparateur de prix Feedplug : éditeur, directeur de publication, hébergeur et contact.",
  alternates: {
    canonical: `${seo.siteUrl}/mentions-legales`,
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED_ISO = "2026-07-08";

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
  margin: "0 0 10px",
};
const p: CSSProperties = { margin: "0 0 10px", fontSize: "16px", lineHeight: 1.62, color: "var(--ink-2)" };
const a: CSSProperties = { color: "var(--accent)", textDecoration: "none" };

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: "24px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-xs)" }}>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

export default function MentionsLegalesPage() {
  const updated = new Date(LAST_UPDATED_ISO).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "56px var(--page-padding-x) 80px" }}>
      <div style={eyebrow}><span style={dot} /> Mentions légales</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 5vw, 52px)", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.0, color: "var(--ink)", margin: "18px 0 0", maxWidth: "620px" }}>
        Qui édite ce site,{" "}
        <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)" }}>noir sur blanc.</em>
      </h1>
      <p style={{ margin: "16px 0 0", fontSize: "18px", lineHeight: 1.55, color: "var(--ink-2)", maxWidth: "580px" }}>
        Les informations légales du <strong>comparateur Feedplug</strong> (service grand public sur feedplug.com),
        conformément à la loi n°2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique.
      </p>
      <p style={{ margin: "12px 0 0", fontSize: "13px", color: "var(--ink-3)" }}>Dernière mise à jour : {updated}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "36px" }}>
        <Block title="1. Éditeur du site">
          {/* TODO: figer la raison sociale définitive (forme juridique, capital, SIREN/RCS,
              adresse du siège) avant lancement — même chantier que la politique de confidentialité. */}
          <p style={p}>
            Le site feedplug.com est édité par <strong>Agence Inconnu</strong>, établie en France.
          </p>
          <p style={{ ...p, margin: 0 }}>
            Contact : <a href="mailto:victor@agence-inconnu.fr" style={a}>victor@agence-inconnu.fr</a>
          </p>
        </Block>

        <Block title="2. Directeur de la publication">
          <p style={{ ...p, margin: 0 }}>
            Le directeur de la publication est <strong>Victor Soldet</strong>, représentant légal de l&apos;éditeur.
          </p>
        </Block>

        <Block title="3. Hébergement">
          <p style={p}>
            Le site est hébergé par <strong>Google Cloud</strong> (service Cloud Run, région{" "}
            <strong>europe-west1</strong>, Belgique), fourni par :
          </p>
          <p style={{ ...p, margin: 0 }}>
            Google Ireland Limited
            <br />
            Gordon House, Barrow Street, Dublin 4, Irlande
            <br />
            <a href="https://cloud.google.com" style={a} target="_blank" rel="noopener noreferrer">cloud.google.com</a>
          </p>
        </Block>

        <Block title="4. Modèle économique">
          <p style={{ ...p, margin: 0 }}>
            Le comparateur Feedplug est <strong>gratuit</strong> pour ses utilisateurs. Il est rémunéré par des{" "}
            <strong>liens affiliés</strong> : quand tu cliques vers un marchand et que tu achètes, le marchand nous
            verse une commission, <strong>sans surcoût pour toi</strong> et sans influence sur le classement des offres.
            Tout est expliqué en détail sur notre page{" "}
            <Link href="/transparence" style={a}>transparence</Link>.
          </p>
        </Block>

        <Block title="5. Propriété intellectuelle">
          <p style={{ ...p, margin: 0 }}>
            La structure du site, sa charte graphique et ses contenus originaux sont la propriété de l&apos;éditeur.
            Les noms, marques, visuels et descriptions des produits comparés restent la propriété de leurs
            titulaires respectifs (marchands et marques) ; ils sont reproduits à des fins d&apos;information et de
            comparaison des prix.
          </p>
        </Block>

        <Block title="6. Nous contacter">
          <p style={{ ...p, margin: 0 }}>
            Pour toute question sur le site, ses contenus ou tes données personnelles :{" "}
            <a href="mailto:victor@agence-inconnu.fr" style={a}>victor@agence-inconnu.fr</a>. Voir aussi la{" "}
            <Link href="/confidentialite" style={a}>politique de confidentialité</Link> et les{" "}
            <Link href="/cgu" style={a}>conditions générales d&apos;utilisation</Link>.
          </p>
        </Block>
      </div>

      <p style={{ margin: "32px 0 0", fontSize: "14px", color: "var(--ink-3)" }}>
        Retour au{" "}
        <Link href="/" style={a}>comparateur</Link>.
      </p>
    </main>
  );
}

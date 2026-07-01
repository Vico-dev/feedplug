import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Feedplug",
  description:
    "Quelles données le comparateur Feedplug collecte, pourquoi, sur quelle base légale, combien de temps, et comment exercer tes droits (dont la suppression de compte en un clic).",
};

const LAST_UPDATED_ISO = "2026-07-01";

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

export default function ConfidentialitePage() {
  const updated = new Date(LAST_UPDATED_ISO).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const th: CSSProperties = { textAlign: "left", padding: "8px 10px", background: "var(--paper-2)", fontWeight: 600, fontSize: "13px", color: "var(--ink)", border: "1px solid var(--line)" };
  const td: CSSProperties = { padding: "8px 10px", fontSize: "14px", lineHeight: 1.5, color: "var(--ink-2)", border: "1px solid var(--line)", verticalAlign: "top" };

  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "56px var(--page-padding-x) 80px" }}>
      <div style={eyebrow}><span style={dot} /> Confidentialité</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 5vw, 52px)", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.0, color: "var(--ink)", margin: "18px 0 0", maxWidth: "620px" }}>
        Tes données,{" "}
        <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)" }}>et ce qu&apos;on en fait.</em>
      </h1>
      <p style={{ margin: "16px 0 0", fontSize: "18px", lineHeight: 1.55, color: "var(--ink-2)", maxWidth: "580px" }}>
        Cette politique décrit les traitements du <strong>comparateur Feedplug</strong> (service grand public sur
        feedplug.com). On collecte le strict nécessaire, et tout ce qui sert à te personnaliser l&apos;expérience est
        facultatif et soumis à ton consentement.
      </p>
      <p style={{ margin: "12px 0 0", fontSize: "13px", color: "var(--ink-3)" }}>Dernière mise à jour : {updated}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "36px" }}>
        <Block title="1. Qui est responsable">
          <p style={p}>
            Le responsable du traitement est <strong>Agence Inconnu</strong>, opérateur du service Feedplug, établi en
            France. Pour toute question ou pour exercer tes droits :{" "}
            <a href="mailto:support@feedplug.com" style={a}>support@feedplug.com</a>.
          </p>
        </Block>

        <Block title="2. Ce qu'on collecte et pourquoi">
          <p style={p}>
            On distingue ce qui est <strong>nécessaire</strong> au service de ce qui est <strong>facultatif</strong>
            {" "}(collecté seulement si tu le fournis et le consens).
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "6px" }}>
              <thead>
                <tr>
                  <th style={th}>Donnée</th>
                  <th style={th}>Finalité</th>
                  <th style={th}>Base légale</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={td}>E-mail (connexion par lien magique), prénom et nom si tu les renseignes</td>
                  <td style={td}>Créer et sécuriser ton compte, t&apos;identifier, t&apos;adresser les liens de connexion</td>
                  <td style={td}>Exécution du service</td>
                </tr>
                <tr>
                  <td style={td}>Empreinte technique de session (hash d&apos;IP, navigateur)</td>
                  <td style={td}>Sécurité des sessions, prévention des abus (rate-limit)</td>
                  <td style={td}>Intérêt légitime</td>
                </tr>
                <tr>
                  <td style={td}>Produits suivis (watchlist) et centres d&apos;intérêt (catégories)</td>
                  <td style={td}>Alertes de baisse de prix, organiser ton feed</td>
                  <td style={td}>Exécution du service</td>
                </tr>
                <tr>
                  <td style={td}><strong>Facultatif —</strong> données socio-démographiques : tranche d&apos;âge, genre, région, composition du foyer, budget</td>
                  <td style={td}>Personnaliser tes recommandations</td>
                  <td style={td}>Consentement</td>
                </tr>
                <tr>
                  <td style={td}><strong>Facultatif —</strong> marques favorites (affinités)</td>
                  <td style={td}>Mettre en avant les produits des marques que tu aimes</td>
                  <td style={td}>Consentement</td>
                </tr>
                <tr>
                  <td style={td}>Clic sortant vers un marchand (identifiant de clic, nom du marchand, horodatage)</td>
                  <td style={td}>Attribuer une commission d&apos;affiliation et, à terme, ton cashback</td>
                  <td style={td}>Intérêt légitime / exécution</td>
                </tr>
                <tr>
                  <td style={td}><strong>Facultatif —</strong> opt-in e-mails</td>
                  <td style={td}>T&apos;envoyer bons plans et nouveautés</td>
                  <td style={td}>Consentement</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ ...p, margin: "12px 0 0" }}>
            On ne collecte <strong>aucune donnée bancaire</strong> : on ne voit jamais tes moyens de paiement ni tes achats
            chez les marchands.
          </p>
        </Block>

        <Block title="3. Personnalisation : comment ça marche">
          <p style={p}>
            Si tu y consens, on utilise tes <strong>centres d&apos;intérêt</strong>, tes <strong>marques favorites</strong> et
            tes <strong>données socio-démographiques</strong> pour ordonner ton feed et te proposer une section
            « Recommandé pour toi ». Ces données sont <strong>facultatives</strong> : le comparateur fonctionne à
            l&apos;identique sans elles. Tu peux <strong>retirer ton consentement</strong> à tout moment (en décochant la
            case dans l&apos;onboarding ou depuis ton compte) — on cesse alors d&apos;utiliser ces données pour te profiler.
            On ne fait <strong>aucune décision automatisée</strong> ayant un effet juridique sur toi.
          </p>
        </Block>

        <Block title="4. Affiliation et destinataires">
          <p style={p}>
            Quand tu cliques « Voir l&apos;offre », on te redirige vers le marchand via notre partenaire d&apos;affiliation
            (<strong>AWIN</strong>) avec un identifiant de clic anonyme. Cela nous permet d&apos;être rémunérés
            <strong> sans surcoût pour toi</strong>. On ne <strong>vend pas</strong> tes données et on ne les partage pas à
            des fins publicitaires tierces. Nos sous-traitants techniques (hébergement, e-mail transactionnel) agissent
            sur instruction et sous contrat.
          </p>
        </Block>

        <Block title="5. Cookies">
          <p style={p}>
            On utilise un cookie de session strictement nécessaire (<code>cmp_session</code>, pour te garder connecté) et
            un cookie mémorisant ton choix de consentement (<code>cmp_cookie_consent</code>). Aucun cookie publicitaire
            tiers n&apos;est déposé.
          </p>
        </Block>

        <Block title="6. Hébergement et conservation">
          <p style={p}>
            Tes données sont hébergées dans l&apos;Union Européenne (Google Cloud, région europe-west1, Belgique),
            chiffrées au repos et en transit (TLS). On conserve les données de compte tant qu&apos;il est actif ; à la
            suppression, on efface tes données personnelles (voir ci-dessous). Les données de clic servant à l&apos;affiliation
            sont conservées le temps nécessaire au calcul des commissions.
          </p>
        </Block>

        <Block title="7. Tes droits">
          <p style={p}>
            Tu disposes des droits d&apos;accès, de rectification, d&apos;effacement, de portabilité, de limitation et
            d&apos;opposition (RGPD). Le plus simple :
          </p>
          <p style={p}>
            → <strong>Supprimer ton compte en un clic</strong> depuis{" "}
            <Link href="/compte/profil" style={a}>Mon profil</Link>. Cela efface ton identité (e-mail anonymisé), tes
            centres d&apos;intérêt, ta watchlist, ton profil socio-démo et tes affinités marques.
          </p>
          <p style={{ ...p, margin: 0 }}>
            Tu peux aussi nous écrire à <a href="mailto:support@feedplug.com" style={a}>support@feedplug.com</a> (réponse
            sous 30 jours) et introduire une réclamation auprès de la <strong>CNIL</strong>.
          </p>
        </Block>

        <Block title="8. Modifications">
          <p style={{ ...p, margin: 0 }}>
            On peut faire évoluer cette politique. En cas de changement substantiel, on t&apos;en informe. Consulte aussi
            notre page{" "}
            <Link href="/transparence" style={a}>transparence</Link> pour comprendre notre modèle économique.
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

import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { seo } from "@/lib/seo";
import CookieChoiceReset from "@/components/comparateur/cookie-choice-reset";

export const metadata: Metadata = {
  title: "Cookies | Feedplug",
  description:
    "Quels cookies le comparateur Feedplug dépose, à quoi ils servent, ce qui n'est activé qu'avec ton consentement, et comment changer ton choix à tout moment.",
  alternates: {
    canonical: `${seo.siteUrl}/cookies`,
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

export default function CookiesPage() {
  const updated = new Date(LAST_UPDATED_ISO).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const th: CSSProperties = { textAlign: "left", padding: "8px 10px", background: "var(--paper-2)", fontWeight: 600, fontSize: "13px", color: "var(--ink)", border: "1px solid var(--line)" };
  const td: CSSProperties = { padding: "8px 10px", fontSize: "14px", lineHeight: 1.5, color: "var(--ink-2)", border: "1px solid var(--line)", verticalAlign: "top" };

  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "56px var(--page-padding-x) 80px" }}>
      <div style={eyebrow}><span style={dot} /> Cookies</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 5vw, 52px)", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.0, color: "var(--ink)", margin: "18px 0 0", maxWidth: "620px" }}>
        Les cookies,{" "}
        <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)" }}>sans jargon.</em>
      </h1>
      <p style={{ margin: "16px 0 0", fontSize: "18px", lineHeight: 1.55, color: "var(--ink-2)", maxWidth: "580px" }}>
        Le <strong>comparateur Feedplug</strong> (feedplug.com) utilise très peu de cookies : deux strictement
        nécessaires, et une mesure d&apos;audience uniquement si tu l&apos;acceptes. Aucun cookie publicitaire tiers
        n&apos;est déposé sur ce site.
      </p>
      <p style={{ margin: "12px 0 0", fontSize: "13px", color: "var(--ink-3)" }}>Dernière mise à jour : {updated}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "36px" }}>
        <Block title="1. Cookies strictement nécessaires">
          <p style={p}>
            Ils font fonctionner le site et sont exemptés de consentement (article 82 de la loi Informatique et
            Libertés) :
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "6px" }}>
              <thead>
                <tr>
                  <th style={th}>Cookie</th>
                  <th style={th}>Finalité</th>
                  <th style={th}>Durée</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={td}><code>cmp_session</code></td>
                  <td style={td}>Te garder connecté à ton compte (session sécurisée après connexion par lien magique)</td>
                  <td style={td}>Durée de la session</td>
                </tr>
                <tr>
                  <td style={td}><code>cmp_cookie_consent</code></td>
                  <td style={td}>Mémoriser ton choix de consentement (pour ne pas te réafficher la bannière à chaque visite)</td>
                  <td style={td}>1 an</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Block>

        <Block title="2. Mesure d'audience (soumise à ton consentement)">
          <p style={{ ...p, margin: 0 }}>
            Si — et seulement si — tu cliques « Tout accepter » dans la bannière, on charge{" "}
            <strong>Google Tag Manager</strong> pour mesurer l&apos;audience du site (pages vues, parcours, provenance).
            Tant que tu n&apos;as pas consenti, ou si tu as choisi « Refuser les non-essentiels »,{" "}
            <strong>aucun script de mesure n&apos;est chargé</strong> et aucun cookie de mesure n&apos;est déposé. Ces
            données nous servent uniquement à améliorer le comparateur.
          </p>
        </Block>

        <Block title="3. Le clic vers un marchand (cookies d'affiliation)">
          <p style={{ ...p, margin: 0 }}>
            Quand tu cliques « Voir l&apos;offre », tu <strong>quittes feedplug.com</strong> : tu es redirigé vers le
            site du marchand via notre partenaire d&apos;affiliation (<strong>AWIN</strong>). C&apos;est à ce moment-là,{" "}
            <strong>sur le site du marchand et le domaine d&apos;AWIN</strong> (pas sur feedplug.com), que des cookies
            d&apos;affiliation peuvent être déposés : ils permettent d&apos;attribuer la vente à Feedplug et de nous
            verser une commission, sans surcoût pour toi. Ces cookies relèvent des politiques du marchand et
            d&apos;AWIN, que leurs bannières de consentement encadrent. Notre modèle est détaillé sur la page{" "}
            <Link href="/transparence" style={a}>transparence</Link>.
          </p>
        </Block>

        <Block title="4. Changer ton choix">
          <p style={p}>
            Tu peux changer d&apos;avis à tout moment. Le bouton ci-dessous efface ton choix mémorisé et recharge la
            page : la bannière réapparaît et tu choisis à nouveau.
          </p>
          <CookieChoiceReset />
          <p style={{ ...p, margin: "12px 0 0", fontSize: "14px", color: "var(--ink-3)" }}>
            Tu peux aussi supprimer les cookies depuis les réglages de ton navigateur. Pour tout le reste (données de
            compte, droits RGPD), voir la{" "}
            <Link href="/confidentialite" style={a}>politique de confidentialité</Link>.
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

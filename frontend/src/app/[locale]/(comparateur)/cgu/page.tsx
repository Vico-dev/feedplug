import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation | Feedplug",
  description:
    "Les règles d'utilisation du comparateur de prix Feedplug : service d'information gratuit, prix fournis par les marchands, critères de classement, compte utilisateur et responsabilité.",
  alternates: {
    canonical: `${seo.siteUrl}/cgu`,
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

export default function CguPage() {
  const updated = new Date(LAST_UPDATED_ISO).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "56px var(--page-padding-x) 80px" }}>
      <div style={eyebrow}><span style={dot} /> Conditions d&apos;utilisation</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 5vw, 52px)", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.0, color: "var(--ink)", margin: "18px 0 0", maxWidth: "620px" }}>
        Les règles du jeu,{" "}
        <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)" }}>en clair.</em>
      </h1>
      <p style={{ margin: "16px 0 0", fontSize: "18px", lineHeight: 1.55, color: "var(--ink-2)", maxWidth: "580px" }}>
        Ces conditions encadrent l&apos;utilisation du <strong>comparateur Feedplug</strong> (feedplug.com), un service
        d&apos;information sur les prix, gratuit et sans engagement. En utilisant le site, tu les acceptes.
      </p>
      <p style={{ margin: "12px 0 0", fontSize: "13px", color: "var(--ink-3)" }}>Dernière mise à jour : {updated}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "36px" }}>
        <Block title="1. Le service">
          <p style={{ ...p, margin: 0 }}>
            Feedplug est un <strong>comparateur de prix</strong> : il agrège des offres de marchands partenaires et
            t&apos;aide à repérer le meilleur prix et les baisses de prix. Le service est fourni{" "}
            <strong>« en l&apos;état »</strong>, à titre purement informatif. Feedplug n&apos;est ni un vendeur ni une
            place de marché : <strong>aucun contrat de vente n&apos;est conclu sur le site</strong>. L&apos;achat se fait
            toujours chez le marchand, selon ses propres conditions de vente.
          </p>
        </Block>

        <Block title="2. Les prix affichés">
          <p style={{ ...p, margin: 0 }}>
            Les prix, stocks et descriptions sont <strong>fournis par les marchands</strong> via leurs flux
            d&apos;affiliation et rafraîchis régulièrement. Malgré nos efforts, un <strong>écart est possible</strong>{" "}
            entre le prix affiché ici et le prix réel au moment de l&apos;achat (délai de mise à jour, promotion
            expirée, frais de livraison). <strong>Vérifie toujours le prix final chez le marchand</strong> avant
            d&apos;acheter : c&apos;est lui seul qui fait foi.
          </p>
        </Block>

        <Block title="3. Classement des offres et référencement (décret n°2016-505)">
          <p style={p}>
            En tant que comparateur, on te doit la transparence sur nos critères :
          </p>
          <p style={p}>
            → <strong>Critères de classement</strong> : les offres sont classées <strong>par prix</strong> (du moins
            cher au plus cher) ou <strong>par pertinence</strong> (adéquation avec ta recherche). <strong>Aucun
            classement n&apos;est payé</strong> : un marchand ne peut pas acheter sa position.
          </p>
          <p style={p}>
            → <strong>Caractère non exhaustif</strong> : le catalogue couvre les <strong>marchands partenaires</strong>{" "}
            avec lesquels nous sommes liés par un programme d&apos;affiliation. Il ne référence donc pas la totalité
            des offres du marché.
          </p>
          <p style={{ ...p, margin: 0 }}>
            → <strong>Rémunération</strong> : nous percevons une <strong>commission d&apos;affiliation</strong> quand un
            achat suit un clic depuis Feedplug, <strong>sans surcoût pour toi</strong>. Détails sur la page{" "}
            <Link href="/transparence" style={a}>transparence</Link>.
          </p>
        </Block>

        <Block title="4. Compte utilisateur">
          <p style={{ ...p, margin: 0 }}>
            La création d&apos;un compte est facultative et se fait par <strong>lien magique</strong> envoyé par e-mail
            (pas de mot de passe). Tu t&apos;engages à utiliser une adresse e-mail valide qui t&apos;appartient. Tu peux{" "}
            <strong>supprimer ton compte à tout moment, en un clic</strong>, depuis{" "}
            <Link href="/compte/profil" style={a}>Mon profil</Link> — voir la{" "}
            <Link href="/confidentialite" style={a}>politique de confidentialité</Link> pour le sort de tes données.
          </p>
        </Block>

        <Block title="5. Watchlist et alertes de prix">
          <p style={{ ...p, margin: 0 }}>
            La watchlist et les alertes de baisse de prix sont fournies <strong>à titre informatif</strong>, sans
            garantie d&apos;exhaustivité ni de délai : une baisse peut être détectée avec retard, ou un e-mail
            d&apos;alerte ne pas aboutir. Elles ne constituent ni une réservation, ni une garantie de prix ou de
            disponibilité chez le marchand.
          </p>
        </Block>

        <Block title="6. Utilisation du site">
          <p style={{ ...p, margin: 0 }}>
            Tu t&apos;engages à un usage normal et personnel du service : pas d&apos;extraction massive de données
            (scraping), pas de tentative de contournement des mesures de sécurité, pas d&apos;usage frauduleux des
            liens d&apos;affiliation. Nous pouvons suspendre un compte en cas d&apos;abus manifeste.
          </p>
        </Block>

        <Block title="7. Responsabilité">
          <p style={{ ...p, margin: 0 }}>
            Feedplug fait ses meilleurs efforts pour fournir une information fiable et un service disponible, mais ne
            garantit ni l&apos;exactitude permanente des prix, ni l&apos;absence d&apos;interruption. Dans les limites
            permises par la loi, notre <strong>responsabilité est limitée</strong> aux dommages directs prouvés ; nous
            ne sommes pas responsables des transactions conclues avec les marchands, de leurs livraisons, garanties ou
            services après-vente.
          </p>
        </Block>

        <Block title="8. Droit applicable">
          <p style={{ ...p, margin: 0 }}>
            Ces conditions sont soumises au <strong>droit français</strong>. En cas de litige, une solution amiable
            sera recherchée en priorité (écris-nous à{" "}
            <a href="mailto:victor@agence-inconnu.fr" style={a}>victor@agence-inconnu.fr</a>) ; à défaut, les
            tribunaux français seront compétents. En tant que consommateur, tu conserves l&apos;ensemble des droits
            que la loi t&apos;accorde.
          </p>
        </Block>

        <Block title="9. Documents liés">
          <p style={{ ...p, margin: 0 }}>
            Ces CGU se lisent avec la{" "}
            <Link href="/confidentialite" style={a}>politique de confidentialité</Link>, la page{" "}
            <Link href="/transparence" style={a}>transparence</Link> (notre modèle économique) et la{" "}
            <Link href="/cookies" style={a}>politique cookies</Link>. Elles peuvent évoluer ; la version en ligne fait
            foi.
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

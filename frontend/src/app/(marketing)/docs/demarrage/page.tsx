"use client";

import Link from "next/link";
import { CheckCircle, FileInput, Package, BarChart3, Sparkles, Share2 } from "lucide-react";

const steps = [
  {
    num: 1,
    title: "Créer un compte et se connecter",
    icon: CheckCircle,
    body: "Inscrivez-vous sur FeedPlug avec votre email ou via Google. Après connexion, vous accédez au tableau de bord. En cas d'oubli de mot de passe, utilisez le lien « Mot de passe oublié » pour recevoir un lien de réinitialisation par email.",
  },
  {
    num: 2,
    title: "Ajouter une source",
    icon: FileInput,
    body: "Dans la section Sources, connectez votre première source : soit Shopify (connexion sécurisée en un clic), soit un fichier d'export (URL ou glisser-déposer d'un CSV/tableur). FeedPlug détecte les colonnes et propose un mapping vers les champs produit. Validez la configuration pour que la source soit enregistrée.",
    doc: "/docs/sources",
  },
  {
    num: 3,
    title: "Lancer une synchronisation",
    icon: Package,
    body: "Déclenchez une synchronisation depuis la source. Les produits sont importés dans FeedPlug et apparaissent dans le Catalogue. Vous pouvez planifier des synchros régulières (ex. quotidiennes) pour garder le catalogue à jour avec votre boutique ou votre fichier.",
  },
  {
    num: 4,
    title: "Consulter le catalogue et le score",
    icon: BarChart3,
    body: "Ouvrez le Catalogue pour voir l'ensemble de vos fiches. Chaque produit dispose d'un score FeedPlug (0–100) et de recommandations. Utilisez les filtres (par source, par score) pour identifier les fiches à améliorer en priorité.",
    doc: "/docs/catalogue",
  },
  {
    num: 5,
    title: "(Optionnel) Lancer l'enrichissement IA",
    icon: Sparkles,
    body: "Si vous souhaitez optimiser titres et descriptions automatiquement, allez dans Enrichissement IA. Choisissez le mode (optimiser tout le catalogue ou test A/B) et l'univers (mode, beauté, tech, food, home). Les propositions sont prévisualisables avant enregistrement. Les fiches déjà bien notées peuvent être exclues pour maîtriser les coûts.",
    doc: "/docs/enrichissement",
  },
  {
    num: 6,
    title: "Créer un flux et exporter",
    icon: Share2,
    body: "Créez un flux d'export (ex. pour Google Merchant Center). Renseignez l'URL de téléchargement fournie par FeedPlug dans votre compte Google Merchant Center, ou téléchargez le fichier pour vos autres canaux. Les mises à jour du catalogue sont reflétées dans le flux à chaque nouvelle synchro ou export.",
    doc: "/docs/export",
  },
];

export default function DocsDemarragePage() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <CheckCircle size={28} style={{ color: "#16a34a" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
          Démarrer avec FeedPlug
        </h1>
      </div>

      <p style={{ color: "#6b7280", fontSize: "1.05rem", marginBottom: 32, lineHeight: 1.6 }}>
        Ce guide vous accompagne étape par étape pour être opérationnel en quelques minutes : de la création du compte à l&apos;export de votre premier flux vers Google Shopping.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 20 }}>Parcours en 6 étapes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {steps.map(({ num, title, icon: Icon, body, doc }) => (
            <div
              key={num}
              style={{
                padding: 20,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                backgroundColor: "#fafafa",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#0a0a0a",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {num}
                </span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={20} style={{ color: "#0a0a0a" }} /> {title}
                  </h3>
                  <p style={{ margin: 0, color: "#4a4a4a", fontSize: 15, lineHeight: 1.6 }}>{body}</p>
                  {doc && (
                    <p style={{ marginTop: 12, fontSize: 14 }}>
                      <Link href={doc} style={{ color: "#0a0a0a", textDecoration: "underline" }}>
                        En savoir plus →
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p style={{ marginBottom: 32, color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
        Lors de votre première connexion, un parcours guidé dans l&apos;application peut également vous accompagner pour connecter une source, lancer une synchro et découvrir l&apos;optimisation IA et les exports.
      </p>

      <p style={{ fontSize: 14, color: "#6b7280" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>← Retour à la documentation</Link>
      </p>
    </>
  );
}

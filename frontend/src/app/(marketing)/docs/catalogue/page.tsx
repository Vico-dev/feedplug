"use client";

import Link from "next/link";
import { Package, Filter, BarChart3, List } from "lucide-react";

export default function DocsCataloguePage() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Package size={28} style={{ color: "#0a0a0a" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
          Catalogue
        </h1>
      </div>

      <p style={{ color: "#6b7280", fontSize: "1.05rem", marginBottom: 32, lineHeight: 1.6 }}>
        Le catalogue FeedPlug est la vue unifiée de tous vos produits, issus d&apos;une ou plusieurs sources. Vous y consultez les fiches, les scores, les recommandations et vous priorisez les optimisations avant export vers Google Shopping ou vos autres canaux.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <List size={20} /> À quoi sert le catalogue
        </h2>
        <p style={{ margin: "0 0 12px", color: "#4a4a4a", fontSize: 15, lineHeight: 1.6 }}>
          Après avoir connecté une <Link href="/docs/sources" style={{ color: "#0a0a0a", textDecoration: "underline" }}>source</Link> (Shopify ou fichier) et lancé une synchronisation, vos produits apparaissent dans le catalogue. C&apos;est la base commune à partir de laquelle vous :
        </p>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "#4a4a4a", fontSize: 15, lineHeight: 1.7 }}>
          <li>Voyez l&apos;ensemble de vos fiches en un seul endroit, même si vous avez plusieurs sources ou flux.</li>
          <li>Consultez le <Link href="/docs/score" style={{ color: "#0a0a0a", textDecoration: "underline" }}>score FeedPlug</Link> (0–100) et le détail par dimension (conformité, qualité, SEO, conversion) pour chaque produit.</li>
          <li>Lisez les recommandations actionnables pour savoir quoi corriger (titre trop long, image manquante, etc.).</li>
          <li>Priorisez les fiches à améliorer avant de lancer l&apos;<Link href="/docs/enrichissement" style={{ color: "#0a0a0a", textDecoration: "underline" }}>enrichissement IA</Link> ou d&apos;exporter vers <Link href="/docs/export" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Google Merchant Center</Link>.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={20} /> Filtres et recherche
        </h2>
        <p style={{ margin: "0 0 12px", color: "#4a4a4a", fontSize: 15, lineHeight: 1.6 }}>
          Pour cibler rapidement les produits à traiter :
        </p>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "#4a4a4a", fontSize: 15, lineHeight: 1.7 }}>
          <li><strong>Par source</strong> — Affichez uniquement les produits d&apos;une source donnée (ex. votre boutique Shopify ou un flux importé).</li>
          <li><strong>Par score</strong> — Filtrez par plage de score global (ex. &lt; 50, 50–75, &gt; 75) pour identifier les fiches sous-optimisées ou déjà en bon état.</li>
          <li><strong>Recherche</strong> — Trouvez un produit par titre, référence (SKU, ID) ou autre champ selon les options disponibles dans l&apos;interface.</li>
        </ul>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
          Combinez les filtres pour travailler par segment (ex. « Tous les produits de la source X avec un score &lt; 70 ») avant d&apos;optimiser ou d&apos;exporter.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={20} /> Détail d&apos;une fiche produit
        </h2>
        <p style={{ margin: "0 0 12px", color: "#4a4a4a", fontSize: 15, lineHeight: 1.6 }}>
          En ouvrant un produit depuis le catalogue, vous accédez à :
        </p>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "#4a4a4a", fontSize: 15, lineHeight: 1.7 }}>
          <li>Les informations de la fiche : titre, description, image(s), prix, disponibilité, identifiants (marque, GTIN, MPN), etc.</li>
          <li>Le score global et le détail des 4 dimensions (conformité, qualité des données, SEO, conversion) avec les points obtenus.</li>
          <li>Les recommandations générées à partir du score : actions concrètes pour améliorer la fiche (ex. « Réduire le titre à 50–60 caractères », « Renseigner la marque »).</li>
        </ul>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
          Les corrections se font soit à la source (Shopify, fichier ré-importé), soit via l&apos;enrichissement IA FeedPlug qui peut proposer des titres et descriptions optimisés. Après une nouvelle synchro, le catalogue et les scores se mettent à jour.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Catalogue et flux d&apos;export</h2>
        <p style={{ margin: 0, color: "#4a4a4a", fontSize: 15, lineHeight: 1.6 }}>
          Le catalogue est la base de données produits utilisée pour générer vos <Link href="/docs/export" style={{ color: "#0a0a0a", textDecoration: "underline" }}>flux d&apos;export</Link>. Vous pouvez créer plusieurs flux (un par canal, par pays ou par segment) à partir du même catalogue. Seuls les produits présents dans le catalogue et conformes aux règles du flux sont inclus dans l&apos;export envoyé vers Google Merchant Center ou téléchargé.
        </p>
      </section>

      <p style={{ fontSize: 14, color: "#6b7280" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>← Retour à la documentation</Link>
      </p>
    </>
  );
}

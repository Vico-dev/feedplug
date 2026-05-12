"use client";

import Link from "next/link";
import { BarChart3, CheckCircle, Target, TrendingUp, AlertTriangle } from "lucide-react";

export default function DocsScorePage() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <BarChart3 size={28} style={{ color: "#0a0a0a" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
          Score FeedPlug
        </h1>
      </div>

      <p style={{ color: "var(--ink-3)", fontSize: "1.05rem", marginBottom: 32, lineHeight: 1.6 }}>
        Un score de 0 à 100 pour chaque fiche produit, avec le détail des critères et des recommandations actionnables. Vous savez exactement où agir pour améliorer la visibilité et les performances sur Google Shopping et les autres canaux.
        <br />
        <Link href="/optimiser-flux-google-shopping" style={{ color: "#0a0a0a", textDecoration: "underline", fontWeight: 500 }}>→ Guide : optimiser son flux pour Google Shopping</Link>
        <br />
        <Link href="/corriger-erreurs-google-merchant-center" style={{ color: "#0a0a0a", textDecoration: "underline", fontWeight: 500 }}>→ Guide : corriger ses erreurs Google Merchant Center</Link>
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={20} /> En quoi le score est pertinent pour vous
        </h2>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li><strong>Prioriser les fiches à améliorer</strong> — Identifiez en un coup d&apos;œil les produits sous-optimisés (score bas) et concentrez vos efforts sur ce qui a le plus d&apos;impact.</li>
          <li><strong>Réduire les rejets par Google</strong> — La dimension Conformité reflète les exigences Google Merchant Center. Un score de conformité trop faible peut entraîner le rejet de vos annonces ; le score vous alerte avant envoi.</li>
          <li><strong>Mieux ranker et convertir</strong> — Titre, description, images et attributs influencent le positionnement et le taux de clic. Un bon score qualité et SEO favorise la visibilité ; un bon score conversion aide à transformer les clics en ventes.</li>
          <li><strong>Suivre la progression</strong> — Le score moyen de votre catalogue et son évolution (dashboard) vous permettent de mesurer les effets de vos optimisations et de l&apos;enrichissement IA.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={20} /> Comment le score est calculé
        </h2>
        <p style={{ margin: "0 0 16px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Le score global (0–100) est une <strong>moyenne pondérée de 4 dimensions</strong>, chacune notée de 0 à 100. Formule :
        </p>
        <p style={{ margin: "0 0 24px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          <code style={{ background: "var(--paper-2)", padding: "8px 12px", borderRadius: 6, display: "inline-block" }}>
            Score global = Conformité×30% + Qualité des données×30% + SEO×25% + Conversion×15%
          </code>
        </p>
        <p style={{ margin: "0 0 24px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Chaque dimension est elle-même notée sur 100 points selon des critères précis. Voici la <strong>méthode de calcul détaillée</strong> appliquée par FeedPlug.
        </p>

        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12, marginTop: 24 }}>1. Conformité (0–100) — 30 % du score global</h3>
        <p style={{ margin: "0 0 8px", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
          Cette dimension vérifie que la fiche respecte les exigences Google Merchant Center. Un produit peut être <strong>rejeté par Google</strong> si des champs obligatoires manquent ou sont invalides.
        </p>
        <ul style={{ margin: "0 0 8px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
          <li><strong>Champs obligatoires (70 points)</strong> : ID (5 pts), Titre (15 pts : présence 5, longueur 1–150 car. 3, pas de caractères interdits 2, pas de contenu promo 5), Description (12 pts : présence 4, longueur 1–5000 3, HTML raisonnable 3, pas de liens externes 2), Image (12 pts : présence 4, URL HTTPS 3, format JPG/PNG/WebP/GIF 3, accessible 2), Prix (10 pts : présence 4, nombre positif 3, devise 3), Disponibilité (8 pts : valeur in stock / out of stock / preorder / backorder), Condition (6 pts : new / refurbished / used), Lien produit (2 pts).</li>
          <li><strong>Champs recommandés (30 points)</strong> : Marque (8 pts), GTIN 13 ou 14 chiffres (10 pts, ou 5 si format invalide), MPN (5 pts), Google Product Category (7 pts si catégorie précise, 4 si générale).</li>
        </ul>
        <p style={{ margin: "0 0 0 8px", color: "var(--ink-3)", fontSize: 13 }}>Conformité &lt; 70 = risque de rejet par Google.</p>

        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12, marginTop: 24 }}>2. Qualité des données (0–100) — 30 % du score global</h3>
        <p style={{ margin: "0 0 8px", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
          Évalue la richesse et la structure des informations (titre, description, image, prix, identifiants).
        </p>
        <ul style={{ margin: "0 0 8px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
          <li><strong>Titre (25 pts)</strong> : Longueur optimale 50–60 car. (8 pts), 40–70 (6), 30–80 (4), autre (2). Structure [Marque] [Modèle] [Attributs] (7 pts). Mots-clés pertinents (5 pts). Lisibilité : pas de majuscules excessives, pas de répétitions, séparateurs corrects (5 pts).</li>
          <li><strong>Description (25 pts)</strong> : Longueur optimale 500–1000 car. (10 pts), 300–1500 (7), 100–2000 (5). Contenu riche : caractéristiques, bénéfices, infos techniques (8 pts). Structure : paragraphes, listes (4 pts). Mots-clés cohérents avec le titre (3 pts).</li>
          <li><strong>Image (25 pts)</strong> : Résolution (12 pts), ratio d&apos;aspect (5 pts), format et taille (5 pts), conformité visuelle (3 pts).</li>
          <li><strong>Prix (10 pts)</strong>, <strong>Disponibilité (5 pts)</strong> — en stock mieux noté que rupture. <strong>Identifiants (10 pts)</strong> : GTIN (5), MPN (3), Marque (2).</li>
        </ul>

        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12, marginTop: 24 }}>3. SEO (0–100) — 25 % du score global</h3>
        <p style={{ margin: "0 0 8px", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
          Potentiel de référencement et de visibilité sur les canaux.
        </p>
        <ul style={{ margin: "0 0 8px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
          <li><strong>Titre (30 pts)</strong> : Mots-clés primaires (10), secondaires / variations (8), longue traîne / titre suffisamment long (7), unicité (5).</li>
          <li><strong>Description (25 pts)</strong> : Mots-clés du titre présents dans la description (10), structure sémantique et marque (8), potentiel rich snippets (7).</li>
          <li><strong>Catégorisation (20 pts)</strong> : Google Product Category précise (12) ou générale (5), Product Type (5).</li>
          <li><strong>Attributs enrichis (25 pts)</strong> : Couleur, taille, matériau, genre, âge, pattern, etc. (15), Item Group ID pour les variantes (5), infos livraison (5).</li>
        </ul>

        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12, marginTop: 24 }}>4. Conversion (0–100) — 15 % du score global</h3>
        <p style={{ margin: "0 0 8px", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
          Potentiel de vente : attractivité visuelle, clarté des infos, confiance, prix et promos.
        </p>
        <ul style={{ margin: "0 0 8px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
          <li><strong>Visuel (30 pts)</strong> : Qualité d&apos;image (15), nombre d&apos;images (10 — plusieurs images mieux notées), vidéo (5 si présente).</li>
          <li><strong>Informations produit (25 pts)</strong> : Description complète (10), spécifications techniques (8), infos pratiques (garantie, livraison, retour) (7).</li>
          <li><strong>Confiance (25 pts)</strong> : Avis, certifications, garantie, politique de retour.</li>
          <li><strong>Prix et promotion (20 pts)</strong> : Prix compétitif (10), prix promo / réduction (10).</li>
        </ul>

        <p style={{ margin: "24px 0 0", color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
          Chaque dimension est ramenée à un entier entre 0 et 100, puis le score global est arrondi. Les recommandations affichées dans FeedPlug sont dérivées des critères non ou partiellement remplis pour vous indiquer exactement quoi corriger.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={20} /> Ce que vous voyez dans FeedPlug
        </h2>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li><strong>Score global 0–100</strong> — Affiché sur chaque fiche et dans le catalogue (filtres par plage de score). Un score &lt; 70 indique une priorité d&apos;amélioration ; au-dessus de 80, la fiche est en bon état.</li>
          <li><strong>Détail par dimension</strong> — Pour chaque produit vous pouvez consulter le détail Conformité, Qualité, SEO et Conversion, afin de savoir précisément quoi corriger (titre trop long, image manquante, attributs absents, etc.).</li>
          <li><strong>Recommandations actionnables</strong> — Des recommandations concrètes sont générées à partir des scores (ex. « Réduire le titre à 50–60 caractères », « Ajouter une image 800×800 px minimum », « Renseigner la marque »). Vous pouvez les suivre à la main ou déclencher l&apos;enrichissement IA pour les champs concernés.</li>
          <li><strong>Dashboard</strong> — Le score moyen du catalogue et son évolution dans le temps vous aident à piloter la qualité globale et à mesurer l&apos;impact de vos actions.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp size={20} /> Bonnes pratiques
        </h2>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li>Traitez en priorité les fiches avec un <strong>score de conformité &lt; 70</strong> pour éviter les rejets par Google.</li>
          <li>Utilisez les <strong>filtres par score</strong> dans le catalogue pour cibler les produits à optimiser (ex. score global &lt; 50 ou 50–75).</li>
          <li>Combine le score avec l&apos;<Link href="/docs/enrichissement" style={{ color: "#0a0a0a", textDecoration: "underline" }}>enrichissement IA</Link> : FeedPlug peut proposer des améliorations automatiques pour les titres, descriptions et champs manquants, en particulier sur les fiches à faible score.</li>
          <li>Consultez régulièrement le <Link href="/docs/dashboard" style={{ color: "#0a0a0a", textDecoration: "underline" }}>dashboard</Link> pour suivre l&apos;évolution du score moyen et la distribution des scores dans votre catalogue.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32, padding: 16, background: "var(--warning-bg)", borderRadius: 8 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8, color: "var(--warning)" }}>
          <AlertTriangle size={18} /> En résumé
        </h3>
        <p style={{ margin: 0, color: "var(--warning)", fontSize: 14, lineHeight: 1.6 }}>
          Le score FeedPlug vous donne une mesure objective de la qualité et de la conformité de vos fiches. Il vous aide à prioriser les corrections, à éviter les rejets sur les canaux et à améliorer visibilité et conversion. Utilisez-le en complément de l&apos;IA pour optimiser votre catalogue de façon ciblée.
        </p>
      </section>

      <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>← Retour à la documentation</Link>
      </p>
    </>
  );
}

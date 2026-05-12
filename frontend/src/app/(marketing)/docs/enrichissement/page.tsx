"use client";

import Link from "next/link";
import { Sparkles, FileEdit, Coins, Zap } from "lucide-react";

export default function DocsEnrichissementPage() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Sparkles size={28} style={{ color: "#0a0a0a" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
          Enrichissement IA
        </h1>
      </div>

      <p style={{ color: "var(--ink-3)", fontSize: "1.05rem", marginBottom: 32, lineHeight: 1.6 }}>
        L&apos;IA FeedPlug améliore vos fiches produits pour mieux convertir sur Google Shopping et les autres canaux. Cette page décrit les champs modifiés, les modes d&apos;optimisation, la gestion des coûts et les limites d&apos;usage.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <FileEdit size={20} /> Titres, descriptions et visuels
        </h2>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li><strong>Titres</strong> — Reformulés pour être plus vendeurs, conformes aux bonnes pratiques (longueur, mots-clés, structure) et adaptés à l&apos;univers choisi (mode, beauté, tech, food, home).</li>
          <li><strong>Descriptions</strong> — Enrichies ou réécrites en gardant le ton de votre marque et les informations essentielles. L&apos;IA peut étendre une description trop courte ou restructurer le contenu.</li>
          <li><strong>Visuels</strong> — Conseils et optimisation des métadonnées liées aux images (alt, libellés). Les images elles-mêmes ne sont pas modifiées ; les champs texte associés peuvent être améliorés si l&apos;option est proposée.</li>
        </ul>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
          <strong>Champs modifiés et enregistrement</strong> — Les champs optimisés par l&apos;IA (titre, description, etc.) sont enregistrés dans le catalogue FeedPlug et utilisés pour les exports. Les valeurs d&apos;origine sont remplacées. Pour revenir en arrière, vous devez soit modifier manuellement la fiche, soit relancer une synchro depuis la source si les données n&apos;ont pas été modifiées côté Shopify ou fichier.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Cinq univers et tests A/B</h2>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Cinq univers sont disponibles : <strong>mode, beauté, tech, food, home</strong>. Chaque univers adapte le style et les formulations aux attentes du secteur. Vous pouvez :
        </p>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li><strong>Optimiser tout le catalogue</strong> — En un clic, l&apos;IA traite l&apos;ensemble des produits (ou ceux qui correspondent aux filtres). Les propositions sont prévisualisables avant/après ; vous validez pour enregistrer.</li>
          <li><strong>Lancer un test A/B</strong> — Traitez un échantillon ou un segment (par marque, catégorie, gamme de prix) pour comparer les performances avant de généraliser.</li>
        </ul>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14 }}>
          Les produits déjà optimisés peuvent être exclus du traitement pour éviter de retraiter inutilement et maîtriser les coûts. Vous pouvez aussi cibler en priorité les fiches avec un <Link href="/docs/score" style={{ color: "#0a0a0a", textDecoration: "underline" }}>score</Link> faible.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Coins size={20} /> Coût et facturation
        </h2>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          L&apos;utilisation de l&apos;enrichissement IA est facturée selon votre offre FeedPlug : par nombre de champs optimisés (ex. titre + description = 2 champs par produit) ou dans le cadre d&apos;un forfait. La consommation est visible dans votre <Link href="/docs/compte" style={{ color: "#0a0a0a", textDecoration: "underline" }}>compte</Link> (section facturation ou utilisation). Un coût estimé peut être affiché avant de lancer une optimisation sur tout le catalogue ou un segment. Pour limiter les coûts, nous recommandons de cibler les produits à faible score ou les fiches incomplètes, et d&apos;exclure les produits déjà optimisés.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={20} /> Limites et bonnes pratiques
        </h2>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li><strong>Volume</strong> — Le nombre de produits traitables par optimisation ou par test A/B peut être limité selon votre plan. En cas de catalogue très volumineux, lancez des optimisations par segment (ex. par source ou par plage de score).</li>
          <li><strong>Délai</strong> — Le traitement peut prendre quelques minutes selon le volume. Vous pouvez suivre l&apos;avancement dans l&apos;interface ; un email peut vous notifier à la fin du traitement.</li>
          <li><strong>Qualité</strong> — Prévisualisez toujours les propositions avant de les enregistrer. En cas de résultat insatisfaisant sur un produit, vous pouvez corriger manuellement ou ne pas valider la proposition pour ce produit.</li>
        </ul>
      </section>

      <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>← Retour à la documentation</Link>
      </p>
    </>
  );
}

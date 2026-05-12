"use client";

import Link from "next/link";
import { Share2, ExternalLink, Download, RefreshCw, Store } from "lucide-react";

export default function DocsExportPage() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Share2 size={28} style={{ color: "#0a0a0a" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
          Export et flux
        </h1>
      </div>

      <p style={{ color: "var(--ink-3)", fontSize: "1.05rem", marginBottom: 32, lineHeight: 1.6 }}>
        FeedPlug génère des flux conformes aux exigences de chaque canal pour alimenter vos annonces et campagnes. Ce guide décrit comment connecter Google Merchant Center, les formats utilisés et la fréquence des mises à jour.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <ExternalLink size={20} /> Google Merchant Center / Google Shopping
        </h2>
        <p style={{ margin: "0 0 16px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Pour envoyer votre catalogue à Google et alimenter vos annonces Shopping :
        </p>
        <ol style={{ margin: "0 0 16px", paddingLeft: 24, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.8 }}>
          <li>Dans FeedPlug, créez un flux d&apos;export et choisissez la destination « Google Merchant Center » (ou équivalent selon l&apos;interface).</li>
          <li>FeedPlug vous fournit une <strong>URL de flux</strong> (lien de téléchargement de votre fichier produit à jour). Copiez cette URL.</li>
          <li>Connectez-vous à <strong>Google Merchant Center</strong>, allez dans Produits → Flux, puis ajoutez un flux ou modifiez un flux existant.</li>
          <li>Choisissez « Import par URL » et collez l&apos;URL du flux FeedPlug. Enregistrez et lancez la récupération.</li>
          <li>Google récupère le fichier à l&apos;URL indiquée. Selon votre configuration GMC, la fréquence peut être définie (ex. quotidienne). Côté FeedPlug, assurez-vous d&apos;avoir lancé une synchro et une génération d&apos;export à jour avant que Google ne re-télécharge le flux.</li>
        </ol>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
          Si des produits sont rejetés par Google, consultez les diagnostics dans GMC et le <Link href="/docs/score" style={{ color: "#0a0a0a", textDecoration: "underline" }}>score FeedPlug</Link> (dimension Conformité) pour corriger les champs manquants ou invalides.
        </p>
        <p style={{ margin: "12px 0 0", color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
          Pour un cas Shopify specifique, consultez aussi le guide <Link href="/optimiser-flux-google-shopping-shopify" style={{ color: "#0a0a0a", textDecoration: "underline" }}>optimiser son flux Google Shopping depuis Shopify</Link>.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Download size={20} /> Format des flux
        </h2>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Les flux destinés à <strong>Google Merchant Center</strong> sont générés au format attendu par Google (structure XML type feed produit Merchant Center), avec les attributs requis et recommandés : <strong>id</strong>, <strong>title</strong>, <strong>description</strong>, <strong>link</strong>, <strong>image_link</strong>, <strong>price</strong>, <strong>availability</strong>, <strong>condition</strong>, etc. La conformité de votre feed XML avec les spécifications Google limite les rejets et améliore l&apos;éligibilité de vos annonces Shopping. Les champs optionnels (brand, gtin, mpn, google_product_category, etc.) sont inclus lorsqu&apos;ils sont renseignés dans votre catalogue.
        </p>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Pour les <strong>téléchargements manuels</strong> (autres canaux), FeedPlug peut proposer un export en CSV ou autre format selon les options disponibles. Le contenu reflète votre catalogue à la date de génération.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Store size={20} /> Export vers les marketplaces
        </h2>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          FeedPlug permet d&apos;exporter votre <strong>catalogue multi-canal</strong> vers les marketplaces (Amazon, Cdiscount, Mirakl, Fnac, Rakuten, etc.) en plus de Google Shopping et Meta. Un même catalogue alimente tous vos canaux : vous centralisez vos données produits une fois, et chaque <strong>flux marketplace</strong> reçoit le format et les attributs attendus par la plateforme (feed Amazon, export Cdiscount, flux Mirakl, etc.).
        </p>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Les exports vers les marketplaces sont configurés depuis l&apos;interface FeedPlug : choisissez le canal (Amazon, Cdiscount, Fnac…), le flux est généré selon les exigences du canal (EAN, catégorie, référence, descriptifs). Les mises à jour du catalogue (synchros, enrichissement IA) se répercutent automatiquement sur tous les flux, y compris marketplace. Pour les canaux en cours de déploiement, consultez la <Link href="/docs/roadmap" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Roadmap</Link>.
        </p>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
          Pour un cas Shopify specifique, consultez aussi le guide <Link href="/feed-produit-amazon-shopify" style={{ color: "#0a0a0a", textDecoration: "underline" }}>exporter son catalogue Shopify vers Amazon</Link>.
        </p>
        <p style={{ margin: "12px 0 0", color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
          Pour une vue plus large, consultez aussi la page <Link href="/gestion-flux-produits-marketplaces" style={{ color: "#0a0a0a", textDecoration: "underline" }}>gestion des flux produits marketplaces</Link>.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCw size={20} /> Fréquence des mises à jour
        </h2>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Le flux à l&apos;URL fournie par FeedPlug est régénéré lorsque vous lancez une mise à jour d&apos;export (ou une synchro qui déclenche la régénération, selon la configuration). Chaque fois que Google Merchant Center récupère cette URL, il obtient la dernière version du fichier. Nous recommandons de planifier des synchros régulières dans FeedPlug (ex. quotidiennes) et de configurer GMC pour récupérer le flux au moins une fois par jour, afin que vos annonces reflètent les prix, disponibilités et fiches à jour.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Téléchargement pour vos autres canaux</h2>
        <p style={{ margin: "0 0 16px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Vous pouvez télécharger un fichier depuis FeedPlug pour alimenter vos autres canaux : comparateurs, marketplaces, campagnes sur les réseaux sociaux, etc. Le format et les champs disponibles dépendent des options de l&apos;application. Pour Meta, Amazon et les marketplaces, voir la section <strong>Export vers les marketplaces</strong> ci-dessus et la <Link href="/docs/roadmap" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Roadmap</Link> pour les canaux en cours.
        </p>
      </section>

      <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>← Retour à la documentation</Link>
      </p>
    </>
  );
}

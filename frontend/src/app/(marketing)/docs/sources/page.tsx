"use client";

import Link from "next/link";
import { FileInput, FileJson, Map, Clock } from "lucide-react";

export default function DocsSourcesPage() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <FileInput size={28} style={{ color: "#0a0a0a" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
          Sources et import
        </h1>
      </div>

      <p style={{ color: "var(--ink-3)", fontSize: "1.05rem", marginBottom: 32, lineHeight: 1.6 }}>
        FeedPlug centralise vos données produits depuis votre boutique ou vos exports. Une seule plateforme pour tous vos flux. Cette page détaille les types de sources, les formats acceptés, le mapping des colonnes et la fréquence des synchronisations.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Connecter vos sources</h2>
        <p style={{ margin: "0 0 16px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Deux types de sources sont supportés :
        </p>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li><strong>Shopify</strong> — Connexion sécurisée OAuth en un clic. Une fois connectée, votre boutique est une source : les produits sont récupérés via l&apos;API Shopify. Pensez à reconnecter la source si vous désinstallez l&apos;app ou si le token expire.</li>
          <li><strong>Fichiers d&apos;export</strong> — Vous fournissez une URL de fichier (accessible publiquement ou avec les identifiants demandés) ou vous glissez-déposez un fichier. Idéal pour les exports PIM, ERP ou tableurs. Voir « Formats acceptés » ci-dessous.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <FileJson size={20} /> Formats acceptés
        </h2>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Pour l&apos;import par fichier, FeedPlug accepte les formats courants d&apos;export produit :
        </p>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li><strong>CSV</strong> — Encodage UTF-8 recommandé. Séparateur virgule ou point-virgule selon la configuration.</li>
          <li><strong>Tableurs (XLSX)</strong> — Pris en charge lorsque l&apos;option est disponible. La première ligne est utilisée pour identifier les colonnes.</li>
        </ul>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
          La taille maximale du fichier et le nombre de produits par source peuvent être limités selon votre offre ; en cas de dépassement, un message d&apos;erreur s&apos;affiche. Pour les très gros catalogues, privilégiez une URL de fichier régulièrement mise à jour plutôt qu&apos;un unique glisser-déposer.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Map size={20} /> Mapping des colonnes
        </h2>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Lorsque vous importez un fichier, FeedPlug détecte les colonnes et propose une association automatique avec les champs produit (titre, description, image, prix, marque, GTIN, etc.). Plusieurs dizaines de libellés courants sont reconnus (en français et en anglais). Vous pouvez vérifier et modifier le mapping avant de valider : chaque colonne de votre fichier est reliée à un champ FeedPlug. Les colonnes sans correspondance peuvent être ignorées ou mappées vers des champs personnalisés si l&apos;option existe.
        </p>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
          Après la première importation, les mêmes règles de mapping sont réutilisées pour les synchros suivantes (même source, même structure de fichier).
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={20} /> Fréquence des synchronisations
        </h2>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Les synchronisations peuvent être lancées <strong>à la demande</strong> depuis l&apos;interface : vous cliquez sur « Synchroniser » pour la source concernée et le catalogue FeedPlug est mis à jour. Pour garder vos annonces et vos flux à jour sans intervention manuelle, vous pouvez <strong>planifier des synchros</strong> (par exemple une fois par jour). La configuration de la planification se fait dans la section Sources ou Paramètres du flux selon l&apos;interface. Après chaque synchro, les scores et le catalogue sont recalculés ; les flux d&apos;export reflètent alors les dernières données.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Plusieurs flux, une ou plusieurs sources</h2>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Vous pouvez avoir plusieurs sources (ex. une boutique Shopify + un fichier export). Le catalogue FeedPlug agrège les produits de toutes les sources. À partir de ce catalogue, vous créez autant de <Link href="/docs/export" style={{ color: "#0a0a0a", textDecoration: "underline" }}>flux d&apos;export</Link> que nécessaire : un par canal, par pays ou par segment. Les mises à jour du catalogue (synchros) alimentent tous les flux que vous avez configurés.
        </p>
      </section>

      <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>← Retour à la documentation</Link>
      </p>
    </>
  );
}

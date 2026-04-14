"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";

const terms = [
  {
    term: "Availability (disponibilité)",
    def: "Statut d'approvisionnement du produit. Valeurs attendues par Google : « in stock », « out of stock », « preorder », « backorder ». Indispensable pour la conformité Google Merchant Center.",
  },
  {
    term: "Condition (condition)",
    def: "État du produit : « new » (neuf), « refurbished » (reconditionné), « used » (occasion). Champ obligatoire pour GMC.",
  },
  {
    term: "Flux produit (product feed)",
    def: "Fichier (souvent XML ou CSV) contenant la liste de vos produits et leurs attributs, utilisé pour alimenter Google Merchant Center, les comparateurs ou les campagnes. FeedPlug génère des flux conformes aux exigences de chaque canal.",
  },
  {
    term: "Google Merchant Center (GMC)",
    def: "Plateforme Google qui reçoit vos flux produits et les utilise pour les annonces Google Shopping et autres surfaces. Vous y renseignez l'URL du flux fournie par FeedPlug pour que Google récupère vos données.",
  },
  {
    term: "Google Product Category",
    def: "Catégorie hiérarchique du produit dans la nomenclature Google (ex. « Apparel & Accessories > Clothing > Shirts »). Très recommandée pour un bon ciblage et un meilleur score SEO dans FeedPlug.",
  },
  {
    term: "GTIN (Global Trade Item Number)",
    def: "Code-barres international du produit (EAN-13, UPC, etc.). Obligatoire pour de nombreuses catégories sur Google Shopping si le produit en dispose. Format attendu : 13 ou 14 chiffres.",
  },
  {
    term: "MPN (Manufacturer Part Number)",
    def: "Numéro de pièce ou de référence du fabricant. Recommandé par Google ; obligatoire si le produit n'a pas de GTIN.",
  },
  {
    term: "Product Type",
    def: "Classification de votre produit selon votre propre taxonomie (peut être différente de Google Product Category). Utile pour le référencement et le filtrage.",
  },
  {
    term: "Score FeedPlug",
    def: (
      <>
        Note de 0 à 100 calculée pour chaque fiche produit, basée sur quatre dimensions : Conformité (GMC), Qualité des données, SEO et Conversion. Permet de prioriser les améliorations. Voir la page{" "}
        <Link href="/docs/score" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Score FeedPlug</Link>.
      </>
    ),
  },
  {
    term: "Source",
    def: "Origine des données produits dans FeedPlug : une boutique Shopify connectée ou un fichier d'export (CSV, tableur). Une source alimente le catalogue ; vous pouvez créer plusieurs flux d'export à partir du même catalogue.",
  },
  {
    term: "Synchro (synchronisation)",
    def: "Import ou mise à jour des produits depuis une source vers le catalogue FeedPlug. Peut être lancée à la demande ou planifiée (ex. quotidienne) pour garder le catalogue à jour.",
  },
];

export default function DocsGlossairePage() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <BookOpen size={28} style={{ color: "#0a0a0a" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
          Glossaire
        </h1>
      </div>

      <p style={{ color: "#6b7280", fontSize: "1.05rem", marginBottom: 32, lineHeight: 1.6 }}>
        Définitions des termes utilisés dans FeedPlug et dans les exigences Google Shopping / Google Merchant Center. Utile pour les nouveaux utilisateurs et pour comprendre le <Link href="/docs/score" style={{ color: "#0a0a0a", textDecoration: "underline" }}>score</Link> et l&apos;<Link href="/docs/export" style={{ color: "#0a0a0a", textDecoration: "underline" }}>export</Link>.
      </p>

      <section style={{ marginBottom: 32 }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {terms.map(({ term, def }) => (
            <li
              key={term}
              style={{
                padding: "16px 0",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <strong style={{ fontSize: "1rem", color: "#0a0a0a" }}>{term}</strong>
              <p style={{ margin: "8px 0 0", color: "#4a4a4a", fontSize: 15, lineHeight: 1.6 }}>{def}</p>
            </li>
          ))}
        </ul>
      </section>

      <p style={{ fontSize: 14, color: "#6b7280" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>← Retour à la documentation</Link>
      </p>
    </>
  );
}

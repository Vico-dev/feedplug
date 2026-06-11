"use client";

import Link from "next/link";
import { MapPin, Upload, Link2, ShoppingBag, Store, Settings } from "lucide-react";

export default function LocalInventoryAdsDocsPage() {
  return (
    <>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>
        Local Inventory Ads (LIA) avec FeedPlug
      </h1>
      <p style={{ marginBottom: 32, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
        Les <strong>Local Inventory Ads</strong> sont des annonces Google Shopping qui mettent en avant la disponibilité
        d&apos;un produit dans vos magasins physiques. FeedPlug gère la synchronisation entre votre catalogue produit et
        l&apos;inventaire local de chaque point de vente, et génère le flux à connecter dans Google Merchant Center.
      </p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: 16 }}>Prérequis</h2>
        <ul style={{ paddingLeft: 22, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li>
            Un compte <strong>Google Business Profile</strong> avec au moins une fiche d&apos;établissement validée
            (chaque fiche a un <em>store code</em> unique).
          </li>
          <li>
            Un compte <strong>Google Merchant Center</strong> lié à votre compte Google Business Profile (Settings →
            Linked accounts).
          </li>
          <li>
            Un catalogue produit actif dans FeedPlug (sync Shopify, CSV ou autre source).
          </li>
          <li>
            Un plan FeedPlug actif (LIA inclus à partir du plan <strong>Pro</strong>).
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: 16 }}>Configuration en 4 étapes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Step
            num={1}
            icon={MapPin}
            title="Déclarer vos magasins"
            body={
              <>
                Dans <strong>Paramètres → Magasins (LIA)</strong> de votre dashboard FeedPlug (ou{" "}
                <strong>Local Inventory</strong> dans Shopify Admin pour les merchants Shopify), créez une entrée par
                point de vente. Le <em>code magasin</em> doit correspondre exactement au store code défini dans Google
                Business Profile.
              </>
            }
          />
          <Step
            num={2}
            icon={Upload}
            title="Importer l'inventaire par magasin"
            body={
              <>
                Préparez un CSV avec les colonnes <code>storeCode, offerId, quantity, availability, price, salePrice,
                pickupMethod, pickupSla</code>. Le <code>offerId</code> doit matcher l&apos;ID produit du flux principal
                (souvent le SKU Shopify). Téléchargez le modèle CSV depuis l&apos;interface et uploadez votre fichier.
                Un produit peut apparaître dans plusieurs magasins avec des stocks différents.
              </>
            }
          />
          <Step
            num={3}
            icon={Link2}
            title="Copier l'URL du flux LIA"
            body={
              <>
                FeedPlug expose une URL unique par compte (et optionnellement une URL par magasin pour les setups
                multi-comptes GMC). Copiez l&apos;URL globale depuis la section <strong>URL du flux pour Google Merchant
                Center</strong>.
              </>
            }
          />
          <Step
            num={4}
            icon={Settings}
            title="Configurer Google Merchant Center"
            body={
              <>
                Dans Google Merchant Center, allez dans <strong>Marketing → Feeds → Add primary feed</strong>. Choisissez
                <em> Local products inventory feed</em>, sélectionnez <em>Scheduled fetch</em>, collez l&apos;URL FeedPlug
                et configurez la fréquence (quotidien recommandé). Google ingère ensuite l&apos;inventaire et active les
                Local Inventory Ads sur Shopping.
              </>
            }
          />
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: 16 }}>
          Valeurs autorisées
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={tdStyle}>Champ</th>
              <th style={tdStyle}>Valeurs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>
                <code>availability</code>
              </td>
              <td style={tdStyle}>
                <code>in stock</code> · <code>out of stock</code> · <code>limited availability</code> ·{" "}
                <code>on display to order</code>
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>
                <code>pickupMethod</code>
              </td>
              <td style={tdStyle}>
                <code>buy</code> · <code>reserve</code> · <code>ship to store</code> · <code>not supported</code>
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>
                <code>pickupSla</code>
              </td>
              <td style={tdStyle}>
                <code>same day</code> · <code>next day</code> · <code>2-day</code> à <code>7-day</code> ·{" "}
                <code>multi-week</code>
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>
                <code>quantity</code>
              </td>
              <td style={tdStyle}>Entier &ge; 0 (mettre 0 = rupture, ne supprime pas la ligne)</td>
            </tr>
            <tr>
              <td style={tdStyle}>
                <code>price</code> / <code>salePrice</code>
              </td>
              <td style={tdStyle}>
                Décimal (ex : 49.90). Si vide, FeedPlug hérite du prix du flux principal.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: 16 }}>Bonnes pratiques</h2>
        <ul style={{ paddingLeft: 22, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li>
            <strong>Re-importez quotidiennement</strong> votre CSV depuis votre ERP/caisse pour que le stock affiché
            sur Google soit toujours à jour. Vous pouvez automatiser via un cron qui POST sur{" "}
            <code>/api/v1/platforms/lia/inventory</code>.
          </li>
          <li>
            Pour un produit présent dans plusieurs magasins, créez une ligne CSV par magasin (même <code>offerId</code>,
            <code>storeCode</code> différents).
          </li>
          <li>
            <code>quantity = 0</code> + <code>availability = out of stock</code> est préférable à la suppression : Google
            saura que le produit existe localement mais est en rupture, plutôt que de penser qu&apos;il n&apos;existe pas.
          </li>
          <li>
            Activez <code>pickupMethod = buy</code> + <code>pickupSla = same day</code> pour activer le badge &laquo; Retrait
            aujourd&apos;hui &raquo; sur Google Shopping (gros lift de CTR).
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: 16 }}>Dépannage</h2>
        <ul style={{ paddingLeft: 22, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li>
            <strong>« Magasins inconnus »</strong> à l&apos;upload : créez d&apos;abord la fiche magasin avec le même{" "}
            <code>storeCode</code> que dans Google Business Profile.
          </li>
          <li>
            <strong>Google Merchant rejette le flux</strong> : vérifiez que vos <code>offerId</code> matchent exactement
            ceux du flux principal (case-sensitive). FeedPlug propose un audit dans la page{" "}
            <Link href="/docs/score" style={{ color: "#0a0a0a", textDecoration: "underline" }}>
              Score qualité
            </Link>
            .
          </li>
          <li>
            <strong>L&apos;URL du flux est vide</strong> : le compte n&apos;a pas encore de flux actif. Synchronisez
            d&apos;abord votre catalogue depuis la page <Link href="/docs/sources" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Sources</Link>.
          </li>
        </ul>
      </section>

      <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>
          ← Retour à la documentation
        </Link>
      </p>
    </>
  );
}

function Step({
  num,
  icon: Icon,
  title,
  body,
}: {
  num: number;
  icon: typeof MapPin;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 20,
        border: "1px solid var(--line)",
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
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon size={20} style={{ color: "#0a0a0a" }} /> {title}
          </h3>
          <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>{body}</p>
        </div>
      </div>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  borderBottom: "1px solid var(--line)",
  verticalAlign: "top",
};

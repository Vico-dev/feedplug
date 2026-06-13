"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

/**
 * Locale du contexte embedded Shopify Admin.
 *
 * Shopify Admin envoie la locale du merchant via le query param `?locale=`
 * (ex : `fr-FR`, `en-US`, `es-ES`, `de-DE`). On normalise vers nos 3 locales
 * supportées et on fallback EN par défaut, car la majorité des merchants
 * Shopify (App Store mondial) sont anglophones — assumer FR par défaut
 * serait un mauvais signal pour le reviewer BFS et un mauvais accueil pour
 * les merchants US/UK.
 */
export type EmbeddedLocale = "fr" | "en" | "es";

export function pickLocale(rawLocale: string | null): EmbeddedLocale {
  const lower = (rawLocale || "").toLowerCase().split("-")[0];
  if (lower === "fr" || lower === "en" || lower === "es") return lower;
  return "en";
}

export function useEmbeddedLocale(): EmbeddedLocale {
  const searchParams = useSearchParams();
  return pickLocale(searchParams.get("locale"));
}

// ───────────────────────────────────────────────────────────────────────────
// Translations dictionary
// ───────────────────────────────────────────────────────────────────────────
// Convention : namespace.key → string. Pour les pluriels et interpolations,
// on accepte une fonction `(vars) => string`. EN est notre source de vérité
// (la langue dans laquelle on rédige les libellés en premier) ; FR/ES sont
// des traductions ajoutées au fil des écrans.

type Vars = Record<string, string | number>;
type LocaleEntry = string | ((vars: Vars) => string);
type Dict = Record<string, LocaleEntry>;
type Translations = Record<EmbeddedLocale, Dict>;

function tpl(strings: TemplateStringsArray, ...keys: (keyof Vars)[]): (vars: Vars) => string {
  return (vars: Vars) => strings.reduce((acc, s, i) => acc + s + (i < keys.length ? String(vars[keys[i]] ?? "") : ""), "");
}

const translations: Translations = {
  en: {
    // === NavMenu ===
    "nav.home": "Home",
    "nav.billing": "Billing",
    "nav.channels": "Channels",
    "nav.catalog": "Catalog",
    "nav.diagnostic": "Diagnostic",
    "nav.lia": "Local stores (LIA)",
    "nav.performance": "Performance",
    "nav.documentation": "Documentation",

    // === Error boundary ===
    "error.heading": "Something went wrong",
    "error.message": "We're sorry, the page failed to load. Our team has been notified.",
    "error.retry": "Retry",
    "error.support": "Contact support",
    "error.reference": tpl`If the issue persists, contact support with reference ${"digest" as keyof Vars}.`,

    // === Home ===
    "home.subtitle": "Get Google Shopping, Bing and Amazon ready from Shopify Admin.",
    "home.titleBar.choosePlan": "Choose a plan",
    "home.titleBar.manageSubscription": "Manage subscription",
    "home.sub.loading": "Loading your subscription…",
    "home.sub.activePlan": tpl`${"planKey" as keyof Vars} plan active`,
    "home.sub.trialEnds": tpl`Trial ends: ${"date" as keyof Vars} · `,
    "home.sub.nextRenewal": tpl`Next renewal: ${"date" as keyof Vars}`,
    "home.sub.manageButton": "Manage subscription",
    "home.sub.noActive": "No active subscription",
    "home.sub.noActiveHint": "Pick a plan to start syncing your catalog with marketing channels.",
    "home.sub.choosePlan": "Choose a plan",
    "home.welcome.heading": "Welcome to FeedPlug",
    "home.welcome.body":
      "FeedPlug connects your Shopify catalog to Google Shopping, Microsoft Bing Shopping and Amazon Seller from a single interface. Product updates are pushed in real time (products/* webhooks) and a manual re-sync stays available at any time.",
    "home.welcome.diagnosticCta": "See my quality diagnostic",
    "home.welcome.channelsCta": "Configure my channels",
    "home.steps.heading": "3 steps to get started",
    "home.steps.1": "Pick your plan (from 100 to 50,000 products)",
    "home.steps.2": "Configure your export channels (Google Merchant, Bing, Amazon)",
    "home.steps.3": "Fix the issues detected by the quality diagnostic",
    "home.features.heading": "Features included",
    "home.features.realTimeTitle": "Real-time sync",
    "home.features.realTimeBody":
      "Shopify products/create|update|delete webhooks: your changes reach Google within seconds.",
    "home.features.diagnosticTitle": "Quality diagnostic",
    "home.features.diagnosticBody":
      "List of products that will be rejected by Google Merchant Center with precise reasons, one click from Shopify Admin.",
    "home.features.mappingTitle": "Smart mapping",
    "home.features.mappingBody": "Google taxonomy + required attributes auto-filled.",
    "home.help.label": "Need help?",

    // === Billing ===
    "billing.titleBar": "Choose a plan",
    "billing.titleBar.active": "Active subscription",
    "billing.subtitle": "Billing handled by Shopify Payments — no card to enter.",
    "billing.subtitle.active": "Manage your Shopify subscription",
    "billing.backToHome": "Home",
    "billing.loading": "Loading subscription…",
    "billing.intro":
      "14-day free trial on every plan. No commitment, change or cancel anytime from this screen.",
    "billing.trialFooter": tpl`${"trialDays" as keyof Vars} days free trial · cancel anytime`,
    "billing.recommended": "Recommended",
    "billing.pricePerMonth": "/ month",
    "billing.choose": tpl`Choose ${"plan" as keyof Vars}`,
    "billing.active.planLabel": tpl`${"planKey" as keyof Vars} plan`,
    "billing.active.testMode": "Test mode",
    "billing.active.monthlyAmount": "Monthly amount",
    "billing.active.trialEnd": "Trial end date",
    "billing.active.nextRenewal": "Next renewal",
    "billing.active.cancelNotice":
      "Cancellation takes effect at the end of the current period.",
    "billing.active.cancelButton": "Cancel subscription",
    "billing.toast.cancelOk": "Subscription cancelled. You keep access until the end of the period.",
    "billing.toast.noAccount":
      "No FeedPlug account is linked to your store yet. Reload the app in a few seconds.",
    "billing.toast.missingConnection": "Shopify connection missing",
    "billing.toast.invalidResponse": "Invalid Shopify response (confirmationUrl missing)",
    "billing.toast.networkError": "Network error",

    // === Sources / Catalog ===
    "sources.title": "Catalog",
    "sources.syncNow": "Sync now",
    "sources.connectedSince": tpl`Connected since ${"date" as keyof Vars}`,
    "sources.productsSynced": "Products synced",
    "sources.lastSync": "Last sync",
    "sources.topProducts": "20 most recently updated products",
    "sources.tableLabel.product": "Product",
    "sources.tableLabel.brand": "Brand",
    "sources.tableLabel.sku": "SKU",
    "sources.tableLabel.price": "Price",
    "sources.tableLabel.stock": "Stock",
    "sources.tableLabel.updated": "Updated",
    "sources.empty.heading": "No products synced yet",
    "sources.empty.body":
      "The first sync can take a few minutes after install. Use \"Sync now\" to trigger it immediately.",
    "sources.notConnected.heading": "No store connected",
    "sources.notConnected.body":
      "Your Shopify store doesn't appear connected to FeedPlug yet. This can happen after an app reinstall. Reload the app or contact support.",
    "sources.notConnected.reconnect": "Reconnect Shopify",
    "sources.toast.syncTriggered": "Sync triggered. Refreshing in a few seconds…",
    "sources.toast.networkError": "Network error",
    "sources.viewMore": tpl`Showing the 20 most recent products out of ${"total" as keyof Vars} synced. This Admin view is meant to quickly check the freshness and quality of the catalog without leaving Shopify.`,

    // === Diagnostic ===
    "diagnostic.title": "Quality diagnostic",
    "diagnostic.subtitle": tpl`${"total" as keyof Vars} products analyzed against Google Merchant Center rules`,
    "diagnostic.reload": "Reload",
    "diagnostic.scoreCard.avg": "Average score",
    "diagnostic.scoreCard.critical": "Needs urgent fix",
    "diagnostic.scoreCard.criticalHint": "Score < 40 — Google will reject",
    "diagnostic.scoreCard.error": "Errors",
    "diagnostic.scoreCard.errorHint": "Score 40-59 — required field missing",
    "diagnostic.scoreCard.ok": "Compliant",
    "diagnostic.scoreCard.okHint": tpl`${"percent" as keyof Vars}% of catalog`,
    "diagnostic.distribution.heading": "Score distribution",
    "diagnostic.distribution.critical": "Critical (< 40)",
    "diagnostic.distribution.error": "Errors (40-59)",
    "diagnostic.distribution.warning": "Warnings (60-79)",
    "diagnostic.distribution.ok": "Compliant (80+)",
    "diagnostic.topReasons.heading": tpl`Top rejection reasons (${"count" as keyof Vars})`,
    "diagnostic.topReasons.body":
      "Fixing these fields in bulk via your Shopify interface is the fastest way to improve the overall score.",
    "diagnostic.topReasons.products": tpl`${"count" as keyof Vars} products`,
    "diagnostic.worstProducts.heading": "20 products to fix in priority",
    "diagnostic.worstProducts.fix": "Fix",
    "diagnostic.empty.heading": "No products analyzed yet",
    "diagnostic.empty.body":
      "The quality diagnostic scores each product against Google Merchant Center, Microsoft Bing and Amazon rules. Trigger a catalog sync to see the issues to fix.",
    "diagnostic.empty.action": "Sync the catalog",
    "diagnostic.methodology":
      "Methodology: each product is scored against the official Google Merchant Center, Microsoft Bing Shopping and Amazon rules. The score considers required fields, description quality, image quality and structured attribute consistency.",
    "diagnostic.severity.blocking": "Blocking",
    "diagnostic.severity.error": "Error",
    "diagnostic.severity.warning": "Warning",
    "diagnostic.field.id": "Product ID",
    "diagnostic.field.title": "Title",
    "diagnostic.field.description": "Description",
    "diagnostic.field.image": "Main image",
    "diagnostic.field.imageUrl": "Main image",
    "diagnostic.field.price": "Price",
    "diagnostic.field.availability": "Availability",
    "diagnostic.field.condition": "Condition",
    "diagnostic.field.link": "Product link",
    "diagnostic.field.url": "Product link",
    "diagnostic.field.brand": "Brand",
    "diagnostic.field.gtin": "GTIN / EAN",
    "diagnostic.field.mpn": "Manufacturer reference (MPN)",
    "diagnostic.field.google_product_category": "Google category",
    "diagnostic.field.product_type": "Product type",
    "diagnostic.field.shipping": "Shipping",
    "diagnostic.field.unknown": "Other",

    // === LIA ===
    "lia.title": "Local Inventory",
    "lia.subtitle": "Manage your physical stores and local inventory for Google Local Inventory Ads.",
    "lia.loading": "Loading…",
    "lia.banner":
      "Google Local Inventory Ads showcase product availability in your physical stores. Set up your locations, import per-store inventory, then add the feed in Google Merchant Center.",
    "lia.stores.heading": tpl`Stores (${"count" as keyof Vars})`,
    "lia.stores.codeLabel": "Store code",
    "lia.stores.codeHelp": "Google Business Profile identifier (e.g. STORE_PARIS_01)",
    "lia.stores.nameLabel": "Name (optional)",
    "lia.stores.addressLabel": "Address (optional)",
    "lia.stores.addButton": "Add store",
    "lia.stores.disable": "Disable",
    "lia.stores.empty.heading": "No stores yet",
    "lia.stores.empty.body":
      "Add at least one store to get started. The store code must match the one defined in Google Business Profile.",
    "lia.inventory.heading": "Import inventory (CSV)",
    "lia.inventory.columns":
      "Expected columns: storeCode, offerId, quantity, availability, price, salePrice, pickupMethod, pickupSla.",
    "lia.inventory.template": "Download template",
    "lia.inventory.import": "Import",
    "lia.inventory.preview.ready": tpl`${"count" as keyof Vars} row(s) ready`,
    "lia.inventory.preview.errors": tpl`· ${"count" as keyof Vars} error(s) ignored`,
    "lia.list.heading": tpl`Current inventory (${"count" as keyof Vars})`,
    "lia.list.allStores": "All stores",
    "lia.list.col.store": "Store",
    "lia.list.col.product": "Product",
    "lia.list.col.quantity": "Quantity",
    "lia.list.col.availability": "Availability",
    "lia.list.col.price": "Price",
    "lia.list.col.pickup": "Pickup",
    "lia.list.delete": "Delete",
    "lia.list.empty.heading": "No inventory rows yet",
    "lia.list.empty.body": "Import a CSV to start tracking stock store by store.",
    "lia.feedUrl.heading": "Feed URL for Google Merchant Center",
    "lia.feedUrl.body":
      "Paste this URL in Google Merchant Center → Feeds → Add primary feed (Scheduled fetch, daily).",
    "lia.feedUrl.global": "Global",
    "lia.feedUrl.copy": "Copy",
    "lia.feedUrl.copied": "URL copied",
    "lia.feedUrl.copyError": "Copy failed — use Cmd+C manually",
    "lia.feedUrl.noFeedWarning":
      "No active feed on this account. Sync your catalog first from the Catalog page.",
    "lia.toast.storeAdded": tpl`Store ${"storeCode" as keyof Vars} added`,
    "lia.toast.storeDisabled": tpl`Store ${"storeCode" as keyof Vars} disabled`,

    // === Performance ===
    "performance.title": "Performance",
    "performance.subtitle": "Aggregates over the last 30 days",
    "performance.loading": "Loading performance data…",
    "performance.empty.heading": "No performance data yet",
    "performance.empty.body":
      "Performance appears as soon as you connect an advertising channel (Google Ads, Meta Ads, Amazon). FeedPlug aggregates impressions, clicks, revenue and ROAS per synced product.",
    "performance.empty.syncCta": "Sync the catalog",
    "performance.empty.channelsCta": "Configure my channels",
    "performance.stat.impressions": "Impressions",
    "performance.stat.clicks": "Clicks",
    "performance.stat.revenue": "Revenue",
    "performance.stat.roas": "ROAS",
    "performance.channelTable.heading": "Performance by channel",
    "performance.topProducts.heading": "Top products",
    "performance.advancedLink":
      "Advanced analytics (time series, comparisons, segmentation) available on",

    // === Channels ===
    "channels.title": "Channels",
    "channels.subtitle": "Connect the marketing destinations where your catalog is pushed.",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.billing": "Facturation",
    "nav.channels": "Canaux",
    "nav.catalog": "Catalogue",
    "nav.diagnostic": "Diagnostic",
    "nav.lia": "Magasins (LIA)",
    "nav.performance": "Performance",
    "nav.documentation": "Documentation",

    "error.heading": "Une erreur est survenue",
    "error.message":
      "Nous sommes désolés, quelque chose s'est mal passé. Notre équipe a été notifiée.",
    "error.retry": "Réessayer",
    "error.support": "Contacter le support",
    "error.reference": tpl`Si le problème persiste, contactez le support en mentionnant la référence ${"digest" as keyof Vars}.`,

    "home.subtitle": "Préparez Google Shopping, Bing et Amazon depuis Shopify Admin.",
    "home.titleBar.choosePlan": "Choisir un plan",
    "home.titleBar.manageSubscription": "Gérer mon abonnement",
    "home.sub.loading": "Chargement de votre abonnement…",
    "home.sub.activePlan": tpl`Plan ${"planKey" as keyof Vars} actif`,
    "home.sub.trialEnds": tpl`Fin de l'essai : ${"date" as keyof Vars} · `,
    "home.sub.nextRenewal": tpl`Prochain renouvellement : ${"date" as keyof Vars}`,
    "home.sub.manageButton": "Gérer mon abonnement",
    "home.sub.noActive": "Aucun abonnement actif",
    "home.sub.noActiveHint":
      "Choisissez un plan pour activer la synchronisation automatique de votre catalogue vers les canaux marketing.",
    "home.sub.choosePlan": "Choisir un plan",
    "home.welcome.heading": "Bienvenue dans FeedPlug",
    "home.welcome.body":
      "FeedPlug connecte votre catalogue Shopify à Google Shopping, Microsoft Bing Shopping et Amazon Seller depuis une seule interface. Les mises à jour catalogue sont déclenchées par Shopify en temps réel (webhooks products/*), avec une relance manuelle toujours disponible.",
    "home.welcome.diagnosticCta": "Voir mon diagnostic qualité",
    "home.welcome.channelsCta": "Configurer mes canaux",
    "home.steps.heading": "3 étapes pour démarrer",
    "home.steps.1": "Choisir votre plan (de 100 à 50 000 produits)",
    "home.steps.2": "Configurer vos canaux d'export (Google Merchant, Bing, Amazon)",
    "home.steps.3": "Corriger les erreurs détectées par le diagnostic qualité",
    "home.features.heading": "Fonctionnalités incluses",
    "home.features.realTimeTitle": "Sync temps réel",
    "home.features.realTimeBody":
      "Webhooks Shopify products/create|update|delete : vos modifications partent vers Google en quelques secondes.",
    "home.features.diagnosticTitle": "Diagnostic qualité",
    "home.features.diagnosticBody":
      "Liste des produits qui seront rejetés par Google Merchant et raisons précises, en un clic depuis Shopify Admin.",
    "home.features.mappingTitle": "Mapping intelligent",
    "home.features.mappingBody":
      "Catégorisation Google + attributs requis automatiquement remplis.",
    "home.help.label": "Besoin d'aide ?",

    "billing.titleBar": "Choisir un plan",
    "billing.titleBar.active": "Abonnement actif",
    "billing.subtitle":
      "Facturation gérée par Shopify Payments — aucune carte à saisir.",
    "billing.subtitle.active": "Gestion de votre abonnement Shopify",
    "billing.backToHome": "Accueil",
    "billing.loading": "Chargement de l'abonnement…",
    "billing.intro":
      "14 jours d'essai gratuit sur tous les plans. Aucun engagement, changement ou annulation à tout moment.",
    "billing.trialFooter": tpl`${"trialDays" as keyof Vars} jours d'essai · annulation à tout moment`,
    "billing.recommended": "Recommandé",
    "billing.pricePerMonth": "/ mois",
    "billing.choose": tpl`Choisir ${"plan" as keyof Vars}`,
    "billing.active.planLabel": tpl`Plan ${"planKey" as keyof Vars}`,
    "billing.active.testMode": "Test mode",
    "billing.active.monthlyAmount": "Montant mensuel",
    "billing.active.trialEnd": "Fin de la période d'essai",
    "billing.active.nextRenewal": "Prochain renouvellement",
    "billing.active.cancelNotice":
      "L'annulation prend effet à la fin de la période en cours.",
    "billing.active.cancelButton": "Annuler l'abonnement",
    "billing.toast.cancelOk":
      "Abonnement annulé. Vous gardez l'accès jusqu'à la fin de la période.",
    "billing.toast.noAccount":
      "Aucun compte FeedPlug n'est encore lié à votre boutique. Rechargez l'app dans quelques secondes.",
    "billing.toast.missingConnection": "Connexion Shopify manquante",
    "billing.toast.invalidResponse":
      "Réponse Shopify invalide (confirmationUrl manquant)",
    "billing.toast.networkError": "Erreur réseau",

    "sources.title": "Catalogue",
    "sources.syncNow": "Synchroniser maintenant",
    "sources.connectedSince": tpl`Connectée depuis le ${"date" as keyof Vars}`,
    "sources.productsSynced": "Produits synchronisés",
    "sources.lastSync": "Dernière synchronisation",
    "sources.topProducts": "20 produits les plus récemment mis à jour",
    "sources.tableLabel.product": "Produit",
    "sources.tableLabel.brand": "Marque",
    "sources.tableLabel.sku": "SKU",
    "sources.tableLabel.price": "Prix",
    "sources.tableLabel.stock": "Stock",
    "sources.tableLabel.updated": "Mis à jour",
    "sources.empty.heading": "Aucun produit synchronisé pour l'instant",
    "sources.empty.body":
      "La première synchronisation peut prendre quelques minutes après l'install. Utilisez \"Synchroniser maintenant\" pour la déclencher immédiatement.",
    "sources.notConnected.heading": "Aucune boutique connectée",
    "sources.notConnected.body":
      "Votre boutique Shopify n'apparaît pas comme connectée à FeedPlug. Cela peut arriver après une réinstallation de l'app. Rechargez l'app ou contactez le support.",
    "sources.notConnected.reconnect": "Reconnecter Shopify",
    "sources.toast.syncTriggered":
      "Synchronisation déclenchée. Actualisation dans quelques secondes…",
    "sources.toast.networkError": "Erreur réseau",
    "sources.viewMore": tpl`Affichage des 20 derniers produits sur ${"total" as keyof Vars} synchronisés. Cette vue Shopify Admin sert à vérifier rapidement la fraîcheur et la qualité du catalogue sans sortir du workflow principal.`,

    "diagnostic.title": "Diagnostic qualité",
    "diagnostic.subtitle": tpl`${"total" as keyof Vars} produits analysés selon les règles Google Merchant Center`,
    "diagnostic.reload": "Recharger",
    "diagnostic.scoreCard.avg": "Score moyen",
    "diagnostic.scoreCard.critical": "À corriger en urgence",
    "diagnostic.scoreCard.criticalHint": "Score < 40 — rejet Google certain",
    "diagnostic.scoreCard.error": "Erreurs",
    "diagnostic.scoreCard.errorHint": "Score 40-59 — champ obligatoire manquant",
    "diagnostic.scoreCard.ok": "Conformes",
    "diagnostic.scoreCard.okHint": tpl`${"percent" as keyof Vars}% du catalogue`,
    "diagnostic.distribution.heading": "Répartition par score",
    "diagnostic.distribution.critical": "Critique (< 40)",
    "diagnostic.distribution.error": "Erreurs (40-59)",
    "diagnostic.distribution.warning": "Avertissements (60-79)",
    "diagnostic.distribution.ok": "Conformes (80+)",
    "diagnostic.topReasons.heading": tpl`Top raisons de rejet (${"count" as keyof Vars})`,
    "diagnostic.topReasons.body":
      "Corriger ces champs en masse via votre interface Shopify est le moyen le plus rapide d'améliorer le score global.",
    "diagnostic.topReasons.products": tpl`${"count" as keyof Vars} produits`,
    "diagnostic.worstProducts.heading": "20 produits à corriger en priorité",
    "diagnostic.worstProducts.fix": "Corriger",
    "diagnostic.empty.heading": "Aucun produit analysé pour l'instant",
    "diagnostic.empty.body":
      "Le diagnostic qualité analyse chaque produit synchronisé selon les règles Google Merchant Center, Microsoft Bing et Amazon. Lancez une synchronisation du catalogue pour voir apparaître ici les erreurs à corriger avant publication.",
    "diagnostic.empty.action": "Synchroniser le catalogue",
    "diagnostic.methodology":
      "Méthodologie : chaque produit est noté selon les règles officielles Google Merchant Center, Microsoft Bing Shopping et Amazon. Le score considère les champs obligatoires, la qualité de la description, des images et la cohérence des attributs structurés.",
    "diagnostic.severity.blocking": "Bloquant",
    "diagnostic.severity.error": "Erreur",
    "diagnostic.severity.warning": "Warning",
    "diagnostic.field.id": "ID produit",
    "diagnostic.field.title": "Titre",
    "diagnostic.field.description": "Description",
    "diagnostic.field.image": "Image principale",
    "diagnostic.field.imageUrl": "Image principale",
    "diagnostic.field.price": "Prix",
    "diagnostic.field.availability": "Disponibilité",
    "diagnostic.field.condition": "État",
    "diagnostic.field.link": "Lien produit",
    "diagnostic.field.url": "Lien produit",
    "diagnostic.field.brand": "Marque",
    "diagnostic.field.gtin": "GTIN / EAN",
    "diagnostic.field.mpn": "Référence fabricant (MPN)",
    "diagnostic.field.google_product_category": "Catégorie Google",
    "diagnostic.field.product_type": "Type de produit",
    "diagnostic.field.shipping": "Livraison",
    "diagnostic.field.unknown": "Autre",

    "lia.title": "Inventaire local",
    "lia.subtitle":
      "Gérez vos magasins physiques et l'inventaire local pour Google Local Inventory Ads.",
    "lia.loading": "Chargement…",
    "lia.banner":
      "Les Local Inventory Ads de Google Shopping permettent de mettre en avant la disponibilité produit dans vos magasins physiques. Configurez vos points de vente, importez l'inventaire par magasin, puis ajoutez le flux dans Google Merchant Center.",
    "lia.stores.heading": tpl`Magasins (${"count" as keyof Vars})`,
    "lia.stores.codeLabel": "Code magasin",
    "lia.stores.codeHelp":
      "Identifiant Google Business Profile (ex : STORE_PARIS_01)",
    "lia.stores.nameLabel": "Nom (optionnel)",
    "lia.stores.addressLabel": "Adresse (optionnel)",
    "lia.stores.addButton": "Ajouter le magasin",
    "lia.stores.disable": "Désactiver",
    "lia.stores.empty.heading": "Aucun magasin pour l'instant",
    "lia.stores.empty.body":
      "Ajoutez au moins un magasin pour démarrer. Le code magasin doit correspondre à votre fiche Google Business Profile.",
    "lia.inventory.heading": "Importer l'inventaire (CSV)",
    "lia.inventory.columns":
      "Colonnes attendues : storeCode, offerId, quantity, availability, price, salePrice, pickupMethod, pickupSla.",
    "lia.inventory.template": "Télécharger un modèle",
    "lia.inventory.import": "Importer",
    "lia.inventory.preview.ready": tpl`${"count" as keyof Vars} ligne(s) prête(s)`,
    "lia.inventory.preview.errors": tpl`· ${"count" as keyof Vars} erreur(s) ignorée(s)`,
    "lia.list.heading": tpl`Inventaire actuel (${"count" as keyof Vars})`,
    "lia.list.allStores": "Tous les magasins",
    "lia.list.col.store": "Magasin",
    "lia.list.col.product": "Produit",
    "lia.list.col.quantity": "Quantité",
    "lia.list.col.availability": "Disponibilité",
    "lia.list.col.price": "Prix",
    "lia.list.col.pickup": "Retrait",
    "lia.list.delete": "Supprimer",
    "lia.list.empty.heading": "Aucune ligne d'inventaire pour l'instant",
    "lia.list.empty.body":
      "Importez un CSV pour démarrer le suivi de stock magasin par magasin.",
    "lia.feedUrl.heading": "URL du flux pour Google Merchant Center",
    "lia.feedUrl.body":
      "Collez cette URL dans Google Merchant Center → Feeds → Add primary feed (Scheduled fetch, quotidien).",
    "lia.feedUrl.global": "Global",
    "lia.feedUrl.copy": "Copier",
    "lia.feedUrl.copied": "URL copiée",
    "lia.feedUrl.copyError": "Copie impossible — utilisez Cmd+C manuellement",
    "lia.feedUrl.noFeedWarning":
      "Aucun flux actif sur ce compte. Synchronisez d'abord votre catalogue depuis la page Catalogue.",
    "lia.toast.storeAdded": tpl`Magasin ${"storeCode" as keyof Vars} ajouté`,
    "lia.toast.storeDisabled": tpl`Magasin ${"storeCode" as keyof Vars} désactivé`,

    "performance.title": "Performance",
    "performance.subtitle": "Agrégats sur les 30 derniers jours",
    "performance.loading": "Chargement des performances…",
    "performance.empty.heading": "Aucune donnée de performance pour l'instant",
    "performance.empty.body":
      "Les performances apparaissent dès que vous connectez un canal publicitaire (Google Ads, Meta Ads, Amazon). FeedPlug agrège les impressions, clics, revenus et ROAS par produit synchronisé.",
    "performance.empty.syncCta": "Synchroniser le catalogue",
    "performance.empty.channelsCta": "Configurer mes canaux",
    "performance.stat.impressions": "Impressions",
    "performance.stat.clicks": "Clics",
    "performance.stat.revenue": "Revenus",
    "performance.stat.roas": "ROAS",
    "performance.channelTable.heading": "Performance par canal",
    "performance.topProducts.heading": "Top produits",
    "performance.advancedLink":
      "Analyses avancées (séries temporelles, comparatifs, segmentation) disponibles sur",

    "channels.title": "Canaux",
    "channels.subtitle": "Connectez les destinations marketing vers lesquelles votre catalogue est poussé.",
  },
  es: {
    // ES not yet fully translated — falls back to EN at runtime via the t() helper below.
  },
};

/**
 * Hook qui retourne la fonction de traduction pour la locale courante.
 *
 * Usage:
 *   const t = useEmbeddedT();
 *   t("home.heading")                 → "Welcome to FeedPlug"
 *   t("billing.choose", { plan: "Pro" }) → "Choose Pro"
 *
 * Fallbacks :
 *   1. Si la locale courante n'a pas la clé, on retombe sur EN.
 *   2. Si EN n'a pas la clé non plus, on retourne la clé (signal visible pour
 *      le développeur, plus utile qu'une chaîne vide en prod).
 */
export function useEmbeddedT() {
  const locale = useEmbeddedLocale();
  return useMemo(() => {
    const localeDict = translations[locale] || {};
    const fallbackDict = translations.en;
    return function t(key: string, vars?: Vars): string {
      const entry = localeDict[key] ?? fallbackDict[key] ?? key;
      if (typeof entry === "function") return entry(vars ?? {});
      return entry;
    };
  }, [locale]);
}

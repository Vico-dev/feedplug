/**
 * Shopify Managed Pricing — configuration des plans définis dans Shopify Partners.
 *
 * En Managed Pricing, les plans sont créés/édités dans le dashboard Partners
 * (Distribution → Pricing). Pour souscrire, on redirige le merchant vers une URL
 * Shopify Admin spéciale qui affiche l'écran de confirmation officiel Shopify
 * (montant, période, conditions). On ne crée plus de subscription via l'API
 * Billing — Shopify gère tout.
 *
 * Format URL : https://admin.shopify.com/store/{shop_handle}/charges/{app_handle}/pricing_plans/{plan_handle}
 *
 * Source de vérité des plans : ce fichier doit MATCHER exactement Partners.
 * À chaque modification dans Partners → mettre à jour ce fichier + frontend
 * (frontend/src/app/embedded/billing/_shopify-plans.ts).
 */

const SHOPIFY_APP_HANDLE = process.env.SHOPIFY_APP_HANDLE || 'feedplug';

const SHOPIFY_PLANS = Object.freeze({
  starter: {
    handle: 'starter',
    name: 'Starter',
    priceEur: 29,
    trialDays: 14,
    productsLimit: 100,
    channelsLimit: 1,
    includesAI: false,
  },
  pro: {
    handle: 'pro',
    name: 'Pro',
    priceEur: 79,
    trialDays: 14,
    productsLimit: 1000,
    channelsLimit: 2,
    includesAI: false,
  },
  business: {
    handle: 'business',
    name: 'Business',
    priceEur: 199,
    trialDays: 14,
    productsLimit: 10000,
    channelsLimit: 3,
    includesAI: true,
  },
  premium: {
    handle: 'premium',
    name: 'Premium',
    priceEur: 499,
    trialDays: 14,
    productsLimit: 50000,
    channelsLimit: 5,
    includesAI: true,
  },
});

function getPlan(handle) {
  const key = String(handle || '').trim().toLowerCase();
  return SHOPIFY_PLANS[key] || null;
}

function shopHandleFromDomain(shop) {
  // "demo.myshopify.com" → "demo"
  return String(shop || '').replace(/\.myshopify\.com$/i, '').toLowerCase();
}

/**
 * URL de la page de sélection des plans Shopify Managed Pricing.
 *
 * Shopify ne supporte PAS de lien direct vers un plan spécifique : on envoie
 * toujours le merchant sur la page de sélection, et il choisit lui-même son
 * plan parmi ceux publiés dans Partners. Pas idéal UX (notre frontend montre
 * déjà les 4 plans), mais c'est la limite documentée Managed Pricing 2026-04.
 *
 * Le `planHandle` est OPTIONNEL. L'URL Managed Pricing est de toute façon
 * générique (la page liste tous les plans, Shopify ne supporte pas le deep-link
 * vers un plan précis — cf. doc ci-dessous). On accepte donc :
 *  - avec `planHandle` : on le valide (refuse un plan inconnu) et on peut tracer
 *    côté DB lequel le merchant visait.
 *  - sans `planHandle` : on ouvre simplement la page de sélection Shopify, où le
 *    merchant choisit + approuve en une seule fois.
 *
 * Format documenté :
 *   https://admin.shopify.com/store/{shop_handle}/charges/{app_handle}/pricing_plans
 *
 * Doc : https://shopify.dev/docs/apps/launch/billing/redirect-plan-selection-page
 */
function buildManagedPricingUrl({ shop, planHandle, appHandle = SHOPIFY_APP_HANDLE }) {
  const shopHandle = shopHandleFromDomain(shop);
  if (!shopHandle) {
    throw new Error(`buildManagedPricingUrl: shop invalide (${shop})`);
  }
  // Si un planHandle est fourni, on le valide ; sinon on ouvre la page générique.
  if (planHandle != null && String(planHandle).trim() !== '' && !getPlan(planHandle)) {
    throw new Error(`buildManagedPricingUrl: plan inconnu (${planHandle})`);
  }
  return `https://admin.shopify.com/store/${encodeURIComponent(shopHandle)}/charges/${encodeURIComponent(appHandle)}/pricing_plans`;
}

module.exports = {
  SHOPIFY_PLANS,
  SHOPIFY_APP_HANDLE,
  getPlan,
  buildManagedPricingUrl,
  // exposés pour tests
  _internals: { shopHandleFromDomain },
};

/**
 * Grille tarifaire FeedPlug (source de vérité).
 *
 * Utilisée par :
 *  - scripts/import-stripe-products.js (création des Stripe Prices)
 *  - domains/shopify/billing.js (Shopify Billing API)
 *  - routes/onboarding-billing.js (exposition au frontend)
 */

const PRODUCT_TIERS = Object.freeze([100, 500, 1000, 2500, 10000, 50000]);
const CHANNEL_OPTIONS = Object.freeze([1, 2, 3, 4, 5]);
const ADDON_IA_PRICE_EUR = 49;

const PRICING_GRID_EUR = Object.freeze({
  100:   { 1: 39,  2: 49,  3: 59,  4: 69,  5: 79 },
  500:   { 1: 79,  2: 99,  3: 119, 4: 139, 5: 159 },
  1000:  { 1: 129, 2: 159, 3: 189, 4: 219, 5: 249 },
  2500:  { 1: 199, 2: 249, 3: 299, 4: 349, 5: 399 },
  10000: { 1: 299, 2: 369, 3: 439, 4: 509, 5: 579 },
  50000: { 1: 449, 2: 549, 3: 649, 4: 749, 5: 849 },
});

/** Mappe une tranche produits vers son TIER_xxx (id de plan en DB). */
function tierIdFromProductTier(productTier) {
  const t = Number(productTier);
  if (!PRODUCT_TIERS.includes(t)) return null;
  return `TIER_${t}`;
}

/**
 * Retourne le prix mensuel en EUR pour une combinaison (tier × channels)
 * + addon IA optionnel.
 *
 * @param {object} params
 * @param {number} params.productTier   100 | 500 | 1000 | 2500 | 10000 | 50000
 * @param {number} params.channels      1..5
 * @param {boolean} [params.addonIA]
 * @returns {number|null} montant EUR, ou null si combinaison invalide
 */
function getPriceEur({ productTier, channels, addonIA = false }) {
  const tier = Number(productTier);
  const ch = Number(channels);
  if (!PRODUCT_TIERS.includes(tier)) return null;
  if (!CHANNEL_OPTIONS.includes(ch)) return null;
  const base = PRICING_GRID_EUR[tier]?.[ch];
  if (!Number.isFinite(base)) return null;
  return base + (addonIA ? ADDON_IA_PRICE_EUR : 0);
}

/**
 * Libellé humain pour un plan ("FeedPlug 500 produits / 2 canaux + IA").
 */
function getPlanLabel({ productTier, channels, addonIA = false }) {
  const tier = Number(productTier);
  const ch = Number(channels);
  const productsLabel = tier >= 1000 ? `${tier / 1000}k produits` : `${tier} produits`;
  const channelsLabel = `${ch} canal${ch > 1 ? 'x' : ''}`;
  const addonLabel = addonIA ? ' + Pack IA' : '';
  return `FeedPlug ${productsLabel} / ${channelsLabel}${addonLabel}`;
}

module.exports = {
  PRODUCT_TIERS,
  CHANNEL_OPTIONS,
  ADDON_IA_PRICE_EUR,
  PRICING_GRID_EUR,
  tierIdFromProductTier,
  getPriceEur,
  getPlanLabel,
};

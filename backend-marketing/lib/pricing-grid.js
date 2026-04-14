/**
 * Grille tarifaire V2 — Produits × Canaux (alignée avec frontend pricing-grid-v2.ts).
 * Utilisée pour le configurateur et la création de session Stripe (montant dynamique).
 */

const PRODUCT_TIERS = [100, 500, 1000, 2500, 10000, 50000];
const CHANNEL_OPTIONS = [1, 2, 3, 4, 5];
const ADDON_IA_PRICE_EUR = 49;

/** Prix HT/mois par (tranche produits, nombre de canaux). [tier][channels] */
const PRICING_GRID_EUR = {
  100: { 1: 39, 2: 49, 3: 59, 4: 69, 5: 79 },
  500: { 1: 79, 2: 99, 3: 119, 4: 139, 5: 159 },
  1000: { 1: 129, 2: 159, 3: 189, 4: 219, 5: 249 },
  2500: { 1: 199, 2: 249, 3: 299, 4: 349, 5: 399 },
  10000: { 1: 299, 2: 369, 3: 439, 4: 509, 5: 579 },
  50000: { 1: 449, 2: 549, 3: 649, 4: 749, 5: 849 },
};

/**
 * Calcule le prix HT/mois pour une configuration (configurateur).
 * @param {number} productTier - ex. 1000
 * @param {number} channelCount - 1 à 5
 * @param {boolean} addonIA
 * @returns {{ amountCents: number, amountEur: number } | null } - null si hors grille
 */
function getPriceFromConfigurator(productTier, channelCount, addonIA) {
  if (!PRODUCT_TIERS.includes(Number(productTier))) return null;
  const ch = Number(channelCount);
  if (ch < 1 || ch > 5) return null;
  const base = PRICING_GRID_EUR[productTier]?.[ch];
  if (base == null) return null;
  const amountEur = base + (addonIA ? ADDON_IA_PRICE_EUR : 0);
  const amountCents = Math.round(amountEur * 100);
  return { amountCents, amountEur };
}

/**
 * Plan Stripe pour le webhook : TIER_1000, TIER_500, etc.
 */
function getPlanIdFromTier(productTier) {
  if (!PRODUCT_TIERS.includes(Number(productTier))) return 'STARTER';
  return `TIER_${productTier}`;
}

module.exports = {
  PRODUCT_TIERS,
  CHANNEL_OPTIONS,
  ADDON_IA_PRICE_EUR,
  PRICING_GRID_EUR,
  getPriceFromConfigurator,
  getPlanIdFromTier,
};

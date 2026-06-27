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
 * Taux de TVA standard par pays (UE principaux + fallback).
 * Source : taux standards UE 2024. Sert UNIQUEMENT à l'affichage indicatif
 * du TTC côté frontend (estimation). La TVA réellement facturée est
 * déterminée par Stripe Tax (automatic_tax) en fonction de l'adresse et du
 * numéro de TVA intracommunautaire (autoliquidation B2B intra-UE).
 *
 * @type {Readonly<Record<string, number>>}
 */
const VAT_RATES_BY_COUNTRY = Object.freeze({
  FR: 0.20,
  DE: 0.19,
  ES: 0.21,
  IT: 0.22,
  BE: 0.21,
  NL: 0.21,
  LU: 0.17,
  PT: 0.23,
  AT: 0.20,
  IE: 0.23,
  PL: 0.23,
  SE: 0.25,
  DK: 0.25,
  FI: 0.24,
  GR: 0.24,
  CZ: 0.21,
  RO: 0.19,
  HU: 0.27,
  SK: 0.20,
  BG: 0.20,
  HR: 0.25,
  SI: 0.22,
  LT: 0.21,
  LV: 0.21,
  EE: 0.22,
  CY: 0.19,
  MT: 0.18,
});

/** Taux de TVA par défaut (FR) pour l'estimation TTC quand le pays est inconnu. */
const DEFAULT_VAT_RATE = 0.20;

/**
 * Retourne le taux de TVA standard (fraction, ex. 0.20 pour 20 %) pour un pays.
 * Fallback sur le taux FR si le pays est inconnu ou non renseigné.
 * Estimation indicative pour l'affichage TTC ; la facturation réelle est gérée
 * par Stripe Tax.
 *
 * @param {string|null|undefined} country  Code pays ISO-3166-1 alpha-2 (ex. "FR").
 * @returns {number} taux de TVA (fraction)
 */
function getTaxRateForCountry(country) {
  if (!country || typeof country !== 'string') return DEFAULT_VAT_RATE;
  const code = country.trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(VAT_RATES_BY_COUNTRY, code)) {
    return VAT_RATES_BY_COUNTRY[code];
  }
  return DEFAULT_VAT_RATE;
}

/**
 * Calcule le montant TTC estimé (en EUR) à partir d'un HT et d'un pays.
 * Estimation indicative — la TVA réellement appliquée est déterminée par Stripe.
 *
 * @param {number} amountHtEur  montant HT en EUR
 * @param {string|null|undefined} country  code pays ISO
 * @returns {{ rate: number, vatEur: number, ttcEur: number } | null}
 */
function estimateTtc(amountHtEur, country) {
  if (!Number.isFinite(amountHtEur)) return null;
  const rate = getTaxRateForCountry(country);
  const vatEur = Math.round(amountHtEur * rate * 100) / 100;
  const ttcEur = Math.round((amountHtEur + vatEur) * 100) / 100;
  return { rate, vatEur, ttcEur };
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
  VAT_RATES_BY_COUNTRY,
  DEFAULT_VAT_RATE,
  tierIdFromProductTier,
  getPriceEur,
  getPlanLabel,
  getTaxRateForCountry,
  estimateTtc,
};

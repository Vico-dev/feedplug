/**
 * Grille tarifaire V2 — Produits × Canaux (alignée avec PROPOSITION_GRILLE_TARIFAIRE_V2.md).
 * Utilisée par la page tarifs publique (configurateur).
 */

/** Tranches produits (ordre croissant). Au-delà de 50 000 = sur devis. */
export const PRODUCT_TIERS = [100, 500, 1000, 2500, 10000, 50000] as const;
export type ProductTier = (typeof PRODUCT_TIERS)[number];

/** Nombre de canaux (1 à 5). Au-delà = sur devis. */
export const CHANNEL_MIN = 1;
export const CHANNEL_MAX = 5;
export const CHANNEL_OPTIONS = [1, 2, 3, 4, 5] as const;
export type ChannelCount = (typeof CHANNEL_OPTIONS)[number];

/** Plateformes affichées dans le configurateur (initiales intégrées, pas d’image externe). Max 5 sélectionnables. */
export const CHANNEL_PLATFORMS: { id: string; name: string; initial: string; color: string }[] = [
  { id: "google", name: "Google Ads / Shopping", initial: "G", color: "#e8f0fe" },
  { id: "meta", name: "Meta (Facebook & Instagram)", initial: "M", color: "#e7f3ff" },
  { id: "amazon", name: "Amazon", initial: "A", color: "#fff4e6" },
  { id: "tiktok", name: "TikTok", initial: "T", color: "#fce8f0" },
  { id: "leroymerlin", name: "Leroy Merlin", initial: "LM", color: "#e8f5e9" },
  { id: "manomano", name: "ManoMano", initial: "MM", color: "#f3e5f5" },
  { id: "cdiscount", name: "Cdiscount", initial: "C", color: "#fff3e0" },
  { id: "rakuten", name: "Rakuten", initial: "R", color: "#fce4ec" },
];

/** Prix HT / mois par (tranche produits, nombre de canaux). Index: [tierIndex][channelIndex]. */
export const PRICING_GRID_EUR: Record<ProductTier, Record<ChannelCount, number>> = {
  100: { 1: 39, 2: 49, 3: 59, 4: 69, 5: 79 },
  500: { 1: 79, 2: 99, 3: 119, 4: 139, 5: 159 },
  1000: { 1: 129, 2: 159, 3: 189, 4: 219, 5: 249 },
  2500: { 1: 199, 2: 249, 3: 299, 4: 349, 5: 399 },
  10000: { 1: 299, 2: 369, 3: 439, 4: 509, 5: 579 },
  50000: { 1: 449, 2: 549, 3: 649, 4: 749, 5: 849 },
};

/** Add-on Pack IA (génération titres + images), prix HT / mois. */
export const ADDON_IA_PRICE_EUR = 49;

/**
 * Taux de TVA standard par pays (UE principaux + fallback FR).
 * ⚠️ Estimation indicative pour l'affichage TTC au moment du choix de plan.
 * La TVA réellement facturée est déterminée par Stripe Tax selon l'adresse et
 * le numéro de TVA intracommunautaire (autoliquidation B2B intra-UE).
 * Doit rester aligné avec backend-marketing/lib/pricing.js (VAT_RATES_BY_COUNTRY).
 */
export const VAT_RATES_BY_COUNTRY: Record<string, number> = {
  FR: 0.2, DE: 0.19, ES: 0.21, IT: 0.22, BE: 0.21, NL: 0.21, LU: 0.17,
  PT: 0.23, AT: 0.2, IE: 0.23, PL: 0.23, SE: 0.25, DK: 0.25, FI: 0.24,
  GR: 0.24, CZ: 0.21, RO: 0.19, HU: 0.27, SK: 0.2, BG: 0.2, HR: 0.25,
  SI: 0.22, LT: 0.21, LV: 0.21, EE: 0.22, CY: 0.19, MT: 0.18,
};

/** Taux de TVA par défaut (FR) quand le pays est inconnu. */
export const DEFAULT_VAT_RATE = 0.2;

/**
 * Retourne le taux de TVA standard (fraction, ex. 0.20) pour un pays.
 * Fallback FR si pays inconnu ou vide.
 */
export function getTaxRateForCountry(country?: string | null): number {
  if (!country) return DEFAULT_VAT_RATE;
  const code = country.trim().toUpperCase();
  return VAT_RATES_BY_COUNTRY[code] ?? DEFAULT_VAT_RATE;
}

/**
 * Estime le montant TTC à partir d'un HT et d'un pays.
 * Estimation indicative — Stripe Tax fait foi sur la facture réelle.
 */
export function estimateTtc(
  amountHtEur: number,
  country?: string | null
): { rate: number; vatEur: number; ttcEur: number } {
  const rate = getTaxRateForCountry(country);
  const vatEur = Math.round(amountHtEur * rate * 100) / 100;
  const ttcEur = Math.round((amountHtEur + vatEur) * 100) / 100;
  return { rate, vatEur, ttcEur };
}

/**
 * Retourne le prix de base HT/mois pour une tranche produits et un nombre de canaux.
 * Retourne null si hors grille (>50k produits ou >5 canaux).
 */
export function getPriceFromGrid(
  productTier: number,
  channelCount: number
): number | null {
  if (!PRODUCT_TIERS.includes(productTier as ProductTier)) return null;
  if (channelCount < 1 || channelCount > 5) return null;
  return PRICING_GRID_EUR[productTier as ProductTier][channelCount as ChannelCount];
}

/**
 * Libellé court pour une tranche produits (affichage configurateur).
 */
export function getProductTierLabel(tier: ProductTier): string {
  if (tier >= 1000) {
    return tier >= 10000 ? `${tier / 1000}K` : `${tier.toLocaleString('fr-FR')}`;
  }
  return tier.toString();
}

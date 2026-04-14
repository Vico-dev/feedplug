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

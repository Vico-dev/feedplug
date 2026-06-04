/**
 * Grille tarifaire FeedPlug — miroir de backend-marketing/lib/pricing.js.
 *
 * Important : à toute évolution de la grille côté backend, mettre à jour
 * ce fichier également. Les deux doivent rester strictement identiques pour
 * éviter qu'un merchant voie un prix différent de ce qui est facturé.
 */

export const PRODUCT_TIERS = [100, 500, 1000, 2500, 10000, 50000] as const;
export const CHANNEL_OPTIONS = [1, 2, 3, 4, 5] as const;
export const ADDON_IA_PRICE_EUR = 49;

export type ProductTier = (typeof PRODUCT_TIERS)[number];
export type ChannelCount = (typeof CHANNEL_OPTIONS)[number];

export const PRICING_GRID_EUR: Record<ProductTier, Record<ChannelCount, number>> = {
  100:   { 1: 39,  2: 49,  3: 59,  4: 69,  5: 79 },
  500:   { 1: 79,  2: 99,  3: 119, 4: 139, 5: 159 },
  1000:  { 1: 129, 2: 159, 3: 189, 4: 219, 5: 249 },
  2500:  { 1: 199, 2: 249, 3: 299, 4: 349, 5: 399 },
  10000: { 1: 299, 2: 369, 3: 439, 4: 509, 5: 579 },
  50000: { 1: 449, 2: 549, 3: 649, 4: 749, 5: 849 },
};

export function getPriceEur({
  productTier,
  channels,
  addonIA,
}: {
  productTier: ProductTier;
  channels: ChannelCount;
  addonIA: boolean;
}): number {
  const base = PRICING_GRID_EUR[productTier][channels];
  return base + (addonIA ? ADDON_IA_PRICE_EUR : 0);
}

export function formatProductsLabel(tier: ProductTier): string {
  if (tier >= 1000) return `${tier / 1000}k produits`;
  return `${tier} produits`;
}

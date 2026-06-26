/**
 * Plans Shopify Managed Pricing — miroir EXACT de ce qui est défini dans
 * Shopify Partners Dashboard → app FeedPlug → Distribution → Pricing.
 *
 * Important :
 *  - Le `handle` doit MATCHER exactement le handle créé dans Partners. C'est ce
 *    handle qui est utilisé dans l'URL de souscription Shopify.
 *  - Le `priceEur` est uniquement affiché côté frontend ; le vrai prix facturé
 *    au merchant vient de Partners. Toute modification de prix doit se faire
 *    dans Partners ET ici.
 *  - Les `quotas` ne sont pas envoyés à Shopify ; ils sont utilisés côté
 *    FeedPlug pour bloquer les usages au-delà du plan choisi.
 */

export type ShopifyPlanHandle = "starter" | "pro" | "business" | "premium";

export type ShopifyPlan = {
  handle: ShopifyPlanHandle;
  name: string;
  tagline: string;
  priceEur: number;
  trialDays: number;
  productsLimit: number;
  channelsLimit: number;
  includesAI: boolean;
  features: string[];
  recommended?: boolean;
};

export const SHOPIFY_PLANS: readonly ShopifyPlan[] = [
  {
    handle: "starter",
    name: "Starter",
    tagline: "Pour commencer Google Shopping",
    priceEur: 29,
    trialDays: 14,
    productsLimit: 100,
    channelsLimit: 1,
    includesAI: false,
    features: [
      "Jusqu'à 100 produits",
      "1 canal d'export (Google Shopping)",
      "Synchronisation continue",
      "Diagnostic qualité automatique",
    ],
  },
  {
    handle: "pro",
    name: "Pro",
    tagline: "La majorité des boutiques",
    priceEur: 79,
    trialDays: 14,
    productsLimit: 1000,
    channelsLimit: 2,
    includesAI: false,
    features: [
      "Jusqu'à 1 000 produits",
      "2 canaux d'export (Google + Bing ou Amazon)",
      "Synchronisation continue",
      "Diagnostic qualité + corrections suggérées",
      "Support email prioritaire",
    ],
    recommended: true,
  },
  {
    handle: "business",
    name: "Business",
    tagline: "Catalogues larges + IA",
    priceEur: 199,
    trialDays: 14,
    productsLimit: 10000,
    channelsLimit: 3,
    includesAI: true,
    features: [
      "Jusqu'à 10 000 produits",
      "3 canaux d'export",
      "Pack IA inclus : optimisation titres + génération images",
      "Diagnostic qualité avancé",
      "Support email prioritaire",
    ],
  },
  {
    handle: "premium",
    name: "Premium",
    tagline: "Catalogues massifs, marketplaces multiples",
    priceEur: 499,
    trialDays: 14,
    productsLimit: 50000,
    channelsLimit: 5,
    includesAI: true,
    features: [
      "Jusqu'à 50 000 produits",
      "5 canaux d'export",
      "Pack IA inclus",
      "Diagnostic + audit qualité avancé",
      "Support dédié",
    ],
  },
] as const;

export function findShopifyPlan(handle: string): ShopifyPlan | null {
  return SHOPIFY_PLANS.find((p) => p.handle === handle) ?? null;
}

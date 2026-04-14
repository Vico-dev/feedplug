/**
 * Configuration des plans tarifaires par devise.
 * Utilisé par la page tarifs et la facturation (aligné avec backend PLANS).
 */

export type PlanId = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface PlanPrice {
  amount: number;
  currency: string;
}

/** Grille par devise (ISO 4217). Les montants sont indicatifs ; Stripe gère les priceId par devise. */
export const PLANS_BY_CURRENCY: Record<string, Record<PlanId, PlanPrice>> = {
  EUR: {
    STARTER: { amount: 49, currency: 'EUR' },
    PROFESSIONAL: { amount: 149, currency: 'EUR' },
    ENTERPRISE: { amount: 399, currency: 'EUR' },
  },
  GBP: {
    STARTER: { amount: 42, currency: 'GBP' },
    PROFESSIONAL: { amount: 129, currency: 'GBP' },
    ENTERPRISE: { amount: 349, currency: 'GBP' },
  },
  USD: {
    STARTER: { amount: 54, currency: 'USD' },
    PROFESSIONAL: { amount: 164, currency: 'USD' },
    ENTERPRISE: { amount: 439, currency: 'USD' },
  },
};

/** Limites numériques par plan (null = illimité). Aligné avec backend-marketing/lib/plan-limits.js */
export const PLAN_LIMITS: Record<PlanId, { maxProducts: number | null; maxFeedSources: number | null; maxFeeds: number | null }> = {
  STARTER: { maxProducts: 1000, maxFeedSources: 3, maxFeeds: 3 },
  PROFESSIONAL: { maxProducts: 10000, maxFeedSources: null, maxFeeds: null },
  ENTERPRISE: { maxProducts: null, maxFeedSources: null, maxFeeds: null },
};

/** Fonctionnalités par plan (affichage et vérification côté client). */
export const PLAN_FEATURES: Record<
  PlanId,
  { exportGmc: boolean; aiEnrichment: boolean; qualityScore: boolean; supportLevel: string }
> = {
  STARTER: { exportGmc: true, aiEnrichment: false, qualityScore: false, supportLevel: 'email' },
  PROFESSIONAL: { exportGmc: true, aiEnrichment: true, qualityScore: true, supportLevel: 'priority' },
  ENTERPRISE: { exportGmc: true, aiEnrichment: true, qualityScore: true, supportLevel: 'dedicated' },
};

/** Devise par défaut si la locale n'a pas de grille. */
const DEFAULT_CURRENCY = 'EUR';

/**
 * Retourne la grille des plans pour une devise.
 * Si la devise n'existe pas, retourne EUR.
 */
export function getPlansForCurrency(currency: string): Record<PlanId, PlanPrice> {
  const c = currency?.toUpperCase() || DEFAULT_CURRENCY;
  return PLANS_BY_CURRENCY[c] ?? PLANS_BY_CURRENCY[DEFAULT_CURRENCY];
}

/**
 * Map locale → devise pour l'affichage des tarifs (aligné avec i18n/locales LOCALE_META).
 */
export function getCurrencyForLocale(locale: string): string {
  const map: Record<string, string> = {
    fr: 'EUR',
    en: 'EUR',
    'en-GB': 'GBP',
    de: 'EUR',
    sv: 'SEK',
    es: 'EUR',
    it: 'EUR',
    nl: 'EUR',
    pt: 'EUR',
  };
  return map[locale] ?? DEFAULT_CURRENCY;
}

/**
 * Configuration des locales pour l'internationalisation.
 * Permet d'ajouter de nouvelles locales (en-GB, de, sv…) avec fallback et métadonnées.
 */

/** Locales actuellement actives dans le routing (pages accessibles). */
export const ACTIVE_LOCALES = ['fr', 'en', 'es'] as const;

/** Locales prévues pour extension (à activer quand les messages sont prêts). */
export const PLANNED_LOCALES = ['en-GB', 'de', 'sv', 'it', 'nl', 'pt'] as const;

export type ActiveLocale = (typeof ACTIVE_LOCALES)[number];
export type PlannedLocale = (typeof PLANNED_LOCALES)[number];
export type Locale = ActiveLocale | PlannedLocale;

/** Locale par défaut (si non détectée ou invalide). */
export const DEFAULT_LOCALE: ActiveLocale = 'fr';

/**
 * Fallback pour le chargement des messages : si une locale n'a pas de fichier,
 * utiliser celle-ci (ex. en-GB → en, de → en).
 */
export const MESSAGE_FALLBACK: Partial<Record<Locale, ActiveLocale>> = {
  'en-GB': 'en',
  de: 'en',
  sv: 'en',
  it: 'en',
  nl: 'en',
  pt: 'en',
};

/**
 * Métadonnées par locale : devise par défaut, format date, libellé.
 * Utilisé pour l'affichage (tarifs, catalogue) et le SEO.
 */
export const LOCALE_META: Record<
  string,
  { currency: string; dateStyle: 'short' | 'medium' | 'long'; label: string; languageTag: string }
> = {
  fr: { currency: 'EUR', dateStyle: 'short', label: 'Français', languageTag: 'fr-FR' },
  en: { currency: 'EUR', dateStyle: 'short', label: 'English', languageTag: 'en' },
  'en-GB': { currency: 'GBP', dateStyle: 'short', label: 'English (UK)', languageTag: 'en-GB' },
  de: { currency: 'EUR', dateStyle: 'short', label: 'Deutsch', languageTag: 'de-DE' },
  sv: { currency: 'SEK', dateStyle: 'short', label: 'Svenska', languageTag: 'sv-SE' },
  es: { currency: 'EUR', dateStyle: 'short', label: 'Español', languageTag: 'es-ES' },
  it: { currency: 'EUR', dateStyle: 'short', label: 'Italiano', languageTag: 'it-IT' },
  nl: { currency: 'EUR', dateStyle: 'short', label: 'Nederlands', languageTag: 'nl-NL' },
  pt: { currency: 'EUR', dateStyle: 'short', label: 'Português', languageTag: 'pt-PT' },
};

/** Liste de toutes les locales reconnues (actives + planifiées). */
export const ALL_LOCALES = [...ACTIVE_LOCALES, ...PLANNED_LOCALES];

/** Vérifie si une chaîne est une locale active. */
export function isActiveLocale(locale: string): locale is ActiveLocale {
  return ACTIVE_LOCALES.includes(locale as ActiveLocale);
}

/** Retourne la locale de fallback pour le chargement des messages, ou la locale elle-même. */
export function getMessageFallbackLocale(locale: string): ActiveLocale {
  if (isActiveLocale(locale)) return locale;
  const fallback = MESSAGE_FALLBACK[locale as PlannedLocale];
  return fallback ?? DEFAULT_LOCALE;
}

/** Devise par défaut pour une locale. */
export function getDefaultCurrency(locale: string): string {
  return LOCALE_META[locale]?.currency ?? 'EUR';
}

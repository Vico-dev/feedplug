/**
 * Formatage par locale : devise, date, nombres.
 * Utilisé pour le catalogue, les tarifs et toute donnée affichée à l'utilisateur.
 */

import { LOCALE_META, getDefaultCurrency } from '@/i18n/locales';

type LocaleOrTag = string;

function getLanguageTag(locale: LocaleOrTag): string {
  return LOCALE_META[locale]?.languageTag ?? locale;
}

/**
 * Formate un montant avec la devise selon la locale.
 * @param amount - Montant numérique
 * @param currency - Code ISO 4217 (optionnel, déduit de la locale si absent)
 * @param locale - Locale pour le format (virgule/point, position symbole)
 */
export function formatCurrency(
  amount: number,
  currency?: string,
  locale: LocaleOrTag = 'fr'
): string {
  const code = currency ?? getDefaultCurrency(locale);
  const tag = getLanguageTag(locale);
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formate une date selon la locale (court par défaut).
 */
export function formatDate(
  date: Date | string | number,
  locale: LocaleOrTag = 'fr',
  style: 'short' | 'medium' | 'long' = 'short'
): string {
  const d = typeof date === 'object' ? date : new Date(date);
  const tag = getLanguageTag(locale);
  return new Intl.DateTimeFormat(tag, {
    dateStyle: style,
  }).format(d);
}

/**
 * Formate un nombre (entier ou décimal) selon la locale.
 */
export function formatNumber(value: number, locale: LocaleOrTag = 'fr', options?: Intl.NumberFormatOptions): string {
  const tag = getLanguageTag(locale);
  return new Intl.NumberFormat(tag, options).format(value);
}

/**
 * Formate un nombre avec séparateur de milliers (ex. 1 000).
 */
export function formatInteger(value: number, locale: LocaleOrTag = 'fr'): string {
  return formatNumber(value, locale, { maximumFractionDigits: 0 });
}

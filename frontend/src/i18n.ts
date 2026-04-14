import { getRequestConfig } from 'next-intl/server';
import { routing } from './i18n/routing';
import { getMessageFallbackLocale, isActiveLocale } from './i18n/locales';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !isActiveLocale(locale)) {
    locale = routing.defaultLocale;
  }

  // Pour les locales sans fichier dédié (ex. en-GB), charger les messages du fallback
  const loadLocale = isActiveLocale(locale) ? locale : getMessageFallbackLocale(locale);

  let messages;
  try {
    messages = (await import(`@/messages/${loadLocale}.json`)).default;
  } catch {
    messages = (await import(`@/messages/${routing.defaultLocale}.json`)).default;
  }

  return {
    locale,
    messages,
  };
});

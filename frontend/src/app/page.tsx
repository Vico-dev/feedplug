import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import MarketingLandingPage from './[locale]/(marketing)/page';
import { routing } from '@/i18n/routing';

function detectLocale(acceptLanguage: string) {
  if (acceptLanguage.includes('es')) {
    return 'es';
  }

  if (acceptLanguage.includes('en')) {
    return 'en';
  }

  return routing.defaultLocale;
}

export default async function Home() {
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language') || '';
  const locale = detectLocale(acceptLanguage);
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <MarketingLandingPage />
    </NextIntlClientProvider>
  );
}

import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { ACTIVE_LOCALES, DEFAULT_LOCALE } from './locales';

export const routing = defineRouting({
  locales: [...ACTIVE_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);



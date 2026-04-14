import { DEFAULT_LOCALE, isActiveLocale } from "@/i18n/locales";

export function getLocalePrefixForLocale(locale?: string | null): string {
  if (!locale || !isActiveLocale(locale) || locale === DEFAULT_LOCALE) {
    return "";
  }
  return `/${locale}`;
}

export function getLocalePrefixFromPathname(pathname?: string | null): string {
  const firstSegment = pathname?.split("/").filter(Boolean)[0];
  return firstSegment && isActiveLocale(firstSegment) ? `/${firstSegment}` : "";
}

export function stripLocalePrefix(
  pathname?: string | null,
  localePrefix = getLocalePrefixFromPathname(pathname)
): string {
  if (!pathname) return "/";
  if (localePrefix && pathname.startsWith(`${localePrefix}/`)) {
    return pathname.slice(localePrefix.length) || "/";
  }
  return pathname;
}

export function buildLocalizedPath(path: string, localePrefix = ""): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return localePrefix ? `${localePrefix}${normalizedPath}` : normalizedPath;
}

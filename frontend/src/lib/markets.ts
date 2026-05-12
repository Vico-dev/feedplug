"use client";

export type MarketBlueprint = {
  code: string;
  defaultCurrencyCode: string;
  defaultLocales: string[];
  recommendedPlatforms: string[];
};

export const MARKET_BLUEPRINTS: MarketBlueprint[] = [
  { code: "FR", defaultCurrencyCode: "EUR", defaultLocales: ["fr-FR"], recommendedPlatforms: ["gmc", "amazon", "meta"] },
  { code: "IT", defaultCurrencyCode: "EUR", defaultLocales: ["it-IT"], recommendedPlatforms: ["gmc", "amazon", "meta"] },
  { code: "ES", defaultCurrencyCode: "EUR", defaultLocales: ["es-ES"], recommendedPlatforms: ["gmc", "amazon", "meta"] },
  { code: "DE", defaultCurrencyCode: "EUR", defaultLocales: ["de-DE"], recommendedPlatforms: ["gmc", "amazon", "meta"] },
  { code: "BE", defaultCurrencyCode: "EUR", defaultLocales: ["fr-BE", "nl-BE"], recommendedPlatforms: ["gmc", "meta"] },
  { code: "CH", defaultCurrencyCode: "CHF", defaultLocales: ["de-CH", "fr-CH", "it-CH"], recommendedPlatforms: ["gmc", "meta"] },
  { code: "GB", defaultCurrencyCode: "GBP", defaultLocales: ["en-GB"], recommendedPlatforms: ["gmc", "amazon", "meta"] },
  { code: "NL", defaultCurrencyCode: "EUR", defaultLocales: ["nl-NL"], recommendedPlatforms: ["gmc", "meta"] },
  { code: "PT", defaultCurrencyCode: "EUR", defaultLocales: ["pt-PT"], recommendedPlatforms: ["gmc", "meta"] },
  { code: "US", defaultCurrencyCode: "USD", defaultLocales: ["en-US"], recommendedPlatforms: ["gmc", "meta", "tiktok"] },
  { code: "CA", defaultCurrencyCode: "CAD", defaultLocales: ["en-CA", "fr-CA"], recommendedPlatforms: ["gmc", "meta"] },
];

export const PLATFORM_OPTIONS = [
  { key: "gmc", label: "Google Shopping", requiresConnection: true },
  { key: "amazon", label: "Amazon", requiresConnection: true },
  { key: "meta", label: "Meta", requiresConnection: false },
  { key: "tiktok", label: "TikTok", requiresConnection: false },
  { key: "pinterest", label: "Pinterest", requiresConnection: false },
  { key: "snapchat", label: "Snapchat", requiresConnection: false },
  { key: "bing", label: "Microsoft Ads", requiresConnection: false },
  { key: "cdiscount", label: "Cdiscount", requiresConnection: false },
  { key: "rakuten", label: "Rakuten", requiresConnection: false },
  { key: "chatgpt", label: "ChatGPT", requiresConnection: false },
  { key: "perplexity", label: "Perplexity", requiresConnection: false },
  { key: "gemini", label: "Gemini", requiresConnection: false },
] as const;

export function getMarketBlueprint(code: string): MarketBlueprint | null {
  const normalizedCode = String(code || "").trim().toUpperCase();
  return MARKET_BLUEPRINTS.find((entry) => entry.code === normalizedCode) ?? null;
}

export function getPlatformLabel(platformKey: string): string {
  const normalizedPlatformKey = String(platformKey || "").trim().toLowerCase();
  return PLATFORM_OPTIONS.find((entry) => entry.key === normalizedPlatformKey)?.label ?? normalizedPlatformKey.toUpperCase();
}

export function platformUsesLocales(platformKey: string): boolean {
  return String(platformKey || "").trim().toLowerCase() !== "amazon";
}

export function platformRequiresConnection(platformKey: string): boolean {
  const normalizedPlatformKey = String(platformKey || "").trim().toLowerCase();
  return PLATFORM_OPTIONS.find((entry) => entry.key === normalizedPlatformKey)?.requiresConnection ?? false;
}

export function formatRegionName(uiLocale: string, countryCode: string): string {
  const normalizedCountryCode = String(countryCode || "").trim().toUpperCase();
  if (!normalizedCountryCode) return "";
  if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") {
    return normalizedCountryCode;
  }

  try {
    const regionNames = new Intl.DisplayNames([uiLocale], { type: "region" });
    return regionNames.of(normalizedCountryCode) ?? normalizedCountryCode;
  } catch {
    return normalizedCountryCode;
  }
}

export function formatMarketName(uiLocale: string, marketCode: string): string {
  return formatRegionName(uiLocale, marketCode);
}

export function formatLocaleLabel(uiLocale: string, localeCode: string): string {
  const normalizedLocaleCode = String(localeCode || "").trim();
  if (!normalizedLocaleCode) return "";

  const [languageCode = normalizedLocaleCode, countryCode] = normalizedLocaleCode.split("-");
  if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") {
    return normalizedLocaleCode;
  }

  try {
    const languageNames = new Intl.DisplayNames([uiLocale], { type: "language" });
    const languageName = languageNames.of(languageCode) ?? languageCode;
    if (!countryCode) return languageName;
    const regionName = formatRegionName(uiLocale, countryCode);
    return `${languageName} (${regionName})`;
  } catch {
    return normalizedLocaleCode;
  }
}

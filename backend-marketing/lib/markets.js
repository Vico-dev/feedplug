const { AMAZON_CHANNELS } = require('../config/channels-by-market');

const MARKET_DEFINITIONS = {
  FR: {
    name: 'France',
    currency: 'EUR',
    locales: [{ localeCode: 'fr-FR', languageCode: 'fr', countryCode: 'FR', isDefault: true }],
  },
  GB: {
    name: 'United Kingdom',
    currency: 'GBP',
    locales: [{ localeCode: 'en-GB', languageCode: 'en', countryCode: 'GB', isDefault: true }],
  },
  DE: {
    name: 'Germany',
    currency: 'EUR',
    locales: [{ localeCode: 'de-DE', languageCode: 'de', countryCode: 'DE', isDefault: true }],
  },
  IT: {
    name: 'Italy',
    currency: 'EUR',
    locales: [{ localeCode: 'it-IT', languageCode: 'it', countryCode: 'IT', isDefault: true }],
  },
  ES: {
    name: 'Spain',
    currency: 'EUR',
    locales: [{ localeCode: 'es-ES', languageCode: 'es', countryCode: 'ES', isDefault: true }],
  },
  BE: {
    name: 'Belgium',
    currency: 'EUR',
    locales: [
      { localeCode: 'fr-BE', languageCode: 'fr', countryCode: 'BE', isDefault: true },
      { localeCode: 'nl-BE', languageCode: 'nl', countryCode: 'BE', isDefault: false },
    ],
  },
  CH: {
    name: 'Switzerland',
    currency: 'CHF',
    locales: [
      { localeCode: 'de-CH', languageCode: 'de', countryCode: 'CH', isDefault: true },
      { localeCode: 'fr-CH', languageCode: 'fr', countryCode: 'CH', isDefault: false },
      { localeCode: 'it-CH', languageCode: 'it', countryCode: 'CH', isDefault: false },
    ],
  },
  NL: {
    name: 'Netherlands',
    currency: 'EUR',
    locales: [{ localeCode: 'nl-NL', languageCode: 'nl', countryCode: 'NL', isDefault: true }],
  },
  PT: {
    name: 'Portugal',
    currency: 'EUR',
    locales: [{ localeCode: 'pt-PT', languageCode: 'pt', countryCode: 'PT', isDefault: true }],
  },
  AT: {
    name: 'Austria',
    currency: 'EUR',
    locales: [{ localeCode: 'de-AT', languageCode: 'de', countryCode: 'AT', isDefault: true }],
  },
  SE: {
    name: 'Sweden',
    currency: 'SEK',
    locales: [{ localeCode: 'sv-SE', languageCode: 'sv', countryCode: 'SE', isDefault: true }],
  },
  NO: {
    name: 'Norway',
    currency: 'NOK',
    locales: [{ localeCode: 'nb-NO', languageCode: 'nb', countryCode: 'NO', isDefault: true }],
  },
  DK: {
    name: 'Denmark',
    currency: 'DKK',
    locales: [{ localeCode: 'da-DK', languageCode: 'da', countryCode: 'DK', isDefault: true }],
  },
  FI: {
    name: 'Finland',
    currency: 'EUR',
    locales: [{ localeCode: 'fi-FI', languageCode: 'fi', countryCode: 'FI', isDefault: true }],
  },
  PL: {
    name: 'Poland',
    currency: 'PLN',
    locales: [{ localeCode: 'pl-PL', languageCode: 'pl', countryCode: 'PL', isDefault: true }],
  },
  US: {
    name: 'United States',
    currency: 'USD',
    locales: [{ localeCode: 'en-US', languageCode: 'en', countryCode: 'US', isDefault: true }],
  },
  CA: {
    name: 'Canada',
    currency: 'CAD',
    locales: [
      { localeCode: 'en-CA', languageCode: 'en', countryCode: 'CA', isDefault: true },
      { localeCode: 'fr-CA', languageCode: 'fr', countryCode: 'CA', isDefault: false },
    ],
  },
};

const PLATFORM_LABELS = {
  gmc: 'Google Merchant Center',
  amazon: 'Amazon',
  meta: 'Meta',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
  bing: 'Microsoft Merchant Center',
  cdiscount: 'Cdiscount',
  rakuten: 'Rakuten',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Google Gemini',
};

function normalizeMarketCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizePlatformKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return key === 'google' ? 'gmc' : key;
}

function normalizeLocaleCode(value, marketCode = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/_/g, '-');
  if (/^[a-z]{2}$/i.test(normalized) && marketCode) {
    return `${normalized.toLowerCase()}-${normalizeMarketCode(marketCode)}`;
  }
  const [lang, country] = normalized.split('-');
  if (!lang) return '';
  if (!country) return lang.toLowerCase();
  return `${lang.toLowerCase()}-${country.toUpperCase()}`;
}

function getMarketDefinition(code) {
  const normalized = normalizeMarketCode(code);
  return MARKET_DEFINITIONS[normalized] || null;
}

function getMarketName(code) {
  const definition = getMarketDefinition(code);
  return definition?.name || normalizeMarketCode(code) || 'Market';
}

function getMarketCurrency(code) {
  const definition = getMarketDefinition(code);
  return definition?.currency || 'EUR';
}

function getDefaultLocalesForMarket(code) {
  const definition = getMarketDefinition(code);
  if (!definition) {
    const normalized = normalizeMarketCode(code) || 'FR';
    return [{ localeCode: `en-${normalized}`, languageCode: 'en', countryCode: normalized, isDefault: true }];
  }
  return definition.locales.map((locale) => ({ ...locale }));
}

function getPlatformLabel(platformKey) {
  return PLATFORM_LABELS[normalizePlatformKey(platformKey)] || platformKey;
}

function platformUsesLocales(platformKey) {
  return normalizePlatformKey(platformKey) !== 'amazon';
}

function inferAmazonChannelKeyForMarket(marketCode) {
  const normalized = normalizeMarketCode(marketCode);
  const match = Object.entries(AMAZON_CHANNELS).find(([, config]) => config.countryCode === normalized);
  return match?.[0] || null;
}

function inferMarketCodeFromAmazonChannelKey(channelKey) {
  const config = AMAZON_CHANNELS[String(channelKey || '').toLowerCase()];
  return config?.countryCode || null;
}

function buildDestinationSlug({ platformKey, marketCode, localeCode, externalScopeId }) {
  const platform = normalizePlatformKey(platformKey) || 'channel';
  const market = normalizeMarketCode(marketCode) || 'XX';
  const locale = normalizeLocaleCode(localeCode, marketCode)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  const scope = String(externalScopeId || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return [platform, market.toLowerCase(), locale || null, scope || null].filter(Boolean).join('_');
}

function buildDestinationScope(platformKey, marketCode, marketChannelSettings = {}) {
  const platform = normalizePlatformKey(platformKey);
  if (platform === 'amazon') {
    const legacyChannelKey = String(marketChannelSettings.legacyChannelKey || '').toLowerCase();
    const amazonConfig = AMAZON_CHANNELS[legacyChannelKey] || (inferAmazonChannelKeyForMarket(marketCode) ? AMAZON_CHANNELS[inferAmazonChannelKeyForMarket(marketCode)] : null);
    if (amazonConfig) {
      return {
        externalScopeType: 'marketplace',
        externalScopeId: amazonConfig.marketplaceId,
        externalScopeLabel: amazonConfig.label,
        currencyCode: amazonConfig.currency || getMarketCurrency(marketCode),
      };
    }
    return {
      externalScopeType: 'marketplace',
      externalScopeId: null,
      externalScopeLabel: getPlatformLabel(platformKey),
      currencyCode: getMarketCurrency(marketCode),
    };
  }

  if (platform === 'gmc') {
    return {
      externalScopeType: 'merchant_center',
      externalScopeId: marketChannelSettings.merchantId || null,
      externalScopeLabel: getPlatformLabel(platformKey),
      currencyCode: getMarketCurrency(marketCode),
    };
  }

  return {
    externalScopeType: 'catalog',
    externalScopeId: marketChannelSettings.catalogId || null,
    externalScopeLabel: getPlatformLabel(platformKey),
    currencyCode: getMarketCurrency(marketCode),
  };
}

module.exports = {
  MARKET_DEFINITIONS,
  PLATFORM_LABELS,
  normalizeMarketCode,
  normalizePlatformKey,
  normalizeLocaleCode,
  getMarketDefinition,
  getMarketName,
  getMarketCurrency,
  getDefaultLocalesForMarket,
  getPlatformLabel,
  platformUsesLocales,
  inferAmazonChannelKeyForMarket,
  inferMarketCodeFromAmazonChannelKey,
  buildDestinationSlug,
  buildDestinationScope,
};

const {
  getDefaultLocalesForMarket,
  getMarketName,
  normalizeLocaleCode,
  normalizeMarketCode,
} = require('../lib/markets');

const LANGUAGE_LABELS = {
  fr: 'francais',
  en: 'anglais',
  de: 'allemand',
  es: 'espagnol',
  it: 'italien',
  nl: 'neerlandais',
  pt: 'portugais',
  sv: 'suedois',
  nb: 'norvegien',
  da: 'danois',
  fi: 'finnois',
  pl: 'polonais',
};

function getLanguageLabel(languageCode, localeCode = null) {
  const normalizedLanguageCode = String(languageCode || '').trim().toLowerCase();
  const normalizedLocaleCode = String(localeCode || '').trim();
  const fallback = normalizedLocaleCode || normalizedLanguageCode || 'langue cible';
  return LANGUAGE_LABELS[normalizedLanguageCode] || fallback;
}

function resolveOptimizationTarget(options = {}) {
  const destinationContext = options.destinationContext && typeof options.destinationContext === 'object'
    ? options.destinationContext
    : {};
  const marketCode = normalizeMarketCode(
    destinationContext.marketCode
    || options.marketCode
    || options.countryCode
    || ''
  );

  let localeCode = normalizeLocaleCode(
    destinationContext.localeCode
    || options.localeCode
    || '',
    marketCode
  );
  let languageCode = String(
    destinationContext.languageCode
    || options.languageCode
    || ''
  ).trim().toLowerCase();
  let countryCode = normalizeMarketCode(
    destinationContext.countryCode
    || options.countryCode
    || marketCode
  );

  if ((!localeCode || !languageCode || !countryCode) && marketCode) {
    const [defaultLocale] = getDefaultLocalesForMarket(marketCode);
    if (defaultLocale) {
      if (!localeCode) localeCode = defaultLocale.localeCode;
      if (!languageCode) languageCode = defaultLocale.languageCode;
      if (!countryCode) countryCode = defaultLocale.countryCode;
    }
  }

  if (!languageCode && localeCode) {
    languageCode = localeCode.split('-')[0]?.toLowerCase() || '';
  }

  return {
    marketCode: marketCode || null,
    marketName: destinationContext.marketName || options.marketName || (marketCode ? getMarketName(marketCode) : null),
    localeCode: localeCode || null,
    languageCode: languageCode || null,
    countryCode: countryCode || null,
    currencyCode: destinationContext.currencyCode || options.currencyCode || null,
  };
}

function buildLocalizationPrompt(target = {}) {
  const resolvedTarget = resolveOptimizationTarget(target);
  if (!resolvedTarget.marketCode && !resolvedTarget.localeCode && !resolvedTarget.languageCode) {
    return '';
  }

  const lines = [];
  const marketLabel = resolvedTarget.marketName || resolvedTarget.marketCode;
  if (marketLabel) {
    lines.push(`- Marche cible : ${marketLabel}${resolvedTarget.marketCode ? ` (${resolvedTarget.marketCode})` : ''}`);
  }
  if (resolvedTarget.localeCode) {
    lines.push(`- Locale cible : ${resolvedTarget.localeCode}`);
  }
  if (resolvedTarget.languageCode) {
    lines.push(`- Langue de sortie : ${getLanguageLabel(resolvedTarget.languageCode, resolvedTarget.localeCode)}`);
  }
  if (resolvedTarget.currencyCode) {
    lines.push(`- Devise commerciale : ${resolvedTarget.currencyCode}`);
  }

  const languageLabel = getLanguageLabel(resolvedTarget.languageCode, resolvedTarget.localeCode);
  const marketSuffix = marketLabel ? ` pour le marche ${marketLabel}` : '';

  return `\n\nContexte marche a respecter :\n${lines.join('\n')}\n\nConsignes de localisation :\n- Redige integralement le contenu final en ${languageLabel}.\n- Adapte l'orthographe, le vocabulaire et les formulations${marketSuffix}.\n- Si les donnees source sont dans une autre langue, traduis-les proprement vers la langue cible.\n- Conserve strictement les faits produit et n'invente ni informations commerciales, ni conformite locale, ni traductions de marque.`;
}

function buildOptimizationTargetCacheKey(options = {}) {
  const target = resolveOptimizationTarget(options);
  return {
    marketCode: target.marketCode,
    localeCode: target.localeCode,
    languageCode: target.languageCode,
    countryCode: target.countryCode,
    currencyCode: target.currencyCode,
  };
}

module.exports = {
  buildLocalizationPrompt,
  buildOptimizationTargetCacheKey,
  getLanguageLabel,
  resolveOptimizationTarget,
};

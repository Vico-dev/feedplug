/**
 * Mapping pays (code ISO 3166-1 alpha-2) → canaux disponibles.
 * Utilisé pour proposer les bons canaux selon la région du compte ou du flux.
 * Référence : server-minimal.js (AMAZON_CHANNELS), docs/AMAZON_CANAUX_DESIGN.md
 */

const AMAZON_CHANNELS = {
  amazon_fr: { marketplaceId: 'A13V1IB3VIYzH9', currency: 'EUR', countryCode: 'FR', locale: 'fr_FR', label: 'Amazon FR' },
  amazon_uk: { marketplaceId: 'A1F83G8C2ARO7P', currency: 'GBP', countryCode: 'GB', locale: 'en_GB', label: 'Amazon UK' },
  amazon_de: { marketplaceId: 'A1PA6795UKMFR9', currency: 'EUR', countryCode: 'DE', locale: 'de_DE', label: 'Amazon DE' },
  amazon_it: { marketplaceId: 'APLT6OXPXZ7JE', currency: 'EUR', countryCode: 'IT', locale: 'it_IT', label: 'Amazon IT' },
  amazon_es: { marketplaceId: 'A1RKKUPIHCS9HS', currency: 'EUR', countryCode: 'ES', locale: 'es_ES', label: 'Amazon ES' },
};

/** Canaux par pays : code pays → liste de channelKey. */
const CHANNELS_BY_COUNTRY = {
  FR: ['amazon_fr', 'gmc'],
  GB: ['amazon_uk', 'gmc'],
  DE: ['amazon_de', 'gmc'],
  IT: ['amazon_it', 'gmc'],
  ES: ['amazon_es', 'gmc'],
  // Pays sans canal dédié : proposer GMC + canaux EU selon cas
  BE: ['gmc'],
  NL: ['gmc'],
  AT: ['gmc'],
  CH: ['gmc'],
  SE: ['gmc'],
  NO: ['gmc'],
  DK: ['gmc'],
  FI: ['gmc'],
  PL: ['gmc'],
  PT: ['gmc'],
};

/** Pays couverts par un canal Amazon (countryCode du canal). */
const COUNTRIES_WITH_AMAZON = Object.values(AMAZON_CHANNELS).map((c) => c.countryCode);

/**
 * Retourne les channelKeys recommandés pour un pays.
 * @param {string} countryCode - ISO 3166-1 alpha-2 (ex. FR, GB)
 * @returns {string[]}
 */
function getChannelsForCountry(countryCode) {
  const code = (countryCode || '').toUpperCase();
  return CHANNELS_BY_COUNTRY[code] ?? ['gmc'];
}

/**
 * Retourne la config de tous les canaux Amazon (pour liste déroulante, etc.).
 */
function getAmazonChannels() {
  return { ...AMAZON_CHANNELS };
}

module.exports = {
  AMAZON_CHANNELS,
  CHANNELS_BY_COUNTRY,
  COUNTRIES_WITH_AMAZON,
  getChannelsForCountry,
  getAmazonChannels,
};

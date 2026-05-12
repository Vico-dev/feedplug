/**
 * Helper pour récupérer le titre et la description optimisés par plateforme.
 * Structure customfields.optimized : { gmc: {title, description}, meta: {...}, amazon: {...}, chatgpt: {...} }
 * Fallback : optimized_title / optimized_description (legacy), puis valeurs source.
 */

const PLATFORM_KEYS = {
  gmc: 'gmc',
  google: 'gmc',
  meta: 'meta',
  facebook: 'meta',
  amazon: 'amazon',
  chatgpt: 'chatgpt'
};

function normalizePlatformKey(platform) {
  const normalizedPlatform = String(platform || '').trim().toLowerCase();
  return PLATFORM_KEYS[normalizedPlatform] || normalizedPlatform;
}

function normalizeCustomFields(input) {
  return input && typeof input === 'object' ? { ...input } : {};
}

function getDestinationScopedContent(customFields, destinationId, expectedPlatform = null) {
  const normalizedDestinationId = String(destinationId || '').trim();
  if (!normalizedDestinationId) return null;
  const optimizedDestinations = customFields.optimizedDestinations && typeof customFields.optimizedDestinations === 'object'
    ? customFields.optimizedDestinations
    : {};
  const scopedContent = optimizedDestinations[normalizedDestinationId];
  if (!scopedContent || typeof scopedContent !== 'object') return null;

  const normalizedExpectedPlatform = expectedPlatform ? normalizePlatformKey(expectedPlatform) : null;
  const normalizedStoredPlatform = scopedContent.platform ? normalizePlatformKey(scopedContent.platform) : null;
  if (normalizedExpectedPlatform && normalizedStoredPlatform && normalizedStoredPlatform !== normalizedExpectedPlatform) {
    return null;
  }

  return scopedContent;
}

function hasContentValues(value) {
  if (!value || typeof value !== 'object') return false;
  const record = value;
  if (record.title && String(record.title).trim()) return true;
  if (record.description && String(record.description).trim()) return true;
  return Array.isArray(record.highlights) && record.highlights.some((entry) => typeof entry === 'string' && entry.trim());
}

function getStoredOptimizedContent(customFieldsInput, platform, options = {}) {
  const customFields = normalizeCustomFields(customFieldsInput);
  const platformKey = normalizePlatformKey(platform);
  const destinationId = String(options.destinationId || '').trim();
  const allowPlatformFallback = options.allowPlatformFallback !== false;

  if (destinationId) {
    const destinationScoped = getDestinationScopedContent(customFields, destinationId, platformKey);
    if (destinationScoped) {
      return {
        title: typeof destinationScoped.title === 'string' ? destinationScoped.title : '',
        description: typeof destinationScoped.description === 'string' ? destinationScoped.description : '',
        highlights: Array.isArray(destinationScoped.highlights)
          ? destinationScoped.highlights.filter((entry) => typeof entry === 'string' && entry.trim())
          : [],
      };
    }
    if (!allowPlatformFallback) {
      return { title: '', description: '', highlights: [] };
    }
  }

  const optimized = customFields.optimized && typeof customFields.optimized === 'object' ? customFields.optimized : {};
  const platformScoped = optimized[platformKey];
  if (platformScoped && typeof platformScoped === 'object') {
    return {
      title: typeof platformScoped.title === 'string' ? platformScoped.title : '',
      description: typeof platformScoped.description === 'string' ? platformScoped.description : '',
      highlights: Array.isArray(platformScoped.highlights)
        ? platformScoped.highlights.filter((entry) => typeof entry === 'string' && entry.trim())
        : [],
    };
  }

  return {
    title: typeof customFields.optimized_title === 'string' ? customFields.optimized_title : '',
    description: typeof customFields.optimized_description === 'string' ? customFields.optimized_description : '',
    highlights: [],
  };
}

function hasStoredOptimizedContent(customFieldsInput, platform, options = {}) {
  const customFields = normalizeCustomFields(customFieldsInput);
  const platformKey = normalizePlatformKey(platform);
  const destinationId = String(options.destinationId || '').trim();

  if (destinationId) {
    const destinationScoped = getDestinationScopedContent(customFields, destinationId, platformKey);
    if (destinationScoped && hasContentValues(destinationScoped)) return true;
    if (options.allowPlatformFallback === false) return false;
  }

  const optimized = customFields.optimized && typeof customFields.optimized === 'object' ? customFields.optimized : {};
  const platformScoped = optimized[platformKey];
  if (hasContentValues(platformScoped)) return true;

  return Boolean(
    (customFields.optimized_title && String(customFields.optimized_title).trim())
    || (customFields.optimized_description && String(customFields.optimized_description).trim())
  );
}

/**
 * @param {Object} item - FeedItem avec customfields
 * @param {string} platform - 'gmc'|'meta'|'amazon'|'chatgpt'
 * @returns {{ title: string, description: string, highlights: string[] }}
 */
function getOptimizedContentForPlatform(item, platform, options = {}) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const platformKey = normalizePlatformKey(platform);
  const descHtml = item.descriptionhtml ?? item.descriptionHtml ?? '';
  const descText = item.descriptiontext ?? item.descriptionText ?? '';
  const descRaw = (descText || descHtml || '').replace(/<[^>]*>/g, '').trim();

  let title = item.title || '';
  let description = descRaw || (item.title || '').substring(0, 500);
  let highlights = [];

  const storedContent = getStoredOptimizedContent(cf, platformKey, { destinationId: options.destinationId });
  if (storedContent.title) {
    title = storedContent.title;
  }
  if (storedContent.description) {
    description = storedContent.description;
  }
  if (storedContent.highlights.length > 0) {
    highlights = storedContent.highlights;
  }

  return { title: title.trim() || (item.title || ''), description: description.trim() || descRaw, highlights };
}

/**
 * Met à jour customfields.optimized[platform] avec title, description et/ou highlights.
 * @param {Object} currentCf - customfields actuel
 * @param {string} platform - gmc|meta|amazon|chatgpt
 * @param {{ title?: string, description?: string, highlights?: string[] }} content
 * @returns {Object} Nouveau customfields avec optimized[platform] mis à jour
 */
function mergeOptimizedContent(currentCf, platform, content, options = {}) {
  const cf = currentCf && typeof currentCf === 'object' ? { ...currentCf } : {};
  const platformKey = normalizePlatformKey(platform);
  const updatedAt = new Date().toISOString();
  const destinationId = String(options.destinationId || '').trim();

  if (destinationId) {
    const optimizedDestinations = cf.optimizedDestinations && typeof cf.optimizedDestinations === 'object'
      ? { ...cf.optimizedDestinations }
      : {};
    const existingDestination = optimizedDestinations[destinationId] && typeof optimizedDestinations[destinationId] === 'object'
      ? { ...optimizedDestinations[destinationId] }
      : {};
    if (content.title !== undefined) existingDestination.title = content.title;
    if (content.description !== undefined) existingDestination.description = content.description;
    if (Array.isArray(content.highlights)) existingDestination.highlights = content.highlights;
    existingDestination.platform = platformKey;
    existingDestination.destinationId = destinationId;
    existingDestination.updatedAt = updatedAt;
    if (options.marketCode) existingDestination.marketCode = options.marketCode;
    if (options.localeCode) existingDestination.localeCode = options.localeCode;
    optimizedDestinations[destinationId] = existingDestination;
    cf.optimizedDestinations = optimizedDestinations;
    return cf;
  }

  const opt = cf.optimized && typeof cf.optimized === 'object' ? { ...cf.optimized } : {};
  if (!opt[platformKey]) opt[platformKey] = {};
  if (content.title !== undefined) opt[platformKey].title = content.title;
  if (content.description !== undefined) opt[platformKey].description = content.description;
  if (Array.isArray(content.highlights)) opt[platformKey].highlights = content.highlights;
  opt[platformKey].updatedAt = updatedAt;
  cf.optimized = opt;
  return cf;
}

module.exports = {
  getOptimizedContentForPlatform,
  mergeOptimizedContent,
  hasStoredOptimizedContent,
  getStoredOptimizedContent,
  normalizePlatformKey,
  PLATFORM_KEYS
};

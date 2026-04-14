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

/**
 * @param {Object} item - FeedItem avec customfields
 * @param {string} platform - 'gmc'|'meta'|'amazon'|'chatgpt'
 * @returns {{ title: string, description: string, highlights: string[] }}
 */
function getOptimizedContentForPlatform(item, platform) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const platformKey = PLATFORM_KEYS[platform] || platform;
  const descHtml = item.descriptionhtml ?? item.descriptionHtml ?? '';
  const descText = item.descriptiontext ?? item.descriptionText ?? '';
  const descRaw = (descText || descHtml || '').replace(/<[^>]*>/g, '').trim();

  let title = item.title || '';
  let description = descRaw || (item.title || '').substring(0, 500);
  let highlights = [];

  const opt = cf.optimized && typeof cf.optimized === 'object' ? cf.optimized : {};
  const platformOpt = opt[platformKey];
  if (platformOpt && typeof platformOpt === 'object') {
    if (platformOpt.title && String(platformOpt.title).trim()) {
      title = platformOpt.title;
    }
    if (platformOpt.description && String(platformOpt.description).trim()) {
      description = platformOpt.description;
    }
    if (Array.isArray(platformOpt.highlights) && platformOpt.highlights.length > 0) {
      highlights = platformOpt.highlights;
    }
  } else {
    // Fallback legacy : optimized_title / optimized_description
    if (cf.optimized_title && String(cf.optimized_title).trim()) {
      title = cf.optimized_title;
    }
    if (cf.optimized_description && String(cf.optimized_description).trim()) {
      description = cf.optimized_description;
    }
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
function mergeOptimizedContent(currentCf, platform, content) {
  const cf = currentCf && typeof currentCf === 'object' ? { ...currentCf } : {};
  const opt = cf.optimized && typeof cf.optimized === 'object' ? { ...cf.optimized } : {};
  if (!opt[platform]) opt[platform] = {};
  if (content.title !== undefined) opt[platform].title = content.title;
  if (content.description !== undefined) opt[platform].description = content.description;
  if (Array.isArray(content.highlights)) opt[platform].highlights = content.highlights;
  opt[platform].updatedAt = new Date().toISOString();
  cf.optimized = opt;
  return cf;
}

module.exports = {
  getOptimizedContentForPlatform,
  mergeOptimizedContent,
  PLATFORM_KEYS
};

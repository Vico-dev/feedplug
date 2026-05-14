/**
 * Market translation service — v1 mince
 *
 * Traduit les champs marketing d'un produit (title, descriptionText) vers la
 * langue d'un MarketLocale donné, en s'appuyant sur :
 *   - callAIWithCache (ai/ai-wrapper.js) qui gère Gemini + le cache AICache
 *   - le `translationMode` du MarketLocale ('translate' / 'source' / 'manual')
 *
 * Périmètre v1 :
 *   - Traduction à la volée (cache via AICache déjà persisté)
 *   - 2 champs supportés : title, descriptionText (le reste du payload est
 *     copié tel quel — brand, prix, image, etc.)
 *   - Pas de batch, pas d'override manuel (toujours auto si mode = translate)
 *
 * À faire en v2 :
 *   - Mode 'manual' : permettre à l'utilisateur d'override une traduction
 *   - Cache typé par (productId, marketLocaleId) pour invalider proprement
 *   - Application réelle à l'export feed (pipeline CSV/XML)
 */

const { callAIWithCache } = require('../ai/ai-wrapper');

/**
 * Détecte la langue de la source en regardant le contenu.
 * Pour la v1 on assume FR par défaut, suffisant pour des feeds Shopify FR.
 * Future v2: peut être stocké au niveau Market (sourceLanguage) ou détecté
 * automatiquement via Gemini.
 */
function detectSourceLanguage(_product) {
  return 'fr';
}

const LANGUAGE_NAMES = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  it: 'italien',
  de: 'allemand',
  nl: 'néerlandais',
  pt: 'portugais',
  pl: 'polonais',
};

function languageName(code) {
  const key = String(code || '').toLowerCase().split('-')[0];
  return LANGUAGE_NAMES[key] || key.toUpperCase() || 'cible';
}

/**
 * Construit le prompt système qui guide Gemini :
 * - Ton e-commerce
 * - Préservation des accents / format / marque
 * - Pas d'inventer de specs
 */
function buildSystemPrompt(sourceLang, targetLang) {
  return [
    `Tu es un traducteur professionnel e-commerce ${languageName(sourceLang)} → ${languageName(targetLang)}.`,
    'Tu traduis fidèlement les fiches produits pour publication sur des marketplaces et Google Shopping.',
    '',
    'Règles strictes :',
    "- Ne traduis JAMAIS les noms de marque (Nike, Apple, etc.) — laisse-les tels quels.",
    "- Garde les références (SKU, GTIN, dimensions, unités, formats type 180g/m²).",
    "- Ne brode pas : ne rajoute pas de phrases marketing absentes du texte source.",
    "- Pas de hashtags, pas d'émojis, pas de mise en majuscules artificielle.",
    "- Conserve le HTML simple si présent (balises <p>, <ul>, <li>, <strong>).",
    '',
    "Tu réponds uniquement avec un JSON strict, sans bloc Markdown ni commentaire, sous la forme exacte :",
    '{ "title": "<titre traduit>", "descriptionText": "<description traduite ou chaîne vide>" }',
  ].join('\n');
}

function buildUserPrompt(product) {
  const lines = [
    `Titre source : ${product.title || ''}`,
  ];
  if (product.descriptionText) {
    lines.push('');
    lines.push('Description source :');
    lines.push(product.descriptionText);
  }
  if (product.brand) {
    lines.push('');
    lines.push(`Marque (à ne pas traduire) : ${product.brand}`);
  }
  return lines.join('\n');
}

function safeParseTranslation(rawText) {
  if (!rawText) return null;
  // Gemini renvoie parfois encadré dans ```json ... ``` malgré la consigne.
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      title: typeof parsed.title === 'string' ? parsed.title.trim() : null,
      descriptionText: typeof parsed.descriptionText === 'string' ? parsed.descriptionText.trim() : null,
    };
  } catch {
    return null;
  }
}

/**
 * Traduit un produit pour une locale cible.
 *
 * @param {Object}  prisma            Instance Prisma
 * @param {Object}  product           FeedItem source (title, descriptionText, brand, …)
 * @param {Object}  marketLocale      Ligne MarketLocale ({ localeCode, languageCode, translationMode })
 * @param {Object}  [options]
 * @param {boolean} [options.forceRefresh] Bypass cache AICache et force un nouvel appel
 * @returns {Promise<{ translated: { title, descriptionText }, mode, cached, provider, cost, warnings, sourceLanguage, targetLanguage }>}
 */
async function translateProductForMarket(prisma, product, marketLocale, options = {}) {
  if (!product) {
    throw new Error('product requis');
  }
  if (!marketLocale) {
    throw new Error('marketLocale requis');
  }

  const warnings = [];
  const sourceLanguage = detectSourceLanguage(product);
  const targetLanguage = String(marketLocale.languageCode || marketLocale.localeCode || '').toLowerCase().split('-')[0];

  // Mode 'source' : on garde le contenu d'origine, pas d'appel IA.
  if (marketLocale.translationMode === 'source' || !targetLanguage || targetLanguage === sourceLanguage) {
    return {
      mode: 'source',
      sourceLanguage,
      targetLanguage,
      cached: true,
      provider: null,
      cost: 0,
      tokensUsed: 0,
      translated: {
        title: product.title || '',
        descriptionText: product.descriptionText || '',
      },
      warnings,
    };
  }

  // Mode 'manual' : pour la v1 on retombe sur 'translate' en signalant un warning.
  if (marketLocale.translationMode === 'manual') {
    warnings.push("Le mode 'manual' n'est pas encore branché — traduction automatique appliquée.");
  }

  const systemPrompt = buildSystemPrompt(sourceLanguage, targetLanguage);
  const userPrompt = buildUserPrompt(product);

  const aiResponse = await callAIWithCache(
    prisma,
    'market_translation',
    {
      sourceLanguage,
      targetLanguage,
      title: product.title || '',
      descriptionText: product.descriptionText || '',
      brand: product.brand || '',
    },
    systemPrompt,
    userPrompt,
    product.id || null,
    options.forceRefresh === true
  );

  const parsed = safeParseTranslation(aiResponse?.text);
  if (!parsed) {
    warnings.push("La réponse Gemini n'était pas un JSON exploitable — fallback sur la source.");
    return {
      mode: 'translate',
      sourceLanguage,
      targetLanguage,
      cached: !!aiResponse?.cached,
      provider: aiResponse?.provider || 'gemini',
      cost: aiResponse?.cost || 0,
      tokensUsed: aiResponse?.tokensUsed || 0,
      translated: {
        title: product.title || '',
        descriptionText: product.descriptionText || '',
      },
      warnings,
    };
  }

  if (!parsed.title) warnings.push("Titre traduit vide — affichage de la source.");
  if (product.descriptionText && !parsed.descriptionText) {
    warnings.push("Description traduite vide — affichage de la source.");
  }

  return {
    mode: 'translate',
    sourceLanguage,
    targetLanguage,
    cached: !!aiResponse?.cached,
    provider: aiResponse?.provider || 'gemini',
    cost: aiResponse?.cost || 0,
    tokensUsed: aiResponse?.tokensUsed || 0,
    translated: {
      title: parsed.title || product.title || '',
      descriptionText: parsed.descriptionText || product.descriptionText || '',
    },
    warnings,
  };
}

module.exports = {
  translateProductForMarket,
  // exporté pour les tests éventuels
  safeParseTranslation,
};

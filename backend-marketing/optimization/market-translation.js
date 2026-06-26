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
const { checkAiQuota } = require('../lib/ai-caps');
const { recordAiUsage } = require('../lib/ai-quota');

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

/**
 * Traduit un lot d'items d'un export feed pour la destination cible.
 *
 * Stratégie v2 (export pipeline) :
 *   - Skip si pas de destinationContext ou si la langue cible == langue source.
 *   - Pool parallèle limité (5 concurrent) pour tenir dans la fenêtre Cloud
 *     Run (timeout 300s). À la première exécution sur un gros catalogue, on
 *     traduit tout via Gemini (~100 items/sec en pratique). Aux exécutions
 *     suivantes le cache AICache donne un hit immédiat (gratuit).
 *   - Best-effort : si une traduction échoue (timeout, quota, JSON invalide),
 *     on garde la version source pour CET item et on continue. On n'avorte
 *     jamais l'export entier — mieux vaut un feed à 95% traduit qu'un export
 *     planté.
 *   - Garde aussi `descriptionhtml` synchronisé sur la version traduite,
 *     puisque la plupart des canaux acceptent les deux.
 *
 * @param {Object}   prisma             Instance Prisma.
 * @param {Object[]} items              FeedItems chargés (raw rows ou mappés).
 * @param {Object}   destinationContext Sortie de getDestinationPushContext(),
 *                                      doit contenir { localeCode, languageCode,
 *                                      countryCode } pour activer la traduction.
 * @param {Object}   [options]
 * @param {number}   [options.poolSize] Concurrence Gemini (défaut 5).
 * @param {number}   [options.itemTimeoutMs] Timeout par item (défaut 15000).
 * @returns {Promise<{ items: Object[], stats: { translated: number, cached: number, failed: number, skipped: boolean, targetLanguage: string|null } }>}
 */
async function translateItemsForDestination(prisma, items, destinationContext, options = {}) {
  const baseStats = { translated: 0, cached: 0, failed: 0, skipped: false, targetLanguage: null };

  if (!Array.isArray(items) || items.length === 0) {
    return { items: items || [], stats: { ...baseStats, skipped: true } };
  }
  if (!destinationContext || !destinationContext.languageCode) {
    return { items, stats: { ...baseStats, skipped: true } };
  }

  const targetLanguage = String(destinationContext.languageCode || '').toLowerCase().split('-')[0];
  if (!targetLanguage) {
    return { items, stats: { ...baseStats, skipped: true } };
  }
  // Pour la v1 on assume FR comme langue source — voir detectSourceLanguage().
  // Si la cible est aussi FR on n'a rien à traduire.
  if (targetLanguage === detectSourceLanguage(null)) {
    return { items, stats: { ...baseStats, skipped: true, targetLanguage } };
  }

  // A3 — hard cap texte : la traduction par marché consomme du Gemium (sauf
  // hits cache). Si on a un accountId, on vérifie le plafond AVANT de traduire.
  // Au-delà du cap on n'appelle PAS Gemini — on renvoie le contenu source
  // (best-effort, cohérent avec le fallback "feed à 95%" de cette fonction).
  // On cape sur items.length (pire cas : tout est à traduire). Les hits cache
  // ne consomment rien et seront déduits du comptage en fin de fonction.
  const accountId = options.accountId || null;
  if (prisma && accountId) {
    try {
      const quota = await checkAiQuota(prisma, accountId, 'text', items.length);
      if (!quota.allowed) {
        return {
          items,
          stats: { ...baseStats, skipped: true, targetLanguage, quotaExceeded: true, quota },
        };
      }
    } catch (quotaErr) {
      // En cas d'erreur de lecture quota, on laisse passer (best-effort) plutôt
      // que de bloquer un export à cause d'un hoquet DB.
      console.warn('[market-translation] checkAiQuota ignoré:', quotaErr?.message);
    }
  }

  const locale = {
    localeCode: destinationContext.localeCode,
    languageCode: destinationContext.languageCode,
    countryCode: destinationContext.countryCode,
    // Pour l'export on force le mode 'translate' : même si la locale est en
    // 'manual' côté config (futur), on a besoin de SOMETHING dans le CSV.
    translationMode: 'translate',
  };

  const poolSize = Math.max(1, Math.min(options.poolSize || 5, 20));
  const itemTimeoutMs = Math.max(2000, options.itemTimeoutMs || 15000);

  const stats = { ...baseStats, targetLanguage };
  const out = new Array(items.length);
  let cursor = 0;

  function withTimeout(promise, ms, fallback) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      const sourceTitle = item?.title || '';
      const sourceDesc = item?.descriptionText || item?.descriptiontext || '';
      const sourceDescHtml = item?.descriptionhtml || item?.descriptionHtml || '';

      try {
        const result = await withTimeout(
          translateProductForMarket(
            prisma,
            { id: item.id, title: sourceTitle, descriptionText: sourceDesc, brand: item.brand || '' },
            locale,
            { forceRefresh: false },
          ),
          itemTimeoutMs,
          null,
        );

        if (!result) {
          stats.failed += 1;
          out[idx] = item;
          continue;
        }

        if (result.cached) stats.cached += 1;
        else stats.translated += 1;

        const translatedTitle = result.translated.title || sourceTitle;
        const translatedDesc = result.translated.descriptionText || sourceDesc;

        out[idx] = {
          ...item,
          title: translatedTitle,
          descriptionText: translatedDesc,
          descriptiontext: translatedDesc,
          // Si la source était HTML, on garde le HTML d'origine plutôt
          // que d'injecter du texte plat (qui casserait le rendu).
          descriptionhtml: sourceDescHtml || item.descriptionhtml,
          descriptionHtml: sourceDescHtml || item.descriptionHtml,
        };
      } catch (err) {
        stats.failed += 1;
        out[idx] = item;
        if (process.env.DEBUG_MARKET_TRANSLATION) {
          // eslint-disable-next-line no-console
          console.warn(`[market-translation] item ${item?.id} failed:`, err?.message);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  // A3 — comptage de la consommation IA : seules les traductions réellement
  // calculées via Gemini comptent (les hits cache sont gratuits). Best-effort,
  // ne bloque jamais l'export.
  if (prisma && accountId && stats.translated > 0) {
    try {
      await recordAiUsage(prisma, accountId, stats.translated, 'text');
    } catch (recErr) {
      console.warn('[market-translation] recordAiUsage ignoré:', recErr?.message);
    }
  }

  return { items: out, stats };
}

module.exports = {
  translateProductForMarket,
  translateItemsForDestination,
  // exporté pour les tests éventuels
  safeParseTranslation,
};

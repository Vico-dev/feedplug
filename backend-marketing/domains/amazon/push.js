'use strict';

/**
 * domains/amazon/push.js — Domaine Amazon push (SP-API Listings Items) (bloc 3).
 *
 * EXTRACTION STRANGLER À COMPORTEMENT STRICTEMENT PRÉSERVÉ.
 * Sorti À L'IDENTIQUE de la fonction géante `run()` de server-minimal.js
 * (mêmes config canaux, même normalisation Amazon, même construction du payload
 * SP-API Listings 2021-08-01, même gestion empty-state, mêmes compteurs
 * succeeded/failed/authFailure/rateLimited, même ExportLog, même traduction
 * marché best-effort). AUCUN changement fonctionnel.
 *
 * Deux familles d'exports :
 *
 *  1. Helpers PURS (testables directement, sans DI) :
 *       - AMAZON_CHANNEL_CONFIG               ← table des canaux/marketplaces Amazon
 *       - normalizeConditionForAmazon(raw)    ← New / Refurbished / Used
 *       - normalizeForAmazon(item, cfg, opts) ← normalisation FeedItem → attributs SP-API
 *     Ces symboles sont aussi utilisés par d'autres chemins de server-minimal.js
 *     (génération de feed Amazon, routes /channels Amazon, etc.) ; ils restent
 *     donc ré-exportés tels quels (les appelants historiques gardent les mêmes
 *     symboles via des const locales, exactement comme le bloc 2 GMC).
 *
 *  2. Factory `createAmazonPush(deps)` (DI), qui assemble :
 *       - executeAmazonPush({ accountId, feedId, destinationContext, channelKey })
 *     `executeAmazonPush` appelle des fonctions historiquement closure-scoped
 *     (`getActivePlatformConnectionForPush`, `refreshAmazonToken`,
 *     `filterItemsForDestinationActivation`, `inferAmazonChannelKeyForMarket`,
 *     `buildDestinationPushLabel`, `createPushError`, `translateItemsForDestination`,
 *     `prisma`, `fetch`, `crypto`, …). Elles sont INJECTÉES via la factory.
 *     `prisma` est un état muté pendant le boot → injecté via un GETTER
 *     `getPrisma()` (late-binding).
 *
 * Les routes Express Amazon (push, channels) RESTENT dans server-minimal.js ;
 * elles appellent les fonctions extraites via des wrappers locaux de signatures
 * inchangées. `executeAmazonPush` reste compatible avec le câblage du bloc 1
 * (`createJobHandlers` / hooks post-ingestion qui appellent `executeAmazonPush`).
 */

const { getOptimizedContentForPlatform } = require('../../utils/platform-content');

// Table des canaux/marketplaces Amazon (sortie À L'IDENTIQUE de server-minimal.js).
const AMAZON_CHANNEL_CONFIG = {
  amazon_fr: { marketplaceId: 'A13V1IB3VIYzH9', currency: 'EUR', countryCode: 'FR', locale: 'fr_FR', label: 'Amazon FR' },
  amazon_uk: { marketplaceId: 'A1F83G8C2ARO7P', currency: 'GBP', countryCode: 'GB', locale: 'en_GB', label: 'Amazon UK' },
  amazon_de: { marketplaceId: 'A1PA6795UKMFR9', currency: 'EUR', countryCode: 'DE', locale: 'de_DE', label: 'Amazon DE' },
  amazon_it: { marketplaceId: 'APLT6OXPXZ7JE', currency: 'EUR', countryCode: 'IT', locale: 'it_IT', label: 'Amazon IT' },
  amazon_es: { marketplaceId: 'A1RKKUPIHCS9HS', currency: 'EUR', countryCode: 'ES', locale: 'es_ES', label: 'Amazon ES' }
};

/** Normalise la condition pour Amazon : New, Refurbished, Used (première lettre majuscule). */
function normalizeConditionForAmazon(raw) {
  const s = (raw && String(raw).toLowerCase().trim()) || '';
  if (s === 'refurbished') return 'Refurbished';
  if (s === 'used') return 'Used';
  return 'New';
}

/** Normalise un FeedItem pour l'export Amazon (CSV / Listings). Limites : item_name 200 car., bullet 500, etc. */
function normalizeForAmazon(item, channelConfig, options = {}) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc, highlights } = getOptimizedContentForPlatform(item, 'amazon', options);
  const descRaw = optDesc.replace(/<[^>]*>/g, '').trim();
  const currency = channelConfig?.currency || item.currency || cf.currency || 'EUR';
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const gtin = item.gtin || cf.gtin || cf.GTIN || '';
  const mpn = item.mpn || cf.mpn || cf.MPN || item.sku || '';
  const sku = (item.sku || item.originid || item.originId || item.id).toString().substring(0, 40);
  const itemName = (optTitle || item.title || sku).toString().substring(0, 200);
  // Utiliser les highlights IA si disponibles, sinon fallback sur la description
  const bullet = highlights.length > 0
    ? highlights.map(h => h.substring(0, 500)).join(' | ')
    : (descRaw.substring(0, 500) || itemName);
  const productId = ((item.originid ?? item.originId) || item.id).toString().substring(0, 50);
  return {
    product_id: productId,
    sku,
    item_name: itemName,
    brand: (item.brand || cf.brand || '').toString().substring(0, 50) || 'Generic',
    bullet_point: bullet,
    product_description: descRaw.substring(0, 2000),
    standard_price: price ? `${price} ${currency}` : '',
    quantity: item.inventory != null ? Math.max(0, parseInt(item.inventory, 10)) : 0,
    main_image_url: (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '',
    condition_type: normalizeConditionForAmazon(item.condition || cf.condition),
    external_product_id: gtin || mpn || '',
    external_product_id_type: gtin ? 'ean' : (mpn ? 'upc' : ''),
    manufacturer: (item.brand || cf.brand || '').toString().substring(0, 50) || '',
    link: item.url || cf.link || ''
  };
}

/**
 * Factory DI : assemble `executeAmazonPush` qui dépend d'état/closures du serveur
 * (`prisma`, `fetch`, `crypto`, helpers de push, refresh token, …).
 *
 * @param {object} deps
 * @param {() => any} deps.getPrisma                             - getter late-bind Prisma.
 * @param {Function} deps.fetch                                  - fetch global (HTTP SP-API).
 * @param {object}   deps.crypto                                 - module crypto (randomUUID).
 * @param {string}   deps.AMAZON_SP_API_BASE                     - base URL SP-API.
 * @param {Function} deps.getActivePlatformConnectionForPush
 * @param {Function} deps.refreshAmazonToken
 * @param {Function} deps.filterItemsForDestinationActivation
 * @param {Function} deps.inferAmazonChannelKeyForMarket
 * @param {Function} deps.translateItemsForDestination
 * @param {Function} deps.buildDestinationPushLabel
 * @param {Function} deps.createPushError
 * @returns {object} { executeAmazonPush }
 */
function createAmazonPush(deps) {
  const {
    getPrisma,
    fetch,
    crypto,
    AMAZON_SP_API_BASE,
    getActivePlatformConnectionForPush,
    refreshAmazonToken,
    filterItemsForDestinationActivation,
    inferAmazonChannelKeyForMarket,
    translateItemsForDestination,
    buildDestinationPushLabel,
    createPushError,
  } = deps;

  async function executeAmazonPush({ accountId, feedId, destinationContext = null, channelKey = null }) {
    const prisma = getPrisma();
    const resolvedChannelKey = String(
      channelKey
        || destinationContext?.settings?.legacyChannelKey
        || inferAmazonChannelKeyForMarket(destinationContext?.marketCode || '')
        || 'amazon_fr'
    ).toLowerCase();
    const channelConfig = AMAZON_CHANNEL_CONFIG[resolvedChannelKey];
    if (!channelConfig) {
      throw createPushError('Canal Amazon invalide. Utilisez une destination Amazon ou channel=amazon_fr|amazon_uk|amazon_de|amazon_it|amazon_es.', 400);
    }

    const conn = await getActivePlatformConnectionForPush(accountId, 'amazon');
    if (!conn) {
      throw createPushError('Amazon non connecté. Connectez votre compte Seller Central d\'abord.', 400);
    }

    let accessToken = conn.accesstoken;
    if (conn.tokenexpiry && new Date(conn.tokenexpiry) < new Date()) {
      try {
        accessToken = await refreshAmazonToken(conn);
      } catch (refreshErr) {
        throw createPushError('Token Amazon expiré. Reconnectez votre compte.', 401, { reconnect: true });
      }
    }

    const meta = conn.metadata || {};
    const sellerId = conn.merchantid || meta.sellerId;
    if (!sellerId) {
      throw createPushError('Seller ID manquant. Reconnectez Amazon.', 400);
    }

    const legacyAmazonFilter = destinationContext
      ? ''
      : `AND (customfields->'_channelOverrides'->>'amazon' IS NULL OR customfields->'_channelOverrides'->>'amazon' != 'false')`;
    let items = await prisma.$queryRawUnsafe(
      `
        SELECT id, feedid AS "feedId", originid AS "originId", url, title,
               descriptionhtml AS "descriptionHtml", descriptiontext AS "descriptionText", imageurl AS "imageUrl",
               brand, sku, price, currency, inventory, customfields, gtin, mpn
        FROM "FeedItem"
        WHERE feedid = $1::text
          ${legacyAmazonFilter}
      `,
      feedId
    );
    items = await filterItemsForDestinationActivation(items, destinationContext);

    // Traduction par marché (v2) — best-effort.
    try {
      const { items: translated, stats } = await translateItemsForDestination(prisma, items, destinationContext, { prisma, accountId });
      items = translated;
      if (stats.quotaExceeded) {
        console.warn('[market-translation] amazon push : plafond IA texte atteint → contenu source (pas de traduction)');
      } else if (!stats.skipped) {
        console.log(`[market-translation] amazon push → ${destinationContext?.localeCode || stats.targetLanguage} : translated=${stats.translated} cached=${stats.cached} failed=${stats.failed}`);
      }
    } catch (translationErr) {
      console.warn('⚠️ Traduction marché ignorée (amazon push):', translationErr?.message);
    }

    if (!items || items.length === 0) {
      const emptyStateRows = await prisma.$queryRawUnsafe(
        `
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE customfields->'_channelOverrides'->>'amazon' = 'false'
            )::int AS amazon_disabled
          FROM "FeedItem"
          WHERE feedid = $1::text
        `,
        feedId
      );

      const emptyState = emptyStateRows?.[0] || {};
      const totalFeedItems = Number(emptyState.total || 0);
      const amazonDisabledItems = Number(emptyState.amazon_disabled || 0);

      let message = destinationContext
        ? `Aucun produit à pousser : aucun produit actif pour ${destinationContext.marketName || destinationContext.slug || 'cette destination Amazon'}.`
        : 'Aucun produit à pousser : aucun produit éligible pour Amazon.';
      let reason = destinationContext ? 'destination_empty' : 'no_eligible_products';

      if (totalFeedItems === 0) {
        message = 'Aucun produit à pousser : ce flux ne contient actuellement aucun produit synchronisé.';
        reason = 'empty_feed';
      } else if (amazonDisabledItems === totalFeedItems) {
        message = 'Aucun produit à pousser : tous les produits de ce flux sont désactivés pour Amazon.';
        reason = 'amazon_disabled';
      }

      return {
        message,
        total: 0,
        succeeded: 0,
        failed: 0,
        reason,
        totalFeedItems,
        amazonDisabledItems,
        destinationId: destinationContext?.id || null,
        destinationSlug: destinationContext?.slug || null,
        channelKey: resolvedChannelKey,
      };
    }

    let succeeded = 0;
    let failed = 0;
    const errors = [];
    let authFailure = false;   // 401/403 SP-API → access token invalide, reconnexion requise
    let rateLimited = false;   // 429 SP-API → throttling Amazon
    const marketplaceId = channelConfig.marketplaceId;
    const currency = channelConfig.currency;

    for (const item of items) {
      try {
        const cf = typeof item.customfields === 'string' ? JSON.parse(item.customfields || '{}') : (item.customfields || {});
        const n = normalizeForAmazon({ ...item, customfields: cf }, channelConfig, { destinationId: destinationContext?.id || null });
        const sku = n.sku;
        const priceVal = parseFloat((n.standard_price || '').split(' ')[0] || '0');
        const payload = {
          productType: 'PRODUCT',
          attributes: {
            item_name: [{ value: n.item_name, marketplace_id: marketplaceId }],
            product_description: [{ value: n.product_description, marketplace_id: marketplaceId }],
            bullet_point: [{ value: n.bullet_point, marketplace_id: marketplaceId }],
            brand: [{ value: n.brand, marketplace_id: marketplaceId }],
            condition_type: [{ value: n.condition_type, marketplace_id: marketplaceId }],
            list_price: [{ value: { value: priceVal, currency }, marketplace_id: marketplaceId }],
            fulfillment_availability: [{ value: [{ quantity: n.quantity }], marketplace_id: marketplaceId }],
            main_image: [{ value: [{ link: n.main_image_url }], marketplace_id: marketplaceId }]
          }
        };
        if (n.external_product_id) {
          payload.attributes.external_product_id = [{ value: n.external_product_id, marketplace_id: marketplaceId }];
          payload.attributes.external_product_id_type = [{ value: n.external_product_id_type, marketplace_id: marketplaceId }];
        }
        const putRes = await fetch(`${AMAZON_SP_API_BASE}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}?marketplaceIds=${marketplaceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-amz-access-token': accessToken,
            'User-Agent': 'FeedPlug/1.0 (Language=JavaScript)'
          },
          body: JSON.stringify(payload)
        });
        if (putRes.ok) {
          succeeded++;
        } else {
          const errText = await putRes.text().catch(() => '');
          failed++;
          if (putRes.status === 401 || putRes.status === 403) authFailure = true;
          if (putRes.status === 429) rateLimited = true;
          errors.push({ sku, status: putRes.status, error: errText.substring(0, 200) });
        }
      } catch (e) {
        failed++;
        errors.push({ sku: item.sku || item.id, error: e.message });
      }
    }

    const logId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "ExportLog" (id, accountid, feedid, platform, status, totalproducts, succeeded, failed, errormessage, createdat)
        VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::int, $7::int, $8::int, $9::text, NOW())
      `,
      logId,
      accountId,
      feedId,
      destinationContext?.slug || resolvedChannelKey,
      failed > 0 ? 'partial' : 'success',
      items.length,
      succeeded,
      failed,
      errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : null
    );

    // Tout a échoué sur une erreur d'auth → l'access token est invalide même
    // après refresh : on demande explicitement une reconnexion côté UI.
    if (succeeded === 0 && authFailure) {
      throw createPushError(
        'Connexion Amazon refusée par SP-API. Reconnectez Seller Central.',
        401,
        { reconnect: true, logId }
      );
    }

    const destinationLabel = buildDestinationPushLabel(destinationContext) || channelConfig.label;
    let message = `Push Amazon ${destinationLabel} : ${succeeded} produits envoyés, ${failed} erreurs`;
    if (rateLimited) {
      message += ' (throttling Amazon détecté — réessayez dans quelques minutes)';
    }
    return {
      message,
      total: items.length,
      succeeded,
      failed,
      rateLimited,
      errors: errors.slice(0, 10),
      logId,
      destinationId: destinationContext?.id || null,
      destinationSlug: destinationContext?.slug || null,
      channelKey: resolvedChannelKey,
    };
  }

  return { executeAmazonPush };
}

module.exports = {
  AMAZON_CHANNEL_CONFIG,
  normalizeConditionForAmazon,
  normalizeForAmazon,
  createAmazonPush,
};

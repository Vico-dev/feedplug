'use strict';

/**
 * domains/gmc/push.js — Domaine Google Merchant Center (GMC) push (bloc 2).
 *
 * EXTRACTION STRANGLER À COMPORTEMENT STRICTEMENT PRÉSERVÉ.
 * Sorti À L'IDENTIQUE de la fonction géante `run()` de server-minimal.js
 * (mêmes appels GMC batch, même gestion offerId / availability / condition,
 * même traduction marché best-effort, mêmes logs ExportLog, même best-effort
 * email). AUCUN changement fonctionnel.
 *
 * Deux familles d'exports :
 *
 *  1. Helpers PURS (testables directement, sans DI) :
 *       - DEFAULT_GMC_CATEGORY
 *       - normalizeAvailabilityForGMC(raw, inventory)
 *       - normalizeConditionForGMC(raw)
 *       - parseGmcMerchantOptions(accountsData)
 *       - resolveGmcOfferId(item)   ← logique offerId ≤50 / fallback id
 *       - buildGmcProductEntry(...) ← construction d'une entrée du batch GMC
 *     `normalizeAvailabilityForGMC` / `normalizeConditionForGMC` sont aussi
 *     utilisés par d'autres chemins de push (Amazon / Meta) dans
 *     server-minimal.js ; ils restent donc ré-exportés tels quels (les appelants
 *     historiques gardent les mêmes symboles via des const locales).
 *
 *  2. Factory `createGmcPush(deps)` (DI), qui assemble :
 *       - enrichGmcMerchantNames(options, accessToken) ← a besoin de `fetch`
 *       - executeGmcPush({ accountId, userId, feedId, destinationContext })
 *     `executeGmcPush` appelle beaucoup de fonctions historiquement
 *     closure-scoped (`getActivePlatformConnectionForPush`, `refreshGMCToken`,
 *     `filterItemsForDestinationActivation`, `getOptimizedContentForPlatform`,
 *     `findUserById`, `sendExportCompleteEmail`, `buildDestinationPushLabel`,
 *     `translateItemsForDestination`, `createPushError`, `prisma`, `fetch`,
 *     `crypto`, …). Elles sont INJECTÉES via la factory. `prisma` est un état
 *     muté pendant le boot → injecté via un GETTER `getPrisma()` (late-binding).
 *
 * Les routes Express GMC (callback OAuth, endpoints de push) RESTENT dans
 * server-minimal.js ; elles appellent les fonctions extraites via des wrappers
 * locaux de signatures inchangées. `executeGmcPush` reste compatible avec le
 * câblage du bloc 1 (`createJobHandlers({ executeGmcPush, … })`).
 */

const DEFAULT_GMC_CATEGORY = 'Apparel & Accessories > Clothing';

/** Normalise la disponibilité vers les valeurs GMC. */
function normalizeAvailabilityForGMC(raw, inventory) {
  const s = (raw && String(raw).toLowerCase()) || '';
  if (s === 'in_stock' || s === 'preorder' || s === 'backorder') return s;
  if (s.includes('preorder') || s.includes('pre-order')) return 'preorder';
  if (s.includes('backorder') || s.includes('back-order')) return 'backorder';
  if (s.includes('in stock') || s.includes('instock') || s === 'in stock') return 'in_stock';
  if (inventory != null && parseInt(inventory, 10) > 0) return 'in_stock';
  return 'out_of_stock';
}

/** Normalise la condition vers les valeurs GMC : new, refurbished, used. */
function normalizeConditionForGMC(raw) {
  const s = (raw && String(raw).toLowerCase().trim()) || '';
  if (['new', 'refurbished', 'used'].includes(s)) return s;
  if (/neuf|new|nouveau|nuevo/i.test(s)) return 'new';
  if (/reconditionn|refurbished|recondition/i.test(s)) return 'refurbished';
  if (/usag|used|occasion|second/i.test(s)) return 'used';
  return 'new';
}

/**
 * Parse la réponse `accounts/authinfo` en options Merchant Center dédoublonnées.
 * Logique sortie à l'identique de server-minimal.js.
 */
function parseGmcMerchantOptions(accountsData) {
  const rawEntries = Array.isArray(accountsData?.accountIdentifiers) ? accountsData.accountIdentifiers : [];
  const seen = new Set();
  const options = [];

  for (const entry of rawEntries) {
    const merchantId = String(entry?.merchantId || entry?.merchantid || entry?.aggregatorId || entry?.aggregatorid || '').trim();
    if (!merchantId || seen.has(merchantId)) continue;
    seen.add(merchantId);

    const merchantName = String(
      entry?.name ||
      entry?.accountName ||
      entry?.displayName ||
      entry?.merchantName ||
      ''
    ).trim();
    const aggregatorId = String(entry?.aggregatorId || entry?.aggregatorid || '').trim();

    options.push({
      merchantId,
      merchantName: merchantName || '',
      aggregatorId: aggregatorId || '',
      label: merchantName ? `${merchantName} (${merchantId})` : `Merchant Center ${merchantId}`,
    });
  }

  return options;
}

/**
 * offerId GMC : doit être COURT (≤50) ET UNIQUE. Le champ originid contient
 * parfois un libellé long (mauvais mapping source — ex. le titre 150 car.) :
 *  - >50 car. → Google rejette "[id] Value too long" (3500+ produits perdus) ;
 *  - tronqué à 50 → offerId dupliqués entre produits → GMC dédoublonne (écart
 *    "X envoyés" vs "Y visibles dans GMC").
 * On n'utilise originid que s'il est propre (≤50) ; sinon on retombe sur l'id
 * FeedItem (UUID 36 car., unique et stable via upsert).
 * Sorti À L'IDENTIQUE de server-minimal.js.
 */
function resolveGmcOfferId(item) {
  const rawOriginId = (item.originid ?? item.originId ?? '').toString().trim();
  return ((rawOriginId && rawOriginId.length <= 50) ? rawOriginId : item.id.toString()).substring(0, 50);
}

/**
 * Construit une entrée du batch products.batch GMC pour un FeedItem.
 * Sorti À L'IDENTIQUE de la boucle de `executeGmcPush`.
 *
 * @param {object} item   - FeedItem (champs SQL bruts : originid, customfields, …).
 * @param {number} idx    - index dans le lot (batchId).
 * @param {object} ctx
 * @param {string} ctx.merchantId
 * @param {string} ctx.contentLanguage
 * @param {string} ctx.targetCountry
 * @param {string|null} [ctx.destinationId]
 * @param {string|null} [ctx.currencyCode]   - devise de la destination (fallback prix).
 * @param {Function} ctx.getOptimizedContentForPlatform - injecté (utils/platform-content).
 */
function buildGmcProductEntry(item, idx, ctx) {
  const {
    merchantId,
    contentLanguage,
    targetCountry,
    destinationId = null,
    currencyCode = null,
    getOptimizedContentForPlatform,
  } = ctx;

  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc', { destinationId: destinationId || null });
  const title = (optTitle || item.title || '').substring(0, 150);
  const description = (optDesc || '').replace(/<[^>]*>/g, '').substring(0, 5000);
  const price = item.price ? { value: String(Number(item.price).toFixed(2)), currency: item.currency || currencyCode || 'EUR' } : undefined;
  const availability = normalizeAvailabilityForGMC(cf.availability || cf.inventory, item.inventory);
  const googleProductCategory = (cf.google_product_category && String(cf.google_product_category).trim()) || DEFAULT_GMC_CATEGORY;
  const condition = normalizeConditionForGMC(item.condition || cf.condition);
  const offerId = resolveGmcOfferId(item);
  return {
    batchId: idx,
    merchantId: merchantId,
    method: 'insert',
    product: {
      offerId: offerId,
      title: title,
      description: description.replace(/<[^>]*>/g, ''),
      link: item.url || cf.link || '',
      imageLink: (item.imageurl ?? item.imageUrl) || cf.image_link || '',
      availability: availability,
      price: price,
      brand: item.brand || cf.brand || '',
      gtin: item.gtin || cf.gtin || undefined,
      mpn: item.mpn || cf.mpn || item.sku || undefined,
      condition: condition,
      googleProductCategory: googleProductCategory,
      channel: 'online',
      contentLanguage,
      targetCountry
    }
  };
}

/**
 * Factory DI : assemble les fonctions GMC qui dépendent d'état/closures du
 * serveur (`prisma`, `fetch`, helpers de push, email, …).
 *
 * @param {object} deps
 * @param {() => any} deps.getPrisma                              - getter late-bind Prisma.
 * @param {Function} deps.fetch                                   - fetch global (HTTP GMC).
 * @param {object}   deps.crypto                                  - module crypto (randomUUID).
 * @param {Function} deps.getActivePlatformConnectionForPush
 * @param {Function} deps.refreshGMCToken
 * @param {Function} deps.filterItemsForDestinationActivation
 * @param {Function} deps.getOptimizedContentForPlatform
 * @param {Function} deps.translateItemsForDestination
 * @param {Function} deps.findUserById
 * @param {Function} deps.sendExportCompleteEmail
 * @param {Function} deps.buildDestinationPushLabel
 * @param {Function} deps.createPushError
 * @returns {object} { enrichGmcMerchantNames, executeGmcPush }
 */
function createGmcPush(deps) {
  const {
    getPrisma,
    fetch,
    crypto,
    getActivePlatformConnectionForPush,
    refreshGMCToken,
    filterItemsForDestinationActivation,
    getOptimizedContentForPlatform,
    translateItemsForDestination,
    findUserById,
    sendExportCompleteEmail,
    buildDestinationPushLabel,
    createPushError,
  } = deps;

  // Enrichit chaque option Merchant Center avec son nom lisible. `accounts/authinfo`
  // ne renvoie que les IDs ; on appelle accounts.get par compte (best-effort, en
  // parallèle) pour récupérer le nom. Un client avec plusieurs GMC voit ainsi
  // "Nom (ID)" au lieu d'un ID nu et peut choisir le bon compte.
  async function enrichGmcMerchantNames(options, accessToken) {
    if (!Array.isArray(options) || options.length === 0 || !accessToken) return options;
    await Promise.all(
      options.map(async (opt) => {
        if (!opt || opt.merchantName || !opt.merchantId) return;
        // Sous-compte d'un MCA : contexte d'appel = l'aggregator ; sinon le compte lui-même.
        const ctx = opt.aggregatorId || opt.merchantId;
        try {
          const res = await fetch(
            `https://shoppingcontent.googleapis.com/content/v2.1/${encodeURIComponent(ctx)}/accounts/${encodeURIComponent(opt.merchantId)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!res.ok) return;
          const data = await res.json();
          const name = String(data?.name || data?.displayName || '').trim();
          if (name) {
            opt.merchantName = name;
            opt.label = `${name} (${opt.merchantId})`;
          }
        } catch {
          // best-effort : on garde le fallback "Merchant Center {ID}" si l'appel échoue
        }
      })
    );
    return options;
  }

  async function executeGmcPush({ accountId, userId, feedId, destinationContext = null }) {
    const prisma = getPrisma();
    const conn = await getActivePlatformConnectionForPush(accountId, 'gmc');
    if (!conn) {
      throw createPushError('Google Merchant Center non connecté. Connectez votre compte d\'abord.', 400);
    }
    if (!conn.merchantid) {
      throw createPushError('Aucun Merchant Center ID trouvé. Reconnectez votre compte.', 400);
    }

    let accessToken = conn.accesstoken;
    if (conn.tokenexpiry && new Date(conn.tokenexpiry) < new Date()) {
      try {
        accessToken = await refreshGMCToken(conn);
      } catch (refreshErr) {
        throw createPushError('Token expiré et impossible de rafraîchir. Reconnectez Google Merchant Center.', 401, { reconnect: true });
      }
    }

    const legacyGoogleFilter = destinationContext
      ? ''
      : `AND (customfields->'_channelOverrides'->>'google' IS NULL OR customfields->'_channelOverrides'->>'google' != 'false')`;
    let items = await prisma.$queryRawUnsafe(
      `
        SELECT id, feedid AS "feedId", originid AS "originId", url, title,
               descriptionhtml AS "descriptionHtml", descriptiontext AS "descriptionText", imageurl AS "imageUrl",
               brand, sku, price, currency, inventory, customfields, gtin, mpn
        FROM "FeedItem"
        WHERE feedid = $1::text
          ${legacyGoogleFilter}
      `,
      feedId
    );
    const itemsBeforeDestFilter = items.length;
    items = await filterItemsForDestinationActivation(items, destinationContext);
    // Diag : si push retourne "Aucun produit à pousser" sans log applicatif,
    // on ne sait pas si le feed est vide en BDD, si le filter Google les a
    // exclus, ou si le filter destination a tout retiré. Log ces compteurs.
    console.log(`[gmc-push] account=${accountId} feed=${feedId} merchantId=${conn.merchantid} itemsAfterSqlFilter=${itemsBeforeDestFilter} itemsAfterDestActivation=${items.length} destinationContext=${destinationContext ? destinationContext.slug || destinationContext.id : 'default'}`);

    // Traduction par marché (v2) — best-effort.
    try {
      const { items: translated, stats } = await translateItemsForDestination(prisma, items, destinationContext, { prisma, accountId });
      items = translated;
      if (stats.quotaExceeded) {
        console.warn('[market-translation] gmc push : plafond IA texte atteint → contenu source (pas de traduction)');
      } else if (!stats.skipped) {
        console.log(`[market-translation] gmc push → ${destinationContext?.localeCode || stats.targetLanguage} : translated=${stats.translated} cached=${stats.cached} failed=${stats.failed}`);
      }
    } catch (translationErr) {
      console.warn('⚠️ Traduction marché ignorée (gmc push):', translationErr?.message);
    }

    if (!items || items.length === 0) {
      return {
        message: destinationContext
          ? `Aucun produit à pousser pour ${destinationContext.marketName || destinationContext.slug || 'cette destination'}`
          : 'Aucun produit à pousser',
        total: 0,
        succeeded: 0,
        failed: 0,
        destinationId: destinationContext?.id || null,
        destinationSlug: destinationContext?.slug || null,
      };
    }

    const merchantId = conn.merchantid;
    const targetCountry = destinationContext?.countryCode || destinationContext?.marketCode || 'FR';
    const contentLanguage = String(destinationContext?.languageCode || 'fr').toLowerCase();
    let succeeded = 0;
    let failed = 0;
    const errors = [];

    const batchSize = 50;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const entries = batch.map((item, idx) => buildGmcProductEntry(item, idx, {
        merchantId,
        contentLanguage,
        targetCountry,
        destinationId: destinationContext?.id || null,
        currencyCode: destinationContext?.currencyCode || null,
        getOptimizedContentForPlatform,
      }));

      try {
        const batchRes = await fetch(`https://shoppingcontent.googleapis.com/content/v2.1/products/batch`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ entries })
        });

        if (batchRes.ok) {
          const batchData = await batchRes.json();
          for (const entry of (batchData.entries || [])) {
            if (entry.errors && entry.errors.errors && entry.errors.errors.length > 0) {
              failed++;
              errors.push({ productId: batch[entry.batchId]?.id, errors: entry.errors.errors.map(e => e.message) });
            } else {
              succeeded++;
            }
          }
        } else {
          const errText = await batchRes.text();
          console.error('GMC batch error:', batchRes.status, errText);
          if (batchRes.status === 401) {
            await prisma.$executeRawUnsafe(`UPDATE "PlatformConnection" SET status = 'expired', updatedat = NOW() WHERE id = $1::text`, conn.id);
            throw createPushError('Token GMC expiré. Reconnectez votre compte.', 401, { reconnect: true });
          }
          failed += batch.length;
          errors.push({ batch: `${i}-${i + batch.length}`, error: errText.substring(0, 200) });
        }
      } catch (batchErr) {
        if (batchErr?.statusCode) {
          throw batchErr;
        }
        console.error('GMC batch fetch error:', batchErr);
        failed += batch.length;
        errors.push({ batch: `${i}-${i + batch.length}`, error: batchErr.message });
      }
    }

    const isMcaError = failed > 0 && succeeded === 0 && errors.some(e =>
      (Array.isArray(e.errors) && e.errors.some(msg => typeof msg === 'string' && msg.includes('products manager access'))) ||
      (typeof e.error === 'string' && e.error.includes('products manager access'))
    );

    const logId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "ExportLog" (id, accountid, feedid, platform, status, totalproducts, succeeded, failed, errormessage, createdat)
        VALUES ($1::text, $2::text, $3::text, 'gmc', $4::text, $5::int, $6::int, $7::int, $8::text, NOW())
      `,
      logId,
      accountId,
      feedId,
      failed > 0 ? 'partial' : 'success',
      items.length,
      succeeded,
      failed,
      errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null
    );

    try {
      const user = await findUserById(userId);
      if (user?.email) {
        sendExportCompleteEmail(user.email, `Feed ${feedId.substring(0, 8)}`, { succeeded, failed, total: items.length })
          .catch(e => console.warn('Email export non envoyé:', e.message));
      }
    } catch {}

    const destinationLabel = buildDestinationPushLabel(destinationContext);
    return {
      message: isMcaError
        ? `Compte MCA détecté : le compte Merchant Center sélectionné est un agrégateur. Reconnectez en choisissant un sous-compte enfant.`
        : `Push ${destinationLabel || 'Google Merchant Center'} terminé : ${succeeded} produits envoyés, ${failed} erreurs`,
      total: items.length,
      succeeded,
      failed,
      mcaError: isMcaError || undefined,
      errors: errors.slice(0, 10),
      logId,
      destinationId: destinationContext?.id || null,
      destinationSlug: destinationContext?.slug || null,
      targetCountry,
      contentLanguage,
    };
  }

  return { enrichGmcMerchantNames, executeGmcPush };
}

module.exports = {
  DEFAULT_GMC_CATEGORY,
  normalizeAvailabilityForGMC,
  normalizeConditionForGMC,
  parseGmcMerchantOptions,
  resolveGmcOfferId,
  buildGmcProductEntry,
  createGmcPush,
};

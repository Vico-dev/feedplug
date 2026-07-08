'use strict';

/**
 * domains/gmc/push.js — Domaine Google Merchant Center (GMC) push.
 *
 * MIGRATION Content API for Shopping v2.1 → Merchant API v1 (08/07/2026).
 * Content API v2.1 ferme le 18/08/2026 ; v1beta a été coupé le 28/02/2026, la
 * version live est donc `v1` sur `merchantapi.googleapis.com`.
 *
 * Changements structurants imposés par Merchant API :
 *  - `products.custombatch` (insert par lot) N'EXISTE PLUS. On envoie des
 *    `productInputs.insert` individuels, parallélisés (pool borné). insert = upsert.
 *  - Toute écriture produit exige un `dataSource` (query param). On résout — et si
 *    besoin crée — une source de données primaire de type API par compte (cache).
 *  - Les attributs produit (title, price, link, …) descendent dans un sous-objet
 *    `productAttributes`. `price` = `{ amountMicros, currencyCode }` (plus `value`).
 *    `availability`/`condition` = enums MAJUSCULES. `gtin` → `gtins[]`.
 *    `targetCountry` → `feedLabel`.
 *  - `accounts/authinfo` → `accounts.list` (GET /accounts/v1/accounts).
 *
 * Deux familles d'exports :
 *  1. Helpers PURS (testables sans réseau) : normalisation, mapping enums,
 *     conversion prix, construction du ProductInput, parsing accounts.list.
 *     `normalizeAvailabilityForGMC` / `normalizeConditionForGMC` restent en
 *     valeurs v2.1 minuscules car ré-utilisés par les chemins Amazon/Meta ;
 *     la conversion vers les enums Merchant API se fait au bord (to*ForMerchant).
 *  2. Factory `createGmcPush(deps)` (DI) : enrichGmcMerchantNames, executeGmcPush.
 */

// --- Endpoints Merchant API (constantes : faciles à ajuster si Google bouge) ---
const MERCHANT_API_BASE = 'https://merchantapi.googleapis.com';
const PRODUCTS_API_VERSION = 'v1';
const ACCOUNTS_API_VERSION = 'v1';
const DATASOURCES_API_VERSION = 'v1';
// Parallélisme des insert individuels (custombatch supprimé côté Merchant API).
const INSERT_CONCURRENCY = 15;

const DEFAULT_GMC_CATEGORY = 'Apparel & Accessories > Clothing';

/** Normalise la disponibilité vers les valeurs v2.1 (minuscules) — réutilisé Amazon/Meta. */
function normalizeAvailabilityForGMC(raw, inventory) {
  const s = (raw && String(raw).toLowerCase()) || '';
  if (s === 'in_stock' || s === 'preorder' || s === 'backorder') return s;
  if (s.includes('preorder') || s.includes('pre-order')) return 'preorder';
  if (s.includes('backorder') || s.includes('back-order')) return 'backorder';
  if (s.includes('in stock') || s.includes('instock') || s === 'in stock') return 'in_stock';
  if (inventory != null && parseInt(inventory, 10) > 0) return 'in_stock';
  return 'out_of_stock';
}

/** Normalise la condition vers les valeurs v2.1 : new, refurbished, used. */
function normalizeConditionForGMC(raw) {
  const s = (raw && String(raw).toLowerCase().trim()) || '';
  if (['new', 'refurbished', 'used'].includes(s)) return s;
  if (/neuf|new|nouveau|nuevo/i.test(s)) return 'new';
  if (/reconditionn|refurbished|recondition/i.test(s)) return 'refurbished';
  if (/usag|used|occasion|second/i.test(s)) return 'used';
  return 'new';
}

/**
 * Convertit une disponibilité v2.1 (in_stock, out_of_stock, preorder, backorder)
 * vers l'enum Merchant API (IN_STOCK, OUT_OF_STOCK, PREORDER, BACKORDER).
 */
function toMerchantAvailability(v21Value) {
  return String(v21Value || 'out_of_stock').toUpperCase();
}

/** Convertit une condition v2.1 (new/refurbished/used) vers l'enum Merchant API. */
function toMerchantCondition(v21Value) {
  return String(v21Value || 'new').toUpperCase();
}

/**
 * Prix Merchant API : `amountMicros` (entier en micro-unités, sous forme de string)
 * + `currencyCode`. 19.99 EUR → amountMicros "19990000". Renvoie null si pas de prix.
 */
function priceToAmountMicros(price) {
  if (price == null || price === '') return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return String(Math.round(n * 1e6));
}

/**
 * Parse la réponse `accounts.list` (Merchant API) en options Merchant Center
 * dédoublonnées. Chaque compte : `name` = "accounts/{id}", `accountName` = libellé.
 * Conserve la forme de sortie historique { merchantId, merchantName, aggregatorId, label }
 * pour ne pas casser les appelants (routes/platforms.js).
 */
function parseGmcMerchantOptions(accountsData) {
  const rawEntries = Array.isArray(accountsData?.accounts) ? accountsData.accounts : [];
  const seen = new Set();
  const options = [];

  for (const entry of rawEntries) {
    // name = "accounts/123456" → merchantId = "123456".
    const name = String(entry?.name || '').trim();
    const idFromName = name.includes('/') ? name.split('/').pop() : name;
    const merchantId = String(idFromName || entry?.merchantId || '').trim();
    if (!merchantId || seen.has(merchantId)) continue;
    seen.add(merchantId);

    const merchantName = String(
      entry?.accountName ||
      entry?.displayName ||
      entry?.name ||
      ''
    ).trim();

    options.push({
      merchantId,
      merchantName: merchantName && merchantName !== name ? merchantName : '',
      aggregatorId: '',
      label: (merchantName && merchantName !== name) ? `${merchantName} (${merchantId})` : `Merchant Center ${merchantId}`,
    });
  }

  return options;
}

/**
 * offerId GMC : COURT (≤50) ET UNIQUE. Si originid propre (≤50) on le garde ;
 * sinon fallback sur l'id FeedItem (UUID unique/stable). Inchangé vs v2.1.
 */
function resolveGmcOfferId(item) {
  const rawOriginId = (item.originid ?? item.originId ?? '').toString().trim();
  return ((rawOriginId && rawOriginId.length <= 50) ? rawOriginId : item.id.toString()).substring(0, 50);
}

/**
 * Construit le corps `ProductInput` (Merchant API) pour un FeedItem.
 * Remplace buildGmcProductEntry (qui produisait la forme custombatch v2.1).
 *
 * @param {object} item   - FeedItem (champs SQL bruts : originid, customfields, …).
 * @param {object} ctx
 * @param {string} ctx.contentLanguage
 * @param {string} ctx.feedLabel                    - ex-targetCountry (ex. 'FR').
 * @param {string|null} [ctx.destinationId]
 * @param {string|null} [ctx.currencyCode]          - devise de la destination (fallback prix).
 * @param {Function} ctx.getOptimizedContentForPlatform
 * @returns {object} ProductInput
 */
function buildProductInput(item, ctx) {
  const {
    contentLanguage,
    feedLabel,
    destinationId = null,
    currencyCode = null,
    getOptimizedContentForPlatform,
  } = ctx;

  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc', { destinationId: destinationId || null });
  const title = (optTitle || item.title || '').substring(0, 150);
  const description = (optDesc || '').replace(/<[^>]*>/g, '').substring(0, 5000);
  const availability = toMerchantAvailability(normalizeAvailabilityForGMC(cf.availability || cf.inventory, item.inventory));
  const condition = toMerchantCondition(normalizeConditionForGMC(item.condition || cf.condition));
  const googleProductCategory = (cf.google_product_category && String(cf.google_product_category).trim()) || DEFAULT_GMC_CATEGORY;

  const attributes = {
    title,
    description,
    link: item.url || cf.link || '',
    imageLink: (item.imageurl ?? item.imageUrl) || cf.image_link || '',
    availability,
    condition,
    brand: item.brand || cf.brand || '',
    googleProductCategory,
  };

  const amountMicros = priceToAmountMicros(item.price);
  if (amountMicros != null) {
    attributes.price = { amountMicros, currencyCode: item.currency || currencyCode || 'EUR' };
  }
  const gtin = item.gtin || cf.gtin || '';
  if (gtin) attributes.gtins = [String(gtin)];
  const mpn = item.mpn || cf.mpn || item.sku || '';
  if (mpn) attributes.mpn = String(mpn);

  return {
    offerId: resolveGmcOfferId(item),
    contentLanguage,
    feedLabel,
    productAttributes: attributes,
  };
}

/** Pool d'exécution à concurrence bornée (remplace le custombatch supprimé). */
async function runWithConcurrency(items, worker, concurrency) {
  let cursor = 0;
  const size = Math.max(1, Math.min(concurrency, items.length));
  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

/**
 * Factory DI : assemble les fonctions GMC qui dépendent d'état/closures du serveur.
 * Contrat de sortie inchangé vs l'implémentation v2.1 (mêmes clés de retour).
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

  // Cache dataSource par compte (merchantId → "accounts/{id}/dataSources/{ds}").
  const dataSourceCache = new Map();

  /**
   * Enrichit chaque option Merchant Center avec son nom lisible via accounts.get
   * (Merchant API). accounts.list renvoie déjà `accountName` la plupart du temps ;
   * ceci ne comble que les noms manquants. Best-effort.
   */
  async function enrichGmcMerchantNames(options, accessToken) {
    if (!Array.isArray(options) || options.length === 0 || !accessToken) return options;
    await Promise.all(
      options.map(async (opt) => {
        if (!opt || opt.merchantName || !opt.merchantId) return;
        try {
          const res = await fetch(
            `${MERCHANT_API_BASE}/accounts/${ACCOUNTS_API_VERSION}/accounts/${encodeURIComponent(opt.merchantId)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!res.ok) return;
          const data = await res.json();
          const name = String(data?.accountName || data?.displayName || '').trim();
          if (name) {
            opt.merchantName = name;
            opt.label = `${name} (${opt.merchantId})`;
          }
        } catch {
          // best-effort : on garde le fallback "Merchant Center {ID}"
        }
      })
    );
    return options;
  }

  /**
   * Résout la source de données primaire de type API du compte (obligatoire pour
   * productInputs.insert). Réutilise une source API primaire existante ; sinon en
   * crée une ("FeedPlug"). Cache par merchantId. Lève une createPushError explicite
   * si aucune source n'est disponible et que la création échoue.
   */
  async function resolveApiDataSource(merchantId, accessToken, { contentLanguage, feedLabel }) {
    if (dataSourceCache.has(merchantId)) return dataSourceCache.get(merchantId);
    const base = `${MERCHANT_API_BASE}/datasources/${DATASOURCES_API_VERSION}/accounts/${encodeURIComponent(merchantId)}/dataSources`;

    let name = null;
    try {
      const res = await fetch(base, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.ok) {
        const data = await res.json();
        const sources = Array.isArray(data?.dataSources) ? data.dataSources : [];
        // Source primaire produits alimentée par API.
        const apiPrimary = sources.find((s) => s && s.primaryProductDataSourceInput && s.input === 'API')
          || sources.find((s) => s && s.primaryProductDataSourceInput);
        if (apiPrimary?.name) name = apiPrimary.name;
      }
    } catch {
      // on tentera la création
    }

    if (!name) {
      const body = {
        displayName: 'FeedPlug API',
        primaryProductDataSourceInput: {},
      };
      // contentLanguages/countries n'acceptent qu'une valeur simple selon la source
      // de la doc ; on cible la langue/pays du push pour une source mono-cible.
      if (contentLanguage) body.primaryProductDataSourceInput.contentLanguage = contentLanguage;
      if (feedLabel) body.primaryProductDataSourceInput.feedLabel = feedLabel;
      const res = await fetch(base, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        name = data?.name || null;
      } else {
        const errText = await res.text().catch(() => '');
        throw createPushError(
          `Impossible de résoudre une source de données Merchant API (dataSource). Créez une source "API" dans Merchant Center puis relancez. Détail: ${errText.substring(0, 200)}`,
          502
        );
      }
    }

    if (name) dataSourceCache.set(merchantId, name);
    return name;
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
    console.log(`[gmc-push] account=${accountId} feed=${feedId} merchantId=${conn.merchantid} itemsAfterSqlFilter=${itemsBeforeDestFilter} itemsAfterDestActivation=${items.length} destinationContext=${destinationContext ? destinationContext.slug || destinationContext.id : 'default'}`);

    // Traduction par marché — best-effort.
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
    const feedLabel = targetCountry;
    const contentLanguage = String(destinationContext?.languageCode || 'fr').toLowerCase();

    // Source de données obligatoire pour toute écriture produit Merchant API.
    const dataSource = await resolveApiDataSource(merchantId, accessToken, { contentLanguage, feedLabel });

    let succeeded = 0;
    let failed = 0;
    const errors = [];
    let authError = null; // premier 401 rencontré → on arrête et on demande reconnexion.

    const insertUrl = `${MERCHANT_API_BASE}/products/${PRODUCTS_API_VERSION}/accounts/${encodeURIComponent(merchantId)}/productInputs:insert?dataSource=${encodeURIComponent(dataSource)}`;

    await runWithConcurrency(items, async (item) => {
      if (authError) return; // court-circuite le reste du pool après un 401.
      const productInput = buildProductInput(item, {
        contentLanguage,
        feedLabel,
        destinationId: destinationContext?.id || null,
        currencyCode: destinationContext?.currencyCode || null,
        getOptimizedContentForPlatform,
      });
      try {
        const res = await fetch(insertUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(productInput),
        });
        if (res.ok) {
          succeeded++;
        } else {
          const errText = await res.text().catch(() => '');
          if (res.status === 401 && !authError) {
            authError = errText || 'unauthorized';
            return;
          }
          failed++;
          errors.push({ productId: item.id, error: (errText || `HTTP ${res.status}`).substring(0, 200) });
        }
      } catch (insertErr) {
        failed++;
        errors.push({ productId: item.id, error: String(insertErr?.message || insertErr).substring(0, 200) });
      }
    }, INSERT_CONCURRENCY);

    if (authError) {
      await prisma.$executeRawUnsafe(`UPDATE "PlatformConnection" SET status = 'expired', updatedat = NOW() WHERE id = $1::text`, conn.id);
      throw createPushError('Token GMC expiré. Reconnectez votre compte.', 401, { reconnect: true });
    }

    const isMcaError = failed > 0 && succeeded === 0 && errors.some(e =>
      typeof e.error === 'string' && e.error.includes('products manager access')
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
  MERCHANT_API_BASE,
  PRODUCTS_API_VERSION,
  ACCOUNTS_API_VERSION,
  DATASOURCES_API_VERSION,
  DEFAULT_GMC_CATEGORY,
  normalizeAvailabilityForGMC,
  normalizeConditionForGMC,
  toMerchantAvailability,
  toMerchantCondition,
  priceToAmountMicros,
  parseGmcMerchantOptions,
  resolveGmcOfferId,
  buildProductInput,
  createGmcPush,
};

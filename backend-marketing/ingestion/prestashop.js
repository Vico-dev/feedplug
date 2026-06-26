const crypto = require('crypto');
const { XMLParser } = require('fast-xml-parser');
const { createRevision } = require('../lib/revisions');
const { analyzeProduct, enrichProduct } = require('../enrichment/auto-enrichment');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: true,
});

const PRESTASHOP_DEFAULT_MAPPING = {
  id: 'id',
  title: 'name',
  description: 'description_short',
  link: 'link_rewrite',
  image_link: 'id_default_image',
  additional_image_link: 'associations.images',
  brand: 'manufacturer_name',
  price: 'price',
  gtin: 'ean13',
  mpn: 'reference',
  availability: 'quantity',
  condition: 'condition',
  google_product_category: '',
  product_type: 'id_category_default',
  category: 'id_category_default',
  categories: 'associations.categories',
  color: 'features.color',
  size: 'features.size',
  material: 'features.material',
  pattern: 'features.pattern',
  gender: 'features.gender',
  age_group: 'features.age_group',
  meta_title: 'meta_title',
  meta_description: 'meta_description',
  supplier_reference: 'supplier_reference',
  isbn: 'isbn',
  upc: 'upc',
  ean13: 'ean13',
  weight: 'weight',
  width: 'width',
  height: 'height',
  depth: 'depth',
  visibility: 'visibility',
};

function computeHash(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function buildIngestionSnapshot(item, finalCustomFields, priceValue) {
  return {
    title: item.title || null,
    descriptionhtml: item.descriptionHtml || null,
    descriptiontext: item.descriptionText || null,
    imageurl: item.imageUrl || null,
    brand: item.brand || null,
    sku: item.sku || null,
    price: priceValue,
    currency: item.currency || null,
    inventory: item.inventory != null ? Number(item.inventory) : null,
    url: item.url || null,
    gtin: item.gtin || null,
    mpn: item.mpn || null,
    condition: item.condition || null,
    customfields: finalCustomFields || {},
  };
}

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildPrestashopPublicImageUrl(baseUrl, productId, imageId) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedImageId = String(imageId || '').trim();
  if (!normalizedBaseUrl || !productId || !normalizedImageId) return null;

  const imagePath = normalizedImageId.split('').join('/');
  return `${normalizedBaseUrl}/img/p/${imagePath}/${normalizedImageId}-large_default.jpg`;
}

function pickLanguageValue(value) {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object') return null;

  const languages = ensureArray(value.language);
  for (const language of languages) {
    if (typeof language === 'string' && language.trim()) return language.trim();
    if (language && typeof language === 'object') {
      const textValue = language['#text'] || language.__cdata || language['@_text'];
      if (typeof textValue === 'string' && textValue.trim()) return textValue.trim();
    }
  }

  return null;
}

function pickScalarValue(value) {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return null;

  if (typeof value.id === 'string' && value.id.trim()) return value.id.trim();
  if (typeof value['#text'] === 'string' && value['#text'].trim()) return value['#text'].trim();
  if (typeof value.__cdata === 'string' && value.__cdata.trim()) return value.__cdata.trim();

  return null;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseBooleanFlag(value) {
  const scalar = pickScalarValue(value);
  if (scalar == null) return null;
  if (scalar === '1' || /^true$/i.test(scalar)) return true;
  if (scalar === '0' || /^false$/i.test(scalar)) return false;
  return null;
}

function normalizeAvailability(inventory, active, availableForOrder) {
  if (typeof inventory === 'number') {
    return inventory > 0 ? 'in stock' : 'out of stock';
  }
  if (availableForOrder === false) return 'out of stock';
  if (active === false) return 'out of stock';
  return 'in stock';
}

function buildFeatureLookupAliases(name) {
  const normalized = normalizeKey(name);
  return new Set([
    normalized,
    normalized.replace(/^product_/, ''),
    normalized.replace(/^attribute_/, ''),
    normalized.replace(/^matiere$/, 'material'),
    normalized.replace(/^motif$/, 'pattern'),
    normalized.replace(/^couleur$/, 'color'),
    normalized.replace(/^taille$/, 'size'),
    normalized.replace(/^genre$/, 'gender'),
    normalized.replace(/^sexe$/, 'gender'),
    normalized.replace(/^age$/, 'age_group'),
    normalized.replace(/^tranche_d_age$/, 'age_group'),
  ]);
}

function applyMappedFeature(target, featureName, featureValue) {
  if (!featureName || !featureValue) return;
  const aliases = buildFeatureLookupAliases(featureName);
  if (aliases.has('color')) target.color = target.color || featureValue;
  if (aliases.has('size')) target.size = target.size || featureValue;
  if (aliases.has('material')) target.material = target.material || featureValue;
  if (aliases.has('pattern')) target.pattern = target.pattern || featureValue;
  if (aliases.has('gender')) target.gender = target.gender || featureValue;
  if (aliases.has('age_group')) target.age_group = target.age_group || featureValue;
}

async function fetchPrestashopXml({ baseUrl, apiKey, resourcePath }) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const authToken = Buffer.from(`${apiKey}:`).toString('base64');
  const url = `${normalizedBaseUrl}${resourcePath}`;

  // SSRF guard : baseUrl est fourni par le marchand — on refuse les IP
  // privées / metadata cloud (169.254.169.254 etc.).
  const { safeFetch } = require('../lib/safe-url');
  const response = await safeFetch(url, {
    headers: {
      Authorization: `Basic ${authToken}`,
      Accept: 'application/xml',
      Output_format: 'XML',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Prestashop API error ${response.status}: ${body.substring(0, 200)}`);
  }

  const xml = await response.text();
  return parser.parse(xml);
}

async function fetchPrestashopResourceById({ baseUrl, apiKey, resource, resourceId }) {
  if (!resourceId) return null;
  let response;
  try {
    response = await fetchPrestashopXml({
      baseUrl,
      apiKey,
      resourcePath: `/api/${resource}/${resourceId}`,
    });
  } catch (error) {
    const message = error?.message || '';
    if (/Prestashop API error 401/i.test(message) || /not available/i.test(message) || /Resource of type/i.test(message)) {
      console.warn(`⚠️ Ressource Prestashop indisponible: ${resource}/${resourceId} (${message})`);
      return null;
    }
    throw error;
  }
  const resourceKeyByName = {
    categories: 'category',
    product_features: 'product_feature',
    product_feature_values: 'product_feature_value',
  };
  return response?.prestashop?.[resourceKeyByName[resource] || resource.slice(0, -1)] || null;
}

async function buildPrestashopContext({ baseUrl, apiKey, products }) {
  const categoryIds = new Set();

  for (const product of products) {
    ensureArray(product?.associations?.categories?.category)
      .map((entry) => String(entry?.id || '').trim())
      .filter(Boolean)
      .forEach((id) => categoryIds.add(id));
  }

  const categoryEntries = await Promise.all(
    Array.from(categoryIds).map(async (categoryId) => {
      const category = await fetchPrestashopResourceById({ baseUrl, apiKey, resource: 'categories', resourceId: categoryId });
      return [categoryId, pickLanguageValue(category?.name) || null];
    })
  );

  return {
    categoriesById: Object.fromEntries(categoryEntries),
    featuresById: {},
    featureValuesById: {},
  };
}

async function fetchPrestashopActiveProductIds({ baseUrl, apiKey, pageSize = 100, limit = null }) {
  const activeProductIds = [];
  let offset = 0;

  while (true) {
    const page = await fetchPrestashopXml({
      baseUrl,
      apiKey,
      resourcePath: `/api/products?display=[id]&filter[active]=[1]&sort=[id_ASC]&limit=${offset},${pageSize}`,
    });

    const pageIds = ensureArray(page?.prestashop?.products?.product)
      .map((item) => String(item?.id || '').trim())
      .filter(Boolean);

    if (pageIds.length === 0) break;

    activeProductIds.push(...pageIds);
    if (limit && activeProductIds.length >= limit) {
      return activeProductIds.slice(0, limit);
    }
    if (pageIds.length < pageSize) break;

    offset += pageSize;
  }

  return activeProductIds;
}

async function fetchPrestashopProducts({ baseUrl, apiKey, limit = null }) {
  const activeProductIds = await fetchPrestashopActiveProductIds({ baseUrl, apiKey, limit });
  const productIds = limit ? activeProductIds.slice(0, limit) : activeProductIds;

  const products = [];
  const chunkSize = 10;
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize);
    const responses = await Promise.all(
      chunk.map((productId) =>
        fetchPrestashopXml({
          baseUrl,
          apiKey,
          resourcePath: `/api/products/${productId}`,
        })
      )
    );

    for (const response of responses) {
      const product = response?.prestashop?.product;
      if (product) {
        products.push(product);
      }
    }
  }

  return {
    products,
    activeProductIds,
    fetchedProductIds: productIds,
    truncated: Boolean(limit && activeProductIds.length > productIds.length),
  };
}

function prestashopProductToFeedItem(product, baseUrl, context = {}) {
  const productId = String(product.id || '').trim();
  const slug = pickLanguageValue(product.link_rewrite);
  const title = pickLanguageValue(product.name) || `Produit ${productId}`;
  const descriptionHtml = pickLanguageValue(product.description);
  const descriptionText = pickLanguageValue(product.description_short) || normalizeText(descriptionHtml);
  const defaultImageId =
    pickScalarValue(product.id_default_image)
    || String(ensureArray(product.associations?.images?.image)[0]?.id || '').trim()
    || null;
  const updatedAt = product.date_upd ? new Date(product.date_upd) : new Date();
  const price = product.price != null && product.price !== '' ? Number(product.price) : null;
  const inventory = product.quantity != null && product.quantity !== '' ? Number(product.quantity) : null;
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const publicImageUrl = buildPrestashopPublicImageUrl(normalizedBaseUrl, productId, defaultImageId);
  const active = parseBooleanFlag(product.active);
  const availableForOrder = parseBooleanFlag(product.available_for_order);
  const categoryIds = ensureArray(product.associations?.categories?.category)
    .map((entry) => String(entry?.id || '').trim())
    .filter(Boolean);
  const categoryNames = categoryIds
    .map((categoryId) => context.categoriesById?.[categoryId])
    .filter(Boolean);
  const defaultCategoryId = pickScalarValue(product.id_category_default);
  const defaultCategoryName = (defaultCategoryId && context.categoriesById?.[defaultCategoryId]) || categoryNames[0] || null;
  const additionalImageUrls = ensureArray(product.associations?.images?.image)
    .map((entry) => buildPrestashopPublicImageUrl(normalizedBaseUrl, productId, entry?.id))
    .filter(Boolean);

  const featureList = ensureArray(product.associations?.product_features?.product_feature)
    .map((entry) => {
      const featureId = String(entry?.id || '').trim();
      const featureValueId = String(entry?.id_feature_value || '').trim();
      const name = context.featuresById?.[featureId] || featureId || null;
      const value = context.featureValuesById?.[featureValueId] || featureValueId || null;
      return name && value ? { name, value } : null;
    })
    .filter(Boolean);

  const rawFeatureMap = {};
  const mappedFeatureFields = {};
  for (const feature of featureList) {
    rawFeatureMap[normalizeKey(feature.name)] = feature.value;
    applyMappedFeature(mappedFeatureFields, feature.name, feature.value);
  }

  const gtin = product.ean13 || product.upc || null;
  const mpn = product.reference || product.supplier_reference || null;
  const condition = pickScalarValue(product.condition) || 'new';
  const availability = normalizeAvailability(Number.isFinite(inventory) ? inventory : null, active, availableForOrder);
  const metaTitle = pickLanguageValue(product.meta_title);
  const metaDescription = pickLanguageValue(product.meta_description);
  const metaKeywords = pickLanguageValue(product.meta_keywords);
  const visibility = pickScalarValue(product.visibility);
  const tags = ensureArray(product.associations?.tags?.tag)
    .map((entry) => pickScalarValue(entry))
    .filter(Boolean);

  const customFields = {
    availability,
    condition,
    gtin,
    mpn,
    product_type: defaultCategoryName || null,
    category: defaultCategoryName || null,
    categories: categoryNames,
    category_ids: categoryIds,
    image_link: publicImageUrl,
    additional_image_links: additionalImageUrls.filter((url) => url !== publicImageUrl),
    meta_title: metaTitle,
    meta_description: metaDescription,
    meta_keywords: metaKeywords,
    visibility,
    tags,
    supplier_reference: pickScalarValue(product.supplier_reference),
    isbn: pickScalarValue(product.isbn),
    upc: pickScalarValue(product.upc),
    ean13: pickScalarValue(product.ean13),
    weight: pickScalarValue(product.weight),
    width: pickScalarValue(product.width),
    height: pickScalarValue(product.height),
    depth: pickScalarValue(product.depth),
    manufacturer_name: pickScalarValue(product.manufacturer_name),
    reference: pickScalarValue(product.reference),
    slug,
    active,
    available_for_order: availableForOrder,
    show_price: parseBooleanFlag(product.show_price),
    online_only: parseBooleanFlag(product.online_only),
    indexed: parseBooleanFlag(product.indexed),
    state: pickScalarValue(product.state),
    features: rawFeatureMap,
    _source: 'prestashop',
    _sourceConfig: {
      connector: 'PRESTASHOP',
      shopUrl: normalizedBaseUrl,
      productId,
    },
    ...mappedFeatureFields,
  };

  const item = {
    originId: productId,
    url: slug ? `${normalizedBaseUrl}/${productId}-${slug}.html` : null,
    title,
    descriptionHtml: descriptionHtml || null,
    descriptionText: descriptionText || null,
    imageUrl: publicImageUrl,
    brand: pickScalarValue(product.manufacturer_name),
    sku: product.reference || null,
    gtin,
    mpn,
    condition,
    price,
    currency: 'EUR',
    inventory: Number.isFinite(inventory) ? inventory : null,
    publishedAt: active !== false ? updatedAt : null,
    updatedAt,
    customFields,
  };

  item.contentHash = computeHash({
    title: item.title,
    descriptionHtml: item.descriptionHtml,
    descriptionText: item.descriptionText,
    imageUrl: item.imageUrl,
    brand: item.brand,
    sku: item.sku,
    gtin: item.gtin,
    mpn: item.mpn,
    condition: item.condition,
    price: item.price,
    inventory: item.inventory,
    customFields: item.customFields,
    updatedAt: updatedAt.toISOString(),
  });

  return item;
}

async function ingestPrestashopFromApi({ prisma, feed, shopUrl, apiKey }) {
  console.log(`🛒 Début ingestion Prestashop: ${shopUrl}`);

  const runId = crypto.randomUUID();
  const startedAtIso = new Date().toISOString();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "IngestionRun" (id, feedid, status, startedat)
    VALUES ($1::text, $2::text, $3::text, $4::timestamptz)
  `, runId, feed.id, 'RUNNING', startedAtIso);
  const run = { id: runId };

  try {
    const existingMapping = feed.mappingJson && typeof feed.mappingJson === 'object' ? feed.mappingJson : {};
    const mergedMapping = { ...PRESTASHOP_DEFAULT_MAPPING, ...existingMapping };
    if (Object.keys(mergedMapping).length !== Object.keys(existingMapping).length) {
      await prisma.$executeRawUnsafe(`
        UPDATE "Feed"
        SET mappingjson = $1::jsonb,
            updatedat = NOW()
        WHERE id = $2::text
      `, JSON.stringify(mergedMapping), feed.id);
      feed.mappingJson = mergedMapping;
    }

    const { products, activeProductIds, truncated } = await fetchPrestashopProducts({ baseUrl: shopUrl, apiKey });
    const prestashopContext = await buildPrestashopContext({ baseUrl: shopUrl, apiKey, products });
    console.log(`📦 ${products.length} produit(s) récupéré(s) depuis Prestashop`);

    // B5 — plafond d'ingestion synchrone (cf. PLAN_REMEDIATION_BLOQUANTS.md).
    const MAX_INGEST_PRODUCTS = Number(process.env.MAX_INGEST_PRODUCTS || 5000);
    if (products.length > MAX_INGEST_PRODUCTS) {
      const err = new Error(`Catalogue PrestaShop trop volumineux pour l'import synchrone : ${products.length} produits (max ${MAX_INGEST_PRODUCTS}). Contactez-nous pour activer l'import par lots.`);
      err.statusCode = 413;
      err.code = 'INGEST_TOO_LARGE';
      throw err;
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalDeleted = 0;

    // Sprint 2 (B-PROPER) — fix N+1 : préchargement en UNE requête des lignes
    // existantes de ce feed (indexées par originid), au lieu d'un SELECT par
    // produit dans la boucle. Lookup O(1) en mémoire ensuite.
    const existingByOriginId = new Map();
    try {
      const preRows = await prisma.$queryRawUnsafe(
        `SELECT id, contenthash, customfields, originid FROM "FeedItem" WHERE feedid = $1::text`,
        feed.id
      );
      for (const row of preRows || []) {
        if (row && row.originid != null) existingByOriginId.set(String(row.originid), row);
      }
      console.log(`📦 Préchargement Prestashop: ${existingByOriginId.size} produit(s) existant(s) (1 requête, N+1 supprimé)`);
    } catch (preErr) {
      console.warn('⚠️ Préchargement existants Prestashop échoué, fallback SELECT par produit:', preErr.message);
    }

    for (const rawProduct of products) {
      try {
        const item = prestashopProductToFeedItem(rawProduct, shopUrl, prestashopContext);
        const analysisInput = {
          ...item,
          customFields: item.customFields,
        };
        let finalCustomFields = item.customFields;
        try {
          const analysis = analyzeProduct(analysisInput);
          if (Object.keys(analysis.enrichments || {}).length > 0) {
            finalCustomFields = enrichProduct(analysisInput, analysis.enrichments).customFields;
          }
        } catch (enrichmentError) {
          console.warn('⚠️ Enrichissement auto Prestashop ignoré:', enrichmentError.message);
        }

        // Sprint 2 : lookup O(1) sur le préchargement ; fallback SELECT unitaire
        // seulement si le préchargement a échoué (Map vide).
        let existing = existingByOriginId.get(String(item.originId)) || null;
        if (!existing && existingByOriginId.size === 0) {
          const existingRows = await prisma.$queryRawUnsafe(`
            SELECT id, contenthash, customfields
            FROM "FeedItem"
            WHERE feedid = $1::text AND originid = $2::text
            LIMIT 1
          `, feed.id, item.originId);
          existing = existingRows?.[0] || null;
        }
        const itemNow = new Date().toISOString();
        const priceValue = item.price != null ? Number(item.price) : null;
        const customFieldsJson = JSON.stringify(finalCustomFields || {});
        const finalContentHash = computeHash({
          title: item.title,
          descriptionHtml: item.descriptionHtml,
          descriptionText: item.descriptionText,
          imageUrl: item.imageUrl,
          brand: item.brand,
          sku: item.sku,
          gtin: item.gtin,
          mpn: item.mpn,
          condition: item.condition,
          price: item.price,
          inventory: item.inventory,
          customFields: finalCustomFields,
          updatedAt: item.updatedAt.toISOString(),
        });

        if (existing) {
          if (existing.contenthash !== finalContentHash) {
            await prisma.$executeRawUnsafe(`
              UPDATE "FeedItem"
              SET url = $1::text,
                  title = $2::text,
                  descriptionhtml = $3::text,
                  descriptiontext = $4::text,
                  imageurl = $5::text,
                  brand = $6::text,
                  sku = $7::text,
                  gtin = $8::text,
                  mpn = $9::text,
                  condition = $10::text,
                  price = $11::numeric,
                  currency = $12::text,
                  inventory = $13::int,
                  publishedat = $14::timestamptz,
                  updatedat = $15::timestamptz,
                  contenthash = $16::text,
                  customfields = $17::jsonb
              WHERE id = $18::text
            `,
            item.url || null,
            item.title || item.originId,
            item.descriptionHtml || null,
            item.descriptionText || null,
            item.imageUrl || null,
            item.brand || null,
            item.sku || null,
            item.gtin || null,
            item.mpn || null,
            item.condition || null,
            priceValue,
            item.currency || null,
            item.inventory != null ? Number(item.inventory) : null,
            item.publishedAt ? item.publishedAt.toISOString() : null,
            itemNow,
            finalContentHash,
            customFieldsJson,
            existing.id);
            try {
              await createRevision(prisma, existing.id, buildIngestionSnapshot(item, finalCustomFields, priceValue), 'ingestion');
            } catch (revisionError) {
              console.warn('⚠️ Révision ingestion Prestashop (update) non créée:', revisionError.message);
            }
            totalUpdated += 1;
          } else {
            totalSkipped += 1;
          }
        } else {
          const createdId = crypto.randomUUID();
          await prisma.$executeRawUnsafe(`
            INSERT INTO "FeedItem" (id, feedid, originid, url, title, descriptionhtml, descriptiontext, imageurl, brand, sku, gtin, mpn, condition, price, currency, inventory, publishedat, updatedat, contenthash, createdat, customfields)
            VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, $9::text, $10::text, $11::text, $12::text, $13::text, $14::numeric, $15::text, $16::int, $17::timestamptz, $18::timestamptz, $19::text, $20::timestamptz, $21::jsonb)
          `,
          createdId,
          feed.id,
          item.originId,
          item.url || null,
          item.title || item.originId,
          item.descriptionHtml || null,
          item.descriptionText || null,
          item.imageUrl || null,
          item.brand || null,
          item.sku || null,
          item.gtin || null,
          item.mpn || null,
          item.condition || null,
          priceValue,
          item.currency || null,
          item.inventory != null ? Number(item.inventory) : null,
          item.publishedAt ? item.publishedAt.toISOString() : null,
          itemNow,
          finalContentHash,
          itemNow,
          customFieldsJson);
          try {
            await createRevision(prisma, createdId, buildIngestionSnapshot(item, finalCustomFields, priceValue), 'ingestion');
          } catch (revisionError) {
            console.warn('⚠️ Révision ingestion Prestashop (create) non créée:', revisionError.message);
          }
          totalInserted += 1;
        }
      } catch (itemError) {
        totalSkipped += 1;
        console.warn('⚠️ Produit Prestashop ignoré:', itemError?.message || String(itemError));
      }
    }

    if (!truncated) {
      const existingFeedItems = await prisma.feedItem.findMany({
        where: { feedId: feed.id },
        select: { id: true, originId: true },
      });
      const activeIdSet = new Set(activeProductIds);
      const staleItems = existingFeedItems.filter((item) => !activeIdSet.has(String(item.originId)));

      for (const staleItem of staleItems) {
        await prisma.feedItem.delete({ where: { id: staleItem.id } });
      }
      totalDeleted = staleItems.length;

      if (staleItems.length > 0) {
        console.log(`🧹 ${staleItems.length} produit(s) inactif(s) retiré(s) du feed Prestashop`);
      }
    } else {
      console.warn('⚠️ Catalogue Prestashop tronqué à la limite de récupération; purge des inactifs ignorée pour éviter une suppression incorrecte.');
    }

    await prisma.$executeRawUnsafe(`
      UPDATE "IngestionRun"
      SET status = $1::text,
          finishedat = $2::timestamptz,
          totalfetched = $3::int,
          totalinserted = $4::int,
          totalupdated = $5::int,
          totalskipped = $6::int
      WHERE id = $7::text
    `, 'SUCCESS', new Date().toISOString(), products.length, totalInserted, totalUpdated, totalSkipped, run.id);

    return {
      runId: run.id,
      totalFetched: products.length,
      totalInserted,
      totalUpdated,
      totalSkipped,
      totalDeleted,
    };
  } catch (error) {
    await prisma.$executeRawUnsafe(`
      UPDATE "IngestionRun"
      SET status = $1::text,
          finishedat = $2::timestamptz,
          errormessage = $3::text
      WHERE id = $4::text
    `, 'FAILED', new Date().toISOString(), error.message, run.id);
    throw error;
  }
}

module.exports = {
  fetchPrestashopProducts,
  ingestPrestashopFromApi,
};

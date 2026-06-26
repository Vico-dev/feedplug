const crypto = require('crypto');
const { createRevision } = require('../lib/revisions');
const { buildShopifyAdminGraphqlUrl } = require('../domains/shopify/config');

function computeHash(obj) {
  const serialized = JSON.stringify(obj);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function stripHtmlTags(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toFiniteNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeShopifyStatus(status) {
  return String(status || '').trim().toUpperCase();
}

function buildRevisionSnapshot(item) {
  return {
    title: item.title || null,
    descriptionhtml: item.descriptionHtml || null,
    descriptiontext: item.descriptionText || null,
    imageurl: item.imageUrl || null,
    brand: item.brand || null,
    sku: item.sku || null,
    price: item.price != null ? Number(item.price) : null,
    currency: item.currency || null,
    inventory: item.inventory != null ? Number(item.inventory) : null,
    url: item.url || null,
    gtin: null,
    mpn: null,
    condition: null,
    customfields: {},
  };
}

function buildVariantNodeFromWebhookPayload(variant) {
  return {
    id: variant?.admin_graphql_api_id || `gid://shopify/ProductVariant/${variant?.id}`,
    title: variant?.title || null,
    sku: variant?.sku || null,
    price: variant?.price || null,
    compareAtPrice: variant?.compare_at_price || null,
    inventoryQuantity: variant?.inventory_quantity ?? 0,
    availableForSale: typeof variant?.inventory_quantity === 'number'
      ? variant.inventory_quantity > 0
      : null,
  };
}

function buildImageNodeFromWebhookPayload(image) {
  return {
    id: image?.admin_graphql_api_id || (image?.id ? `gid://shopify/ProductImage/${image.id}` : null),
    url: image?.src || image?.url || null,
    altText: image?.alt || image?.altText || null,
  };
}

function normalizeProductNode(rawProduct) {
  const product = rawProduct || {};
  const variants = Array.isArray(product?.variants?.edges)
    ? product.variants.edges.map((edge) => edge?.node).filter(Boolean)
    : [];
  const images = Array.isArray(product?.images?.edges)
    ? product.images.edges.map((edge) => edge?.node).filter(Boolean)
    : [];
  const tags = Array.isArray(product.tags)
    ? product.tags
    : String(product.tags || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

  return {
    id: product.id,
    title: product.title || '',
    handle: product.handle || '',
    descriptionText: product.description || stripHtmlTags(product.descriptionHtml || product.bodyHtml || product.body_html || ''),
    descriptionHtml: product.descriptionHtml || product.bodyHtml || product.body_html || null,
    vendor: product.vendor || null,
    productType: product.productType || product.product_type || null,
    tags,
    status: normalizeShopifyStatus(product.status),
    createdAt: product.createdAt || product.created_at || product.updatedAt || product.updated_at || new Date().toISOString(),
    updatedAt: product.updatedAt || product.updated_at || new Date().toISOString(),
    variants,
    images,
  };
}

function expandProductNodeToRecords(rawProduct) {
  const product = normalizeProductNode(rawProduct);
  const records = [];
  const primaryImageUrl = product.images[0]?.url || null;

  if (!product.handle || !product.id) {
    return records;
  }

  if (product.variants.length === 0) {
    records.push({
      productId: product.id,
      title: product.title,
      handle: product.handle,
      description: product.descriptionText,
      descriptionHtml: product.descriptionHtml,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      sku: null,
      price: null,
      currency: null,
      inventory: null,
      variantId: null,
      variantTitle: null,
      imageUrl: primaryImageUrl,
    });
    return records;
  }

  for (const variant of product.variants) {
    records.push({
      productId: product.id,
      variantId: variant.id,
      title: product.title,
      variantTitle: variant.title && variant.title !== 'Default Title' ? variant.title : null,
      handle: product.handle,
      description: product.descriptionText,
      descriptionHtml: product.descriptionHtml,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: variant.updatedAt || product.updatedAt,
      sku: variant.sku || null,
      price: toFiniteNumber(variant.price),
      currency: 'EUR',
      inventory: toFiniteNumber(variant.inventoryQuantity) ?? 0,
      imageUrl: primaryImageUrl,
    });
  }

  return records;
}

function buildProductNodeFromWebhookPayload(payload) {
  return {
    id: payload?.admin_graphql_api_id || `gid://shopify/Product/${payload?.id}`,
    title: payload?.title || '',
    handle: payload?.handle || '',
    description: stripHtmlTags(payload?.body_html || ''),
    descriptionHtml: payload?.body_html || null,
    vendor: payload?.vendor || null,
    productType: payload?.product_type || null,
    tags: typeof payload?.tags === 'string'
      ? payload.tags.split(',').map((entry) => entry.trim()).filter(Boolean)
      : payload?.tags,
    status: payload?.status || '',
    createdAt: payload?.created_at || payload?.updated_at || new Date().toISOString(),
    updatedAt: payload?.updated_at || new Date().toISOString(),
    variants: {
      edges: Array.isArray(payload?.variants)
        ? payload.variants.map((variant) => ({ node: buildVariantNodeFromWebhookPayload(variant) }))
        : [],
    },
    images: {
      edges: Array.isArray(payload?.images)
        ? payload.images.map((image) => ({ node: buildImageNodeFromWebhookPayload(image) }))
        : [],
    },
  };
}

function shouldUseFullSyncForWebhookPayload(payload) {
  const variants = Array.isArray(payload?.variants) ? payload.variants : [];
  const variantGids = Array.isArray(payload?.variant_gids) ? payload.variant_gids : [];
  return variantGids.length > variants.length;
}

// Récupérer tous les produits Shopify via GraphQL (avec pagination)
async function fetchAllShopifyProducts({ shop, accessToken, limit = 250, maxItems = null }) {
  const allProducts = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const query = `
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              handle
              description
              descriptionHtml
              vendor
              productType
              tags
              status
              createdAt
              updatedAt
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    compareAtPrice
                    inventoryQuantity
                    availableForSale
                    updatedAt
                  }
                }
              }
              images(first: 10) {
                edges {
                  node {
                    id
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = { first: limit };
    if (cursor) variables.after = cursor;

    const response = await fetch(buildShopifyAdminGraphqlUrl(shop), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const products = data.data?.products;
    if (!products) {
      throw new Error('No products data in Shopify response');
    }

    for (const edge of products.edges) {
      const records = expandProductNodeToRecords(edge.node);
      allProducts.push(...records);
      if (maxItems && allProducts.length >= maxItems) {
        return allProducts.slice(0, maxItems);
      }
    }

    hasNextPage = products.pageInfo?.hasNextPage || false;
    cursor = products.pageInfo?.endCursor || null;
  }

  return allProducts;
}

// Transformer un produit Shopify en FeedItem
function shopifyProductToFeedItem(product, shop) {
  const domain = shop.replace(/\.myshopify\.com$/, '');
  const url = `https://${domain}.myshopify.com/products/${product.handle}`;
  const title = product.variantTitle ? `${product.title} - ${product.variantTitle}` : product.title;
  const originId = product.variantId || product.productId;
  const contentHash = computeHash({
    title,
    sku: product.sku,
    price: product.price,
    description: product.description,
    imageUrl: product.imageUrl,
    updatedAt: product.updatedAt,
    inventory: product.inventory,
    url,
  });

  return {
    originId: String(originId).replace(/^gid:\/\/shopify\//, ''),
    url,
    title,
    descriptionHtml: product.descriptionHtml || null,
    descriptionText: product.description || null,
    imageUrl: product.imageUrl || null,
    brand: product.vendor || null,
    sku: product.sku || null,
    price: product.price,
    currency: product.currency || 'EUR',
    inventory: product.inventory !== null ? parseInt(product.inventory, 10) : null,
    publishedAt: normalizeShopifyStatus(product.status) === 'ACTIVE' ? new Date(product.updatedAt) : null,
    updatedAt: new Date(product.updatedAt),
    contentHash,
  };
}

async function persistShopifyFeedItems({ prisma, feedId, items, existingRows }) {
  const existingByOriginId = new Map((existingRows || []).map((row) => [row.originId, row]));
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const item of items) {
    const existing = existingByOriginId.get(item.originId);
    if (existing) {
      if (existing.contentHash !== item.contentHash || existing.url !== item.url) {
        await prisma.feedItem.update({
          where: { id: existing.id },
          data: {
            ...item,
            updatedAt: new Date(),
          },
        });
        try {
          await createRevision(prisma, existing.id, buildRevisionSnapshot(item), 'ingestion');
        } catch (revErr) {
          console.warn('⚠️ Révision ingestion (update) non créée:', revErr.message);
        }
        totalUpdated++;
      } else {
        totalSkipped++;
      }
      continue;
    }

    const created = await prisma.feedItem.create({
      data: {
        feedId,
        ...item,
        createdAt: new Date(),
      },
    });
    try {
      await createRevision(prisma, created.id, buildRevisionSnapshot(item), 'ingestion');
    } catch (revErr) {
      console.warn('⚠️ Révision ingestion (insert) non créée:', revErr.message);
    }
    totalInserted++;
  }

  return { totalInserted, totalUpdated, totalSkipped };
}

async function deleteFeedItemsByIds(prisma, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 0;
  }

  let totalDeleted = 0;
  const chunkSize = 500;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const result = await prisma.feedItem.deleteMany({
      where: {
        id: { in: chunk },
      },
    });
    totalDeleted += result.count || 0;
  }

  return totalDeleted;
}

async function recalculateQualityScores(prisma, feedId, originIds = null) {
  try {
    const { updateQualityScore } = require('../scoring/quality');
    const customColumns = [];
    const where = { feedId };
    if (Array.isArray(originIds) && originIds.length > 0) {
      where.originId = { in: originIds };
    }
    const items = await prisma.feedItem.findMany({ where });
    for (const item of items) {
      try {
        await updateQualityScore(prisma, item.id, item, customColumns);
      } catch (scoreError) {
        console.error(`Error updating score for item ${item.id}:`, scoreError);
      }
    }
  } catch (scoreError) {
    console.error('Error updating scores after Shopify ingestion:', scoreError);
  }
}

async function ingestShopifyProductFromWebhook({ prisma, feed, shop, payload }) {
  const records = expandProductNodeToRecords(buildProductNodeFromWebhookPayload(payload));
  const items = records.map((record) => shopifyProductToFeedItem(record, shop));
  if (items.length === 0) {
    return {
      totalFetched: 0,
      totalInserted: 0,
      totalUpdated: 0,
      totalSkipped: 0,
      totalDeleted: 0,
    };
  }

  const feedId = feed.id;
  const currentOriginIds = items.map((item) => item.originId);
  const currentUrl = items[0]?.url || null;
  const baseRows = await prisma.feedItem.findMany({
    where: {
      feedId,
      OR: [
        { originId: { in: currentOriginIds } },
        ...(currentUrl ? [{ url: currentUrl }] : []),
      ],
    },
    select: {
      id: true,
      originId: true,
      url: true,
      contentHash: true,
    },
  });

  const candidateUrls = Array.from(new Set([
    ...baseRows.map((row) => row.url).filter(Boolean),
    ...(currentUrl ? [currentUrl] : []),
  ]));

  const relatedRows = candidateUrls.length > 0
    ? await prisma.feedItem.findMany({
        where: {
          feedId,
          url: { in: candidateUrls },
        },
        select: {
          id: true,
          originId: true,
          url: true,
          contentHash: true,
        },
      })
    : baseRows;

  const persistResult = await persistShopifyFeedItems({
    prisma,
    feedId,
    items,
    existingRows: relatedRows,
  });

  const currentOriginIdSet = new Set(currentOriginIds);
  const staleIds = relatedRows
    .filter((row) => !currentOriginIdSet.has(row.originId))
    .map((row) => row.id);
  const totalDeleted = await deleteFeedItemsByIds(prisma, staleIds);

  await recalculateQualityScores(prisma, feedId, currentOriginIds);

  const finishedAt = new Date();
  await prisma.feedSource.update({
    where: { id: feed.sourceId || feed.sourceid },
    data: { lastRunAt: finishedAt },
  });

  return {
    totalFetched: items.length,
    totalInserted: persistResult.totalInserted,
    totalUpdated: persistResult.totalUpdated,
    totalSkipped: persistResult.totalSkipped,
    totalDeleted,
  };
}

// Ingestion principale Shopify
async function ingestShopifyFromApi({ prisma, feed, shop, accessToken }) {
  console.log(`🛍️  Début ingestion Shopify: ${shop}`);

  const runId = crypto.randomUUID();
  const startedAtIso = new Date().toISOString();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "IngestionRun" (id, feedid, status, startedat)
      VALUES ($1::text, $2::text, $3::text, $4::timestamptz)
    `,
    runId,
    feed.id,
    'RUNNING',
    startedAtIso
  );

  try {
    const shopifyProducts = await fetchAllShopifyProducts({ shop, accessToken });
    console.log(`📦 ${shopifyProducts.length} produits/variants récupérés de Shopify`);

    // B5 — plafond d'ingestion synchrone (cf. PLAN_REMEDIATION_BLOQUANTS.md).
    const MAX_INGEST_PRODUCTS = Number(process.env.MAX_INGEST_PRODUCTS || 5000);
    if (shopifyProducts.length > MAX_INGEST_PRODUCTS) {
      const err = new Error(`Catalogue Shopify trop volumineux pour l'import synchrone : ${shopifyProducts.length} produits/variants (max ${MAX_INGEST_PRODUCTS}). Contactez-nous pour activer l'import par lots.`);
      err.statusCode = 413;
      err.code = 'INGEST_TOO_LARGE';
      throw err;
    }

    const items = shopifyProducts.map((product) => shopifyProductToFeedItem(product, shop));
    const existingRows = await prisma.feedItem.findMany({
      where: { feedId: feed.id },
      select: {
        id: true,
        originId: true,
        url: true,
        contentHash: true,
      },
    });

    const persistResult = await persistShopifyFeedItems({
      prisma,
      feedId: feed.id,
      items,
      existingRows,
    });

    const seenOriginIds = new Set(items.map((item) => item.originId));
    const staleIds = existingRows
      .filter((row) => !seenOriginIds.has(row.originId))
      .map((row) => row.id);
    const totalDeleted = await deleteFeedItemsByIds(prisma, staleIds);

    await recalculateQualityScores(prisma, feed.id);

    const finishedAt = new Date();
    await prisma.$executeRawUnsafe(
      `
        UPDATE "IngestionRun"
        SET status = $1::text,
            finishedat = $2::timestamptz,
            totalfetched = $3::int,
            totalinserted = $4::int,
            totalupdated = $5::int,
            totalskipped = $6::int
        WHERE id = $7::text
      `,
      'SUCCESS',
      finishedAt.toISOString(),
      shopifyProducts.length,
      persistResult.totalInserted,
      persistResult.totalUpdated,
      persistResult.totalSkipped,
      runId
    );

    await prisma.feedSource.update({
      where: { id: feed.sourceId },
      data: { lastRunAt: finishedAt },
    });

    console.log(
      `✅ Ingestion Shopify terminée: ${persistResult.totalInserted} insérés, ${persistResult.totalUpdated} mis à jour, ${persistResult.totalSkipped} ignorés, ${totalDeleted} supprimés`
    );

    return {
      runId,
      totalFetched: shopifyProducts.length,
      totalInserted: persistResult.totalInserted,
      totalUpdated: persistResult.totalUpdated,
      totalSkipped: persistResult.totalSkipped,
      totalDeleted,
    };
  } catch (error) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "IngestionRun"
        SET status = $1::text,
            finishedat = $2::timestamptz,
            errormessage = $3::text
        WHERE id = $4::text
      `,
      'FAILED',
      new Date().toISOString(),
      error?.message || String(error),
      runId
    );
    throw error;
  }
}

module.exports = {
  fetchAllShopifyProducts,
  ingestShopifyFromApi,
  ingestShopifyProductFromWebhook,
  shouldUseFullSyncForWebhookPayload,
  _internals: {
    buildProductNodeFromWebhookPayload,
    expandProductNodeToRecords,
    shopifyProductToFeedItem,
  },
};

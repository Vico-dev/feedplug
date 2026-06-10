const SHOPIFY_ADMIN_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2026-04';
const SHOPIFY_CATALOG_SCOPES = 'read_products';
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || SHOPIFY_CATALOG_SCOPES;

function normalizeShopifyShop(shop) {
  const normalized = String(shop || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/\.myshopify\.com$/i, '');

  if (!normalized || !/^[a-z0-9-]+$/i.test(normalized)) {
    return '';
  }

  return `${normalized}.myshopify.com`;
}

function buildShopifyAdminGraphqlUrl(shop) {
  const normalizedShop = normalizeShopifyShop(shop);
  if (!normalizedShop) {
    throw new Error(`Domaine Shopify invalide: ${shop}`);
  }
  return `https://${normalizedShop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
}

module.exports = {
  SHOPIFY_ADMIN_API_VERSION,
  SHOPIFY_CATALOG_SCOPES,
  SHOPIFY_SCOPES,
  normalizeShopifyShop,
  buildShopifyAdminGraphqlUrl,
};

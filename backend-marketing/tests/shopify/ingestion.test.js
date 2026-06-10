const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldUseFullSyncForWebhookPayload,
  _internals,
} = require('../../ingestion/shopify');

test('shouldUseFullSyncForWebhookPayload bascule en full sync quand le payload variants est tronqué', () => {
  assert.equal(
    shouldUseFullSyncForWebhookPayload({
      variants: [{ id: 1 }],
      variant_gids: [
        { admin_graphql_api_id: 'gid://shopify/ProductVariant/1' },
        { admin_graphql_api_id: 'gid://shopify/ProductVariant/2' },
      ],
    }),
    true
  );

  assert.equal(
    shouldUseFullSyncForWebhookPayload({
      variants: [{ id: 1 }],
      variant_gids: [{ admin_graphql_api_id: 'gid://shopify/ProductVariant/1' }],
    }),
    false
  );
});

test('buildProductNodeFromWebhookPayload + expandProductNodeToRecords conservent les infos variantes', () => {
  const payload = {
    id: 788032119674292922,
    admin_graphql_api_id: 'gid://shopify/Product/788032119674292922',
    title: 'Example T-Shirt',
    body_html: '<p>An example T-Shirt</p>',
    handle: 'example-t-shirt',
    product_type: 'Shirts',
    vendor: 'Acme',
    status: 'active',
    created_at: '2026-06-10T09:00:00Z',
    updated_at: '2026-06-10T10:00:00Z',
    tags: 'example, mens, t-shirt',
    variants: [
      {
        id: 642667041472713922,
        admin_graphql_api_id: 'gid://shopify/ProductVariant/642667041472713922',
        title: 'Small',
        price: '19.99',
        sku: 'SKU-S',
        inventory_quantity: 75,
      },
      {
        id: 757650484644203962,
        admin_graphql_api_id: 'gid://shopify/ProductVariant/757650484644203962',
        title: 'Medium',
        price: '21.50',
        sku: 'SKU-M',
        inventory_quantity: 50,
      },
    ],
    images: [{ id: 1, src: 'https://cdn.shopify.com/example-shirt.jpg', alt: 'Example shirt' }],
  };

  const node = _internals.buildProductNodeFromWebhookPayload(payload);
  const records = _internals.expandProductNodeToRecords(node);
  const feedItem = _internals.shopifyProductToFeedItem(records[0], 'demo.myshopify.com');

  assert.equal(records.length, 2);
  assert.equal(records[0].variantId, 'gid://shopify/ProductVariant/642667041472713922');
  assert.equal(records[0].inventory, 75);
  assert.equal(records[0].description, 'An example T-Shirt');
  assert.deepEqual(records[0].tags, ['example', 'mens', 't-shirt']);
  assert.equal(feedItem.originId, 'ProductVariant/642667041472713922');
  assert.equal(feedItem.url, 'https://demo.myshopify.com/products/example-t-shirt');
  assert.equal(feedItem.publishedAt instanceof Date, true);
});

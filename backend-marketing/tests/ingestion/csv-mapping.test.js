const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildNormalizedRow,
  getFirstNonEmptyValue,
  getRowValueCaseInsensitive,
  mapRowToItem,
  normalizeColumnName,
} = require('../../ingestion/csv-mapping');

test('normalizeColumnName strips BOM and normalizes casing', () => {
  assert.equal(normalizeColumnName('\uFEFF Title '), 'title');
});

test('buildNormalizedRow keeps the first meaningful value for duplicated logical columns', () => {
  const row = buildNormalizedRow({
    '\uFEFFTitle': 'Produit A',
    title: '',
    SKU: 'SKU-001',
  });

  assert.deepEqual(row, {
    title: 'Produit A',
    sku: 'SKU-001',
  });
});

test('getRowValueCaseInsensitive and mapRowToItem support case-insensitive mappings', () => {
  const row = buildNormalizedRow({
    ID: '123',
    Title: 'Produit test',
    LINK: 'https://example.com/p/123',
  });

  assert.equal(getRowValueCaseInsensitive(row, ['title']), 'Produit test');
  assert.deepEqual(
    mapRowToItem(row, { sku: 'id', title: 'TITLE', url: 'link' }),
    { sku: '123', title: 'Produit test', url: 'https://example.com/p/123' }
  );
});

test('getFirstNonEmptyValue provides a last-resort identifier', () => {
  assert.equal(getFirstNonEmptyValue({ title: '', url: '', gtin: 'GTIN-42' }), 'GTIN-42');
});

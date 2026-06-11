const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LIA_HEADERS,
  normalizeStoreCode,
  validateStoreInput,
  validateInventoryRows,
  availabilityFromQuantity,
  formatLiaPrice,
  buildLiaRows,
} = require('../../lib/local-inventory');

test('normalizeStoreCode accepte les codes valides et rejette le reste', () => {
  assert.equal(normalizeStoreCode('  PARIS_01 '), 'PARIS_01');
  assert.equal(normalizeStoreCode('store-42'), 'store-42');
  assert.equal(normalizeStoreCode(''), null);
  assert.equal(normalizeStoreCode('code avec espaces'), null);
  assert.equal(normalizeStoreCode('a'.repeat(65)), null);
  assert.equal(normalizeStoreCode(undefined), null);
});

test('validateStoreInput normalise nom et adresse, refuse un storeCode invalide', () => {
  const ok = validateStoreInput({ storeCode: 'LYON_02', name: '  Boutique Lyon  ', address: '12 rue de la Ré' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { storeCode: 'LYON_02', name: 'Boutique Lyon', address: '12 rue de la Ré' });

  const sansNom = validateStoreInput({ storeCode: 'LYON_02' });
  assert.equal(sansNom.ok, true);
  assert.equal(sansNom.value.name, null);

  const ko = validateStoreInput({ storeCode: 'code invalide !' });
  assert.equal(ko.ok, false);
  assert.match(ko.error, /storeCode invalide/);
});

test('validateInventoryRows valide et normalise un lot correct', () => {
  const result = validateInventoryRows([
    { storeCode: 'PARIS_01', offerId: 'SKU-1', quantity: 5 },
    { storeCode: 'PARIS_01', offerId: 'SKU-2', quantity: 0, availability: 'On Display To Order', pickupMethod: 'BUY', pickupSla: 'same day', price: '19.999' },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows[0], {
    storeCode: 'PARIS_01',
    offerId: 'SKU-1',
    quantity: 5,
    availability: null,
    price: null,
    salePrice: null,
    pickupMethod: null,
    pickupSla: null,
  });
  assert.equal(result.rows[1].availability, 'on display to order');
  assert.equal(result.rows[1].pickupMethod, 'buy');
  assert.equal(result.rows[1].price, 20);
});

test('validateInventoryRows rejette les lignes invalides avec des messages explicites', () => {
  const result = validateInventoryRows([
    { storeCode: 'bad code', offerId: 'SKU-1', quantity: 1 },
    { storeCode: 'PARIS_01', quantity: 1 },
    { storeCode: 'PARIS_01', offerId: 'SKU-3', quantity: -2 },
    { storeCode: 'PARIS_01', offerId: 'SKU-4', quantity: 1, availability: 'maybe' },
    { storeCode: 'PARIS_01', offerId: 'SKU-5', quantity: 1, pickupSla: 'same day' },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 5);
  assert.match(result.errors[0], /storeCode invalide/);
  assert.match(result.errors[1], /offerId requis/);
  assert.match(result.errors[2], /entier >= 0/);
  assert.match(result.errors[3], /availability invalide/);
  assert.match(result.errors[4], /pickupSla nécessite pickupMethod/);
});

test('validateInventoryRows refuse un payload vide ou trop gros', () => {
  assert.equal(validateInventoryRows([]).ok, false);
  assert.equal(validateInventoryRows(null).ok, false);
  const tooBig = validateInventoryRows(
    Array.from({ length: 11 }, (_, i) => ({ storeCode: 'S1', offerId: `SKU-${i}`, quantity: 1 })),
    { maxRows: 10 }
  );
  assert.equal(tooBig.ok, false);
  assert.match(tooBig.errors[0], /Maximum 10 lignes/);
});

test('availabilityFromQuantity et formatLiaPrice', () => {
  assert.equal(availabilityFromQuantity(3), 'in stock');
  assert.equal(availabilityFromQuantity(0), 'out of stock');
  assert.equal(formatLiaPrice(12.5, 'EUR'), '12.50 EUR');
  assert.equal(formatLiaPrice('7', null), '7.00 EUR');
  assert.equal(formatLiaPrice(null, 'EUR'), '');
});

test('buildLiaRows génère une ligne par produit × magasin avec fallback sur le stock global', () => {
  const items = [
    { id: 'uuid-1', originid: 'SKU-1', inventory: 7, currency: 'EUR' },
    { id: 'uuid-2', originId: 'SKU-2', inventory: 0, currency: 'EUR' },
  ];
  const stores = [{ storecode: 'PARIS_01' }, { storecode: 'LYON_02' }];
  const inventories = [
    { storecode: 'PARIS_01', offerid: 'SKU-1', quantity: 2, availability: null, price: 19.9, saleprice: null, pickupmethod: 'buy', pickupsla: 'same day' },
  ];

  const { headers, rows } = buildLiaRows({ items, stores, inventories });
  assert.deepEqual(headers, LIA_HEADERS);
  assert.equal(rows.length, 4);

  // SKU-1 × PARIS_01 : enregistrement dédié (quantité 2, prix magasin, retrait)
  const paris1 = rows.find((r) => r[0] === 'PARIS_01' && r[1] === 'SKU-1');
  assert.deepEqual(paris1, ['PARIS_01', 'SKU-1', 2, 'in stock', '19.90 EUR', '', 'buy', 'same day']);

  // SKU-1 × LYON_02 : fallback stock global (7)
  const lyon1 = rows.find((r) => r[0] === 'LYON_02' && r[1] === 'SKU-1');
  assert.deepEqual(lyon1, ['LYON_02', 'SKU-1', 7, 'in stock', '', '', '', '']);

  // SKU-2 : stock global 0 → out of stock partout
  const paris2 = rows.find((r) => r[0] === 'PARIS_01' && r[1] === 'SKU-2');
  assert.equal(paris2[2], 0);
  assert.equal(paris2[3], 'out of stock');
});

test('buildLiaRows filtre sur un magasin précis quand storeCode est fourni', () => {
  const items = [{ id: 'uuid-1', originid: 'SKU-1', inventory: 3, currency: 'EUR' }];
  const stores = [{ storecode: 'PARIS_01' }, { storecode: 'LYON_02' }];
  const { rows } = buildLiaRows({ items, stores, inventories: [], storeCode: 'LYON_02' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'LYON_02');
});

test('buildLiaRows ignore les items sans identifiant et les magasins vides', () => {
  const items = [{ id: '', originid: '', inventory: 3 }];
  const stores = [{ storecode: '' }];
  const { rows } = buildLiaRows({ items, stores, inventories: [] });
  assert.equal(rows.length, 0);
});

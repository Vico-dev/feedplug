const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeGtin,
  normalizeTitle,
  normalizeBrand,
  stripAccents,
  CONFIDENCE,
} = require('../../domains/comparator/matching');

test('normalizeGtin garde les chiffres, valide la longueur et aligne sur GTIN-14', () => {
  assert.equal(normalizeGtin('5452000012345'), '05452000012345'); // EAN-13 -> 14
  assert.equal(normalizeGtin('012345678905'), '00012345678905'); // UPC-12 -> 14
  assert.equal(normalizeGtin('  5 452 000 012 345 '), '05452000012345'); // espaces/ponctuation tolérés
});

test('normalizeGtin rejette les longueurs invalides et les valeurs bidon', () => {
  assert.equal(normalizeGtin('123'), null);
  assert.equal(normalizeGtin('abc'), null);
  assert.equal(normalizeGtin(''), null);
  assert.equal(normalizeGtin(null), null);
  assert.equal(normalizeGtin('00000000'), null); // que des zéros
});

test('UPC-12 et EAN-13 du même produit convergent sur la même clé GTIN-14', () => {
  assert.equal(normalizeGtin('012345678905'), normalizeGtin('0012345678905'));
});

test('normalizeTitle minuscule, retire accents et ponctuation, compacte les espaces', () => {
  assert.equal(normalizeTitle('Écran   PC 27" – Ultra HD!'), 'ecran pc 27 ultra hd');
  assert.equal(normalizeTitle(''), '');
  assert.equal(normalizeTitle(null), '');
});

test('normalizeBrand normalise ou retourne null', () => {
  assert.equal(normalizeBrand('Nike'), 'nike');
  assert.equal(normalizeBrand('  L’Oréal  '), 'l oreal');
  assert.equal(normalizeBrand(''), null);
  assert.equal(normalizeBrand(null), null);
});

test('stripAccents retire les diacritiques sans changer la casse', () => {
  assert.equal(stripAccents('Crème brûlée'), 'Creme brulee');
});

test('CONFIDENCE respecte la hiérarchie gtin > mpn_brand > fuzzy_title', () => {
  assert.ok(CONFIDENCE.gtin > CONFIDENCE.mpn_brand);
  assert.ok(CONFIDENCE.mpn_brand > CONFIDENCE.fuzzy_title);
});

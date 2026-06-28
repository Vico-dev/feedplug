'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { classify, fromAwinCategory } = require('../../domains/comparator/categorization');

test('classify: signal AWIN prioritaire (confiance 80)', () => {
  const r = classify({ title: 'Truc', awinCategory: 'Computing > Laptops' });
  assert.strictEqual(r.categoryId, 'informatique');
  assert.strictEqual(r.confidence, 80);
  assert.strictEqual(r.source, 'awin_map');
});

test('classify: fallback mots-clés sur titre (confiance 50)', () => {
  assert.strictEqual(classify({ title: 'Console Nintendo Switch 2' }).categoryId, 'jeux-video');
  assert.strictEqual(classify({ title: 'Sac à main cuir noir', brand: 'Macalyster' }).categoryId, 'mode');
  assert.strictEqual(classify({ title: 'Eau de parfum Intense' }).categoryId, 'beaute-parfums');
  assert.strictEqual(classify({ title: 'Ordinateur portable Acer' }).confidence, 50);
});

test('classify: insensible aux accents/casse', () => {
  assert.strictEqual(classify({ title: 'TÉLÉVISEUR 4K' }).categoryId, 'tv-son');
});

test('classify: rien de pertinent -> null', () => {
  assert.strictEqual(classify({ title: 'azerty qsdfg' }), null);
  assert.strictEqual(classify({}), null);
});

test('fromAwinCategory', () => {
  assert.strictEqual(fromAwinCategory('Video Games / Switch'), 'jeux-video');
  assert.strictEqual(fromAwinCategory(''), null);
  assert.strictEqual(fromAwinCategory(null), null);
});

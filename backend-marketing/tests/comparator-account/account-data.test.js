'use strict';
const test = require('node:test');
const assert = require('node:assert');

const { sanitizeCategoryIds } = require('../../domains/comparator-account/interests');
const { normCountry, computeDrop } = require('../../domains/comparator-account/watchlist');
const { scoreDrop, parsePaging } = require('../../domains/comparator-account/feed');

test('sanitizeCategoryIds: garde slugs valides, dédoublonne, normalise, borne', () => {
  assert.deepStrictEqual(sanitizeCategoryIds(['informatique', 'Informatique', 'mode']), ['informatique', 'mode']);
  assert.deepStrictEqual(sanitizeCategoryIds(['jeux-video', '  sport  ']), ['jeux-video', 'sport']);
  assert.deepStrictEqual(sanitizeCategoryIds(['bad space', 'ok', 123, null, '']), ['ok']);
  assert.deepStrictEqual(sanitizeCategoryIds('nope'), []);
  assert.deepStrictEqual(sanitizeCategoryIds(null), []);
  assert.strictEqual(sanitizeCategoryIds(Array.from({ length: 80 }, (_, i) => `c${i}`)).length, 50);
  assert.deepStrictEqual(sanitizeCategoryIds(['x'.repeat(65)]), []);
});

test('normCountry: ISO-2 majuscule, défaut FR', () => {
  assert.strictEqual(normCountry('fr'), 'FR');
  assert.strictEqual(normCountry(' gb '), 'GB');
  assert.strictEqual(normCountry('FRA'), 'FR');
  assert.strictEqual(normCountry(''), 'FR');
  assert.strictEqual(normCountry(undefined), 'FR');
});

test('computeDrop: % de baisse, négatif = baisse, null si non calculable', () => {
  assert.strictEqual(computeDrop(100, 80), -20);
  assert.strictEqual(computeDrop(100, 110), 10);
  assert.strictEqual(computeDrop(100, 100), 0);
  assert.strictEqual(computeDrop(null, 80), null);
  assert.strictEqual(computeDrop(0, 80), null);
  assert.strictEqual(computeDrop(100, 0), null);
  assert.strictEqual(computeDrop(100, null), null);
});

test('scoreDrop: prend la plus forte baisse, 0 si aucun signal', () => {
  assert.strictEqual(scoreDrop(-10, -25), -25);
  assert.strictEqual(scoreDrop(-10, 5), -10);
  assert.strictEqual(scoreDrop(null, -8), -8);
  assert.strictEqual(scoreDrop(-3, null), -3);
  assert.strictEqual(scoreDrop(null, null), 0);
  assert.strictEqual(scoreDrop(NaN, null), 0);
});

test('parsePaging: borne limit 1..48, offset >= 0', () => {
  assert.deepStrictEqual(parsePaging(undefined, undefined), { limit: 24, offset: 0 });
  assert.deepStrictEqual(parsePaging('100', '5'), { limit: 48, offset: 5 });
  assert.deepStrictEqual(parsePaging('0', '-3'), { limit: 24, offset: 0 });
  assert.deepStrictEqual(parsePaging('12', '12'), { limit: 12, offset: 12 });
});

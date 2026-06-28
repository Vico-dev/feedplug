const test = require('node:test');
const assert = require('node:assert/strict');

const { deriveSignals, shiftDays } = require('../../domains/comparator/price-history');

test('shiftDays décale correctement une date UTC', () => {
  assert.equal(shiftDays('2026-06-28', -30), '2026-05-29');
  assert.equal(shiftDays('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDays('2026-06-28', 0), '2026-06-28');
});

test('deriveSignals retourne null sans données', () => {
  assert.equal(deriveSignals([], '2026-06-28'), null);
  assert.equal(deriveSignals(null, '2026-06-28'), null);
});

test('deriveSignals détecte le plus bas et calcule la variation sur 30 jours', () => {
  const points = [
    { capturedon: '2026-03-30', lowestprice: 100 },
    { capturedon: '2026-05-28', lowestprice: 120 }, // ~31 jours avant le 28/06
    { capturedon: '2026-06-28', lowestprice: 90 },  // aujourd'hui, au plus bas
  ];
  const s = deriveSignals(points, '2026-06-28');
  assert.equal(s.current, 90);
  assert.equal(s.min90, 90);
  assert.equal(s.max90, 120);
  assert.equal(s.isAtLowest, true);
  assert.equal(s.pctVs30d, -25); // (90-120)/120 = -25 %
  assert.equal(s.points, 3);
});

test('deriveSignals : pas au plus bas et historique trop court pour le 30 jours', () => {
  const points = [
    { capturedon: '2026-06-01', lowestprice: 80 },
    { capturedon: '2026-06-28', lowestprice: 95 },
  ];
  const s = deriveSignals(points, '2026-06-28');
  assert.equal(s.current, 95);
  assert.equal(s.min90, 80);
  assert.equal(s.isAtLowest, false);
  assert.equal(s.pctVs30d, null); // aucun point <= (today - 30j)
});

test('deriveSignals trie les points non ordonnés', () => {
  const points = [
    { capturedon: '2026-06-28', lowestprice: 50 },
    { capturedon: '2026-04-01', lowestprice: 70 },
  ];
  const s = deriveSignals(points, '2026-06-28');
  assert.equal(s.current, 50); // dernier dans l'ordre chronologique
  assert.equal(s.isAtLowest, true);
});

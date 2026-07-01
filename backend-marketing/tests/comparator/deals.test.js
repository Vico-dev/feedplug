const test = require('node:test');
const assert = require('node:assert/strict');

const { mapDealRow, getPublicDeals } = require('../../domains/comparator/deals');

test('mapDealRow calcule pctVs30d, rrpDropPct (arrondis 0,1 %) et le dropScore combiné', () => {
  const item = mapDealRow({
    id: 'g1',
    canonicaltitle: 'Casque ACME',
    brand: 'ACME',
    imageurl: 'http://img/x.jpg',
    lowestprice: 80,
    currency: 'EUR',
    merchant_count: 3,
    ref_price: 100,   // -20 % vs prix conseillé
    pastprice: 120,   // -33,3 % vs ~30 j
  });
  assert.equal(item.id, 'g1');
  assert.equal(item.title, 'Casque ACME');
  assert.equal(item.brand, 'ACME');
  assert.equal(item.imageUrl, 'http://img/x.jpg');
  assert.equal(item.lowestPrice, 80);
  assert.equal(item.currency, 'EUR');
  assert.equal(item.merchantCount, 3);
  assert.equal(item.pctVs30d, -33.3);
  assert.equal(item.rrpDropPct, -20);
  // dropScore = min(-33.3, -20) = -33.3 (la baisse la plus forte)
  assert.equal(item.dropScore, -33.3);
});

test('mapDealRow : sans historique ni prix conseillé, signaux null et dropScore 0', () => {
  const item = mapDealRow({
    id: 'g2', canonicaltitle: 'T', brand: null, imageurl: null,
    lowestprice: 50, currency: 'EUR', merchant_count: 1,
    ref_price: null, pastprice: null,
  });
  assert.equal(item.pctVs30d, null);
  assert.equal(item.rrpDropPct, null);
  assert.equal(item.dropScore, 0);
});

test('mapDealRow : seul le prix conseillé est présent (cold-start sans historique)', () => {
  const item = mapDealRow({
    id: 'g3', canonicaltitle: 'T', brand: null, imageurl: null,
    lowestprice: 90, currency: 'EUR', merchant_count: 2,
    ref_price: 150, pastprice: null,
  });
  assert.equal(item.pctVs30d, null);
  assert.equal(item.rrpDropPct, -40);
  assert.equal(item.dropScore, -40);
});

test('getPublicDeals passe accountId/country/limit/offset et expose total + items mappés', async () => {
  let captured = null;
  const prisma = {
    $queryRawUnsafe: async (sql, ...params) => {
      captured = { sql, params };
      return [
        { id: 'a', canonicaltitle: 'A', brand: 'X', imageurl: null, lowestprice: 80,
          currency: 'EUR', merchant_count: 2, ref_price: 100, pastprice: 120, total: 2 },
        { id: 'b', canonicaltitle: 'B', brand: null, imageurl: null, lowestprice: 45,
          currency: 'EUR', merchant_count: 1, ref_price: 50, pastprice: null, total: 2 },
      ];
    },
  };

  const { items, total } = await getPublicDeals(prisma, 'comparator', { country: 'FR', limit: 24, offset: 0 });

  assert.equal(total, 2);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'a');
  assert.equal(items[0].dropScore, -33.3);
  assert.equal(items[1].dropScore, -10);
  // params dans l'ordre attendu : accountId, country, limit, offset
  assert.deepEqual(captured.params, ['comparator', 'FR', 24, 0]);
  // pas de join d'intérêts utilisateur (acquisition publique)
  assert.ok(!/ComparatorInterest/.test(captured.sql));
  // gating AWIN conservé + scope au compte comparateur
  assert.ok(/comparatoroptin = true/.test(captured.sql));
  assert.ok(/pg\.accountid = \$1::text/.test(captured.sql));
});

test('getPublicDeals : catalogue vide -> total 0, items []', async () => {
  const prisma = { $queryRawUnsafe: async () => [] };
  const { items, total } = await getPublicDeals(prisma, 'comparator', { country: 'FR', limit: 24, offset: 0 });
  assert.equal(total, 0);
  assert.deepEqual(items, []);
});

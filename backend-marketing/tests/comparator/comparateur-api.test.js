const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseCountry, parsePaging, parseSort, hashIp, markBestValue,
  parseAiJson, pickFallbackRecommendation, SORTS,
} = require('../../routes/comparateur');

test('parseCountry normalise un ISO-2 ou retombe sur FR', () => {
  assert.equal(parseCountry('gb'), 'GB');
  assert.equal(parseCountry('FR'), 'FR');
  assert.equal(parseCountry('xyz'), 'FR');
  assert.equal(parseCountry(undefined), 'FR');
  assert.equal(parseCountry(''), 'FR');
});

test('parsePaging borne limit (1..48) et offset (>=0)', () => {
  assert.deepEqual(parsePaging({}), { limit: 24, offset: 0 });
  assert.deepEqual(parsePaging({ limit: '10', offset: '40' }), { limit: 10, offset: 40 });
  assert.deepEqual(parsePaging({ limit: '999' }), { limit: 48, offset: 0 });
  assert.deepEqual(parsePaging({ limit: '-5', offset: '-9' }), { limit: 1, offset: 0 });
});

test('parseSort accepte les tris connus, sinon relevance', () => {
  assert.equal(parseSort('price_asc'), 'price_asc');
  assert.equal(parseSort('nope'), 'relevance');
  for (const s of SORTS) assert.equal(parseSort(s), s);
});

test('hashIp est déterministe, salé, et ne contient jamais l’IP en clair', () => {
  const h = hashIp('1.2.3.4', 'sel');
  assert.equal(h, hashIp('1.2.3.4', 'sel'));
  assert.notEqual(h, hashIp('1.2.3.4', 'autre-sel'));
  assert.equal(h.length, 64);
  assert.ok(!h.includes('1.2.3.4'));
  assert.equal(hashIp(null, 'sel'), null);
});

test('markBestValue : la moins chère EN STOCK (offres triées par prix)', () => {
  const r = markBestValue([
    { price: 100, inStock: false },
    { price: 110, inStock: true },
    { price: 120, inStock: true },
  ]);
  assert.deepEqual(r.map((o) => o.bestValue), [false, true, false]);
});

test('markBestValue : si rien en stock, prend la moins chère ; [] -> []', () => {
  const r = markBestValue([{ price: 50, inStock: false }, { price: 60, inStock: false }]);
  assert.deepEqual(r.map((o) => o.bestValue), [true, false]);
  assert.deepEqual(markBestValue([]), []);
});

test('parseAiJson extrait un objet JSON même entouré de texte ou de fences', () => {
  assert.deepEqual(parseAiJson('```json\n{"recommendedId":"x","reasoning":"ok"}\n```'), { recommendedId: 'x', reasoning: 'ok' });
  assert.deepEqual(parseAiJson('Voici la réponse: {"a":1} (fin)'), { a: 1 });
  assert.equal(parseAiJson('pas de json ici'), null);
  assert.equal(parseAiJson(''), null);
  assert.equal(parseAiJson(null), null);
});

test('pickFallbackRecommendation : moins cher, départage par nb de marchands', () => {
  const c = [
    { id: 'a', lowestPrice: 120, merchantCount: 2 },
    { id: 'b', lowestPrice: 100, merchantCount: 3 },
    { id: 'c', lowestPrice: 100, merchantCount: 5 },
  ];
  assert.equal(pickFallbackRecommendation(c).id, 'c');
  assert.equal(pickFallbackRecommendation([]), null);
});

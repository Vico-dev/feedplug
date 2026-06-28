const test = require('node:test');
const assert = require('node:assert/strict');

const { parseCountry, parsePaging, parseSort, hashIp, SORTS } = require('../../routes/comparateur');

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

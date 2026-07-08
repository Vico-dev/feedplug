'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  buildBatchPrompt,
  extractJson,
  validateResults,
  runAiEnrichment,
} = require('../../domains/comparator/ai-categorization');

// ── Mocks ────────────────────────────────────────────────────────────────────

function mockPrisma({ cats = [], candidates = [] } = {}) {
  const execs = [];
  return {
    execs,
    async $queryRawUnsafe(sql, ..._params) {
      if (sql.includes('"ComparatorCategory"')) return cats;
      if (sql.includes('FROM "ProductGroup" pg')) return candidates;
      return [];
    },
    async $executeRawUnsafe(sql, ...params) {
      execs.push({ sql, params });
      return 1;
    },
  };
}

const geminiFetch = (payload) => async () => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] } }] }),
});

const CATS = [
  { id: 'mode', labelfr: 'Mode' },
  { id: 'informatique', labelfr: 'Informatique' },
];

// ── Fonctions pures ──────────────────────────────────────────────────────────

test('extractJson: tolère les fences markdown et le texte autour', () => {
  const arr = extractJson('Voici :\n```json\n[{"i":0,"cat":"mode","color":"noir"}]\n```\nfin');
  assert.deepStrictEqual(arr, [{ i: 0, cat: 'mode', color: 'noir' }]);
});

test('extractJson: contenu invalide -> null', () => {
  assert.strictEqual(extractJson('pas de json ici'), null);
  assert.strictEqual(extractJson('[{cassé'), null);
  assert.strictEqual(extractJson(''), null);
  assert.strictEqual(extractJson('{"pas":"un tableau"}'), null);
});

test('validateResults: catégorie hors liste blanche -> null (couleur conservée)', () => {
  const out = validateResults(
    [{ i: 0, cat: 'inventée', color: 'Bleu Marine' }],
    { count: 1, validCats: new Set(['mode']) },
  );
  assert.deepStrictEqual(out, [{ index: 0, categoryId: null, color: 'bleu marine' }]);
});

test('validateResults: index hors lot, doublons et couleurs suspectes rejetés', () => {
  const out = validateResults(
    [
      { i: 5, cat: 'mode', color: null },            // hors lot
      { i: 0, cat: 'mode', color: 'noir' },
      { i: 0, cat: 'mode', color: 'rouge' },          // doublon d'index
      { i: 1, cat: null, color: 'null' },             // couleur littérale "null"
      { i: 2, cat: null, color: 'x'.repeat(40) },     // trop long
    ],
    { count: 3, validCats: new Set(['mode']) },
  );
  assert.deepStrictEqual(out, [{ index: 0, categoryId: 'mode', color: 'noir' }]);
});

test('buildBatchPrompt: contient les ids de catégories et les produits numérotés', () => {
  const p = buildBatchPrompt(
    [{ title: 'Sac cabas cuir', brand: 'Sézane' }],
    CATS,
  );
  assert.ok(p.includes('- mode (Mode)'));
  assert.ok(p.includes('- informatique (Informatique)'));
  assert.ok(p.includes('0. titre: Sac cabas cuir | marque: Sézane'));
});

// ── Runner ───────────────────────────────────────────────────────────────────

test('runAiEnrichment: sans clé API -> no-op propre, zéro requête DB', async () => {
  const prisma = mockPrisma();
  const res = await runAiEnrichment(prisma, { apiKey: null });
  assert.strictEqual(res.skipped, true);
  assert.strictEqual(res.reason, 'no_api_key');
  assert.strictEqual(prisma.execs.length, 0);
});

test('runAiEnrichment: catégorise + colore, ignore la catégorie invalide', async () => {
  const prisma = mockPrisma({
    cats: CATS,
    candidates: [
      { id: 'g1', title: 'Sac cabas', brand: 'X', color: '' },
      { id: 'g2', title: 'Truc obscur', brand: 'Y', color: '' },
    ],
  });
  const res = await runAiEnrichment(prisma, {
    apiKey: 'k',
    fetchImpl: geminiFetch([
      { i: 0, cat: 'mode', color: 'noir' },
      { i: 1, cat: 'inexistante', color: null },
    ]),
  });
  assert.strictEqual(res.skipped, false);
  assert.strictEqual(res.processed, 2);
  assert.strictEqual(res.categorized, 1);
  assert.strictEqual(res.colored, 1);
  assert.strictEqual(res.failedBatches, 0);

  const upsert = prisma.execs.find((e) => e.sql.includes('"ProductGroupCategory"'));
  assert.ok(upsert, 'upsert ProductGroupCategory attendu');
  assert.deepStrictEqual(upsert.params.slice(0, 2), ['g1', 'mode']);
  assert.ok(upsert.sql.includes("'ai'"));

  const denorm = prisma.execs.find((e) => e.sql.includes('SET category ='));
  assert.ok(denorm && denorm.sql.includes('category IS NULL'), 'dénormalisation gardée par category IS NULL');

  const colorUpd = prisma.execs.find((e) => e.sql.includes("jsonb_build_object('color'"));
  assert.ok(colorUpd, 'écriture couleur attendue');
  assert.deepStrictEqual(colorUpd.params, ['g1', 'noir']);
});

test('runAiEnrichment: couleur du flux déjà présente -> pas d’écrasement', async () => {
  const prisma = mockPrisma({
    cats: CATS,
    candidates: [{ id: 'g1', title: 'Sac', brand: 'X', color: 'camel' }],
  });
  const res = await runAiEnrichment(prisma, {
    apiKey: 'k',
    fetchImpl: geminiFetch([{ i: 0, cat: 'mode', color: 'noir' }]),
  });
  assert.strictEqual(res.colored, 0);
  assert.strictEqual(prisma.execs.some((e) => e.sql.includes('jsonb_build_object')), false);
});

test('runAiEnrichment: un lot en échec n’interrompt pas les suivants', async () => {
  const candidates = [];
  for (let i = 0; i < 4; i++) candidates.push({ id: `g${i}`, title: `P${i}`, brand: '', color: '' });
  const prisma = mockPrisma({ cats: CATS, candidates });
  let call = 0;
  const flakyFetch = async (...args) => {
    call++;
    if (call === 1) return { ok: false, status: 500, text: async () => 'boom' };
    return geminiFetch([{ i: 0, cat: 'mode', color: null }])(...args);
  };
  const res = await runAiEnrichment(prisma, { apiKey: 'k', batchSize: 2, fetchImpl: flakyFetch });
  assert.strictEqual(res.failedBatches, 1);
  assert.strictEqual(res.categorized, 1); // le 2e lot est passé
});

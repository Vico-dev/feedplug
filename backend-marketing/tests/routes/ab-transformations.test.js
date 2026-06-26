const test = require('node:test');
const assert = require('node:assert/strict');

// B6 — applyAbTransformations calcule la vraie variante côté serveur depuis le
// contenu réel (titre/description), à partir des transformations utilisateur.
const { applyAbTransformations } = require('../../routes/ab-tests');

test('replace substitue searchValue par replaceValue', () => {
  const out = applyAbTransformations('T-shirt rouge', [
    { type: 'replace', searchValue: 'rouge', replaceValue: 'bleu' },
  ]);
  assert.equal(out, 'T-shirt bleu');
});

test('replace sans replaceValue supprime la recherche', () => {
  const out = applyAbTransformations('Produit Promo Été', [
    { type: 'replace', searchValue: 'Promo ' },
  ]);
  assert.equal(out, 'Produit Été');
});

test('prepend ajoute en tête', () => {
  const out = applyAbTransformations('Sac', [
    { type: 'prepend', replaceValue: 'Nouveau ' },
  ]);
  assert.equal(out, 'Nouveau Sac');
});

test('append ajoute en fin avec un espace', () => {
  const out = applyAbTransformations('Sac', [
    { type: 'append', replaceValue: 'cuir' },
  ]);
  assert.equal(out, 'Sac cuir');
});

test('remove retire toutes les occurrences', () => {
  const out = applyAbTransformations('Chaussure SOLDE SOLDE', [
    { type: 'remove', searchValue: 'SOLDE ' },
  ]);
  assert.equal(out, 'Chaussure SOLDE'); // dernier 'SOLDE' sans espace conservé
});

test('chaînage de plusieurs transformations (ordre préservé)', () => {
  const out = applyAbTransformations('Veste rouge', [
    { type: 'replace', searchValue: 'rouge', replaceValue: 'noire' },
    { type: 'prepend', replaceValue: 'Super ' },
    { type: 'append', replaceValue: '2026' },
  ]);
  assert.equal(out, 'Super Veste noire 2026');
});

test('robuste sur entrée vide/null', () => {
  assert.equal(applyAbTransformations(null, [{ type: 'append', replaceValue: 'x' }]), ' x');
  assert.equal(applyAbTransformations(undefined, null), '');
  assert.equal(applyAbTransformations('', undefined), '');
  assert.equal(applyAbTransformations('texte', 'pas-un-tableau'), 'texte');
});

test('ignore les transformations inconnues ou incomplètes', () => {
  const out = applyAbTransformations('Base', [
    { type: 'unknown', replaceValue: 'x' },
    { type: 'prepend' }, // pas de replaceValue → no-op
    { type: 'replace', replaceValue: 'y' }, // pas de searchValue → no-op
  ]);
  assert.equal(out, 'Base');
});

const test = require('node:test');
const assert = require('node:assert/strict');

// Sprint 2 (B-PROPER) — logique de dedup/nommage de lib/jobs.js.
// Pas de Cloud Tasks ni d'env : on teste le nommage déterministe (base du
// debounce/dédup distribué) et la résolution du mode (fallback in-process).
const jobs = require('../../lib/jobs.js');

test('computeWindowBucket: même fenêtre -> même bucket, fenêtre suivante -> bucket+1', () => {
  const windowMs = 30000;
  // t aligné sur le début d'une fenêtre (multiple de windowMs) pour tester les bords.
  const t = Math.floor(1_000_000_000_000 / windowMs) * windowMs;
  const b0 = jobs.computeWindowBucket(t, windowMs);
  // +1ms reste dans la même fenêtre
  assert.equal(jobs.computeWindowBucket(t + 1, windowMs), b0);
  // +29999ms reste dans la même fenêtre
  assert.equal(jobs.computeWindowBucket(t + windowMs - 1, windowMs), b0);
  // +30000ms passe à la fenêtre suivante
  assert.equal(jobs.computeWindowBucket(t + windowMs, windowMs), b0 + 1);
});

test('computeTaskName: deux enqueues du même dedupKey dans la même fenêtre -> nom IDENTIQUE (dédup)', () => {
  const base = { type: 'auto_gmc_push', dedupKey: 'acct1:feedA', dedupWindowMs: 30000, scheduleDelayMs: 0 };
  const now = 1_700_000_000_000;
  const n1 = jobs.computeTaskName({ ...base, nowMs: now });
  const n2 = jobs.computeTaskName({ ...base, nowMs: now + 5000 }); // même fenêtre
  assert.equal(n1, n2, 'même dedupKey + même fenêtre => même nom => Cloud Tasks dédupe');
  // Nom conforme à la regex Cloud Tasks [A-Za-z0-9_-]{1,500}
  assert.match(n1, /^[A-Za-z0-9_-]{1,500}$/);
});

test('computeTaskName: fenêtre temporelle suivante -> nom DIFFÉRENT (nouvelle exécution permise)', () => {
  const base = { type: 'auto_gmc_push', dedupKey: 'acct1:feedA', dedupWindowMs: 30000, scheduleDelayMs: 0 };
  const now = 1_700_000_000_000;
  const n1 = jobs.computeTaskName({ ...base, nowMs: now });
  const n2 = jobs.computeTaskName({ ...base, nowMs: now + 30000 }); // fenêtre suivante
  assert.notEqual(n1, n2);
});

test('computeTaskName: dedupKeys différents -> noms différents (pas de collision inter-comptes)', () => {
  const now = 1_700_000_000_000;
  const a = jobs.computeTaskName({ type: 'auto_gmc_push', dedupKey: 'acct1:feedA', dedupWindowMs: 30000, nowMs: now });
  const b = jobs.computeTaskName({ type: 'auto_gmc_push', dedupKey: 'acct2:feedA', dedupWindowMs: 30000, nowMs: now });
  assert.notEqual(a, b);
});

test('computeTaskName: sans dedupKey -> nom unique à chaque appel (pas de dédup)', () => {
  const a = jobs.computeTaskName({ type: 'ingestion_run' });
  const b = jobs.computeTaskName({ type: 'ingestion_run' });
  assert.notEqual(a, b);
  assert.match(a, /^job-ingestion_run-/);
});

test('computeTaskName: caractères spéciaux du dedupKey -> nom sûr (regex Cloud Tasks)', () => {
  const n = jobs.computeTaskName({ type: 'x', dedupKey: 'a/b c:d#e', dedupWindowMs: 1000, nowMs: 1 });
  assert.match(n, /^[A-Za-z0-9_-]+$/, 'aucun caractère interdit');
});

test('resolveMode: sans CLOUD_TASKS_QUEUE -> in-process (fallback dev)', () => {
  const saved = process.env.CLOUD_TASKS_QUEUE;
  delete process.env.CLOUD_TASKS_QUEUE;
  assert.equal(jobs.resolveMode(), 'in-process');
  if (saved !== undefined) process.env.CLOUD_TASKS_QUEUE = saved;
});

test('enqueueJob (fallback in-process): dédup par dedupKey -> 1 seul dispatch après debounce', async () => {
  // En l'absence de Cloud Tasks, enqueueJob retombe sur setTimeout+Map.
  // Deux enqueues du même dedupKey avec un délai court => le 1er timer est
  // annulé, un seul dispatch survient.
  const saved = process.env.CLOUD_TASKS_QUEUE;
  delete process.env.CLOUD_TASKS_QUEUE;

  const calls = [];
  jobs.configureJobs({ dispatch: async (type, payload) => { calls.push({ type, payload }); } });

  await jobs.enqueueJob('t', { n: 1 }, { dedupKey: 'k', scheduleDelayMs: 10 });
  await jobs.enqueueJob('t', { n: 2 }, { dedupKey: 'k', scheduleDelayMs: 10 });

  await new Promise((r) => setTimeout(r, 40));
  assert.equal(calls.length, 1, 'un seul dispatch (debounce distribué simulé)');
  assert.equal(calls[0].payload.n, 2, 'le dernier payload gagne');

  if (saved !== undefined) process.env.CLOUD_TASKS_QUEUE = saved;
});

test('enqueueJob: type manquant -> throw', async () => {
  await assert.rejects(() => jobs.enqueueJob(), /type/);
});

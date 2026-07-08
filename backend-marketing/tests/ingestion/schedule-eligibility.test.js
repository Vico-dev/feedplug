const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isFeedDueForScheduledRun } = require('../../lib/schedule-eligibility');

const at = (iso) => new Date(iso);

test('sans scheduleTime : jamais exécuté → éligible immédiatement', () => {
  const r = isFeedDueForScheduledRun({ scheduleTime: null, lastRunAt: null, now: at('2026-07-08T14:00:00Z') });
  assert.equal(r.due, true);
});

test('sans scheduleTime : dernière exécution > 23h → éligible (cadence quotidienne)', () => {
  const r = isFeedDueForScheduledRun({
    scheduleTime: null,
    lastRunAt: at('2026-07-07T13:00:00Z'),
    now: at('2026-07-08T14:00:00Z'),
  });
  assert.equal(r.due, true);
});

test('sans scheduleTime : dernière exécution < 23h → skip (pas de re-run horaire)', () => {
  const r = isFeedDueForScheduledRun({
    scheduleTime: null,
    lastRunAt: at('2026-07-08T10:00:00Z'),
    now: at('2026-07-08T14:00:00Z'),
  });
  assert.equal(r.due, false);
});

test('avec scheduleTime : hors fenêtre → skip même si dernière exécution ancienne', () => {
  const now = at('2026-07-08T14:30:00Z');
  const r = isFeedDueForScheduledRun({
    scheduleTime: `${String(now.getHours() + 3).padStart(2, '0')}:00`,
    lastRunAt: at('2026-07-01T00:00:00Z'),
    now,
  });
  assert.equal(r.due, false);
});

test('avec scheduleTime : dans la fenêtre et > 23h depuis le dernier run → éligible', () => {
  const now = at('2026-07-08T14:30:00Z');
  const r = isFeedDueForScheduledRun({
    scheduleTime: `${String(now.getHours()).padStart(2, '0')}:00`,
    lastRunAt: at('2026-07-07T10:00:00Z'),
    now,
  });
  assert.equal(r.due, true);
});

test('avec scheduleTime : dans la fenêtre mais déjà exécuté aujourd hui → skip', () => {
  const now = at('2026-07-08T14:30:00Z');
  const lastRun = new Date(now.getTime() - 60 * 60 * 1000); // il y a 1h
  const r = isFeedDueForScheduledRun({
    scheduleTime: `${String(now.getHours()).padStart(2, '0')}:00`,
    lastRunAt: lastRun,
    now,
  });
  assert.equal(r.due, false);
});

test('scheduleTime malformé → skip (fail-safe, pas de crash)', () => {
  const r = isFeedDueForScheduledRun({ scheduleTime: 'bidon', lastRunAt: null, now: at('2026-07-08T14:00:00Z') });
  assert.equal(r.due, false);
});

test('lastRunAt fourni en string ISO (venu du driver SQL) est bien interprété', () => {
  const r = isFeedDueForScheduledRun({
    scheduleTime: null,
    lastRunAt: '2026-07-08T13:30:00Z',
    now: at('2026-07-08T14:00:00Z'),
  });
  assert.equal(r.due, false);
});

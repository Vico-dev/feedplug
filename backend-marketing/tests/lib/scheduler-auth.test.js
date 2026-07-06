const test = require('node:test');
const assert = require('node:assert');
const { checkSchedulerAuth, timingSafeSecretEqual } = require('../../lib/scheduler-auth');

function req(headers = {}) {
  return { headers };
}

test('checkSchedulerAuth fail-closed quand SCHEDULER_SECRET absent', () => {
  const prev = process.env.SCHEDULER_SECRET;
  delete process.env.SCHEDULER_SECRET;
  try {
    const r = checkSchedulerAuth(req({ authorization: 'Bearer whatever' }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 503);
  } finally {
    if (prev !== undefined) process.env.SCHEDULER_SECRET = prev;
  }
});

test('checkSchedulerAuth rejette un Bearer arbitraire (pas de bypass OIDC)', () => {
  const prev = process.env.SCHEDULER_SECRET;
  process.env.SCHEDULER_SECRET = 'super-secret-value';
  try {
    // Ancien bug : tout `Authorization: Bearer <x>` sans x-scheduler-secret passait.
    const r = checkSchedulerAuth(req({ authorization: 'Bearer n-importe-quoi' }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 401);
  } finally {
    if (prev !== undefined) process.env.SCHEDULER_SECRET = prev; else delete process.env.SCHEDULER_SECRET;
  }
});

test('checkSchedulerAuth accepte le bon secret via x-scheduler-secret', () => {
  const prev = process.env.SCHEDULER_SECRET;
  process.env.SCHEDULER_SECRET = 'super-secret-value';
  try {
    const r = checkSchedulerAuth(req({ 'x-scheduler-secret': 'super-secret-value' }));
    assert.strictEqual(r.ok, true);
  } finally {
    if (prev !== undefined) process.env.SCHEDULER_SECRET = prev; else delete process.env.SCHEDULER_SECRET;
  }
});

test('checkSchedulerAuth accepte le bon secret via Authorization Bearer', () => {
  const prev = process.env.SCHEDULER_SECRET;
  process.env.SCHEDULER_SECRET = 'super-secret-value';
  try {
    const r = checkSchedulerAuth(req({ authorization: 'Bearer super-secret-value' }));
    assert.strictEqual(r.ok, true);
  } finally {
    if (prev !== undefined) process.env.SCHEDULER_SECRET = prev; else delete process.env.SCHEDULER_SECRET;
  }
});

test('timingSafeSecretEqual compare correctement', () => {
  assert.strictEqual(timingSafeSecretEqual('abc', 'abc'), true);
  assert.strictEqual(timingSafeSecretEqual('abc', 'abd'), false);
  assert.strictEqual(timingSafeSecretEqual('abc', 'abcd'), false);
  assert.strictEqual(timingSafeSecretEqual('', ''), true);
  assert.strictEqual(timingSafeSecretEqual('x', ''), false);
});

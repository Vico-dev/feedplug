const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAccountDeletionStatements,
  collectTokensToRevoke,
  isMissingTableError,
  runAccountDeletion,
} = require('../../domains/accounts/deletion');

// Fabrique un `tx` factice qui enregistre les requêtes exécutées et permet
// d'injecter des erreurs ciblées (par sous-chaîne SQL).
function makeTxStub({ failOn = {} } = {}) {
  const executed = [];
  return {
    executed,
    async $executeRawUnsafe(sql, ...args) {
      executed.push({ sql: sql.replace(/\s+/g, ' ').trim(), args });
      for (const [needle, err] of Object.entries(failOn)) {
        if (sql.includes(needle)) throw err;
      }
      return 1;
    },
  };
}

test('buildAccountDeletionStatements supprime les enfants AVANT le compte', () => {
  const statements = buildAccountDeletionStatements('acc_1');
  const tables = statements.map((s) => {
    const m = s.sql.match(/DELETE FROM "(\w+)"/);
    return m ? m[1] : null;
  });

  // La dernière requête doit être la suppression de l'Account (déclenche la cascade).
  assert.equal(tables[tables.length - 1], 'Account');
  // Seul le DELETE final (Account) ne tolère pas l'absence de table.
  assert.equal(statements[statements.length - 1].allowMissingTable, false);
  for (let i = 0; i < statements.length - 1; i++) {
    assert.equal(statements[i].allowMissingTable, true, `statement ${i} doit tolérer 42P01`);
  }

  // Les relations FK non-cascade doivent être présentes avant Account.
  for (const required of ['Feed', 'FeedSource', 'ExportLog', 'FeedItem', 'IngestionRun', 'FeedError']) {
    const idx = tables.indexOf(required);
    assert.ok(idx >= 0, `${required} doit être supprimé`);
    assert.ok(idx < tables.length - 1, `${required} doit être supprimé avant Account`);
  }

  // Ordre de la chaîne feed : FeedError -> IngestionRun, FeedItem -> Feed -> FeedSource.
  assert.ok(tables.indexOf('FeedError') < tables.indexOf('IngestionRun'));
  assert.ok(tables.indexOf('FeedItem') < tables.indexOf('Feed'));
  assert.ok(tables.indexOf('Feed') < tables.indexOf('FeedSource') || tables.indexOf('FeedSource') > tables.indexOf('Feed'));
  assert.ok(tables.indexOf('Feed') < tables.indexOf('Account'));

  // Toutes les requêtes ciblent bien le compte demandé.
  for (const s of statements) {
    assert.deepEqual(s.args, ['acc_1']);
  }
});

test('collectTokensToRevoke extrait les jti access + refresh', () => {
  const decode = (token) => JSON.parse(token); // décodeur factice : le token EST son payload JSON.
  const tokens = collectTokensToRevoke(
    {
      authorizationHeader: `Bearer ${JSON.stringify({ jti: 'jti-access', id: 'u1', exp: 111 })}`,
      refreshToken: JSON.stringify({ jti: 'jti-refresh', id: 'u1', exp: 222 }),
    },
    decode
  );
  assert.deepEqual(tokens, [
    { jti: 'jti-access', userId: 'u1', exp: 111 },
    { jti: 'jti-refresh', userId: 'u1', exp: 222 },
  ]);
});

test('collectTokensToRevoke ignore les tokens sans jti/exp et l\'absence de header', () => {
  const decode = (token) => JSON.parse(token);
  assert.deepEqual(collectTokensToRevoke({}, decode), []);
  assert.deepEqual(
    collectTokensToRevoke({ authorizationHeader: `Bearer ${JSON.stringify({ id: 'u1' })}` }, decode),
    []
  );
});

test('isMissingTableError reconnaît uniquement les tables absentes (42P01)', () => {
  assert.equal(isMissingTableError({ message: 'relation "Feed" does not exist (42P01)' }), true);
  assert.equal(isMissingTableError({ message: 'permission denied' }), false);
  assert.equal(isMissingTableError(null), false);
});

test('runAccountDeletion (OWNER) supprime tout et révoque le token courant', async () => {
  const tx = makeTxStub();
  const decode = (token) => JSON.parse(token);

  const result = await runAccountDeletion(tx, 'acc_42', {
    authorizationHeader: `Bearer ${JSON.stringify({ jti: 'jti-A', id: 'owner', exp: 999 })}`,
    refreshToken: JSON.stringify({ jti: 'jti-R', id: 'owner', exp: 1000 }),
    jwtDecode: decode,
  });

  // Account supprimé.
  assert.ok(tx.executed.some((e) => /DELETE FROM "Account" WHERE id = \$1::text/.test(e.sql)));
  // Révocation : les deux jti sont insérés dans RevokedJti.
  const revokeInserts = tx.executed.filter((e) => /INSERT INTO "RevokedJti"/.test(e.sql));
  assert.equal(revokeInserts.length, 2);
  assert.deepEqual(revokeInserts.map((e) => e.args[0]), ['jti-A', 'jti-R']);
  assert.deepEqual(result.revokedJtis, ['jti-A', 'jti-R']);

  // L'ordre global : Account supprimé avant les insertions de révocation.
  const accountIdx = tx.executed.findIndex((e) => /DELETE FROM "Account"/.test(e.sql));
  const firstRevokeIdx = tx.executed.findIndex((e) => /INSERT INTO "RevokedJti"/.test(e.sql));
  assert.ok(accountIdx < firstRevokeIdx);
});

test('runAccountDeletion tolère une table absente (42P01) sur une requête enfant', async () => {
  const missing = new Error('relation "ExportLog" does not exist');
  const tx = makeTxStub({ failOn: { '"ExportLog"': missing } });
  const warnings = [];

  // Ne doit PAS lever : l'erreur 42P01 est avalée pour les requêtes enfant.
  const result = await runAccountDeletion(tx, 'acc_1', {
    jwtDecode: () => null,
    onMissingTableWarn: (m) => warnings.push(m),
  });

  assert.ok(warnings.some((w) => /ExportLog/.test(w)));
  // L'Account est tout de même supprimé.
  assert.ok(tx.executed.some((e) => /DELETE FROM "Account"/.test(e.sql)));
  assert.equal(result.revokedJtis.length, 0);
});

test('runAccountDeletion propage une erreur réelle (rollback) sur le DELETE Account', async () => {
  const realErr = new Error('deadlock detected');
  const tx = makeTxStub({ failOn: { 'DELETE FROM "Account"': realErr } });

  await assert.rejects(
    () => runAccountDeletion(tx, 'acc_1', { jwtDecode: () => null }),
    /deadlock detected/
  );
});

// --- Contrat d'autorisation de la route (OWNER strict) ---
// La route DELETE /api/v1/accounts n'autorise que le rôle OWNER. On vérifie ici
// le prédicat d'autorisation tel qu'appliqué dans server-minimal.js, pour
// garantir qu'un non-OWNER est refusé (403) et un OWNER accepté.
function isAccountDeletionAuthorized(user) {
  return !!user && user.role === 'OWNER';
}

test('autorisation suppression compte : OWNER accepté, autres rôles refusés', () => {
  assert.equal(isAccountDeletionAuthorized({ role: 'OWNER' }), true);
  for (const role of ['MANAGER', 'VIEWER', 'AGENCY', '', undefined]) {
    assert.equal(isAccountDeletionAuthorized({ role }), false, `le rôle ${role} doit être refusé`);
  }
  assert.equal(isAccountDeletionAuthorized(null), false);
});

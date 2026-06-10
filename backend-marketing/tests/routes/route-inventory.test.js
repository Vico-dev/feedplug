// Filet de sécurité pour l'extraction des domaines hors de server-minimal.js :
// l'inventaire des routes (méthode + chemin) doit rester identique au snapshot.
// Si une route est ajoutée/supprimée volontairement, régénérer le snapshot :
//   node scripts/list-routes.js > tests/routes/route-inventory.snapshot.json
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

test("l'inventaire des routes Express correspond au snapshot", () => {
  const backendRoot = path.join(__dirname, '..', '..');
  const snapshotPath = path.join(__dirname, 'route-inventory.snapshot.json');
  const expected = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

  const stdout = execFileSync(process.execPath, [path.join(backendRoot, 'scripts', 'list-routes.js')], {
    cwd: backendRoot,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const actual = JSON.parse(stdout);

  const missing = expected.filter((r) => !actual.includes(r));
  const added = actual.filter((r) => !expected.includes(r));
  assert.deepEqual(
    { missing, added },
    { missing: [], added: [] },
    `Routes disparues: ${JSON.stringify(missing)} — Routes apparues: ${JSON.stringify(added)}. ` +
    'Si le changement est volontaire, régénérez le snapshot (voir en-tête du test).'
  );
});

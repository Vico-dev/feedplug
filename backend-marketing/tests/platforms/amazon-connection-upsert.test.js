const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Garde-fou: les deux UPDATE "PlatformConnection" du flow Amazon
// (callback OAuth ET POST /connect) doivent utiliser COALESCE sur
// merchantid ET refreshtoken — sinon une reconnexion ou un appel
// /connect où selling_partner_id / refresh_token manque écrase la
// valeur stockée et casse les pushes suivants.
//
// Cf. routes/platforms.js, blocs "5c. Redirect URI (callback Amazon OAuth)" et
// "5f. Connexion manuelle (refresh_token)" (extraits de server-minimal.js).

// Les routes Amazon ont été extraites de server-minimal.js vers routes/platforms.js
// (refacto strangler, comportement préservé). On scanne les deux fichiers pour
// rester robuste à l'emplacement exact du code.
const SOURCE_FILES = [
  path.join(__dirname, '..', '..', 'server-minimal.js'),
  path.join(__dirname, '..', '..', 'routes', 'platforms.js'),
];

function extractAmazonUpdates(source) {
  const updateRegex = /UPDATE "PlatformConnection" SET[\s\S]*?WHERE accountid = \$6::text AND platform = 'amazon'/g;
  return source.match(updateRegex) || [];
}

test('les UPDATE PlatformConnection Amazon utilisent COALESCE sur merchantid et refreshtoken', () => {
  const source = SOURCE_FILES.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const updates = extractAmazonUpdates(source);

  assert.equal(updates.length, 2, 'attendu 2 UPDATE Amazon (callback OAuth + POST /connect)');

  for (const stmt of updates) {
    assert.match(
      stmt,
      /merchantid\s*=\s*COALESCE\(\$1::text,\s*merchantid\)/,
      'merchantid doit être protégé par COALESCE'
    );
    assert.match(
      stmt,
      /refreshtoken\s*=\s*COALESCE\(\$3::text,\s*refreshtoken\)/,
      'refreshtoken doit être protégé par COALESCE'
    );
  }
});

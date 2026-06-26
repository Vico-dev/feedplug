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
// Cf. server-minimal.js, blocs "5e. Callback Amazon OAuth" et
// "5f. Connexion manuelle (refresh_token)".

const SERVER_FILE = path.join(__dirname, '..', '..', 'server-minimal.js');

function extractAmazonUpdates(source) {
  const updateRegex = /UPDATE "PlatformConnection" SET[\s\S]*?WHERE accountid = \$6::text AND platform = 'amazon'/g;
  return source.match(updateRegex) || [];
}

test('les UPDATE PlatformConnection Amazon utilisent COALESCE sur merchantid et refreshtoken', () => {
  const source = fs.readFileSync(SERVER_FILE, 'utf8');
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

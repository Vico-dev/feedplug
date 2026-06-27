/**
 * Suppression de compte (RGPD — droit à l'effacement).
 *
 * Logique pure et testable, extraite de la route inline
 * `DELETE /api/v1/accounts` de server-minimal.js :
 *  - `buildAccountDeletionStatements` : produit, dans le BON ordre (enfant ->
 *    parent), les requêtes SQL de suppression. Le schéma Prisma pose
 *    `onDelete: Cascade` sur la plupart des relations vers Account, donc la
 *    suppression de la ligne Account suffit pour celles-là. Mais quelques
 *    relations n'ont PAS de cascade (FeedSource, Feed, ExportLog) et la chaîne
 *    des feeds (FeedItem, IngestionRun, FeedError, EnrichmentSource,
 *    FeedItemRevision) doit être nettoyée manuellement avant de supprimer
 *    l'Account, sinon violation de clé étrangère. StoreLocation /
 *    LocalInventory n'ont pas de FK mais portent un accountid : on les efface
 *    aussi pour ne laisser aucune donnée résiduelle.
 *  - `collectTokensToRevoke` : extrait les jti (access + refresh) à insérer
 *    dans RevokedJti pour révoquer la session courante de l'appelant, comme le
 *    fait /auth/logout.
 */

/**
 * @param {string} accountId
 * @returns {Array<{ sql: string, args: string[], allowMissingTable: boolean }>}
 *   Liste ordonnée de requêtes DELETE. `allowMissingTable` indique qu'une
 *   erreur "table inexistante" (42P01) peut être ignorée pour cette requête.
 *   La toute dernière requête (DELETE Account) ne tolère PAS l'absence de table.
 */
function buildAccountDeletionStatements(accountId) {
  const child = (sql) => ({ sql, args: [accountId], allowMissingTable: true });
  return [
    // 1) Chaîne des feeds (enfant -> parent).
    child(`
      DELETE FROM "FeedError"
      WHERE runid IN (
        SELECT r.id FROM "IngestionRun" r
        JOIN "Feed" f ON f.id = r.feedid
        WHERE f.accountid = $1::text
      )
    `),
    child(`
      DELETE FROM "IngestionRun"
      WHERE feedid IN (SELECT id FROM "Feed" WHERE accountid = $1::text)
    `),
    child(`
      DELETE FROM "FeedItemRevision"
      WHERE feeditemid IN (
        SELECT fi.id FROM "FeedItem" fi
        JOIN "Feed" f ON f.id = fi.feedid
        WHERE f.accountid = $1::text
      )
    `),
    child(`
      DELETE FROM "FeedItem"
      WHERE feedid IN (SELECT id FROM "Feed" WHERE accountid = $1::text)
    `),
    child(`DELETE FROM "EnrichmentSource" WHERE accountid = $1::text`),
    child(`DELETE FROM "Feed" WHERE accountid = $1::text`),
    // 2) FeedSource (FK non-cascade).
    child(`DELETE FROM "FeedSource" WHERE accountid = $1::text`),
    // 3) ExportLog (FK non-cascade).
    child(`DELETE FROM "ExportLog" WHERE accountid = $1::text`),
    // 4) Tables sans FK vers Account mais portant accountid (RGPD).
    child(`DELETE FROM "LocalInventory" WHERE accountid = $1::text`),
    child(`DELETE FROM "StoreLocation" WHERE accountid = $1::text`),
    // 5) L'Account : la cascade Prisma efface User, Market, Destination,
    //    PlatformAccount, PlatformConnection, Billing, OnboardingProgress,
    //    Rule, ExportChannel, BulkEditOperation, ABTest, ChannelScoringConfig...
    { sql: `DELETE FROM "Account" WHERE id = $1::text`, args: [accountId], allowMissingTable: false },
  ];
}

/**
 * Construit les entrées RevokedJti à insérer pour la session de l'appelant.
 *
 * @param {object} params
 * @param {string} [params.authorizationHeader] - en-tête "Bearer <jwt>".
 * @param {string} [params.refreshToken] - refresh token éventuel (body).
 * @param {(token: string) => any} jwtDecode - jwt.decode (sans vérif signature).
 * @returns {Array<{ jti: string, userId: string|null, exp: number }>}
 */
function collectTokensToRevoke({ authorizationHeader, refreshToken } = {}, jwtDecode) {
  const out = [];
  const add = (token) => {
    if (!token) return;
    const decoded = jwtDecode(token);
    if (decoded && decoded.jti && typeof decoded.exp === 'number') {
      out.push({ jti: decoded.jti, userId: decoded.id || null, exp: decoded.exp });
    }
  };
  const access = authorizationHeader && authorizationHeader.split(' ')[1];
  add(access);
  add(refreshToken);
  return out;
}

/**
 * Indique si une erreur SQL correspond à une table inexistante (Postgres 42P01).
 * @param {Error|{message?: string}} err
 * @returns {boolean}
 */
function isMissingTableError(err) {
  return /42P01|does not exist|relation .* does not exist/i.test(err?.message || '');
}

/**
 * Exécute la suppression complète d'un compte à l'intérieur d'une transaction
 * Prisma (`tx`) déjà ouverte par l'appelant. Effectue, dans l'ordre :
 *  1. toutes les requêtes de `buildAccountDeletionStatements` (enfants -> Account),
 *  2. l'insertion des jti de l'appelant dans RevokedJti (révocation de session).
 *
 * Les requêtes tolérant l'absence de table ignorent l'erreur 42P01 ; toute
 * autre erreur remonte et fait échouer (rollback) la transaction.
 *
 * @param {{ $executeRawUnsafe: (sql: string, ...args: any[]) => Promise<any> }} tx
 * @param {string} accountId
 * @param {object} opts
 * @param {string} [opts.authorizationHeader]
 * @param {string} [opts.refreshToken]
 * @param {(token: string) => any} opts.jwtDecode
 * @param {(message: string) => void} [opts.onMissingTableWarn]
 * @returns {Promise<{ deletedStatements: number, revokedJtis: string[] }>}
 */
async function runAccountDeletion(tx, accountId, opts = {}) {
  const { authorizationHeader, refreshToken, jwtDecode, onMissingTableWarn } = opts;

  const exec = async ({ sql, args, allowMissingTable }) => {
    try {
      await tx.$executeRawUnsafe(sql, ...args);
    } catch (err) {
      if (allowMissingTable && isMissingTableError(err)) {
        if (onMissingTableWarn) onMissingTableWarn(err?.message || '');
        return;
      }
      throw err;
    }
  };

  const statements = buildAccountDeletionStatements(accountId);
  for (const statement of statements) {
    await exec(statement);
  }

  const tokens = collectTokensToRevoke({ authorizationHeader, refreshToken }, jwtDecode);
  for (const { jti, userId, exp } of tokens) {
    await exec({
      sql: `
        INSERT INTO "RevokedJti" (jti, userid, expiresat, createdat)
        VALUES ($1::text, $2::text, to_timestamp($3), NOW())
        ON CONFLICT (jti) DO NOTHING
      `,
      args: [jti, userId, exp],
      allowMissingTable: true,
    });
  }

  return {
    deletedStatements: statements.length,
    revokedJtis: tokens.map((t) => t.jti),
  };
}

module.exports = {
  buildAccountDeletionStatements,
  collectTokensToRevoke,
  isMissingTableError,
  runAccountDeletion,
};

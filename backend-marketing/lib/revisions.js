/**
 * Historisation FeedItem : snapshot et révisions pour rollback / retour au flux.
 * Réf. backend-marketing/docs/PLAN_MOTEUR_REGLES_EDITION_MASSE.md
 */

const { randomBytes } = require('crypto');

const REVISION_SOURCE = ['ingestion', 'rule', 'bulk_edit', 'manual', 'restore'];

/** Champs FeedItem + customfields à inclure dans un snapshot (pour restore) */
const SNAPSHOT_FIELDS = [
  'title', 'descriptionHtml', 'descriptionText', 'imageUrl', 'brand', 'sku',
  'price', 'currency', 'inventory', 'url', 'gtin', 'mpn', 'condition',
  'customfields'
];

/**
 * Construit un snapshot JSON d'un item pour une révision (valeurs modifiables uniquement).
 * @param {object} item - Objet FeedItem (colonnes snake_case ou camelCase)
 * @returns {object} snapshot pour snapshotjson
 */
function buildItemSnapshot(item) {
  const snap = {};
  const raw = item && typeof item === 'object' ? item : {};
  const customfields = raw.customfields ?? raw.customFields ?? raw.custom_fields;
  for (const f of SNAPSHOT_FIELDS) {
    const key = f === 'customfields' ? f : (raw[f] !== undefined ? f : (raw[snake(f)] !== undefined ? snake(f) : f));
    const val = key === 'customfields' ? customfields : (raw[key] ?? raw[camel(key)]);
    if (val !== undefined && val !== null) {
      snap[f] = typeof val === 'object' && val !== null ? JSON.parse(JSON.stringify(val)) : val;
    }
  }
  if (typeof raw.customfields === 'object' && raw.customfields !== null && !snap.customfields) {
    snap.customfields = JSON.parse(JSON.stringify(raw.customfields));
  }
  return snap;
}

function snake(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}
function camel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Erreur PostgreSQL / Prisma : relation (table) inexistante */
function isRelationNotFoundError(e) {
  const code = e?.code || e?.meta?.code;
  const msg = (e?.message || '').toLowerCase();
  return code === 'P2010' || code === '42P01' || msg.includes('relation') && msg.includes('does not exist');
}

/**
 * Crée une révision pour un FeedItem avant modification.
 * Si la table FeedItemRevision n'existe pas (migration non appliquée), ne lève pas d'erreur et retourne null.
 * @param {object} prisma - Prisma client
 * @param {string} feedItemId - ID FeedItem
 * @param {object} snapshot - Objet snapshot (buildItemSnapshot ou équivalent)
 * @param {string} source - 'ingestion' | 'rule' | 'bulk_edit' | 'manual' | 'restore'
 * @param {string} [operationId] - ID BulkEditOperation si source === 'bulk_edit'
 * @returns {Promise<string|null>} id de la révision créée, ou null si table absente
 */
async function createRevision(prisma, feedItemId, snapshot, source, operationId = null) {
  if (!REVISION_SOURCE.includes(source)) {
    throw new Error(`Invalid revision source: ${source}`);
  }
  const id = 'rev_' + randomBytes(12).toString('hex');
  const snapshotJson = JSON.stringify(snapshot && typeof snapshot === 'object' ? snapshot : {});
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "FeedItemRevision" (id, feeditemid, snapshotjson, source, operationid, createdat)
      VALUES ($1::text, $2::text, $3::jsonb, $4::text, $5::text, NOW())
    `, id, feedItemId, snapshotJson, source, operationId || null);
    return id;
  } catch (e) {
    if (isRelationNotFoundError(e)) {
      return null;
    }
    throw e;
  }
}

/**
 * Récupère la dernière révision avec source = 'ingestion' pour un item (pour "retour au flux").
 * @param {object} prisma
 * @param {string} feedItemId
 * @returns {Promise<object|null>} révision ou null
 */
async function getLastIngestionRevision(prisma, feedItemId) {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, snapshotjson, createdat
      FROM "FeedItemRevision"
      WHERE feeditemid = $1::text AND source = 'ingestion'
      ORDER BY createdat DESC
      LIMIT 1
    `, feedItemId);
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    if (isRelationNotFoundError(e)) return null;
    throw e;
  }
}

/**
 * Liste les révisions d'un item (pour l'UI historique).
 * @param {object} prisma
 * @param {string} feedItemId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function listRevisions(prisma, feedItemId, limit = 50) {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, snapshotjson, source, operationid, createdat
      FROM "FeedItemRevision"
      WHERE feeditemid = $1::text
      ORDER BY createdat DESC
      LIMIT $2::int
    `, feedItemId, limit);
    return (rows || []).map(r => ({
      id: r.id,
      snapshot: r.snapshotjson,
      source: r.source,
      operationId: r.operationid,
      createdAt: r.createdat
    }));
  } catch (e) {
    if (isRelationNotFoundError(e)) return [];
    throw e;
  }
}

/**
 * Récupère une révision par ID (pour restore).
 * @param {object} prisma
 * @param {string} revisionId
 * @param {string} feedItemId - optionnel, pour vérifier que la révision appartient à l'item
 * @returns {Promise<object|null>} { id, feeditemid, snapshotjson, source, createdat } ou null
 */
async function getRevisionById(prisma, revisionId, feedItemId = null) {
  try {
    let query = `SELECT id, feeditemid, snapshotjson, source, createdat FROM "FeedItemRevision" WHERE id = $1::text`;
    const params = [revisionId];
    if (feedItemId) {
      query += ` AND feeditemid = $2::text`;
      params.push(feedItemId);
    }
    const rows = await prisma.$queryRawUnsafe(query, ...params);
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    if (isRelationNotFoundError(e)) return null;
    throw e;
  }
}

module.exports = {
  buildItemSnapshot,
  createRevision,
  getLastIngestionRevision,
  listRevisions,
  getRevisionById,
  SNAPSHOT_FIELDS,
  REVISION_SOURCE
};

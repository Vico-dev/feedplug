'use strict';

/**
 * lib/ingest-batch.js — Helpers de batching pour l'ingestion (Sprint 2, B-PROPER).
 *
 * Corrige le N+1 des modules ingestion/{csv,prestashop}.js : avant, chaque
 * produit declenchait un `SELECT ... WHERE feedid AND originid LIMIT 1`. Sur un
 * catalogue de N produits => N requetes SELECT (+ N UPSERT + N revisions).
 *
 * Ici on precharge TOUTES les lignes existantes du feed en UNE requete
 * (`WHERE originid = ANY($1)`), indexee par originId. Le code d'ingestion fait
 * ensuite un lookup O(1) en memoire au lieu d'une requete par produit.
 * L'index unique `uniq_feeditem_feed_origin (feedid, originid)` rend ce
 * preload efficace.
 *
 * Note : on garde les INSERT/UPDATE par produit (le pipeline applique
 * enrichissement + revision par item, difficile a batcher sans regression).
 * Le gain principal — supprimer le N du SELECT — est realise ici. Le chunking
 * (`chunk`) est fourni pour les preloads sur tres gros `originIds` et pour de
 * futures ecritures groupees.
 */

/**
 * Decoupe un tableau en sous-tableaux de taille `size`.
 */
function chunk(arr, size) {
  const out = [];
  const n = Math.max(1, Number(size) || 1);
  for (let i = 0; i < arr.length; i += n) {
    out.push(arr.slice(i, i + n));
  }
  return out;
}

/**
 * Precharge les lignes FeedItem existantes d'un feed pour une liste d'originIds,
 * et renvoie une Map originId -> row. Une seule requete par chunk (defaut 1000
 * ids/chunk pour rester sous les limites de parametres SQL).
 *
 * @param {object}   prisma
 * @param {string}   feedId
 * @param {string[]} originIds
 * @param {object}   [opts]
 * @param {string}   [opts.columns]   - colonnes a selectionner (defaut id, originid, contenthash).
 * @param {number}   [opts.chunkSize] - taille de chunk (defaut 1000).
 * @returns {Promise<Map<string, object>>}
 */
async function preloadExistingByOriginId(prisma, feedId, originIds, opts) {
  opts = opts || {};
  const columns = opts.columns || 'id, originid, contenthash, customfields';
  const chunkSize = opts.chunkSize || 1000;
  const byOriginId = new Map();
  if (!feedId || !Array.isArray(originIds) || originIds.length === 0) return byOriginId;

  // Dedup + normalisation en string (les originId sont stockes en text).
  const uniqueIds = Array.from(new Set(originIds.map((id) => String(id))));

  for (const part of chunk(uniqueIds, chunkSize)) {
    // `= ANY($2::text[])` : un seul SELECT pour tout le chunk.
    const rows = await prisma.$queryRawUnsafe(
      'SELECT ' + columns + ' FROM "FeedItem" WHERE feedid = $1::text AND originid = ANY($2::text[])',
      feedId,
      part
    );
    for (const row of rows || []) {
      // Prisma raw renvoie les colonnes en minuscules (originid).
      const key = row.originid != null ? String(row.originid) : (row.originId != null ? String(row.originId) : null);
      if (key != null) byOriginId.set(key, row);
    }
  }
  return byOriginId;
}

module.exports = {
  chunk: chunk,
  preloadExistingByOriginId: preloadExistingByOriginId,
};

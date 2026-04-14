/**
 * Sources secondaires d'enrichissement
 * Fusion de données externes (CSV/Excel) avec les FeedItems via jointure configurable
 */

const crypto = require('crypto');
const { fetchWithTimeout, DEFAULT_FETCH_TIMEOUT_MS } = require('../lib/resilience');
const { createRevision } = require('../lib/revisions');

async function resolveCsvUrl(config, storage) {
  const gcsPath = config.gcsPath || config.gcspath;
  if (gcsPath && gcsPath.startsWith('gs://') && storage) {
    try {
      const gcsMatch = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
      if (gcsMatch) {
        const [, bucketName, fileName] = gcsMatch;
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(fileName);
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000
        });
        return signedUrl;
      }
    } catch (e) {
      console.warn('Re-sign GCS enrichment source failed:', e.message);
    }
  }
  return config.csvUrl || config.csvurl;
}

async function fetchText(url, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const res = await fetchWithTimeout(url, { method: 'GET', timeoutMs });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return await res.text();
}

/**
 * Parse CSV/Excel (CSV) et retourne les enregistrements
 */
function parseCsv(text) {
  const { parse } = require('csv-parse/sync');
  const firstLines = text.split('\n').slice(0, 5).join('\n');
  const hasTabs = firstLines.includes('\t');
  const delimiter = hasTabs ? '\t' : ',';
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    delimiter,
    quote: '"',
    relax_quotes: true,
    relax_column_count: true
  });
}

/**
 * Construit un index lookup: valeur de la clé de jointure -> { targetField: value }
 */
function buildLookupIndex(records, joinColumn, mappingJson) {
  const index = {};
  for (const row of records) {
    const joinValue = row[joinColumn];
    if (joinValue == null || String(joinValue).trim() === '') continue;
    const key = String(joinValue).trim().toLowerCase();
    if (index[key] === undefined) index[key] = {};
    for (const [targetField, sourceColumn] of Object.entries(mappingJson || {})) {
      if (!sourceColumn) continue;
      const val = row[sourceColumn];
      if (val !== undefined && val !== null && val !== '') {
        index[key][targetField] = val;
      }
    }
  }
  return index;
}

/**
 * Récupère la valeur du champ de jointure pour un FeedItem
 */
function getJoinValue(item, joinKey) {
  const key = (joinKey || 'originId').toLowerCase();
  if (key === 'originid' || key === 'origin_id') return item.originid || item.originId || null;
  if (key === 'sku') return item.sku || null;
  if (key === 'mpn') return item.mpn || null;
  if (key === 'id') return item.originid || item.originId || item.id || null;
  if (item.customfields) {
    const cf = typeof item.customfields === 'string' ? JSON.parse(item.customfields || '{}') : (item.customfields || {});
    return cf[joinKey] || cf[key] || null;
  }
  return null;
}

/**
 * Applique les sources secondaires d'enrichissement à tous les FeedItems d'un flux
 */
async function applyEnrichmentSources(prisma, feedId, accountId, storage = null) {
  if (!prisma || !feedId) throw new Error('prisma et feedId requis');

  const sources = await prisma.$queryRawUnsafe(`
    SELECT id, name, configjson, mappingjson, status
    FROM "EnrichmentSource"
    WHERE feedid = $1::text AND status = 'ACTIVE' AND (accountid = $2::text OR accountid = 'default-account')
    ORDER BY createdat ASC
  `, feedId, accountId || 'default-account');

  if (sources.length === 0) return { applied: 0, sources: 0 };

  const items = await prisma.$queryRawUnsafe(`
    SELECT id, originid, sku, mpn, customfields
    FROM "FeedItem"
    WHERE feedid = $1::text
  `, feedId);

  let totalUpdated = 0;
  const now = new Date().toISOString();

  for (const source of sources) {
    try {
      const config = typeof source.configjson === 'string' ? JSON.parse(source.configjson) : (source.configjson || {});
      const mapping = typeof source.mappingjson === 'string' ? JSON.parse(source.mappingjson) : (source.mappingjson || {});
      const joinKey = config.joinKey || config.joinkey || 'originId';
      const joinColumn = config.joinColumn || config.joincolumn || joinKey;

      const csvUrl = await resolveCsvUrl(config, storage);
      if (!csvUrl || Object.keys(mapping).length === 0) {
        console.warn(`EnrichmentSource ${source.id}: csvUrl ou mapping manquant`);
        continue;
      }

      const text = await fetchText(csvUrl);
      const records = parseCsv(text);
      const lookup = buildLookupIndex(records, joinColumn, mapping);

      const toUpdate = [];
      for (const item of items) {
        const joinVal = getJoinValue(item, joinKey);
        if (!joinVal) continue;
        const lookupKey = String(joinVal).trim().toLowerCase();
        const enrichments = lookup[lookupKey];
        if (!enrichments || Object.keys(enrichments).length === 0) continue;

        let customFields = {};
        if (item.customfields) {
          customFields = typeof item.customfields === 'string' ? JSON.parse(item.customfields) : (item.customfields || {});
        }
        const updated = { ...customFields, ...enrichments };
        toUpdate.push({ id: item.id, customfields: updated });
      }

      const ENRICH_BATCH_SIZE = 100;
      for (let b = 0; b < toUpdate.length; b += ENRICH_BATCH_SIZE) {
        const batch = toUpdate.slice(b, b + ENRICH_BATCH_SIZE);
        const params = [];
        const valueRows = [];
        for (let i = 0; i < batch.length; i++) {
          const { id, customfields } = batch[i];
          const cfStr = JSON.stringify(customfields);
          params.push(id, cfStr, now);
          const base = i * 3;
          valueRows.push(`($${base + 1}::text, $${base + 2}::jsonb, $${base + 3}::timestamptz)`);
        }
        const sql = `UPDATE "FeedItem" f SET customfields = v.customfields, updatedat = v.updatedat FROM (VALUES ${valueRows.join(', ')}) AS v(id, customfields, updatedat) WHERE f.id = v.id`;
        await prisma.$executeRawUnsafe(sql, ...params);
      }

      for (const { id, customfields } of toUpdate) {
        try {
          await createRevision(prisma, id, { customfields }, 'ingestion');
        } catch (revErr) {
          console.warn('Révision enrichment non créée:', revErr.message);
        }
      }
      totalUpdated += toUpdate.length;

      await prisma.$executeRawUnsafe(`
        UPDATE "EnrichmentSource"
        SET lastsyncat = $1::timestamptz, updatedat = $1::timestamptz
        WHERE id = $2::text
      `, now, source.id);

    } catch (err) {
      console.error(`EnrichmentSource ${source.id} (${source.name}) error:`, err.message);
      await prisma.$executeRawUnsafe(`
        UPDATE "EnrichmentSource"
        SET status = 'ERROR', updatedat = $1::timestamptz
        WHERE id = $2::text
      `, now, source.id);
    }
  }

  return { applied: totalUpdated, sources: sources.length };
}

module.exports = {
  applyEnrichmentSources,
  parseCsv,
  buildLookupIndex,
  getJoinValue
};

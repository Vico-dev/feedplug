'use strict';

/**
 * routes/comparator.js — Routes INTERNES du comparateur CSS (Phase 0).
 *
 * Contexte : pour devenir CSS Google, Feedplug opère un comparateur de prix public
 * alimenté par des flux marchands AWIN, tous ingérés sous le compte interne
 * « comparator » (cf. migration 048, env COMPARATOR_ACCOUNT_ID). Ces routes
 * permettent (a) de déclarer une source AWIN + son Feed, (b) de déclencher
 * l'ingestion d'un de ces flux. Le hook post-ingestion (ingestion/csv.js, gardé par
 * COMPARATOR_ACCOUNT_ID) déclenche tout seul le matching + l'historique de prix.
 *
 * Surface volontairement INTERNE/automatisée : préfixe /api/v1/comparator/internal/*
 * (HORS /api/v1/ingestion qui porte requireAuth global), auth par secret partagé
 * (env COMPARATOR_INGEST_SECRET) en header `x-comparator-secret` ou `Authorization:
 * Bearer`, comparé en temps constant. AUCUNE session utilisateur ici.
 *
 * Conventions du repo : pattern registerXxxRoutes(app, deps), SQL brut via
 * `prisma.$queryRawUnsafe` (params typés `$1::text`), ids `crypto.randomUUID()`,
 * colonnes PostgreSQL en minuscules.
 *
 * Les gardes (secret, code pays) sont extraites en helpers PURS exportés pour être
 * testées sans réseau ni DB.
 */

const crypto = require('crypto');

/**
 * Compare deux secrets en temps constant. PUR.
 * Retourne true seulement si les deux sont des chaînes non vides, de même longueur,
 * et égales octet à octet (timingSafeEqual exige des buffers de même longueur).
 */
function checkSecret(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (provided.length === 0 || expected.length === 0) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Normalise un code pays ISO-3166 alpha-2 (2 lettres) en majuscules. PUR.
 * Retourne null si l'entrée n'est pas exactement 2 lettres (ex. 'FRA', '', 'F1').
 */
function normalizeCountryCode(cc) {
  if (typeof cc !== 'string') return null;
  const trimmed = cc.trim();
  if (!/^[A-Za-z]{2}$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

/** Extrait le secret fourni d'un header `x-comparator-secret` ou `authorization: Bearer`. */
function extractProvidedSecret(req) {
  const raw = req.headers['x-comparator-secret'] || req.headers['authorization'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return '';
  return value.replace(/^Bearer\s+/i, '').trim();
}

/** Mapping AWIN par défaut (colonnes du flux marchand AWIN -> champs Feedplug). */
function defaultAwinMapping(overrides) {
  const base = {
    title: 'product_name',
    url: 'aw_deep_link',
    imageUrl: 'merchant_image_url',
    price: 'search_price',
    currency: 'currency',
    gtin: 'product_GTIN',
    mpn: 'mpn',
    brand: 'brand_name',
    sku: 'merchant_product_id',
    inventory: 'in_stock',
    // Identité marchand (flux AWIN combiné = N marchands dans un fichier) -> customfields,
    // sert à compter les marchands par produit dans le comparateur.
    merchant_id: 'merchant_id',
    merchant_name: 'merchant_name',
  };
  if (overrides && typeof overrides === 'object') {
    return { ...base, ...overrides };
  }
  return base;
}

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'revoked'];

/** Valide un statut d'approbation de source AWIN. PUR. */
function isValidApprovalStatus(s) {
  return typeof s === 'string' && APPROVAL_STATUSES.includes(s);
}

function registerComparatorRoutes(app, { getPrisma, getPrismaReady, ingestCsvFromUrl }) {
  const COMPARATOR_ACCOUNT_ID =
    (typeof process.env.COMPARATOR_ACCOUNT_ID === 'string' && process.env.COMPARATOR_ACCOUNT_ID.trim())
      ? process.env.COMPARATOR_ACCOUNT_ID.trim()
      : 'comparator';

  /** Garde commune : secret configuré + fourni + correct. Renvoie true si OK, sinon répond et renvoie false. */
  function ensureAuthorized(req, res) {
    const expected = typeof process.env.COMPARATOR_INGEST_SECRET === 'string'
      ? process.env.COMPARATOR_INGEST_SECRET.trim()
      : '';
    if (!expected) {
      res.status(503).json({ message: 'Comparateur non configuré (secret manquant)' });
      return false;
    }
    if (!checkSecret(extractProvidedSecret(req), expected)) {
      res.status(401).json({ message: 'Non autorisé' });
      return false;
    }
    return true;
  }

  // POST /api/v1/comparator/internal/sources
  // Crée une FeedSource AWIN (CSV) + son Feed sous le compte comparateur.
  app.post('/api/v1/comparator/internal/sources', async (req, res) => {
    const prisma = getPrisma();
    const prismaReady = getPrismaReady();
    try {
      if (!ensureAuthorized(req, res)) return;
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      const body = req.body || {};
      const { name, csvUrl, advertiserId, scheduleTime, mappingJson } = body;
      if (!name || !csvUrl) {
        return res.status(400).json({ message: 'name et csvUrl sont requis' });
      }

      const countryCode = normalizeCountryCode(body.countryCode);
      if (!countryCode) {
        return res.status(400).json({ message: 'countryCode invalide (attendu ISO-3166 alpha-2, ex. FR)' });
      }

      const sourceId = crypto.randomUUID();
      const feedId = crypto.randomUUID();
      const now = new Date().toISOString();
      const configJson = JSON.stringify({
        csvUrl: String(csvUrl),
        provider: 'awin',
        advertiserId: advertiserId != null ? String(advertiserId) : null,
      });
      const mapping = JSON.stringify(defaultAwinMapping(mappingJson));
      const scheduleTimeValue = (typeof scheduleTime === 'string' && scheduleTime.trim()) ? scheduleTime.trim() : null;

      // FeedSource — insert défensif : la colonne `scheduletime` peut ne pas exister
      // selon l'état des migrations, on retombe sur un insert sans elle.
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, countrycode, scheduletime, accountid, createdat, updatedat)
          VALUES ($1::text, $2::text, 'CSV'::text, $3::jsonb, 'DAILY'::text, 'ACTIVE'::text, $4::text, $5::text, $6::text, $7::timestamptz, $7::timestamptz)
        `, sourceId, name, configJson, countryCode, scheduleTimeValue, COMPARATOR_ACCOUNT_ID, now);
      } catch (e) {
        if (e?.code === 'P2010' || /scheduletime/i.test(e?.message || '')) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, countrycode, accountid, createdat, updatedat)
            VALUES ($1::text, $2::text, 'CSV'::text, $3::jsonb, 'DAILY'::text, 'ACTIVE'::text, $4::text, $5::text, $6::timestamptz, $6::timestamptz)
          `, sourceId, name, configJson, countryCode, COMPARATOR_ACCOUNT_ID, now);
        } else {
          throw e;
        }
      }

      await prisma.$executeRawUnsafe(`
        INSERT INTO "Feed" (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, accountid, createdat, updatedat)
        VALUES ($1::text, $2::text, $3::text, 'DAILY'::text, 'ACTIVE'::text, $4::jsonb, 'guid_or_url'::text, $5::text, $6::timestamptz, $6::timestamptz)
      `, feedId, `Flux AWIN - ${name}`, sourceId, mapping, COMPARATOR_ACCOUNT_ID, now);

      return res.status(201).json({
        sourceId,
        feedId,
        accountId: COMPARATOR_ACCOUNT_ID,
        countryCode,
      });
    } catch (e) {
      console.error('Comparator create source error:', e);
      return res.status(500).json({ message: e.message || 'Erreur création source comparateur' });
    }
  });

  // POST /api/v1/comparator/internal/ingest
  // Déclenche l'ingestion CSV d'un flux comparateur (le hook post-ingestion fait le reste).
  app.post('/api/v1/comparator/internal/ingest', async (req, res) => {
    const prisma = getPrisma();
    const prismaReady = getPrismaReady();
    try {
      if (!ensureAuthorized(req, res)) return;
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      const feedId = req.body && req.body.feedId;
      if (!feedId || typeof feedId !== 'string') {
        return res.status(400).json({ message: 'feedId requis' });
      }

      const rows = await prisma.$queryRawUnsafe(`
        SELECT f.id AS feedid, f.accountid AS accountid, fs.configjson AS configjson
        FROM "Feed" f
        JOIN "FeedSource" fs ON fs.id = f.sourceid
        WHERE f.id = $1::text
        LIMIT 1
      `, feedId);
      const row = rows && rows[0];
      if (!row) {
        return res.status(404).json({ message: 'Flux introuvable' });
      }

      // Garde d'isolation : seul le compte comparateur est ingérable par cette route.
      if (row.accountid !== COMPARATOR_ACCOUNT_ID) {
        return res.status(403).json({ message: 'Flux hors périmètre comparateur' });
      }

      let config = row.configjson;
      if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch { config = {}; }
      }
      const csvUrl = config && typeof config === 'object' ? config.csvUrl : null;
      if (!csvUrl) {
        return res.status(400).json({ message: 'csvUrl absent de la configuration de la source' });
      }

      const result = await ingestCsvFromUrl({ prisma, feed: { id: row.feedid }, csvUrl });
      return res.status(200).json({ feedId: row.feedid, result });
    } catch (e) {
      console.error('Comparator ingest error:', e);
      return res.status(500).json({ message: e.message || 'Erreur ingestion comparateur' });
    }
  });

  // POST /api/v1/comparator/internal/sources/:id/approval — change le statut d'approbation AWIN.
  // Seules les sources 'approved' voient leurs offres affichées (gating au matching).
  app.post('/api/v1/comparator/internal/sources/:id/approval', async (req, res) => {
    const prisma = getPrisma();
    const prismaReady = getPrismaReady();
    try {
      if (!ensureAuthorized(req, res)) return;
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
      const status = req.body && req.body.status;
      if (!isValidApprovalStatus(status)) {
        return res.status(400).json({ message: `status invalide (attendu : ${APPROVAL_STATUSES.join(', ')})` });
      }
      const updated = await prisma.$executeRawUnsafe(`
        UPDATE "FeedSource" SET approvalstatus = $1::text, updatedat = NOW()
        WHERE id = $2::text AND accountid = $3::text
      `, status, req.params.id, COMPARATOR_ACCOUNT_ID);
      if (!updated) {
        return res.status(404).json({ message: 'Source introuvable (hors périmètre comparateur)' });
      }
      return res.status(200).json({ sourceId: req.params.id, approvalStatus: status });
    } catch (e) {
      console.error('Comparator approval error:', e);
      return res.status(500).json({ message: e.message || 'Erreur mise à jour approbation' });
    }
  });
}

module.exports = {
  registerComparatorRoutes,
  // helpers purs (testables sans réseau ni DB)
  checkSecret,
  normalizeCountryCode,
  extractProvidedSecret,
  defaultAwinMapping,
  isValidApprovalStatus,
};

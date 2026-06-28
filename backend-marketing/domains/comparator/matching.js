'use strict';

/**
 * domains/comparator/matching.js — Matching produit cross-marchands pour le comparateur CSS.
 *
 * Contexte : pour devenir CSS Google, Feedplug opère un comparateur de prix public
 * alimenté par des flux marchands (AWIN), tous ingérés sous le compte interne
 * « comparator ». Chaque `FeedItem` ingéré = une offre marchand ; le rôle de ce
 * module est de regrouper les offres d'un MÊME produit sous un `ProductGroup`
 * (produit canonique), pour pouvoir afficher « ce produit chez N marchands ».
 *
 * Matching en CASCADE, du plus sûr au plus flou :
 *   1. GTIN/EAN exact      (confiance 95) — clé universelle, find-or-create idempotent.
 *   2. MPN + marque        (confiance 88) — fallback sans GTIN.
 *   3. Titre fuzzy + marque (confiance 70) — trigrammes pg_trgm, gardé par marque.
 *   4. Sinon : nouveau groupe « seed » (l'offre crée son propre produit canonique).
 *
 * Conventions du repo : fonctions pures + SQL brut via `prisma.$queryRawUnsafe`
 * (params typés `$1::text`), ids générés via `crypto.randomUUID()`, colonnes
 * PostgreSQL en minuscules. `prisma` est injecté en premier argument.
 *
 * Idempotent : ré-exécuter la réconciliation sur un flux ré-attache les offres aux
 * mêmes groupes (GTIN via ON CONFLICT, MPN/fuzzy via lookup).
 */

const crypto = require('crypto');

const CONFIDENCE = { gtin: 95, mpn_brand: 88, fuzzy_title: 70, seed: 100 };
// Similarité trigramme minimale (pg_trgm) pour rapprocher deux titres de la même marque.
const FUZZY_SIM_THRESHOLD = 0.55;

/** Retire les accents d'une chaîne (NFD + suppression des diacritiques). */
function stripAccents(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normalise un GTIN/EAN : ne garde que les chiffres, valide la longueur
 * (8/12/13/14) et aligne sur GTIN-14 (left-pad), pour que l'UPC-12 et l'EAN-13
 * d'un même produit tombent sur la même clé. Retourne null si invalide.
 */
function normalizeGtin(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  if (/^0+$/.test(digits)) return null; // que des zéros = bidon
  return digits.padStart(14, '0');
}

/** Normalise un titre pour le matching fuzzy : minuscules, sans accents ni ponctuation. */
function normalizeTitle(raw) {
  if (!raw) return '';
  return stripAccents(String(raw).toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise une marque (minuscules, sans accents ni ponctuation). */
function normalizeBrand(raw) {
  if (!raw) return null;
  const b = stripAccents(String(raw).toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
  return b || null;
}

/**
 * GTIN : find-or-create idempotent via la contrainte unique (accountid, gtin).
 * ON CONFLICT DO UPDATE (touche updatedat) garantit un RETURNING id dans tous les cas.
 */
async function findOrCreateGroupByGtin(prisma, accountId, gtin, item) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const title = item.title || item.originid || item.id;
  const rows = await prisma.$queryRawUnsafe(`
    INSERT INTO "ProductGroup" (id, accountid, gtin, canonicaltitle, normtitle, brand, imageurl, category, offercount, createdat, updatedat)
    VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, NULL, 0, $8::timestamptz, $8::timestamptz)
    ON CONFLICT (accountid, gtin) DO UPDATE SET updatedat = EXCLUDED.updatedat
    RETURNING id
  `, id, accountId, gtin, title, normalizeTitle(title), item.brand || null, item.imageurl || null, now);
  return rows[0].id;
}

/** Cherche un groupe existant via une offre déjà rattachée ayant le même MPN + marque. */
async function findGroupByMpnBrand(prisma, accountId, mpn, brand) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT fi.groupid
    FROM "FeedItem" fi
    JOIN "Feed" f ON f.id = fi.feedid
    WHERE f.accountid = $1::text
      AND fi.groupid IS NOT NULL
      AND lower(fi.mpn) = lower($2::text)
      AND lower(coalesce(fi.brand, '')) = lower($3::text)
    ORDER BY fi.groupid ASC
    LIMIT 1
  `, accountId, mpn, brand);
  return rows[0]?.groupid || null;
}

/**
 * Cherche un groupe existant (sans GTIN) dont le titre canonique est proche du titre
 * de l'offre, à marque égale. Utilise la similarité trigramme pg_trgm.
 */
async function findGroupByFuzzyTitle(prisma, accountId, normTitle, brandRaw) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, similarity(normtitle, $2::text) AS sim
    FROM "ProductGroup"
    WHERE accountid = $1::text
      AND gtin IS NULL
      AND normtitle IS NOT NULL
      AND ($3::text IS NULL OR lower(coalesce(brand, '')) = lower($3::text))
      AND normtitle % $2::text
      AND similarity(normtitle, $2::text) >= $4::double precision
    ORDER BY sim DESC
    LIMIT 1
  `, accountId, normTitle, brandRaw || null, FUZZY_SIM_THRESHOLD);
  return rows[0]?.id || null;
}

/** Crée un nouveau produit canonique (sans GTIN) — l'offre « seed » d'un produit. */
async function createGroup(prisma, accountId, item) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const title = item.title || item.originid || item.id;
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ProductGroup" (id, accountid, gtin, canonicaltitle, normtitle, brand, imageurl, category, offercount, createdat, updatedat)
    VALUES ($1::text, $2::text, NULL, $3::text, $4::text, $5::text, $6::text, NULL, 0, $7::timestamptz, $7::timestamptz)
  `, id, accountId, title, normalizeTitle(title), item.brand || null, item.imageurl || null, now);
  return id;
}

/** Rattache une offre (FeedItem) à un groupe + trace la stratégie/confiance. */
async function attachItemToGroup(prisma, itemId, groupId, strategy, confidence) {
  await prisma.$executeRawUnsafe(`
    UPDATE "FeedItem"
    SET groupid = $1::text, matchstrategy = $2::text, matchconfidence = $3::int
    WHERE id = $4::text
  `, groupId, strategy, confidence, itemId);
}

/**
 * Recalcule les champs dénormalisés d'un groupe à partir de ses offres :
 * nombre d'offres, prix le plus bas, devise, et complète titre/image/marque si vides.
 */
async function refreshGroupAggregates(prisma, groupId) {
  // 1. Champs globaux du produit canonique : nb d'offres + complétion titre/image/marque.
  //    (Le prix n'est PLUS ici : il est par pays, cf. étape 2 — devises jamais mélangées.)
  await prisma.$executeRawUnsafe(`
    UPDATE "ProductGroup" pg SET
      offercount = sub.cnt,
      canonicaltitle = COALESCE(NULLIF(pg.canonicaltitle, ''), sub.sample_title),
      imageurl = COALESCE(pg.imageurl, sub.sample_image),
      brand = COALESCE(pg.brand, sub.sample_brand),
      updatedat = NOW()
    FROM (
      SELECT
        count(*)::int AS cnt,
        (array_agg(title)    FILTER (WHERE title IS NOT NULL))[1]    AS sample_title,
        (array_agg(imageurl) FILTER (WHERE imageurl IS NOT NULL))[1] AS sample_image,
        (array_agg(brand)    FILTER (WHERE brand IS NOT NULL))[1]    AS sample_brand
      FROM "FeedItem"
      WHERE groupid = $1::text
    ) sub
    WHERE pg.id = $1::text
  `, groupId);

  // 2. Prix le plus bas PAR PAYS (jointure FeedSource.countrycode, filtre price > 0).
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ProductGroupCountryPrice" (groupid, countrycode, lowestprice, currency, offercount, updatedat)
    SELECT
      $1::text,
      COALESCE(fs.countrycode, '') AS cc,
      min(fi.price) AS lowestprice,
      (array_agg(fi.currency ORDER BY fi.price ASC NULLS LAST) FILTER (WHERE fi.currency IS NOT NULL))[1] AS currency,
      count(*)::int AS offercount,
      NOW()
    FROM "FeedItem" fi
    JOIN "Feed" f        ON f.id = fi.feedid
    JOIN "FeedSource" fs ON fs.id = f.sourceid
    WHERE fi.groupid = $1::text AND fi.price > 0
    GROUP BY COALESCE(fs.countrycode, '')
    ON CONFLICT (groupid, countrycode)
    DO UPDATE SET lowestprice = EXCLUDED.lowestprice, currency = EXCLUDED.currency,
                  offercount = EXCLUDED.offercount, updatedat = EXCLUDED.updatedat
  `, groupId);

  // 3. Purge des lignes pays devenues vides (offres retirées ou prix tombés à 0).
  await prisma.$executeRawUnsafe(`
    DELETE FROM "ProductGroupCountryPrice" pgcp
    WHERE pgcp.groupid = $1::text
      AND NOT EXISTS (
        SELECT 1 FROM "FeedItem" fi
        JOIN "Feed" f        ON f.id = fi.feedid
        JOIN "FeedSource" fs ON fs.id = f.sourceid
        WHERE fi.groupid = $1::text AND fi.price > 0
          AND COALESCE(fs.countrycode, '') = pgcp.countrycode
      )
  `, groupId);
}

/**
 * Réconcilie UNE offre : applique la cascade et rattache l'offre à son produit canonique.
 * `item` attend les colonnes brutes (minuscules) : id, originid, title, brand, gtin, mpn, imageurl, price, currency.
 * Retourne l'id du groupe.
 */
async function reconcileItem(prisma, accountId, item) {
  // 1. GTIN exact
  const gtin = normalizeGtin(item.gtin);
  if (gtin) {
    const groupId = await findOrCreateGroupByGtin(prisma, accountId, gtin, item);
    await attachItemToGroup(prisma, item.id, groupId, 'gtin', CONFIDENCE.gtin);
    await refreshGroupAggregates(prisma, groupId);
    return groupId;
  }

  // 2. MPN + marque
  if (item.mpn && item.brand) {
    const found = await findGroupByMpnBrand(prisma, accountId, item.mpn, item.brand);
    if (found) {
      await attachItemToGroup(prisma, item.id, found, 'mpn_brand', CONFIDENCE.mpn_brand);
      await refreshGroupAggregates(prisma, found);
      return found;
    }
  }

  // 3. Titre fuzzy (gardé par marque)
  const normTitle = normalizeTitle(item.title);
  if (normTitle) {
    const found = await findGroupByFuzzyTitle(prisma, accountId, normTitle, item.brand);
    if (found) {
      await attachItemToGroup(prisma, item.id, found, 'fuzzy_title', CONFIDENCE.fuzzy_title);
      await refreshGroupAggregates(prisma, found);
      return found;
    }
  }

  // 4. Aucun match : l'offre crée son propre produit canonique.
  const groupId = await createGroup(prisma, accountId, item);
  await attachItemToGroup(prisma, item.id, groupId, 'seed', CONFIDENCE.seed);
  await refreshGroupAggregates(prisma, groupId);
  return groupId;
}

/**
 * Réconcilie toutes les offres d'un flux (compte comparateur). Appelé en hook
 * post-ingestion. Best-effort par offre : une offre en erreur ne bloque pas le reste.
 */
async function reconcileFeed(prisma, feedId, accountId, opts = {}) {
  const limit = opts.limit || 5000;
  const items = await prisma.$queryRawUnsafe(`
    SELECT id, originid, title, brand, gtin, mpn, imageurl, price, currency
    FROM "FeedItem"
    WHERE feedid = $1::text
    ORDER BY updatedat DESC NULLS LAST
    LIMIT $2::int
  `, feedId, limit);

  let matched = 0;
  for (const it of items) {
    try {
      await reconcileItem(prisma, accountId, {
        id: it.id,
        originid: it.originid,
        title: it.title,
        brand: it.brand,
        gtin: it.gtin,
        mpn: it.mpn,
        imageurl: it.imageurl,
        price: it.price != null ? Number(it.price) : null,
        currency: it.currency,
      });
      matched++;
    } catch (e) {
      console.warn(`⚠️  Matching comparateur échoué pour l'offre ${it.id}:`, e.message);
    }
  }
  return { total: items.length, matched };
}

/**
 * Détache toutes les offres d'un flux de leurs produits canoniques (groupid = NULL) et
 * rafraîchit les agrégats des groupes impactés. Utilisé quand la source n'est pas
 * « approved » (gating AWIN : licence révocable / opt-out CSS) — les offres ne doivent
 * alors pas apparaître au comparateur.
 */
async function detachFeed(prisma, feedId) {
  const affected = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT groupid FROM "FeedItem" WHERE feedid = $1::text AND groupid IS NOT NULL`,
    feedId
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "FeedItem" SET groupid = NULL, matchstrategy = NULL, matchconfidence = NULL WHERE feedid = $1::text`,
    feedId
  );
  for (const row of affected) {
    if (row.groupid) await refreshGroupAggregates(prisma, row.groupid);
  }
  return { detached: affected.length };
}

module.exports = {
  // helpers purs (testables sans DB)
  stripAccents,
  normalizeGtin,
  normalizeTitle,
  normalizeBrand,
  // réconciliation (DI : prisma en 1er argument)
  reconcileItem,
  reconcileFeed,
  detachFeed,
  CONFIDENCE,
  FUZZY_SIM_THRESHOLD,
};

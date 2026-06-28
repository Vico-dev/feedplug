'use strict';

/**
 * domains/comparator-account/watchlist.js — Watchlist (« Mes produits ») d'un user conso.
 *
 * Suivre le prix d'un produit (ProductGroup) dans un pays. À l'ajout, on fige le prix
 * courant le plus bas (priceatadd) pour mesurer la baisse depuis le suivi.
 * Gating AWIN conservé : on ne considère que les offres de sources 'approved' (ou opt-in
 * comparateur), cohérent avec routes/comparateur.js.
 *
 * Conventions du repo : SQL brut via `prisma.$queryRawUnsafe` / `$executeRawUnsafe`
 * (params typés), colonnes minuscules, `prisma` injecté en 1er argument, ids randomUUID().
 * `normCountry` / `computeDrop` sont PURS (testables sans DB).
 */

const crypto = require('crypto');

/** Normalise un code pays ISO-2 majuscule, défaut 'FR'. PUR. */
function normCountry(raw) {
  if (typeof raw === 'string' && /^[A-Za-z]{2}$/.test(raw.trim())) return raw.trim().toUpperCase();
  return 'FR';
}

/**
 * Calcule la baisse (en %) entre le prix au moment du suivi et le prix courant.
 * Négatif = baisse. Retourne null si non calculable. PUR.
 * @param {number|null} priceAtAdd
 * @param {number|null} current
 * @returns {number|null}
 */
function computeDrop(priceAtAdd, current) {
  const a = Number(priceAtAdd);
  const c = Number(current);
  if (!(a > 0) || !(c > 0)) return null;
  return Math.round(((c - a) / a) * 1000) / 10;
}

/**
 * Prix courant le plus bas d'un produit dans un pays (gating AWIN), ou null.
 * @returns {{ price: number, currency: string|null } | null}
 */
async function getCurrentLowest(prisma, accountId, groupId, country) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT min(fi.price) AS lowestprice,
           (array_agg(fi.currency ORDER BY fi.price ASC NULLS LAST) FILTER (WHERE fi.currency IS NOT NULL))[1] AS currency
    FROM "FeedItem" fi
    JOIN "Feed" f        ON f.id = fi.feedid
    JOIN "FeedSource" fs ON fs.id = f.sourceid
    JOIN "Account" a     ON a.id = f.accountid
    WHERE fi.groupid = $1::text
      AND fi.price > 0
      AND ((f.accountid = $2::text AND fs.approvalstatus = 'approved') OR a.comparatoroptin = true)
      AND COALESCE(fs.countrycode, '') = $3::text
  `, groupId, accountId, country);
  const r = rows[0];
  if (!r || r.lowestprice == null) return null;
  return { price: Number(r.lowestprice), currency: r.currency || null };
}

/** Vérifie que le ProductGroup existe dans le périmètre comparateur. */
async function groupExists(prisma, accountId, groupId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 AS ok FROM "ProductGroup" WHERE id = $1::text AND accountid = $2::text LIMIT 1`,
    groupId, accountId,
  );
  return rows.length > 0;
}

/**
 * Ajoute (ou réactive) un produit suivi. Capture le prix courant en priceatadd.
 * Idempotent via UNIQUE(userid,groupid,countrycode) ; ne réécrase pas priceatadd si déjà suivi.
 * @returns {{ created: boolean }}
 */
async function addWatch(prisma, accountId, userId, { groupId, country }) {
  const cc = normCountry(country);
  const lowest = await getCurrentLowest(prisma, accountId, groupId, cc);
  const rows = await prisma.$executeRawUnsafe(`
    INSERT INTO "ComparatorWatchlist" (id, userid, groupid, countrycode, priceatadd, currency, createdat)
    VALUES ($1::text, $2::text, $3::text, $4::text, $5::numeric, $6::text, now())
    ON CONFLICT (userid, groupid, countrycode) DO NOTHING
  `, crypto.randomUUID(), userId, groupId, cc,
     lowest ? lowest.price : null, lowest ? lowest.currency : null);
  return { created: rows > 0 };
}

/** Retire un produit suivi (pays optionnel : sans pays, retire toutes les déclinaisons pays). */
async function removeWatch(prisma, userId, { groupId, country }) {
  if (country) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ComparatorWatchlist" WHERE userid = $1::text AND groupid = $2::text AND countrycode = $3::text`,
      userId, groupId, normCountry(country),
    );
  } else {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ComparatorWatchlist" WHERE userid = $1::text AND groupid = $2::text`,
      userId, groupId,
    );
  }
}

/**
 * Liste les produits suivis enrichis du prix courant + baisse depuis le suivi.
 * Joint ProductGroup pour le titre/marque/image. Tri : plus forte baisse d'abord.
 * @returns {Array} items
 */
async function listWatchlist(prisma, accountId, userId) {
  const rows = await prisma.$queryRawUnsafe(`
    WITH lowest AS (
      SELECT fi.groupid,
             COALESCE(fs.countrycode, '') AS countrycode,
             min(fi.price) AS lowestprice,
             (array_agg(fi.currency ORDER BY fi.price ASC NULLS LAST) FILTER (WHERE fi.currency IS NOT NULL))[1] AS currency
      FROM "FeedItem" fi
      JOIN "Feed" f        ON f.id = fi.feedid
      JOIN "FeedSource" fs ON fs.id = f.sourceid
      JOIN "Account" a     ON a.id = f.accountid
      WHERE fi.price > 0
        AND ((f.accountid = $1::text AND fs.approvalstatus = 'approved') OR a.comparatoroptin = true)
      GROUP BY fi.groupid, COALESCE(fs.countrycode, '')
    )
    SELECT w.id, w.groupid, w.countrycode, w.priceatadd, w.currency AS addcurrency, w.createdat,
           pg.canonicaltitle, pg.brand, pg.imageurl,
           l.lowestprice AS currentprice, l.currency AS currentcurrency
    FROM "ComparatorWatchlist" w
    JOIN "ProductGroup" pg ON pg.id = w.groupid AND pg.accountid = $1::text
    LEFT JOIN lowest l ON l.groupid = w.groupid AND l.countrycode = w.countrycode
    WHERE w.userid = $2::text
    ORDER BY w.createdat DESC
  `, accountId, userId);

  const items = rows.map((r) => {
    const priceAtAdd = r.priceatadd != null ? Number(r.priceatadd) : null;
    const currentPrice = r.currentprice != null ? Number(r.currentprice) : null;
    const dropPct = computeDrop(priceAtAdd, currentPrice);
    return {
      id: r.id,
      groupId: r.groupid,
      country: r.countrycode || 'FR',
      title: r.canonicaltitle,
      brand: r.brand,
      imageUrl: r.imageurl,
      priceAtAdd,
      currentPrice,
      currency: r.currentcurrency || r.addcurrency || null,
      dropPct,
      addedAt: r.createdat,
    };
  });
  // Tri produit : plus forte baisse en tête (drop le plus négatif), puis ajout récent.
  items.sort((a, b) => {
    const da = a.dropPct == null ? 0 : a.dropPct;
    const db = b.dropPct == null ? 0 : b.dropPct;
    if (da !== db) return da - db;
    return 0;
  });
  return items;
}

module.exports = {
  normCountry,
  computeDrop,
  getCurrentLowest,
  groupExists,
  addWatch,
  removeWatch,
  listWatchlist,
};

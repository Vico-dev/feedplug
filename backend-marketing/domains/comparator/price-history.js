'use strict';

/**
 * domains/comparator/price-history.js — Historique de prix du comparateur CSS.
 *
 * Objectif produit : faire du comparateur un « vecteur de choix » en répondant à
 * « est-ce le bon moment d'acheter ? » via des signaux dérivés de l'évolution du
 * prix le plus bas de chaque produit (ProductGroup) dans le temps, par pays.
 *
 * Deux niveaux :
 *   - Capture par OFFRE : déjà gratuite via FeedItemRevision (snapshotjson.price).
 *   - Historique par PRODUIT/pays/jour : table ProductGroupPriceHistory, alimentée
 *     ici par un snapshot quotidien du MIN par produit/pays (appelé dans le hook
 *     post-ingestion, gardé par le compte comparateur).
 *
 * Conventions du repo : SQL brut via `prisma.$queryRawUnsafe` / `$executeRawUnsafe`
 * (params typés), colonnes PostgreSQL en minuscules, `prisma` injecté en 1er argument.
 * `deriveSignals` est PUR (testable sans DB).
 */

/** Décale une date 'YYYY-MM-DD' de `delta` jours (UTC). */
function shiftDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Dérive les signaux « bon plan » à partir des points d'historique d'un produit/pays.
 * PUR : aucune dépendance DB.
 *
 * @param {Array<{capturedon: string, lowestprice: number}>} points  points (jour -> prix mini)
 * @param {string} todayStr  date de référence 'YYYY-MM-DD'
 * @returns {null | {current, min90, max90, isAtLowest, pctVs30d, points}}
 */
function deriveSignals(points, todayStr) {
  if (!Array.isArray(points) || points.length === 0) return null;

  const sorted = [...points].sort((a, b) => (a.capturedon < b.capturedon ? -1 : 1));
  const current = Number(sorted[sorted.length - 1].lowestprice);

  let min90 = Infinity;
  let max90 = -Infinity;
  for (const p of sorted) {
    const v = Number(p.lowestprice);
    if (v < min90) min90 = v;
    if (v > max90) max90 = v;
  }

  const isAtLowest = current <= min90 + 1e-9;

  // Prix « il y a ~30 jours » : dernier point à la date (today - 30j) ou avant.
  const ref = shiftDays(todayStr, -30);
  let past = null;
  for (const p of sorted) {
    if (p.capturedon <= ref) past = p;
    else break;
  }
  let pctVs30d = null;
  if (past && Number(past.lowestprice) > 0) {
    pctVs30d = Math.round(((current - Number(past.lowestprice)) / Number(past.lowestprice)) * 1000) / 10;
  }

  return { current, min90, max90, isAtLowest, pctVs30d, points: sorted.length };
}

/**
 * Fige le prix le plus bas de chaque produit (par pays) pour un jour donné.
 * UPSERT idempotent : réexécuter le même jour écrase la valeur. Appelé en hook
 * post-ingestion (compte comparateur uniquement).
 *
 * @returns {{capturedOn: string, rows: number}}
 */
async function snapshotGroupPrices(prisma, accountId, opts = {}) {
  const capturedOn = opts.capturedOn || new Date().toISOString().slice(0, 10);
  const rows = await prisma.$executeRawUnsafe(`
    INSERT INTO "ProductGroupPriceHistory" (groupid, countrycode, capturedon, lowestprice, currency)
    SELECT
      fi.groupid,
      COALESCE(fs.countrycode, '') AS countrycode,
      $2::date,
      min(fi.price) AS lowestprice,
      (array_agg(fi.currency ORDER BY fi.price ASC NULLS LAST) FILTER (WHERE fi.currency IS NOT NULL))[1] AS currency
    FROM "FeedItem" fi
    JOIN "Feed" f ON f.id = fi.feedid
    JOIN "FeedSource" fs ON fs.id = f.sourceid
    WHERE f.accountid = $1::text
      AND fi.groupid IS NOT NULL
      AND fi.price > 0
    GROUP BY fi.groupid, COALESCE(fs.countrycode, '')
    ON CONFLICT (groupid, countrycode, capturedon)
    DO UPDATE SET lowestprice = EXCLUDED.lowestprice, currency = EXCLUDED.currency
  `, accountId, capturedOn);
  return { capturedOn, rows };
}

/** Retourne les points d'historique (ascendant) d'un produit/pays sur `days` jours. */
async function getPriceHistory(prisma, groupId, countryCode, days = 90) {
  return prisma.$queryRawUnsafe(`
    SELECT capturedon::text AS capturedon, lowestprice, currency
    FROM "ProductGroupPriceHistory"
    WHERE groupid = $1::text AND countrycode = $2::text
      AND capturedon >= (CURRENT_DATE - make_interval(days => $3::int))
    ORDER BY capturedon ASC
  `, groupId, countryCode || '', days);
}

/** Calcule les signaux « bon plan » pour un produit/pays (lit l'historique + deriveSignals). */
async function getPriceSignals(prisma, groupId, countryCode) {
  const points = await getPriceHistory(prisma, groupId, countryCode, 90);
  const today = new Date().toISOString().slice(0, 10);
  return deriveSignals(
    points.map((p) => ({ capturedon: p.capturedon, lowestprice: Number(p.lowestprice) })),
    today
  );
}

module.exports = {
  shiftDays,
  deriveSignals,
  snapshotGroupPrices,
  getPriceHistory,
  getPriceSignals,
};

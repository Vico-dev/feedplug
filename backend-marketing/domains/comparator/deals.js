'use strict';

/**
 * domains/comparator/deals.js — Feed PUBLIC « bons plans » du comparateur CSS.
 *
 * Variante SANS authentification ni join d'intérêts de getPersonalFeed
 * (domains/comparator-account/feed.js) : on classe TOUT le catalogue comparateur
 * par intensité de baisse, pour la page d'acquisition /deals (visible sans login).
 *
 * Le signal v1 combine, comme le feed perso :
 *   - pctVs30d : variation du prix le plus bas vs ~30 j (ProductGroupPriceHistory),
 *   - rrpDropPct (proxy instantané) : écart au prix conseillé AWIN (customfields
 *     rrp_price / base_price), s'il est présent — sinon ignoré (résout le cold-start).
 * Gating AWIN identique (sources 'approved' / opt-in comparateur). Scope strict au
 * compte comparateur (pg.accountid = $1). On n'expose que les produits effectivement
 * en baisse (dropScore < 0), pour que la page tienne sa promesse « bons plans ».
 *
 * Conventions du repo : SQL brut via `prisma.$queryRawUnsafe` (params typés),
 * colonnes minuscules, `prisma` injecté en 1er argument. `scoreDrop` (réexporté
 * depuis le feed perso) reste PUR ; `mapDealRow` est PUR (testable sans DB).
 */

const { scoreDrop } = require('../comparator-account/feed');

/**
 * Mappe une ligne SQL brute en item « bon plan » exposé par l'API. PUR.
 * Calcule pctVs30d / rrpDropPct (arrondis 0,1 %) et le dropScore combiné.
 */
function mapDealRow(r) {
  const current = r.lowestprice != null ? Number(r.lowestprice) : null;
  const past = r.pastprice != null ? Number(r.pastprice) : null;
  const ref = r.ref_price != null ? Number(r.ref_price) : null;
  const pctVs30d = (past && past > 0 && current != null)
    ? Math.round(((current - past) / past) * 1000) / 10 : null;
  const rrpDropPct = (ref && ref > 0 && current != null)
    ? Math.round(((current - ref) / ref) * 1000) / 10 : null;
  return {
    id: r.id,
    title: r.canonicaltitle,
    brand: r.brand,
    imageUrl: r.imageurl,
    lowestPrice: current,
    currency: r.currency,
    merchantCount: r.merchant_count,
    pctVs30d,
    rrpDropPct,
    dropScore: scoreDrop(pctVs30d, rrpDropPct),
  };
}

/**
 * Construit le feed public des plus fortes baisses du catalogue comparateur.
 * Retourne { items, total }. NON filtré par intérêts utilisateur.
 * @param {string} country pays ISO-2 (déjà normalisé en amont)
 */
async function getPublicDeals(prisma, accountId, { country, limit, offset }) {
  const rows = await prisma.$queryRawUnsafe(`
    WITH lowest AS (
      SELECT fi.groupid,
             min(fi.price) AS lowestprice,
             (array_agg(fi.currency ORDER BY fi.price ASC NULLS LAST) FILTER (WHERE fi.currency IS NOT NULL))[1] AS currency,
             count(DISTINCT COALESCE(fi.customfields->>'merchant_id', f.sourceid)) AS merchant_count,
             max((NULLIF(fi.customfields->>'rrp_price',''))::numeric)  AS rrp_price,
             max((NULLIF(fi.customfields->>'base_price',''))::numeric) AS base_price
      FROM "FeedItem" fi
      JOIN "Feed" f        ON f.id = fi.feedid
      JOIN "FeedSource" fs ON fs.id = f.sourceid
      JOIN "Account" a     ON a.id = f.accountid
      WHERE fi.groupid IS NOT NULL
        AND fi.price > 0
        AND ((f.accountid = $1::text AND fs.approvalstatus = 'approved') OR a.comparatoroptin = true)
        AND COALESCE(fs.countrycode, '') = $2::text
      GROUP BY fi.groupid
    ),
    past AS (
      SELECT DISTINCT ON (h.groupid) h.groupid, h.lowestprice AS pastprice
      FROM "ProductGroupPriceHistory" h
      JOIN lowest l ON l.groupid = h.groupid
      WHERE h.countrycode = $2::text
        AND h.capturedon <= (CURRENT_DATE - INTERVAL '30 days')
      ORDER BY h.groupid, h.capturedon DESC
    ),
    scored AS (
      SELECT pg.id, pg.canonicaltitle, pg.brand, pg.imageurl,
             l.lowestprice, l.currency, l.merchant_count::int AS merchant_count,
             COALESCE(l.rrp_price, l.base_price) AS ref_price,
             p.pastprice,
             pg.updatedat,
             LEAST(
               COALESCE(CASE WHEN p.pastprice > 0 THEN (l.lowestprice - p.pastprice) / p.pastprice * 100 END, 0),
               COALESCE(CASE WHEN COALESCE(l.rrp_price, l.base_price) > 0
                             THEN (l.lowestprice - COALESCE(l.rrp_price, l.base_price)) / COALESCE(l.rrp_price, l.base_price) * 100 END, 0)
             ) AS drop_score
      FROM "ProductGroup" pg
      JOIN lowest l ON l.groupid = pg.id
      LEFT JOIN past p ON p.groupid = pg.id
      WHERE pg.accountid = $1::text
    )
    SELECT s.*, count(*) OVER()::int AS total
    FROM scored s
    WHERE s.drop_score < 0
    ORDER BY s.drop_score ASC, s.updatedat DESC
    LIMIT $3::int OFFSET $4::int
  `, accountId, country, limit, offset);

  const total = rows[0]?.total ?? 0;
  const items = rows.map(mapDealRow);
  return { items, total };
}

module.exports = { mapDealRow, getPublicDeals };

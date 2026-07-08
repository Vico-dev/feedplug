'use strict';

/**
 * domains/comparator-account/price-alerts.js — Alertes baisse de prix (watchlist).
 *
 * Déclenché quotidiennement par Cloud Scheduler (POST /api/v1/comparator/internal/price-alerts).
 * Pour chaque produit suivi : si le prix courant a baissé d'au moins COMPARATOR_ALERT_DROP_PCT %
 * par rapport au prix figé à l'ajout (priceatadd), on notifie le user (push + email digest,
 * groupés par user). Anti-spam via les colonnes de la migration 061 : on ne ré-alerte un
 * produit que si le prix est descendu SOUS le dernier prix déjà alerté.
 *
 * Senders injectés par l'appelant (routes) : sendPush(userId, payload), sendEmail(email, items).
 * `shouldAlert` est PUR (testable sans DB).
 */

const DEFAULT_DROP_PCT = 5;

function getAlertThresholdPct() {
  const raw = Number(process.env.COMPARATOR_ALERT_DROP_PCT);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DROP_PCT;
}

/**
 * Décide si une ligne de watchlist mérite une alerte. PUR.
 * @param {object} p { priceAtAdd, currentPrice, lastAlertedPrice, thresholdPct }
 * @returns {boolean}
 */
function shouldAlert({ priceAtAdd, currentPrice, lastAlertedPrice, thresholdPct }) {
  const base = Number(priceAtAdd);
  const current = Number(currentPrice);
  const threshold = Number(thresholdPct);
  if (!(base > 0) || !(current > 0) || !(threshold > 0)) return false;
  const dropPct = ((current - base) / base) * 100;
  if (dropPct > -threshold) return false;
  // Anti-spam : déjà alerté à ce prix (ou plus bas) → on attend une baisse supplémentaire.
  const last = Number(lastAlertedPrice);
  if (Number.isFinite(last) && last > 0 && current >= last) return false;
  return true;
}

/**
 * Trouve les lignes de watchlist candidates à l'alerte (prix courant, gating AWIN
 * identique à watchlist.js), avec l'email du user. Le filtrage final passe par
 * shouldAlert (seuil + anti-spam) côté JS pour rester testable.
 */
async function findDrops(prisma, accountId) {
  return prisma.$queryRawUnsafe(`
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
    SELECT w.id, w.userid, w.groupid, w.countrycode,
           w.priceatadd, w.lastalertedprice,
           l.lowestprice AS currentprice, l.currency,
           pg.canonicaltitle, pg.brand, pg.imageurl,
           u.email
    FROM "ComparatorWatchlist" w
    JOIN "ComparatorUser" u ON u.id = w.userid
    JOIN "ProductGroup" pg  ON pg.id = w.groupid AND pg.accountid = $1::text
    JOIN lowest l           ON l.groupid = w.groupid AND l.countrycode = w.countrycode
    WHERE w.priceatadd IS NOT NULL
      AND l.lowestprice < w.priceatadd
  `, accountId);
}

/** Fige le prix alerté (anti-spam 061). */
async function markAlerted(prisma, watchId, price) {
  await prisma.$executeRawUnsafe(
    `UPDATE "ComparatorWatchlist" SET lastalertedprice = $1::numeric, lastalertedat = now() WHERE id = $2::text`,
    price, watchId,
  );
}

/**
 * Boucle principale : filtre via shouldAlert, groupe par user, envoie push + email,
 * puis markAlerted. Un échec d'envoi pour un user n'empêche pas les autres
 * (et ne marque PAS ses produits comme alertés → retentés au prochain run).
 * @returns {{ candidates:number, alerted:number, users:number, errors:number }}
 */
async function runPriceAlerts(prisma, accountId, { sendPush, sendEmail } = {}) {
  const thresholdPct = getAlertThresholdPct();
  const rows = await findDrops(prisma, accountId);

  const eligible = rows.filter((r) => shouldAlert({
    priceAtAdd: r.priceatadd,
    currentPrice: r.currentprice,
    lastAlertedPrice: r.lastalertedprice,
    thresholdPct,
  }));

  const byUser = new Map();
  for (const r of eligible) {
    if (!byUser.has(r.userid)) byUser.set(r.userid, []);
    byUser.get(r.userid).push(r);
  }

  const out = { candidates: rows.length, alerted: 0, users: 0, errors: 0 };
  for (const [userId, items] of byUser) {
    try {
      const first = items[0];
      const dropPct = Math.round(((Number(first.currentprice) - Number(first.priceatadd)) / Number(first.priceatadd)) * 100);
      const title = items.length === 1
        ? `Baisse de prix : ${first.canonicaltitle}`
        : `${items.length} produits suivis ont baissé de prix`;
      const body = items.length === 1
        ? `${Number(first.currentprice).toFixed(2)} ${first.currency || '€'} (${dropPct}% depuis ton suivi)`
        : `Dont ${first.canonicaltitle} à ${Number(first.currentprice).toFixed(2)} ${first.currency || '€'}`;

      if (typeof sendPush === 'function') {
        await sendPush(userId, {
          title,
          body,
          url: '/compte/produits',
          data: { kind: 'price-drop', groupIds: items.map((i) => i.groupid) },
        });
      }
      if (typeof sendEmail === 'function' && first.email) {
        await sendEmail(first.email, items.map((i) => ({
          title: i.canonicaltitle,
          brand: i.brand,
          imageUrl: i.imageurl,
          groupId: i.groupid,
          country: i.countrycode || 'FR',
          priceAtAdd: Number(i.priceatadd),
          currentPrice: Number(i.currentprice),
          currency: i.currency || null,
        })));
      }
      for (const i of items) {
        await markAlerted(prisma, i.id, Number(i.currentprice));
        out.alerted += 1;
      }
      out.users += 1;
    } catch (err) {
      out.errors += 1;
      console.error(`[price-alerts] échec pour user ${userId}:`, err.message);
    }
  }
  return out;
}

module.exports = {
  DEFAULT_DROP_PCT,
  getAlertThresholdPct,
  shouldAlert,
  findDrops,
  markAlerted,
  runPriceAlerts,
};

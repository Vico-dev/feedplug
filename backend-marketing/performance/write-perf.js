/**
 * Écriture des métriques de performance par canal (PerformanceChannel + PerformanceChannelHistory).
 * Utilisé par les jobs de sync Google Ads, Meta Ads, Amazon Ads.
 * Voir docs/PERFORMANCE_DATA_DEEP_DIVE.md
 */

const crypto = require('crypto');

const CHANNELS = ['GOOGLE_ADS', 'META_ADS', 'AMAZON', 'MIRAKL', 'SHOPIFY', 'OTHER'];
const DEFAULT_PERIOD = 'LAST_30_DAYS';

/**
 * Écrit un snapshot de performance pour un (produit, canal, période).
 * - PerformanceChannel : upsert (dernière valeur)
 * - PerformanceChannelHistory : upsert pour la journée courante (un point par jour)
 *
 * @param {object} prisma - Client Prisma
 * @param {object} params
 * @param {string} params.scoreId - ID ProductScore (lié au FeedItem)
 * @param {string} params.channel - GOOGLE_ADS | META_ADS | AMAZON | ...
 * @param {string} [params.period] - ex. LAST_30_DAYS
 * @param {object} params.metrics - { impressions, clicks, conversions, cost, revenue, ... }
 * @param {number} params.channelScore - score 0-100
 */
async function writePerformanceSnapshot(prisma, params) {
  const { scoreId, channel, metrics, channelScore } = params;
  const period = params.period || DEFAULT_PERIOD;

  if (!scoreId || !channel || !CHANNELS.includes(channel)) {
    throw new Error('writePerformanceSnapshot: scoreId et channel requis, channel doit être parmi ' + CHANNELS.join(', '));
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const metricsJson = JSON.stringify(metrics || {});
  const score = Math.max(0, Math.min(100, Number(channelScore) || 0));

  // 1) PerformanceChannel : dernière valeur (on cherche un enregistrement existant puis UPDATE ou INSERT)
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM "PerformanceChannel" WHERE scoreid = $1::text AND channel = $2::text AND period = $3::text LIMIT 1`,
    scoreId,
    channel,
    period
  );

  if (existing && existing.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "PerformanceChannel" SET metrics = $1::jsonb, channelscore = $2::int, date = $3::timestamptz, createdat = NOW() WHERE id = $4::text`,
      metricsJson,
      score,
      now,
      existing[0].id
    );
  } else {
    const id = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PerformanceChannel" (id, scoreid, channel, metrics, channelscore, period, date, createdat)
       VALUES ($1::text, $2::text, $3::text, $4::jsonb, $5::int, $6::text, $7::timestamptz, NOW())`,
      id,
      scoreId,
      channel,
      metricsJson,
      score,
      period,
      now
    );
  }

  // 2) PerformanceChannelHistory : un point par jour (upsert sur la journée)
  await upsertPerformanceHistoryLegacy(prisma, { scoreId, channel, period, date: today, metricsJson, score });

  return { scoreId, channel, period, date: today };
}

async function upsertPerformanceHistoryLegacy(prisma, { scoreId, channel, period, date, metricsJson, score }) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM "PerformanceChannelHistory" WHERE scoreid = $1 AND channel = $2 AND period = $3 AND date = $4::date LIMIT 1`,
    scoreId,
    channel,
    period,
    date
  );
  if (existing && existing.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "PerformanceChannelHistory" SET metrics = $1::jsonb, channelscore = $2::int, createdat = NOW() WHERE id = $3::text`,
      metricsJson,
      score,
      existing[0].id
    );
  } else {
    const id = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PerformanceChannelHistory" (id, scoreid, channel, period, date, metrics, channelscore, createdat)
       VALUES ($1::text, $2::text, $3::text, $4::text, $5::date, $6::jsonb, $7::int, NOW())`,
      id,
      scoreId,
      channel,
      period,
      date,
      metricsJson,
      score
    );
  }
}

/**
 * Purge l'historique au-delà de retentionDays (par défaut 90 jours).
 * À appeler par un job quotidien (cron).
 *
 * @param {object} prisma - Client Prisma
 * @param {number} [retentionDays=90]
 * @returns {{ deleted: number }}
 */
async function purgePerformanceHistory(prisma, retentionDays = 90) {
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM "PerformanceChannelHistory" WHERE date < CURRENT_DATE - $1::int`,
    retentionDays
  );
  const deleted = typeof result === 'number' ? result : (result?.count ?? 0);
  return { deleted };
}

/**
 * Récupère l'historique des métriques pour un produit et un canal (pour graphiques).
 *
 * @param {object} prisma - Client Prisma
 * @param {object} params
 * @param {string} params.scoreId - ID ProductScore
 * @param {string} params.channel - GOOGLE_ADS | META_ADS | ...
 * @param {string} [params.period] - ex. LAST_30_DAYS
 * @param {string} [params.from] - date YYYY-MM-DD
 * @param {string} [params.to] - date YYYY-MM-DD
 */
async function getPerformanceHistory(prisma, params) {
  const { scoreId, channel } = params;
  const period = params.period || DEFAULT_PERIOD;
  const from = params.from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = params.to || new Date().toISOString().slice(0, 10);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT date, metrics, channelscore, createdat
     FROM "PerformanceChannelHistory"
     WHERE scoreid = $1::text AND channel = $2::text AND period = $3::text AND date >= $4::date AND date <= $5::date
     ORDER BY date ASC`,
    scoreId,
    channel,
    period,
    from,
    to
  );
  return rows || [];
}

module.exports = {
  writePerformanceSnapshot,
  purgePerformanceHistory,
  getPerformanceHistory,
  CHANNELS,
  DEFAULT_PERIOD,
};

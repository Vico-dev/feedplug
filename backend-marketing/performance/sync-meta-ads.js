/**
 * Sync des métriques de performance Meta Ads (catalogue / product_id) vers PerformanceChannel + PerformanceChannelHistory.
 * Utilise l'API Graph Meta (insights avec breakdown product_id) et writePerformanceSnapshot.
 * Voir docs/PERFORMANCE_DATA_DEEP_DIVE.md
 */

const crypto = require('crypto');
const { writePerformanceSnapshot } = require('./write-perf');

const PERIOD = 'LAST_30_DAYS';
const GRAPH_API_VERSION = 'v22.0';

/**
 * Calcule un score 0-100 à partir des métriques Meta (impressions, clics, spend).
 */
function computeChannelScore(metrics) {
  const impressions = Number(metrics.impressions ?? 0);
  const clicks = Number(metrics.clicks ?? 0);
  const spend = Number(metrics.spend ?? 0);
  const actions = metrics.actions || [];
  let conversions = 0;
  for (const a of actions) {
    if ((a.action_type || '').toLowerCase().includes('purchase')) {
      conversions += Number(a.value ?? 0);
    }
  }
  if (impressions === 0) return 0;
  const ctr = clicks / impressions;
  const score = Math.round(
    Math.min(40, conversions * 8) +
    Math.min(40, ctr * 800) +
    Math.min(20, impressions / 500)
  );
  return Math.max(0, Math.min(100, score));
}

/**
 * Appelle l'API Graph Meta pour les insights par product_id.
 */
async function fetchMetaInsightsByProduct(adAccountId, accessToken, timeRange) {
  const aid = adAccountId.replace(/^act_/i, '') ? `act_${adAccountId.replace(/^act_/i, '')}` : adAccountId;
  const params = new URLSearchParams({
    fields: 'impressions,clicks,spend,actions',
    breakdowns: 'product_id',
    access_token: accessToken,
    ...(timeRange ? { time_range: JSON.stringify(timeRange) } : { date_preset: 'last_30d' }),
  });
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${aid}/insights?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Meta API ${res.status}: ${errBody.substring(0, 300)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.data || [];
}

/**
 * Synchronise les perfs Meta Ads (breakdown product_id) pour un compte.
 *
 * @param {object} prisma - Client Prisma
 * @param {object} options
 * @param {string} options.accountId - Compte Feedplug
 * @param {string} [options.feedId] - Optionnel : limiter aux items de ce feed
 * @param {string} options.adAccountId - Meta Ad Account ID (ex. act_123456789 ou 123456789)
 * @param {string} options.accessToken - Token d'accès Meta (ads_read, catalogue)
 * @returns {{ synced: number, skipped: number, errors: string[] }}
 */
async function syncMetaAdsPerformance(prisma, options) {
  const { accountId, feedId, adAccountId, accessToken } = options;

  if (!adAccountId || !accessToken) {
    throw new Error('syncMetaAdsPerformance: adAccountId et accessToken requis');
  }

  const errors = [];
  let synced = 0;
  let skipped = 0;

  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const timeRange = { since: since.toISOString().slice(0, 10), until: new Date().toISOString().slice(0, 10) };
    const rows = await fetchMetaInsightsByProduct(adAccountId, accessToken, timeRange);
    if (!Array.isArray(rows)) {
      return { synced: 0, skipped: 0, errors: ['Réponse Meta inattendue'] };
    }

    for (const row of rows) {
      let productId;
      try {
        productId = row.product_id ?? row.productId ?? '';
        if (!productId) {
          skipped++;
          continue;
        }
        productId = String(productId).trim();
        const impressions = Number(row.impressions ?? 0);
        const clicks = Number(row.clicks ?? 0);
        const spend = Number(row.spend ?? 0);
        const actions = row.actions || [];
        const metrics = {
          impressions,
          clicks,
          spend,
          cost: spend,
          actions: actions.map((a) => ({ action_type: a.action_type, value: a.value })),
        };
        const channelScore = computeChannelScore({ ...metrics, actions });

        const itemRows = await prisma.$queryRawUnsafe(
          `SELECT fi.id AS itemid
           FROM "FeedItem" fi
           JOIN "Feed" f ON fi.feedid = f.id
           WHERE f.accountid = $1::text
             AND (fi.id = $2::text OR fi.customfields->>'metaProductId' = $2::text OR fi.originid = $2::text)
           ${feedId ? ' AND fi.feedid = $3::text' : ''}
           LIMIT 1`,
          accountId,
          productId,
          ...(feedId ? [feedId] : [])
        );

        if (!itemRows || itemRows.length === 0) {
          skipped++;
          continue;
        }
        const itemId = itemRows[0].itemid;

        let scoreRows = await prisma.$queryRawUnsafe(
          `SELECT id FROM "ProductScore" WHERE itemid = $1::text LIMIT 1`,
          itemId
        );
        if (!scoreRows || scoreRows.length === 0) {
          const scoreId = crypto.randomUUID();
          try {
            await prisma.$executeRawUnsafe(
              `INSERT INTO "ProductScore" (id, itemid, qualityscore, performancescore, qualitydetails, performancedetails, createdat, updatedat)
               VALUES ($1::text, $2::text, 0, 0, '{}'::jsonb, '{}'::jsonb, NOW(), NOW())`,
              scoreId,
              itemId
            );
          } catch (insertErr) {
            if (insertErr.code !== '23505') throw insertErr;
          }
          scoreRows = await prisma.$queryRawUnsafe(
            `SELECT id FROM "ProductScore" WHERE itemid = $1::text LIMIT 1`,
            itemId
          );
        }
        if (!scoreRows || scoreRows.length === 0) {
          skipped++;
          continue;
        }
        const scoreId = scoreRows[0].id;

        await writePerformanceSnapshot(prisma, {
          scoreId,
          channel: 'META_ADS',
          period: PERIOD,
          metrics,
          channelScore,
        });
        synced++;
      } catch (err) {
        errors.push(`${productId ?? '?'}: ${err.message}`);
        if (errors.length >= 20) break;
      }
    }
  } catch (apiErr) {
    errors.push(apiErr.message || 'Erreur API Meta');
  }

  return { synced, skipped, errors };
}

module.exports = { syncMetaAdsPerformance, computeChannelScore, fetchMetaInsightsByProduct, PERIOD };

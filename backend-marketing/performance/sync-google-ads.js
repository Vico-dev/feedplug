/**
 * Sync des métriques de performance Google Ads (Shopping) vers PerformanceChannel + PerformanceChannelHistory.
 * Utilise l'API Google Ads (shopping_performance_view) et writePerformanceSnapshot.
 * Voir docs/PERFORMANCE_DATA_DEEP_DIVE.md
 */

const crypto = require('crypto');
const { GoogleAdsApi } = require('google-ads-api');
const { writePerformanceSnapshot } = require('./write-perf');

const PERIOD = 'LAST_30_DAYS';

/**
 * Calcule un score 0-100 à partir des métriques (heuristique simple : conversions et CA pondérés).
 */
function computeChannelScore(metrics) {
  const conversions = Number(metrics.conversions ?? 0) + Number(metrics.all_conversions ?? 0);
  const revenue = Number(metrics.revenue ?? 0) || (Number(metrics.conversions_value ?? 0) / 1e6);
  const clicks = Number(metrics.clicks ?? 0);
  const impressions = Number(metrics.impressions ?? 0);
  if (impressions === 0) return 0;
  const ctr = clicks / impressions;
  let score = Math.min(100, Math.round(
    Math.min(100, conversions * 10) +
    Math.min(50, revenue * 2) +
    Math.min(30, ctr * 1000)
  ));
  return Math.max(0, Math.min(100, score));
}

/**
 * Synchronise les perfs Google Ads (Shopping) pour un compte.
 *
 * @param {object} prisma - Client Prisma
 * @param {object} options
 * @param {string} options.accountId - Compte Feedplug
 * @param {string} [options.feedId] - Optionnel : limiter aux items de ce feed
 * @param {string} options.customerId - Google Ads customer ID (sans tirets, ex. 1234567890)
 * @param {string} options.refreshToken - OAuth refresh token (scope adwords)
 * @param {string} options.clientId - OAuth client ID
 * @param {string} options.clientSecret - OAuth client secret
 * @param {string} options.developerToken - Google Ads developer token
 * @returns {{ synced: number, skipped: number, errors: string[] }}
 */
async function syncGoogleAdsPerformance(prisma, options) {
  const {
    accountId,
    feedId,
    customerId,
    refreshToken,
    clientId,
    clientSecret,
    developerToken,
  } = options;

  if (!customerId || !refreshToken || !clientId || !clientSecret || !developerToken) {
    throw new Error('syncGoogleAdsPerformance: customerId, refreshToken, clientId, clientSecret, developerToken requis');
  }

  const client = new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken,
  });
  const customer = client.Customer({
    customer_id: customerId.replace(/-/g, ''),
    refresh_token: refreshToken,
  });

  const gaql = `
    SELECT
      segments.product_item_id,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.all_conversions,
      metrics.conversions_value
    FROM shopping_performance_view
    WHERE segments.date DURING ${PERIOD}
  `;

  const errors = [];
  let synced = 0;
  let skipped = 0;

  try {
    const response = await customer.query(gaql);
    const rows = Array.isArray(response) ? response : (response?.results || []);
    if (!Array.isArray(rows)) {
      return { synced: 0, skipped: 0, errors: ['Réponse API inattendue'] };
    }

    for (const row of rows) {
      let productItemId;
      try {
        productItemId = row.segments?.product_item_id ?? row.product_item_id ?? (row.segments && row.segments.productItemId) ?? '';
        if (!productItemId) {
          skipped++;
          continue;
        }
        productItemId = String(productItemId).trim();
        const impressions = Number(row.metrics?.impressions ?? row.impressions ?? 0);
        const clicks = Number(row.metrics?.clicks ?? row.clicks ?? 0);
        const costMicros = Number(row.metrics?.cost_micros ?? row.cost_micros ?? 0);
        const conversions = Number(row.metrics?.conversions ?? row.conversions ?? 0);
        const allConversions = Number(row.metrics?.all_conversions ?? row.all_conversions ?? 0);
        const conversionsValue = Number(row.metrics?.conversions_value ?? row.conversions_value ?? 0);

        const metrics = {
          impressions,
          clicks,
          cost: costMicros / 1e6,
          cost_micros: costMicros,
          conversions,
          all_conversions: allConversions,
          conversions_value: conversionsValue / 1e6,
          revenue: conversionsValue / 1e6,
        };
        const channelScore = computeChannelScore({
          ...metrics,
          conversions_value: conversionsValue,
        });

        const itemRows = await prisma.$queryRawUnsafe(
          `SELECT fi.id AS itemid, fi.originid, f.accountid
           FROM "FeedItem" fi
           JOIN "Feed" f ON fi.feedid = f.id
           WHERE f.accountid = $1::text
             AND (fi.originid = $2::text OR fi.id = $2::text)
           ${feedId ? ' AND fi.feedid = $3::text' : ''}
           LIMIT 1`,
          accountId,
          productItemId,
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
          channel: 'GOOGLE_ADS',
          period: PERIOD,
          metrics,
          channelScore,
        });
        synced++;
      } catch (err) {
        errors.push(`${productItemId ?? '?'}: ${err.message}`);
        if (errors.length >= 20) break;
      }
    }
  } catch (apiErr) {
    errors.push(apiErr.message || 'Erreur API Google Ads');
  }

  return { synced, skipped, errors };
}

module.exports = { syncGoogleAdsPerformance, computeChannelScore, PERIOD };

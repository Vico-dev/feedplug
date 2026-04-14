/**
 * Sync des métriques de performance Amazon Advertising (Sponsored Products par ASIN) vers PerformanceChannel + PerformanceChannelHistory.
 * Utilise l'API Reporting v3 (rapport spAdvertisedProduct), LWA pour l'auth, puis writePerformanceSnapshot.
 * Voir docs/PERFORMANCE_DATA_DEEP_DIVE.md
 */

const crypto = require('crypto');
const zlib = require('zlib');
const { writePerformanceSnapshot } = require('./write-perf');

const PERIOD_DAYS = 30;
const API_EU = 'https://advertising-api-eu.amazon.com';
const API_NA = 'https://advertising-api.amazon.com';
const LWA_URL = 'https://api.amazon.com/auth/o2/token';
const REPORT_TYPE = 'spAdvertisedProduct';
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 60;

/**
 * Récupère un access token LWA à partir du refresh token.
 */
async function getLwaAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch(LWA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LWA token failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

/**
 * Crée un rapport asynchrone, attend sa complétion, télécharge et parse le JSON gzip.
 */
async function createAndDownloadReport(accessToken, profileId, region = 'eu', startDate, endDate) {
  const baseUrl = region === 'na' ? API_NA : API_EU;
  const scope = profileId.includes('|') ? profileId.split('|')[1] : profileId;
  const clientIdHeader = profileId.includes('|') ? profileId.split('|')[0] : undefined;
  const headers = {
    'Content-Type': 'application/vnd.createasyncreportrequest.v3+json',
    'Amazon-Advertising-API-Scope': scope,
    Authorization: `Bearer ${accessToken}`,
  };
  if (clientIdHeader) headers['Amazon-Advertising-API-ClientId'] = clientIdHeader;

  const createRes = await fetch(`${baseUrl}/reporting/v3/reports`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Feedplug SP advertised product',
      startDate,
      endDate,
      configuration: {
        adProduct: 'SPONSORED_PRODUCTS',
        reportTypeId: REPORT_TYPE,
        timeUnit: 'SUMMARY',
        groupBy: ['advertiser', 'advertisedAsin'],
        columns: ['impressions', 'clicks', 'cost', 'advertisedAsin', 'campaignId'],
        format: 'GZIP_JSON',
      },
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Create report failed: ${createRes.status} ${err}`);
  }
  const createData = await createRes.json();
  const reportId = createData.reportId;
  if (!reportId) throw new Error('No reportId in create response');

  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const statusRes = await fetch(`${baseUrl}/reporting/v3/reports/${reportId}`, {
      headers: {
        ...(clientIdHeader ? { 'Amazon-Advertising-API-ClientId': clientIdHeader } : {}),
        'Amazon-Advertising-API-Scope': scope,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!statusRes.ok) throw new Error(`Report status failed: ${statusRes.status}`);
    const statusData = await statusRes.json();
    const status = (statusData.status || statusData.reportStatus || statusData.processingStatus || '').toUpperCase();
    if (status === 'COMPLETED' || status === 'DONE') {
      let url = statusData.url || statusData.reportDocumentId;
      if (!url && statusData.reportDocumentId) {
        const docRes = await fetch(`${baseUrl}/reporting/v3/reports/${reportId}/document`, {
          headers: {
            ...(clientIdHeader ? { 'Amazon-Advertising-API-ClientId': clientIdHeader } : {}),
            'Amazon-Advertising-API-Scope': scope,
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (docRes.ok) {
          const docData = await docRes.json();
          url = docData.url || docData.downloadUrl;
        }
      }
      if (!url) throw new Error('No download URL in report');
      const downloadRes = await fetch(url);
      if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);
      const buf = Buffer.from(await downloadRes.arrayBuffer());
      const decompressed = await new Promise((resolve, reject) => {
        zlib.gunzip(buf, (err, out) => (err ? reject(err) : resolve(out)));
      });
      const json = JSON.parse(decompressed.toString('utf8'));
      return Array.isArray(json) ? json : (json.records || json.results || []);
    }
    if (status === 'FAILED') throw new Error(statusData.details || 'Report failed');
  }
  throw new Error('Report timed out');
}

function computeChannelScore(metrics) {
  const impressions = Number(metrics.impressions ?? 0);
  const clicks = Number(metrics.clicks ?? 0);
  const cost = Number(metrics.cost ?? 0);
  if (impressions === 0) return 0;
  const ctr = clicks / impressions;
  const score = Math.round(
    Math.min(50, ctr * 1000) +
    Math.min(30, impressions / 1000) +
    Math.min(20, Math.max(0, 20 - cost)))
  ;
  return Math.max(0, Math.min(100, score));
}

/**
 * Synchronise les perfs Amazon Advertising (SP par ASIN) pour un compte.
 *
 * @param {object} prisma - Client Prisma
 * @param {object} options
 * @param {string} options.accountId - Compte Feedplug
 * @param {string} [options.feedId] - Optionnel
 * @param {string} options.profileId - Profil Amazon Ads (ou "clientId|profileId")
 * @param {string} options.clientId - LWA client ID
 * @param {string} options.clientSecret - LWA client secret
 * @param {string} options.refreshToken - LWA refresh token
 * @param {string} [options.region] - 'eu' | 'na'
 * @returns {{ synced: number, skipped: number, errors: string[] }}
 */
async function syncAmazonAdsPerformance(prisma, options) {
  const {
    accountId,
    feedId,
    profileId,
    clientId,
    clientSecret,
    refreshToken,
    region = 'eu',
  } = options;

  if (!profileId || !clientId || !clientSecret || !refreshToken) {
    throw new Error('syncAmazonAdsPerformance: profileId, clientId, clientSecret, refreshToken requis');
  }

  const errors = [];
  let synced = 0;
  let skipped = 0;

  try {
    const accessToken = await getLwaAccessToken(clientId, clientSecret, refreshToken);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - PERIOD_DAYS);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    const rows = await createAndDownloadReport(accessToken, profileId, region, startDate, endDate);
    if (!Array.isArray(rows)) {
      return { synced: 0, skipped: 0, errors: ['Format rapport inattendu'] };
    }

    for (const row of rows) {
      let asin;
      try {
        asin = row.advertisedAsin ?? row.advertised_asin ?? row.asin ?? '';
        if (!asin) {
          skipped++;
          continue;
        }
        asin = String(asin).trim();
        const impressions = Number(row.impressions ?? 0);
        const clicks = Number(row.clicks ?? 0);
        const cost = Number(row.cost ?? 0);
        const metrics = { impressions, clicks, cost, advertisedAsin: asin };
        const channelScore = computeChannelScore(metrics);

        const itemRows = await prisma.$queryRawUnsafe(
          `SELECT fi.id AS itemid
           FROM "FeedItem" fi
           JOIN "Feed" f ON fi.feedid = f.id
           WHERE f.accountid = $1::text
             AND (fi.sku = $2::text OR fi.originid = $2::text OR fi.id = $2::text OR fi.customfields->>'asin' = $2::text)
           ${feedId ? ' AND fi.feedid = $3::text' : ''}
           LIMIT 1`,
          accountId,
          asin,
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
          channel: 'AMAZON',
          period: 'LAST_30_DAYS',
          metrics,
          channelScore,
        });
        synced++;
      } catch (err) {
        errors.push(`${asin ?? '?'}: ${err.message}`);
        if (errors.length >= 20) break;
      }
    }
  } catch (apiErr) {
    errors.push(apiErr.message || 'Erreur API Amazon Ads');
  }

  return { synced, skipped, errors };
}

module.exports = { syncAmazonAdsPerformance, getLwaAccessToken, createAndDownloadReport, computeChannelScore };

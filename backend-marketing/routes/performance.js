/**
 * Routes du domaine "performance" (6 routes) : dashboard d'agrégats par canal
 * (ROAS/coût/revenus), historique d'un score, synchronisation des performances
 * Google Ads / Meta Ads / Amazon Ads, et purge de l'historique (staff/CRON).
 *
 * Inclut /api/v1/admin/performance/purge (préfixe admin mais domaine performance).
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handlers copiés À L'IDENTIQUE. Seul ajout en
 * tête de chaque handler :
 * `const prisma = getPrisma(); const prismaReady = getPrismaReady();`. Les requires
 * propres au domaine (write-perf, sync-google-ads, sync-meta-ads, sync-amazon-ads),
 * utilisés uniquement par ces routes, sont relocalisés ici. Les autres symboles du
 * scope de run() sont injectés via `deps` ; leurs définitions RESTENT dans
 * server-minimal.js. AUCUN changement de comportement.
 */
const { getPerformanceHistory, purgePerformanceHistory, CHANNELS } = require('../performance/write-perf');
const { syncGoogleAdsPerformance } = require('../performance/sync-google-ads');
const { syncMetaAdsPerformance } = require('../performance/sync-meta-ads');
const { syncAmazonAdsPerformance } = require('../performance/sync-amazon-ads');

function registerPerformanceRoutes(app, {
  getPrisma,
  getPrismaReady,
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  authenticateToken,
  decryptPlatformConnection,
  decryptSecret,
  verifyItemAccess,
}) {
// ====== PERFORMANCE PAR CANAL (historique + purge) ======
// GET /api/v1/performance/dashboard — agrégats par plateforme, top produits, par catégorie (ROAS, coût, revenus)
// Auth mixte : JWT cookie (dashboard standalone via proxy Next) ou session token Shopify (embedded).
app.get('/api/v1/performance/dashboard', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service indisponible' });
    const accountId = req.accountId;
    if (!accountId) {
      return res.status(403).json({ message: 'Compte non associé au token' });
    }
    const feedId = req.query.feedId || null;
    const limitProducts = Math.min(100, parseInt(req.query.limitProducts || '30', 10));

    const feedFilter = feedId ? ' AND fi.feedid = $2::text' : '';
    const params = feedId ? [accountId, feedId] : [accountId];

    const byChannel = await prisma.$queryRawUnsafe(`
      SELECT pc.channel,
        COALESCE(SUM((pc.metrics->>'impressions')::numeric), 0)::float AS impressions,
        COALESCE(SUM((pc.metrics->>'clicks')::numeric), 0)::float AS clicks,
        COALESCE(SUM((pc.metrics->>'cost')::numeric), 0)::float AS cost,
        COALESCE(SUM((pc.metrics->>'spend')::numeric), 0)::float + COALESCE(SUM((pc.metrics->>'cost')::numeric), 0)::float AS spend,
        COALESCE(SUM((pc.metrics->>'revenue')::numeric), 0)::float + COALESCE(SUM((pc.metrics->>'conversions_value')::numeric), 0)::float AS revenue,
        COUNT(*)::int AS product_count
      FROM "PerformanceChannel" pc
      JOIN "ProductScore" ps ON ps.id = pc.scoreid
      JOIN "FeedItem" fi ON fi.id = ps.itemid
      JOIN "Feed" f ON f.id = fi.feedid
      WHERE f.accountid = $1::text ${feedFilter}
      GROUP BY pc.channel
    `, ...params);

    const topProducts = await prisma.$queryRawUnsafe(`
      SELECT fi.id AS "itemId", fi.title, fi.sku, pc.channel, pc.channelscore AS "channelScore", pc.metrics
      FROM "PerformanceChannel" pc
      JOIN "ProductScore" ps ON ps.id = pc.scoreid
      JOIN "FeedItem" fi ON fi.id = ps.itemid
      JOIN "Feed" f ON f.id = fi.feedid
      WHERE f.accountid = $1::text ${feedFilter}
      ORDER BY (pc.metrics->>'revenue')::numeric DESC NULLS LAST, (pc.metrics->>'conversions_value')::numeric DESC NULLS LAST, pc.channelscore DESC
      LIMIT $${params.length + 1}
    `, ...params, limitProducts);

    const byCategory = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(NULLIF(TRIM(fi.customfields->>'google_product_category'), ''), fi.customfields->>'category', 'Non catégorisé') AS category,
        pc.channel,
        COALESCE(SUM((pc.metrics->>'cost')::numeric), 0)::float AS cost,
        COALESCE(SUM((pc.metrics->>'revenue')::numeric), 0)::float + COALESCE(SUM((pc.metrics->>'conversions_value')::numeric), 0)::float AS revenue,
        COUNT(*)::int AS product_count
      FROM "PerformanceChannel" pc
      JOIN "ProductScore" ps ON ps.id = pc.scoreid
      JOIN "FeedItem" fi ON fi.id = ps.itemid
      JOIN "Feed" f ON f.id = fi.feedid
      WHERE f.accountid = $1::text ${feedFilter}
      GROUP BY 1, pc.channel
      ORDER BY revenue DESC NULLS LAST
      LIMIT 50
    `, ...params);

    const channelsWithRoas = (byChannel || []).map((row) => {
      const cost = Number(row.cost ?? 0) || Number(row.spend ?? 0);
      const revenue = Number(row.revenue ?? 0);
      const roas = cost > 0 ? revenue / cost : 0;
      return {
        channel: row.channel,
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        cost,
        revenue,
        roas: Math.round(roas * 100) / 100,
        productCount: Number(row.product_count ?? 0),
      };
    });

    res.json({
      byChannel: channelsWithRoas,
      topProducts: (topProducts || []).map((p) => ({
        itemId: p.itemId,
        title: p.title,
        sku: p.sku,
        channel: p.channel,
        channelScore: Number(p.channelScore ?? 0),
        metrics: typeof p.metrics === 'string' ? JSON.parse(p.metrics || '{}') : (p.metrics || {}),
      })),
      byCategory: (byCategory || []).map((r) => ({
        category: r.category,
        channel: r.channel,
        cost: Number(r.cost ?? 0),
        revenue: Number(r.revenue ?? 0),
        roas: Number(r.cost) > 0 ? Math.round((Number(r.revenue) / Number(r.cost)) * 100) / 100 : 0,
        productCount: Number(r.product_count ?? 0),
      })),
    });
  } catch (e) {
    console.error('Performance dashboard error:', e);
    res.status(500).json({ message: 'Erreur dashboard performance', error: e.message });
  }
});

// GET /api/v1/performance/history?itemId=xxx&channel=GOOGLE_ADS&period=LAST_30_DAYS&from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/api/v1/performance/history', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service indisponible' });
    const { itemId, channel, period, from, to } = req.query;
    if (!itemId || !channel) {
      return res.status(400).json({ message: 'itemId et channel requis (ex: channel=GOOGLE_ADS)' });
    }
    if (CHANNELS.indexOf(channel) === -1) {
      return res.status(400).json({ message: 'channel invalide. Valeurs: ' + CHANNELS.join(', ') });
    }
    const accountId = req.accountId;
    if (!(await verifyItemAccess(itemId, accountId))) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    const scoreRow = await prisma.$queryRawUnsafe(
      `SELECT id FROM "ProductScore" WHERE itemid = $1::text LIMIT 1`,
      itemId
    );
    if (!scoreRow || scoreRow.length === 0) {
      return res.json({ itemId, channel, period: period || 'LAST_30_DAYS', history: [] });
    }
    const scoreId = scoreRow[0].id;
    const history = await getPerformanceHistory(prisma, { scoreId, channel, period, from, to });
    res.json({
      itemId,
      channel,
      period: period || 'LAST_30_DAYS',
      history: (history || []).map((r) => ({
        date: r.date,
        metrics: r.metrics,
        channelScore: Number(r.channelscore),
        recordedAt: r.createdat,
      })),
    });
  } catch (e) {
    console.error('Performance history error:', e);
    res.status(500).json({ message: 'Erreur lecture historique performance', error: e.message });
  }
});

// POST /api/v1/performance/sync/google-ads — sync des métriques Google Ads (Shopping) vers PerformanceChannel + History
app.post('/api/v1/performance/sync/google-ads', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service indisponible' });
    const accountId = req.accountId;
    const feedId = req.query.feedId || req.body?.feedId || null;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    let customerId = req.body?.customerId || null;
    let refreshToken = req.body?.refreshToken || null;
    if (!customerId || !refreshToken) {
      const conns = await prisma.$queryRawUnsafe(
        `SELECT merchantid, refreshtoken FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'google_ads' AND status = 'active' LIMIT 1`,
        accountId
      );
      if (conns && conns.length > 0) {
        customerId = customerId || conns[0].merchantid;
        refreshToken = refreshToken || decryptSecret(conns[0].refreshtoken);
      }
    }
    if (!customerId || !refreshToken) {
      return res.status(400).json({
        message: 'Connexion Google Ads requise. Connectez votre compte Google Ads (platform=google_ads) ou envoyez customerId et refreshToken dans le body.',
      });
    }
    if (!developerToken || !clientId || !clientSecret) {
      return res.status(500).json({
        message: 'Configuration serveur incomplète: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET requis.',
      });
    }
    const result = await syncGoogleAdsPerformance(prisma, {
      accountId,
      feedId,
      customerId,
      refreshToken,
      clientId,
      clientSecret,
      developerToken,
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('Sync Google Ads performance error:', e);
    res.status(500).json({ message: 'Erreur sync Google Ads', error: e.message });
  }
});

// POST /api/v1/performance/sync/meta-ads — sync des métriques Meta Ads (breakdown product_id) vers PerformanceChannel + History
app.post('/api/v1/performance/sync/meta-ads', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service indisponible' });
    const accountId = req.accountId;
    const feedId = req.query.feedId || req.body?.feedId || null;
    let adAccountId = req.body?.adAccountId || null;
    let accessToken = req.body?.accessToken || null;
    if (!adAccountId || !accessToken) {
      const conns = await prisma.$queryRawUnsafe(
        `SELECT merchantid, accesstoken FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'meta' AND status = 'active' LIMIT 1`,
        accountId
      );
      if (conns && conns.length > 0) {
        adAccountId = adAccountId || conns[0].merchantid;
        accessToken = accessToken || decryptSecret(conns[0].accesstoken);
      }
    }
    if (!adAccountId || !accessToken) {
      return res.status(400).json({
        message: 'Connexion Meta Ads requise. Connectez votre compte Meta (platform=meta) ou envoyez adAccountId et accessToken dans le body.',
      });
    }
    const result = await syncMetaAdsPerformance(prisma, {
      accountId,
      feedId,
      adAccountId,
      accessToken,
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('Sync Meta Ads performance error:', e);
    res.status(500).json({ message: 'Erreur sync Meta Ads', error: e.message });
  }
});

// POST /api/v1/performance/sync/amazon-ads — sync des métriques Amazon Advertising (SP par ASIN) vers PerformanceChannel + History
app.post('/api/v1/performance/sync/amazon-ads', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service indisponible' });
    const accountId = req.accountId;
    const feedId = req.query.feedId || req.body?.feedId || null;
    const region = (req.query.region || req.body?.region || 'eu').toLowerCase();
    let profileId = req.body?.profileId || null;
    let clientId = req.body?.clientId || process.env.AMAZON_ADS_CLIENT_ID;
    let clientSecret = req.body?.clientSecret || process.env.AMAZON_ADS_CLIENT_SECRET;
    let refreshToken = req.body?.refreshToken || null;
    if (!profileId || !refreshToken) {
      const conns = await prisma.$queryRawUnsafe(
        `SELECT merchantid, accesstoken, refreshtoken, metadata FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon_ads' AND status = 'active' LIMIT 1`,
        accountId
      );
      if (conns && conns.length > 0) {
        const c = decryptPlatformConnection(conns[0]);
        profileId = profileId || c.merchantid;
        refreshToken = refreshToken || c.refreshtoken;
        const meta = c.metadata || {};
        if (!clientId) clientId = meta.clientId;
        if (!clientSecret) clientSecret = meta.clientSecret;
      }
    }
    if (!profileId || !refreshToken || !clientId || !clientSecret) {
      return res.status(400).json({
        message: 'Connexion Amazon Ads requise. PlatformConnection platform=amazon_ads (merchantid=profileId, refreshtoken, metadata.clientId/clientSecret) ou body profileId, clientId, clientSecret, refreshToken.',
      });
    }
    const result = await syncAmazonAdsPerformance(prisma, {
      accountId,
      feedId,
      profileId,
      clientId,
      clientSecret,
      refreshToken,
      region: region === 'na' ? 'na' : 'eu',
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('Sync Amazon Ads performance error:', e);
    res.status(500).json({ message: 'Erreur sync Amazon Ads', error: e.message });
  }
});

// POST /api/v1/admin/performance/purge — purge l'historique au-delà de retentionDays (cron ou staff)
app.post('/api/v1/admin/performance/purge', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const isStaff = req.user && (req.user.role === 'staff' || req.user.isStaff);
    const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET;
    const authHeader = req.headers.authorization;
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
    if (!isStaff && !isCron) {
      return res.status(403).json({ message: 'Accès refusé (staff ou CRON_SECRET requis)' });
    }
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service indisponible' });
    const retentionDays = Math.min(365, Math.max(1, parseInt(req.query.retentionDays || req.body?.retentionDays || '90', 10)));
    const { deleted } = await purgePerformanceHistory(prisma, retentionDays);
    res.json({ ok: true, deleted, retentionDays });
  } catch (e) {
    console.error('Performance purge error:', e);
    res.status(500).json({ message: 'Erreur purge historique', error: e.message });
  }
});
}

module.exports = { registerPerformanceRoutes };

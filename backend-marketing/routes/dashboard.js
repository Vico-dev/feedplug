/**
 * Route du domaine "dashboard" (1 route /api/v1/dashboard/overview) : agrégats
 * d'aperçu du tableau de bord (scores titres/descriptions, complétude catalogue).
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handler copié À L'IDENTIQUE. Seul ajout en tête :
 * `const prisma = getPrisma(); const prismaReady = getPrismaReady();`. Les helpers
 * (requireAuth, calculateTitleScore, calculateDescriptionScore) restent définis/requis
 * dans server-minimal.js et sont injectés via `deps`. AUCUN changement de comportement.
 */
function registerDashboardRoutes(app, {
  getPrisma,
  getPrismaReady,
  calculateDescriptionScore,
  calculateTitleScore,
  requireAuth,
}) {
app.get('/api/v1/dashboard/overview', requireAuth, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }

    const acct = req.accountId;

    // Nombre de sources
    const sourcesResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total, 
             COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as active
      FROM "FeedSource" WHERE accountid = $1::text
    `, acct);

    // Nombre de feeds
    const feedsResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total,
             COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as active
      FROM "Feed" WHERE accountid = $1::text
    `, acct);

    // Nombre de produits (colonnes en minuscules en base : feedid)
    const productsResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE f.accountid = $1::text
    `, acct);

    // Score moyen sur tout le catalogue (par lots pour limiter la mémoire)
    const BATCH_SIZE = 500;
    let totalScore = 0;
    let totalCount = 0;
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const scoreItems = await prisma.$queryRawUnsafe(`
        SELECT i.title, i.descriptiontext, i.imageurl, i.brand, i.gtin, i.mpn, i.customfields
        FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
        WHERE f.accountid = $1::text
        ORDER BY i.id ASC
        LIMIT $2::int OFFSET $3::int
      `, acct, BATCH_SIZE, offset);
      if (!scoreItems || scoreItems.length === 0) break;
      for (const item of scoreItems) {
        const titleScore = calculateTitleScore(item.title || '', item);
        const descScore = calculateDescriptionScore((item.descriptionText ?? item.descriptiontext) || '', item);
        let imageScore = (item.imageUrl ?? item.imageurl) ? 60 : 0;
        const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
        let techScore = 0;
        if (item.gtin || cf.gtin) techScore += 30;
        if (item.mpn || cf.mpn) techScore += 20;
        if (cf.google_product_category) techScore += 30;
        if (item.brand) techScore += 20;
        totalScore += Math.round(titleScore * 0.30 + descScore * 0.25 + imageScore * 0.25 + techScore * 0.20);
        totalCount += 1;
      }
      offset += scoreItems.length;
      hasMore = scoreItems.length === BATCH_SIZE;
    }
    const avgScore = totalCount > 0 ? Math.round(totalScore / totalCount) : 0;

    // Enrichissements IA
    const enrichResult = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(CASE WHEN i.customfields->>'optimized_title' IS NOT NULL THEN 1 END)::int as "optimizedTitles",
        COUNT(CASE WHEN i.customfields->>'optimized_description' IS NOT NULL THEN 1 END)::int as "optimizedDescriptions"
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE f.accountid = $1::text
    `, acct);

    // Dernier import (colonnes en minuscules en base : lastrunat, finishedat, feedid)
    const lastImportResult = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT MAX(s.lastrunat) FROM "FeedSource" s WHERE s.accountid = $1::text) as src_max,
        (SELECT MAX(ir.finishedat) FROM "IngestionRun" ir JOIN "Feed" f ON ir.feedid = f.id WHERE f.accountid = $1::text) as run_max
    `, acct);
    const row = lastImportResult?.[0];
    let lastImportAt = null;
    if (row?.src_max || row?.run_max) {
      const t1 = row?.src_max ? new Date(row.src_max).getTime() : 0;
      const t2 = row?.run_max ? new Date(row.run_max).getTime() : 0;
      lastImportAt = new Date(Math.max(t1, t2)).toISOString();
    }

    // Évolution du score + dernières runs (nécessite colonne avg_score_after si migration 011 appliquée)
    let scoreEvolution = [];
    let recentRuns = [];
    try {
      const scoreEvolutionRows = await prisma.$queryRawUnsafe(`
        SELECT ir.finishedat as date, ir.avg_score_after as avgscore
        FROM "IngestionRun" ir JOIN "Feed" f ON ir.feedid = f.id
        WHERE f.accountid = $1::text AND ir.status = 'SUCCESS' AND ir.finishedat IS NOT NULL AND ir.avg_score_after IS NOT NULL
        AND ir.finishedat >= NOW() - INTERVAL '30 days'
        ORDER BY ir.finishedat ASC
      `, acct);
      scoreEvolution = (scoreEvolutionRows || []).map(r => ({
        date: r.date,
        avgScore: r.avgscore != null ? Number(r.avgscore) : null
      }));

      recentRuns = await prisma.$queryRawUnsafe(`
        SELECT ir.status, ir.totalfetched, ir.totalinserted, ir.totalupdated, ir.errormessage, ir.finishedat, ir.avg_score_after as avgscoreafter, f.name as feedname
        FROM "IngestionRun" ir JOIN "Feed" f ON ir.feedid = f.id
        WHERE f.accountid = $1::text
        ORDER BY ir.finishedat DESC NULLS LAST LIMIT 5
      `, acct) || [];
    } catch (colErr) {
      // Colonne avg_score_after absente (migration 011 non appliquée) : récupérer runs sans score
      recentRuns = await prisma.$queryRawUnsafe(`
        SELECT ir.status, ir.totalfetched, ir.totalinserted, ir.totalupdated, ir.errormessage, ir.finishedat, f.name as feedname
        FROM "IngestionRun" ir JOIN "Feed" f ON ir.feedid = f.id
        WHERE f.accountid = $1::text
        ORDER BY ir.finishedat DESC NULLS LAST LIMIT 5
      `, acct) || [];
    }

    // Taux de succès des 10 dernières synchros
    const runsStats = await prisma.$queryRawUnsafe(`
      SELECT ir.status
      FROM "IngestionRun" ir JOIN "Feed" f ON ir.feedid = f.id
      WHERE f.accountid = $1::text AND ir.finishedat IS NOT NULL
      ORDER BY ir.finishedat DESC LIMIT 10
    `, acct);
    const successCount = (runsStats || []).filter(r => r.status === 'SUCCESS').length;
    const runsSuccessRate = runsStats?.length ? Math.round((successCount / runsStats.length) * 100) : null;

    return res.json({
      sources: sourcesResult?.[0] || { total: 0, active: 0 },
      feeds: feedsResult?.[0] || { total: 0, active: 0 },
      totalProducts: productsResult?.[0]?.total || 0,
      avgScore,
      lastImportAt: lastImportAt || null,
      scoreEvolution,
      runsSuccessRate,
      enrichment: enrichResult?.[0] || { optimizedTitles: 0, optimizedDescriptions: 0 },
      recentRuns: recentRuns || []
    });
  } catch (error) {
    console.warn('Dashboard overview error:', error?.message || error);
    return res.status(500).json({
      message: 'Erreur lors du chargement du dashboard. Réessayez ou actualisez la page.'
    });
  }
});
}

module.exports = { registerDashboardRoutes };

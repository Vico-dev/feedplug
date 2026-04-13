function registerEnrichmentRoutes(app, prisma, getPrismaReady, { authenticateToken, verifyItemAccess, canUseFeature }) {
  const { analyzeProduct } = require('../enrichment/auto-enrichment');
  const { optimizeTitleWithAI, calculateTitleScore } = require('../optimization/title-optimizer');
  const { optimizeDescriptionWithAI, calculateDescriptionScore } = require('../optimization/description-optimizer');

  app.get('/api/v1/ingestion/items/:id/enrichment-analysis', async (req, res) => {
    try {
      const { id } = req.params;
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
      const accountId = req.accountId || 'default-account';

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let items;
      if (isUUID) {
        if (!(await verifyItemAccess(id, accountId))) {
          return res.status(404).json({ message: 'Item non trouvé' });
        }
        items = await prisma.$queryRawUnsafe(`
          SELECT i.* FROM "FeedItem" i
          JOIN "Feed" f ON i.feedid = f.id
          WHERE i.id = $1::text AND f.accountid = $2::text
        `, id, accountId);
      } else {
        items = await prisma.$queryRawUnsafe(`
          SELECT i.* FROM "FeedItem" i
          JOIN "Feed" f ON i.feedid = f.id
          WHERE (i.mpn = $1::text OR i.sku = $1::text) AND f.accountid = $2::text
          LIMIT 1
        `, id, accountId);
      }

      if (!items || items.length === 0) {
        return res.status(404).json({ message: 'Item non trouvé' });
      }

      const item = items[0];
      let customFields = {};
      if (item.customfields) {
        try {
          customFields = typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields;
        } catch (e) {
          console.warn('Erreur parsing customfields:', e.message);
        }
      }

      const itemWithCustomFields = { ...item, customFields };
      const analysis = analyzeProduct(itemWithCustomFields);

      res.json({
        itemId: item.id,
        originId: item.originid,
        enrichments: analysis.enrichments,
        alerts: analysis.alerts,
        enrichedFieldsCount: Object.keys(analysis.enrichments).length,
        alertsCount: analysis.alerts.length
      });
    } catch (e) {
      console.error('Erreur analyse enrichissement:', e);
      res.status(500).json({ message: 'Erreur analyse enrichissement', error: e.message });
    }
  });

  app.get('/api/v1/enrichment/score/:itemId', async (req, res) => {
    try {
      const { itemId } = req.params;
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      const accountId = req.accountId || 'default-account';
      if (!(await verifyItemAccess(itemId, accountId))) {
        return res.status(404).json({ message: 'Produit non trouvé' });
      }

      const items = await prisma.$queryRawUnsafe(`
        SELECT i.* FROM "FeedItem" i
        JOIN "Feed" f ON i.feedid = f.id
        WHERE i.id = $1::text AND f.accountid = $2::text
      `, itemId, accountId);

      if (!items || items.length === 0) {
        return res.status(404).json({ message: 'Produit non trouvé' });
      }

      const product = items[0];
      const titleScore = calculateTitleScore(product.title || '', product);
      const descriptionScore = calculateDescriptionScore(product.descriptiontext || product.descriptionText || '', product);

      let imageScore = 0;
      if (product.imageurl || product.imageUrl) {
        imageScore += 60;
      }

      let technicalScore = 0;
      const cf = product.customfields && typeof product.customfields === 'object' ? product.customfields : {};
      if (product.gtin || cf.gtin) technicalScore += 30;
      if (product.mpn || cf.mpn) technicalScore += 20;
      if (cf.google_product_category) technicalScore += 30;
      if (product.brand) technicalScore += 20;

      const globalScore = Math.round(titleScore * 0.30 + descriptionScore * 0.25 + imageScore * 0.25 + technicalScore * 0.20);

      const recommendations = [];
      if (titleScore < 70) recommendations.push({ type: 'title', priority: 'high', message: 'Titre à optimiser', action: 'Utilisez l\'optimisation IA' });
      if (descriptionScore < 60) recommendations.push({ type: 'description', priority: 'high', message: 'Description insuffisante', action: 'Générez une description optimisée' });
      if (imageScore < 60) recommendations.push({ type: 'image', priority: 'medium', message: 'Images à optimiser', action: 'Compressez et optimisez vos images' });
      if (technicalScore < 70) recommendations.push({ type: 'technical', priority: 'high', message: 'Données techniques manquantes', action: 'Ajoutez GTIN, MPN et catégorie' });

      res.json({
        globalScore,
        breakdown: {
          title: { score: titleScore, weight: '30%' },
          description: { score: descriptionScore, weight: '25%' },
          images: { score: imageScore, weight: '25%' },
          technical: { score: technicalScore, weight: '20%' }
        },
        recommendations
      });
    } catch (error) {
      console.error('Erreur score:', error);
      res.status(500).json({ message: error.message });
    }
  });
}

module.exports = { registerEnrichmentRoutes };

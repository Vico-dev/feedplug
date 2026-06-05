function registerEnrichmentRoutes(app, prisma, getPrismaReady, { authenticateToken, verifyItemAccess, canUseFeature }) {
  const { analyzeProduct } = require('../enrichment/auto-enrichment');
  const { optimizeTitleWithAI, calculateTitleScore } = require('../optimization/title-optimizer');
  const { optimizeDescriptionWithAI, calculateDescriptionScore } = require('../optimization/description-optimizer');

  app.get('/api/v1/enrichment/suggestions', authenticateToken, async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      const accountId = req.accountId;
      const { feedId } = req.query;

      const feedFilter = feedId ? `AND f.id = $2` : '';
      const params = feedId ? [accountId, feedId] : [accountId];
      
      const items = await prisma.$queryRawUnsafe(`
        SELECT i.id, i.title, i.descriptiontext, i.description, i.imageurl, i.imageUrl, 
               i.brand, i.price, i.gtin, i.mpn, i.availability,
               i.google_product_category, f.name as feedname
        FROM "FeedItem" i
        JOIN "Feed" f ON i.feedid = f.id
        WHERE f.accountid = $1::text ${feedFilter}
        LIMIT 5000
      `, ...params);

      const suggestions = [];
      const stats = { total: items.length, withCategory: 0, withBrand: 0, withImage: 0, withDescription: 0 };

      items.forEach(item => {
        if (item.google_product_category) stats.withCategory++;
        if (item.brand) stats.withBrand++;
        if (item.imageurl || item.imageUrl) stats.withImage++;
        if (item.descriptiontext || item.description) stats.withDescription++;
      });

      const missingCategory = items.filter(i => !i.google_product_category).length;
      const missingBrand = items.filter(i => !i.brand).length;
      const missingImage = items.filter(i => !i.imageurl && !i.imageUrl).length;
      const shortTitles = items.filter(i => i.title && i.title.length < 30).length;
      const shortDescriptions = items.filter(i => {
        const desc = i.descriptiontext || i.description || '';
        return desc.length < 50;
      }).length;

      const missingCategoryPct = Math.round((missingCategory / stats.total) * 100);
      const missingBrandPct = Math.round((missingBrand / stats.total) * 100);
      const missingImagePct = Math.round((missingImage / stats.total) * 100);

      if (missingCategory > 0) {
        suggestions.push({
          id: 'missing-category',
          type: 'category',
          title: 'Catégories Google manquantes',
          description: `${missingCategory} produits (${missingCategoryPct}%) n'ont pas de catégorie Google Shopping. L'IA peut les compléter automatiquement.`,
          impact: missingCategoryPct > 30 ? 'high' : missingCategoryPct > 15 ? 'medium' : 'low',
          affectedProducts: missingCategory,
          actionLabel: 'Compléter les catégories',
          example: { before: 'Chaussures', after: 'Apparel & Accessories > Shoes' }
        });
      }

      if (missingBrand > 0) {
        suggestions.push({
          id: 'missing-brand',
          type: 'title',
          title: 'Marque manquante dans les titres',
          description: `${missingBrand} produits (${missingBrandPct}%) n'ont pas la marque dans leur titre. Ajouter la marque améliore le CTR.`,
          impact: missingBrandPct > 40 ? 'high' : missingBrandPct > 20 ? 'medium' : 'low',
          affectedProducts: missingBrand,
          actionLabel: 'Enrichir les titres',
          example: { before: 'Air Max 90', after: 'Nike Air Max 90' }
        });
      }

      if (shortTitles > 0) {
        suggestions.push({
          id: 'short-titles',
          type: 'title',
          title: 'Titres trop courts',
          description: `${shortTitles} produits ont des titres de moins de 30 caractères. Des titres plus descriptifs performent mieux.`,
          impact: shortTitles / stats.total > 0.2 ? 'medium' : 'low',
          affectedProducts: shortTitles,
          actionLabel: 'Optimiser les titres',
          example: { before: 'T-shirt', after: 'T-shirt coton bio blanc - Taille M' }
        });
      }

      if (shortDescriptions > 0) {
        suggestions.push({
          id: 'short-descriptions',
          type: 'description',
          title: 'Descriptions courtes',
          description: `${shortDescriptions} produits ont des descriptions de moins de 50 caractères. Des descriptions détaillées convertissent mieux.`,
          impact: shortDescriptions / stats.total > 0.3 ? 'medium' : 'low',
          affectedProducts: shortDescriptions,
          actionLabel: 'Générer des descriptions',
          example: { before: 'Bonne qualité.', after: '✓ Coton bio\n✓ Coupe classique\n✓ Lavable en machine' }
        });
      }

      if (missingImage > 0) {
        suggestions.push({
          id: 'missing-images',
          type: 'image',
          title: 'Images manquantes',
          description: `${missingImage} produits (${missingImagePct}%) n'ont pas d'image. Les produits avec image convertissent 3x plus.`,
          impact: missingImagePct > 20 ? 'high' : missingImagePct > 10 ? 'medium' : 'low',
          affectedProducts: missingImage,
          actionLabel: 'Voir les produits',
          example: { before: 'Sans image', after: 'Photo produit haute résolution' }
        });
      }

      res.json({ suggestions, stats });
    } catch (e) {
      console.error('Erreur suggestions:', e);
      res.status(500).json({ message: e.message });
    }
  });

  app.get('/api/v1/ingestion/items/:id/enrichment-analysis', async (req, res) => {
    try {
      const { id } = req.params;
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
      const accountId = req.accountId;

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
      const accountId = req.accountId;
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

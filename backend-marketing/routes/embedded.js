/**
 * Routes du domaine "embedded" (4 routes /api/v1/embedded/*) : vue catalogue Shopify
 * dans l'iframe Admin (overview), synchronisation des sources, diagnostic, et
 * optimisation manuelle des produits (gate addonIA + quota IA + repush GMC).
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handlers copiés À L'IDENTIQUE. Seul ajout en tête
 * de chaque handler : `const prisma = getPrisma(); const prismaReady = getPrismaReady();`.
 * Le helper findShopifyFeedForAccount (partagé avec d'autres routes) et tous les
 * autres symboles du scope de run() sont injectés via `deps` ; leurs définitions
 * RESTENT dans server-minimal.js. AUCUN changement de comportement.
 */
function registerEmbeddedRoutes(app, {
  getPrisma,
  getPrismaReady,
  authenticateJwtOrShopifySession,
  canUseFeature,
  checkAiQuota,
  decryptObjectSecrets,
  findShopifyFeedForAccount,
  getOptimizedContentForPlatform,
  ingestShopifyFromApi,
  optimizeDescriptionWithAI,
  optimizeTitleWithAI,
  quotaMessage,
  scheduleAutoGmcPush,
  scheduleAutoLiaSync,
  scheduleAutoOptimization,
  trackAiUsage,
}) {
app.get('/api/v1/embedded/sources/overview', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const accountId = req.user.accountId;
    const feed = await findShopifyFeedForAccount(accountId);

    if (!feed) {
      return res.json({
        connected: false,
        shop: null,
        feedId: null,
        lastSyncAt: null,
        totalItems: 0,
        items: [],
      });
    }

    const countRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "FeedItem" WHERE feedid = $1::text`,
      feed.feedId
    );
    const totalItems = countRows?.[0]?.c ?? 0;

    const itemRows = await prisma.$queryRawUnsafe(
      `
        SELECT id, title, imageurl, brand, sku, price, currency, inventory,
               url, updatedat
        FROM "FeedItem"
        WHERE feedid = $1::text
        ORDER BY COALESCE(updatedat, createdat) DESC
        LIMIT 20
      `,
      feed.feedId
    );
    const items = (itemRows || []).map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: r.imageurl || null,
      brand: r.brand || null,
      sku: r.sku || null,
      price: r.price != null ? Number(r.price) : null,
      currency: r.currency || null,
      inventory: r.inventory != null ? Number(r.inventory) : null,
      url: r.url || null,
      updatedAt: r.updatedat,
    }));

    return res.json({
      connected: true,
      shop: feed.shop,
      shopName: feed.shop ? feed.shop.replace(/\.myshopify\.com$/, '') : null,
      feedId: feed.feedId,
      feedStatus: feed.feedStatus,
      sourceStatus: feed.sourceStatus,
      lastSyncAt: feed.lastRunAt,
      connectedAt: feed.connectedAt,
      totalItems,
      items,
    });
  } catch (err) {
    console.error('Embedded sources overview error:', err);
    return res.status(500).json({ message: 'Erreur récupération catalogue', detail: err?.message });
  }
});

// POST /sync — déclenche une re-sync du feed Shopify principal (manuel)
app.post('/api/v1/embedded/sources/sync', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const accountId = req.user.accountId;
    const feed = await findShopifyFeedForAccount(accountId);
    if (!feed) {
      return res.status(404).json({ message: 'Aucune source Shopify connectée' });
    }
    if (!feed.shop) {
      return res.status(409).json({ message: 'Domaine boutique manquant dans la credential' });
    }

    // Récupère le credential déchiffré
    const credRows = await prisma.$queryRawUnsafe(
      `SELECT secretjson FROM "Credential" WHERE id = $1::text LIMIT 1`,
      feed.credentialId
    );
    if (!credRows?.length) {
      return res.status(404).json({ message: 'Credential introuvable' });
    }
    const secret = decryptObjectSecrets(
      typeof credRows[0].secretjson === 'string' ? JSON.parse(credRows[0].secretjson) : credRows[0].secretjson
    );
    const accessToken = secret.accessToken || secret.access_token;
    if (!accessToken) {
      return res.status(409).json({ message: 'Token Shopify expiré, reconnectez la boutique' });
    }

    // Lance la re-sync de manière asynchrone : on répond 202 immédiatement
    // pour que le bouton "Synchroniser" ne bloque pas l'UI plus de quelques
    // secondes. Le polling de /overview affichera la nouvelle valeur de
    // lastSyncAt quand la run sera terminée.
    const startedAt = new Date().toISOString();
    (async () => {
      try {
        await ingestShopifyFromApi({
          prisma,
          feed: {
            id: feed.feedId,
            name: feed.feedName,
            sourceId: feed.sourceId,
            mappingJson: {},
          },
          shop: feed.shop,
          accessToken,
        });
        await prisma.$executeRawUnsafe(
          `UPDATE "FeedSource" SET lastrunat = $1::timestamptz, updatedat = $1::timestamptz WHERE id = $2::text`,
          new Date().toISOString(),
          feed.sourceId
        );
        console.log('✅ Embedded sync done for shop=' + feed.shop + ' accountid=' + accountId);
        scheduleAutoOptimization(accountId, feed.feedId, 'sync embedded');
        scheduleAutoLiaSync(accountId, 'sync embedded');
      } catch (asyncErr) {
        console.error('Embedded sync async error:', asyncErr?.message || asyncErr);
      }
    })();

    return res.status(202).json({ accepted: true, startedAt, feedId: feed.feedId });
  } catch (err) {
    console.error('Embedded sources sync error:', err);
    return res.status(500).json({ message: 'Erreur déclenchement sync', detail: err?.message });
  }
});

// GET /diagnostic/overview — agrégats qualité catalogue Shopify pour l'embedded admin.
// THE feature : "Vous avez X produits suspendus, top raisons : GTIN manquant, prix nul, ..."
// C'est ce qui justifie le pricing FeedPlug vs un simple feed builder. Sans cette vue le
// reviewer BFS flag "incomplete embedded experience".
app.get('/api/v1/embedded/diagnostic/overview', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const accountId = req.user.accountId;
    const feed = await findShopifyFeedForAccount(accountId);
    if (!feed) {
      return res.json({
        connected: false,
        totalItems: 0,
        buckets: { critical: 0, error: 0, warning: 0, ok: 0 },
        averageScore: null,
        topIssues: [],
        worstProducts: [],
      });
    }

    // Buckets de quality score :
    //   critical (0-39)  → produit sera rejeté par Google Merchant
    //   error    (40-59) → champs obligatoires manquants, risque rejet
    //   warning  (60-79) → améliorations recommandées (titre court, GTIN, etc.)
    //   ok       (80-100) → conforme
    const bucketRows = await prisma.$queryRawUnsafe(
      `
        SELECT
          COUNT(*) FILTER (WHERE ps.qualityscore < 40) AS critical,
          COUNT(*) FILTER (WHERE ps.qualityscore >= 40 AND ps.qualityscore < 60) AS error,
          COUNT(*) FILTER (WHERE ps.qualityscore >= 60 AND ps.qualityscore < 80) AS warning,
          COUNT(*) FILTER (WHERE ps.qualityscore >= 80) AS ok,
          COUNT(*) AS total,
          ROUND(AVG(ps.qualityscore)::numeric, 1) AS avg_score
        FROM "FeedItem" fi
        JOIN "ProductScore" ps ON ps.itemid = fi.id
        WHERE fi.feedid = $1::text
      `,
      feed.feedId
    );
    const b = bucketRows?.[0] || {};
    const totalScored = Number(b.total) || 0;

    // Top 10 raisons : on flatten le tableau jsonb d'issues et on groupe par
    // champ + sévérité. Le frontend affiche "47 produits sans GTIN" etc.
    const issueRows = totalScored > 0 ? await prisma.$queryRawUnsafe(
      `
        SELECT
          COALESCE(issue->>'field', 'unknown') AS field,
          COALESCE(issue->>'severity', 'warning') AS severity,
          COUNT(*) AS occurrences
        FROM "FeedItem" fi
        JOIN "ProductScore" ps ON ps.itemid = fi.id
        CROSS JOIN LATERAL jsonb_array_elements(
          COALESCE(ps.qualitydetails->'issues', '[]'::jsonb)
        ) AS issue
        WHERE fi.feedid = $1::text
        GROUP BY field, severity
        ORDER BY occurrences DESC, field ASC
        LIMIT 10
      `,
      feed.feedId
    ) : [];

    // 20 produits avec les pires scores — ceux que le merchant devrait corriger en priorité.
    const worstRows = totalScored > 0 ? await prisma.$queryRawUnsafe(
      `
        SELECT fi.id, fi.originid AS "originId", fi.title, fi.imageurl, fi.sku, fi.url,
               ps.qualityscore, ps.qualitydetails
        FROM "FeedItem" fi
        JOIN "ProductScore" ps ON ps.itemid = fi.id
        WHERE fi.feedid = $1::text
        ORDER BY ps.qualityscore ASC, fi.updatedat DESC
        LIMIT 20
      `,
      feed.feedId
    ) : [];

    const worstProducts = worstRows.map((r) => {
      const details = typeof r.qualitydetails === 'string'
        ? (() => { try { return JSON.parse(r.qualitydetails); } catch { return null; } })()
        : r.qualitydetails;
      const issues = Array.isArray(details?.issues) ? details.issues : [];
      return {
        id: r.id,
        // originId est le path Shopify (`Product/8765...` ou `ProductVariant/N`)
        // après strip du préfixe `gid://shopify/`. Le frontend construit
        // l'URL Admin avec ça (cf bouton "Fix") — utiliser fi.id directement
        // renvoie une 404 car c'est l'UUID interne FeedPlug.
        originId: r.originId || null,
        title: r.title,
        imageUrl: r.imageurl || null,
        sku: r.sku || null,
        url: r.url || null,
        qualityScore: Number(r.qualityscore),
        topIssues: issues.slice(0, 3).map((iss) => ({
          field: iss.field || null,
          severity: iss.severity || 'warning',
          message: iss.message || '',
        })),
      };
    });

    return res.json({
      connected: true,
      feedId: feed.feedId,
      shop: feed.shop,
      totalItems: totalScored,
      buckets: {
        critical: Number(b.critical) || 0,
        error: Number(b.error) || 0,
        warning: Number(b.warning) || 0,
        ok: Number(b.ok) || 0,
      },
      averageScore: b.avg_score != null ? Number(b.avg_score) : null,
      topIssues: issueRows.map((r) => ({
        field: r.field,
        severity: r.severity,
        occurrences: Number(r.occurrences),
      })),
      worstProducts,
    });
  } catch (err) {
    console.error('Embedded diagnostic overview error:', err);
    return res.status(500).json({ message: 'Erreur récupération diagnostic', detail: err?.message });
  }
});

// Cœur produit FeedPlug : optimisation IA multi-canal en masse.
// Body : { productIds?: string[], platforms: string[] }
//   - productIds vide / non fourni → tous les produits du feed (LIMIT 100
//     pour éviter d'exploser quota Gemini, batchs successifs sinon).
//   - platforms : sous-ensemble de ['gmc','meta','amazon','tiktok','pinterest']
//     (chaque optimizer adapte limites et style au canal — cf PLATFORM_LIMITS
//     dans title-optimizer.js).
// Le travail est async : 202 immédiat, puis worker dépile et stocke chaque
// version optimisée dans customfields.optimized.{platform}. Le push vers
// chaque canal récupère la bonne version via getOptimizedContentForPlatform.
app.post('/api/v1/embedded/products/optimize', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const accountId = req.user.accountId;

    // B1 — Gate add-on IA : aucune génération Gemini sans le pack IA souscrit.
    const iaAccess = await canUseFeature(prisma, accountId, 'addonIA');
    if (!iaAccess.allowed) {
      return res.status(403).json({ code: 'PLAN_FEATURE', message: iaAccess.message });
    }

    const { productIds, platforms } = req.body || {};

    const SUPPORTED_PLATFORMS = ['gmc', 'meta', 'amazon', 'tiktok', 'pinterest'];
    const requestedPlatforms = (Array.isArray(platforms) ? platforms : [])
      .map((p) => String(p || '').toLowerCase().trim())
      .filter((p) => SUPPORTED_PLATFORMS.includes(p));
    if (!requestedPlatforms.length) {
      return res.status(400).json({ message: 'Sélectionnez au moins un canal cible (gmc, meta, amazon, tiktok, pinterest).' });
    }

    const feed = await findShopifyFeedForAccount(accountId);
    if (!feed) {
      return res.status(404).json({ message: 'Aucun catalogue Shopify connecté.' });
    }

    let items;
    if (Array.isArray(productIds) && productIds.length > 0) {
      const cleanIds = productIds
        .map((id) => String(id || '').trim())
        .filter(Boolean)
        .slice(0, 200);
      items = await prisma.$queryRawUnsafe(`
        SELECT id, title, descriptiontext, descriptionhtml, brand, sku,
               customfields, gtin, mpn, price, currency
        FROM "FeedItem"
        WHERE feedid = $1::text AND id = ANY($2::text[])
      `, feed.feedId, cleanIds);
    } else {
      items = await prisma.$queryRawUnsafe(`
        SELECT id, title, descriptiontext, descriptionhtml, brand, sku,
               customfields, gtin, mpn, price, currency
        FROM "FeedItem"
        WHERE feedid = $1::text
        LIMIT 100
      `, feed.feedId);
    }

    if (!items?.length) {
      return res.json({ accepted: false, message: 'Aucun produit à optimiser.', processed: 0 });
    }

    const totalOperations = items.length * requestedPlatforms.length;

    // A3 — hard cap texte AVANT de lancer le worker async (1 op = titre + description / produit / canal).
    const quota = await checkAiQuota(prisma, accountId, 'text', totalOperations);
    if (!quota.allowed) {
      return res.status(429).json({ code: 'AI_QUOTA', message: quotaMessage(quota), used: quota.used, cap: quota.cap, remaining: quota.remaining, requested: totalOperations });
    }

    // B1 — comptage de la consommation IA (1 op = titre + description / produit / canal).
    trackAiUsage(accountId, totalOperations);

    res.status(202).json({
      accepted: true,
      productCount: items.length,
      platforms: requestedPlatforms,
      totalOperations,
      estimatedSeconds: Math.ceil(totalOperations * 5),
      message: `Optimisation lancée pour ${items.length} produit(s) sur ${requestedPlatforms.length} canal(aux).`,
    });

    // Worker async : continue après la response. Chaque échec est isolé pour
    // ne pas casser le batch. Stockage atomique par platform via jsonb_set.
    (async () => {
      let succeeded = 0;
      let failed = 0;
      for (const item of items) {
        const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
        const product = {
          id: item.id,
          title: item.title || '',
          description: item.descriptiontext || String(item.descriptionhtml || '').replace(/<[^>]+>/g, ' ').trim(),
          brand: item.brand,
          sku: item.sku,
          gtin: item.gtin,
          mpn: item.mpn,
          price: item.price,
          currency: item.currency,
          customfields: cf,
        };
        for (const platform of requestedPlatforms) {
          try {
            const platformUpper = platform.toUpperCase();
            const [titleRes, descRes] = await Promise.all([
              optimizeTitleWithAI(prisma, product, { platform: platformUpper }).catch((e) => {
                console.warn(`⚠️ Optim title ${item.id} ${platform} :`, e?.message);
                return null;
              }),
              optimizeDescriptionWithAI(prisma, product, { platform: platformUpper }).catch((e) => {
                console.warn(`⚠️ Optim desc ${item.id} ${platform} :`, e?.message);
                return null;
              }),
            ]);
            const optimizedTitle = titleRes?.optimizedTitle || product.title;
            const optimizedDescription = descRes?.optimizedDescription || product.description;
            const payload = {
              title: optimizedTitle,
              description: optimizedDescription,
              optimizedAt: new Date().toISOString(),
            };
            await prisma.$executeRawUnsafe(
              `UPDATE "FeedItem"
               SET customfields = jsonb_set(
                 COALESCE(customfields, '{}'::jsonb),
                 ARRAY['optimized', $1::text],
                 $2::jsonb,
                 true
               ),
               updatedat = NOW()
               WHERE id = $3::text`,
              platform,
              JSON.stringify(payload),
              item.id
            );
            succeeded++;
          } catch (itemErr) {
            console.warn(`⚠️ Optim ${item.id}/${platform} échouée :`, itemErr?.message);
            failed++;
          }
        }
      }
      console.log(`✨ Manual optim done : ${succeeded} ok, ${failed} ko sur ${items.length} produits × ${requestedPlatforms.length} canaux (account ${accountId})`);
      // Si GMC est dans les plateformes optimisées, on déclenche aussi un
      // re-push GMC pour propager immédiatement les versions fraîchement
      // optimisées (sans attendre la prochaine ingestion).
      if (requestedPlatforms.includes('gmc')) {
        scheduleAutoGmcPush(accountId, feed.feedId, 'manual optim → repush', 0);
      }
    })().catch((workerErr) => {
      console.error('Manual optim worker error :', workerErr);
    });
  } catch (err) {
    console.error('Embedded products/optimize error :', err);
    return res.status(500).json({ message: 'Erreur lancement optimisation', detail: err?.message });
  }
});
}

module.exports = { registerEmbeddedRoutes };

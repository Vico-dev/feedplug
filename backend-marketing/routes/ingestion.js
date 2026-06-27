/**
 * Routes d'ingestion (domaine le plus volumineux : 44 routes
 * /api/v1/ingestion/...) : sources CRUD, feeds CRUD, runs/creation de run,
 * items (lecture/edition/revisions/restore/destinations/optimized/channels),
 * mapping/preview CSV, enrichissement, scores/audit/catalogue.
 *
 * Extrait de server-minimal.js (meme pattern que routes/enrichment.js et
 * routes/auth.js) : corps de handlers copies A L'IDENTIQUE. Seul ajout en tete
 * de chaque handler : `const prisma = getPrisma(); const prismaReady = getPrismaReady();`
 * pour resoudre la valeur vivante du client Prisma (reassigne pendant l'init de
 * run()) sans reecrire les references. Toutes les dependances du scope de run()
 * (middlewares d'acces, helpers metier, normalizers, schedulers, services) sont
 * injectees via `deps`. AUCUN changement de comportement.
 */
function registerIngestionRoutes(app, {
  getPrisma,
  getPrismaReady,
  AMAZON_CHANNEL_CONFIG,
  JOB_TYPES,
  analyzeProduct,
  analyzeProductWithAI,
  applyEnrichmentSources,
  bucketName,
  buildItemDestinationActivations,
  calculateFeedAuditSummary,
  createNotification,
  crypto,
  enqueueBackgroundJob,
  enrichProduct,
  ensurePrismaReady,
  escapeCsvCell,
  filterItemsForDestinationActivation,
  getAccountEmails,
  getDestinationPushContext,
  getMarketsUnavailableResponse,
  getOptimizedContentForPlatform,
  getPlatformKeyFromOverrideKey,
  hasStoredOptimizedContent,
  hasXxePayload,
  ingestCsvFromUrl,
  ingestPrestashopFromApi,
  insertEnrichmentHistoryBatchSafe,
  isDestinationEffectivelyEnabled,
  mergeOptimizedContent,
  normalizeAvailabilityForGMC,
  normalizeConditionForGMC,
  normalizeForAmazon,
  normalizeForBaidu,
  normalizeForBing,
  normalizeForCdiscount,
  normalizeForChatGPT,
  normalizeForGemini,
  normalizeForMeta,
  normalizeForPerplexity,
  normalizeForPinterest,
  normalizeForRakuten,
  normalizeForSnapchat,
  normalizeForTikTok,
  normalizeForYandex,
  normalizeRuleCustomFieldKey,
  normalizeShopifyShop,
  parseJsonObject,
  pushRuleFieldOption,
  resolveItemId,
  scheduleAutoGmcPush,
  scheduleAutoLiaSync,
  scheduleAutoOptimization,
  storage,
  syncDestinationActivationsForPlatformOverride,
  syncLegacyChannelOverrideForPlatform,
  upload,
  upsertEnrichmentStatsSafe,
  verifyEnrichmentSourceAccess,
  verifyFeedAccess,
  verifyItemAccess,
  verifySourceAccess,
}) {
  app.post('/api/v1/ingestion/sources', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { name, connector, configJson, defaultFreq, credentialId, status, feedMappingJson, mappingJson } = req.body || {};
      if (!name || !connector || !configJson) {
        return res.status(400).json({ message: 'name, connector et configJson sont requis' });
      }
      const initialFeedMapping = feedMappingJson || mappingJson || null;

      const acctId = req.accountId;
      if (prismaReady && prisma) {
        const [sourcesRows, feedsRows] = await Promise.all([
          prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "FeedSource" WHERE accountid = $1::text`, acctId),
          prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Feed" WHERE accountid = $1::text`, acctId),
        ]);
        const sourcesCount = sourcesRows?.[0]?.c ?? 0;
        const feedsCount = feedsRows?.[0]?.c ?? 0;
        const limitSources = await checkPlanLimit(prisma, acctId, 'maxFeedSources', sourcesCount);
        if (!limitSources.allowed) {
          return res.status(403).json({ code: 'PLAN_LIMIT', message: limitSources.message });
        }
        const willCreateFeed = connector === 'CSV' || connector === 'SHOPIFY' || connector === 'PRESTASHOP' || connector === 'ERP' || connector === 'PIM';
        if (willCreateFeed) {
          const limitFeeds = await checkPlanLimit(prisma, acctId, 'maxFeeds', feedsCount + 1);
          if (!limitFeeds.allowed) {
            return res.status(403).json({ code: 'PLAN_LIMIT', message: limitFeeds.message });
          }
        }
      }

      let created;
      if (prismaReady && prisma) {
        // Utiliser $executeRaw pour insérer directement avec des strings au lieu d'enums
        // car Prisma essaie d'utiliser des types enum qui n'existent pas dans PostgreSQL
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const configJsonStr = JSON.stringify(configJson);
        const finalDefaultFreq = defaultFreq || 'DAILY';
        const finalStatus = status || 'ACTIVE';
      
        try {
          // Utiliser Prisma.$executeRaw avec Prisma.sql pour une meilleure gestion des paramètres
          const { Prisma } = require('@prisma/client');
        
          // Insérer seulement les colonnes requises, utiliser les noms de colonnes en minuscules
          // car PostgreSQL les a créées sans guillemets doubles
          if (credentialId) {
            await prisma.$executeRaw`
              INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, credentialid, accountid)
              VALUES (${id}::text, ${name}::text, ${connector}::text, ${configJsonStr}::jsonb, ${finalDefaultFreq}::text, ${finalStatus}::text, ${credentialId}::text, ${acctId}::text)
            `;
          } else {
            await prisma.$executeRaw`
              INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, accountid)
              VALUES (${id}::text, ${name}::text, ${connector}::text, ${configJsonStr}::jsonb, ${finalDefaultFreq}::text, ${finalStatus}::text, ${acctId}::text)
            `;
          }
        
          // Récupérer l'objet créé
          const result = await prisma.$queryRawUnsafe(`
            SELECT * FROM "FeedSource" WHERE id = $1::text
          `, id);
          created = result[0];
        
          // Créer automatiquement un flux par défaut pour TOUTES les sources (CSV, Shopify, etc.)
          if (connector === 'CSV' || connector === 'SHOPIFY' || connector === 'PRESTASHOP' || connector === 'ERP' || connector === 'PIM') {
            try {
              const feedId = crypto.randomUUID();
              const feedNow = new Date().toISOString();
            
              // Mapping : utiliser celui envoyé par le front (analyse) si fourni, sinon défaut
              let defaultMapping = {
                id: 'id',
                title: 'title',
                description: 'description',
                link: 'link',
                image_link: 'image_link',
                price: 'price',
                brand: 'brand',
                gtin: 'gtin',
                mpn: 'mpn',
                availability: 'availability',
                condition: 'condition',
                google_product_category: 'google_product_category'
              };
              if (initialFeedMapping && typeof initialFeedMapping === 'object' && Object.keys(initialFeedMapping).length > 0) {
                defaultMapping = initialFeedMapping;
                console.log('✅ Mapping du flux pris depuis la requête (analyse):', Object.keys(defaultMapping).length, 'champs');
              }
            
              // Mapping spécifique Shopify (écrase le défaut seulement si pas de mapping fourni)
              if (connector === 'SHOPIFY' && !initialFeedMapping) {
                defaultMapping = {
                  id: 'id',
                  title: 'title',
                  description: 'body_html',
                  link: 'handle',
                  image_link: 'image.src',
                  brand: 'vendor',
                  price: 'variants[0].price',
                  gtin: 'variants[0].barcode',
                  mpn: 'variants[0].sku',
                  availability: 'variants[0].inventory_quantity',
                  condition: 'new',
                  google_product_category: ''
                };
              }

              if (connector === 'PRESTASHOP' && !initialFeedMapping) {
                defaultMapping = {
                  id: 'id',
                  title: 'name',
                  description: 'description_short',
                  link: 'link_rewrite',
                  image_link: 'id_default_image',
                  additional_image_link: 'associations.images',
                  brand: 'manufacturer_name',
                  price: 'price',
                  gtin: 'ean13',
                  mpn: 'reference',
                  availability: 'quantity',
                  condition: 'condition',
                  google_product_category: '',
                  product_type: 'id_category_default',
                  category: 'id_category_default',
                  categories: 'associations.categories',
                  color: 'features.color',
                  size: 'features.size',
                  material: 'features.material',
                  pattern: 'features.pattern',
                  gender: 'features.gender',
                  age_group: 'features.age_group',
                  meta_title: 'meta_title',
                  meta_description: 'meta_description',
                  supplier_reference: 'supplier_reference',
                  isbn: 'isbn',
                  upc: 'upc',
                  ean13: 'ean13',
                  weight: 'weight',
                  width: 'width',
                  height: 'height',
                  depth: 'depth',
                  visibility: 'visibility'
                };
              }
            
              await prisma.$executeRaw`
                INSERT INTO "Feed" (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, createdat, updatedat, accountid)
                VALUES (
                  ${feedId}::text,
                  ${`Flux principal - ${name}`}::text,
                  ${id}::text,
                  ${finalDefaultFreq}::text,
                  'ACTIVE'::text,
                  ${JSON.stringify(defaultMapping)}::jsonb,
                  'guid_or_url'::text,
                  ${feedNow}::timestamptz,
                  ${feedNow}::timestamptz,
                  ${acctId}::text
                )
              `;
            
              console.log(`✅ Flux par défaut créé automatiquement pour la source ${id} (${connector})`);
            } catch (feedError) {
              console.warn('⚠️  Erreur lors de la création du flux par défaut:', feedError.message);
              // Ne pas échouer la création de la source si le flux échoue
            }
          }
        } catch (rawError) {
          // Si l'insertion raw échoue, logger l'erreur détaillée
          console.error('❌ Erreur insertion raw:', rawError.message);
          console.error('❌ Stack:', rawError.stack);
          throw rawError; // Relancer l'erreur pour qu'elle soit capturée par le catch externe
        }
      } else {
        return res.status(503).json({ message: 'Prisma non disponible (sources)' });
      }

      res.status(201).json(created);
    } catch (e) {
      console.error('Create FeedSource error:', e);
      console.error('Error details:', {
        message: e.message,
        code: e.code,
        meta: e.meta,
        stack: e.stack?.split('\n').slice(0, 3).join('\n')
      });
      const errorMessage = e.message || 'Erreur création source';
      res.status(500).json({ 
        message: errorMessage,
        code: e.code,
        details: e.meta
      });
    }
  });

  app.get('/api/v1/ingestion/sources', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      if (!prismaReady || !prisma) {
        console.warn('⚠️ Prisma non disponible pour /ingestion/sources');
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
    
      try {
        // Essayer d'abord avec la colonne scheduletime, si ça échoue, utiliser NULL
        let list;
        try {
          // Essayer avec la colonne scheduletime
          list = await prisma.$queryRawUnsafe(`
            SELECT 
              id,
              name,
              connector,
              configjson,
              defaultfreq,
              status,
              lastrunat,
              scheduletime,
              createdat,
              updatedat,
              credentialid,
              accountid
            FROM "FeedSource"
            WHERE accountid = $1::text
            ORDER BY createdat DESC
          `, req.accountId);
          console.log('✅ Requête avec scheduletime réussie (filtered by account)');
        } catch (scheduleTimeError) {
          // Si la colonne n'existe pas, utiliser NULL
          if (scheduleTimeError.code === 'P2010' || scheduleTimeError.message?.includes('does not exist')) {
            console.log('⚠️ Colonne scheduletime n\'existe pas, utilisation de NULL');
            list = await prisma.$queryRawUnsafe(`
              SELECT 
                id,
                name,
                connector,
                configjson,
                defaultfreq,
                status,
                lastrunat,
                NULL::TEXT as scheduletime,
                createdat,
                updatedat,
                credentialid,
                accountid
              FROM "FeedSource"
              WHERE accountid = $1::text
              ORDER BY createdat DESC
            `, req.accountId);
          } else {
            // Si c'est une autre erreur, la relancer
            throw scheduleTimeError;
          }
        }
      
        // Normaliser les noms de colonnes (minuscules vers camelCase)
        const normalized = (list || []).map(item => {
          // Parser configjson si c'est une string
          let configJson = {};
          if (item.configjson) {
            try {
              if (typeof item.configjson === 'string') {
                configJson = JSON.parse(item.configjson);
              } else if (typeof item.configjson === 'object' && item.configjson !== null) {
                configJson = item.configjson;
              }
            } catch (e) {
              console.warn('⚠️ Erreur parsing configjson pour source', item.id, e.message);
              configJson = {};
            }
          }
        
          return {
            id: item.id,
            name: item.name,
            connector: item.connector,
            configJson: configJson,
            configjson: configJson,
            defaultFreq: item.defaultfreq || 'DAILY',
            defaultfreq: item.defaultfreq || 'DAILY',
            status: item.status,
            lastRunAt: item.lastrunat || null,
            lastrunat: item.lastrunat || null,
            scheduleTime: item.scheduletime || null,
            scheduletime: item.scheduletime || null,
            createdAt: item.createdat,
            createdat: item.createdat,
            updatedAt: item.updatedat,
            updatedat: item.updatedat,
            credentialId: item.credentialid || null,
            credentialid: item.credentialid || null
          };
        });
      
        return res.json(normalized);
      } catch (dbError) {
        console.error('❌ Erreur base de données lors du listing des sources:', dbError);
        console.error('❌ Détails:', {
          message: dbError.message,
          code: dbError.code,
          meta: dbError.meta
        });
        return res.status(500).json({ 
          message: 'Erreur base de données',
          error: dbError.message,
          code: dbError.code
        });
      }
    } catch (e) {
      console.error('❌ Erreur inattendue lors du listing des sources:', e);
      console.error('❌ Stack:', e.stack);
      res.status(500).json({ 
        message: 'Erreur listing sources',
        error: e.message,
        details: e.stack?.substring(0, 200)
      });
    }
  });

  app.put('/api/v1/ingestion/sources/:id', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const { name, configJson, defaultFreq, status, scheduleTime } = req.body || {};
    
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      // Vérifier l'ownership
      if (!await verifySourceAccess(id, req.accountId)) {
        return res.status(403).json({ message: 'Accès refusé à cette source' });
      }

      // Valider le format de scheduleTime si fourni (HH:MM)
      if (scheduleTime !== undefined && scheduleTime !== null && scheduleTime !== '') {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(scheduleTime)) {
          return res.status(400).json({ message: 'Format d\'heure invalide. Utilisez HH:MM (ex: 02:00)' });
        }
      }

      // Whitelist des colonnes autorisées pour prévenir l'injection SQL via noms de colonnes
      const ALLOWED_SOURCE_COLUMNS = ['name', 'configjson', 'defaultfreq', 'status', 'scheduletime', 'updatedat'];
    
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (configJson !== undefined) updates.configjson = JSON.stringify(configJson);
      if (defaultFreq !== undefined) updates.defaultfreq = defaultFreq;
      if (status !== undefined) updates.status = status;
      if (scheduleTime !== undefined) updates.scheduletime = scheduleTime || null;
      updates.updatedat = new Date().toISOString();

      // Vérifier que toutes les clés sont dans la whitelist
      const invalidKeys = Object.keys(updates).filter(k => !ALLOWED_SOURCE_COLUMNS.includes(k));
      if (invalidKeys.length > 0) {
        return res.status(400).json({ message: `Colonnes non autorisées: ${invalidKeys.join(', ')}` });
      }

      const setClause = Object.keys(updates).map((key, idx) => `"${key}" = $${idx + 2}`).join(', ');
      const values = [id, ...Object.values(updates)];

      await prisma.$executeRawUnsafe(`
        UPDATE "FeedSource" 
        SET ${setClause}
        WHERE id = $1::text
      `, ...values);

      const updated = await prisma.$queryRawUnsafe(`
        SELECT * FROM "FeedSource" WHERE id = $1::text
      `, id);

      if (!updated || updated.length === 0) {
        return res.status(404).json({ message: 'Source non trouvée' });
      }

      res.json(updated[0]);
    } catch (e) {
      console.error('Update FeedSource error:', e);
      res.status(500).json({ message: 'Erreur mise à jour source' });
    }
  });

  app.delete('/api/v1/ingestion/sources/:id', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
    
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      // Vérifier l'ownership
      if (!await verifySourceAccess(id, req.accountId)) {
        return res.status(403).json({ message: 'Accès refusé à cette source' });
      }

      // Supprimer la source (avec accountid pour isolation multi-tenant — défense en profondeur)
      const deleted = await prisma.$executeRawUnsafe(`
        DELETE FROM "FeedSource" WHERE id = $1::text AND accountid = $2::text
      `, id, req.accountId);

      if (deleted === 0) {
        return res.status(404).json({ message: 'Source non trouvée ou accès refusé' });
      }

      res.status(204).send();
    } catch (e) {
      console.error('Delete FeedSource error:', e);
      res.status(500).json({ message: 'Erreur suppression source' });
    }
  });

  app.post('/api/v1/ingestion/feeds', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { name, sourceId, frequency, status, mappingJson, dedupStrategy } = req.body || {};
      if (!name || !sourceId || !mappingJson) {
        return res.status(400).json({ message: 'name, sourceId et mappingJson sont requis' });
      }
      const acctId = req.accountId;
      if (prismaReady && prisma) {
        if (!await verifySourceAccess(sourceId, acctId)) {
          return res.status(403).json({ message: 'Accès refusé à cette source' });
        }
        const feedsRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Feed" WHERE accountid = $1::text`, acctId);
        const feedsCount = feedsRows?.[0]?.c ?? 0;
        const limitFeeds = await checkPlanLimit(prisma, acctId, 'maxFeeds', feedsCount + 1);
        if (!limitFeeds.allowed) {
          return res.status(403).json({ code: 'PLAN_LIMIT', message: limitFeeds.message });
        }
        // Utiliser une requête raw pour éviter les problèmes d'enums
        const feedId = crypto.randomUUID();
        const now = new Date().toISOString();
        const finalFrequency = frequency || 'DAILY';
        const finalStatus = status || 'ACTIVE';
        const finalDedupStrategy = dedupStrategy || 'guid_or_url';
        const mappingJsonStr = JSON.stringify(mappingJson);
      
        await prisma.$executeRaw`
          INSERT INTO "Feed" (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, createdat, updatedat, accountid)
          VALUES (
            ${feedId}::text,
            ${name}::text,
            ${sourceId}::text,
            ${finalFrequency}::text,
            ${finalStatus}::text,
            ${mappingJsonStr}::jsonb,
            ${finalDedupStrategy}::text,
            ${now}::timestamptz,
            ${now}::timestamptz,
            ${acctId}::text
          )
        `;
      
        // Récupérer le feed créé avec sa source
        const created = await prisma.$queryRawUnsafe(`
          SELECT f.*, 
                 json_build_object(
                   'id', s.id,
                   'name', s.name,
                   'connector', s.connector,
                   'configJson', s.configjson,
                   'defaultFreq', s.defaultfreq,
                   'status', s.status
                 ) as source
          FROM "Feed" f
          JOIN "FeedSource" s ON f.sourceid = s.id
          WHERE f.id = $1::text
        `, feedId);
      
        return res.status(201).json(created[0]);
      }
      return res.status(503).json({ message: 'Prisma non disponible (feeds)' });
    } catch (e) {
      console.error('Create Feed error:', e);
      res.status(500).json({ message: 'Erreur création feed' });
    }
  });

  app.get('/api/v1/ingestion/feeds', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      if (await ensurePrismaReady()) {
        // Utiliser une requête raw pour éviter les problèmes d'enums
        const baseFeedsQuery = `
          SELECT
            f.id,
            f.name,
            f.sourceid,
            f.frequency,
            f.status,
            f.mappingjson,
            f.dedupstrategy,
            f.autopush_enabled,
            f.createdat,
            f.updatedat,
            json_build_object(
              'status', ir.status,
              'totalFetched', ir.totalfetched,
              'totalInserted', ir.totalinserted,
              'totalUpdated', ir.totalupdated,
              'totalSkipped', ir.totalskipped,
              'errorMessage', ir.errormessage,
              'finishedAt', ir.finishedat
            ) as "latestRun",
            json_build_object(
              'id', s.id,
              'name', s.name,
              'connector', s.connector,
              'configJson', s.configjson,
              'defaultFreq', s.defaultfreq,
              'status', s.status,
              'lastRunAt', s.lastrunat
            ) as source
          FROM "Feed" f
          JOIN "FeedSource" s ON f.sourceid = s.id
          LEFT JOIN LATERAL (
            SELECT
              ir.status,
              ir.totalfetched,
              ir.totalinserted,
              ir.totalupdated,
              ir.totalskipped,
              ir.errormessage,
              ir.finishedat
            FROM "IngestionRun" ir
            WHERE ir.feedid = f.id
            ORDER BY ir.finishedat DESC NULLS LAST
            LIMIT 1
          ) ir ON TRUE
          WHERE f.accountid = $1::text
          ORDER BY f.createdat DESC
        `;
        let feeds;
        try {
          feeds = await prisma.$queryRawUnsafe(baseFeedsQuery, req.accountId);
        } catch (err) {
          // Tolère l'absence de la colonne autopush_enabled (migration 034 non appliquée).
          if (err?.code === 'P2010' || /autopush_enabled/i.test(err?.message || '')) {
            feeds = await prisma.$queryRawUnsafe(
              baseFeedsQuery.replace('f.autopush_enabled', 'false AS autopush_enabled'),
              req.accountId
            );
          } else {
            throw err;
          }
        }
        // Normaliser les noms de colonnes pour le frontend
        const normalizedFeeds = feeds.map(feed => ({
          id: feed.id,
          name: feed.name,
          sourceId: feed.sourceid,
          sourceid: feed.sourceid,
          frequency: feed.frequency,
          status: feed.status,
          mappingJson: feed.mappingjson,
          mappingjson: feed.mappingjson,
          dedupStrategy: feed.dedupstrategy,
          autoPushEnabled: feed.autopush_enabled === true,
          createdAt: feed.createdat,
          updatedAt: feed.updatedat,
          latestRun: feed.latestRun?.finishedAt || feed.latestRun?.status ? feed.latestRun : null,
          source: feed.source
        }));
        return res.json(normalizedFeeds);
      }
      return res.status(503).json([]);
    } catch (e) {
      console.error('List Feed error:', e);
      res.status(500).json({ message: 'Erreur listing feeds' });
    }
  });

  app.get('/api/v1/ingestion/fields', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      if (!(await ensurePrismaReady()) || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      const rawFeedIds = typeof req.query.feedIds === 'string' ? req.query.feedIds : '';
      const requestedFeedIds = rawFeedIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const sampleSize = Math.min(Math.max(parseInt(req.query.sampleSize, 10) || 200, 50), 500);

      const feedRows = requestedFeedIds.length > 0
        ? await prisma.$queryRawUnsafe(`
            SELECT id, name, mappingjson
            FROM "Feed"
            WHERE accountid = $1::text AND id = ANY($2::text[])
            ORDER BY createdat DESC
          `, req.accountId, requestedFeedIds)
        : await prisma.$queryRawUnsafe(`
            SELECT id, name, mappingjson
            FROM "Feed"
            WHERE accountid = $1::text
            ORDER BY createdat DESC
          `, req.accountId);

      if (requestedFeedIds.length > 0 && feedRows.length !== requestedFeedIds.length) {
        return res.status(403).json({ message: 'Accès refusé à un ou plusieurs flux' });
      }

      const feedIds = feedRows.map((feed) => feed.id);
      if (feedIds.length === 0) {
        return res.json({ fields: [], feedIds: [], sampleSize: 0 });
      }

      const sampleRows = await prisma.$queryRawUnsafe(`
        SELECT
          id,
          feedid,
          title,
          descriptiontext,
          descriptionhtml,
          imageurl,
          url,
          brand,
          sku,
          price,
          currency,
          inventory,
          gtin,
          mpn,
          condition,
          customfields
        FROM "FeedItem"
        WHERE feedid = ANY($1::text[])
        ORDER BY updatedat DESC NULLS LAST, createdat DESC NULLS LAST
        LIMIT $2
      `, feedIds, sampleSize);

      const fields = new Map();

      for (const feed of feedRows) {
        const mapping = feed.mappingjson && typeof feed.mappingjson === 'object' ? feed.mappingjson : {};
        for (const key of Object.keys(mapping)) {
          const normalizedKey = normalizeRuleCustomFieldKey(key) || key;
          pushRuleFieldOption(fields, normalizedKey, 'mapping', feed.id);
        }
      }

      const baseFieldResolvers = [
        ['title', (row) => row.title],
        ['descriptionText', (row) => row.descriptiontext],
        ['descriptionHtml', (row) => row.descriptionhtml],
        ['imageUrl', (row) => row.imageurl],
        ['url', (row) => row.url],
        ['brand', (row) => row.brand],
        ['sku', (row) => row.sku],
        ['price', (row) => row.price],
        ['currency', (row) => row.currency],
        ['inventory', (row) => row.inventory],
        ['gtin', (row) => row.gtin],
        ['mpn', (row) => row.mpn],
        ['condition', (row) => row.condition],
      ];

      for (const row of sampleRows) {
        for (const [fieldKey, resolveValue] of baseFieldResolvers) {
          const value = resolveValue(row);
          if (value !== undefined && value !== null && value !== '') {
            pushRuleFieldOption(fields, fieldKey, 'item', row.feedid);
          }
        }

        let customfields = row.customfields;
        try {
          customfields = typeof customfields === 'string' ? JSON.parse(customfields || '{}') : (customfields || {});
        } catch (error) {
          customfields = {};
        }

        if (!customfields || typeof customfields !== 'object') continue;

        for (const [rawKey, rawValue] of Object.entries(customfields)) {
          if (rawValue === undefined || rawValue === null || rawValue === '') continue;
          const normalizedKey = normalizeRuleCustomFieldKey(rawKey);
          if (!normalizedKey) continue;
          pushRuleFieldOption(fields, normalizedKey, 'customfield', row.feedid);
        }
      }

      return res.json({
        fields: Array.from(fields.values())
          .map((field) => ({
            key: field.key,
            label: field.label,
            source: field.source,
            feedIds: Array.from(field.feedIds),
          }))
          .sort((left, right) => left.label.localeCompare(right.label, 'fr')),
        feedIds,
        sampleSize: sampleRows.length,
      });
    } catch (e) {
      console.error('Erreur champs dynamiques rules:', e);
      return res.status(500).json({ message: 'Erreur récupération des champs', error: e.message });
    }
  });

  app.put('/api/v1/ingestion/feeds/:id', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const { name, frequency, status, mappingJson, dedupStrategy, autoPushEnabled } = req.body || {};
    
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      // Vérifier l'ownership
      if (!await verifyFeedAccess(id, req.accountId)) {
        return res.status(403).json({ message: 'Accès refusé à ce flux' });
      }

      // Vérifier que le feed existe
      const existing = await prisma.$queryRawUnsafe(`
        SELECT * FROM "Feed" WHERE id = $1::text
      `, id);

      if (!existing || existing.length === 0) {
        return res.status(404).json({ message: 'Feed non trouvé' });
      }

      const feed = existing[0];
      const now = new Date().toISOString();
    
      // Construire la requête UPDATE dynamiquement
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex}::text`);
        values.push(name);
        paramIndex++;
      }
      if (frequency !== undefined) {
        updates.push(`frequency = $${paramIndex}::text`);
        values.push(frequency);
        paramIndex++;
      }
      if (status !== undefined) {
        updates.push(`status = $${paramIndex}::text`);
        values.push(status);
        paramIndex++;
      }
      if (mappingJson !== undefined) {
        updates.push(`mappingjson = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(mappingJson));
        paramIndex++;
      }
      if (dedupStrategy !== undefined) {
        updates.push(`dedupstrategy = $${paramIndex}::text`);
        values.push(dedupStrategy);
        paramIndex++;
      }
      if (autoPushEnabled !== undefined) {
        updates.push(`autopush_enabled = $${paramIndex}::boolean`);
        values.push(!!autoPushEnabled);
        paramIndex++;
      }

      // Toujours mettre à jour updatedAt
      updates.push(`updatedat = $${paramIndex}::timestamptz`);
      values.push(now);
      paramIndex++;

      if (updates.length === 1) {
        // Seulement updatedAt, pas besoin de mettre à jour
        const updated = await prisma.$queryRawUnsafe(`
          SELECT f.*, 
                 json_build_object(
                   'id', s.id,
                   'name', s.name,
                   'connector', s.connector,
                   'configJson', s.configjson,
                   'defaultFreq', s.defaultfreq,
                   'status', s.status
                 ) as source
          FROM "Feed" f
          JOIN "FeedSource" s ON f.sourceid = s.id
          WHERE f.id = $1::text
        `, id);
        return res.json(updated[0]);
      }

      // Ajouter l'ID à la fin pour la clause WHERE
      values.push(id);

      const updateQuery = `
        UPDATE "Feed" 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}::text
      `;

      await prisma.$executeRawUnsafe(updateQuery, ...values);

      // Récupérer le feed mis à jour avec sa source
      const updated = await prisma.$queryRawUnsafe(`
        SELECT f.*, 
               json_build_object(
                 'id', s.id,
                 'name', s.name,
                 'connector', s.connector,
                 'configJson', s.configjson,
                 'defaultFreq', s.defaultfreq,
                 'status', s.status
               ) as source
        FROM "Feed" f
        JOIN "FeedSource" s ON f.sourceid = s.id
        WHERE f.id = $1::text
      `, id);

      return res.json(updated[0]);
    } catch (e) {
      console.error('Update Feed error:', e);
      res.status(500).json({ message: 'Erreur mise à jour feed' });
    }
  });

  app.post('/api/v1/ingestion/create-missing-feeds', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }

    const results = {
      created: [],
      errors: []
    };

    try {
      const acctId = req.accountId;
      const feedsRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Feed" WHERE accountid = $1::text`, acctId);
      const feedsCount = feedsRows?.[0]?.c ?? 0;

      // Récupérer uniquement les sources CSV sans flux DU COMPTE CONNECTÉ
      const sourcesWithoutFeeds = await prisma.$queryRawUnsafe(`
        SELECT s.*
        FROM "FeedSource" s
        LEFT JOIN "Feed" f ON f.sourceid = s.id
        WHERE s.connector = 'CSV' AND f.id IS NULL AND s.accountid = $1::text
      `, acctId);

      const toCreate = sourcesWithoutFeeds?.length ?? 0;
      if (toCreate > 0) {
        const limitFeeds = await checkPlanLimit(prisma, acctId, 'maxFeeds', feedsCount + toCreate);
        if (!limitFeeds.allowed) {
          return res.status(403).json({ code: 'PLAN_LIMIT', message: limitFeeds.message });
        }
      }

      for (const source of sourcesWithoutFeeds) {
        try {
          const feedId = crypto.randomUUID();
          const now = new Date().toISOString();
          const sourceConfig = source.configjson || source.configJson || {};
        
          if (!sourceConfig.csvUrl && !sourceConfig.csvurl) {
            results.errors.push({
              sourceId: source.id,
              sourceName: source.name,
              error: 'csvUrl manquant dans la configuration'
            });
            continue;
          }

          // Mapping par défaut pour CSV (basé sur le format Google Merchant Center)
          const defaultMapping = {
            title: 'title',
            sku: 'id',
            price: 'price',
            url: 'link',
            imageUrl: 'image_link',
            brand: 'brand',
            description: 'description',
            inventory: 'availability'
          };

          // Utiliser $executeRawUnsafe avec paramètres positionnels
          await prisma.$executeRawUnsafe(`
            INSERT INTO "Feed" (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, createdat, updatedat, accountid)
            VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::jsonb, $7::text, $8::timestamptz, $9::timestamptz, $10::text)
          `, 
            feedId,
            `Flux principal - ${source.name}`,
            source.id,
            source.defaultfreq || 'DAILY',
            'ACTIVE',
            JSON.stringify(defaultMapping),
            'guid_or_url',
            now,
            now,
            req.accountId || source.accountid
          );

          results.created.push({
            sourceId: source.id,
            sourceName: source.name,
            feedId: feedId
          });
        } catch (error) {
          results.errors.push({
            sourceId: source.id,
            sourceName: source.name,
            error: error.message
          });
        }
      }

      res.json(results);
    } catch (error) {
      res.status(500).json({
        message: 'Erreur lors de la création des flux manquants',
        error: error.message
      });
    }
  });

  app.post('/api/v1/ingestion/feeds/:id/runs', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const runAt = new Date().toISOString();
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible (runs)' });
      }
      const acctId = req.accountId;
      const productCount = await countProductsForAccount(prisma, acctId);
      const limitProducts = await checkPlanLimit(prisma, acctId, 'maxProducts', productCount);
      if (!limitProducts.allowed) {
        return res.status(403).json({ code: 'PLAN_LIMIT', message: limitProducts.message });
      }

      // Récupérer le feed avec sa source (et credentialId pour Shopify) en utilisant une requête raw
      // Utiliser COALESCE pour gérer les valeurs NULL et ::jsonb pour forcer le type JSONB
      const feeds = await prisma.$queryRawUnsafe(`
        SELECT 
          f.id,
          f.name,
          f.sourceid,
          COALESCE(f.mappingjson, '{}'::jsonb) as "mappingJson",
          COALESCE(f.mappingjson, '{}'::jsonb) as "mappingjson",
          f.frequency,
          f.status,
          f.dedupstrategy as "dedupStrategy",
          f.createdat as "createdAt",
          f.updatedat as "updatedAt",
          json_build_object(
            'id', s.id,
            'name', s.name,
            'connector', s.connector,
            'configJson', s.configjson,
            'configjson', s.configjson,
            'defaultFreq', s.defaultfreq,
            'status', s.status,
            'credentialId', s.credentialid
          ) as source
        FROM "Feed" f
        JOIN "FeedSource" s ON f.sourceid = s.id
        WHERE f.id = $1::text
      `, id);
    
      if (!feeds || feeds.length === 0) return res.status(404).json({ message: 'Feed non trouvé' });
      const feed = feeds[0];

      // Sprint 2 (B-PROPER) — ingestion en background derrière un flag (défaut OFF
      // pour ne rien changer au comportement existant). Si activé, on crée un
      // IngestionRun PENDING, on enfile un job, et on répond 202 { ingestionRunId }.
      // Le frontend doit alors poller GET /api/v1/ingestion/feeds/:id/runs (statut
      // PENDING→RUNNING→SUCCESS/FAILED). Voir contrat dans ARCHITECTURE/rapport.
      if (String(process.env.INGESTION_BACKGROUND || '').trim() === '1') {
        const ingestionRunId = require('crypto').randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO "IngestionRun" (id, feedid, status, scheduledat) VALUES ($1::text, $2::text, 'PENDING', NOW())`,
          ingestionRunId, feed.id
        );
        await enqueueBackgroundJob(
          JOB_TYPES.INGESTION_RUN,
          { feedId: feed.id, accountId: req.accountId, ingestionRunId },
          { dedupKey: `ingest:${feed.id}`, dedupWindowMs: 5000 }
        );
        return res.status(202).json({
          message: 'Ingestion programmée en arrière-plan',
          ingestionRunId,
          status: 'PENDING',
          poll: `/api/v1/ingestion/feeds/${feed.id}/runs`,
        });
      }
    
      // Debug: afficher le mapping récupéré
      console.log('🔍 Feed récupéré pour ingestion:', {
        feedId: feed.id,
        feedName: feed.name,
        mappingJson: feed.mappingJson,
        mappingjson: feed.mappingjson,
        mappingKeys: Object.keys(feed.mappingJson || feed.mappingjson || {}).length
      });

      // Pour l'instant: support CSV via URL (dans feed.source.configJson.csvUrl)
      if (feed.source.connector === 'CSV') {
        const sourceConfig = feed.source.configJson || feed.source.configjson || {};
        let csvUrl = sourceConfig.csvUrl || sourceConfig.csvurl || req.body?.csvUrl;
        const gcsPath = sourceConfig.gcsPath || sourceConfig.gcspath;
      
        // Si on a un chemin GCS, lire le fichier directement (plus fiable que les URLs signées)
        let csvText = null;
        if (gcsPath && gcsPath.startsWith('gs://')) {
          try {
            const gcsMatch = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
            if (gcsMatch) {
              const [, gcsBucket, gcsFileName] = gcsMatch;
              const bucket = storage.bucket(gcsBucket);
              const file = bucket.file(gcsFileName);
              const [content] = await file.download();
              csvText = content.toString('utf-8');
              console.log(`✅ Fichier lu depuis GCS: ${gcsPath}`);
            }
          } catch (gcsErr) {
            console.warn('⚠️ Lecture GCS échouée:', gcsErr.message);
            return res.status(400).json({
              message: 'Impossible d\'accéder au fichier dans Cloud Storage.',
              detail: gcsErr.message.includes('Not Found') || gcsErr.message.includes('404')
                ? 'Le fichier a peut-être été supprimé. Ré-uploadez votre CSV depuis la page Sources.'
                : `Erreur: ${gcsErr.message}. Vérifiez que le bucket et les permissions sont corrects.`
            });
          }
        }
      
        if (!csvUrl && !csvText) {
          return res.status(400).json({
            message: 'Aucune URL de fichier configurée.',
            detail: 'Ré-uploadez votre fichier CSV depuis la page Sources ou vérifiez la configuration de la source.'
          });
        }

        if (csvUrl && csvUrl.startsWith('file://')) {
          return res.status(400).json({
            message: 'Le fichier uploadé n\'est plus accessible.',
            detail: 'Supprimez cette source et recréez-la en ré-important votre fichier CSV. Le stockage Cloud n\'était peut-être pas configuré lors de la création.'
          });
        }
        const result = await ingestCsvFromUrl({ prisma, feed, csvUrl: csvText ? undefined : csvUrl, csvText });

        // Appliquer les règles Optimiser (runOnIngestion=true) AVANT l'enrichissement
        try {
          const { applyRulesOnIngestion } = require('./rules/engine');
          const rulesResult = await applyRulesOnIngestion(prisma, feed.id, req.accountId, createRevision);
          if (rulesResult.applied > 0 || rulesResult.excluded > 0) {
            console.log(`✅ Règles Optimiser: ${rulesResult.applied} modifications, ${rulesResult.excluded} exclus (${rulesResult.rulesCount} règles)`);
          }
        } catch (rulesErr) {
          console.warn('⚠️ Règles non appliquées à l\'ingestion:', rulesErr.message);
        }

        // Appliquer les sources secondaires d'enrichissement
        try {
          const enrichResult = await applyEnrichmentSources(prisma, feed.id, req.accountId, storage);
          if (enrichResult.applied > 0) {
            console.log(`✅ Enrichissement: ${enrichResult.applied} produits mis à jour via ${enrichResult.sources} source(s) secondaire(s)`);
          }
        } catch (enrichErr) {
          console.warn('⚠️ Enrichissement sources secondaires non appliqué:', enrichErr.message);
        }

        // Email "Synchronisation terminée" aux utilisateurs du compte
        const accountEmails = await getAccountEmails(req.accountId);
        const feedName = feed.name || `Flux ${id.substring(0, 8)}`;
        const stats = {
          totalFetched: result.totalFetched ?? 0,
          totalInserted: result.totalInserted ?? 0,
          totalUpdated: result.totalUpdated ?? 0
        };
        for (const email of accountEmails.slice(0, 3)) {
          sendSyncCompleteEmail(email, feedName, stats).catch(err => console.warn('Email sync terminée non envoyé:', err.message));
        }

        await prisma.$executeRawUnsafe(`
          UPDATE "FeedSource"
          SET lastrunat = $1::timestamptz, updatedat = $1::timestamptz
          WHERE id = $2::text
        `, runAt, feed.sourceid);

        scheduleAutoGmcPush(req.accountId, feed.id, 'ingestion CSV');
        return res.status(201).json({ message: 'Ingestion CSV effectuée', ...result });
      }

      // Ingestion Shopify via API GraphQL
      if (feed.source.connector === 'SHOPIFY') {
        const sourceConfig = feed.source.configJson || feed.source.configjson || {};
        const credentialId = feed.source.credentialId;
        const shop = sourceConfig.shop || sourceConfig.Shop;

        if (!credentialId || !shop) {
          return res.status(400).json({
            message: 'Source Shopify mal configurée.',
            detail: 'Credential ou shop manquant. Reconnectez votre boutique Shopify depuis la page Sources.'
          });
        }

        // Récupérer le token d'accès depuis la Credential
        const creds = await prisma.$queryRawUnsafe(`
          SELECT secretjson FROM "Credential" WHERE id = $1::text
        `, credentialId);

        if (!creds || creds.length === 0) {
          return res.status(400).json({
            message: 'Credential Shopify introuvable.',
            detail: 'Reconnectez votre boutique Shopify depuis la page Sources.'
          });
        }

        const secret = creds[0].secretjson;
        const secretData = decryptObjectSecrets(typeof secret === 'string' ? JSON.parse(secret) : secret);
        const accessToken = secretData.accessToken || secretData.access_token;

        if (!accessToken) {
          return res.status(400).json({
            message: 'Token d\'accès Shopify manquant.',
            detail: 'Reconnectez votre boutique Shopify depuis la page Sources.'
          });
        }

        const normalizedShop = normalizeShopifyShop(shop);
      if (!normalizedShop) {
        return res.status(400).json({ message: 'Nom de boutique Shopify invalide' });
      }

        const result = await ingestShopifyFromApi({
          prisma,
          feed: {
            id: feed.id,
            name: feed.name,
            sourceId: feed.sourceid,
            mappingJson: feed.mappingJson || feed.mappingjson || {},
          },
          shop: normalizedShop,
          accessToken,
        });

        // Appliquer les règles Optimiser (runOnIngestion=true) AVANT l'enrichissement
        try {
          const { applyRulesOnIngestion } = require('./rules/engine');
          const rulesResult = await applyRulesOnIngestion(prisma, feed.id, req.accountId, createRevision);
          if (rulesResult.applied > 0 || rulesResult.excluded > 0) {
            console.log(`✅ Règles Optimiser: ${rulesResult.applied} modifications, ${rulesResult.excluded} exclus (${rulesResult.rulesCount} règles)`);
          }
        } catch (rulesErr) {
          console.warn('⚠️ Règles non appliquées à l\'ingestion:', rulesErr.message);
        }

        // Appliquer les sources secondaires d'enrichissement
        try {
          const enrichResult = await applyEnrichmentSources(prisma, feed.id, req.accountId, storage);
          if (enrichResult.applied > 0) {
            console.log(`✅ Enrichissement: ${enrichResult.applied} produits mis à jour via ${enrichResult.sources} source(s) secondaire(s)`);
          }
        } catch (enrichErr) {
          console.warn('⚠️ Enrichissement sources secondaires non appliqué:', enrichErr.message);
        }

        // Email "Synchronisation terminée" aux utilisateurs du compte
        const accountEmails = await getAccountEmails(req.accountId);
        const feedName = feed.name || `Flux ${id.substring(0, 8)}`;
        const stats = {
          totalFetched: result.totalFetched ?? 0,
          totalInserted: result.totalInserted ?? 0,
          totalUpdated: result.totalUpdated ?? 0
        };
        for (const email of accountEmails.slice(0, 3)) {
          sendSyncCompleteEmail(email, feedName, stats).catch(err => console.warn('Email sync terminée non envoyé:', err.message));
        }

        await prisma.$executeRawUnsafe(`
          UPDATE "FeedSource"
          SET lastrunat = $1::timestamptz, updatedat = $1::timestamptz
          WHERE id = $2::text
        `, runAt, feed.sourceid);

        scheduleAutoOptimization(req.accountId, feed.id, 'ingestion Shopify');
        scheduleAutoLiaSync(req.accountId, 'ingestion Shopify');
        return res.status(201).json({ message: 'Ingestion Shopify effectuée', ...result });
      }

      if (feed.source.connector === 'PRESTASHOP') {
        const sourceConfig = feed.source.configJson || feed.source.configjson || {};
        const shopUrl = sourceConfig.shopUrl || sourceConfig.shopurl || sourceConfig.baseUrl || sourceConfig.baseurl;
        const apiKey = sourceConfig.apiKey || sourceConfig.apikey;

        if (!shopUrl || !apiKey) {
          return res.status(400).json({
            message: 'Source PrestaShop mal configurée.',
            detail: 'URL de boutique ou clé API manquante. Reconfigurez la source depuis la page Sources.'
          });
        }

        const result = await ingestPrestashopFromApi({
          prisma,
          feed: {
            id: feed.id,
            name: feed.name,
            sourceId: feed.sourceid,
            mappingJson: feed.mappingJson || feed.mappingjson || {},
          },
          shopUrl: String(shopUrl).trim().replace(/\/+$/, ''),
          apiKey: String(apiKey).trim(),
        });

        try {
          const { applyRulesOnIngestion } = require('./rules/engine');
          const rulesResult = await applyRulesOnIngestion(prisma, feed.id, req.accountId, createRevision);
          if (rulesResult.applied > 0 || rulesResult.excluded > 0) {
            console.log(`✅ Règles Optimiser: ${rulesResult.applied} modifications, ${rulesResult.excluded} exclus (${rulesResult.rulesCount} règles)`);
          }
        } catch (rulesErr) {
          console.warn('⚠️ Règles non appliquées à l\'ingestion:', rulesErr.message);
        }

        try {
          const enrichResult = await applyEnrichmentSources(prisma, feed.id, req.accountId, storage);
          if (enrichResult.applied > 0) {
            console.log(`✅ Enrichissement: ${enrichResult.applied} produits mis à jour via ${enrichResult.sources} source(s) secondaire(s)`);
          }
        } catch (enrichErr) {
          console.warn('⚠️ Enrichissement sources secondaires non appliqué:', enrichErr.message);
        }

        const accountEmails = await getAccountEmails(req.accountId);
        const feedName = feed.name || `Flux ${id.substring(0, 8)}`;
        const stats = {
          totalFetched: result.totalFetched ?? 0,
          totalInserted: result.totalInserted ?? 0,
          totalUpdated: result.totalUpdated ?? 0
        };
        for (const email of accountEmails.slice(0, 3)) {
          sendSyncCompleteEmail(email, feedName, stats).catch(err => console.warn('Email sync terminée non envoyé:', err.message));
        }

        await prisma.$executeRawUnsafe(`
          UPDATE "FeedSource"
          SET lastrunat = $1::timestamptz, updatedat = $1::timestamptz
          WHERE id = $2::text
        `, runAt, feed.sourceid);

        scheduleAutoGmcPush(req.accountId, feed.id, 'ingestion PrestaShop');
        return res.status(201).json({ message: 'Ingestion Prestashop effectuée', ...result });
      }

      // Stubs pour autres connecteurs
      return res.status(400).json({ message: `Connecteur ${feed.source.connector} non encore supporté` });
    } catch (e) {
      const errMsg = e?.message || String(e);
      console.error('Create Run error:', errMsg);
      if (typeof require !== 'undefined') {
        try { require('@sentry/node').captureException(e); } catch (_) {}
      }

      // Email "Erreur de sync" aux utilisateurs du compte
      const accountId = req.accountId;
      if (accountId) {
        const accountEmails = await getAccountEmails(accountId);
        const context = 'Synchronisation du flux';
        for (const email of accountEmails.slice(0, 3)) {
          sendErrorEmail(email, context, errMsg.substring(0, 500)).catch(err => console.warn('Email erreur sync non envoyé:', err.message));
        }
      }

      // B5 — catalogue au-delà du plafond d'ingestion synchrone : 413 explicite.
      if (e?.statusCode === 413 || e?.code === 'INGEST_TOO_LARGE') {
        return res.status(413).json({ code: 'INGEST_TOO_LARGE', message: errMsg });
      }

      // Retourner le message d'erreur réel pour faciliter le debug (sans exposer de secrets)
      const safeDetail = errMsg
        .replace(/[a-zA-Z0-9._-]+@[^\s]+/g, '[email]') // masquer les emails
        .substring(0, 300);
      res.status(500).json({
        message: 'Erreur lors de la synchronisation',
        detail: safeDetail
      });
    }
  });

  app.get('/api/v1/ingestion/feeds/:id/runs', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
      const { id } = req.params;
      if (!await verifyFeedAccess(id, req.accountId)) {
        return res.status(403).json({ message: 'Accès refusé à ce flux' });
      }
      const limit = Math.min(parseInt(req.query.limit) || 5, 50);
      const runs = await prisma.$queryRawUnsafe(
        `SELECT id, status, scheduledat AS "scheduledAt", startedat AS "startedAt",
                finishedat AS "finishedAt", totalfetched AS "totalFetched",
                totalinserted AS "totalInserted", totalupdated AS "totalUpdated",
                totalskipped AS "totalSkipped", errormessage AS "errorMessage"
         FROM "IngestionRun" WHERE feedid = $1::text
         ORDER BY COALESCE(startedat, scheduledat) DESC NULLS LAST
         LIMIT $2::int`,
        id, limit
      );
      return res.json({ runs: runs || [], latest: (runs && runs[0]) || null });
    } catch (e) {
      console.error('Get runs error:', e?.message || e);
      return res.status(500).json({ message: 'Erreur lecture des runs' });
    }
  });

  app.post('/api/v1/ingestion/feeds/:id/force-update-customfields', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      // Récupérer le feed avec son mapping
      const feeds = await prisma.$queryRawUnsafe(`
        SELECT 
          f.id,
          f.name,
          f.mappingjson as "mappingJson",
          f.mappingjson as "mappingjson"
        FROM "Feed" f
        WHERE f.id = $1::text
      `, id);
    
      if (!feeds || feeds.length === 0) {
        return res.status(404).json({ message: 'Feed non trouvé' });
      }
      const feed = feeds[0];
    
      const mapping = feed.mappingJson || feed.mappingjson || {};
      if (Object.keys(mapping).length === 0) {
        return res.status(400).json({ message: 'Aucun mapping configuré pour ce feed' });
      }

      // Récupérer tous les produits du feed
      const items = await prisma.$queryRawUnsafe(`
        SELECT id, customfields
        FROM "FeedItem"
        WHERE "feedid" = $1::text
      `, id);

      console.log(`🔄 Mise à jour forcée des customFields pour ${items.length} produits du feed ${feed.name}`);

      let updated = 0;
      const now = new Date().toISOString();

      for (const item of items) {
        // Parser les customFields existants
        let existingCustomFields = {};
        if (item.customfields) {
          if (typeof item.customfields === 'string') {
            try {
              existingCustomFields = JSON.parse(item.customfields);
            } catch (e) {
              console.error(`❌ Erreur parsing customFields pour item ${item.id}:`, e.message);
            }
          } else if (typeof item.customfields === 'object') {
            existingCustomFields = item.customfields;
          }
        }

        // Créer les nouveaux customFields basés sur le mapping actuel
        // Pour chaque champ mappé, on va chercher sa valeur dans les colonnes standards de FeedItem
        // ou la laisser à null si elle n'existe pas
        const newCustomFields = {};
      
        // Récupérer toutes les données de l'item pour pouvoir mapper les valeurs
        const itemData = await prisma.$queryRawUnsafe(`
          SELECT * FROM "FeedItem" WHERE id = $1::text
        `, item.id);
      
        if (itemData && itemData.length > 0) {
          const itemRow = itemData[0];
        
          // Pour chaque champ du mapping, essayer de trouver sa valeur
          for (const [targetField, sourceColumn] of Object.entries(mapping)) {
            if (sourceColumn) {
              // Chercher la valeur dans les colonnes standards (peut être en minuscules)
              let value = null;
            
              // Essayer différentes variantes de noms
              const variants = [
                targetField,
                targetField.toLowerCase(),
                targetField.toUpperCase(),
                sourceColumn,
                sourceColumn.toLowerCase(),
                sourceColumn.toUpperCase()
              ];
            
              for (const variant of variants) {
                if (itemRow[variant] !== undefined && itemRow[variant] !== null && itemRow[variant] !== '') {
                  value = itemRow[variant];
                  break;
                }
              }
            
              // Toujours stocker le champ dans customFields, même si null
              newCustomFields[targetField] = value;
            }
          }
        } else {
          // Si on ne peut pas récupérer les données, au moins créer les clés avec null
          for (const [targetField] of Object.entries(mapping)) {
            newCustomFields[targetField] = null;
          }
        }

        // Comparer avec les customFields existants
        const newCustomFieldsStr = JSON.stringify(newCustomFields);
        const existingCustomFieldsStr = JSON.stringify(existingCustomFields);
      
        if (newCustomFieldsStr !== existingCustomFieldsStr) {
          await prisma.$executeRawUnsafe(`
            UPDATE "FeedItem" 
            SET customfields = $1::jsonb, updatedat = $2::timestamptz
            WHERE id = $3::text
          `, newCustomFieldsStr, now, item.id);
          updated++;
        }
      }

      console.log(`✅ ${updated} produits mis à jour sur ${items.length}`);

      res.json({
        message: 'Mise à jour des customFields effectuée',
        feedId: id,
        feedName: feed.name,
        totalItems: items.length,
        updatedItems: updated,
        mappingFields: Object.keys(mapping).length
      });
    } catch (e) {
      console.error('Force update customFields error:', e);
      res.status(500).json({ message: 'Erreur mise à jour customFields', error: e.message });
    }
  });

  app.get('/api/v1/ingestion/feeds/:id/enrichment-sources', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id: feedId } = req.params;
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      if (!await verifyFeedAccess(feedId, req.accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const list = await prisma.$queryRawUnsafe(`
        SELECT id, feedid as "feedId", name, configjson as "configJson", mappingjson as "mappingJson",
               status, lastsyncat as "lastSyncAt", createdat as "createdAt", updatedat as "updatedAt"
        FROM "EnrichmentSource"
        WHERE feedid = $1::text
        ORDER BY createdat ASC
      `, feedId);
      res.json(list);
    } catch (e) {
      console.error('List enrichment sources error:', e);
      res.status(500).json({ message: 'Erreur listage sources secondaires' });
    }
  });

  app.post('/api/v1/ingestion/feeds/:id/enrichment-sources', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id: feedId } = req.params;
      const { name, configJson, mappingJson } = req.body || {};
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      if (!await verifyFeedAccess(feedId, req.accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const acctId = req.accountId;
      const feature = await canUseFeature(prisma, acctId, 'aiEnrichment');
      if (!feature.allowed) {
        return res.status(403).json({ code: 'PLAN_FEATURE', message: feature.message });
      }
      if (!name || !configJson || !mappingJson) {
        return res.status(400).json({ message: 'name, configJson et mappingJson requis' });
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await prisma.$executeRawUnsafe(`
        INSERT INTO "EnrichmentSource" (id, feedid, name, configjson, mappingjson, status, accountid, createdat, updatedat)
        VALUES ($1::text, $2::text, $3::text, $4::jsonb, $5::jsonb, 'ACTIVE'::text, $6::text, $7::timestamptz, $7::timestamptz)
      `, id, feedId, name, JSON.stringify(configJson), JSON.stringify(mappingJson), acctId, now);
      const [created] = await prisma.$queryRawUnsafe(`
        SELECT id, feedid as "feedId", name, configjson as "configJson", mappingjson as "mappingJson",
               status, lastsyncat as "lastSyncAt", createdat as "createdAt", updatedat as "updatedAt"
        FROM "EnrichmentSource" WHERE id = $1::text
      `, id);
      res.status(201).json(created);
    } catch (e) {
      console.error('Create enrichment source error:', e);
      res.status(500).json({ message: 'Erreur création source secondaire' });
    }
  });

  app.post('/api/v1/ingestion/feeds/:id/apply-enrichment-sources', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id: feedId } = req.params;
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      if (!await verifyFeedAccess(feedId, req.accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const acctId = req.accountId;
      const feature = await canUseFeature(prisma, acctId, 'aiEnrichment');
      if (!feature.allowed) {
        return res.status(403).json({ code: 'PLAN_FEATURE', message: feature.message });
      }
      const result = await applyEnrichmentSources(prisma, feedId, req.accountId, storage);
      res.json({ message: 'Enrichissement appliqué', ...result });
    } catch (e) {
      console.error('Apply enrichment sources error:', e);
      res.status(500).json({ message: e.message || 'Erreur enrichissement' });
    }
  });

  app.put('/api/v1/ingestion/enrichment-sources/:id', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const { name, configJson, mappingJson, status } = req.body || {};
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      if (!await verifyEnrichmentSourceAccess(id, req.accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const updates = [];
      const values = [];
      let i = 1;
      if (name !== undefined) { updates.push(`name = $${i++}::text`); values.push(name); }
      if (configJson !== undefined) { updates.push(`configjson = $${i++}::jsonb`); values.push(JSON.stringify(configJson)); }
      if (mappingJson !== undefined) { updates.push(`mappingjson = $${i++}::jsonb`); values.push(JSON.stringify(mappingJson)); }
      if (status !== undefined) { updates.push(`status = $${i++}::text`); values.push(status); }
      if (updates.length === 0) return res.status(400).json({ message: 'Aucune modification' });
      updates.push(`updatedat = $${i++}::timestamptz`);
      values.push(new Date().toISOString());
      values.push(id);
      await prisma.$executeRawUnsafe(`
        UPDATE "EnrichmentSource" SET ${updates.join(', ')} WHERE id = $${i}::text
      `, ...values);
      const [updated] = await prisma.$queryRawUnsafe(`
        SELECT id, feedid as "feedId", name, configjson as "configJson", mappingjson as "mappingJson",
               status, lastsyncat as "lastSyncAt", createdat as "createdAt", updatedat as "updatedAt"
        FROM "EnrichmentSource" WHERE id = $1::text
      `, id);
      res.json(updated);
    } catch (e) {
      console.error('Update enrichment source error:', e);
      res.status(500).json({ message: 'Erreur mise à jour source secondaire' });
    }
  });

  app.delete('/api/v1/ingestion/enrichment-sources/:id', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      if (!await verifyEnrichmentSourceAccess(id, req.accountId)) return res.status(403).json({ message: 'Accès refusé' });
      await prisma.$executeRawUnsafe(`DELETE FROM "EnrichmentSource" WHERE id = $1::text`, id);
      res.status(204).send();
    } catch (e) {
      console.error('Delete enrichment source error:', e);
      res.status(500).json({ message: 'Erreur suppression source secondaire' });
    }
  });

  app.post('/api/v1/ingestion/scheduled-runs', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const schedulerSecret = typeof process.env.SCHEDULER_SECRET === 'string'
        ? process.env.SCHEDULER_SECRET.trim()
        : '';
      if (!schedulerSecret) {
        return res.status(503).json({ message: 'Scheduler non configuré' });
      }
      const authHeader = req.headers['x-scheduler-secret'] || req.headers['authorization'];
      const rawProvidedSecret = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      const providedSecret = typeof rawProvidedSecret === 'string'
        ? rawProvidedSecret.replace('Bearer ', '').trim()
        : '';
      if (providedSecret !== schedulerSecret) {
        return res.status(401).json({ message: 'Non autorisé' });
      }

      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
    
      // Récupérer tous les feeds actifs avec leur source (credentialid pour Shopify)
      let feeds;
      try {
        feeds = await prisma.$queryRawUnsafe(`
          SELECT 
            f.id as feed_id,
            f.name as feed_name,
            f.sourceid,
            f.accountid,
            f.frequency,
            f.mappingjson,
            s.id as source_id,
            s.name as source_name,
            s.connector,
            s.configjson,
            s.credentialid,
            s.defaultfreq,
            s.lastrunat,
            s.scheduletime
          FROM "Feed" f
          JOIN "FeedSource" s ON f.sourceid = s.id
          WHERE f.status = 'ACTIVE' AND s.status = 'ACTIVE'
        `);
      } catch (scheduleTimeError) {
        if (scheduleTimeError?.code === 'P2010' || scheduleTimeError?.message?.includes('scheduletime')) {
          feeds = await prisma.$queryRawUnsafe(`
            SELECT 
              f.id as feed_id,
              f.name as feed_name,
              f.sourceid,
              f.accountid,
              f.frequency,
              f.mappingjson,
              s.id as source_id,
              s.name as source_name,
              s.connector,
              s.configjson,
              s.credentialid,
              s.defaultfreq,
              s.lastrunat,
              NULL::TEXT as scheduletime
            FROM "Feed" f
            JOIN "FeedSource" s ON f.sourceid = s.id
            WHERE f.status = 'ACTIVE' AND s.status = 'ACTIVE'
          `);
        } else {
          throw scheduleTimeError;
        }
      }

      const results = {
        checked: feeds.length,
        executed: 0,
        skipped: 0,
        errors: []
      };

      for (const feed of feeds) {
        try {
          // Vérifier si le feed doit être exécuté
          const scheduleTime = feed.scheduletime; // Format "HH:MM" (ex: "02:00")
        
          if (!scheduleTime) {
            // Pas d'horaire configuré, on skip
            results.skipped++;
            continue;
          }

          // Parser l'heure programmée
          const [scheduledHour, scheduledMinute] = scheduleTime.split(':').map(Number);
        
          // Vérifier si on est dans la fenêtre d'exécution (heure exacte ou heure suivante pour permettre un délai)
          const shouldRun = 
            (currentHour === scheduledHour && currentMinute >= scheduledMinute) ||
            (currentHour === scheduledHour + 1 && currentMinute < scheduledMinute);

          if (!shouldRun) {
            results.skipped++;
            continue;
          }

          // Vérifier si la dernière exécution est > 24h (pour éviter les exécutions multiples)
          const lastRunAt = feed.lastrunat ? new Date(feed.lastrunat) : null;
          if (lastRunAt) {
            const hoursSinceLastRun = (now - lastRunAt) / (1000 * 60 * 60);
            if (hoursSinceLastRun < 23) {
              // Déjà exécuté dans les dernières 23h, on skip
              results.skipped++;
              continue;
            }
          }

          // Exécuter l'ingestion
          console.log(`🔄 Exécution automatique du feed ${feed.feed_name} (${feed.feed_id}) à ${scheduleTime}`);
        
          const sourceConfig = feed.configjson || {};
          const connector = feed.connector;

          // Ingestion Shopify (scheduled)
          if (connector === 'SHOPIFY') {
            const shop = sourceConfig.shop || sourceConfig.Shop;
            const credentialId = feed.credentialid;
            if (!credentialId || !shop) {
              results.errors.push({
                feedId: feed.feed_id,
                feedName: feed.feed_name,
                error: 'Source Shopify mal configurée (credential ou shop manquant)'
              });
              continue;
            }
            const creds = await prisma.$queryRawUnsafe(`SELECT secretjson FROM "Credential" WHERE id = $1::text`, credentialId);
            if (!creds || creds.length === 0) {
              results.errors.push({
                feedId: feed.feed_id,
                feedName: feed.feed_name,
                error: 'Credential Shopify introuvable'
              });
              continue;
            }
            const secret = creds[0].secretjson;
            const secretData = decryptObjectSecrets(typeof secret === 'string' ? JSON.parse(secret) : secret);
            const accessToken = secretData.accessToken || secretData.access_token;
            if (!accessToken) {
              results.errors.push({
                feedId: feed.feed_id,
                feedName: feed.feed_name,
                error: 'Token d\'accès Shopify manquant'
              });
              continue;
            }
            const normalizedShop = normalizeShopifyShop(shop);
            if (!normalizedShop) {
              results.errors.push({
                feedId: feed.feed_id,
                feedName: feed.feed_name,
                error: 'Nom de boutique Shopify invalide'
              });
              continue;
            }
            const feedObj = {
              id: feed.feed_id,
              name: feed.feed_name,
              sourceId: feed.sourceid,
              mappingJson: feed.mappingjson || {},
              mappingjson: feed.mappingjson || {}
            };
            const result = await ingestShopifyFromApi({ prisma, feed: feedObj, shop: normalizedShop, accessToken });
            await prisma.$executeRawUnsafe(`
              UPDATE "FeedSource" SET lastrunat = $1::timestamptz, updatedat = $1::timestamptz WHERE id = $2::text
            `, now.toISOString(), feed.source_id);
            const accountEmails = await getAccountEmails(feed.accountid);
            const stats = { totalFetched: result?.totalFetched ?? 0, totalInserted: result?.totalInserted ?? 0, totalUpdated: result?.totalUpdated ?? 0 };
            for (const email of accountEmails.slice(0, 3)) {
              sendSyncCompleteEmail(email, feed.feed_name || feedObj.name, stats).catch(err => console.warn('Email sync terminée (scheduler) non envoyé:', err.message));
            }
            results.executed++;
            scheduleAutoGmcPush(feed.accountid, feed.feed_id, 'run planifié Shopify');
            scheduleAutoLiaSync(feed.accountid, 'run planifié Shopify');
            console.log(`✅ Feed Shopify ${feed.feed_name} exécuté avec succès`);
            continue;
          }

          if (connector === 'PRESTASHOP') {
            const shopUrl = sourceConfig.shopUrl || sourceConfig.shopurl || sourceConfig.baseUrl || sourceConfig.baseurl;
            const apiKey = sourceConfig.apiKey || sourceConfig.apikey;
            if (!shopUrl || !apiKey) {
              results.errors.push({
                feedId: feed.feed_id,
                feedName: feed.feed_name,
                error: 'Source PrestaShop mal configurée (URL boutique ou clé API manquante)'
              });
              continue;
            }
            const feedObj = {
              id: feed.feed_id,
              name: feed.feed_name,
              sourceId: feed.sourceid,
              mappingJson: feed.mappingjson || {},
              mappingjson: feed.mappingjson || {}
            };
            const result = await ingestPrestashopFromApi({
              prisma,
              feed: feedObj,
              shopUrl: String(shopUrl).trim().replace(/\/+$/, ''),
              apiKey: String(apiKey).trim(),
            });
            await prisma.$executeRawUnsafe(`
              UPDATE "FeedSource" SET lastrunat = $1::timestamptz, updatedat = $1::timestamptz WHERE id = $2::text
            `, now.toISOString(), feed.source_id);
            const accountEmails = await getAccountEmails(feed.accountid);
            const stats = { totalFetched: result?.totalFetched ?? 0, totalInserted: result?.totalInserted ?? 0, totalUpdated: result?.totalUpdated ?? 0 };
            for (const email of accountEmails.slice(0, 3)) {
              sendSyncCompleteEmail(email, feed.feed_name || feedObj.name, stats).catch(err => console.warn('Email sync terminée (scheduler) non envoyé:', err.message));
            }
            results.executed++;
            scheduleAutoGmcPush(feed.accountid, feed.feed_id, 'run planifié PrestaShop');
            console.log(`✅ Feed Prestashop ${feed.feed_name} exécuté avec succès`);
            continue;
          }

          // Ingestion CSV
          let csvUrl = sourceConfig.csvUrl || sourceConfig.csvurl;
          const gcsPath = sourceConfig.gcsPath || sourceConfig.gcspath;
          let csvText = null;
        
          // Lire directement depuis GCS si disponible (plus fiable que les URLs signées)
          if (gcsPath && gcsPath.startsWith('gs://')) {
            try {
              const gcsMatch = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
              if (gcsMatch) {
                const [, gcsBucket, gcsFileName] = gcsMatch;
                const bucket = storage.bucket(gcsBucket);
                const file = bucket.file(gcsFileName);
                const [content] = await file.download();
                csvText = content.toString('utf-8');
              }
            } catch (gcsErr) {
              console.warn(`⚠️ Lecture GCS échouée pour feed ${feed.feed_id}:`, gcsErr.message);
            }
          }
        
          if (!csvUrl && !csvText) {
            results.errors.push({
              feedId: feed.feed_id,
              feedName: feed.feed_name,
              error: 'csvUrl/gcsPath manquant. Veuillez re-uploader le fichier.'
            });
            continue;
          }

          // Construire l'objet feed pour ingestCsvFromUrl
          const feedObj = {
            id: feed.feed_id,
            name: feed.feed_name,
            sourceId: feed.sourceid,
            mappingJson: {}, // Sera récupéré dans l'endpoint
            mappingjson: {},
            source: {
              id: feed.source_id,
              name: feed.source_name,
              connector: feed.connector,
              configJson: sourceConfig,
              configjson: sourceConfig
            }
          };

          // Récupérer le mapping du feed
          const feedMapping = await prisma.$queryRawUnsafe(`
            SELECT mappingjson FROM "Feed" WHERE id = $1::text
          `, feed.feed_id);
        
          if (feedMapping && feedMapping.length > 0) {
            const mapping = feedMapping[0].mappingjson;
            feedObj.mappingJson = mapping || {};
            feedObj.mappingjson = mapping || {};
          }

          // Exécuter l'ingestion
          const result = await ingestCsvFromUrl({ prisma, feed: feedObj, csvUrl: csvText ? undefined : csvUrl, csvText });

          // Mettre à jour lastRunAt de la source
          await prisma.$executeRawUnsafe(`
            UPDATE "FeedSource" 
            SET lastrunat = $1::timestamptz, updatedat = $1::timestamptz
            WHERE id = $2::text
          `, now.toISOString(), feed.source_id);

          // Email "Synchronisation terminée" (run planifié)
          const accountEmails = await getAccountEmails(feed.accountid);
          const feedName = feed.feed_name || feedObj.name;
          const stats = {
            totalFetched: result?.totalFetched ?? 0,
            totalInserted: result?.totalInserted ?? 0,
            totalUpdated: result?.totalUpdated ?? 0
          };
          for (const email of accountEmails.slice(0, 3)) {
            sendSyncCompleteEmail(email, feedName, stats).catch(err => console.warn('Email sync terminée (scheduler) non envoyé:', err.message));
          }
        
          results.executed++;
          scheduleAutoGmcPush(feed.accountid, feed.feed_id, 'run planifié CSV');
          console.log(`✅ Feed ${feed.feed_name} exécuté avec succès`);
        } catch (error) {
          console.error(`❌ Erreur lors de l'exécution du feed ${feed.feed_name}:`, error.message);
          results.errors.push({
            feedId: feed.feed_id,
            feedName: feed.feed_name,
            error: error.message
          });
          // Notification in-app "Échec d'import planifié"
          createNotification(prisma, feed.accountid, {
            type: 'error',
            priority: 'high',
            title: `Échec de la synchronisation — ${feed.feed_name || 'flux'}`,
            message: `L'import automatique du flux a échoué : ${error?.message || 'erreur inconnue'}.`,
            actionUrl: '/sources',
          }).catch(() => {});
          // Email "Erreur de sync" pour le run planifié
          const accountEmails = await getAccountEmails(feed.accountid);
          const context = `Synchronisation planifiée — ${feed.feed_name || feed.feed_id}`;
          for (const email of accountEmails.slice(0, 3)) {
            sendErrorEmail(email, context, error?.message || String(error)).catch(err => console.warn('Email erreur sync (scheduler) non envoyé:', err.message));
          }
        }
      }

      res.json({
        message: 'Exécution programmée terminée',
        timestamp: now.toISOString(),
        ...results
      });
    } catch (e) {
      console.error('Scheduled runs error:', e);
      res.status(500).json({ message: 'Erreur exécution programmée', error: e.message });
    }
  });

  app.get('/api/v1/ingestion/feeds/:id/items', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const limit = Math.min(parseInt(req.query.limit) || 2000, 10000);
      const offset = parseInt(req.query.offset) || 0;
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const smartView = typeof req.query.smartView === 'string' ? req.query.smartView : 'all';
      const imageFilter = typeof req.query.imageFilter === 'string' ? req.query.imageFilter : 'all';
      const optimizedFilter = typeof req.query.optimizedFilter === 'string' ? req.query.optimizedFilter : 'all';
      const channelFilter = typeof req.query.channelFilter === 'string' ? req.query.channelFilter : 'all';
      const stockFilter = typeof req.query.stockFilter === 'string' ? req.query.stockFilter : 'all';
      const brandFilter = typeof req.query.brandFilter === 'string' ? req.query.brandFilter.trim() : 'all';
      const categoryFilter = typeof req.query.categoryFilter === 'string' ? req.query.categoryFilter.trim() : 'all';
      const updatedRecent = req.query.updatedRecent === 'true';
      const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'date_desc';
      const requestedDestinationId = typeof req.query.destinationId === 'string' ? req.query.destinationId.trim() : '';

      if (!(await ensurePrismaReady()) || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
      if (!(await verifyFeedAccess(id, req.accountId))) {
        return res.status(403).json({ message: 'Accès refusé à ce flux' });
      }
      const destinationContext = requestedDestinationId
        ? await getDestinationPushContext(req.accountId, requestedDestinationId)
        : null;

      const hasSearch = q.length > 0;
      const searchPattern = hasSearch ? `%${q.replace(/%/g, '\\%')}%` : null;
      const updatedRecentCutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();
      const categoryExpr = `COALESCE(
        NULLIF(BTRIM(customfields->>'product_type'), ''),
        NULLIF(BTRIM(customfields->>'google_product_category'), ''),
        NULLIF(BTRIM(customfields->>'category'), '')
      )`;
      const googleEnabledExpr = `(customfields->'_channelOverrides'->>'google' IS NULL OR customfields->'_channelOverrides'->>'google' != 'false')`;
      const optimizedExpr = `(
        (customfields->>'optimized_title' IS NOT NULL AND BTRIM(customfields->>'optimized_title') <> '')
        OR (customfields->>'optimized_description' IS NOT NULL AND BTRIM(customfields->>'optimized_description') <> '')
        OR (customfields->'optimized'->'gmc'->>'title' IS NOT NULL AND BTRIM(customfields->'optimized'->'gmc'->>'title') <> '')
        OR (customfields->'optimized'->'gmc'->>'description' IS NOT NULL AND BTRIM(customfields->'optimized'->'gmc'->>'description') <> '')
        OR (jsonb_typeof(customfields->'optimized'->'gmc'->'highlights') = 'array' AND jsonb_array_length(customfields->'optimized'->'gmc'->'highlights') > 0)
        OR (customfields->'optimized'->'meta'->>'title' IS NOT NULL AND BTRIM(customfields->'optimized'->'meta'->>'title') <> '')
        OR (customfields->'optimized'->'meta'->>'description' IS NOT NULL AND BTRIM(customfields->'optimized'->'meta'->>'description') <> '')
        OR (jsonb_typeof(customfields->'optimized'->'meta'->'highlights') = 'array' AND jsonb_array_length(customfields->'optimized'->'meta'->'highlights') > 0)
        OR (customfields->'optimized'->'amazon'->>'title' IS NOT NULL AND BTRIM(customfields->'optimized'->'amazon'->>'title') <> '')
        OR (customfields->'optimized'->'amazon'->>'description' IS NOT NULL AND BTRIM(customfields->'optimized'->'amazon'->>'description') <> '')
        OR (jsonb_typeof(customfields->'optimized'->'amazon'->'highlights') = 'array' AND jsonb_array_length(customfields->'optimized'->'amazon'->'highlights') > 0)
        OR (customfields->'optimized'->'chatgpt'->>'title' IS NOT NULL AND BTRIM(customfields->'optimized'->'chatgpt'->>'title') <> '')
        OR (customfields->'optimized'->'chatgpt'->>'description' IS NOT NULL AND BTRIM(customfields->'optimized'->'chatgpt'->>'description') <> '')
        OR (jsonb_typeof(customfields->'optimized'->'chatgpt'->'highlights') = 'array' AND jsonb_array_length(customfields->'optimized'->'chatgpt'->'highlights') > 0)
      )`;
      const missingCoreExpr = `(
        (title IS NULL OR BTRIM(title) = '')
        OR imageurl IS NULL
        OR brand IS NULL OR BTRIM(brand) = ''
        OR ${categoryExpr} IS NULL
      )`;

      if (destinationContext) {
        const allRows = await prisma.$queryRawUnsafe(`
          SELECT *
          FROM "FeedItem"
          WHERE feedid = $1::text
        `, id);
        const itemIds = (allRows || []).map((row) => row.id).filter(Boolean);
        const activationRows = itemIds.length > 0
          ? await prisma.$queryRawUnsafe(
              `
                SELECT *
                FROM "ProductActivation"
                WHERE destinationid = $1::text
                  AND productid = ANY($2::text[])
              `,
              destinationContext.id,
              itemIds
            )
          : [];
        const activationByItemId = new Map((activationRows || []).map((row) => [row.productid, row]));
        const destinationLabel = [destinationContext.marketName || destinationContext.marketCode, destinationContext.localeCode || null]
          .filter(Boolean)
          .join(' · ');
        const destinationPlatformKey = normalizePlatformKey(destinationContext.platformKey);
        const updatedRecentCutoffTs = new Date(updatedRecentCutoff).getTime();

        const getCategoryValue = (customFields) => {
          const productType = typeof customFields.product_type === 'string' ? customFields.product_type.trim() : '';
          if (productType) return productType;
          const googleCategory = typeof customFields.google_product_category === 'string' ? customFields.google_product_category.trim() : '';
          if (googleCategory) return googleCategory;
          const fallbackCategory = typeof customFields.category === 'string' ? customFields.category.trim() : '';
          return fallbackCategory;
        };

        const normalizedItems = (allRows || []).map((row) => {
          const customFields = parseJsonObject(row.customfields);
          const activationRow = activationByItemId.get(row.id);
          const isEnabled = isDestinationEffectivelyEnabled(destinationContext, activationRow, customFields);
          return {
            ...row,
            customfields: customFields,
            _selectedDestinationId: destinationContext.id,
            _selectedDestinationLabel: destinationLabel,
            _selectedDestinationPlatformKey: destinationPlatformKey,
            _selectedDestinationPlatformLabel: getPlatformLabel(destinationPlatformKey),
            _selectedDestinationMarketCode: destinationContext.marketCode,
            _selectedDestinationLocaleCode: destinationContext.localeCode || null,
            _selectedDestinationIsEnabled: isEnabled,
            _selectedDestinationActivationSource: activationRow ? 'destination' : 'legacy',
            _selectedDestinationActivationStatus: activationRow?.activationstatus || (isEnabled ? 'active' : 'excluded'),
            _selectedDestinationHasOptimizedContent: hasStoredOptimizedContent(customFields, destinationPlatformKey, { destinationId: destinationContext.id }),
            _selectedDestinationCategory: getCategoryValue(customFields),
          };
        });

        const hasMissingCoreFields = (item) => (
          !String(item.title || '').trim()
          || !(item.imageurl || item.imageUrl)
          || !String(item.brand || '').trim()
          || !String(item._selectedDestinationCategory || '').trim()
        );

        const summary = {
          total: normalizedItems.length,
          toFix: normalizedItems.filter((item) => hasMissingCoreFields(item)).length,
          toOptimize: normalizedItems.filter((item) => !item._selectedDestinationHasOptimizedContent).length,
          readyToPublish: normalizedItems.filter((item) => item._selectedDestinationIsEnabled && !hasMissingCoreFields(item)).length,
          notPublished: normalizedItems.filter((item) => !item._selectedDestinationIsEnabled).length,
          missingCategory: normalizedItems.filter((item) => !String(item._selectedDestinationCategory || '').trim()).length,
          missingBrand: normalizedItems.filter((item) => !String(item.brand || '').trim()).length,
          missingImage: normalizedItems.filter((item) => !(item.imageurl || item.imageUrl)).length,
          withImage: normalizedItems.filter((item) => Boolean(item.imageurl || item.imageUrl)).length,
          published: normalizedItems.filter((item) => item._selectedDestinationIsEnabled).length,
        };

        const filterOptions = {
          brands: Array.from(new Set(
            normalizedItems
              .map((item) => String(item.brand || '').trim())
              .filter(Boolean)
          )).sort((left, right) => left.localeCompare(right, 'fr')),
          categories: Array.from(new Set(
            normalizedItems
              .map((item) => String(item._selectedDestinationCategory || '').trim())
              .filter(Boolean)
          )).sort((left, right) => left.localeCompare(right, 'fr')),
        };

        let filteredItems = normalizedItems.filter((item) => {
          if (hasSearch) {
            const haystack = [item.title, item.sku, item.brand]
              .map((value) => String(value || '').toLowerCase())
              .join(' ');
            if (!haystack.includes(q.toLowerCase())) return false;
          }

          switch (smartView) {
            case 'to_fix':
              if (!hasMissingCoreFields(item)) return false;
              break;
            case 'to_optimize':
              if (item._selectedDestinationHasOptimizedContent) return false;
              break;
            case 'ready_google':
              if (!item._selectedDestinationIsEnabled || hasMissingCoreFields(item)) return false;
              break;
            case 'google_off':
              if (item._selectedDestinationIsEnabled) return false;
              break;
            case 'missing_category':
              if (String(item._selectedDestinationCategory || '').trim()) return false;
              break;
            case 'missing_brand':
              if (String(item.brand || '').trim()) return false;
              break;
            case 'missing_image':
              if (item.imageurl || item.imageUrl) return false;
              break;
            default:
              break;
          }

          if (imageFilter === 'with' && !(item.imageurl || item.imageUrl)) return false;
          if (imageFilter === 'without' && (item.imageurl || item.imageUrl)) return false;
          if (optimizedFilter === 'optimized' && !item._selectedDestinationHasOptimizedContent) return false;
          if (optimizedFilter === 'not_optimized' && item._selectedDestinationHasOptimizedContent) return false;
          if (channelFilter === 'google_on' && !item._selectedDestinationIsEnabled) return false;
          if (channelFilter === 'google_off' && item._selectedDestinationIsEnabled) return false;
          if (stockFilter === 'in_stock' && !(Number(item.inventory || 0) > 0)) return false;
          if (stockFilter === 'out_of_stock' && Number(item.inventory || 0) > 0) return false;
          if (brandFilter === '__missing__' && String(item.brand || '').trim()) return false;
          if (brandFilter !== 'all' && brandFilter !== '__missing__' && String(item.brand || '').trim() !== brandFilter.trim()) return false;
          if (categoryFilter === '__missing__' && String(item._selectedDestinationCategory || '').trim()) return false;
          if (categoryFilter !== 'all' && categoryFilter !== '__missing__' && String(item._selectedDestinationCategory || '').trim() !== categoryFilter.trim()) return false;
          if (updatedRecent) {
            const updatedTs = new Date(item.updatedat || item.updatedAt || 0).getTime();
            if (!Number.isFinite(updatedTs) || updatedTs < updatedRecentCutoffTs) return false;
          }

          return true;
        });

        filteredItems = filteredItems.sort((left, right) => {
          if (sortBy === 'title_asc') return String(left.title || '').localeCompare(String(right.title || ''), 'fr');
          if (sortBy === 'title_desc') return String(right.title || '').localeCompare(String(left.title || ''), 'fr');
          if (sortBy === 'price_asc') return Number(left.price ?? Number.POSITIVE_INFINITY) - Number(right.price ?? Number.POSITIVE_INFINITY);
          if (sortBy === 'price_desc') return Number(right.price ?? Number.NEGATIVE_INFINITY) - Number(left.price ?? Number.NEGATIVE_INFINITY);
          if (sortBy === 'date_asc') return new Date(left.updatedat || left.createdat || 0).getTime() - new Date(right.updatedat || right.createdat || 0).getTime();
          return new Date(right.updatedat || right.createdat || 0).getTime() - new Date(left.updatedat || left.createdat || 0).getTime();
        });

        const paginatedItems = filteredItems.slice(offset, offset + limit);

        return res.json({
          items: paginatedItems,
          total: filteredItems.length,
          limit,
          offset,
          hasMore: offset + paginatedItems.length < filteredItems.length,
          summary,
          filterOptions,
          destination: {
            id: destinationContext.id,
            label: destinationLabel,
            platformKey: destinationPlatformKey,
            platformLabel: getPlatformLabel(destinationPlatformKey),
            marketCode: destinationContext.marketCode,
            localeCode: destinationContext.localeCode || null,
          },
        });
      }
      const summaryRows = await prisma.$queryRawUnsafe(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE ${missingCoreExpr}
          )::int AS to_fix,
          COUNT(*) FILTER (
            WHERE NOT ${optimizedExpr}
          )::int AS to_optimize,
          COUNT(*) FILTER (
            WHERE ${googleEnabledExpr}
              AND NOT ${missingCoreExpr}
          )::int AS ready_to_publish,
          COUNT(*) FILTER (
            WHERE NOT ${googleEnabledExpr}
          )::int AS not_published,
          COUNT(*) FILTER (
            WHERE ${categoryExpr} IS NULL
          )::int AS missing_category,
          COUNT(*) FILTER (WHERE brand IS NULL OR BTRIM(brand) = '')::int AS missing_brand,
          COUNT(*) FILTER (WHERE imageurl IS NULL)::int AS missing_image,
          COUNT(*) FILTER (WHERE imageurl IS NOT NULL)::int AS with_image,
          COUNT(*) FILTER (
            WHERE ${googleEnabledExpr}
          )::int AS published
        FROM "FeedItem"
        WHERE feedid = $1::text
      `, id);
      const summary = summaryRows?.[0] || {};
      const catalogueSummary = {
        total: Number(summary.total || 0),
        toFix: Number(summary.to_fix || 0),
        toOptimize: Number(summary.to_optimize || 0),
        readyToPublish: Number(summary.ready_to_publish || 0),
        notPublished: Number(summary.not_published || 0),
        missingCategory: Number(summary.missing_category || 0),
        missingBrand: Number(summary.missing_brand || 0),
        missingImage: Number(summary.missing_image || 0),
        withImage: Number(summary.with_image || 0),
        published: Number(summary.published || 0),
      };
      const [brandOptionRows, categoryOptionRows] = await Promise.all([
        prisma.$queryRawUnsafe(`
          SELECT DISTINCT BTRIM(brand) AS value
          FROM "FeedItem"
          WHERE feedid = $1::text
            AND brand IS NOT NULL
            AND BTRIM(brand) <> ''
          ORDER BY value ASC
        `, id),
        prisma.$queryRawUnsafe(`
          SELECT DISTINCT ${categoryExpr} AS value
          FROM "FeedItem"
          WHERE feedid = $1::text
            AND ${categoryExpr} IS NOT NULL
          ORDER BY value ASC
        `, id),
      ]);
      const filterOptions = {
        brands: (brandOptionRows || []).map((row) => row.value).filter(Boolean),
        categories: (categoryOptionRows || []).map((row) => row.value).filter(Boolean),
      };

      const whereClauses = [`"feedid" = $1::text`];
      const whereParams = [id];
      let paramIndex = 2;

      if (hasSearch && searchPattern) {
        whereClauses.push(`(title ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR brand ILIKE $${paramIndex})`);
        whereParams.push(searchPattern);
        paramIndex += 1;
      }

      switch (smartView) {
        case 'to_fix':
          whereClauses.push(missingCoreExpr);
          break;
        case 'to_optimize':
          whereClauses.push(`NOT ${optimizedExpr}`);
          break;
        case 'ready_google':
          whereClauses.push(`${googleEnabledExpr} AND NOT ${missingCoreExpr}`);
          break;
        case 'google_off':
          whereClauses.push(`NOT ${googleEnabledExpr}`);
          break;
        case 'missing_category':
          whereClauses.push(`${categoryExpr} IS NULL`);
          break;
        case 'missing_brand':
          whereClauses.push(`(brand IS NULL OR BTRIM(brand) = '')`);
          break;
        case 'missing_image':
          whereClauses.push(`imageurl IS NULL`);
          break;
        default:
          break;
      }

      if (imageFilter === 'with') whereClauses.push('imageurl IS NOT NULL');
      if (imageFilter === 'without') whereClauses.push('imageurl IS NULL');

      if (optimizedFilter === 'optimized') whereClauses.push(optimizedExpr);
      if (optimizedFilter === 'not_optimized') whereClauses.push(`NOT ${optimizedExpr}`);

      if (channelFilter === 'google_on') whereClauses.push(googleEnabledExpr);
      if (channelFilter === 'google_off') whereClauses.push(`NOT ${googleEnabledExpr}`);

      if (stockFilter === 'in_stock') whereClauses.push('COALESCE(inventory, 0) > 0');
      if (stockFilter === 'out_of_stock') whereClauses.push('COALESCE(inventory, 0) <= 0');

      if (brandFilter === '__missing__') {
        whereClauses.push('(brand IS NULL OR BTRIM(brand) = \'\')');
      } else if (brandFilter && brandFilter !== 'all') {
        whereClauses.push(`BTRIM(COALESCE(brand, '')) = BTRIM($${paramIndex}::text)`);
        whereParams.push(brandFilter);
        paramIndex += 1;
      }

      if (categoryFilter === '__missing__') {
        whereClauses.push(`${categoryExpr} IS NULL`);
      } else if (categoryFilter && categoryFilter !== 'all') {
        whereClauses.push(`${categoryExpr} = BTRIM($${paramIndex}::text)`);
        whereParams.push(categoryFilter);
        paramIndex += 1;
      }

      if (updatedRecent) {
        whereClauses.push(`updatedat >= $${paramIndex}::timestamptz`);
        whereParams.push(updatedRecentCutoff);
        paramIndex += 1;
      }

      const whereSql = whereClauses.join('\n        AND ');
      const orderBySql = (() => {
        switch (sortBy) {
          case 'title_asc':
            return 'ORDER BY title ASC NULLS LAST, updatedat DESC NULLS LAST';
          case 'title_desc':
            return 'ORDER BY title DESC NULLS LAST, updatedat DESC NULLS LAST';
          case 'price_asc':
            return 'ORDER BY price ASC NULLS LAST, updatedat DESC NULLS LAST';
          case 'price_desc':
            return 'ORDER BY price DESC NULLS LAST, updatedat DESC NULLS LAST';
          case 'date_asc':
            return 'ORDER BY updatedat ASC NULLS LAST, createdat ASC NULLS LAST';
          case 'date_desc':
          default:
            return 'ORDER BY updatedat DESC NULLS LAST, createdat DESC NULLS LAST';
        }
      })();

      const totalResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count
        FROM "FeedItem"
        WHERE ${whereSql}
      `, ...whereParams);
      const total = parseInt(totalResult[0].count);

      const items = await prisma.$queryRawUnsafe(`
        SELECT *
        FROM "FeedItem"
        WHERE ${whereSql}
        ${orderBySql}
        LIMIT $${paramIndex}::int OFFSET $${paramIndex + 1}::int
      `, ...whereParams, limit, offset);

      res.json({
        items: items,
        total: total,
        limit: limit,
        offset: offset,
        hasMore: offset + items.length < total,
        summary: catalogueSummary,
        filterOptions,
      });
    } catch (e) {
      console.error('List FeedItems error:', e);
      res.status(500).json({ message: 'Erreur listing items' });
    }
  });

  app.get('/api/v1/ingestion/feeds/:id/export', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const requestedPlatform = String(req.query.platform || '').toLowerCase();
      const requestedDestinationId = String(req.query.destinationId || '').trim();
      const destinationContext = requestedDestinationId
        ? await getDestinationPushContext(req.accountId, requestedDestinationId, requestedPlatform || null)
        : null;
      const platform = destinationContext?.platformKey || requestedPlatform || 'gmc';
      const format = (req.query.format || (platform === 'chatgpt' ? 'json' : 'csv')).toLowerCase();
      const channel = String(
        req.query.channel
        || destinationContext?.settings?.legacyChannelKey
        || (platform === 'amazon' ? inferAmazonChannelKeyForMarket(destinationContext?.marketCode || '') : '')
        || ''
      ).toLowerCase();

      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      const limit = Math.min(parseInt(req.query.limit) || 10000, 50000);

      const SUPPORTED_PLATFORMS = ['gmc', 'lia', 'meta', 'amazon', 'cdiscount', 'rakuten', 'chatgpt', 'bing', 'pinterest', 'tiktok', 'snapchat', 'yandex', 'baidu', 'perplexity', 'gemini'];
      if (!SUPPORTED_PLATFORMS.includes(platform)) {
        return res.status(400).json({ message: 'Plateforme non supportée. Utilisez platform=gmc|lia|meta|amazon|cdiscount|rakuten|chatgpt|bing|pinterest|tiktok|snapchat|yandex|baidu|perplexity|gemini.' });
      }
      const jsonPlatforms = ['chatgpt'];
      if (!jsonPlatforms.includes(platform) && format !== 'csv') {
        return res.status(400).json({ message: 'Format non supporté pour cette plateforme. Utilisez format=csv.' });
      }
      if (jsonPlatforms.includes(platform) && format !== 'csv' && format !== 'json') {
        return res.status(400).json({ message: 'Format non supporté. Utilisez format=json ou format=csv pour ChatGPT.' });
      }
      if (platform === 'amazon' && !AMAZON_CHANNEL_CONFIG[channel]) {
        return res.status(400).json({
          message: 'Canal Amazon requis. Utilisez channel=amazon_fr|amazon_uk|amazon_de|amazon_it|amazon_es'
        });
      }

      // Exclure les produits dont le canal est désactivé (_channelOverrides)
      const overrideKeyMap = { gmc: 'google', lia: 'google', meta: 'meta', amazon: 'amazon', chatgpt: 'chatgpt', bing: 'bing', pinterest: 'pinterest', tiktok: 'tiktok', snapchat: 'snapchat', yandex: 'yandex', baidu: 'baidu', perplexity: 'perplexity', gemini: 'gemini' };
      const overrideKey = overrideKeyMap[platform] || null;
      const excludeOverrides = overrideKey && !destinationContext
        ? `AND (customfields->'_channelOverrides'->>'${overrideKey}' IS NULL OR customfields->'_channelOverrides'->>'${overrideKey}' != 'false')`
        : '';
      let items = await prisma.$queryRawUnsafe(`
        SELECT id, feedid AS "feedId", originid AS "originId", url, title,
               descriptionhtml AS "descriptionHtml", descriptiontext AS "descriptionText", imageurl AS "imageUrl",
               brand, sku, price, currency, inventory, publishedat AS "publishedAt", updatedat AS "updatedAt",
               contenthash AS "contentHash", createdat AS "createdAt",
               gtin, mpn, condition, customfields
        FROM "FeedItem"
        WHERE feedid = $1::text ${excludeOverrides}
        ORDER BY createdat DESC
        LIMIT $2::int
      `, id, limit);
      items = await filterItemsForDestinationActivation(items, destinationContext);

      // Appliquer les règles Optimiser à la volée (sans modifier la DB) pour cet export
      const channelKey = platform === 'gmc' ? 'gmc' : (platform === 'amazon' ? (channel || 'amazon') : (platform === 'chatgpt' ? 'chatgpt' : platform));
      try {
        const { applyRules, getActiveRules } = require('./rules/engine');
        const accountId = req.accountId;
        const rules = await prisma.$queryRawUnsafe(`
          SELECT id, conditionjson, actionjson, feedids, channelids, priority, isactive, startdate, enddate
          FROM "Rule" WHERE accountid = $1::text AND isactive = true ORDER BY priority ASC
        `, accountId);
        const activeRules = getActiveRules(rules);
        const ruleIds = activeRules.map(r => r.id).filter(Boolean);
        let ruleAbAssignments = null;
        if (ruleIds.length > 0) {
          const runningRuleTests = await prisma.aBTest.findMany({
            where: { accountId, status: 'RUNNING', ruleId: { in: ruleIds } }
          });
          if (runningRuleTests.length > 0) {
            const itemIds = items.map(i => i.id);
            ruleAbAssignments = new Map();
            for (const test of runningRuleTests) {
              const assignments = await prisma.aBTestAssignment.findMany({
                where: { testId: test.id, itemId: { in: itemIds } }
              });
              const byItem = new Map(assignments.map(a => [a.itemId, a.arm]));
              ruleAbAssignments.set(test.ruleId, byItem);
            }
          }
        }
        const itemsCopy = items.map(it => {
          const cf = typeof it.customfields === 'string' ? JSON.parse(it.customfields || '{}') : (it.customfields || {});
          return { ...it, customfields: cf, feedid: it.feedid || it.feedId };
        });
        applyRules(itemsCopy, activeRules, id, channelKey, {
          ruleAbAssignments,
          destinationId: destinationContext?.id || null,
        });
        items = itemsCopy.filter(it => !it._excluded);
      } catch (rulesErr) {
        console.warn('⚠️ Règles non appliquées à l\'export:', rulesErr.message);
      }

      // Tests A/B (titres, descriptions, images) : si un test RUNNING existe, overlay control = original, variant = variantValue
      let abTitleMap = new Map();
      let abDescriptionMap = new Map();
      let abImageMap = new Map();
      try {
        const platformNorm = (platform === 'gmc' ? 'GMC' : platform === 'amazon' ? 'AMAZON' : platform === 'chatgpt' ? 'CHATGPT' : (platform || 'GMC').toUpperCase());
        const itemIds = items.map(i => i.id);
        for (const field of ['title', 'description', 'image']) {
          const tests = await prisma.aBTest.findMany({
            where: {
              accountId,
              status: 'RUNNING',
              fieldUnderTest: field,
              platform: platformNorm,
              OR: [{ feedId: id }, { feedId: null }]
            }
          });
          const test = tests.length > 0 ? (tests.find(t => t.feedId === id) || tests.find(t => !t.feedId)) : null;
          if (!test) continue;
          const assignments = await prisma.aBTestAssignment.findMany({
            where: { testId: test.id, itemId: { in: itemIds } }
          });
          for (const a of assignments) {
            const it = items.find(i => i.id === a.itemId);
            if (field === 'title') {
              const original = (it && it.title) ? String(it.title) : '';
              abTitleMap.set(a.itemId, a.arm === 'CONTROL' ? original : (a.variantValue || original));
            } else if (field === 'description') {
              const original = (it && (it.descriptionText || it.descriptiontext)) ? String(it.descriptionText || it.descriptiontext) : '';
              abDescriptionMap.set(a.itemId, a.arm === 'CONTROL' ? original : (a.variantValue || original));
            } else if (field === 'image') {
              const original = (it && (it.imageUrl || it.imageurl)) ? String(it.imageUrl || it.imageurl) : '';
              abImageMap.set(a.itemId, a.arm === 'CONTROL' ? original : (a.variantValue || original));
            }
          }
        }
      } catch (e) {
        console.warn('AB test export:', e.message);
      }

      // ─── Traduction par marché (v2) ────────────────────────────────────
      // Si l'export cible une Destination liée à un marché dont la locale
      // n'est pas la langue source du catalogue, on traduit les `title` et
      // `descriptionText` à la volée via Gemini. Le cache AICache (déjà
      // persistant) fait que la 2e exécution est gratuite. Best-effort : un
      // item qui échoue garde sa version source plutôt que de planter l'export.
      let translationStats = null;
      try {
        const { translateItemsForDestination } = require('./optimization/market-translation');
        const { items: translatedItems, stats } = await translateItemsForDestination(
          prisma,
          items,
          destinationContext,
          { prisma, accountId: req.accountId },
        );
        items = translatedItems;
        translationStats = stats;
        if (stats.quotaExceeded) {
          console.warn(`[market-translation] export ${platform} : plafond IA texte atteint → contenu source (pas de traduction)`);
        } else if (!stats.skipped) {
          console.log(`[market-translation] export ${platform} → ${destinationContext?.localeCode || stats.targetLanguage} : translated=${stats.translated} cached=${stats.cached} failed=${stats.failed}`);
        }
      } catch (translationErr) {
        console.warn('⚠️ Traduction marché ignorée:', translationErr?.message);
      }

      let headers;
      let rows;
      let filename;

      if (platform === 'gmc') {
        // Colonnes et normalisation GMC : quel que soit le flux source (Shopify, CSV, etc.)
        headers = [
          'id', 'title', 'description', 'link', 'image_link', 'additional_image_link',
          'availability', 'price', 'sale_price', 'brand', 'gtin', 'mpn', 'condition',
          'google_product_category', 'product_type', 'item_group_id',
          'color', 'size', 'gender', 'age_group', 'adult',
          'shipping', 'identifier_exists'
        ];
        const DEFAULT_GOOGLE_PRODUCT_CATEGORY = 'Apparel & Accessories > Clothing';
        const DEFAULT_PRODUCT_TYPE = 'Products';

        rows = items.map(item => {
          const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
          const titleForExport = abTitleMap.get(item.id) ?? getOptimizedContentForPlatform(item, 'gmc', { destinationId: destinationContext?.id || null }).title;
          const optTitle = titleForExport;
          const { description: optDesc } = getOptimizedContentForPlatform(item, 'gmc', { destinationId: destinationContext?.id || null });
          let desc = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || '';
          if (abDescriptionMap.has(item.id)) desc = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 5000);
          const inv = item.inventory;
          const availability = normalizeAvailabilityForGMC(cf.availability || cf.inventory, inv);
          const currencyCode = item.currency || cf.currency || destinationContext?.currencyCode || 'EUR';
          const priceStr = item.price != null ? `${Number(item.price).toFixed(2)} ${currencyCode}` : '';
          const salePriceStr = cf.sale_price ? `${Number(cf.sale_price).toFixed(2)} ${currencyCode}` : '';
          const gtin = item.gtin || cf.gtin || cf.GTIN || '';
          const mpn = item.mpn || cf.mpn || cf.MPN || item.sku || '';
          const condition = normalizeConditionForGMC(item.condition || cf.condition);
          const identifierExists = (gtin || mpn) ? 'yes' : 'no';
          const shipping = cf.shipping || cf.shipping_cost || '';
          const googleProductCategory = (cf.google_product_category && String(cf.google_product_category).trim()) || DEFAULT_GOOGLE_PRODUCT_CATEGORY;
          const productType = (cf.product_type && String(cf.product_type).trim()) || DEFAULT_PRODUCT_TYPE;
          const itemGroupId = cf.item_group_id || '';
          const color = cf.color || '';
          const size = cf.size || '';
          const gender = cf.gender || '';
          const ageGroup = cf.age_group || '';
          const adult = cf.adult || 'no';
          let imageLink = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
          if (abImageMap.has(item.id)) imageLink = String(abImageMap.get(item.id));
          const additionalImageLink = cf.additional_image_link || '';
          const linkUrl = item.url || cf.link || '';
          const productId = ((item.originid ?? item.originId) || item.id).toString().substring(0, 50);
          return [
            productId,
            (optTitle || item.title || '').substring(0, 150),
            desc.substring(0, 5000),
            linkUrl,
            imageLink,
            additionalImageLink,
            availability,
            priceStr,
            salePriceStr,
            (item.brand || cf.brand || ''),
            gtin,
            mpn,
            condition,
            googleProductCategory,
            productType,
            itemGroupId,
            color,
            size,
            gender,
            ageGroup,
            adult,
            shipping,
            identifierExists
          ];
        });
        filename = `feed-gmc-${id}${destinationContext?.slug ? `-${destinationContext.slug}` : ''}.csv`;
      } else if (platform === 'lia') {
        // Google Local Inventory Ads : flux d'inventaire local, une ligne par
        // produit × magasin. Le flux produit principal reste l'export GMC ;
        // celui-ci ne porte que la dimension magasin (store_code, quantity, ...).
        const { buildLiaRows } = require('./lib/local-inventory');
        const requestedStoreCode = String(req.query.storeCode || '').trim();
        const stores = await prisma.$queryRawUnsafe(`
          SELECT storecode FROM "StoreLocation"
          WHERE accountid = $1::text AND isactive = true
          ORDER BY storecode
        `, req.accountId);
        if (!stores || stores.length === 0) {
          return res.status(400).json({
            message: 'Aucun magasin configuré. Créez vos magasins (Paramètres → Magasins LIA) avant d\'exporter le flux d\'inventaire local.'
          });
        }
        if (requestedStoreCode && !stores.some(s => s.storecode === requestedStoreCode)) {
          return res.status(400).json({ message: `Magasin inconnu : ${requestedStoreCode}` });
        }
        const inventories = await prisma.$queryRawUnsafe(`
          SELECT storecode, offerid, quantity, availability, price, saleprice, pickupmethod, pickupsla
          FROM "LocalInventory"
          WHERE accountid = $1::text
        `, req.accountId);
        const lia = buildLiaRows({ items, stores, inventories, storeCode: requestedStoreCode || null });
        headers = lia.headers;
        rows = lia.rows;
        filename = `feed-lia-${id}${requestedStoreCode ? `-${requestedStoreCode.toLowerCase()}` : ''}.csv`;
      } else if (platform === 'meta') {
        // Meta (Facebook Commerce / Catalogue) : colonnes attendues par le format CSV Meta
        headers = ['id', 'title', 'description', 'link', 'image_link', 'availability', 'condition', 'price', 'brand', 'gtin', 'mpn'];
        rows = items.map(item => {
          const n = normalizeForMeta(item);
          if (abTitleMap.has(item.id)) n.title = String(abTitleMap.get(item.id)).substring(0, 150);
          if (abDescriptionMap.has(item.id)) n.description = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 5000);
          if (abImageMap.has(item.id)) n.image_link = String(abImageMap.get(item.id));
          return [n.id, n.title, n.description, n.link, n.image_link, n.availability, n.condition, n.price, n.brand, n.gtin, n.mpn];
        });
        filename = `feed-meta-${id}.csv`;
      } else if (platform === 'amazon') {
        // Amazon : normalisation quel que soit le flux source (normalizeForAmazon)
        const channelConfig = AMAZON_CHANNEL_CONFIG[channel];
        headers = [
          'product_id', 'sku', 'item_name', 'brand', 'manufacturer', 'bullet_point', 'product_description',
          'standard_price', 'quantity', 'condition_type', 'main_image_url',
          'external_product_id', 'external_product_id_type', 'link'
        ];
        rows = items.map(item => {
          const n = normalizeForAmazon(item, channelConfig, { destinationId: destinationContext?.id || null });
          return [
            n.product_id,
            n.sku,
            n.item_name,
            n.brand,
            n.manufacturer,
            n.bullet_point,
            n.product_description,
            n.standard_price,
            n.quantity,
            n.condition_type,
            n.main_image_url,
            n.external_product_id,
            n.external_product_id_type,
            n.link
          ];
        });
        filename = `feed-amazon-${channel}-${id}${destinationContext?.slug ? `-${destinationContext.slug}` : ''}.csv`;
      } else if (platform === 'cdiscount') {
        headers = [
          'SellerProductId', 'ProductEan', 'Price', 'Stock', 'ProductCondition',
          'ProductName', 'ProductDescription', 'ImageUrl', 'ProductUrl', 'Brand'
        ];
        rows = items.map(item => {
          const n = normalizeForCdiscount(item);
          return [
            n.SellerProductId,
            n.ProductEan,
            n.Price,
            n.Stock,
            n.ProductCondition,
            n.ProductName,
            n.ProductDescription,
            n.ImageUrl,
            n.ProductUrl,
            n.Brand
          ];
        });
        filename = `feed-cdiscount-${id}.csv`;
      } else if (platform === 'rakuten') {
        headers = [
          'sku', 'code_barres', 'prix', 'quantite', 'qualite', 'commentaire_annonce', 'reconditionne', 'url_images'
        ];
        rows = items.map(item => {
          const n = normalizeForRakuten(item);
          return [
            n.sku,
            n.code_barres,
            n.prix,
            n.quantite,
            n.qualite,
            n.commentaire_annonce,
            n.reconditionne,
            n.url_images
          ];
        });
        filename = `feed-rakuten-${id}.csv`;
      } else if (platform === 'chatgpt') {
        // ChatGPT Product Feed Spec (OpenAI / Agentic Commerce Protocol) — JSON ou CSV
        const chatgptConfig = {};
        const chatgptRows = items.map(item => normalizeForChatGPT(item, chatgptConfig));
        const chatgptHeaders = ['item_id', 'title', 'description', 'url', 'brand', 'image_url', 'price', 'availability', 'group_id', 'listing_has_variations', 'is_eligible_search', 'is_eligible_checkout', 'seller_name', 'seller_url', 'return_policy', 'target_countries', 'store_country', 'condition', 'gtin', 'mpn'];
        if (format === 'json') {
          const jsonPayload = chatgptRows.length === 1 ? chatgptRows[0] : chatgptRows;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="feed-chatgpt-${id}.json"`);
          return res.send(JSON.stringify(jsonPayload, null, 2));
        }
        headers = chatgptHeaders;
        rows = chatgptRows.map(row => chatgptHeaders.map(h => {
          const v = row[h];
          return Array.isArray(v) ? (v.join(';') || '') : (v ?? '');
        }));
        filename = `feed-chatgpt-${id}.csv`;
      } else if (platform === 'bing') {
        headers = ['id', 'title', 'description', 'link', 'image_link', 'additional_image_link', 'availability', 'price', 'sale_price', 'brand', 'gtin', 'mpn', 'condition', 'google_product_category', 'product_type', 'item_group_id'];
        rows = items.map(item => {
          const n = normalizeForBing(item);
          if (abTitleMap.has(item.id)) n.title = String(abTitleMap.get(item.id)).substring(0, 150);
          if (abDescriptionMap.has(item.id)) n.description = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 5000);
          if (abImageMap.has(item.id)) n.image_link = String(abImageMap.get(item.id));
          return [n.id, n.title, n.description, n.link, n.image_link, n.additional_image_link, n.availability, n.price, n.sale_price, n.brand, n.gtin, n.mpn, n.condition, n.google_product_category, n.product_type, n.item_group_id];
        });
        filename = `feed-bing-${id}.csv`;
      } else if (platform === 'pinterest') {
        headers = ['id', 'title', 'description', 'link', 'image_link', 'price', 'availability', 'item_group_id', 'product_type', 'additional_image_link'];
        rows = items.map(item => {
          const n = normalizeForPinterest(item);
          if (abTitleMap.has(item.id)) n.title = String(abTitleMap.get(item.id)).substring(0, 500);
          if (abDescriptionMap.has(item.id)) n.description = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 10000);
          if (abImageMap.has(item.id)) n.image_link = String(abImageMap.get(item.id));
          return [n.id, n.title, n.description, n.link, n.image_link, n.price, n.availability, n.item_group_id, n.product_type, n.additional_image_link];
        });
        filename = `feed-pinterest-${id}.csv`;
      } else if (platform === 'tiktok') {
        headers = ['product_id', 'name', 'description', 'price', 'quantity', 'link', 'image_link', 'brand', 'gtin', 'availability'];
        rows = items.map(item => {
          const n = normalizeForTikTok(item);
          if (abTitleMap.has(item.id)) n.name = String(abTitleMap.get(item.id)).substring(0, 255);
          if (abDescriptionMap.has(item.id)) n.description = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 5000);
          if (abImageMap.has(item.id)) n.image_link = String(abImageMap.get(item.id));
          return [n.product_id, n.name, n.description, n.price, n.quantity, n.link, n.image_link, n.brand, n.gtin, n.availability];
        });
        filename = `feed-tiktok-${id}.csv`;
      } else if (platform === 'snapchat') {
        headers = ['id', 'title', 'description', 'link', 'image_link', 'availability', 'condition', 'price', 'brand', 'gtin', 'mpn'];
        rows = items.map(item => {
          const n = normalizeForSnapchat(item);
          if (abTitleMap.has(item.id)) n.title = String(abTitleMap.get(item.id)).substring(0, 150);
          if (abDescriptionMap.has(item.id)) n.description = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 5000);
          if (abImageMap.has(item.id)) n.image_link = String(abImageMap.get(item.id));
          return [n.id, n.title, n.description, n.link, n.image_link, n.availability, n.condition, n.price, n.brand, n.gtin, n.mpn];
        });
        filename = `feed-snapchat-${id}.csv`;
      } else if (platform === 'yandex') {
        headers = ['id', 'name', 'description', 'url', 'picture', 'price', 'currency', 'category', 'vendor', 'gtin'];
        rows = items.map(item => {
          const n = normalizeForYandex(item);
          if (abTitleMap.has(item.id)) n.name = String(abTitleMap.get(item.id)).substring(0, 512);
          if (abDescriptionMap.has(item.id)) n.description = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 3000);
          if (abImageMap.has(item.id)) n.picture = String(abImageMap.get(item.id));
          return [n.id, n.name, n.description, n.url, n.picture, n.price, n.currency, n.category, n.vendor, n.gtin];
        });
        filename = `feed-yandex-${id}.csv`;
      } else if (platform === 'baidu') {
        headers = ['id', 'title', 'description', 'link', 'image_link', 'price', 'currency', 'brand', 'category'];
        rows = items.map(item => {
          const n = normalizeForBaidu(item);
          if (abTitleMap.has(item.id)) n.title = String(abTitleMap.get(item.id)).substring(0, 200);
          if (abDescriptionMap.has(item.id)) n.description = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 2000);
          if (abImageMap.has(item.id)) n.image_link = String(abImageMap.get(item.id));
          return [n.id, n.title, n.description, n.link, n.image_link, n.price, n.currency, n.brand, n.category];
        });
        filename = `feed-baidu-${id}.csv`;
      } else if (platform === 'perplexity') {
        headers = ['id', 'title', 'description', 'url', 'image_url', 'price', 'brand'];
        rows = items.map(item => {
          const n = normalizeForPerplexity(item);
          if (abTitleMap.has(item.id)) n.title = String(abTitleMap.get(item.id)).substring(0, 200);
          if (abDescriptionMap.has(item.id)) n.description = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 2000);
          if (abImageMap.has(item.id)) n.image_url = String(abImageMap.get(item.id));
          return [n.id, n.title, n.description, n.url, n.image_url, n.price, n.brand];
        });
        filename = `feed-perplexity-${id}.csv`;
      } else if (platform === 'gemini') {
        headers = ['id', 'title', 'description', 'link', 'image_link', 'price', 'brand', 'availability'];
        rows = items.map(item => {
          const n = normalizeForGemini(item);
          if (abTitleMap.has(item.id)) n.title = String(abTitleMap.get(item.id)).substring(0, 200);
          if (abDescriptionMap.has(item.id)) n.description = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 2000);
          if (abImageMap.has(item.id)) n.image_link = String(abImageMap.get(item.id));
          return [n.id, n.title, n.description, n.link, n.image_link, n.price, n.brand, n.availability];
        });
        filename = `feed-gemini-${id}.csv`;
      } else {
        return res.status(400).json({ message: 'Plateforme non supportée.' });
      }

      const csvLines = [headers.join(',')];
      for (const row of rows) {
        csvLines.push(row.map(escapeCsvCell).join(','));
      }
      const csv = '\uFEFF' + csvLines.join('\r\n'); // BOM for Excel UTF-8

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (e) {
      console.error('Export feed error:', e);
      console.error('Export feed error details:', {
        message: e.message,
        code: e.code,
        meta: e.meta,
        stack: e.stack?.substring(0, 500)
      });
      res.status(500).json({ 
        message: 'Erreur lors de l\'export du flux',
        error: e.message,
        code: e.code 
      });
    }
  });

  app.get('/api/v1/ingestion/items/:id', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      let { id } = req.params;
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      const accountId = req.accountId;
    
      // Si l'ID ne ressemble pas à un UUID, chercher par MPN ou SKU (dans le compte uniquement)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let whereClause = 'i.id = $1::text AND f.accountid = $2::text';
      let searchValue = id;
    
      if (!uuidRegex.test(id)) {
        const itemsByMpn = await prisma.$queryRawUnsafe(`
          SELECT i.id FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
          WHERE i.mpn = $1::text AND f.accountid = $2::text LIMIT 1
        `, id, accountId);
        if (itemsByMpn && itemsByMpn.length > 0) {
          searchValue = itemsByMpn[0].id;
        } else {
          const itemsBySku = await prisma.$queryRawUnsafe(`
            SELECT i.id FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
            WHERE i.sku = $1::text AND f.accountid = $2::text LIMIT 1
          `, id, accountId);
          if (itemsBySku && itemsBySku.length > 0) {
            searchValue = itemsBySku[0].id;
          } else {
            return res.status(404).json({ message: 'Item non trouvé (ni par ID, ni par MPN, ni par SKU)' });
          }
        }
      } else {
        // Vérifier que l'item appartient au compte (isolation multi-tenant)
        if (!(await verifyItemAccess(id, accountId))) {
          return res.status(404).json({ message: 'Item non trouvé' });
        }
      }

      // Récupérer l'item avec son feed et le mapping (filtré par accountId)
      const items = await prisma.$queryRawUnsafe(`
        SELECT 
          i.id,
          i.feedid,
          i.originid,
          i.url,
          i.title,
          i.descriptionhtml,
          i.descriptiontext,
          i.imageurl,
          i.brand,
          i.sku,
          i.gtin,
          i.mpn,
          i.condition,
          i.price,
          i.currency,
          i.inventory,
          i.publishedat,
          i.updatedat,
          i.contenthash,
          i.createdat,
          i.customfields,
          json_build_object(
            'id', f.id,
            'name', f.name,
            'mappingJson', f.mappingjson,
            'mappingjson', f.mappingjson,
            'source', json_build_object(
              'id', s.id,
              'name', s.name,
              'connector', s.connector
            )
          ) as feed
        FROM "FeedItem" i
        JOIN "Feed" f ON i.feedid = f.id
        JOIN "FeedSource" s ON f.sourceid = s.id
        WHERE i.id = $1::text AND f.accountid = $2::text
      `, searchValue, accountId);

      if (!items || items.length === 0) {
        return res.status(404).json({ message: 'Item non trouvé' });
      }

      const item = items[0];
      // Normaliser les noms de colonnes (peuvent être en minuscules depuis PostgreSQL)
      if (item.imageurl && !item.imageUrl) {
        item.imageUrl = item.imageurl;
      }
      if (item.descriptionhtml && !item.descriptionHtml) {
        item.descriptionHtml = item.descriptionhtml;
      }
      if (item.descriptiontext && !item.descriptionText) {
        item.descriptionText = item.descriptiontext;
      }
    
      // Normaliser url -> link pour compatibilité avec le mapping
      if (item.url && !item.link) {
        item.link = item.url;
      }
      if (item.imageUrl && !item.image_link) {
        item.image_link = item.imageUrl;
      }
    
      // Ajouter les champs personnalisés depuis customfields au niveau racine de l'objet
      if (item.customfields) {
        let customFields;
        try {
          // Parser customfields si c'est une string JSON
          if (typeof item.customfields === 'string') {
            customFields = JSON.parse(item.customfields);
          } else if (typeof item.customfields === 'object') {
            customFields = item.customfields;
          } else {
            customFields = {};
          }
        
          // Fusionner les champs personnalisés dans l'objet item principal
          Object.assign(item, customFields);
          // Exposer additionalImages (tableau) depuis additional_image_link (string CSV ou tableau)
          const rawAdditional = customFields.additional_image_link ?? customFields.additionalImageLink;
          if (rawAdditional !== undefined && rawAdditional !== null) {
            item.additionalImages = Array.isArray(rawAdditional)
              ? rawAdditional.filter(u => u && String(u).trim())
              : String(rawAdditional).split(',').map(u => u.trim()).filter(Boolean);
          }
          console.log(`✅ ${Object.keys(customFields).length} champs personnalisés fusionnés depuis customfields:`, Object.keys(customFields).slice(0, 15).join(', '));
        } catch (parseError) {
          console.error('❌ Erreur parsing customfields:', parseError.message);
          console.error('   customfields raw:', typeof item.customfields, item.customfields);
        }
      } else {
        console.log('⚠️  Aucun customfields trouvé pour cet item (customfields est:', typeof item.customfields, item.customfields, ')');
      }
    
      // Debug: afficher quelques clés pour vérifier
      const itemKeys = Object.keys(item).filter(k => k !== 'feed' && k !== 'customfields');
      console.log(`🔍 Clés disponibles dans item (${itemKeys.length}):`, itemKeys.slice(0, 20).join(', '));

      res.json(item);
    } catch (e) {
      console.error('Get FeedItem error:', e);
      res.status(500).json({ message: 'Erreur récupération item' });
    }
  });

  app.get('/api/v1/ingestion/items/:id/debug', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      let { id } = req.params;
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      const accountId = req.accountId;

      // Si l'ID ne ressemble pas à un UUID, chercher par MPN ou SKU (dans le compte uniquement)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let searchValue = id;
    
      if (!uuidRegex.test(id)) {
        const itemsByMpn = await prisma.$queryRawUnsafe(`
          SELECT i.id FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
          WHERE i.mpn = $1::text AND f.accountid = $2::text LIMIT 1
        `, id, accountId);
        if (itemsByMpn && itemsByMpn.length > 0) {
          searchValue = itemsByMpn[0].id;
        } else {
          const itemsBySku = await prisma.$queryRawUnsafe(`
            SELECT i.id FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
            WHERE i.sku = $1::text AND f.accountid = $2::text LIMIT 1
          `, id, accountId);
          if (itemsBySku && itemsBySku.length > 0) {
            searchValue = itemsBySku[0].id;
          } else {
            return res.status(404).json({ message: 'Item non trouvé (ni par ID, ni par MPN, ni par SKU)' });
          }
        }
      } else {
        if (!(await verifyItemAccess(id, accountId))) {
          return res.status(404).json({ message: 'Item non trouvé' });
        }
      }

      // Récupérer l'item brut depuis la base (filtré par accountId)
      const items = await prisma.$queryRawUnsafe(`
        SELECT 
          i.*,
          f.mappingjson as feed_mappingjson
        FROM "FeedItem" i
        JOIN "Feed" f ON i.feedid = f.id
        WHERE i.id = $1::text AND f.accountid = $2::text
      `, searchValue, accountId);

      if (!items || items.length === 0) {
        return res.status(404).json({ message: 'Item non trouvé' });
      }

      const item = items[0];
      const mapping = item.feed_mappingjson || {};
    
      // Analyser customfields
      let customFields = {};
      if (item.customfields) {
        try {
          customFields = typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields;
        } catch (e) {
          customFields = { error: 'Erreur parsing: ' + e.message };
        }
      }

      // Vérifier quels champs du mapping sont présents dans customfields
      const mappingFields = Object.keys(mapping);
      const customFieldsKeys = Object.keys(customFields);
      const missingFields = mappingFields.filter(k => !customFieldsKeys.includes(k) && !['title', 'description', 'url', 'imageUrl', 'brand', 'sku', 'price', 'currency', 'inventory', 'gtin', 'mpn', 'condition'].includes(k));

      res.json({
        itemId: item.id,
        originId: item.originid,
        hasCustomFields: !!item.customfields,
        customFieldsType: typeof item.customfields,
        customFieldsCount: customFieldsKeys.length,
        customFieldsKeys: customFieldsKeys.slice(0, 20),
        mappingFieldsCount: mappingFields.length,
        mappingFields: mappingFields.slice(0, 20),
        missingFields: missingFields.slice(0, 20),
        customFieldsSample: Object.fromEntries(Object.entries(customFields).slice(0, 10)),
        rawCustomFields: item.customfields ? (typeof item.customfields === 'string' ? item.customfields.substring(0, 500) : JSON.stringify(item.customfields).substring(0, 500)) : null
      });
    } catch (e) {
      console.error('Debug FeedItem error:', e);
      res.status(500).json({ message: 'Erreur diagnostic', error: e.message });
    }
  });

  app.get('/api/v1/ingestion/items/:id/score', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      // Récupérer l'item (support UUID, MPN ou SKU)
      const accountId = req.accountId;

      // Vérifier si c'est un UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
      let items;
      if (isUUID) {
        // Vérifier l'accès multi-tenant avant de récupérer l'item
        if (!(await verifyItemAccess(id, accountId))) {
          return res.status(404).json({ message: 'Item non trouvé' });
        }
        items = await prisma.$queryRawUnsafe(`
          SELECT i.* FROM "FeedItem" i
          JOIN "Feed" f ON i.feedid = f.id
          WHERE i.id = $1::text AND f.accountid = $2::text
        `, id, accountId);
      } else {
        // Rechercher par MPN ou SKU (dans le compte uniquement)
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
      // ID canonique pour le score (toujours l'UUID FeedItem) pour cohérence stockage/lecture
      const itemIdCanonical = item.id;
    
      // Parser customfields si c'est une string JSON
      let customFields = {};
      if (item.customfields) {
        try {
          if (typeof item.customfields === 'string') {
            customFields = JSON.parse(item.customfields);
          } else if (typeof item.customfields === 'object' && item.customfields !== null) {
            customFields = item.customfields;
          }
        } catch (parseError) {
          console.warn('Erreur parsing customfields pour score:', parseError.message);
          customFields = {};
        }
      }
    
      // Normaliser les noms de colonnes (PostgreSQL retourne en minuscules)
      // Créer un objet normalisé avec les noms en camelCase
      const normalizedItem = {
        id: item.id,
        feedId: item.feedid,
        originId: item.originid,
        url: item.url,
        title: item.title,
        descriptionHtml: item.descriptionhtml || item.descriptionHtml,
        descriptionText: item.descriptiontext || item.descriptionText,
        description: item.descriptiontext || item.descriptionText || item.descriptionhtml || item.descriptionHtml,
        imageUrl: item.imageurl || item.imageurl,
        brand: item.brand,
        sku: item.sku,
        gtin: item.gtin,
        mpn: item.mpn,
        condition: item.condition,
        price: item.price !== null && item.price !== undefined ? Number(item.price) : null,
        currency: item.currency,
        inventory: item.inventory !== null && item.inventory !== undefined ? Number(item.inventory) : null,
        availability: item.availability || 'in stock',
        publishedAt: item.publishedat,
        updatedAt: item.updatedat,
        contentHash: item.contenthash,
        createdAt: item.createdat,
        customFields: customFields
      };

      // Récupérer ou calculer le score avec le nouveau système avancé (toujours par UUID)
      let score = await getAdvancedQualityScore(prisma, itemIdCanonical);
    
      // Toujours recalculer le score pour s'assurer qu'il est à jour
      try {
        const calculatedScore = await updateAdvancedQualityScore(prisma, itemIdCanonical, normalizedItem, []);
        score = {
          qualityScore: calculatedScore.qualityScore,
          performanceScore: 0,
          qualityDetails: calculatedScore.qualityDetails,
          performanceDetails: {},
          dimensions: calculatedScore.dimensions,
          blocking: calculatedScore.blocking
        };
      } catch (scoreError) {
        console.error('Error calculating advanced score:', scoreError);
        console.error('Score error stack:', scoreError.stack);
        console.error('Item data:', JSON.stringify(normalizedItem, null, 2).substring(0, 500));
      
        // Si le calcul échoue, récupérer le score existant et garantir la forme de la réponse
        if (!score) {
          return res.status(500).json({ 
            message: 'Erreur lors du calcul du score',
            error: scoreError.message,
            details: 'Vérifiez les logs backend pour plus d\'informations'
          });
        }
        // Garantir dimensions pour le frontend même en fallback
        score.dimensions = score.dimensions || {
          compliance: 0,
          dataQuality: 0,
          seo: 0,
          conversion: 0
        };
      }

      res.json(score);
    } catch (e) {
      console.error('Get Score error:', e);
      console.error('Error stack:', e.stack);
      res.status(500).json({ 
        message: 'Erreur récupération score',
        error: e.message 
      });
    }
  });

  app.get('/api/v1/ingestion/items/:id/score-history', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      if (!prismaReady || !prisma) {
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
          SELECT i.id FROM "FeedItem" i
          JOIN "Feed" f ON i.feedid = f.id
          WHERE i.id = $1::text AND f.accountid = $2::text
        `, id, accountId);
      } else {
        items = await prisma.$queryRawUnsafe(`
          SELECT i.id FROM "FeedItem" i
          JOIN "Feed" f ON i.feedid = f.id
          WHERE (i.mpn = $1::text OR i.sku = $1::text) AND f.accountid = $2::text
          LIMIT 1
        `, id, accountId);
      }
      if (!items || items.length === 0) {
        return res.status(404).json({ message: 'Item non trouvé' });
      }
      const itemIdCanonical = items[0].id;
      let rows = [];
      try {
        rows = await prisma.$queryRawUnsafe(`
          SELECT qualityscore AS "qualityScore", recordedat AS "recordedAt"
          FROM "ProductScoreHistory"
          WHERE itemid = $1::text
          ORDER BY recordedat ASC
          LIMIT 60
        `, itemIdCanonical);
      } catch (historyErr) {
        if (historyErr?.code === '42P01' || /ProductScoreHistory|42P01/i.test(historyErr?.message || '')) {
          await ensureProductScoreHistoryTable(prisma);
          rows = [];
        } else {
          throw historyErr;
        }
      }
      const history = (rows || []).map((r) => ({
        qualityScore: Number(r.qualityScore),
        recordedAt: r.recordedAt
      }));
      res.json({ itemId: itemIdCanonical, history });
    } catch (e) {
      console.error('Get score-history error:', e);
      res.status(500).json({ message: 'Erreur historique score', error: e.message });
    }
  });

  app.get('/api/v1/ingestion/catalogue/score', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      if (!(await ensurePrismaReady()) || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      const { feedId } = req.query;

      // Vérifier l'accès au feed si feedId fourni (isolation multi-tenant)
      if (feedId && !(await verifyFeedAccess(feedId, req.accountId))) {
        return res.status(403).json({ message: 'Accès refusé à ce flux' });
      }

      // Récupérer uniquement les scores DU COMPTE CONNECTÉ
      let query = `
        SELECT 
          ps.qualityscore,
          ps.qualitydetails,
          fi.feedid,
          fi.title,
          fi.descriptiontext,
          fi.descriptionhtml,
          fi.imageurl,
          fi.brand,
          fi.price,
          fi.currency,
          fi.url,
          fi.inventory,
          fi.customfields,
          fi.gtin,
          fi.mpn,
          f.name as feed_name,
          s.name as source_name
        FROM "ProductScore" ps
        JOIN "FeedItem" fi ON ps.itemid = fi.id
        JOIN "Feed" f ON fi.feedid = f.id
        JOIN "FeedSource" s ON f.sourceid = s.id
        WHERE f.accountid = $1::text
      `;
    
      const params = [req.accountId];
      if (feedId) {
        query += ` AND fi.feedid = $2::text`;
        params.push(feedId);
      }

      const scores = await prisma.$queryRawUnsafe(query, ...params);

      if (!scores || scores.length === 0) {
        return res.json({
          globalScore: 0,
          totalProducts: 0,
          scoreBand: {
            label: 'A initialiser',
            description: 'Synchronisez votre flux pour afficher un score exploitable et des priorites concretes.'
          },
          distribution: {},
          auditPillars: [],
          topIssues: [],
          byDimension: {
            compliance: { average: 0, count: 0 },
            dataQuality: { average: 0, count: 0 },
            seo: { average: 0, count: 0 },
            conversion: { average: 0, count: 0 }
          },
          byFeed: {},
          recommendations: []
        });
      }

      const parseJsonObject = (value) => {
        if (!value) return {};
        if (typeof value === 'object') return value;
        if (typeof value !== 'string') return {};
        try {
          const parsed = JSON.parse(value);
          return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
          return {};
        }
      };

      const getIssuePriorityWeight = (priority) => {
        if (priority === 'high') return 3;
        if (priority === 'medium') return 2;
        return 1;
      };

      const issueRegistry = {
        missing_category: {
          label: 'Produits sans categorie',
          recommendation: 'Renseigner une categorie Google ou un product type pour mieux matcher les canaux.',
          impact: 'Diffusion et matching limites',
          priority: 'high',
          smartView: 'missing_category'
        },
        missing_image: {
          label: 'Produits sans image',
          recommendation: 'Ajouter une image principale exploitable en HTTPS pour debloquer la diffusion.',
          impact: 'Produits penalises ou rejetes',
          priority: 'high',
          smartView: 'missing_image'
        },
        missing_brand: {
          label: 'Produits sans marque',
          recommendation: 'Completer la marque pour renforcer la confiance et la qualite de matching.',
          impact: 'Qualite catalogue affaiblie',
          priority: 'medium',
          smartView: 'missing_brand'
        },
        missing_identifier: {
          label: 'Produits sans identifiant',
          recommendation: 'Ajouter GTIN ou MPN pour fiabiliser la correspondance produit et les canaux.',
          impact: 'Matching et conformite reduits',
          priority: 'medium',
          smartView: null
        },
        weak_title: {
          label: 'Titres trop faibles',
          recommendation: 'Allonger et structurer les titres avec marque, type, attribut cle et variante.',
          impact: 'Decouvrabilite plus faible',
          priority: 'medium',
          smartView: null
        },
        thin_description: {
          label: 'Descriptions trop courtes',
          recommendation: 'Ajouter les attributs cle, usages, matiere, tailles et arguments de reassurance.',
          impact: 'Contexte produit insuffisant',
          priority: 'low',
          smartView: null
        }
      };

      const issueCounters = Object.keys(issueRegistry).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {});
      const recommendationStats = new Map();

      // Calculer les métriques globales
      const totalProducts = scores.length;
      let totalScore = 0;
      const dimensionScores = {
        compliance: [],
        dataQuality: [],
        seo: [],
        conversion: []
      };
      const feedStats = {};
      const distribution = {
        excellent: 0, // 80-100
        good: 0,      // 60-79
        medium: 0,    // 40-59
        poor: 0       // 0-39
      };

      scores.forEach(score => {
        const qualityScore = score.qualityscore || 0;
        totalScore += qualityScore;

        const customFields = parseJsonObject(score.customfields);
        const normalizedItem = {
          id: score.originid || score.id || null,
          title: score.title || '',
          descriptionText: score.descriptiontext || null,
          descriptionHtml: score.descriptionhtml || null,
          description: score.descriptiontext || score.descriptionhtml || null,
          imageUrl: score.imageurl || customFields.image_link || null,
          brand: score.brand || customFields.brand || null,
          price: score.price != null ? Number(score.price) : null,
          currency: score.currency || customFields.currency || null,
          url: score.url || customFields.link || null,
          inventory: score.inventory != null ? Number(score.inventory) : null,
          gtin: score.gtin || customFields.gtin || null,
          mpn: score.mpn || customFields.mpn || null,
          availability: customFields.availability || null,
          customFields
        };
        const details = score.qualitydetails || {};
        const derivedScore = details?.dimensions ? {
          dimensions: details.dimensions,
          qualityDetails: details
        } : calculateAdvancedQualityScore(normalizedItem, customFields);

        // Distribution
        if (qualityScore >= 80) distribution.excellent++;
        else if (qualityScore >= 60) distribution.good++;
        else if (qualityScore >= 40) distribution.medium++;
        else distribution.poor++;

        // Dimensions
        const dimensions = derivedScore?.dimensions || {};
        if (dimensions.compliance !== undefined) dimensionScores.compliance.push(Number(dimensions.compliance) || 0);
        if (dimensions.dataQuality !== undefined) dimensionScores.dataQuality.push(Number(dimensions.dataQuality) || 0);
        if (dimensions.seo !== undefined) dimensionScores.seo.push(Number(dimensions.seo) || 0);
        if (dimensions.conversion !== undefined) dimensionScores.conversion.push(Number(dimensions.conversion) || 0);

        const titleLength = String(normalizedItem.title || '').trim().length;
        const descriptionLength = String(normalizedItem.descriptionText || normalizedItem.descriptionHtml || '').replace(/<[^>]+>/g, ' ').trim().length;
        const categoryValue = customFields.google_product_category || customFields.product_type || customFields.category || customFields.googleProductCategory || null;
        const hasIdentifier = Boolean(normalizedItem.gtin || normalizedItem.mpn);
        if (!categoryValue) issueCounters.missing_category++;
        if (!normalizedItem.imageUrl) issueCounters.missing_image++;
        if (!normalizedItem.brand) issueCounters.missing_brand++;
        if (!hasIdentifier) issueCounters.missing_identifier++;
        if (titleLength > 0 && titleLength < 45) issueCounters.weak_title++;
        if (descriptionLength > 0 && descriptionLength < 220) issueCounters.thin_description++;

        const recommendations = Array.isArray(derivedScore?.qualityDetails?.recommendations)
          ? derivedScore.qualityDetails.recommendations
          : [];
        recommendations.slice(0, 6).forEach((recommendation) => {
          const key = `${recommendation.category || 'general'}:${recommendation.field || recommendation.message || 'message'}`;
          const existing = recommendationStats.get(key) || {
            key,
            priority: recommendation.priority || 'low',
            category: recommendation.category || 'general',
            field: recommendation.field || null,
            message: recommendation.message,
            impact: recommendation.impact || '',
            count: 0
          };
          existing.count += 1;
          if (getIssuePriorityWeight(recommendation.priority) > getIssuePriorityWeight(existing.priority)) {
            existing.priority = recommendation.priority;
          }
          recommendationStats.set(key, existing);
        });

        // Par feed
        const feedIdKey = score.feedid;
        if (!feedStats[feedIdKey]) {
          feedStats[feedIdKey] = {
            feedId: feedIdKey,
            feedName: score.feed_name,
            sourceName: score.source_name,
            total: 0,
            sum: 0,
            distribution: { excellent: 0, good: 0, medium: 0, poor: 0 }
          };
        }
        feedStats[feedIdKey].total++;
        feedStats[feedIdKey].sum += qualityScore;
        if (qualityScore >= 80) feedStats[feedIdKey].distribution.excellent++;
        else if (qualityScore >= 60) feedStats[feedIdKey].distribution.good++;
        else if (qualityScore >= 40) feedStats[feedIdKey].distribution.medium++;
        else feedStats[feedIdKey].distribution.poor++;
      });

      // Calculer les moyennes
      const globalScore = totalProducts > 0 ? Math.round(totalScore / totalProducts) : 0;
    
      const byDimension = {
        compliance: {
          average: dimensionScores.compliance.length > 0 
            ? Math.round(dimensionScores.compliance.reduce((a, b) => a + b, 0) / dimensionScores.compliance.length)
            : 0,
          count: dimensionScores.compliance.length
        },
        dataQuality: {
          average: dimensionScores.dataQuality.length > 0
            ? Math.round(dimensionScores.dataQuality.reduce((a, b) => a + b, 0) / dimensionScores.dataQuality.length)
            : 0,
          count: dimensionScores.dataQuality.length
        },
        seo: {
          average: dimensionScores.seo.length > 0
            ? Math.round(dimensionScores.seo.reduce((a, b) => a + b, 0) / dimensionScores.seo.length)
            : 0,
          count: dimensionScores.seo.length
        },
        conversion: {
          average: dimensionScores.conversion.length > 0
            ? Math.round(dimensionScores.conversion.reduce((a, b) => a + b, 0) / dimensionScores.conversion.length)
            : 0,
          count: dimensionScores.conversion.length
        }
      };

      // Calculer les moyennes par feed
      const byFeed = {};
      Object.keys(feedStats).forEach(feedId => {
        const stats = feedStats[feedId];
        byFeed[feedId] = {
          feedId: stats.feedId,
          feedName: stats.feedName,
          sourceName: stats.sourceName,
          averageScore: Math.round(stats.sum / stats.total),
          totalProducts: stats.total,
          distribution: stats.distribution
        };
      });

      const auditPillars = [
        {
          key: 'compliance',
          label: 'Conformite diffusion',
          score: byDimension.compliance.average,
          detail: 'Mesure la capacite des produits a etre diffuses sans blocage majeur.'
        },
        {
          key: 'dataQuality',
          label: 'Completude catalogue',
          score: byDimension.dataQuality.average,
          detail: 'Mesure la richesse et la fiabilite des attributs essentiels.'
        },
        {
          key: 'seo',
          label: 'Decouvrabilite',
          score: byDimension.seo.average,
          detail: 'Mesure la capacite du catalogue a bien matcher les requetes et la taxonomie.'
        },
        {
          key: 'conversion',
          label: 'Readiness conversion',
          score: byDimension.conversion.average,
          detail: 'Mesure la capacite des fiches a convertir une fois visibles.'
        }
      ];

      const scoreBand = globalScore >= 85
        ? { label: 'Avance', description: 'Le flux est solide. Il reste surtout des optimisations de precision et de couverture.' }
        : globalScore >= 70
          ? { label: 'Exploitable', description: 'Le catalogue diffuse, mais plusieurs faiblesses freinent encore la couverture et la qualite.' }
          : globalScore >= 50
            ? { label: 'Fragile', description: 'Le flux peut etre exploite, mais trop de produits restent sous-optimises ou incomplets.' }
            : { label: 'Critique', description: 'Le catalogue perd beaucoup de valeur avant meme la phase de diffusion.' };

      const topIssues = Object.entries(issueCounters)
        .map(([key, count]) => ({
          key,
          count,
          ...issueRegistry[key]
        }))
        .filter((issue) => issue.count > 0)
        .sort((a, b) => {
          const priorityDiff = getIssuePriorityWeight(b.priority) - getIssuePriorityWeight(a.priority);
          if (priorityDiff !== 0) return priorityDiff;
          return b.count - a.count;
        })
        .slice(0, 5);

      // Générer des recommandations globales
      const recommendations = [];
      if (byDimension.compliance.average < 70) {
        recommendations.push({
          priority: 'high',
          category: 'conformity',
          message: `${distribution.poor} produits ont un score de conformité < 70 et risquent d'être rejetés par Google`,
          impact: 'Bloquant - produits non visibles'
        });
      }
      if (byDimension.dataQuality.average < 60) {
        recommendations.push({
          priority: 'high',
          category: 'quality',
          message: `La qualité moyenne des données est faible (${byDimension.dataQuality.average}/100). Améliorer les titres et descriptions.`,
          impact: '+10-20% de visibilité'
        });
      }
      if (byDimension.seo.average < 60) {
        recommendations.push({
          priority: 'medium',
          category: 'seo',
          message: `L'optimisation SEO moyenne est faible (${byDimension.seo.average}/100). Ajouter des catégories Google et enrichir les attributs.`,
          impact: '+15-30% de ranking'
        });
      }
      recommendationStats.forEach((recommendation) => {
        if (recommendation.count < Math.max(8, Math.round(totalProducts * 0.03))) return;
        recommendations.push({
          priority: recommendation.priority,
          category: recommendation.category,
          message: `${recommendation.count} produit${recommendation.count > 1 ? 's' : ''}: ${recommendation.message}`,
          impact: recommendation.impact
        });
      });

      recommendations.sort((a, b) => {
        const priorityDiff = getIssuePriorityWeight(b.priority) - getIssuePriorityWeight(a.priority);
        if (priorityDiff !== 0) return priorityDiff;
        const aCount = parseInt(String(a.message).match(/^(\d+)/)?.[1] || '0', 10);
        const bCount = parseInt(String(b.message).match(/^(\d+)/)?.[1] || '0', 10);
        return bCount - aCount;
      });

      res.json({
        globalScore,
        totalProducts,
        scoreBand,
        distribution: {
          excellent: distribution.excellent,
          good: distribution.good,
          medium: distribution.medium,
          poor: distribution.poor,
          percentages: {
            excellent: Math.round((distribution.excellent / totalProducts) * 100),
            good: Math.round((distribution.good / totalProducts) * 100),
            medium: Math.round((distribution.medium / totalProducts) * 100),
            poor: Math.round((distribution.poor / totalProducts) * 100)
          }
        },
        auditPillars,
        topIssues,
        byDimension,
        byFeed,
        recommendations: recommendations.slice(0, 6)
      });
    } catch (e) {
      console.error('Catalogue score error:', e);
      res.status(500).json({ message: 'Erreur calcul score catalogue', error: e.message });
    }
  });

  app.post('/api/v1/ingestion/recalculate-all-scores', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
      const acctId = req.accountId;
      const feature = await canUseFeature(prisma, acctId, 'qualityScore');
      if (!feature.allowed) {
        return res.status(403).json({ code: 'PLAN_FEATURE', message: feature.message });
      }

      const { feedId, limit = 1000 } = req.body || {};

      // Vérifier l'accès au feed si feedId fourni (isolation multi-tenant)
      if (feedId && !(await verifyFeedAccess(feedId, req.accountId))) {
        return res.status(403).json({ message: 'Accès refusé à ce flux' });
      }

      // Récupérer uniquement les items DU COMPTE CONNECTÉ (f.accountid = req.accountId)
      let query = `
        SELECT 
          fi.*,
          f.mappingjson as feed_mapping
        FROM "FeedItem" fi
        JOIN "Feed" f ON fi.feedid = f.id
        WHERE f.accountid = $1::text
      `;
    
      const params = [req.accountId, limit];
      if (feedId) {
        query += ` AND fi.feedid = $3::text`;
        params.push(feedId);
      }
      query += ` ORDER BY fi.updatedat DESC LIMIT $2::int`;

      const items = await prisma.$queryRawUnsafe(query, ...params);

      if (!items || items.length === 0) {
        return res.json({
          message: 'Aucun produit à recalculer',
          recalculated: 0,
          errors: 0
        });
      }

      let recalculated = 0;
      let errors = 0;

      for (const item of items) {
        try {
          // Normaliser l'item
          const normalizedItem = {
            id: item.id,
            feedId: item.feedid,
            originId: item.originid,
            url: item.url,
            title: item.title,
            descriptionHtml: item.descriptionhtml,
            descriptionText: item.descriptiontext,
            description: item.descriptiontext || item.descriptionhtml,
            imageUrl: item.imageurl,
            brand: item.brand,
            sku: item.sku,
            gtin: item.gtin,
            mpn: item.mpn,
            condition: item.condition,
            price: item.price !== null && item.price !== undefined ? Number(item.price) : null,
            currency: item.currency,
            inventory: item.inventory !== null && item.inventory !== undefined ? Number(item.inventory) : null,
            availability: item.availability || 'in stock',
            publishedAt: item.publishedat,
            updatedAt: item.updatedat,
            contentHash: item.contenthash,
            createdAt: item.createdat,
            customFields: item.customfields || {}
          };

          // Recalculer le score avec le nouveau système
          await updateAdvancedQualityScore(prisma, item.id, normalizedItem, []);
          recalculated++;
        } catch (error) {
          console.error(`Erreur recalcul score pour item ${item.id}:`, error.message);
          errors++;
        }
      }

      res.json({
        message: 'Recalcul des scores terminé',
        total: items.length,
        recalculated,
        errors
      });
    } catch (e) {
      console.error('Recalculate all scores error:', e);
      res.status(500).json({ message: 'Erreur recalcul scores', error: e.message });
    }
  });

  app.post('/api/v1/ingestion/upload-csv', upload.single('file'), async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Aucun fichier uploadé' });
      }

      if (hasXxePayload(req.file.buffer)) {
        return res.status(400).json({ message: 'Fichier refusé : contenu non autorisé détecté.' });
      }

      const text = req.file.buffer.toString('utf-8');
      const { parse } = require('csv-parse/sync');
    
      // Détecter automatiquement le délimiteur (virgule, tabulation ou pipe)
      const firstLine = text.split(/\r?\n/)[0] || '';
      const hasTabs = firstLine.includes('\t');
      const hasPipes = firstLine.includes('|');
      const numColsComma = firstLine.split(',').length;
      const numColsPipe = firstLine.split('|').length;
      let delimiter = ',';
      if (hasTabs && !hasPipes) delimiter = '\t';
      else if (hasPipes && numColsPipe >= 2 && numColsPipe >= numColsComma) delimiter = '|';
      else if (hasTabs) delimiter = '\t';
    
      let records = parse(text, { 
        columns: true, 
        skip_empty_lines: true, 
        bom: true, 
        trim: true,
        delimiter: delimiter,
        quote: '"',
        escape: '"',
        relax_quotes: true,
        relax_column_count: true,
        to: 10
      });

      if (records.length === 0) {
        return res.status(400).json({ message: 'Le fichier est vide ou ne peut pas être parsé' });
      }

      let columns = Object.keys(records[0]);
      let sampleRow = records[0];

      // Correctif : une seule colonne = délimiteur mal détecté. Réessayer avec | ou ;
      const singleCol = columns[0];
      if (columns.length === 1 && singleCol && singleCol.length > 3) {
        for (const tryDelim of ['|', ';']) {
          if (!singleCol.includes(tryDelim) || singleCol.split(tryDelim).length < 2) continue;
          const recordsAlt = parse(text, {
            columns: true,
            skip_empty_lines: true,
            bom: true,
            trim: true,
            delimiter: tryDelim,
            quote: '"',
            escape: '"',
            relax_quotes: true,
            relax_column_count: true,
            to: 10
          });
          if (recordsAlt.length > 0 && Object.keys(recordsAlt[0]).length >= 2) {
            records = recordsAlt;
            columns = Object.keys(recordsAlt[0]);
            sampleRow = recordsAlt[0];
            delimiter = tryDelim;
            break;
          }
        }
      }
    
      // Fonction de détection de mapping (identique à analyze-csv - patterns GMC complets)
      const detectMapping = (columns, sampleRow) => {
        const mapping = {};
        const columnLower = columns.map(c => c.toLowerCase().trim());
        const findBestMatch = (patterns, excludeColumns = []) => {
          let bestMatch = null;
          let bestScore = 0;
          for (const pattern of patterns) {
            const patternLower = pattern.toLowerCase();
            const exactIndex = columnLower.findIndex((col, idx) =>
              !excludeColumns.includes(columns[idx]) && col === patternLower
            );
            if (exactIndex !== -1) return { column: columns[exactIndex], score: 100 };
            columnLower.forEach((col, idx) => {
              if (excludeColumns.includes(columns[idx])) return;
              if (col === patternLower) { bestMatch = columns[idx]; bestScore = Math.max(bestScore, 100); }
              else if (col.includes(patternLower)) {
                const score = (patternLower.length / col.length) * 90;
                if (!bestMatch || score > bestScore) { bestMatch = columns[idx]; bestScore = score; }
              } else if (patternLower.includes(col)) {
                const score = (col.length / patternLower.length) * 80;
                if (!bestMatch || score > bestScore) { bestMatch = columns[idx]; bestScore = score; }
              } else {
                const nCol = col.replace(/[_-]/g, ''), nPat = patternLower.replace(/[_-]/g, '');
                if (nCol === nPat && (!bestMatch || bestScore < 85)) { bestMatch = columns[idx]; bestScore = 85; }
              }
            });
          }
          return bestMatch ? { column: bestMatch, score: bestScore } : null;
        };
        const fieldPatterns = {
          id: ['id', 'product_id', 'item_id', 'sku', 'reference', 'ref', 'code', 'product_code'],
          title: ['title', 'name', 'product_name', 'product_title', 'nom', 'titre'],
          description: ['description', 'desc', 'product_description', 'detail', 'details', 'long_description'],
          link: ['link', 'url', 'product_url', 'product_link', 'lien', 'page_url', 'canonical_url'],
          image_link: ['image_link', 'image', 'image_url', 'imageurl', 'main_image', 'primary_image', 'photo', 'picture', 'img', 'image_1'],
          additional_image_link: ['additional_image', 'image_2', 'image_3', 'secondary_image', 'extra_image', 'gallery_image'],
          mobile_link: ['mobile_link', 'mobile_url', 'mobile', 'mobile_page'],
          price: ['price', 'prix', 'cost', 'amount', 'prix_ttc', 'price_ttc', 'regular_price', 'list_price', 'prix_public'],
          sale_price: ['sale_price', 'promo_price', 'discount_price', 'special_price', 'reduced_price', 'prix_promo', 'prix_solde', 'prix_remise'],
          sale_price_effective_date: ['sale_price_effective_date', 'promo_dates', 'sale_dates', 'discount_period'],
          availability: ['availability', 'stock_status', 'in_stock', 'available', 'stock', 'disponibilite', 'disponible', 'en_stock', 'availability_text', 'stock_disponible'],
          availability_date: ['availability_date', 'stock_date', 'available_date', 'restock_date'],
          cost_of_goods_sold: ['cost_of_goods_sold', 'cogs', 'cost_price', 'wholesale_price', 'prix_achat'],
          expiration_date: ['expiration_date', 'expires', 'expiry_date', 'end_date'],
          inventory: ['inventory', 'stock', 'qty', 'quantity', 'stock_level', 'stock_qty', 'stock_quantity', 'inventaire'],
          google_product_category: ['google_product_category', 'google_category', 'gmc_category', 'category_id'],
          product_type: ['product_type', 'type', 'product_category', 'category', 'categorie'],
          brand: ['brand', 'marque', 'manufacturer', 'fabricant', 'vendor', 'maker'],
          gtin: ['gtin', 'barcode', 'ean', 'ean13', 'upc', 'code_barre', 'code-barres', 'barcode_number'],
          mpn: ['mpn', 'manufacturer_part_number', 'part_number', 'ref_fabricant', 'reference_fabricant', 'model_number'],
          identifier_exists: ['identifier_exists', 'has_identifier', 'has_gtin'],
          condition: ['condition', 'etat', 'state', 'item_condition', 'product_condition', 'product_state'],
          color: ['color', 'couleur', 'colour', 'product_color'],
          size: ['size', 'taille', 'product_size'],
          material: ['material', 'materiau', 'matiere', 'fabric', 'composition'],
          pattern: ['pattern', 'motif', 'design_pattern'],
          gender: ['gender', 'genre', 'sex', 'target_gender', 'sexe'],
          age_group: ['age_group', 'age', 'age_range', 'groupe_age', 'tranche_age', 'age_target', 'age_cible'],
          size_type: ['size_type', 'size_category', 'size_class'],
          size_system: ['size_system', 'size_standard', 'sizing_system'],
          item_group_id: ['item_group_id', 'group_id', 'variant_group', 'product_group', 'parent_id'],
          multipack: ['multipack', 'pack_size', 'pack_quantity'],
          is_bundle: ['is_bundle', 'bundle', 'is_pack', 'product_bundle'],
          adult: ['adult', 'adult_content', 'is_adult'],
          energy_efficiency_class: ['energy_efficiency_class', 'energy_class', 'efficiency_class'],
          shipping_weight: ['shipping_weight', 'weight', 'poids', 'product_weight', 'weight_kg'],
          shipping_length: ['shipping_length', 'length', 'longueur', 'product_length'],
          shipping_width: ['shipping_width', 'width', 'largeur', 'product_width'],
          shipping_height: ['shipping_height', 'height', 'hauteur', 'product_height'],
          max_handling_time: ['max_handling_time', 'max_handling', 'handling_time_max'],
          min_handling_time: ['min_handling_time', 'min_handling', 'handling_time_min'],
          transit_time_label: ['transit_time_label', 'transit_time', 'delivery_time'],
          custom_label_0: ['custom_label_0', 'label_0', 'custom_0', 'tag_0'],
          custom_label_1: ['custom_label_1', 'label_1', 'custom_1', 'tag_1'],
          custom_label_2: ['custom_label_2', 'label_2', 'custom_2', 'tag_2'],
          custom_label_3: ['custom_label_3', 'label_3', 'custom_3', 'tag_3'],
          custom_label_4: ['custom_label_4', 'label_4', 'custom_4', 'tag_4']
        };
        const usedColumns = [];
        Object.keys(fieldPatterns).forEach(field => {
          const match = findBestMatch(fieldPatterns[field], usedColumns);
          if (match && match.score > 50) {
            mapping[field] = match.column;
            usedColumns.push(match.column);
          }
        });
        return mapping;
      };
    
      const suggestedMapping = detectMapping(columns, sampleRow);
    
      const preview = records.slice(0, 3).map(row => {
        const mapped = {};
        Object.keys(suggestedMapping).forEach(targetField => {
          const sourceColumn = suggestedMapping[targetField];
          mapped[targetField] = row[sourceColumn] || null;
        });
        return mapped;
      });

      // Sauvegarder le fichier dans Cloud Storage (on lit directement depuis GCS à la sync, pas besoin d'URL signée)
      let gcsPath = null;
      try {
        const fileName = `uploads/${Date.now()}-${req.file.originalname}`;
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(fileName);
      
        await file.save(req.file.buffer, {
          metadata: {
            contentType: req.file.mimetype,
          },
        });
      
        gcsPath = `gs://${bucketName}/${fileName}`;
      } catch (storageError) {
        console.error('Erreur sauvegarde Cloud Storage:', storageError.message);
        return res.status(500).json({
          message: 'Impossible de sauvegarder le fichier pour la synchronisation.',
          detail: storageError.message || 'Vérifiez la configuration Google Cloud Storage (bucket, credentials).'
        });
      }

      if (!gcsPath) {
        return res.status(500).json({
          message: 'Configuration Storage manquante.',
          detail: 'Le fichier n\'a pas pu être stocké. Vérifiez GOOGLE_CLOUD_STORAGE_BUCKET et les credentials GCP.'
        });
      }

      res.json({
        columns: columns,
        suggestedMapping: suggestedMapping,
        preview: preview,
        totalRows: records.length,
        delimiter: delimiter === '\t' ? 'TSV' : (delimiter === '|' ? 'PIPE' : 'CSV'),
        fileName: req.file.originalname,
        csvUrl: null, // Non utilisé : la sync lit directement depuis gcsPath
        gcsPath: gcsPath
      });
    } catch (e) {
      console.error('Upload CSV error:', e);
      res.status(500).json({ message: 'Erreur lors de l\'analyse du fichier: ' + e.message });
    }
  });

  app.post('/api/v1/ingestion/analyze-csv', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { csvUrl } = req.body;
      if (!csvUrl) {
        return res.status(400).json({ message: 'csvUrl requis' });
      }

      // Fonction pour récupérer le texte du CSV
      const fetchText = async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return await response.text();
      };

      const text = await fetchText(csvUrl);
      const { parse } = require('csv-parse/sync');
    
      // Détecter automatiquement le délimiteur (virgule, tabulation ou pipe)
      const firstLine = (text.split(/\r?\n/)[0] || '').trim();
      const hasTabs = firstLine.includes('\t');
      const hasPipes = firstLine.includes('|');
      const numColsComma = firstLine.split(',').length;
      const numColsPipe = firstLine.split('|').length;
      let delimiter = ',';
      if (hasTabs && !hasPipes) delimiter = '\t';
      else if (hasPipes && numColsPipe >= 2 && numColsPipe >= numColsComma) delimiter = '|';
      else if (hasTabs) delimiter = '\t';
    
      // Parser les premières lignes pour analyser les colonnes
      const records = parse(text, { 
        columns: true, 
        skip_empty_lines: true, 
        bom: true, 
        trim: true,
        delimiter: delimiter,
        quote: '"',
        escape: '"',
        relax_quotes: true,
        relax_column_count: true,
        to: 10 // Limiter à 10 lignes pour l'analyse
      });

      if (records.length === 0) {
        return res.status(400).json({ message: 'Le CSV est vide ou ne peut pas être parsé' });
      }

      let columns = Object.keys(records[0]);
      let sampleRow = records[0];
      let recordsToUse = records;
      let usedPipeFallback = false;

      // Correctif : une seule colonne = délimiteur mal détecté. Réessayer avec | ou ;
      const singleCol = columns[0];
      if (columns.length === 1 && singleCol && singleCol.length > 3) {
        for (const tryDelim of ['|', ';']) {
          if (!singleCol.includes(tryDelim) || singleCol.split(tryDelim).length < 2) continue;
          const recordsAlt = parse(text, {
            columns: true,
            skip_empty_lines: true,
            bom: true,
            trim: true,
            delimiter: tryDelim,
            quote: '"',
            escape: '"',
            relax_quotes: true,
            relax_column_count: true,
            to: 10
          });
          if (recordsAlt.length > 0 && Object.keys(recordsAlt[0]).length >= 2) {
            recordsToUse = recordsAlt;
            columns = Object.keys(recordsAlt[0]);
            sampleRow = recordsAlt[0];
            usedPipeFallback = tryDelim === '|';
            break;
          }
        }
      }

      // Fonction pour détecter automatiquement le mapping basé sur la ressemblance des noms
      const detectMapping = (columns, sampleRow) => {
        const mapping = {};
        const columnLower = columns.map(c => c.toLowerCase().trim());
      
        // Ignorer les colonnes qui ressemblent à une ligne d'en-tête concaténée (ex. délimiteur mal détecté)
        const isInvalidColumn = (rawColumn) =>
          (rawColumn && rawColumn.length > 80) || (rawColumn && rawColumn.includes('|') && rawColumn.split('|').length > 2);
      
        // Fonction helper pour trouver la meilleure correspondance
        const findBestMatch = (patterns, excludeColumns = []) => {
          let bestMatch = null;
          let bestScore = 0;
        
          for (const pattern of patterns) {
            const patternLower = pattern.toLowerCase();
          
            // Chercher une correspondance exacte d'abord
            const exactIndex = columnLower.findIndex((col, idx) => {
              if (excludeColumns.includes(columns[idx]) || isInvalidColumn(columns[idx])) return false;
              return col === patternLower;
            });
            if (exactIndex !== -1) {
              return { column: columns[exactIndex], score: 100 };
            }
          
            // Chercher une correspondance partielle
            columnLower.forEach((col, idx) => {
              if (excludeColumns.includes(columns[idx]) || isInvalidColumn(columns[idx])) return;
            
              // Correspondance exacte dans le nom
              if (col === patternLower) {
                if (!bestMatch || bestScore < 100) {
                  bestMatch = columns[idx];
                  bestScore = 100;
                }
              }
              // Le pattern est contenu dans le nom de la colonne
              else if (col.includes(patternLower)) {
                const score = (patternLower.length / col.length) * 90;
                if (!bestMatch || score > bestScore) {
                  bestMatch = columns[idx];
                  bestScore = score;
                }
              }
              // Le nom de la colonne est contenu dans le pattern
              else if (patternLower.includes(col)) {
                const score = (col.length / patternLower.length) * 80;
                if (!bestMatch || score > bestScore) {
                  bestMatch = columns[idx];
                  bestScore = score;
                }
              }
              // Correspondance avec underscore/slash remplacés
              else {
                const normalizedCol = col.replace(/[_-]/g, '');
                const normalizedPattern = patternLower.replace(/[_-]/g, '');
                if (normalizedCol === normalizedPattern) {
                  const score = 85;
                  if (!bestMatch || score > bestScore) {
                    bestMatch = columns[idx];
                    bestScore = score;
                  }
                }
              }
            });
          }
        
          return bestMatch ? { column: bestMatch, score: bestScore } : null;
        };
      
        // Patterns de détection pour chaque champ (par ordre de priorité)
        const fieldPatterns = {
          // Champs de base (Requis)
          id: ['id', 'product_id', 'item_id', 'sku', 'reference', 'ref', 'code', 'product_code'],
          title: ['title', 'name', 'product_name', 'product_title', 'nom', 'titre', 'product', 'item_name'],
          description: ['description', 'desc', 'product_description', 'detail', 'details', 'product_detail', 'long_description'],
          link: ['link', 'url', 'product_url', 'product_link', 'lien', 'page_url', 'canonical_url'],
          image_link: ['image_link', 'image', 'image_url', 'imageurl', 'main_image', 'primary_image', 'photo', 'picture', 'img', 'image_1'],
          additional_image_link: ['additional_image', 'image_2', 'image_3', 'secondary_image', 'extra_image', 'gallery_image'],
          mobile_link: ['mobile_link', 'mobile_url', 'mobile', 'mobile_page'],
        
          // Prix et disponibilité
          price: ['price', 'prix', 'cost', 'amount', 'prix_ttc', 'price_ttc', 'regular_price', 'list_price', 'prix_public'],
          sale_price: ['sale_price', 'promo_price', 'discount_price', 'special_price', 'reduced_price', 'prix_promo', 'prix_solde', 'prix_soldé', 'prix_soldé_ttc', 'prix_remise'],
          sale_price_effective_date: ['sale_price_effective_date', 'promo_dates', 'sale_dates', 'discount_period'],
          availability: ['availability', 'stock_status', 'in_stock', 'available', 'stock', 'disponibilite', 'disponible', 'en_stock', 'availability_text', 'stock_disponible', 'stock_text'],
          availability_date: ['availability_date', 'stock_date', 'available_date', 'restock_date'],
          cost_of_goods_sold: ['cost_of_goods_sold', 'cogs', 'cost_price', 'wholesale_price', 'prix_achat'],
          expiration_date: ['expiration_date', 'expires', 'expiry_date', 'end_date'],
          inventory: ['inventory', 'stock', 'qty', 'quantity', 'stock_level', 'stock_qty', 'stock_quantity', 'inventaire'],
        
          // Catégorie produit
          google_product_category: ['google_product_category', 'google_category', 'gmc_category', 'category_id'],
          product_type: ['product_type', 'type', 'product_category', 'category', 'categorie'],
        
          // Identifiants produit
          brand: ['brand', 'marque', 'manufacturer', 'fabricant', 'vendor', 'maker'],
          gtin: ['gtin', 'barcode', 'ean', 'ean13', 'upc', 'code_barre', 'code-barres', 'barcode_number'],
          mpn: ['mpn', 'manufacturer_part_number', 'part_number', 'ref_fabricant', 'reference_fabricant', 'model_number'],
          identifier_exists: ['identifier_exists', 'has_identifier', 'has_gtin'],
          condition: ['condition', 'etat', 'state', 'item_condition', 'product_condition', 'product_state'],
        
          // Description détaillée
          color: ['color', 'couleur', 'colour', 'product_color'],
          size: ['size', 'taille', 'product_size'],
          material: ['material', 'materiau', 'matiere', 'fabric', 'composition'],
          pattern: ['pattern', 'motif', 'design_pattern'],
          gender: ['gender', 'genre', 'sex', 'target_gender', 'sexe'],
          age_group: ['age_group', 'age', 'age_range', 'groupe_age', 'tranche_age', 'age_target', 'age_cible'],
          size_type: ['size_type', 'size_category', 'size_class'],
          size_system: ['size_system', 'size_standard', 'sizing_system'],
          item_group_id: ['item_group_id', 'group_id', 'variant_group', 'product_group', 'parent_id'],
          multipack: ['multipack', 'pack_size', 'pack_quantity'],
          is_bundle: ['is_bundle', 'bundle', 'is_pack', 'product_bundle'],
          adult: ['adult', 'adult_content', 'is_adult'],
          energy_efficiency_class: ['energy_efficiency_class', 'energy_class', 'efficiency_class'],
          min_energy_efficiency_class: ['min_energy_efficiency_class', 'min_energy_class'],
          max_energy_efficiency_class: ['max_energy_efficiency_class', 'max_energy_class'],
        
          // Stock et expédition
          quantity: ['quantity', 'qty', 'stock', 'inventory', 'stock_quantity', 'available_quantity'],
          shipping: ['shipping', 'shipping_cost', 'delivery_cost', 'frais_livraison'],
          shipping_weight: ['shipping_weight', 'weight', 'poids', 'product_weight', 'weight_kg'],
          shipping_length: ['shipping_length', 'length', 'longueur', 'product_length'],
          shipping_width: ['shipping_width', 'width', 'largeur', 'product_width'],
          shipping_height: ['shipping_height', 'height', 'hauteur', 'product_height'],
          max_handling_time: ['max_handling_time', 'max_handling', 'handling_time_max'],
          min_handling_time: ['min_handling_time', 'min_handling', 'handling_time_min'],
          transit_time_label: ['transit_time_label', 'transit_time', 'delivery_time'],
        
          // Taxes et promotions
          tax: ['tax', 'tax_rate', 'vat', 'tva', 'tax_amount'],
          tax_category: ['tax_category', 'tax_class', 'vat_category'],
          promotion_id: ['promotion_id', 'promo_id', 'discount_id', 'coupon_id'],
        
          // Programme de fidélité
          loyalty_program: ['loyalty_program', 'loyalty', 'fidelity_program', 'programme_fidelite'],
          loyalty_program_program_label: ['program_label', 'loyalty_program_label', 'program_name', 'loyalty_name'],
          loyalty_program_tier_label: ['tier_label', 'loyalty_tier', 'membership_tier', 'tier_name', 'level'],
          loyalty_program_price: ['member_price', 'loyalty_price', 'member_pricing', 'loyalty_pricing', 'price_member'],
          loyalty_program_loyalty_points: ['loyalty_points', 'points', 'reward_points', 'fidelity_points', 'points_fidelite'],
          loyalty_program_member_price_effective_date: ['member_price_effective_date', 'member_price_dates', 'loyalty_price_dates', 'member_promo_dates'],
          loyalty_program_shipping_label: ['member_shipping_label', 'loyalty_shipping_label', 'member_shipping', 'loyalty_shipping'],
          loyalty_program_cashback_for_future_use: ['cashback_for_future_use', 'cashback', 'future_cashback'],
        
          // Labels personnalisés
          custom_label_0: ['custom_label_0', 'label_0', 'custom_0', 'tag_0'],
          custom_label_1: ['custom_label_1', 'label_1', 'custom_1', 'tag_1'],
          custom_label_2: ['custom_label_2', 'label_2', 'custom_2', 'tag_2'],
          custom_label_3: ['custom_label_3', 'label_3', 'custom_3', 'tag_3'],
          custom_label_4: ['custom_label_4', 'label_4', 'custom_4', 'tag_4']
        };

        // Détecter chaque champ en évitant les doublons
        const usedColumns = [];
      
        Object.keys(fieldPatterns).forEach(field => {
          const match = findBestMatch(fieldPatterns[field], usedColumns);
          if (match && match.score > 50) { // Seuil minimum de confiance
            mapping[field] = match.column;
            usedColumns.push(match.column);
          }
        });

        return mapping;
      };

      const suggestedMapping = detectMapping(columns, sampleRow);

      // Préparer un échantillon de données mappées pour prévisualisation
      const preview = recordsToUse.slice(0, 3).map(row => {
        const mapped = {};
        Object.keys(suggestedMapping).forEach(targetField => {
          const sourceColumn = suggestedMapping[targetField];
          mapped[targetField] = row[sourceColumn] || null;
        });
        return mapped;
      });

      res.json({
        columns: columns,
        sampleRow: sampleRow,
        suggestedMapping: suggestedMapping,
        preview: preview,
        totalRows: recordsToUse.length,
        delimiter: usedPipeFallback ? 'PIPE' : (delimiter === '\t' ? 'TSV' : 'CSV')
      });
    } catch (e) {
      console.error('Analyze CSV error:', e);
      res.status(500).json({ message: 'Erreur lors de l\'analyse du CSV: ' + e.message });
    }
  });

  app.get('/api/v1/ingestion/items/:id/enrichment-analysis', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
      const accountId = req.accountId;

      // Récupérer l'item (support UUID, MPN ou SKU) — avec isolation multi-tenant
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
    
      // Parser customfields
      let customFields = {};
      if (item.customfields) {
        try {
          customFields = typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields;
        } catch (e) {
          console.warn('Erreur parsing customfields:', e.message);
        }
      }

      // Analyser le produit
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

  app.post('/api/v1/ingestion/items/:id/enrich', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const { applyEnrichments = true, useAI = false, fields: requestedFields } = req.body || {};
    
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
      const accountId = req.accountId;

      // Récupérer l'item — avec isolation multi-tenant
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
    
      // Parser customfields
      let customFields = {};
      if (item.customfields) {
        try {
          customFields = typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields;
        } catch (e) {
          console.warn('Erreur parsing customfields:', e.message);
        }
      }

      // Analyser et enrichir le produit (avec ou sans IA)
      const itemWithCustomFields = { ...item, customFields };
      const analysis = useAI 
        ? await analyzeProductWithAI(prisma, itemWithCustomFields, true)
        : analyzeProduct(itemWithCustomFields);

      let enrichmentsToApply = analysis.enrichments;
      if (requestedFields && Array.isArray(requestedFields) && requestedFields.length > 0) {
        enrichmentsToApply = {};
        requestedFields.forEach((key) => {
          if (analysis.enrichments[key] !== undefined) enrichmentsToApply[key] = analysis.enrichments[key];
        });
      }

      if (applyEnrichments && Object.keys(enrichmentsToApply).length > 0) {
        // Enrichir le produit
        const enriched = enrichProduct(itemWithCustomFields, enrichmentsToApply);
      
        // Mettre à jour dans la base de données
        const now = new Date().toISOString();
        const updatedCustomFields = JSON.stringify(enriched.customFields);
      
        await prisma.$executeRawUnsafe(`
          UPDATE "FeedItem" 
          SET customfields = $1::jsonb, updatedat = $2::timestamptz
          WHERE id = $3::text
        `, updatedCustomFields, now, item.id);

        // Enregistrer l'historique
        const historyId = require('crypto').randomUUID();
        const aiFields = analysis.aiEnrichments ? Object.keys(analysis.aiEnrichments) : [];
        const method = useAI && aiFields.length > 0 ? 'ai' : (useAI ? 'manual' : 'automatic');
      
        try {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "EnrichmentHistory" (id, "itemId", "feedId", "enrichedFields", alerts, method, "aiProvider", "aiModel", "createdAt")
            VALUES ($1::text, $2::text, $3::text, $4::jsonb, $5::jsonb, $6::text, $7::text, $8::text, $9::timestamptz)
          `, 
            historyId, item.id, item.feedid || null,
            JSON.stringify(enrichmentsToApply),
            JSON.stringify(analysis.alerts || []),
            method,
            useAI && aiFields.length > 0 ? 'gemini' : null,
            useAI && aiFields.length > 0 ? 'gemini-pro' : null,
            now
          );
        } catch (historyError) {
          console.warn('Erreur enregistrement historique (table peut ne pas exister):', historyError.message);
        }

        res.json({
          message: 'Produit enrichi avec succès',
          itemId: item.id,
          enrichments: enrichmentsToApply,
          alerts: analysis.alerts,
          enrichedFields: Object.keys(enrichmentsToApply),
          method,
          aiEnrichments: analysis.aiEnrichments || null
        });
      } else {
        res.json({
          message: 'Analyse effectuée (enrichissements non appliqués)',
          itemId: item.id,
          enrichments: analysis.enrichments,
          alerts: analysis.alerts,
          method: useAI ? 'ai' : 'rules'
        });
      }
    } catch (e) {
      console.error('Erreur enrichissement:', e);
      res.status(500).json({ message: 'Erreur enrichissement', error: e.message });
    }
  });

  app.post('/api/v1/ingestion/feeds/:id/enrich-all', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const { limit = 1000 } = req.body || {};
    
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      // Récupérer les items du feed
      const items = await prisma.$queryRawUnsafe(`
        SELECT * FROM "FeedItem"
        WHERE "feedid" = $1::text
        LIMIT $2::int
      `, id, limit);

      if (!items || items.length === 0) {
        return res.json({
          message: 'Aucun produit trouvé',
          enriched: 0,
          alerts: []
        });
      }

      let enrichedCount = 0;
      const allAlerts = [];
      const now = new Date().toISOString();
      const toUpdate = [];

      for (const item of items) {
        // Parser customfields
        let customFields = {};
        if (item.customfields) {
          try {
            customFields = typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields;
          } catch (e) {
            continue;
          }
        }

        // Analyser et enrichir
        const itemWithCustomFields = { ...item, customFields };
        const analysis = analyzeProduct(itemWithCustomFields);

        if (Object.keys(analysis.enrichments).length > 0) {
          const enriched = enrichProduct(itemWithCustomFields, analysis.enrichments);
          toUpdate.push({ id: item.id, customfields: JSON.stringify(enriched.customFields) });
          enrichedCount++;
        }

        // Collecter les alertes
        allAlerts.push(...analysis.alerts.map(alert => ({
          itemId: item.id,
          originId: item.originid,
          ...alert
        })));
      }

      const ENRICH_BATCH = 100;
      for (let b = 0; b < toUpdate.length; b += ENRICH_BATCH) {
        const batch = toUpdate.slice(b, b + ENRICH_BATCH);
        const params = [];
        const valueRows = batch.map((row, i) => {
          params.push(row.id, row.customfields, now);
          const base = i * 3;
          return `($${base + 1}::text, $${base + 2}::jsonb, $${base + 3}::timestamptz)`;
        });
        const sql = `UPDATE "FeedItem" f SET customfields = v.customfields, "updatedat" = v.updatedat FROM (VALUES ${valueRows.join(', ')}) AS v(id, customfields, updatedat) WHERE f.id = v.id`;
        await prisma.$executeRawUnsafe(sql, ...params);
      }

      res.json({
        message: `Enrichissement terminé`,
        totalItems: items.length,
        enriched: enrichedCount,
        alertsCount: allAlerts.length,
        alerts: allAlerts.slice(0, 100) // Limiter à 100 alertes pour la réponse
      });
    } catch (e) {
      console.error('Erreur enrichissement en masse:', e);
      res.status(500).json({ message: 'Erreur enrichissement en masse', error: e.message });
    }
  });

  app.post('/api/v1/ingestion/feeds/:id/enrich-all-advanced', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const { limit = 1000, useAI = false, progressCallback } = req.body || {};
    
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }

      // Récupérer les items du feed
      const items = await prisma.$queryRawUnsafe(`
        SELECT * FROM "FeedItem"
        WHERE "feedid" = $1::text
        LIMIT $2::int
      `, id, limit);

      if (!items || items.length === 0) {
        return res.json({
          message: 'Aucun produit trouvé',
          enriched: 0,
          alerts: [],
          stats: {
            totalItems: 0,
            enrichedItems: 0,
            fieldsEnriched: 0,
            aiEnrichments: 0,
            rulesEnrichments: 0
          }
        });
      }

      let enrichedCount = 0;
      let fieldsEnrichedCount = 0;
      let aiEnrichmentsCount = 0;
      let rulesEnrichmentsCount = 0;
      const allAlerts = [];
      const now = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];
      const toUpdate = [];
      const historyRows = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
      
        // Parser customfields
        let customFields = {};
        if (item.customfields) {
          try {
            customFields = typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields;
          } catch (e) {
            continue;
          }
        }

        // Analyser et enrichir (avec ou sans IA)
        const itemWithCustomFields = { ...item, customFields };
        const analysis = useAI 
          ? await analyzeProductWithAI(prisma, itemWithCustomFields, true)
          : analyzeProduct(itemWithCustomFields);

        if (Object.keys(analysis.enrichments).length > 0) {
          const enriched = enrichProduct(itemWithCustomFields, analysis.enrichments);
        
          // Compter les enrichissements IA vs règles
          const aiFields = analysis.aiEnrichments ? Object.keys(analysis.aiEnrichments) : [];
          if (aiFields.length > 0) {
            aiEnrichmentsCount++;
          } else {
            rulesEnrichmentsCount++;
          }
        
          toUpdate.push({ id: item.id, customfields: JSON.stringify(enriched.customFields) });
          historyRows.push({
            id: require('crypto').randomUUID(),
            itemId: item.id,
            enrichments: JSON.stringify(analysis.enrichments),
            alerts: JSON.stringify(analysis.alerts || []),
            method: useAI && aiFields.length > 0 ? 'ai' : 'rules',
            aiProvider: useAI && aiFields.length > 0 ? 'gemini' : null,
            aiModel: useAI && aiFields.length > 0 ? 'gemini-pro' : null
          });

          enrichedCount++;
          fieldsEnrichedCount += Object.keys(analysis.enrichments).length;
        }

        // Collecter les alertes
        allAlerts.push(...(analysis.alerts || []).map(alert => ({
          itemId: item.id,
          originId: item.originid,
          ...alert
        })));
      }

      const ENRICH_BATCH = 100;
      for (let b = 0; b < toUpdate.length; b += ENRICH_BATCH) {
        const batch = toUpdate.slice(b, b + ENRICH_BATCH);
        const params = [];
        const valueRows = batch.map((row, i) => {
          params.push(row.id, row.customfields, now);
          const base = i * 3;
          return `($${base + 1}::text, $${base + 2}::jsonb, $${base + 3}::timestamptz)`;
        });
        const sql = `UPDATE "FeedItem" f SET customfields = v.customfields, updatedat = v.updatedat FROM (VALUES ${valueRows.join(', ')}) AS v(id, customfields, updatedat) WHERE f.id = v.id`;
        await prisma.$executeRawUnsafe(sql, ...params);
      }

      for (let h = 0; h < historyRows.length; h += ENRICH_BATCH) {
        const batch = historyRows.slice(h, h + ENRICH_BATCH);
        await insertEnrichmentHistoryBatchSafe(prisma, batch, id, now);
      }

      // Mettre à jour les statistiques
      await upsertEnrichmentStatsSafe(prisma, {
        feedId: id,
        totalItems: items.length,
        enrichedItems: enrichedCount,
        fieldsEnriched: fieldsEnrichedCount,
        alertsGenerated: allAlerts.length,
        aiEnrichments: aiEnrichmentsCount,
        rulesEnrichments: rulesEnrichmentsCount,
        now,
        date: today,
      });

      res.json({
        message: `Enrichissement terminé`,
        totalItems: items.length,
        enriched: enrichedCount,
        fieldsEnriched: fieldsEnrichedCount,
        alertsCount: allAlerts.length,
        stats: {
          totalItems: items.length,
          enrichedItems: enrichedCount,
          fieldsEnriched: fieldsEnrichedCount,
          aiEnrichments: aiEnrichmentsCount,
          rulesEnrichments: rulesEnrichmentsCount,
          alertsGenerated: allAlerts.length
        },
        alerts: allAlerts.slice(0, 100)
      });
    } catch (e) {
      console.error('Erreur enrichissement en masse avancé:', e);
      res.status(500).json({ message: 'Erreur enrichissement en masse', error: e.message });
    }
  });

  app.get('/api/v1/ingestion/feeds/:id/enrichment-stats', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    const { id } = req.params;
    const daysNum = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    const startDateStr = startDate.toISOString().split('T')[0];
    const emptyPayload = () => ({
      feedId: id,
      period: { days: daysNum, startDate: startDateStr },
      totals: { totalItems: 0, enrichedItems: 0, fieldsEnriched: 0, alertsGenerated: 0, aiEnrichments: 0, rulesEnrichments: 0 },
      completionRate: 0,
      dailyStats: [],
      averages: { fieldsPerItem: 0, aiUsageRate: 0 }
    });

    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }

    try {
      const stats = await prisma.$queryRawUnsafe(`
        SELECT * FROM "EnrichmentStats"
        WHERE "feedId" = $1::text AND date >= $2::date
        ORDER BY date DESC
      `, id, startDateStr);

      const totals = (stats || []).reduce((acc, stat) => ({
        totalItems: acc.totalItems + (stat.totalItems || 0),
        enrichedItems: acc.enrichedItems + (stat.enrichedItems || 0),
        fieldsEnriched: acc.fieldsEnriched + (stat.fieldsEnriched || 0),
        alertsGenerated: acc.alertsGenerated + (stat.alertsGenerated || 0),
        aiEnrichments: acc.aiEnrichments + (stat.aiEnrichments || 0),
        rulesEnrichments: acc.rulesEnrichments + (stat.rulesEnrichments || 0)
      }), {
        totalItems: 0,
        enrichedItems: 0,
        fieldsEnriched: 0,
        alertsGenerated: 0,
        aiEnrichments: 0,
        rulesEnrichments: 0
      });

      const completionRate = totals.totalItems > 0
        ? Math.round((totals.enrichedItems / totals.totalItems) * 100)
        : 0;

      return res.json({
        feedId: id,
        period: { days: daysNum, startDate: startDateStr },
        totals,
        completionRate,
        dailyStats: stats || [],
        averages: {
          fieldsPerItem: totals.enrichedItems > 0 ? Math.round(totals.fieldsEnriched / totals.enrichedItems * 10) / 10 : 0,
          aiUsageRate: totals.enrichedItems > 0 ? Math.round((totals.aiEnrichments / totals.enrichedItems) * 100) : 0
        }
      });
    } catch (e) {
      console.warn('EnrichmentStats non disponible (table absente ou erreur):', e.message);
      return res.json(emptyPayload());
    }
  });

  app.get('/api/v1/ingestion/feeds/:id/catalogue-summary', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      if (!(await ensurePrismaReady()) || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
      if (!(await verifyFeedAccess(id, req.accountId))) {
        return res.status(403).json({ message: 'Accès refusé à ce flux' });
      }
      const categoryExpr = `COALESCE(
        NULLIF(BTRIM(customfields->>'product_type'), ''),
        NULLIF(BTRIM(customfields->>'google_product_category'), ''),
        NULLIF(BTRIM(customfields->>'category'), '')
      )`;
      const googleEnabledExpr = `(customfields->'_channelOverrides'->>'google' IS NULL OR customfields->'_channelOverrides'->>'google' != 'false')`;
      const optimizedExpr = `(
        (customfields->>'optimized_title' IS NOT NULL AND BTRIM(customfields->>'optimized_title') <> '')
        OR (customfields->>'optimized_description' IS NOT NULL AND BTRIM(customfields->>'optimized_description') <> '')
        OR (customfields->'optimized'->'gmc'->>'title' IS NOT NULL AND BTRIM(customfields->'optimized'->'gmc'->>'title') <> '')
        OR (customfields->'optimized'->'gmc'->>'description' IS NOT NULL AND BTRIM(customfields->'optimized'->'gmc'->>'description') <> '')
        OR (jsonb_typeof(customfields->'optimized'->'gmc'->'highlights') = 'array' AND jsonb_array_length(customfields->'optimized'->'gmc'->'highlights') > 0)
        OR (customfields->'optimized'->'meta'->>'title' IS NOT NULL AND BTRIM(customfields->'optimized'->'meta'->>'title') <> '')
        OR (customfields->'optimized'->'meta'->>'description' IS NOT NULL AND BTRIM(customfields->'optimized'->'meta'->>'description') <> '')
        OR (jsonb_typeof(customfields->'optimized'->'meta'->'highlights') = 'array' AND jsonb_array_length(customfields->'optimized'->'meta'->'highlights') > 0)
        OR (customfields->'optimized'->'amazon'->>'title' IS NOT NULL AND BTRIM(customfields->'optimized'->'amazon'->>'title') <> '')
        OR (customfields->'optimized'->'amazon'->>'description' IS NOT NULL AND BTRIM(customfields->'optimized'->'amazon'->>'description') <> '')
        OR (jsonb_typeof(customfields->'optimized'->'amazon'->'highlights') = 'array' AND jsonb_array_length(customfields->'optimized'->'amazon'->'highlights') > 0)
        OR (customfields->'optimized'->'chatgpt'->>'title' IS NOT NULL AND BTRIM(customfields->'optimized'->'chatgpt'->>'title') <> '')
        OR (customfields->'optimized'->'chatgpt'->>'description' IS NOT NULL AND BTRIM(customfields->'optimized'->'chatgpt'->>'description') <> '')
        OR (jsonb_typeof(customfields->'optimized'->'chatgpt'->'highlights') = 'array' AND jsonb_array_length(customfields->'optimized'->'chatgpt'->'highlights') > 0)
      )`;
      const missingCoreExpr = `(
        (title IS NULL OR BTRIM(title) = '')
        OR imageurl IS NULL
        OR brand IS NULL OR BTRIM(brand) = ''
        OR ${categoryExpr} IS NULL
      )`;

      const rows = await prisma.$queryRawUnsafe(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE ${missingCoreExpr}
          )::int AS to_fix,
          COUNT(*) FILTER (
            WHERE NOT ${optimizedExpr}
          )::int AS to_optimize,
          COUNT(*) FILTER (
            WHERE ${googleEnabledExpr}
              AND NOT ${missingCoreExpr}
          )::int AS ready_to_publish,
          COUNT(*) FILTER (
            WHERE NOT ${googleEnabledExpr}
          )::int AS not_published,
          COUNT(*) FILTER (WHERE ${categoryExpr} IS NULL)::int AS missing_category,
          COUNT(*) FILTER (WHERE brand IS NULL OR BTRIM(brand) = '')::int AS missing_brand,
          COUNT(*) FILTER (WHERE imageurl IS NULL)::int AS missing_image,
          COUNT(*) FILTER (WHERE imageurl IS NOT NULL)::int AS with_image,
          COUNT(*) FILTER (
            WHERE ${googleEnabledExpr}
          )::int AS published
        FROM "FeedItem"
        WHERE feedid = $1::text
      `, id);

      const summary = rows?.[0] || {};
      return res.json({
        feedId: id,
        total: Number(summary.total || 0),
        toFix: Number(summary.to_fix || 0),
        toOptimize: Number(summary.to_optimize || 0),
        readyToPublish: Number(summary.ready_to_publish || 0),
        notPublished: Number(summary.not_published || 0),
        missingCategory: Number(summary.missing_category || 0),
        missingBrand: Number(summary.missing_brand || 0),
        missingImage: Number(summary.missing_image || 0),
        withImage: Number(summary.with_image || 0),
        published: Number(summary.published || 0),
      });
    } catch (e) {
      console.error('Catalogue summary error:', e);
      res.status(500).json({ message: 'Erreur resume catalogue', error: e.message });
    }
  });

  app.get('/api/v1/ingestion/feeds/:id/audit', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      if (!(await ensurePrismaReady()) || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
      if (!(await verifyFeedAccess(id, req.accountId))) {
        return res.status(403).json({ message: 'Acces refuse a ce flux' });
      }

      const categoryExpr = `COALESCE(
        NULLIF(BTRIM(customfields->>'product_type'), ''),
        NULLIF(BTRIM(customfields->>'google_product_category'), ''),
        NULLIF(BTRIM(customfields->>'category'), '')
      )`;
      const identifierExpr = `COALESCE(NULLIF(BTRIM(gtin), ''), NULLIF(BTRIM(mpn), ''), NULLIF(BTRIM(sku), ''))`;
      const readyExpr = `(
        title IS NOT NULL AND BTRIM(title) <> ''
        AND (descriptiontext IS NOT NULL AND BTRIM(descriptiontext) <> '' OR descriptionhtml IS NOT NULL AND BTRIM(descriptionhtml) <> '')
        AND imageurl IS NOT NULL
        AND price IS NOT NULL
        AND url IS NOT NULL AND BTRIM(url) <> ''
        AND (brand IS NOT NULL AND BTRIM(brand) <> '')
        AND ${categoryExpr} IS NOT NULL
        AND ${identifierExpr} IS NOT NULL
      )`;
      const blockingExpr = `(
        title IS NULL OR BTRIM(title) = ''
        OR imageurl IS NULL
        OR price IS NULL
        OR url IS NULL OR BTRIM(url) = ''
        OR brand IS NULL OR BTRIM(brand) = ''
        OR ${categoryExpr} IS NULL
      )`;

      const [summaryRows, sampleItems] = await Promise.all([
        prisma.$queryRawUnsafe(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE title IS NULL OR BTRIM(title) = '')::int AS missing_title,
            COUNT(*) FILTER (
              WHERE (descriptiontext IS NULL OR BTRIM(descriptiontext) = '')
                AND (descriptionhtml IS NULL OR BTRIM(descriptionhtml) = '')
            )::int AS missing_description,
            COUNT(*) FILTER (WHERE imageurl IS NULL)::int AS missing_image,
            COUNT(*) FILTER (WHERE brand IS NULL OR BTRIM(brand) = '')::int AS missing_brand,
            COUNT(*) FILTER (WHERE ${categoryExpr} IS NULL)::int AS missing_category,
            COUNT(*) FILTER (WHERE ${identifierExpr} IS NULL)::int AS missing_identifier,
            COUNT(*) FILTER (WHERE price IS NULL)::int AS missing_price,
            COUNT(*) FILTER (WHERE url IS NULL OR BTRIM(url) = '')::int AS missing_link,
            COUNT(*) FILTER (WHERE availability IS NULL OR BTRIM(availability) = '')::int AS missing_availability,
            COUNT(*) FILTER (WHERE ${readyExpr})::int AS ready_for_channels,
            COUNT(*) FILTER (WHERE ${blockingExpr})::int AS blocking_core
          FROM "FeedItem"
          WHERE feedid = $1::text
        `, id),
        prisma.$queryRawUnsafe(`
          SELECT *
          FROM "FeedItem"
          WHERE feedid = $1::text
          ORDER BY updatedat DESC NULLS LAST, createdat DESC NULLS LAST
          LIMIT 250
        `, id),
      ]);

      const scoredItems = (sampleItems || []).map((item) => {
        let customFields = {};
        if (item.customfields) {
          try {
            customFields = typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields;
          } catch {
            customFields = {};
          }
        }
        const normalizedItem = {
          ...item,
          descriptionText: item.descriptiontext || item.descriptionText,
          descriptionHtml: item.descriptionhtml || item.descriptionHtml,
          imageUrl: item.imageurl || item.imageUrl,
          price: item.price !== null && item.price !== undefined ? Number(item.price) : null,
          url: item.url || item.link,
          customFields,
        };
        return calculateAdvancedQualityScore(normalizedItem, customFields);
      });

      const aggregate = calculateFeedAuditSummary(summaryRows?.[0] || {}, scoredItems);
      return res.json({
        feedId: id,
        generatedAt: new Date().toISOString(),
        summary: aggregate.metrics,
        score: aggregate.score,
        potentialScore: aggregate.potentialScore,
        estimatedAdditionalApprovedProducts: aggregate.estimatedAdditionalApprovedProducts,
        estimatedVisibilityLiftPct: aggregate.estimatedVisibilityLiftPct,
        scoreBreakdown: aggregate.scoreBreakdown,
        topIssues: aggregate.topIssues,
        methodology: aggregate.methodology,
      });
    } catch (e) {
      console.error('Feed audit error:', e);
      res.status(500).json({ message: 'Erreur audit flux', error: e.message });
    }
  });

  app.get('/api/v1/ingestion/items/:id/enrichment-history', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
    
      if (!prismaReady || !prisma) {
        return res.status(503).json({ message: 'Prisma non disponible' });
      }
      const accountId = req.accountId;
      const itemId = await resolveItemId(prisma, id, accountId);
      if (!itemId) return res.status(404).json({ message: 'Item non trouvé' });
      if (!(await verifyItemAccess(itemId, accountId))) return res.status(403).json({ message: 'Accès refusé' });

      const history = await prisma.$queryRawUnsafe(`
        SELECT * FROM "EnrichmentHistory"
        WHERE "itemId" = $1::text
        ORDER BY "createdAt" DESC
        LIMIT 50
      `, itemId);

      res.json({
        itemId,
        history: history.map(h => ({
          id: h.id,
          enrichedFields: h.enrichedFields,
          alerts: h.alerts,
          method: h.method,
          aiProvider: h.aiProvider,
          aiModel: h.aiModel,
          createdAt: h.createdAt
        }))
      });
    } catch (e) {
      console.error('Erreur récupération historique:', e);
      res.status(500).json({ message: 'Erreur récupération historique', error: e.message });
    }
  });

  app.get('/api/v1/ingestion/items/:id/revisions', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      const accountId = req.accountId;
      const itemId = await resolveItemId(prisma, id, accountId);
      if (!itemId) return res.status(404).json({ message: 'Item non trouvé' });
      if (!await verifyItemAccess(itemId, accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const revisions = await listRevisions(prisma, itemId, 50);
      return res.json({ itemId, revisions });
    } catch (e) {
      console.error('Erreur liste révisions:', e);
      return res.status(500).json({ message: 'Erreur liste révisions', error: e.message });
    }
  });

  app.post('/api/v1/ingestion/items/:id/restore', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const { revisionId } = req.body || {};
      if (!revisionId) return res.status(400).json({ message: 'revisionId requis' });
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      const accountId = req.accountId;
      const itemId = await resolveItemId(prisma, id, accountId);
      if (!itemId) return res.status(404).json({ message: 'Item non trouvé' });
      if (!await verifyItemAccess(itemId, accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const rev = await getRevisionById(prisma, revisionId, itemId);
      if (!rev) return res.status(404).json({ message: 'Révision non trouvée' });
      const snap = rev.snapshotjson || rev.snapshotJson || {};
      const customfields = snap.customfields != null ? snap.customfields : {};
      const updates = [];
      const params = [];
      let idx = 1;
      if (snap.title !== undefined) { updates.push(`title = $${idx++}`); params.push(snap.title); }
      if (snap.descriptionhtml !== undefined) { updates.push(`descriptionhtml = $${idx++}`); params.push(snap.descriptionhtml); }
      if (snap.descriptiontext !== undefined) { updates.push(`descriptiontext = $${idx++}`); params.push(snap.descriptiontext); }
      if (snap.imageurl !== undefined) { updates.push(`imageurl = $${idx++}`); params.push(snap.imageurl); }
      if (snap.brand !== undefined) { updates.push(`brand = $${idx++}`); params.push(snap.brand); }
      if (snap.sku !== undefined) { updates.push(`sku = $${idx++}`); params.push(snap.sku); }
      if (snap.price !== undefined) { updates.push(`price = $${idx++}`); params.push(Number(snap.price)); }
      if (snap.currency !== undefined) { updates.push(`currency = $${idx++}`); params.push(snap.currency); }
      if (snap.inventory !== undefined) { updates.push(`inventory = $${idx++}`); params.push(snap.inventory); }
      if (snap.url !== undefined) { updates.push(`url = $${idx++}`); params.push(snap.url); }
      if (snap.gtin !== undefined) { updates.push(`gtin = $${idx++}`); params.push(snap.gtin); }
      if (snap.mpn !== undefined) { updates.push(`mpn = $${idx++}`); params.push(snap.mpn); }
      if (snap.condition !== undefined) { updates.push(`condition = $${idx++}`); params.push(snap.condition); }
      updates.push(`updatedat = NOW()`);
      if (Object.keys(customfields).length > 0) {
        updates.push(`customfields = $${idx++}::jsonb`);
        params.push(JSON.stringify(customfields));
      }
      params.push(itemId);
      await prisma.$executeRawUnsafe(
        `UPDATE "FeedItem" SET ${updates.join(', ')} WHERE id = $${idx}::text`,
        ...params
      );
      await createRevision(prisma, itemId, snap, 'restore');
      return res.json({ message: 'Restauré', itemId, revisionId });
    } catch (e) {
      console.error('Erreur restore:', e);
      return res.status(500).json({ message: 'Erreur restauration', error: e.message });
    }
  });

  app.post('/api/v1/ingestion/items/:id/revert-to-feed', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      const accountId = req.accountId;
      const itemId = await resolveItemId(prisma, id, accountId);
      if (!itemId) return res.status(404).json({ message: 'Item non trouvé' });
      if (!await verifyItemAccess(itemId, accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const rev = await getLastIngestionRevision(prisma, itemId);
      if (!rev) return res.status(404).json({ message: 'Aucune révision ingestion trouvée pour cet item. Relancez une synchro du flux pour en créer une.' });
      const snap = rev.snapshotjson || rev.snapshotJson || {};
      const customfields = snap.customfields != null ? snap.customfields : {};
      const updates = [];
      const params = [];
      let idx = 1;
      if (snap.title !== undefined) { updates.push(`title = $${idx++}`); params.push(snap.title); }
      if (snap.descriptionhtml !== undefined) { updates.push(`descriptionhtml = $${idx++}`); params.push(snap.descriptionhtml); }
      if (snap.descriptiontext !== undefined) { updates.push(`descriptiontext = $${idx++}`); params.push(snap.descriptiontext); }
      if (snap.imageurl !== undefined) { updates.push(`imageurl = $${idx++}`); params.push(snap.imageurl); }
      if (snap.brand !== undefined) { updates.push(`brand = $${idx++}`); params.push(snap.brand); }
      if (snap.sku !== undefined) { updates.push(`sku = $${idx++}`); params.push(snap.sku); }
      if (snap.price !== undefined) { updates.push(`price = $${idx++}`); params.push(Number(snap.price)); }
      if (snap.currency !== undefined) { updates.push(`currency = $${idx++}`); params.push(snap.currency); }
      if (snap.inventory !== undefined) { updates.push(`inventory = $${idx++}`); params.push(snap.inventory); }
      if (snap.url !== undefined) { updates.push(`url = $${idx++}`); params.push(snap.url); }
      if (snap.gtin !== undefined) { updates.push(`gtin = $${idx++}`); params.push(snap.gtin); }
      if (snap.mpn !== undefined) { updates.push(`mpn = $${idx++}`); params.push(snap.mpn); }
      if (snap.condition !== undefined) { updates.push(`condition = $${idx++}`); params.push(snap.condition); }
      updates.push(`updatedat = NOW()`);
      updates.push(`customfields = $${idx++}::jsonb`);
      params.push(JSON.stringify(customfields));
      params.push(itemId);
      await prisma.$executeRawUnsafe(
        `UPDATE "FeedItem" SET ${updates.join(', ')} WHERE id = $${idx}::text`,
        ...params
      );
      await createRevision(prisma, itemId, snap, 'restore');
      return res.json({ message: 'Retour au flux effectué', itemId });
    } catch (e) {
      console.error('Erreur revert-to-feed:', e);
      return res.status(500).json({ message: 'Erreur retour au flux', error: e.message });
    }
  });

  app.put('/api/v1/ingestion/items/:id', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const body = req.body || {};
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      const accountId = req.accountId;
      const itemId = await resolveItemId(prisma, id, accountId);
      if (!itemId) return res.status(404).json({ message: 'Item non trouvé' });
      if (!await verifyItemAccess(itemId, accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const current = await prisma.$queryRawUnsafe(`
        SELECT id, feedid, originid, url, title, descriptionhtml, descriptiontext, imageurl, brand, sku, price, currency, inventory, gtin, mpn, condition, customfields, updatedat
        FROM "FeedItem" WHERE id = $1::text
      `, itemId);
      if (!current || !current[0]) return res.status(404).json({ message: 'Item non trouvé' });
      const row = current[0];
      const snapshot = buildItemSnapshot(row);
      await createRevision(prisma, itemId, snapshot, 'manual');
      const allowed = ['title', 'descriptionHtml', 'descriptionText', 'imageUrl', 'brand', 'sku', 'price', 'currency', 'inventory', 'url', 'gtin', 'mpn', 'condition', 'customfields'];
      const updates = [];
      const params = [];
      let idx = 1;
      const set = (col, val) => {
        if (val === undefined) return;
        updates.push(`${col} = $${idx++}`);
        params.push(val === null ? null : val);
      };
      if (body.title !== undefined) set('title', body.title);
      if (body.descriptionHtml !== undefined) set('descriptionhtml', body.descriptionHtml);
      if (body.descriptionText !== undefined) set('descriptiontext', body.descriptionText);
      if (body.imageUrl !== undefined) set('imageurl', body.imageUrl);
      if (body.brand !== undefined) set('brand', body.brand);
      if (body.sku !== undefined) set('sku', body.sku);
      if (body.price !== undefined) {
        const p = body.price == null ? null : Number(String(body.price).replace(',', '.'));
        set('price', p != null && !Number.isNaN(p) ? p : null);
      }
      if (body.currency !== undefined) set('currency', body.currency);
      if (body.inventory !== undefined) {
        const inv = body.inventory == null ? null : parseInt(String(body.inventory).replace(/\s/g, ''), 10);
        set('inventory', inv != null && !Number.isNaN(inv) ? inv : null);
      }
      if (body.url !== undefined) set('url', body.url);
      if (body.gtin !== undefined) set('gtin', body.gtin);
      if (body.mpn !== undefined) set('mpn', body.mpn);
      if (body.condition !== undefined) set('condition', body.condition);
      // customfields : base = body envoyé ou actuel ; puis merger catégorie Google, type produit, disponibilité si présents dans body
      let currentCf = row.customfields;
      try {
        currentCf = typeof currentCf === 'string' ? JSON.parse(currentCf) : (currentCf || {});
      } catch (e) {
        currentCf = {};
      }
      let baseCf = (body.customfields !== undefined && typeof body.customfields === 'object') ? body.customfields
        : (body.customFields !== undefined && typeof body.customFields === 'object') ? body.customFields
        : null;
      const hasCfFields = body.google_product_category !== undefined || body.googleProductCategory !== undefined || body.product_type !== undefined || body.productType !== undefined || body.availability !== undefined;
      if (baseCf !== null || hasCfFields) {
        let finalCf = baseCf !== null ? { ...baseCf } : { ...currentCf };
        if (body.google_product_category !== undefined || body.googleProductCategory !== undefined) {
          finalCf = { ...finalCf, google_product_category: body.google_product_category ?? body.googleProductCategory };
        }
        if (body.product_type !== undefined || body.productType !== undefined) {
          finalCf = { ...finalCf, product_type: body.product_type ?? body.productType };
        }
        if (body.availability !== undefined) {
          finalCf = { ...finalCf, availability: body.availability };
        }
        updates.push(`customfields = $${idx++}::jsonb`);
        params.push(JSON.stringify(finalCf));
      }
      if (updates.length === 0) return res.json({ message: 'Aucune modification', itemId });
      updates.push('updatedat = NOW()');
      params.push(itemId);
      await prisma.$executeRawUnsafe(
        `UPDATE "FeedItem" SET ${updates.join(', ')} WHERE id = $${idx}::text`,
        ...params
      );
      const updated = await prisma.$queryRawUnsafe(`
        SELECT id, title, descriptionhtml, descriptiontext, imageurl, brand, sku, price, currency, inventory, url, gtin, mpn, condition, customfields, updatedat
        FROM "FeedItem" WHERE id = $1::text
      `, itemId);
      const out = updated && updated[0] ? updated[0] : { id: itemId };
      if (out.customfields && typeof out.customfields === 'object') {
        out.customFields = out.customfields;
      }
      return res.json(out);
    } catch (e) {
      console.error('Erreur PUT item:', e);
      return res.status(500).json({ message: 'Erreur mise à jour item', error: e.message });
    }
  });

  app.patch('/api/v1/ingestion/items/:id/channels', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const body = req.body || {};
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      const accountId = req.accountId;
      const itemId = await resolveItemId(prisma, id, accountId);
      if (!itemId) return res.status(404).json({ message: 'Item non trouvé' });
      if (!await verifyItemAccess(itemId, accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const current = await prisma.$queryRawUnsafe(`
        SELECT id, customfields FROM "FeedItem" WHERE id = $1::text
      `, itemId);
      if (!current || !current[0]) return res.status(404).json({ message: 'Item non trouvé' });
      let customFields = current[0].customfields;
      try {
        customFields = typeof customFields === 'string' ? JSON.parse(customFields) : (customFields || {});
      } catch (e) {
        customFields = {};
      }
      const overrides = { ...(customFields._channelOverrides || {}), ...body };
      customFields._channelOverrides = overrides;
      await prisma.$executeRawUnsafe(`
        UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text
      `, JSON.stringify(customFields), itemId);
      for (const [overrideKey, value] of Object.entries(body)) {
        if (typeof value !== 'boolean') continue;
        const platformKey = getPlatformKeyFromOverrideKey(overrideKey);
        if (!platformKey) continue;
        await syncDestinationActivationsForPlatformOverride(accountId, itemId, platformKey, value);
        customFields = await syncLegacyChannelOverrideForPlatform(accountId, itemId, platformKey, customFields);
      }
      return res.json({ channelOverrides: parseJsonObject(customFields._channelOverrides) });
    } catch (e) {
      console.error('Erreur PATCH channels:', e);
      return res.status(500).json({ message: 'Erreur mise à jour canaux', error: e.message });
    }
  });

  app.get('/api/v1/ingestion/items/:id/destinations', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      const accountId = req.accountId;
      const itemId = await resolveItemId(prisma, id, accountId);
      if (!itemId) return res.status(404).json({ message: 'Item non trouvé' });
      if (!await verifyItemAccess(itemId, accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const payload = await buildItemDestinationActivations(accountId, itemId);
      return res.json(payload);
    } catch (e) {
      console.error('Erreur GET destinations item:', e);
      const unavailable = getMarketsUnavailableResponse(res, e);
      if (unavailable) return unavailable;
      return res.status(e.statusCode || 500).json({ message: e.message || 'Erreur chargement destinations item' });
    }
  });

  app.patch('/api/v1/ingestion/items/:id/destinations/:destinationId', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id, destinationId } = req.params;
      const { isEnabled, excludedReason } = req.body || {};
      if (typeof isEnabled !== 'boolean') {
        return res.status(400).json({ message: 'isEnabled (boolean) est requis.' });
      }
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      const accountId = req.accountId;
      const itemId = await resolveItemId(prisma, id, accountId);
      if (!itemId) return res.status(404).json({ message: 'Item non trouvé' });
      if (!await verifyItemAccess(itemId, accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const destinationContext = await getDestinationPushContext(accountId, destinationId);
      const activationStatus = isEnabled ? 'active' : 'excluded';
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO "ProductActivation" (
            id, productid, destinationid, isenabled, activationstatus, excludedreason, manualoverride, createdat, updatedat
          )
          VALUES (
            $1::text, $2::text, $3::text, $4::boolean, $5::text, $6::text, true, NOW(), NOW()
          )
          ON CONFLICT (productid, destinationid) DO UPDATE
          SET isenabled = EXCLUDED.isenabled,
              activationstatus = EXCLUDED.activationstatus,
              excludedreason = EXCLUDED.excludedreason,
              manualoverride = true,
              updatedat = NOW()
        `,
        crypto.randomUUID(),
        itemId,
        destinationId,
        isEnabled,
        activationStatus,
        isEnabled ? null : String(excludedReason || 'disabled_from_destination_toggle')
      );
      const customFields = await syncLegacyChannelOverrideForPlatform(accountId, itemId, destinationContext.platformKey);
      return res.json({
        itemId,
        destinationId,
        isEnabled,
        activationStatus,
        channelOverrides: parseJsonObject(customFields._channelOverrides),
      });
    } catch (e) {
      console.error('Erreur PATCH destination item:', e);
      const unavailable = getMarketsUnavailableResponse(res, e);
      if (unavailable) return unavailable;
      return res.status(e.statusCode || 500).json({ message: e.message || 'Erreur mise à jour destination item' });
    }
  });

  app.patch('/api/v1/ingestion/items/:id/optimized', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
    try {
      const { id } = req.params;
      const { platform, title, description, highlights, destinationId } = req.body || {};
      if (!platform || typeof platform !== 'string') {
        return res.status(400).json({ message: 'platform requis (gmc|meta|amazon|chatgpt)' });
      }
      if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
      const accountId = req.accountId;
      const itemId = await resolveItemId(prisma, id, accountId);
      if (!itemId) return res.status(404).json({ message: 'Item non trouvé' });
      if (!await verifyItemAccess(itemId, accountId)) return res.status(403).json({ message: 'Accès refusé' });
      const platKey = String(platform).toLowerCase().replace('google', 'gmc');
      if (!['gmc', 'meta', 'amazon', 'chatgpt'].includes(platKey)) {
        return res.status(400).json({ message: 'plateforme invalide. Utilisez gmc, meta, amazon ou chatgpt.' });
      }
      let destinationContext = null;
      if (destinationId) {
        destinationContext = await getDestinationPushContext(accountId, String(destinationId), platKey);
      }
      const current = await prisma.$queryRawUnsafe(`SELECT id, customfields FROM "FeedItem" WHERE id = $1::text`, itemId);
      if (!current || !current[0]) return res.status(404).json({ message: 'Item non trouvé' });
      let cf = current[0].customfields;
      try {
        cf = typeof cf === 'string' ? JSON.parse(cf || '{}') : (cf || {});
      } catch (e) {
        cf = {};
      }
      const content = {};
      if (title !== undefined) content.title = String(title).trim();
      if (description !== undefined) content.description = String(description).trim();
      if (Array.isArray(highlights)) content.highlights = highlights.map((entry) => String(entry).trim()).filter(Boolean);
      if (Object.keys(content).length === 0) return res.json({ message: 'Aucune modification', customfields: cf });
      const newCf = mergeOptimizedContent(cf, platKey, content, destinationContext ? {
        destinationId: destinationContext.id,
        marketCode: destinationContext.marketCode,
        localeCode: destinationContext.localeCode || null,
      } : {});
      await prisma.$executeRawUnsafe(
        `UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`,
        JSON.stringify(newCf),
        itemId
      );
      return res.json({
        message: 'Contenu optimisé sauvegardé',
        platform: platKey,
        destinationId: destinationContext?.id || null,
      });
    } catch (e) {
      console.error('Erreur PATCH optimized:', e);
      return res.status(500).json({ message: 'Erreur mise à jour', error: e.message });
    }
  });
}

module.exports = { registerIngestionRoutes };

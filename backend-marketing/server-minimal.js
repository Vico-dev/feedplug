const corsLib = require('./lib/cors');

let app;
let server = null; // Référence pour graceful shutdown (SIGTERM)
if (require.main === module) {
  // Cloud Run : écouter tout de suite (sans charger instrument/Sentry)
  const http = require('http');
  const express = require('express');
  const cors = require('cors');
  app = express();
  const PORT = process.env.PORT || 8080;
  const HOST = process.env.HOST || '0.0.0.0';

  // Prévolée CORS : gérée au niveau HTTP, AVANT Express (source unique : lib/cors.js).
  server = http.createServer((req, res) => {
    const isPreflight = (req.method || '').toUpperCase() === 'OPTIONS' || (req.headers['access-control-request-method'] && req.headers.origin);
    if (isPreflight) {
      const origin = (req.headers.origin || '').trim();
      if (corsLib.isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
      }
      res.removeHeader('Cross-Origin-Resource-Policy'); // Évite blocage CORS depuis app.feedplug.com
      res.writeHead(204);
      res.end();
      return;
    }
    app(req, res);
  });

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      return cb(null, corsLib.isOriginAllowed(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204
  }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  server.listen(PORT, HOST, () => {
    require('./instrument');
    run();
  });
} else {
  require('./instrument');
}
module.exports = function (application) {
  app = application;
  run();
};

function run() {
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const {
  hashAuthActionToken,
  normalizeAuthActionToken,
  validatePasswordPolicy,
} = require('./domains/auth/security');
const {
  computeAccountAccessState,
  evaluateAuthenticatedAccess,
} = require('./domains/billing/access-state');
const {
  sendWelcomeEmail,
  sendSyncCompleteEmail,
  sendExportCompleteEmail,
  sendErrorEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
  sendMarketingNurtureEmail,
  sendMarketingAuditNurtureEmail,
  sendMarketingAuditEmail,
  notifyInternalMarketingFormSubmission,
  notifyInternalAlert,
  syncMarketingContact,
  verifyMarketingClickToken,
  verifyMarketingUnsubscribeToken,
  getEmailLocale,
} = require('./email/email-service');
const {
  isComplianceTopic: isShopifyComplianceTopic,
  processComplianceWebhook: processShopifyComplianceWebhook,
} = require('./domains/shopify/compliance');
const {
  SHOPIFY_ADMIN_API_VERSION,
  SHOPIFY_SCOPES: DEFAULT_SHOPIFY_SCOPES,
  buildShopifyAdminGraphqlUrl,
} = require('./domains/shopify/config');
const shopifyBilling = require('./domains/shopify/billing');
const shopifyProvisioning = require('./domains/shopify/provisioning');
const {
  exchangeSessionTokenForAccessToken: exchangeShopifySessionToken,
} = require('./domains/shopify/token-exchange');
const shopifyManagedPricing = require('./domains/shopify/managed-pricing');
const {
  handleAppUninstalled: shopifyHandleAppUninstalled,
  matchPendingSubscriptionToWebhook: shopifyMatchPendingSubToWebhook,
} = require('./domains/shopify/lifecycle');
const {
  buildShopifyApps,
  resolveShopifyApp: resolveShopifyAppEntry,
} = require('./domains/shopify/app-registry');
const {
  getPriceEur: getPlanPriceEur,
  getPlanLabel: getPlanLabel,
  tierIdFromProductTier,
} = require('./lib/pricing');
const { callAIWithCache } = require('./ai/ai-wrapper');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const { Storage } = require('@google-cloud/storage');
const { withTimeout } = require('./lib/resilience');
const {
  decryptObjectSecrets,
  decryptSecret,
  encryptObjectSecrets,
  encryptSecret,
  redactObjectSecrets,
} = require('./lib/secret-crypto');
const {
  buildDestinationScope,
  buildDestinationSlug,
  getDefaultLocalesForMarket,
  getMarketCurrency,
  getMarketName,
  getPlatformLabel,
  inferAmazonChannelKeyForMarket,
  inferMarketCodeFromAmazonChannelKey,
  normalizeLocaleCode,
  normalizeMarketCode,
  normalizePlatformKey,
  platformUsesLocales,
} = require('./lib/markets');
const chaos = require('./lib/chaos-monkey');

const port = process.env.PORT || 8080;

// Configuration Cloud Storage
const storage = new Storage();
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'feedplug-uploads';

// Configuration multer pour upload en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/xml', 'text/xml', 'text/plain'];
    const allowedExtensions = ['.csv', '.xml', '.tsv', '.txt'];
    const hasAllowedType = allowedTypes.includes(file.mimetype);
    const hasAllowedExtension = allowedExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext));

    if (hasAllowedType || hasAllowedExtension) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez CSV, XML, TSV ou TXT.'));
    }
  }
});

// Protection XXE : vérifie qu'un buffer ne contient pas de déclarations d'entités XML externes
function hasXxePayload(buffer) {
  const header = buffer.slice(0, 2048).toString('utf-8').toLowerCase();
  return header.includes('<!entity') || header.includes('<!doctype');
}

async function executeBestEffortRaw(prismaClient, label, attempts) {
  let lastError = null;
  for (const attempt of attempts) {
    try {
      await prismaClient.$executeRawUnsafe(attempt.sql, ...(attempt.params || []));
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    console.warn(`${label} skipped:`, lastError?.message || lastError);
  }
  return false;
}

async function insertEnrichmentHistoryBatchSafe(prismaClient, batch, feedId, now) {
  if (!Array.isArray(batch) || batch.length === 0) return false;

  const params = [];
  const valuePlaceholders = batch.map((row, i) => {
    const base = i * 9;
    params.push(row.id, row.itemId, feedId, row.enrichments, row.alerts, row.method, row.aiProvider, row.aiModel, now);
    return `($${base + 1}::text, $${base + 2}::text, $${base + 3}::text, $${base + 4}::jsonb, $${base + 5}::jsonb, $${base + 6}::text, $${base + 7}::text, $${base + 8}::text, $${base + 9}::timestamptz)`;
  });

  return executeBestEffortRaw(prismaClient, 'EnrichmentHistory insert', [
    {
      sql: `INSERT INTO "EnrichmentHistory" (id, "itemId", "feedId", "enrichedFields", alerts, method, "aiProvider", "aiModel", "createdAt") VALUES ${valuePlaceholders.join(', ')}`,
      params,
    },
    {
      sql: `INSERT INTO "EnrichmentHistory" (id, itemid, feedid, enrichedfields, alerts, method, aiprovider, aimodel, createdat) VALUES ${valuePlaceholders.join(', ')}`,
      params,
    },
  ]);
}

async function upsertEnrichmentStatsSafe(
  prismaClient,
  { feedId, totalItems, enrichedItems, fieldsEnriched, alertsGenerated, aiEnrichments, rulesEnrichments, now, date }
) {
  const params = [
    require('crypto').randomUUID(),
    feedId,
    date,
    totalItems,
    enrichedItems,
    fieldsEnriched,
    alertsGenerated,
    aiEnrichments,
    rulesEnrichments,
    now,
    now,
  ];

  return executeBestEffortRaw(prismaClient, 'EnrichmentStats upsert', [
    {
      sql: `
        INSERT INTO "EnrichmentStats" (id, "feedId", date, "totalItems", "enrichedItems", "fieldsEnriched", "alertsGenerated", "aiEnrichments", "rulesEnrichments", "createdAt", "updatedAt")
        VALUES ($1::text, $2::text, $3::date, $4::int, $5::int, $6::int, $7::int, $8::int, $9::int, $10::timestamptz, $11::timestamptz)
        ON CONFLICT ("feedId", date)
        DO UPDATE SET
          "totalItems" = "EnrichmentStats"."totalItems" + EXCLUDED."totalItems",
          "enrichedItems" = "EnrichmentStats"."enrichedItems" + EXCLUDED."enrichedItems",
          "fieldsEnriched" = "EnrichmentStats"."fieldsEnriched" + EXCLUDED."fieldsEnriched",
          "alertsGenerated" = "EnrichmentStats"."alertsGenerated" + EXCLUDED."alertsGenerated",
          "aiEnrichments" = "EnrichmentStats"."aiEnrichments" + EXCLUDED."aiEnrichments",
          "rulesEnrichments" = "EnrichmentStats"."rulesEnrichments" + EXCLUDED."rulesEnrichments",
          "updatedAt" = EXCLUDED."updatedAt"
      `,
      params,
    },
    {
      sql: `
        INSERT INTO "EnrichmentStats" (id, feedid, date, totalitems, enricheditems, fieldsenriched, alertsgenerated, aienrichments, rulesenrichments, createdat, updatedat)
        VALUES ($1::text, $2::text, $3::date, $4::int, $5::int, $6::int, $7::int, $8::int, $9::int, $10::timestamptz, $11::timestamptz)
        ON CONFLICT (feedid, date)
        DO UPDATE SET
          totalitems = "EnrichmentStats".totalitems + EXCLUDED.totalitems,
          enricheditems = "EnrichmentStats".enricheditems + EXCLUDED.enricheditems,
          fieldsenriched = "EnrichmentStats".fieldsenriched + EXCLUDED.fieldsenriched,
          alertsgenerated = "EnrichmentStats".alertsgenerated + EXCLUDED.alertsgenerated,
          aienrichments = "EnrichmentStats".aienrichments + EXCLUDED.aienrichments,
          rulesenrichments = "EnrichmentStats".rulesenrichments + EXCLUDED.rulesenrichments,
          updatedat = EXCLUDED.updatedat
      `,
      params,
    },
  ]);
}

// Initialiser Prisma Client
let prisma;
let prismaReady = false;
let prismaInitPromise = null;
let rulesRoutesRegistered = false;
// Ingestion handlers
const { ingestCsvFromUrl } = require('./ingestion/csv');
const {
  ingestShopifyFromApi,
  fetchAllShopifyProducts,
  ingestShopifyProductFromWebhook,
  shouldUseFullSyncForWebhookPayload,
} = require('./ingestion/shopify');
const { ingestPrestashopFromApi, fetchPrestashopProducts } = require('./ingestion/prestashop');
// Scoring handlers - Nouveau système avancé multi-dimensionnel
const { 
  updateAdvancedQualityScore, 
  getAdvancedQualityScore,
  calculateAdvancedQualityScore,
  ensureProductScoreHistoryTable
} = require('./scoring/quality-advanced');
// Garder l'ancien pour compatibilité temporaire
const { updateQualityScore, getQualityScore } = require('./scoring/quality');
// Enrichissement automatique
const { analyzeProduct, analyzeProductWithAI, enrichProduct } = require('./enrichment/auto-enrichment');
// Historisation (révisions) pour rollback / retour au flux
const {
  buildItemSnapshot,
  createRevision,
  getLastIngestionRevision,
  listRevisions,
  getRevisionById
} = require('./lib/revisions');
const { applyEnrichmentSources } = require('./enrichment/enrichment-sources');
const { registerRulesRoutes } = require('./rules/routes');
const {
  getAccountPlan,
  getAccountAddonIA,
  getAccountMaxChannels,
  checkPlanLimit,
  checkChannelLimit,
  canUseFeature,
  countProductsForAccount,
  countChannelsForAccount,
  getPlanCapabilitiesForApi,
} = require('./lib/plan-limits');
const { createSharedAbuseProtection } = require('./lib/shared-abuse-store');
const { assertColumnsExist, assertTableExists } = require('./lib/schema-guards');
const { recordAiUsage, getAiUsage, AI_SOFT_CAP_MONTHLY } = require('./lib/ai-quota');
const { checkAiQuota, quotaMessage } = require('./lib/ai-caps');
const { createNotification } = require('./lib/notifications');
const { enqueueJob: enqueueBackgroundJob, configureJobs } = require('./lib/jobs');
const { createJobHandlers } = require('./domains/jobs/handlers');
// Fonctions de sync perf régies (injectées dans createJobHandlers pour la sync auto).
const { syncGoogleAdsPerformance } = require('./performance/sync-google-ads');
const { syncMetaAdsPerformance } = require('./performance/sync-meta-ads');
const { syncAmazonAdsPerformance } = require('./performance/sync-amazon-ads');
const gmcDomain = require('./domains/gmc/push');
const { createGmcPush } = gmcDomain;
const amazonDomain = require('./domains/amazon/push');
const { createAmazonPush } = amazonDomain;

// Instance de la factory de handlers de jobs (bloc 1 extrait dans
// domains/jobs/handlers.js). Affectée plus bas, une fois que toutes les
// constantes (AUTO_*_DEBOUNCE_MS, AUTO_OPTIM_BATCH_SIZE) et les fonctions
// injectées (executeGmcPush, optimizeTitleWithAI, …) sont définies/hoistées.
// Les wrappers locaux ci-dessous délèguent à cette instance ; ils ne sont
// appelés qu'au runtime (post-boot), donc `jobHandlers` est déjà affectée.
let jobHandlers = null;

// Instance de la factory du domaine GMC push (bloc 2 extrait dans
// domains/gmc/push.js). Affectée plus bas (avant createJobHandlers, qui reçoit
// executeGmcPush par injection). Les wrappers locaux délèguent à cette instance.
let gmcPush = null;

// Instance de la factory du domaine Amazon push (bloc 3 extrait dans
// domains/amazon/push.js). Affectée plus bas (avant createJobHandlers, qui reçoit
// executeAmazonPush par injection). Les wrappers locaux délèguent à cette instance.
let amazonPush = null;

// ===== Jobs longs externalisés (Sprint 2, B-PROPER) =====
// Types de jobs dispatchés via lib/jobs.js (Cloud Tasks en prod, fallback
// setTimeout en dev). Chaque handler `runAutoX` est IDEMPOTENT : ré-exécuter le
// même job (retry Cloud Tasks, double-delivery) ne produit pas d'effet de bord
// indésirable (les push GMC/optim/LIA sont des upserts/no-op si rien à faire).
const JOB_TYPES = {
  AUTO_GMC_PUSH: 'auto_gmc_push',
  AUTO_OPTIMIZATION: 'auto_optimization',
  AUTO_LIA_SYNC: 'auto_lia_sync',
  INGESTION_RUN: 'ingestion_run',
  // Sync auto des performances régies (Google Ads / Meta Ads / Amazon Ads) vers
  // PerformanceChannel + History. Déclenchés (a) après une connexion OAuth régie
  // réussie et (b) quotidiennement par Cloud Scheduler via /internal/sync/performance.
  // Handlers idempotents (dédup par accountId+plateforme+fenêtre journalière).
  SYNC_PERF_GOOGLE_ADS: 'sync_performance_google_ads',
  SYNC_PERF_META_ADS: 'sync_performance_meta_ads',
  SYNC_PERF_AMAZON_ADS: 'sync_performance_amazon_ads',
};

// Routeur de jobs : appelé par le worker HTTP (/internal/jobs/run) ET par le
// fallback in-process de lib/jobs.js. Wrapper de signature inchangée délégant à
// l'instance extraite (domains/jobs/handlers.js). `jobHandlers` est affectée
// plus bas dans run() ; ce wrapper n'est invoqué qu'au runtime (post-boot).
async function dispatchJob(type, payload) {
  return jobHandlers.dispatchJob(type, payload);
}

// Branche le dispatch dans lib/jobs.js (utilisé par le fallback in-process).
configureJobs({ dispatch: dispatchJob });

// Soft cap IA : enregistre la consommation et alerte (Sentry) à 80 % / 100 %.
// Fire-and-forget — ne bloque jamais la réponse IA, ne lève jamais.
// `kind` : 'text' (défaut) ou 'image' — compteurs séparés depuis A2.
function trackAiUsage(accountId, count = 1, kind = 'text') {
  if (!prismaReady || !prisma || !accountId) return;
  recordAiUsage(prisma, accountId, count, kind)
    .then((r) => {
      if (r && r.threshold) {
        const msg = `IA soft cap: le compte ${accountId} a atteint ${r.threshold}% du plafond mensuel de référence ${r.kind} (${r.used}/${r.softCap}, période ${r.period}).`;
        console.warn('⚠️  ' + msg);
        try {
          require('@sentry/node').captureMessage(msg, r.threshold >= 100 ? 'warning' : 'info');
        } catch (_) {}
      }
    })
    .catch((e) => console.warn('trackAiUsage error:', e?.message));
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SECRET_ENCRYPTION_KEY = process.env.FEEDPLUG_SECRET_ENCRYPTION_KEY || process.env.SECRET_ENCRYPTION_KEY || process.env.PLATFORM_SECRET_ENCRYPTION_KEY || '';

function exitProcess(code) {
  if (server) {
    server.close(() => process.exit(code));
    setTimeout(() => process.exit(code), 1000).unref();
    return;
  }
  process.exit(code);
}

function failFast(message, error = null) {
  console.error(message);
  if (error) {
    console.error(error);
  }
  exitProcess(1);
}

function validateStartupConfiguration() {
  if (process.env.ENABLE_RUNTIME_SCHEMA_MIGRATIONS === 'true') {
    throw new Error('ENABLE_RUNTIME_SCHEMA_MIGRATIONS=true n’est plus supporté. Appliquez les migrations SQL/Prisma avant de démarrer le service.');
  }
  if (process.env.NODE_ENV !== 'test' && !SECRET_ENCRYPTION_KEY) {
    throw new Error('SECRET_ENCRYPTION_KEY est obligatoire. Le fallback vers JWT_SECRET n’est plus autorisé.');
  }
}

function registerDeferredRoutesOnce() {
  if (rulesRoutesRegistered) return;
  try {
    registerRulesRoutes(app, prisma, () => prismaReady);
    rulesRoutesRegistered = true;
    console.log('✅ Routes Optimiser (rules) enregistrées');
  } catch (rulesErr) {
    console.warn('⚠️  Enregistrement routes rules:', rulesErr?.message);
  }
}

validateStartupConfiguration();

// Fonction d'initialisation de Prisma
const initPrisma = async () => {
  let prismaClient = null;
  try {
    const { PrismaClient } = require('@prisma/client');
    prismaClient = new PrismaClient({
      log: IS_PRODUCTION ? ['error'] : ['query', 'error', 'warn'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    console.log('🔍 DATABASE_URL format:', process.env.DATABASE_URL ?
      process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@').substring(0, 100) + '...' :
      'NOT SET');

    await prismaClient.$connect();
    await prismaClient.$queryRaw`SELECT 1 as test`;

    prisma = prismaClient;
    prismaReady = true;
    registerDeferredRoutesOnce();
    console.log('✅ Prisma connected successfully');
    // B5 — sweeper de runs zombies : un kill de process (timeout/OOM Cloud Run)
    // laisse des IngestionRun bloqués en RUNNING (le catch applicatif ne s'exécute
    // pas). Au démarrage, on marque FAILED ceux trop anciens pour ne pas afficher
    // une sync "en cours" éternelle. Fire-and-forget, tolérant aux erreurs.
    (async () => {
      try {
        const staleMin = Number(process.env.STALE_RUN_TIMEOUT_MIN || 15);
        const swept = await prismaClient.$executeRawUnsafe(`
          UPDATE "IngestionRun"
          SET status = 'FAILED',
              finishedat = NOW(),
              errormessage = COALESCE(errormessage, 'Run interrompu (timeout/redémarrage instance)')
          WHERE status = 'RUNNING'
            AND startedat < NOW() - ($1::int * INTERVAL '1 minute')
        `, staleMin);
        if (swept > 0) console.log(`🧹 ${swept} IngestionRun zombie(s) marqué(s) FAILED au démarrage`);
      } catch (sweepErr) {
        console.warn('⚠️  Sweeper IngestionRun:', sweepErr?.message);
      }
    })();
    return true;
  } catch (error) {
    console.error('⚠️  Prisma initialization error:', error.message);
    console.error('⚠️  Error details:', {
      code: error.code,
      meta: error.meta,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    prismaReady = false;
    prisma = null;
    if (prismaClient) {
      try {
        await prismaClient.$disconnect();
      } catch (_) {}
    }
    return false;
  }
};

const ensurePrismaReady = async () => {
  if (prismaReady && prisma) return true;
  if (!prismaInitPromise) {
    prismaInitPromise = initPrisma().finally(() => {
      prismaInitPromise = null;
    });
  }
  try {
    return await prismaInitPromise;
  } catch {
    return false;
  }
};

async function getPrismaClientOrThrow(message = 'Base de données indisponible') {
  if (prismaReady && prisma) return prisma;
  const ready = await ensurePrismaReady();
  if (ready && prisma) return prisma;
  throw new Error(message);
}

async function requirePrismaForRequest(res, message = 'Service non disponible') {
  try {
    return await getPrismaClientOrThrow(message);
  } catch (_error) {
    if (!res.headersSent) {
      res.status(503).json({ message });
    }
    return null;
  }
}

// Initialiser Prisma au démarrage (non-bloquant)
ensurePrismaReady()
  .then((ready) => {
    if (!ready && IS_PRODUCTION) {
      failFast('FATAL: connexion Prisma impossible au démarrage. Le service refuse de démarrer sans base disponible.');
    }
  })
  .catch(err => {
    console.error('❌ Error initializing Prisma:', err);
    console.error('❌ Full error:', JSON.stringify({
      message: err.message,
      code: err.code,
      meta: err.meta,
      name: err.name
    }, null, 2));
    prismaReady = false;
    if (IS_PRODUCTION) {
      failFast('FATAL: initialisation Prisma impossible.', err);
    }
  });

// Réessayer l'initialisation uniquement hors production : en prod on fail-fast.
if (!IS_PRODUCTION) {
  setInterval(async () => {
    if (!prismaReady) {
      console.log('🔄 Réessai d\'initialisation de Prisma...');
      try {
        await ensurePrismaReady();
        if (prismaReady) {
          console.log('✅ Prisma initialisé avec succès après réessai');
        }
      } catch (err) {
        console.error('❌ Échec du réessai d\'initialisation de Prisma:', err.message);
      }
    }
  }, 30000);
}

// Trust proxy pour Cloud Run (nécessaire pour rate limiting)
app.set('trust proxy', 1);

// CORS — NE PAS ajouter de app.use() avant ce middleware (source unique : lib/cors.js).
app.use(corsLib.corsMiddleware);

// Headers de sécurité — crossOriginResourcePolicy: false pour permettre les requêtes CORS depuis app.feedplug.com
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginResourcePolicy: false, // Désactivé : bloque les requêtes CORS depuis app.feedplug.com
}));

// Supprimer Cross-Origin-Resource-Policy pour /api (évite blocage CORS depuis app.feedplug.com)
app.use('/api', (req, res, next) => {
  res.removeHeader('Cross-Origin-Resource-Policy');
  next();
});

// Liste pour le log de démarrage (lib/cors.js)
const allowedOrigins = corsLib.getOrigins();

// Swagger API Documentation (disabled in production by default)
const SWAGGER_ENABLED = process.env.SWAGGER_ENABLED === 'true';
if (SWAGGER_ENABLED) {
  try {
    const swaggerUi = require('swagger-ui-express');
    const fs = require('fs');
    const yaml = require('yaml');
    const swaggerSpec = yaml.parse(fs.readFileSync('./openapi.yaml', 'utf8'));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'FeedPlug API Docs'
    }));
    console.log('✅ Swagger UI available at /api/docs');
  } catch (e) {
    console.warn('⚠️ Swagger setup failed:', e.message);
  }
}

// Fonction pour obtenir l'IP réelle
const getClientIp = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         'unknown';
};

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production. Shutting down.');
    process.exit(1);
  } else {
    console.warn('WARNING: JWT_SECRET not set. Using development-only fallback. DO NOT use in production.');
  }
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-secret-do-not-use-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_REFRESH_SECRET environment variable is required in production (must differ from JWT_SECRET). Shutting down.');
    process.exit(1);
  } else {
    console.warn('WARNING: JWT_REFRESH_SECRET not set. Using development-only fallback. DO NOT use in production.');
  }
}
if (JWT_REFRESH_SECRET && JWT_SECRET && JWT_REFRESH_SECRET === JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_REFRESH_SECRET must be different from JWT_SECRET in production. Shutting down.');
    process.exit(1);
  } else {
    console.warn('WARNING: JWT_REFRESH_SECRET is identical to JWT_SECRET. Use a distinct secret before production.');
  }
}
// Pas de repli sur JWT_SECRET : la séparation access/refresh doit rester effective.
const EFFECTIVE_JWT_REFRESH_SECRET = JWT_REFRESH_SECRET || 'dev-only-refresh-secret-do-not-use-in-production';

// Rate limit global sur /api/v1 — ne JAMAIS compter les preflights CORS (OPTIONS ou requête avec Access-Control-Request-Method).
// En production, beaucoup d'appels transitent via le proxy Next/Cloud Run et partagent la même IP vue côté backend.
// On partitionne donc prioritairement par utilisateur authentifié, puis seulement par IP en fallback.
function isPreflightRequest(req) {
  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') return true;
  if (req.headers['access-control-request-method'] && req.headers['origin']) return true;
  return false;
}

function isHealthRequest(req) {
  return req.path === '/health' || req.path === '/healthz';
}

// Access token court (30 min) pour limiter l'impact d'un token volé. Le frontend
// rafraîchit via /auth/refresh + cookie HttpOnly. Override possible via JWT_EXPIRES_IN
// si un besoin spécifique justifie une autre valeur.
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// Whitelist d'algorithmes JWT (anti alg-confusion / "none"). HS256 = HMAC-SHA256
// avec un secret partagé, cohérent avec jwt.sign(secret).
const JWT_VERIFY_OPTIONS = Object.freeze({ algorithms: ['HS256'] });
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/platforms/gmc/callback';
const GOOGLE_ADS_REDIRECT_URI = process.env.GOOGLE_ADS_REDIRECT_URI || (typeof process.env.GOOGLE_REDIRECT_URI === 'string' ? process.env.GOOGLE_REDIRECT_URI.replace('/gmc/callback', '/google-ads/callback') : 'https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/platforms/google-ads/callback');
const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';

// Amazon SP-API LWA (Login with Amazon)
const AMAZON_LWA_CLIENT_ID = process.env.AMAZON_LWA_CLIENT_ID || '';
const AMAZON_LWA_CLIENT_SECRET = process.env.AMAZON_LWA_CLIENT_SECRET || '';
const AMAZON_APPLICATION_ID = process.env.AMAZON_APPLICATION_ID || '';
const AMAZON_REDIRECT_URI = process.env.AMAZON_REDIRECT_URI || '';
const AMAZON_LOGIN_URI = process.env.AMAZON_LOGIN_URI || '';
const AMAZON_SELLER_CENTRAL_BASE = process.env.AMAZON_SELLER_CENTRAL_BASE || 'https://sellercentral.amazon.fr';
const AMAZON_SP_API_BASE = process.env.AMAZON_SP_API_BASE || 'https://sellingpartnerapi-eu.amazon.com';
const APP_URL = process.env.APP_URL || 'https://app.feedplug.com';
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
// Scopes alignés sur shopify.app.toml (source de vérité pour Shopify Partners).
// Toute divergence déclenche un re-consent lors de l'install ou un warning App Store.
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || DEFAULT_SHOPIFY_SCOPES;
const SHOPIFY_CALLBACK_URL = process.env.SHOPIFY_CALLBACK_URL || 'https://api.feedplug.com/api/v1/connectors/shopify/callback';
const SHOPIFY_WEBHOOK_PATH = '/api/v1/webhooks/shopify';

// Registre multi-app Shopify. `listed` = app App Store embedded (creds
// SHOPIFY_API_*). `connector` = app unlisted gratuite (creds
// SHOPIFY_CONNECTOR_API_*), ajoutée uniquement si ses env sont présentes —
// sinon l'app connecteur est désactivée et l'app listée reste inchangée.
// Voir domains/shopify/app-registry.js.
const SHOPIFY_APPS = buildShopifyApps(process.env, { defaultScopes: DEFAULT_SHOPIFY_SCOPES });
const resolveShopifyApp = (appId) => resolveShopifyAppEntry(SHOPIFY_APPS, appId);
const SHOPIFY_TOKEN_EXCHANGE_MIN_INTERVAL_MS = Math.max(
  0,
  Number(process.env.SHOPIFY_TOKEN_EXCHANGE_MIN_INTERVAL_MS || 5 * 60 * 1000)
);
const SHOPIFY_WEBHOOK_SYNC_DEBOUNCE_MS = Math.max(
  0,
  Number(process.env.SHOPIFY_WEBHOOK_SYNC_DEBOUNCE_MS || 30 * 1000)
);
const SHOPIFY_INCREMENTAL_WEBHOOK_TOPICS = new Set(['products/create', 'products/update']);
const SHOPIFY_FULL_SYNC_WEBHOOK_TOPICS = new Set(['products/delete']);

const {
  smartAuthLimiter,
  apiRateLimiter,
  registerLimiter,
  marketingEarlyAccessLimiter,
  marketingAuditLimiter,
  marketingFeatureIdeaLimiter,
  getLoginFailureStatus,
  recordLoginFailure,
  recordLoginSuccess,
} = createSharedAbuseProtection({
  ensurePrismaReady,
  getPrisma: () => prisma,
  getClientIp,
  jwt,
  getJwtSecret: () => EFFECTIVE_JWT_SECRET,
  isPreflightRequest,
  isHealthRequest,
  normalizeAuthActionToken,
  hashAuthActionToken,
  migrationLabel: '031_shared_rate_limits.sql',
});

app.use('/api/v1', apiRateLimiter);

async function verifyTurnstileToken({ token, remoteIp }) {
  if (!TURNSTILE_SECRET_KEY) {
    return { ok: true, skipped: true };
  }
  if (!token || typeof token !== 'string') {
    return { ok: false, message: 'Captcha requis' };
  }

  try {
    const formData = new URLSearchParams();
    formData.set('secret', TURNSTILE_SECRET_KEY);
    formData.set('response', token);
    if (remoteIp) formData.set('remoteip', remoteIp);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!response.ok) {
      return { ok: false, message: 'Vérification captcha indisponible' };
    }

    const result = await response.json();
    if (!result?.success) {
      return { ok: false, message: 'Captcha invalide', codes: result?.['error-codes'] || [] };
    }

    return { ok: true };
  } catch (error) {
    console.warn('Turnstile verification failed:', error?.message || error);
    return { ok: false, message: 'Vérification captcha indisponible' };
  }
}

const OAUTH_EPHEMERAL_PROVIDER_AMAZON = 'amazon';
const OAUTH_EPHEMERAL_PROVIDER_GMC = 'gmc';
const OAUTH_EPHEMERAL_PROVIDER_SHOPIFY = 'shopify';
const OAUTH_EPHEMERAL_FLOW_AMAZON_STATE = 'amazon_oauth_state';
const OAUTH_EPHEMERAL_FLOW_AMAZON_CONNECT = 'amazon_connect_code';
const OAUTH_EPHEMERAL_FLOW_GMC_SELECTION = 'gmc_selection';
const OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE = 'gmc_oauth_state';
const OAUTH_EPHEMERAL_FLOW_GOOGLE_ADS_OAUTH_STATE = 'google_ads_oauth_state';
const OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE = 'shopify_oauth_state';
const AMAZON_STATE_TTL_MS = 15 * 60 * 1000;
const AMAZON_CONNECT_CODE_TTL_MS = 5 * 60 * 1000;
const GMC_SELECTION_TTL_MS = 15 * 60 * 1000;
const SHOPIFY_OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const OAUTH_EPHEMERAL_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
let oauthEphemeralStateStorageReady = false;
let oauthEphemeralStateInitPromise = null;
let lastOAuthEphemeralStatePruneAt = 0;

async function ensureOAuthEphemeralStateStorage() {
  if (oauthEphemeralStateStorageReady) return true;
  if (!oauthEphemeralStateInitPromise) {
    oauthEphemeralStateInitPromise = (async () => {
      if (!(await ensurePrismaReady()) || !prisma) {
        throw new Error('Prisma indisponible pour le stockage OAuth');
      }
      await assertTableExists(prisma, 'oauth_ephemeral_state', '030_oauth_ephemeral_state.sql');
      oauthEphemeralStateStorageReady = true;
      return true;
    })().catch((error) => {
      oauthEphemeralStateStorageReady = false;
      throw error;
    }).finally(() => {
      oauthEphemeralStateInitPromise = null;
    });
  }
  return oauthEphemeralStateInitPromise;
}

async function pruneExpiredOAuthEphemeralState() {
  const now = Date.now();
  if (now - lastOAuthEphemeralStatePruneAt < OAUTH_EPHEMERAL_PRUNE_INTERVAL_MS) {
    return;
  }
  lastOAuthEphemeralStatePruneAt = now;
  try {
    await ensureOAuthEphemeralStateStorage();
    await prisma.$executeRawUnsafe(`
      DELETE FROM oauth_ephemeral_state
      WHERE expiresat <= NOW()
    `);
  } catch (error) {
    console.warn('OAuth ephemeral state prune skipped:', error?.message || error);
  }
}

async function storeOAuthEphemeralState({ id, provider, flow, payload, ttlMs }) {
  await ensureOAuthEphemeralStateStorage();
  const ttl = Math.max(1000, Number(ttlMs) || 0);
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  await prisma.$executeRawUnsafe(`
    INSERT INTO oauth_ephemeral_state (id, provider, flow, payload, expiresat, createdat)
    VALUES ($1::text, $2::text, $3::text, $4::jsonb, $5::timestamptz, NOW())
    ON CONFLICT (id) DO UPDATE
    SET provider = EXCLUDED.provider,
        flow = EXCLUDED.flow,
        payload = EXCLUDED.payload,
        expiresat = EXCLUDED.expiresat,
        createdat = NOW()
  `, id, provider, flow, JSON.stringify(payload || {}), expiresAt);
  await pruneExpiredOAuthEphemeralState();
}

async function consumeOAuthEphemeralState({ id, provider, flow }) {
  await ensureOAuthEphemeralStateStorage();
  const rows = await prisma.$queryRawUnsafe(`
    DELETE FROM oauth_ephemeral_state
    WHERE id = $1::text
      AND provider = $2::text
      AND flow = $3::text
      AND expiresat > NOW()
    RETURNING payload
  `, id, provider, flow);
  if (!rows?.length) return null;
  return parseJsonObject(rows[0].payload);
}

async function readOAuthEphemeralState({ id, provider, flow }) {
  await ensureOAuthEphemeralStateStorage();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT payload
    FROM oauth_ephemeral_state
    WHERE id = $1::text
      AND provider = $2::text
      AND flow = $3::text
      AND expiresat > NOW()
    LIMIT 1
  `, id, provider, flow);
  if (!rows?.length) return null;
  return parseJsonObject(rows[0].payload);
}
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function normalizeShopifyShop(shop) {
  const normalized = String(shop || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/\.myshopify\.com$/i, '');

  if (!normalized || !/^[a-z0-9-]+$/i.test(normalized)) {
    return '';
  }

  return normalized + '.myshopify.com';
}

function verifyShopifyInstallHmac(query, secret) {
  if (!query || !secret) return false;
  const rawHmac = Array.isArray(query.hmac) ? query.hmac[0] : query.hmac;
  if (typeof rawHmac !== 'string' || !rawHmac) return false;
  const message = Object.keys(query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .flatMap((key) => {
      const value = query[key];
      if (Array.isArray(value)) {
        return value.map((entry) => `${key}=${String(entry ?? '')}`);
      }
      if (value == null) {
        return [];
      }
      return [`${key}=${String(value)}`];
    })
    .join('&');
  const computed = crypto.createHmac('sha256', secret).update(message).digest('hex');
  if (computed.length !== rawHmac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(rawHmac, 'utf8'), Buffer.from(computed, 'utf8'));
}

function verifyShopifyWebhookHmac(rawBody, hmacHeader, secret) {
  if (!secret || !hmacHeader || !Buffer.isBuffer(rawBody)) return false;
  try {
    const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(String(hmacHeader), 'utf8'));
  } catch {
    return false;
  }
}

// Les session tokens App Bridge proviennent UNIQUEMENT de l'app embedded
// (listée). La clé/secret sont passés explicitement pour rester app-aware ;
// l'appelant fournit les creds de l'app `listed`.
function verifyShopifySessionToken(token, { apiKey, apiSecret } = {}) {
  if (!token || !apiSecret || !apiKey) {
    throw new Error('Shopify session token verification unavailable');
  }

  const payload = jwt.verify(token, apiSecret, {
    algorithms: ['HS256'],
    audience: apiKey,
    clockTolerance: 10,
  });

  const destination = typeof payload?.dest === 'string' ? payload.dest : '';
  const normalizedShop = normalizeShopifyShop(destination);
  if (!normalizedShop) {
    throw new Error('Invalid Shopify session token destination');
  }

  return {
    payload,
    shop: normalizedShop,
  };
}

function shouldRefreshShopifyTokenExchange(row) {
  if (!row || SHOPIFY_TOKEN_EXCHANGE_MIN_INTERVAL_MS <= 0) {
    return true;
  }
  const updatedAt = new Date(row.updatedat || 0).getTime();
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    return true;
  }
  return (Date.now() - updatedAt) >= SHOPIFY_TOKEN_EXCHANGE_MIN_INTERVAL_MS;
}

async function handleShopifyAppUninstalled(shopDomain, appEntry = SHOPIFY_APPS.listed) {
  if (!prismaReady || !prisma) return;
  const result = await shopifyHandleAppUninstalled({
    prisma,
    shopDomain,
    appId: appEntry.appId,
    // Seul l'uninstall d'une app facturée annule les abonnements du shop : sans
    // ça, désinstaller le connecteur annulerait l'abonnement Managed Pricing de
    // l'app listée sur une boutique qui aurait les deux apps.
    cancelSubscriptions: appEntry.billing === true,
  });
  if (!result.ok && result.error) {
    console.warn('Shopify uninstall cleanup skipped:', result.error);
  }
}

async function listShopifyFeedsForShop(shopDomain, appId) {
  if (!shopDomain || !prismaReady || !prisma) {
    return [];
  }

  // Si appId fourni, ne sync que les feeds de l'app à l'origine du webhook (une
  // boutique peut avoir les deux apps). Credentials legacy sans appId = 'listed'.
  const selectClause = `
      SELECT
        f.id AS feed_id,
        f.name AS feed_name,
        f.accountid,
        f.mappingjson,
        s.id AS source_id,
        s.lastrunat,
        c.id AS credential_id,
        c.secretjson
      FROM "Feed" f
      JOIN "FeedSource" s ON s.id = f.sourceid
      JOIN "Credential" c ON c.id = s.credentialid
      WHERE f.status = 'ACTIVE'::text
        AND s.status = 'ACTIVE'::text
        AND s.connector = 'SHOPIFY'::text
        AND c.connector = 'SHOPIFY'::text
        AND c.secretjson->>'shop' = $1::text`;

  if (appId) {
    return prisma.$queryRawUnsafe(
      `${selectClause}
        AND COALESCE(c.secretjson->>'appId', 'listed') = $2::text
      ORDER BY f.createdat DESC`,
      shopDomain,
      appId
    );
  }
  return prisma.$queryRawUnsafe(
    `${selectClause}
      ORDER BY f.createdat DESC`,
    shopDomain
  );
}

async function hasRunningIngestion(feedId) {
  if (!feedId || !prismaReady || !prisma) {
    return false;
  }

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT 1
      FROM "IngestionRun"
      WHERE feedid = $1::text
        AND status = 'RUNNING'::text
      LIMIT 1
    `,
    feedId
  );
  return Array.isArray(rows) && rows.length > 0;
}

function hasRecentShopifyWebhookSync(lastRunAt) {
  if (!lastRunAt || SHOPIFY_WEBHOOK_SYNC_DEBOUNCE_MS <= 0) {
    return false;
  }
  const lastRunTs = new Date(lastRunAt).getTime();
  if (!Number.isFinite(lastRunTs) || lastRunTs <= 0) {
    return false;
  }
  return (Date.now() - lastRunTs) < SHOPIFY_WEBHOOK_SYNC_DEBOUNCE_MS;
}

async function runShopifyPostSyncHooks(feedId, accountId) {
  try {
    const { applyRulesOnIngestion } = require('./rules/engine');
    await applyRulesOnIngestion(prisma, feedId, accountId, createRevision);
  } catch (rulesErr) {
    console.warn('⚠️ Règles non appliquées après webhook Shopify:', rulesErr.message);
  }

  try {
    await applyEnrichmentSources(prisma, feedId, accountId, storage);
  } catch (enrichErr) {
    console.warn('⚠️ Enrichissement non appliqué après webhook Shopify:', enrichErr.message);
  }

  scheduleAutoOptimization(accountId, feedId, 'webhook Shopify');
  scheduleAutoLiaSync(accountId, 'webhook Shopify');
}

async function triggerShopifyCatalogWebhookSync({ topic, shopDomain, payload, appId }) {
  if (!shopDomain || !prismaReady || !prisma) {
    return;
  }

  const feeds = await listShopifyFeedsForShop(shopDomain, appId);
  if (!feeds.length) {
    return;
  }

  for (const feed of feeds) {
    if (await hasRunningIngestion(feed.feed_id)) {
      console.log(`ℹ️ Shopify webhook ${topic}: sync déjà en cours pour feed ${feed.feed_id}, skip`);
      continue;
    }
    if (hasRecentShopifyWebhookSync(feed.lastrunat)) {
      console.log(`ℹ️ Shopify webhook ${topic}: feed ${feed.feed_id} encore dans la fenêtre de debounce, skip`);
      continue;
    }

    let secretData;
    try {
      secretData = decryptObjectSecrets(
        typeof feed.secretjson === 'string' ? JSON.parse(feed.secretjson) : feed.secretjson
      );
    } catch (error) {
      console.warn(`⚠️ Shopify webhook ${topic}: secretjson invalide pour feed ${feed.feed_id}:`, error?.message || error);
      continue;
    }

    const accessToken = secretData?.accessToken || secretData?.access_token || '';
    if (!accessToken) {
      console.warn(`⚠️ Shopify webhook ${topic}: token manquant pour feed ${feed.feed_id}`);
      continue;
    }

    const feedContext = {
      id: feed.feed_id,
      name: feed.feed_name,
      sourceId: feed.source_id,
      mappingJson: feed.mappingjson || {},
    };

    try {
      let result;
      const prefersFullSync = SHOPIFY_FULL_SYNC_WEBHOOK_TOPICS.has(topic)
        || shouldUseFullSyncForWebhookPayload(payload);

      if (prefersFullSync) {
        result = await ingestShopifyFromApi({
          prisma,
          feed: feedContext,
          shop: shopDomain,
          accessToken,
        });
      } else if (SHOPIFY_INCREMENTAL_WEBHOOK_TOPICS.has(topic)) {
        result = await ingestShopifyProductFromWebhook({
          prisma,
          feed: feedContext,
          shop: shopDomain,
          payload,
        });
      } else {
        continue;
      }

      await runShopifyPostSyncHooks(feed.feed_id, feed.accountid);
      console.log(`✅ Shopify webhook ${topic}: sync appliquée pour ${shopDomain}`, {
        feedId: feed.feed_id,
        totalFetched: result?.totalFetched ?? 0,
        totalInserted: result?.totalInserted ?? 0,
        totalUpdated: result?.totalUpdated ?? 0,
        totalDeleted: result?.totalDeleted ?? 0,
      });
    } catch (error) {
      console.error(`Shopify webhook ${topic} sync failed for ${shopDomain} / feed ${feed.feed_id}:`, error);
    }
  }
}

// Helper: chercher un user dans la table User (DB) avec fallback sur testUsers en dev
async function findUserByEmail(email) {
  if (prismaReady && prisma) {
    try {
      const users = await prisma.$queryRawUnsafe(`
        SELECT u.*, a.name as accountname, a.plan as accountplan, a.trialendsat, a.billingstatus, a.paymentgraceuntil
        FROM "User" u
        JOIN "Account" a ON u.accountid = a.id
        WHERE u.email = $1::text
        LIMIT 1
      `, email);
      if (users && users.length > 0) return users[0];
    } catch (err) {
      if (err?.message && /billingstatus|paymentgraceuntil|42703/i.test(err.message)) {
        try {
          const users = await prisma.$queryRawUnsafe(`
            SELECT u.*, a.name as accountname, a.plan as accountplan, a.trialendsat
            FROM "User" u
            JOIN "Account" a ON u.accountid = a.id
            WHERE u.email = $1::text
            LIMIT 1
          `, email);
          if (users && users.length > 0) return users[0];
        } catch (fallbackErr) {
          console.warn('Erreur lookup user DB (fallback):', fallbackErr.message);
        }
      }
      console.warn('Erreur lookup user DB:', err.message);
    }
  }
  // Pas de fallback en production — si la DB n'est pas disponible, pas d'authentification possible
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  // Fallback dev uniquement (ne contient aucun vrai credential)
  console.warn('WARNING: Using dev fallback user. This should never happen in production.');
  return null;
}

/** Retourne les emails des utilisateurs du compte (pour envoi d'emails transactionnels) */
async function getAccountEmails(accountId) {
  if (!accountId || !prismaReady || !prisma) return [];
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT email FROM "User" WHERE accountid = $1::text AND email IS NOT NULL
    `, accountId);
    return (rows || []).map(r => r.email).filter(Boolean);
  } catch (err) {
    console.warn('getAccountEmails:', err.message);
    return [];
  }
}

async function findUserById(id) {
  if (prismaReady && prisma) {
    try {
      const users = await prisma.$queryRawUnsafe(`
        SELECT u.*, a.name as accountname, a.plan as accountplan, a.trialendsat, a.billingstatus, a.paymentgraceuntil
        FROM "User" u
        JOIN "Account" a ON u.accountid = a.id
        WHERE u.id = $1::text
        LIMIT 1
      `, id);
      if (users && users.length > 0) return users[0];
    } catch (err) {
      if (err?.message && /billingstatus|paymentgraceuntil|42703/i.test(err.message)) {
        try {
          const users = await prisma.$queryRawUnsafe(`
            SELECT u.*, a.name as accountname, a.plan as accountplan, a.trialendsat
            FROM "User" u
            JOIN "Account" a ON u.accountid = a.id
            WHERE u.id = $1::text
            LIMIT 1
          `, id);
          if (users && users.length > 0) return users[0];
        } catch (fallbackErr) {
          console.warn('Erreur lookup user by ID (fallback):', fallbackErr.message);
        }
      }
      console.warn('Erreur lookup user by ID:', err.message);
    }
  }
  return null;
}

function buildAuthPayload(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    accountId: user.accountid || user.accountId
  };
}

function buildAuthUser(user, req) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstname || '',
    lastName: user.lastname || '',
    role: user.role,
    accountId: user.accountid || user.accountId,
    accountName: user.accountname,
    trialEndsAt: user.trialendsat || null,
    billingStatus: user.billingstatus || null,
    paymentGraceUntil: user.paymentgraceuntil || null,
    isStaff: req ? isStaffForUser({ email: user.email }) : isStaffForUser({ email: user.email })
  };
}

function issueAuthTokens(user) {
  const payload = buildAuthPayload(user);
  // jti distinct par token : permet la révocation explicite (logout) sans
  // affecter les autres sessions du même utilisateur.
  return {
    accessToken: jwt.sign({ ...payload, jti: crypto.randomUUID() }, EFFECTIVE_JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN }),
    refreshToken: jwt.sign({ ...payload, jti: crypto.randomUUID() }, EFFECTIVE_JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN })
  };
}

/**
 * Vérifie si un JWT déjà décodé doit être rejeté.
 * Combine deux mécanismes :
 *  - RevokedJti : révocation explicite (logout)
 *  - User.passwordchangedat : tout token signé avant un changement de
 *    mot de passe est rejeté (couvre password change / reset / accept-invitation)
 */
async function isTokenRevoked(decoded) {
  if (!decoded || !prismaReady || !prisma) return false;
  try {
    if (decoded.jti) {
      const revoked = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM "RevokedJti" WHERE jti = $1::text AND expiresat > NOW() LIMIT 1`,
        decoded.jti
      );
      if (revoked && revoked.length > 0) return true;
    }
    if (decoded.id && typeof decoded.iat === 'number') {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT passwordchangedat FROM "User" WHERE id = $1::text LIMIT 1`,
        decoded.id
      );
      const pca = rows?.[0]?.passwordchangedat;
      if (pca) {
        // iat est en secondes (RFC 7519), passwordchangedat en ms côté JS.
        const pcaSec = Math.floor(new Date(pca).getTime() / 1000);
        if (decoded.iat < pcaSec) return true;
      }
    }
  } catch (err) {
    // En cas d'erreur DB on est strict : on ne peut pas confirmer l'état,
    // donc on rejette plutôt que d'autoriser un token potentiellement révoqué.
    console.warn('isTokenRevoked error:', err?.message);
    return true;
  }
  return false;
}

// Stripe webhook AVANT express.json() (nécessite body raw pour signature)
const { registerStripeWebhook } = require('./routes/onboarding-billing');
registerStripeWebhook(app, { getPrisma: () => prisma, getPrismaReady: () => prismaReady });

// Shopify webhooks AVANT express.json() (nécessite le body raw pour la signature HMAC).
// Factory app-aware : chaque app (listée / connecteur) monte ce handler sur SON
// chemin avec SON secret. Le HMAC est vérifié avec le secret de l'app du chemin.
function makeShopifyWebhookHandler(appEntry) {
  return async (req, res) => {
  const hmacHeader = req.get('x-shopify-hmac-sha256');
  if (!verifyShopifyWebhookHmac(req.body, hmacHeader, appEntry.apiSecret)) {
    return res.status(401).send('Invalid Shopify HMAC signature');
  }

  const topic = String(req.get('x-shopify-topic') || '').trim().toLowerCase();
  const shopDomain = normalizeShopifyShop(req.get('x-shopify-shop-domain') || '');
  const webhookId = String(req.get('x-shopify-webhook-id') || '').trim();
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  let payload = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = null;
  }

  // Idempotency : Shopify rejoue les webhooks en cas de 5xx/timeout. Sans dedup,
  // app_subscriptions/update UPDATE Account plusieurs fois et customers/redact
  // tente de re-supprimer. On insère l'id ; conflit = déjà traité, on répond 200.
  if (webhookId && prismaReady && prisma) {
    try {
      const inserted = await prisma.$executeRawUnsafe(
        `INSERT INTO shopify_processed_webhooks (webhook_id, topic, shop_domain)
         VALUES ($1::text, $2::text, $3::text)
         ON CONFLICT (webhook_id) DO NOTHING`,
        webhookId,
        topic,
        shopDomain || null
      );
      if (inserted === 0) {
        // Déjà traité auparavant — 200 silencieux pour que Shopify arrête les retries.
        return res.status(200).json({ ok: true, topic, duplicate: true });
      }
    } catch (idemErr) {
      // Si la table n'existe pas encore (migration pas appliquée), on log et on
      // poursuit plutôt que de bloquer. À retirer une fois la migration 039 en prod.
      if (!/shopify_processed_webhooks|42P01/i.test(idemErr?.message || '')) {
        console.warn('Shopify webhook idempotency check failed:', idemErr?.message);
      }
    }
  }

  try {
    if (topic === 'app/uninstalled') {
      await handleShopifyAppUninstalled(shopDomain, appEntry);
    } else if (SHOPIFY_INCREMENTAL_WEBHOOK_TOPICS.has(topic) || SHOPIFY_FULL_SYNC_WEBHOOK_TOPICS.has(topic)) {
      if (shopDomain) {
        setImmediate(() => {
          triggerShopifyCatalogWebhookSync({ topic, shopDomain, payload, appId: appEntry.appId }).catch((error) => {
            console.error(`Shopify webhook async sync failed (${topic} / ${shopDomain}):`, error);
          });
        });
      }
    } else if (topic === 'app_subscriptions/update' && appEntry.billing) {
      // Sync l'état de l'abonnement Shopify (ACTIVE/CANCELLED/EXPIRED/FROZEN/DECLINED)
      // déclenché à chaque transition côté Shopify. Réservé aux apps facturées
      // (app listée) : l'app connecteur n'a pas de Managed Pricing.
      const sub = payload?.app_subscription || payload || {};
      const shopifySubscriptionId = sub.admin_graphql_api_id || sub.id || '';
      const subName = String(sub.name || '').trim();
      const status = String(sub.status || '').toUpperCase();
      if (shopifySubscriptionId && status && prismaReady && prisma) {
        try {
          // Managed Pricing : le 1er webhook ACTIVE arrive avec un subscription_id
          // que nous n'avons jamais vu (on avait stocké un id provisoire "pending_..."
          // au moment du clic). matchPendingSubscriptionToWebhook trouve la row
          // PENDING locale par shop + plan name et la promeut avec le vrai id.
          await shopifyMatchPendingSubToWebhook({
            prisma,
            shopifySubscriptionId: String(shopifySubscriptionId),
            shopDomain,
            subscriptionName: subName,
            status,
          });
          await shopifyBilling.markShopifySubscriptionStatus({
            prisma,
            shopifySubscriptionId: String(shopifySubscriptionId),
            status,
            currentPeriodEnd: sub.current_period_end || null,
            cancelled: status === 'CANCELLED',
          });
          const accountRow = await prisma.$queryRawUnsafe(
            `SELECT accountid, plan_key FROM shopify_subscriptions WHERE shopify_subscription_id = $1::text LIMIT 1`,
            String(shopifySubscriptionId)
          );
          const accountId = accountRow?.[0]?.accountid;
          const planKey = accountRow?.[0]?.plan_key;
          if (accountId) {
            if (status === 'ACTIVE') {
              // Pack IA bundlé dans les tiers (Option B) : on active/désactive
              // l'add-on IA selon que le plan souscrit l'inclut (Business/Premium)
              // ou non (Starter/Pro). Source de vérité : SHOPIFY_PLANS.includesAI.
              const planForAddon = planKey
                ? shopifyManagedPricing.getPlan(String(planKey).toLowerCase())
                : null;
              const addonIA = planForAddon?.includesAI === true;
              await prisma.$executeRawUnsafe(
                `UPDATE "Account" SET plan = $2::text, billing_provider = 'SHOPIFY'::text, billingstatus = 'active'::text, addonia = $3::boolean, paymentgraceuntil = NULL, updatedat = NOW() WHERE id = $1::text`,
                accountId,
                planKey,
                addonIA
              );
            } else if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'FROZEN' || status === 'DECLINED') {
              await prisma.$executeRawUnsafe(
                `UPDATE "Account" SET billingstatus = $2::text, updatedat = NOW() WHERE id = $1::text`,
                accountId,
                status === 'FROZEN' ? 'payment_failed' : 'pending'
              );
            }
          }
          console.log('✅ Shopify app_subscriptions/update appliqué:', { shopifySubscriptionId, status });
        } catch (subErr) {
          console.error('Shopify app_subscriptions/update sync failed:', subErr?.message || subErr);
          return res.status(500).send('Subscription sync failed');
        }
      }
    } else if (isShopifyComplianceTopic(topic)) {
      // Topics GDPR obligatoires (App Store) :
      //  - customers/data_request : SLA 30j
      //  - customers/redact       : SLA 30j après uninstall
      //  - shop/redact            : SLA 48h après réception (déclenché 48h après uninstall)
      if (!prismaReady || !prisma) {
        console.error('Shopify compliance webhook reçu sans DB disponible:', { topic, shopDomain });
        return res.status(503).send('Database unavailable, will retry');
      }
      try {
        const result = await processShopifyComplianceWebhook({
          prisma,
          topic,
          shopDomain,
          payload,
          notifyAdmin: notifyInternalAlert,
          appId: appEntry.appId,
        });
        console.log('✅ Shopify compliance webhook processed:', { topic, shopDomain, ...result });
      } catch (complianceErr) {
        console.error('Shopify compliance webhook processing failed:', {
          topic,
          shopDomain,
          error: complianceErr?.message || complianceErr,
        });
        return res.status(500).send('Compliance webhook processing failed');
      }
    } else {
      console.log('ℹ️ Shopify webhook received:', { topic, shopDomain });
    }

    return res.status(200).json({
      ok: true,
      topic,
      shop: shopDomain,
      received: true,
      payloadSummary: payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 8) : [],
    });
  } catch (error) {
    console.error('Shopify webhook handling error:', error);
    return res.status(500).send('Shopify webhook handling failed');
  }
  };
}

// Montage app listée (chemin + options inchangés) puis, si configurée, app connecteur.
app.post(SHOPIFY_APPS.listed.webhookPath, express.raw({ type: '*/*', limit: '2mb' }), makeShopifyWebhookHandler(SHOPIFY_APPS.listed));
if (SHOPIFY_APPS.connector) {
  app.post(SHOPIFY_APPS.connector.webhookPath, express.raw({ type: '*/*', limit: '2mb' }), makeShopifyWebhookHandler(SHOPIFY_APPS.connector));
}

// Limite 10 MB pour permettre image base64 sur generate-lifestyle-image (évite PayloadTooLargeError)
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Chaos Monkey : injection de pannes (staging uniquement, après avoir appelé POST /chaos/trigger)
app.use('/api/v1', chaos.chaosMiddleware);

async function getAccountAccessState(accountId) {
  if (!accountId) {
    // Pas de compte rattaché : evaluateAuthenticatedAccess autorise déjà ce cas.
    return computeAccountAccessState({});
  }
  if (!prismaReady || !prisma) {
    // Base indisponible : état indéterminé => fail-closed (503) côté évaluation.
    return computeAccountAccessState({ indeterminate: true });
  }

  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT trialendsat, billingstatus, paymentgraceuntil FROM "Account" WHERE id = $1::text LIMIT 1`,
      accountId
    );
    const account = rows?.[0] || {};
    return computeAccountAccessState({
      trialEndsAt: account.trialendsat,
      billingStatus: account.billingstatus,
      paymentGraceUntil: account.paymentgraceuntil,
    });
  } catch (err) {
    if (err?.message && /billingstatus|paymentgraceuntil|42703/i.test(err.message)) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT trialendsat FROM "Account" WHERE id = $1::text LIMIT 1`,
          accountId
        );
        const account = rows?.[0] || {};
        return computeAccountAccessState({
          trialEndsAt: account.trialendsat,
        });
      } catch (fallbackErr) {
        console.warn('getAccountAccessState fallback error:', fallbackErr?.message);
        return computeAccountAccessState({ indeterminate: true });
      }
    }
    console.warn('getAccountAccessState error:', err?.message);
    // Erreur DB non liée à un schéma obsolète : état indéterminé => fail-closed.
    return computeAccountAccessState({ indeterminate: true });
  }
}

async function enforceAccountAccess(req, res) {
  const accessState = await getAccountAccessState(req.accountId);
  req.accountAccess = accessState;
  const accessDecision = evaluateAuthenticatedAccess({
    accountId: req.accountId,
    path: req.originalUrl || req.path,
    isStaff: isStaffUser(req),
    accessState,
  });
  if (accessDecision.allowed) {
    return true;
  }
  return res.status(accessDecision.status).json(accessDecision.body);
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token d\'accès requis' });
  }

  try {
    const user = jwt.verify(token, EFFECTIVE_JWT_SECRET, JWT_VERIFY_OPTIONS);
    if (await isTokenRevoked(user)) {
      return res.status(401).json({ message: 'Token révoqué' });
    }
    req.user = user;
    req.accountId = user.accountId;
    if (!req.accountId) {
      return res.status(403).json({ message: 'Compte non associé au token' });
    }
    const accessAllowed = await enforceAccountAccess(req, res);
    if (accessAllowed !== true) return accessAllowed;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token invalide' });
  }
};

/**
 * Middleware d'authentification mixte JWT + Shopify session token.
 * Utilisé sur les routes accessibles depuis l'app embedded Shopify Admin où
 * le merchant n'a pas forcément de JWT FeedPlug (cas BFS : install Shopify →
 * choix de plan → souscription, sans détour par feedplug.com/register).
 *
 * Stratégie :
 *  1. Si le token décrypte comme JWT FeedPlug → comportement classique
 *  2. Sinon, tente verifyShopifySessionToken → identifie le shop → résout
 *     l'Account via le Credential Shopify lié au shop
 *  3. Si aucun Account associé au shop, retourne 409 NO_ACCOUNT_FOR_SHOP
 *     (le frontend peut alors guider vers l'auto-provisioning Shopify-native)
 */
const authenticateJwtOrShopifySession = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token d\'accès requis' });
  }

  // 1) JWT FeedPlug
  try {
    const user = jwt.verify(token, EFFECTIVE_JWT_SECRET, JWT_VERIFY_OPTIONS);
    if (!user?.accountId) {
      // Token JWT bien signé mais sans accountId : on rejette plutôt que de
      // basculer sur Shopify (risque de routage cross-tenant si on tentait
      // l'auto-provisioning derrière).
      return res.status(403).json({ message: 'Compte non associé au token' });
    }
    if (await isTokenRevoked(user)) {
      return res.status(401).json({ message: 'Token révoqué' });
    }
    req.user = user;
    req.accountId = user.accountId;
    const accessAllowed = await enforceAccountAccess(req, res);
    if (accessAllowed !== true) return accessAllowed;
    return next();
  } catch {
    // Bascule sur session token Shopify
  }

  // 2) Shopify session token — embedded = app listée uniquement.
  const listedApp = SHOPIFY_APPS.listed;
  if (!listedApp.apiKey || !listedApp.apiSecret) {
    return res.status(403).json({ message: 'Token invalide' });
  }
  let shopifyAuth;
  try {
    shopifyAuth = verifyShopifySessionToken(token, {
      apiKey: listedApp.apiKey,
      apiSecret: listedApp.apiSecret,
    });
  } catch {
    return res.status(403).json({ message: 'Token invalide' });
  }

  const shop = shopifyAuth.shop;
  if (!shop) {
    return res.status(403).json({ message: 'Session Shopify invalide' });
  }

  // 3) Résolution Account via Credential.shop
  if (!prismaReady || !prisma) {
    return res.status(503).json({ message: 'Service indisponible' });
  }
  try {
    // On limite le token exchange Shopify à une fois toutes les quelques
    // minutes par boutique pour éviter un aller-retour Admin OAuth à chaque
    // requête embedded, tout en gardant un refresh fréquent en cas de
    // réinstallation ou rotation de token.
    try {
      const credRefreshRows = await prisma.$queryRawUnsafe(
        `SELECT id, updatedat FROM "Credential" WHERE connector = 'SHOPIFY'::text AND secretjson->>'shop' = $1::text ORDER BY createdat DESC LIMIT 1`,
        shop
      );
      if (credRefreshRows && credRefreshRows.length > 0 && shouldRefreshShopifyTokenExchange(credRefreshRows[0])) {
        const refreshed = await exchangeShopifySessionToken({
          shop,
          sessionToken: token,
          clientId: SHOPIFY_API_KEY,
          clientSecret: SHOPIFY_API_SECRET,
        });
        await prisma.$executeRawUnsafe(
          `UPDATE "Credential" SET secretjson = $2::jsonb, updatedat = NOW() WHERE id = $1::text`,
          credRefreshRows[0].id,
          stringifyEncryptedJson({
            accessToken: refreshed.accessToken,
            scope: refreshed.scope,
            shop,
          })
        );
      }
    } catch (refreshErr) {
      // Token Exchange peut échouer transitoirement (réseau Shopify, etc.) ;
      // on ne bloque pas l'auth, on continue avec le token existant en DB.
      console.warn(`⚠️ Shopify token refresh skipped for ${shop}: ${refreshErr?.message || refreshErr}`);
    }
    const rows = await prisma.$queryRawUnsafe(
      `
        SELECT s.accountid, a.plan, a.trialendsat, a.billingstatus, a.paymentgraceuntil
        FROM "Credential" c
        JOIN "FeedSource" s ON s.credentialid = c.id
        JOIN "Account" a ON a.id = s.accountid
        WHERE c.connector = 'SHOPIFY'::text
          AND c.secretjson->>'shop' = $1::text
        ORDER BY c.createdat DESC
        LIMIT 1
      `,
      shop
    );
    if (!rows || rows.length === 0) {
      // Fallback : tente l'auto-provisioning à la volée si une Credential
      // existe pour ce shop (cas merchant installé AVANT le déploiement de
      // l'eager provisioning, ou échec transitoire au callback OAuth).
      const credRows = await prisma.$queryRawUnsafe(
        `
          SELECT id, secretjson
          FROM "Credential"
          WHERE connector = 'SHOPIFY'::text
            AND secretjson->>'shop' = $1::text
          ORDER BY createdat DESC
          LIMIT 1
        `,
        shop
      );
      const credRow = credRows?.[0];
      if (credRow) {
        try {
          const secret = decryptObjectSecrets(
            typeof credRow.secretjson === 'string' ? JSON.parse(credRow.secretjson) : credRow.secretjson
          );
          const accessToken = secret.accessToken || secret.access_token;
          if (accessToken) {
            const provision = await shopifyProvisioning.provisionAccountFromShopify({
              prisma,
              shop,
              accessToken,
              credentialId: credRow.id,
            });
            if (provision.accountId) {
              // Re-lookup pour récupérer les colonnes Account fraîches
              const reRows = await prisma.$queryRawUnsafe(
                `SELECT id AS accountid, plan, trialendsat, billingstatus, paymentgraceuntil FROM "Account" WHERE id = $1::text LIMIT 1`,
                provision.accountId
              );
              if (reRows?.length) {
                rows.push(reRows[0]);
                console.log('🔁 Shopify lazy provisioning effectué pour ' + shop + ' (account: ' + provision.accountId + ')');
              }
            }
          }
        } catch (lazyErr) {
          console.warn('⚠️ Shopify lazy provisioning échoué:', lazyErr?.message || lazyErr);
        }
      } else {
        // Managed Installation : Shopify n'appelle plus notre callback OAuth,
        // donc aucune Credential n'a été créée à l'install. Le seul moyen
        // d'obtenir un access_token est le Token Exchange à partir du session
        // token App Bridge (déjà vérifié plus haut). On crée la Credential
        // chiffrée puis on provisionne Account/User/Source/Feed.
        try {
          const exchanged = await exchangeShopifySessionToken({
            shop,
            sessionToken: token,
            clientId: SHOPIFY_API_KEY,
            clientSecret: SHOPIFY_API_SECRET,
          });
          const credId = crypto.randomUUID();
          const now = new Date().toISOString();
          const secretData = stringifyEncryptedJson({
            accessToken: exchanged.accessToken,
            scope: exchanged.scope,
            shop,
          });
          await prisma.$executeRawUnsafe(
            `
              INSERT INTO "Credential" (id, name, connector, secretjson, createdat, updatedat)
              VALUES ($1::text, $2::text, 'SHOPIFY'::text, $3::jsonb, $4::timestamptz, $4::timestamptz)
            `,
            credId,
            `Shopify - ${shop}`,
            secretData,
            now,
          );
          const provision = await shopifyProvisioning.provisionAccountFromShopify({
            prisma,
            shop,
            accessToken: exchanged.accessToken,
            credentialId: credId,
          });
          if (provision.accountId) {
            const reRows = await prisma.$queryRawUnsafe(
              `SELECT id AS accountid, plan, trialendsat, billingstatus, paymentgraceuntil FROM "Account" WHERE id = $1::text LIMIT 1`,
              provision.accountId
            );
            if (reRows?.length) {
              rows.push(reRows[0]);
              console.log(`🔑 Shopify Token Exchange OK pour ${shop} (account: ${provision.accountId}, reason: ${provision.reason || 'new'})`);
            }
          } else {
            console.warn(`⚠️ Shopify Token Exchange OK mais provisioning incomplet pour ${shop}: ${provision.reason}`);
          }
        } catch (exchangeErr) {
          console.warn(`⚠️ Shopify Token Exchange échoué pour ${shop}:`, exchangeErr?.message || exchangeErr);
        }
      }
      if (rows.length === 0) {
        return res.status(409).json({
          code: 'NO_ACCOUNT_FOR_SHOP',
          message: 'Aucun compte FeedPlug lié à cette boutique Shopify',
          shop,
        });
      }
    }
    const row = rows[0];
    req.user = {
      accountId: row.accountid,
      shopifyShop: shop,
      authSource: 'shopify_session',
    };
    req.accountId = row.accountid;
    req.account = {
      plan: row.plan,
      trialEndsAt: row.trialendsat,
      billingStatus: row.billingstatus,
      paymentGraceUntil: row.paymentgraceuntil,
    };
    const accessAllowed = await enforceAccountAccess(req, res);
    if (accessAllowed !== true) return accessAllowed;
    return next();
  } catch (err) {
    console.error('Shopify session auth error:', err);
    return res.status(500).json({ message: 'Erreur authentification Shopify' });
  }
};

// Staff FeedPlug = accès aux données prospect/admin (leads marketing, diagnostic, etc.)
// Un client OWNER de son compte NE DOIT PAS y accéder.
// Vérification par email uniquement — l'accountId est contrôlable via le JWT et ne doit pas être utilisé.
const FEEDPLUG_STAFF_EMAILS = (process.env.FEEDPLUG_STAFF_EMAILS || 'admin@feedplug.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

function isStaffUser(req) {
  if (!req.user) return false;
  return isStaffForUser({ email: req.user.email });
}

function isStaffForUser({ email }) {
  const e = (email || '').toLowerCase();
  return FEEDPLUG_STAFF_EMAILS.includes(e);
}

// Middleware : réservé aux staff FeedPlug (données prospect, diagnostic, etc.)
const requireStaffAccess = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentification requise' });
  if (!isStaffUser(req)) {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs FeedPlug' });
  }
  next();
};

const requireSchemaRepairEnabled = (req, res, next) => {
  const enabled = process.env.ENABLE_SCHEMA_REPAIR_ENDPOINTS === 'true';
  if (process.env.NODE_ENV === 'production' && !enabled) {
    return res.status(404).json({ message: 'Route non disponible' });
  }
  next();
};

// Middleware : requiert un token JWT valide ET extrait accountId. Bloque si absent.
const requireAuth = async (req, res, next) => {
  if (req.path === '/scheduled-runs') {
    return next();
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentification requise' });
  }

  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET, JWT_VERIFY_OPTIONS);
    req.user = decoded;
    req.accountId = decoded.accountId;

    if (!req.accountId) {
      return res.status(403).json({ message: 'Compte non associé au token' });
    }

    const accessAllowed = await enforceAccountAccess(req, res);
    if (accessAllowed !== true) return accessAllowed;
    next();
  } catch (err) {
    // 401 = non authentifié (token manquant/expiré/invalide) → le frontend peut tenter un refresh
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};

// Appliquer requireAuth à TOUTES les routes /api/v1/ingestion, enrichment, optimization, rules, performance
app.use('/api/v1/ingestion', requireAuth);
app.use('/api/v1/enrichment', requireAuth);
app.use('/api/v1/optimization', requireAuth);
app.use('/api/v1/rules', requireAuth);
// Auth mixte sur /performance : le dashboard standalone envoie un JWT, l'app
// Shopify embedded un session token App Bridge. requireAuth (JWT only) rendait
// toutes les routes performance inaccessibles depuis l'app embedded (401).
app.use('/api/v1/performance', authenticateJwtOrShopifySession);

// Middleware auto-vérification d'ownership pour les routes feeds/:id/*.
// Fail-closed : si on ne PEUT pas vérifier (pas d'accountId, DB indispo), on bloque.
app.use('/api/v1/ingestion/feeds/:id', async (req, res, next) => {
  if (!req.params.id) {
    return next();
  }
  if (!req.accountId) {
    return res.status(401).json({ message: 'Authentification requise' });
  }
  if (!prismaReady || !prisma) {
    return res.status(503).json({ message: 'Service temporairement indisponible' });
  }
  const hasAccess = await verifyFeedAccess(req.params.id, req.accountId);
  if (!hasAccess) {
    return res.status(403).json({ message: 'Accès refusé à ce flux' });
  }
  next();
});

// Helper : vérifier qu'un feed appartient au compte (isolation multi-tenant)
async function verifyFeedAccess(feedId, accountId) {
  if (!prismaReady || !prisma) return false; // REFUSER si pas de DB
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Feed" WHERE id = $1::text AND accountid = $2::text`,
      feedId, accountId
    );
    return result && result.length > 0;
  } catch {
    console.error('verifyFeedAccess error for feed', feedId);
    return false; // REFUSER en cas d'erreur
  }
}

// Helper : vérifier qu'une source appartient au compte
async function verifySourceAccess(sourceId, accountId) {
  if (!prismaReady || !prisma) return false;
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT id FROM "FeedSource" WHERE id = $1::text AND accountid = $2::text`,
      sourceId, accountId
    );
    return result && result.length > 0;
  } catch {
    console.error('verifySourceAccess error for source', sourceId);
    return false;
  }
}

// Helper : vérifier qu'un item appartient au compte (via son feed)
async function verifyItemAccess(itemId, accountId) {
  if (!prismaReady || !prisma) return false;
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT i.id FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id WHERE i.id = $1::text AND f.accountid = $2::text`,
      itemId, accountId
    );
    return result && result.length > 0;
  } catch {
    return false;
  }
}

const MARKET_PLATFORM_OPTIONS = [
  'gmc',
  'amazon',
  'meta',
  'tiktok',
  'pinterest',
  'snapchat',
  'bing',
  'cdiscount',
  'rakuten',
  'chatgpt',
  'perplexity',
  'gemini',
];

function parseJsonArray(value, fallback = []) {
  if (!value) return [...fallback];
  if (Array.isArray(value)) return [...value];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [...fallback];
    } catch {
      return [...fallback];
    }
  }
  return [...fallback];
}

function canManageMarkets(req) {
  const role = (req.user && req.user.role) || '';
  return ['OWNER', 'MANAGER'].includes(role);
}

function isMarketsSchemaMissingError(error) {
  const message = error?.message || '';
  return (
    /42P01|42703/.test(message) ||
    /relation .*"(Market|MarketLocale|PlatformAccount|MarketChannel|Destination|ProductActivation)".* does not exist/i.test(message) ||
    /column .*"(countrycodesjson|platformkey|marketchannelid|marketlocaleid)".* does not exist/i.test(message)
  );
}

function getMarketsUnavailableResponse(res, error) {
  if (isMarketsSchemaMissingError(error)) {
    return res.status(503).json({
      message: 'Le module Markets n’est pas encore disponible sur cet environnement. Appliquez les migrations Markets puis réessayez.',
      code: 'markets_schema_missing',
    });
  }
  return null;
}

function normalizeMarketLocaleInput(entry, marketCode, index = 0) {
  const localeCode = normalizeLocaleCode(
    entry?.localeCode || entry?.locale || entry?.languageCode || '',
    marketCode
  );
  const [languageCode = 'en', countryPart] = localeCode.split('-');
  return {
    localeCode,
    languageCode: String(entry?.languageCode || languageCode).toLowerCase(),
    countryCode: normalizeMarketCode(entry?.countryCode || countryPart || marketCode),
    isDefault: entry?.isDefault === true || index === 0,
    isRequiredLaunch: entry?.isRequiredLaunch === true,
    translationMode: String(entry?.translationMode || 'translate').trim() || 'translate',
  };
}

function normalizeMarketChannelInput(entry, marketCode) {
  const source = typeof entry === 'string' ? { platformKey: entry } : (entry || {});
  const platformKey = normalizePlatformKey(source.platformKey || source.platform || source.key || '');
  const settingsJson = parseJsonObject(source.settingsJson || source.settings || {});
  if (platformKey === 'amazon' && !settingsJson.legacyChannelKey) {
    const legacyChannelKey = inferAmazonChannelKeyForMarket(marketCode);
    if (legacyChannelKey) settingsJson.legacyChannelKey = legacyChannelKey;
  }
  return {
    platformKey,
    platformAccountId: source.platformAccountId || source.accountId || null,
    status: String(source.status || 'draft').trim() || 'draft',
    isEnabled: source.isEnabled !== false,
    settingsJson,
  };
}

function platformRequiresConnection(platformKey) {
  return ['gmc', 'amazon'].includes(normalizePlatformKey(platformKey));
}

async function listPlatformAccountsForAccount(accountId) {
  return prisma.$queryRawUnsafe(
    `SELECT * FROM "PlatformAccount" WHERE accountid = $1::text ORDER BY createdat ASC`,
    accountId
  );
}

async function getLegacyMarketContext(accountId) {
  const [billingRows, exportChannels, platformConnections] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT country FROM "Billing" WHERE accountid = $1::text LIMIT 1`,
      accountId
    ).catch(() => []),
    prisma.$queryRawUnsafe(
      `SELECT * FROM "ExportChannel" WHERE accountid = $1::text AND isactive = true ORDER BY createdat ASC`,
      accountId
    ).catch(() => []),
    prisma.$queryRawUnsafe(
      `SELECT * FROM "PlatformConnection" WHERE accountid = $1::text ORDER BY createdat ASC`,
      accountId
    ).catch(() => []),
  ]);

  return {
    billingCountry: normalizeMarketCode(billingRows?.[0]?.country || ''),
    exportChannels: exportChannels || [],
    platformConnections: platformConnections || [],
  };
}

async function backfillPlatformAccountsForAccount(accountId, legacyContext = null) {
  const context = legacyContext || await getLegacyMarketContext(accountId);
  const existing = await listPlatformAccountsForAccount(accountId);
  const existingIndex = new Map(
    (existing || []).map((row) => {
      const key = `${normalizePlatformKey(row.platformkey)}::${row.externalaccountid || ''}`;
      return [key, row];
    })
  );

  for (const connection of context.platformConnections || []) {
    const platformKey = normalizePlatformKey(connection.platform);
    if (!platformKey) continue;
    const metadataJson = parseJsonObject(connection.metadata);
    const externalAccountId = connection.merchantid || metadataJson.catalogId || connection.email || null;
    const lookupKey = `${platformKey}::${externalAccountId || ''}`;
    if (existingIndex.has(lookupKey)) continue;

    const insertedId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "PlatformAccount" (
          id, accountid, platformkey, externalaccountid, externalaccountname,
          credentialsciphertext, credentialsversion, status, metadatajson, createdat, updatedat
        )
        VALUES (
          $1::text, $2::text, $3::text, $4::text, $5::text,
          NULL, 1, $6::text, $7::jsonb, NOW(), NOW()
        )
      `,
      insertedId,
      accountId,
      platformKey,
      externalAccountId,
      metadataJson.accountName || metadataJson.catalogName || connection.email || getPlatformLabel(platformKey),
      connection.status || 'active',
      JSON.stringify({
        legacyConnectionId: connection.id,
        merchantId: connection.merchantid || null,
        email: connection.email || null,
        metadata: metadataJson,
      })
    );
    existingIndex.set(lookupKey, {
      id: insertedId,
      accountid: accountId,
      platformkey: platformKey,
      externalaccountid: externalAccountId,
      externalaccountname: metadataJson.accountName || metadataJson.catalogName || connection.email || getPlatformLabel(platformKey),
      status: connection.status || 'active',
      metadatajson: {
        legacyConnectionId: connection.id,
        merchantId: connection.merchantid || null,
        email: connection.email || null,
        metadata: metadataJson,
      },
    });
  }

  return listPlatformAccountsForAccount(accountId);
}

async function createMarket(accountId, payload) {
  const marketId = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "Market" (
        id, accountid, sourcemarketid, code, name, countrycodesjson, defaultcurrencycode, status,
        pricingpolicyjson, shippingpolicyjson, taxpolicyjson, contentstrategyjson, publicationdefaultsjson,
        createdat, updatedat
      )
      VALUES (
        $1::text, $2::text, $3::text, $4::text, $5::text, $6::jsonb, $7::text, $8::text,
        $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, NOW(), NOW()
      )
    `,
    marketId,
    accountId,
    payload.sourceMarketId || null,
    payload.code,
    payload.name,
    JSON.stringify(payload.countryCodes || [payload.code]),
    payload.defaultCurrencyCode,
    payload.status || 'draft',
    JSON.stringify(payload.pricingPolicyJson || {}),
    JSON.stringify(payload.shippingPolicyJson || {}),
    JSON.stringify(payload.taxPolicyJson || {}),
    JSON.stringify(payload.contentStrategyJson || {}),
    JSON.stringify(payload.publicationDefaultsJson || {})
  );
  return marketId;
}

async function ensureMarketLocales(marketId, marketCode, localesInput = []) {
  const existingLocales = await prisma.$queryRawUnsafe(
    `SELECT id, localecode FROM "MarketLocale" WHERE marketid = $1::text`,
    marketId
  );
  const existingByCode = new Map((existingLocales || []).map((row) => [String(row.localecode).toLowerCase(), row]));
  const desiredLocales = (Array.isArray(localesInput) && localesInput.length > 0 ? localesInput : getDefaultLocalesForMarket(marketCode))
    .map((entry, index) => normalizeMarketLocaleInput(entry, marketCode, index))
    .filter((entry) => entry.localeCode);

  for (let index = 0; index < desiredLocales.length; index += 1) {
    const locale = desiredLocales[index];
    if (existingByCode.has(locale.localeCode.toLowerCase())) continue;
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "MarketLocale" (
          id, marketid, localecode, languagecode, countrycode, isdefault,
          isrequiredlaunch, translationmode, createdat, updatedat
        )
        VALUES (
          $1::text, $2::text, $3::text, $4::text, $5::text, $6::boolean,
          $7::boolean, $8::text, NOW(), NOW()
        )
      `,
      crypto.randomUUID(),
      marketId,
      locale.localeCode,
      locale.languageCode,
      locale.countryCode,
      locale.isDefault === true || index === 0,
      locale.isRequiredLaunch === true,
      locale.translationMode
    );
  }

  return prisma.$queryRawUnsafe(
    `SELECT * FROM "MarketLocale" WHERE marketid = $1::text ORDER BY isdefault DESC, localecode ASC`,
    marketId
  );
}

function pickPlatformAccountId(platformAccounts, platformKey, explicitId = null) {
  const normalizedPlatformKey = normalizePlatformKey(platformKey);
  if (explicitId) {
    const explicit = (platformAccounts || []).find((row) => row.id === explicitId && normalizePlatformKey(row.platformkey) === normalizedPlatformKey);
    if (explicit) return explicit.id;
  }
  return (platformAccounts || []).find((row) => normalizePlatformKey(row.platformkey) === normalizedPlatformKey)?.id || null;
}

async function upsertMarketChannels(marketRow, channelsInput = [], platformAccounts = []) {
  const marketCode = normalizeMarketCode(marketRow.code);
  const marketId = marketRow.id;
  const existingChannels = await prisma.$queryRawUnsafe(
    `SELECT * FROM "MarketChannel" WHERE marketid = $1::text`,
    marketId
  );
  const existingByPlatform = new Map((existingChannels || []).map((row) => [normalizePlatformKey(row.platformkey), row]));
  const desiredChannels = (channelsInput || [])
    .map((entry) => normalizeMarketChannelInput(entry, marketCode))
    .filter((entry) => MARKET_PLATFORM_OPTIONS.includes(entry.platformKey));

  for (const channel of desiredChannels) {
    const platformAccountId = pickPlatformAccountId(platformAccounts, channel.platformKey, channel.platformAccountId);
    const existing = existingByPlatform.get(channel.platformKey);
    if (existing) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "MarketChannel"
          SET platformaccountid = $1::text,
              status = $2::text,
              isenabled = $3::boolean,
              settingsjson = $4::jsonb,
              updatedat = NOW()
          WHERE id = $5::text
        `,
        platformAccountId,
        channel.status,
        channel.isEnabled,
        JSON.stringify(channel.settingsJson || {}),
        existing.id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO "MarketChannel" (
            id, marketid, platformkey, platformaccountid, status, isenabled, settingsjson, createdat, updatedat
          )
          VALUES (
            $1::text, $2::text, $3::text, $4::text, $5::text, $6::boolean, $7::jsonb, NOW(), NOW()
          )
        `,
        crypto.randomUUID(),
        marketId,
        channel.platformKey,
        platformAccountId,
        channel.status,
        channel.isEnabled,
        JSON.stringify(channel.settingsJson || {})
      );
    }
  }

  return prisma.$queryRawUnsafe(
    `SELECT * FROM "MarketChannel" WHERE marketid = $1::text ORDER BY createdat ASC`,
    marketId
  );
}

async function ensureLegacyBackfillForMarket(accountId, marketRow, legacyContext, platformAccounts) {
  const channels = [];
  const marketCode = normalizeMarketCode(marketRow.code);
  const exportChannels = legacyContext.exportChannels || [];
  const platformConnections = legacyContext.platformConnections || [];

  const hasGmcExport = exportChannels.some((row) => String(row.platform || '').toLowerCase() === 'gmc');
  const hasGmcConnection = platformConnections.some((row) => normalizePlatformKey(row.platform) === 'gmc' && String(row.status || 'active').toLowerCase() !== 'disabled');
  if (hasGmcExport || hasGmcConnection) {
    channels.push({
      platformKey: 'gmc',
      status: 'active',
      isEnabled: true,
      settingsJson: { legacyChannelKeys: ['gmc'] },
    });
  }

  const marketAmazonChannels = exportChannels
    .filter((row) => normalizePlatformKey(row.platform) === 'amazon')
    .filter((row) => inferMarketCodeFromAmazonChannelKey(row.channelkey) === marketCode);
  if (marketAmazonChannels.length > 0 || platformConnections.some((row) => normalizePlatformKey(row.platform) === 'amazon')) {
    const legacyChannelKey = marketAmazonChannels[0]?.channelkey || inferAmazonChannelKeyForMarket(marketCode);
    channels.push({
      platformKey: 'amazon',
      status: 'active',
      isEnabled: true,
      settingsJson: {
        legacyChannelKey: legacyChannelKey || null,
        legacyChannelKeys: marketAmazonChannels.map((row) => row.channelkey).filter(Boolean),
        legacyConfig: parseJsonObject(marketAmazonChannels[0]?.config),
      },
    });
  }

  if (platformConnections.some((row) => normalizePlatformKey(row.platform) === 'meta')) {
    channels.push({
      platformKey: 'meta',
      status: 'draft',
      isEnabled: true,
      settingsJson: {},
    });
  }

  if (channels.length > 0) {
    await upsertMarketChannels(marketRow, channels, platformAccounts);
  }
}

async function syncDestinationsForMarket(accountId, marketId) {
  const [marketRows, locales, channels, existingDestinations] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT * FROM "Market" WHERE id = $1::text AND accountid = $2::text LIMIT 1`, marketId, accountId),
    prisma.$queryRawUnsafe(`SELECT * FROM "MarketLocale" WHERE marketid = $1::text ORDER BY isdefault DESC, localecode ASC`, marketId),
    prisma.$queryRawUnsafe(`SELECT * FROM "MarketChannel" WHERE marketid = $1::text ORDER BY createdat ASC`, marketId),
    prisma.$queryRawUnsafe(`SELECT * FROM "Destination" WHERE marketid = $1::text ORDER BY createdat ASC`, marketId),
  ]);

  const marketRow = marketRows?.[0];
  if (!marketRow) return [];

  const availableLocales = locales && locales.length > 0 ? locales : await ensureMarketLocales(marketId, marketRow.code, []);
  const existingBySlug = new Map((existingDestinations || []).map((row) => [String(row.slug), row]));

  for (const channel of channels || []) {
    const settingsJson = parseJsonObject(channel.settingsjson);
    const scope = buildDestinationScope(channel.platformkey, marketRow.code, settingsJson);
    const targetLocales = platformUsesLocales(channel.platformkey) ? availableLocales : [null];

    for (let index = 0; index < targetLocales.length; index += 1) {
      const locale = targetLocales[index];
      const slug = buildDestinationSlug({
        platformKey: channel.platformkey,
        marketCode: marketRow.code,
        localeCode: locale?.localecode || null,
        externalScopeId: settingsJson.legacyChannelKey || scope.externalScopeId || null,
      });
      const existing = existingBySlug.get(slug);
      const configJson = {
        legacyChannelKey: settingsJson.legacyChannelKey || null,
        legacyChannelKeys: parseJsonArray(settingsJson.legacyChannelKeys || [], []),
        marketCode: marketRow.code,
        localeCode: locale?.localecode || null,
        platformLabel: getPlatformLabel(channel.platformkey),
      };

      if (existing) {
        await prisma.$executeRawUnsafe(
          `
            UPDATE "Destination"
            SET marketchannelid = $1::text,
                marketlocaleid = $2::text,
                platformkey = $3::text,
                platformaccountid = $4::text,
                currencycode = $5::text,
                externalscopetype = $6::text,
                externalscopeid = $7::text,
                externalscopelabel = $8::text,
                status = $9::text,
                isprimary = $10::boolean,
                configjson = $11::jsonb,
                updatedat = NOW()
            WHERE id = $12::text
          `,
          channel.id,
          locale?.id || null,
          normalizePlatformKey(channel.platformkey),
          channel.platformaccountid || null,
          scope.currencyCode || getMarketCurrency(marketRow.code),
          scope.externalScopeType,
          scope.externalScopeId || null,
          scope.externalScopeLabel || getPlatformLabel(channel.platformkey),
          channel.status || 'draft',
          index === 0,
          JSON.stringify(configJson),
          existing.id
        );
      } else {
        await prisma.$executeRawUnsafe(
          `
            INSERT INTO "Destination" (
              id, accountid, marketid, marketchannelid, marketlocaleid,
              platformkey, platformaccountid, currencycode,
              externalscopetype, externalscopeid, externalscopelabel,
              slug, status, isprimary, configjson, createdat, updatedat
            )
            VALUES (
              $1::text, $2::text, $3::text, $4::text, $5::text,
              $6::text, $7::text, $8::text,
              $9::text, $10::text, $11::text,
              $12::text, $13::text, $14::boolean, $15::jsonb, NOW(), NOW()
            )
          `,
          crypto.randomUUID(),
          accountId,
          marketId,
          channel.id,
          locale?.id || null,
          normalizePlatformKey(channel.platformkey),
          channel.platformaccountid || null,
          scope.currencyCode || getMarketCurrency(marketRow.code),
          scope.externalScopeType,
          scope.externalScopeId || null,
          scope.externalScopeLabel || getPlatformLabel(channel.platformkey),
          slug,
          channel.status || 'draft',
          index === 0,
          JSON.stringify(configJson)
        );
      }
    }
  }

  return prisma.$queryRawUnsafe(
    `SELECT * FROM "Destination" WHERE marketid = $1::text ORDER BY createdat ASC`,
    marketId
  );
}

function buildMarketReadiness(market) {
  const locales = Array.isArray(market.locales) ? market.locales : [];
  const channels = Array.isArray(market.channels) ? market.channels : [];
  const destinationCount = channels.reduce((sum, channel) => sum + (channel.destinations?.length || 0), 0);
  const missingConnections = channels.filter((channel) => channel.isEnabled && platformRequiresConnection(channel.platformKey) && !channel.platformAccountId).length;
  const enabledChannels = channels.filter((channel) => channel.isEnabled);
  const readyChannels = enabledChannels.filter((channel) => {
    if (platformRequiresConnection(channel.platformKey) && !channel.platformAccountId) return false;
    return (channel.destinations?.length || 0) > 0;
  }).length;
  const status = missingConnections > 0
    ? 'action_required'
    : destinationCount === 0
      ? 'draft'
      : readyChannels === enabledChannels.length
        ? 'ready'
        : 'in_progress';

  return {
    status,
    localeCount: locales.length,
    channelCount: channels.length,
    destinationCount,
    readyChannels,
    missingConnections,
  };
}

async function getHydratedMarketsForAccount(accountId) {
  const markets = await prisma.$queryRawUnsafe(
    `SELECT * FROM "Market" WHERE accountid = $1::text ORDER BY createdat ASC, code ASC`,
    accountId
  );
  if (!markets || markets.length === 0) return [];

  const marketIds = markets.map((row) => row.id);
  const locales = await prisma.$queryRawUnsafe(
    `SELECT * FROM "MarketLocale" WHERE marketid = ANY($1::text[]) ORDER BY isdefault DESC, localecode ASC`,
    marketIds
  );
  const channels = await prisma.$queryRawUnsafe(
    `
      SELECT mc.*, pa.externalaccountname, pa.externalaccountid, pa.status AS platformaccountstatus
      FROM "MarketChannel" mc
      LEFT JOIN "PlatformAccount" pa ON pa.id = mc.platformaccountid
      WHERE mc.marketid = ANY($1::text[])
      ORDER BY mc.createdat ASC
    `,
    marketIds
  );
  const channelIds = (channels || []).map((row) => row.id);
  const destinations = channelIds.length > 0
    ? await prisma.$queryRawUnsafe(
      `SELECT * FROM "Destination" WHERE marketchannelid = ANY($1::text[]) ORDER BY createdat ASC`,
      channelIds
    )
    : [];

  const localesByMarket = new Map();
  for (const locale of locales || []) {
    const list = localesByMarket.get(locale.marketid) || [];
    list.push({
      id: locale.id,
      localeCode: locale.localecode,
      languageCode: locale.languagecode,
      countryCode: locale.countrycode,
      isDefault: locale.isdefault === true,
      isRequiredLaunch: locale.isrequiredlaunch === true,
      translationMode: locale.translationmode || 'translate',
    });
    localesByMarket.set(locale.marketid, list);
  }

  const destinationsByChannel = new Map();
  for (const destination of destinations || []) {
    const list = destinationsByChannel.get(destination.marketchannelid) || [];
    list.push({
      id: destination.id,
      marketLocaleId: destination.marketlocaleid || null,
      platformKey: normalizePlatformKey(destination.platformkey),
      currencyCode: destination.currencycode,
      externalScopeType: destination.externalscopetype,
      externalScopeId: destination.externalscopeid || null,
      externalScopeLabel: destination.externalscopelabel || null,
      slug: destination.slug,
      status: destination.status,
      isPrimary: destination.isprimary === true,
      config: parseJsonObject(destination.configjson),
    });
    destinationsByChannel.set(destination.marketchannelid, list);
  }

  const channelsByMarket = new Map();
  for (const channel of channels || []) {
    const list = channelsByMarket.get(channel.marketid) || [];
    list.push({
      id: channel.id,
      platformKey: normalizePlatformKey(channel.platformkey),
      label: getPlatformLabel(channel.platformkey),
      platformAccountId: channel.platformaccountid || null,
      platformAccountName: channel.externalaccountname || null,
      platformAccountExternalId: channel.externalaccountid || null,
      platformAccountStatus: channel.platformaccountstatus || null,
      status: channel.status || 'draft',
      isEnabled: channel.isenabled !== false,
      settings: parseJsonObject(channel.settingsjson),
      destinations: destinationsByChannel.get(channel.id) || [],
    });
    channelsByMarket.set(channel.marketid, list);
  }

  return (markets || []).map((market) => {
    const payload = {
      id: market.id,
      code: market.code,
      name: market.name,
      status: market.status || 'draft',
      sourceMarketId: market.sourcemarketid || null,
      countryCodes: parseJsonArray(market.countrycodesjson, []),
      defaultCurrencyCode: market.defaultcurrencycode || 'EUR',
      pricingPolicy: parseJsonObject(market.pricingpolicyjson),
      shippingPolicy: parseJsonObject(market.shippingpolicyjson),
      taxPolicy: parseJsonObject(market.taxpolicyjson),
      contentStrategy: parseJsonObject(market.contentstrategyjson),
      publicationDefaults: parseJsonObject(market.publicationdefaultsjson),
      createdAt: market.createdat,
      updatedAt: market.updatedat,
      locales: localesByMarket.get(market.id) || [],
      channels: channelsByMarket.get(market.id) || [],
    };
    return {
      ...payload,
      readiness: buildMarketReadiness(payload),
    };
  });
}

async function ensureMarketsBackfillForAccount(accountId) {
  const legacyContext = await getLegacyMarketContext(accountId);
  const platformAccounts = await backfillPlatformAccountsForAccount(accountId, legacyContext);
  const existingMarkets = await prisma.$queryRawUnsafe(
    `SELECT * FROM "Market" WHERE accountid = $1::text ORDER BY createdat ASC`,
    accountId
  );
  const existingCodes = new Set((existingMarkets || []).map((row) => normalizeMarketCode(row.code)));
  const targetCodes = new Set();

  if (legacyContext.billingCountry) targetCodes.add(legacyContext.billingCountry);
  for (const channel of legacyContext.exportChannels || []) {
    if (normalizePlatformKey(channel.platform) === 'amazon') {
      const inferredCode = inferMarketCodeFromAmazonChannelKey(channel.channelkey);
      if (inferredCode) targetCodes.add(inferredCode);
    }
  }
  if (targetCodes.size === 0) targetCodes.add('FR');

  for (const marketCode of targetCodes) {
    if (!marketCode || existingCodes.has(marketCode)) continue;
    const marketId = await createMarket(accountId, {
      code: marketCode,
      name: getMarketName(marketCode),
      countryCodes: [marketCode],
      defaultCurrencyCode: getMarketCurrency(marketCode),
      status: 'active',
    });
    await ensureMarketLocales(marketId, marketCode, []);
    existingCodes.add(marketCode);
  }

  const refreshedMarkets = await prisma.$queryRawUnsafe(
    `SELECT * FROM "Market" WHERE accountid = $1::text ORDER BY createdat ASC`,
    accountId
  );
  for (const market of refreshedMarkets || []) {
    await ensureMarketLocales(market.id, market.code, []);
    await ensureLegacyBackfillForMarket(accountId, market, legacyContext, platformAccounts);
    await syncDestinationsForMarket(accountId, market.id);
  }
}

// ====== HEALTH & DIAGNOSTIC ======

const HEALTH_DB_TIMEOUT_MS = 5000;

async function getHealthSnapshot() {
  chaos.maybeFailDb();
  let dbOk = false;
  let dbLatencyMs = null;
  if (prismaReady && prisma) {
    const start = Date.now();
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, HEALTH_DB_TIMEOUT_MS, 'Health DB');
      dbOk = true;
      dbLatencyMs = Date.now() - start;
    } catch (err) {
      console.warn('Health check DB:', err?.message || err);
    }
  }

  const ready = prismaReady && dbOk;
  return {
    ready,
    status: ready ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    prismaReady,
    dbOk,
    dbLatencyMs,
  };
}

app.get('/api/v1/health', async (req, res) => {
  const health = await getHealthSnapshot();
  res.status(200).json(health);
});

app.get('/api/v1/ready', async (req, res) => {
  const health = await getHealthSnapshot();
  res.status(health.ready ? 200 : 503).json(health);
});

// Diagnostic endpoint pour vérifier la connexion à la base de données (protégé)
app.get('/api/v1/diagnostic', authenticateToken, requireStaffAccess, async (req, res) => {
  const diagnostic = {
    timestamp: new Date().toISOString(),
    prismaReady: prismaReady,
    hasPrismaClient: !!prisma,
    databaseUrl: process.env.DATABASE_URL ? 
      process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@').substring(0, 100) + '...' : 
      'NOT SET',
    tests: {}
  };

  // Test 1: Connexion Prisma
  if (prisma && prismaReady) {
    try {
      await prisma.$queryRaw`SELECT 1 as test`;
      diagnostic.tests.connection = { status: 'ok', message: 'Connexion réussie' };
    } catch (error) {
      diagnostic.tests.connection = { 
        status: 'error', 
        message: error.message,
        code: error.code,
        meta: error.meta
      };
    }

    // Test 2: Vérifier les tables
    try {
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      diagnostic.tests.tables = { 
        status: 'ok', 
        count: tables.length,
        tables: tables.map(t => t.table_name)
      };
    } catch (error) {
      diagnostic.tests.tables = { 
        status: 'error', 
        message: error.message 
      };
    }

    // Test 3: Vérifier FeedSource
    try {
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "FeedSource"`);
      diagnostic.tests.feedSource = { 
        status: 'ok', 
        count: parseInt(count[0].count) 
      };
    } catch (error) {
      diagnostic.tests.feedSource = { 
        status: 'error', 
        message: error.message,
        code: error.code
      };
    }
  } else {
    diagnostic.tests.connection = { 
      status: 'error', 
      message: 'Prisma n\'est pas initialisé ou prismaReady est false' 
    };
  }

  res.json(diagnostic);
});

// Endpoint pour inspecter la structure de la table
app.get('/api/v1/inspect-table/:tableName', authenticateToken, requireStaffAccess, async (req, res) => {
  if (!prismaReady || !prisma) {
    return res.status(503).json({ message: 'Prisma non disponible' });
  }

  const { tableName } = req.params;
  
  try {
    const tableInfo = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable, column_default, ordinal_position
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, tableName);
    
    res.json({
      tableName,
      columns: tableInfo
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de l\'inspection de la table',
      error: error.message 
    });
  }
});

// Endpoint historique désactivé : les migrations runtime ne sont plus autorisées
app.post('/api/v1/cleanup-feed-table', authenticateToken, requireStaffAccess, requireSchemaRepairEnabled, async (req, res) => {
  return res.status(410).json({
    message: 'Les migrations runtime ont été supprimées. Appliquez les migrations SQL hors process avant démarrage.',
  });
});

// Endpoint historique désactivé : les migrations runtime ne sont plus autorisées
app.post('/api/v1/fix-schema', authenticateToken, requireStaffAccess, requireSchemaRepairEnabled, async (req, res) => {
  return res.status(410).json({
    message: 'Les migrations runtime ont été supprimées. Appliquez les migrations SQL hors process avant démarrage.',
  });
});

// ====== CHAOS MONKEY (staging uniquement) ======
// ====== CHAOS MONKEY (staging uniquement) ======
app.get('/api/v1/chaos/status', authenticateToken, requireStaffAccess, (req, res) => {
  res.json({
    enabled: chaos.isAllowed(),
    production: process.env.NODE_ENV === 'production',
    scenarios: chaos.SCENARIOS,
    message: chaos.isAllowed() ? 'Chaos Monkey actif (staging). Utilise POST /chaos/trigger pour déclencher un scénario.' : 'Désactivé (prod ou CHAOS_MONKEY_ENABLED != true).'
  });
});

app.post('/api/v1/chaos/trigger', authenticateToken, requireStaffAccess, (req, res) => {
  if (!chaos.isAllowed()) {
    return res.status(400).json({ message: 'Chaos Monkey désactivé (production ou CHAOS_MONKEY_ENABLED != true).' });
  }
  const { scenario, ms } = req.body || {};
  if (!scenario || !chaos.SCENARIOS.includes(scenario)) {
    return res.status(400).json({ message: 'Scénario requis: ' + chaos.SCENARIOS.join(', '), scenarios: chaos.SCENARIOS });
  }
  chaos.triggerOnce(scenario, { ms: ms || (scenario === 'latency' ? 5000 : undefined) });
  res.json({ ok: true, scenario, message: `Prochaine requête déclenchera: ${scenario}` });
});

// ====== FEEDS (Ingestion) - endpoints minimaux ======

// Créer une source (FeedSource)
// Optionnel : feedMappingJson = mapping détecté à l'analyse (appliqué au flux créé, évite un PUT séparé)
// ====== INGESTION : 44 routes /api/v1/ingestion/* extraites dans routes/ingestion.js
// (enregistrement plus bas via registerIngestionRoutes, apres init des helpers). ======
// Lister les sources
// Mettre à jour une source
// Supprimer une source
// Créer un feed rattaché à une source
// Lister les feeds
const RULE_FIELD_EXCLUDED_CUSTOM_KEYS = new Set([
  'optimized',
  'optimized_title',
  'optimized_description',
]);

const RULE_FIELD_DIRECT_CUSTOM_KEYS = new Set([
  'google_product_category',
  'product_type',
  'availability',
  'brand',
  'gtin',
  'mpn',
  'condition',
  'color',
  'size',
  'material',
  'pattern',
  'gender',
  'age_group',
  'shipping',
  'tax',
]);

const RULE_FIELD_LABELS = {
  id: 'ID produit',
  title: 'Titre',
  descriptionText: 'Description',
  descriptionHtml: 'Description HTML',
  imageUrl: 'Image principale',
  additional_image_link: 'Images supplémentaires',
  url: 'URL produit',
  brand: 'Marque',
  sku: 'SKU',
  price: 'Prix',
  sale_price: 'Prix promotionnel',
  currency: 'Devise',
  inventory: 'Stock',
  availability: 'Disponibilité',
  gtin: 'GTIN',
  mpn: 'MPN',
  condition: 'État',
  google_product_category: 'Catégorie Google',
  product_type: 'Type produit',
  item_group_id: 'Item group ID',
  color: 'Couleur',
  size: 'Taille',
  material: 'Matière',
  pattern: 'Motif',
  gender: 'Genre',
  age_group: "Tranche d'âge",
  shipping: 'Livraison',
  tax: 'Taxe',
};

function humanizeRuleFieldLabel(fieldKey) {
  const cleaned = String(fieldKey || '')
    .replace(/^customfields\.|^customFields\./, '')
    .replace(/_/g, ' ')
    .trim();

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getRuleFieldLabel(fieldKey) {
  return RULE_FIELD_LABELS[fieldKey] || humanizeRuleFieldLabel(fieldKey);
}

function normalizeRuleCustomFieldKey(key) {
  if (!key) return null;
  if (String(key).startsWith('_')) return null;
  if (RULE_FIELD_EXCLUDED_CUSTOM_KEYS.has(key)) return null;
  return RULE_FIELD_DIRECT_CUSTOM_KEYS.has(key) ? key : `customfields.${key}`;
}

function pushRuleFieldOption(targetMap, fieldKey, source, feedId) {
  if (!fieldKey) return;
  const current = targetMap.get(fieldKey);
  if (current) {
    current.source = current.source === source ? source : 'mixed';
    current.feedIds.add(feedId);
    return;
  }

  targetMap.set(fieldKey, {
    key: fieldKey,
    label: getRuleFieldLabel(fieldKey),
    source,
    feedIds: new Set(feedId ? [feedId] : []),
  });
}

// Mettre à jour un feed
// Endpoint pour créer automatiquement des flux pour les sources existantes sans flux
// Trigger d'une exécution (IngestionRun)
// Sprint 2 (B-PROPER) — polling du statut d'ingestion (background mode). Le
// frontend appelle cet endpoint après un 202 pour suivre PENDING→RUNNING→
// SUCCESS/FAILED. Filtré par compte (sécurité multi-tenant via verifyFeedAccess).
// Endpoint pour forcer la mise à jour des customFields pour tous les produits d'un feed
// ====== SOURCES SECONDAIRES D'ENRICHISSEMENT ======

// Lister les sources secondaires d'un flux
// Créer une source secondaire
// Appliquer manuellement les sources secondaires
// Middleware pour vérifier l'accès aux enrichment sources par id
async function verifyEnrichmentSourceAccess(esId, accountId) {
  if (!prismaReady || !prisma) return false;
  try {
    const r = await prisma.$queryRawUnsafe(`
      SELECT es.id FROM "EnrichmentSource" es
      JOIN "Feed" f ON f.id = es.feedid
      WHERE es.id = $1::text AND f.accountid = $2::text
    `, esId, accountId);
    return r && r.length > 0;
  } catch { return false; }
}

// Mettre à jour une source secondaire
// Supprimer une source secondaire
// Endpoint pour exécuter automatiquement les feeds selon leur horaire programmé
// Cet endpoint est appelé par Cloud Scheduler toutes les heures
// ===== Centre de notifications in-app =====
// Les 4 routes /api/v1/notifications/* (+ le middleware requireAuth associé) sont
// extraites dans routes/notifications.js (pattern routes/ingestion.js). Enregistrées
// plus bas dans run() via registerNotificationsRoutes(app, {...}). Aucun autre chemin
// ne chevauche /api/v1/notifications -> ordre de matching préservé.

// Exports planifiés : pousse automatiquement vers GMC/Amazon les flux dont
// l'auto-push est activé (opt-in `autopush_enabled`). Déclenché par le job
// Cloud Scheduler feedplug-scheduled-exports, protégé par SCHEDULER_SECRET.
app.post('/api/v1/exports/scheduled-runs', async (req, res) => {
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
    if (!timingSafeSecretEqual(providedSecret, schedulerSecret)) {
      return res.status(401).json({ message: 'Non autorisé' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }

    // On évite de re-pousser un flux poussé il y a moins de 23 h (le job tourne
    // toutes les heures ; cela garantit ~1 push/jour et absorbe les retards).
    const MIN_HOURS_BETWEEN_PUSHES = 23;

    let feeds;
    try {
      feeds = await prisma.$queryRawUnsafe(`
        SELECT id, name, accountid
        FROM "Feed"
        WHERE status = 'ACTIVE' AND autopush_enabled = true
      `);
    } catch (err) {
      if (err?.code === 'P2010' || /autopush_enabled/i.test(err?.message || '')) {
        return res.status(503).json({ message: 'Migration 034 (autopush_enabled) non appliquée.' });
      }
      throw err;
    }

    const results = { checked: feeds.length, executed: 0, skipped: 0, errors: [] };

    for (const feed of feeds) {
      try {
        // Plateformes connectées (actives) du compte propriétaire du flux.
        const conns = await prisma.$queryRawUnsafe(
          `SELECT DISTINCT platform FROM "PlatformConnection"
           WHERE accountid = $1::text AND status = 'active'`,
          feed.accountid
        );
        const targets = (conns || [])
          .map((c) => String(c.platform || '').toLowerCase())
          .filter((p) => p === 'gmc' || p === 'amazon');
        if (targets.length === 0) {
          results.skipped++;
          continue;
        }

        for (const platform of targets) {
          // Déduplication : dernier export de ce flux sur cette plateforme.
          const lastRows = await prisma.$queryRawUnsafe(
            `SELECT MAX(createdat) AS last FROM "ExportLog"
             WHERE feedid = $1::text AND platform = $2::text`,
            feed.id, platform
          );
          const lastAt = lastRows?.[0]?.last ? new Date(lastRows[0].last) : null;
          if (lastAt && (Date.now() - lastAt.getTime()) / 3600000 < MIN_HOURS_BETWEEN_PUSHES) {
            results.skipped++;
            continue;
          }

          console.log(`🚀 Auto-push ${platform} du flux ${feed.name} (${feed.id})`);
          if (platform === 'gmc') {
            await executeGmcPush({ accountId: feed.accountid, userId: null, feedId: feed.id });
          } else {
            await executeAmazonPush({ accountId: feed.accountid, feedId: feed.id });
          }
          results.executed++;
        }
      } catch (err) {
        console.error(`Auto-push échoué pour le flux ${feed.id}:`, err?.message || err);
        results.errors.push({ feedId: feed.id, message: err?.message || String(err) });
        createNotification(prisma, feed.accountid, {
          type: 'error',
          priority: 'high',
          title: `Échec de l'export automatique — ${feed.name || 'flux'}`,
          message: `Le push automatique du flux a échoué : ${err?.message || 'erreur inconnue'}.`,
          actionUrl: '/flux',
        }).catch(() => {});
        // Email d'alerte échec d'export
        try {
          const accountEmails = await getAccountEmails(feed.accountid);
          const context = `Export automatique — ${feed.name || feed.id}`;
          for (const email of accountEmails.slice(0, 3)) {
            sendErrorEmail(email, context, err?.message || String(err)).catch((e) => console.warn('Email erreur export (scheduler) non envoyé:', e.message));
          }
        } catch (_) {}
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Scheduled exports error:', error);
    res.status(500).json({ message: 'Erreur lors des exports planifiés' });
  }
});

// ===== Worker de jobs internes (Sprint 2, B-PROPER) =====
// Endpoint cible des Cloud Tasks. Authentifié par secret partagé (SCHEDULER_SECRET)
// comparé en timing-safe, ou par token OIDC vérifié en amont par l'IAM Cloud Run
// (ingress interne). Dispatche vers les handlers idempotents via dispatchJob().
function timingSafeSecretEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) {
    // Comparaison factice de longueur égale pour ne pas court-circuiter le timing.
    try { crypto.timingSafeEqual(ba, Buffer.alloc(ba.length)); } catch (_) {}
    return false;
  }
  try { return crypto.timingSafeEqual(ba, bb); } catch (_) { return false; }
}

// Auth partagée des endpoints déclenchés par Cloud Scheduler / Cloud Tasks.
// Fail-closed : si SCHEDULER_SECRET n'est pas configuré, on refuse (503) au lieu
// de laisser l'endpoint ouvert. Le secret est accepté via l'en-tête dédié
// `x-scheduler-secret` ou `Authorization: Bearer <secret>`, comparé en timing-safe.
// IMPORTANT : la présence seule d'un `Bearer` ne vaut PAS authentification — un
// token OIDC non vérifié n'est pas une preuve tant que l'ingress Cloud Run reste
// public (`--allow-unauthenticated`). Pour s'appuyer sur l'IAM, il faut passer
// l'ingress en interne et vérifier réellement le token OIDC (verifyIdToken).
function checkSchedulerAuth(req) {
  const schedulerSecret = typeof process.env.SCHEDULER_SECRET === 'string'
    ? process.env.SCHEDULER_SECRET.trim()
    : '';
  if (!schedulerSecret) {
    return { ok: false, status: 503, message: 'Scheduler non configuré' };
  }
  const hdr = req.headers['x-scheduler-secret'] || req.headers['authorization'];
  const raw = Array.isArray(hdr) ? hdr[0] : hdr;
  const provided = typeof raw === 'string' ? raw.replace(/^Bearer /i, '').trim() : '';
  if (!timingSafeSecretEqual(provided, schedulerSecret)) {
    return { ok: false, status: 401, message: 'Non autorisé' };
  }
  return { ok: true };
}

// Construit l'objet feed (avec source) attendu par les modules d'ingestion,
// à partir du seul feedId. Partagé par runIngestionJob.
async function loadFeedForIngestion(feedId) {
  const feeds = await prisma.$queryRawUnsafe(`
    SELECT
      f.id, f.name, f.sourceid,
      COALESCE(f.mappingjson, '{}'::jsonb) as "mappingJson",
      COALESCE(f.mappingjson, '{}'::jsonb) as "mappingjson",
      json_build_object(
        'id', s.id, 'name', s.name, 'connector', s.connector,
        'configJson', s.configjson, 'configjson', s.configjson,
        'credentialId', s.credentialid
      ) as source
    FROM "Feed" f JOIN "FeedSource" s ON f.sourceid = s.id
    WHERE f.id = $1::text
  `, feedId);
  return feeds && feeds.length > 0 ? feeds[0] : null;
}

// Handler idempotent d'ingestion en background. Met à jour l'IngestionRun fourni
// (créé en PENDING par le routeur). Réutilise les mêmes modules d'ingestion que
// le chemin synchrone — pas de logique métier dupliquée côté écriture FeedItem.
// Idempotence : le run est piloté par `ingestionRunId` ; ré-exécuter ré-importe
// (upserts par (feedid, originid)), sans doublon produit.
async function runIngestionJob({ feedId, accountId, ingestionRunId }) {
  if (!prismaReady || !prisma) throw new Error('Prisma non disponible (runIngestionJob)');
  if (!feedId) throw new Error('feedId requis (runIngestionJob)');
  const nowIso = new Date().toISOString();
  if (ingestionRunId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "IngestionRun" SET status = 'RUNNING', startedat = $1::timestamptz WHERE id = $2::text`,
      nowIso, ingestionRunId
    ).catch(() => {});
  }
  try {
    const feed = await loadFeedForIngestion(feedId);
    if (!feed) throw new Error('Feed introuvable: ' + feedId);
    const sourceConfig = feed.source.configJson || feed.source.configjson || {};
    const connector = feed.source.connector;
    const feedObj = {
      id: feed.id,
      name: feed.name,
      sourceId: feed.sourceid,
      mappingJson: feed.mappingJson || feed.mappingjson || {},
      mappingjson: feed.mappingJson || feed.mappingjson || {},
    };
    let result;

    if (connector === 'SHOPIFY') {
      const shop = sourceConfig.shop || sourceConfig.Shop;
      const credentialId = feed.source.credentialId;
      if (!credentialId || !shop) throw new Error('Source Shopify mal configurée');
      const creds = await prisma.$queryRawUnsafe(`SELECT secretjson FROM "Credential" WHERE id = $1::text`, credentialId);
      if (!creds || creds.length === 0) throw new Error('Credential Shopify introuvable');
      const secretData = decryptObjectSecrets(typeof creds[0].secretjson === 'string' ? JSON.parse(creds[0].secretjson) : creds[0].secretjson);
      const accessToken = secretData.accessToken || secretData.access_token;
      if (!accessToken) throw new Error('Token Shopify manquant');
      const normalizedShop = normalizeShopifyShop(shop);
      if (!normalizedShop) throw new Error('Boutique Shopify invalide');
      result = await ingestShopifyFromApi({ prisma, feed: feedObj, shop: normalizedShop, accessToken });
    } else if (connector === 'PRESTASHOP') {
      const shopUrl = sourceConfig.shopUrl || sourceConfig.shopurl || sourceConfig.baseUrl || sourceConfig.baseurl;
      const apiKey = sourceConfig.apiKey || sourceConfig.apikey;
      if (!shopUrl || !apiKey) throw new Error('Source PrestaShop mal configurée');
      result = await ingestPrestashopFromApi({
        prisma, feed: feedObj,
        shopUrl: String(shopUrl).trim().replace(/\/+$/, ''),
        apiKey: String(apiKey).trim(),
      });
    } else if (connector === 'CSV') {
      let csvUrl = sourceConfig.csvUrl || sourceConfig.csvurl;
      const gcsPath = sourceConfig.gcsPath || sourceConfig.gcspath;
      let csvText = null;
      if (gcsPath && gcsPath.startsWith('gs://')) {
        const gcsMatch = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
        if (gcsMatch) {
          const [, gcsBucket, gcsFileName] = gcsMatch;
          const [content] = await storage.bucket(gcsBucket).file(gcsFileName).download();
          csvText = content.toString('utf-8');
        }
      }
      if (!csvUrl && !csvText) throw new Error('csvUrl/gcsPath manquant');
      result = await ingestCsvFromUrl({ prisma, feed: feedObj, csvUrl: csvText ? undefined : csvUrl, csvText });
    } else {
      throw new Error('Connecteur non supporté en background: ' + connector);
    }

    // Hooks post-ingestion (mêmes que le chemin synchrone, best-effort).
    try {
      const { applyRulesOnIngestion } = require('./rules/engine');
      await applyRulesOnIngestion(prisma, feed.id, accountId, createRevision);
    } catch (rulesErr) { console.warn('⚠️ Règles non appliquées (job):', rulesErr.message); }
    try {
      await applyEnrichmentSources(prisma, feed.id, accountId, storage);
    } catch (enrichErr) { console.warn('⚠️ Enrichissement non appliqué (job):', enrichErr.message); }

    await prisma.$executeRawUnsafe(
      `UPDATE "FeedSource" SET lastrunat = $1::timestamptz, updatedat = $1::timestamptz WHERE id = $2::text`,
      nowIso, feed.sourceid
    ).catch(() => {});

    if (ingestionRunId) {
      await prisma.$executeRawUnsafe(
        `UPDATE "IngestionRun" SET status = 'SUCCESS', finishedat = $1::timestamptz,
           totalfetched = $2::int, totalinserted = $3::int, totalupdated = $4::int
         WHERE id = $5::text`,
        new Date().toISOString(),
        result?.totalFetched ?? 0, result?.totalInserted ?? 0, result?.totalUpdated ?? 0,
        ingestionRunId
      ).catch(() => {});
    }

    // Déclenchement des jobs aval (auto-optim/push/LIA) comme le chemin synchrone.
    if (connector === 'SHOPIFY') {
      scheduleAutoOptimization(accountId, feed.id, 'ingestion Shopify (job)');
      scheduleAutoLiaSync(accountId, 'ingestion Shopify (job)');
    } else {
      scheduleAutoGmcPush(accountId, feed.id, `ingestion ${connector} (job)`);
    }

    // Email best-effort.
    try {
      const accountEmails = await getAccountEmails(accountId);
      const stats = { totalFetched: result?.totalFetched ?? 0, totalInserted: result?.totalInserted ?? 0, totalUpdated: result?.totalUpdated ?? 0 };
      for (const email of accountEmails.slice(0, 3)) {
        sendSyncCompleteEmail(email, feed.name || `Flux ${String(feed.id).substring(0, 8)}`, stats).catch(() => {});
      }
    } catch (_) {}

    return { ok: true, ...(result || {}) };
  } catch (err) {
    if (ingestionRunId) {
      await prisma.$executeRawUnsafe(
        `UPDATE "IngestionRun" SET status = 'FAILED', finishedat = $1::timestamptz, errormessage = $2::text WHERE id = $3::text`,
        new Date().toISOString(), String(err?.message || err).substring(0, 500), ingestionRunId
      ).catch(() => {});
    }
    throw err;
  }
}

// Endpoint worker interne : reçoit { type, payload } depuis Cloud Tasks.
app.post('/internal/jobs/run', express.json({ limit: '256kb' }), async (req, res) => {
  const auth = checkSchedulerAuth(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }
  const { type, payload } = req.body || {};
  if (!type || typeof type !== 'string') {
    return res.status(400).json({ message: 'type requis' });
  }
  try {
    const result = await dispatchJob(type, payload || {});
    // 200 = succès, pas de retry Cloud Tasks. Les handlers no-op renvoient aussi 200.
    return res.json({ ok: true, type, result: result || null });
  } catch (err) {
    console.error(`❌ [jobs] worker ${type} échoué:`, err?.message || err);
    // 500 → Cloud Tasks retentera (backoff). Les handlers étant idempotents, le
    // retry est sûr.
    return res.status(500).json({ ok: false, type, error: err?.message || String(err) });
  }
});

// ===== Scheduler de sync des performances régies (reporting pré-launch) =====
// Cible Cloud Scheduler (job quotidien à créer côté infra, voir ARCHITECTURE).
// Authentifié par SCHEDULER_SECRET (timing-safe) ou OIDC (IAM Cloud Run amont),
// même classe que /api/v1/exports/scheduled-runs et /internal/jobs/run.
// Énumère les comptes ayant une connexion régie active (google_ads / meta /
// amazon_ads) et enqueue la sync perf correspondante (dédup journalière). Ne
// déclenche PAS la sync en synchrone : on passe par enqueueJob (Cloud Tasks en
// prod, fallback in-process en dev) pour étaler la charge et bénéficier des retries.
app.post('/internal/sync/performance', express.json({ limit: '64kb' }), async (req, res) => {
  const auth = checkSchedulerAuth(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }
  if (!prismaReady || !prisma) {
    return res.status(503).json({ message: 'Service indisponible' });
  }
  try {
    // Une ligne par (compte, plateforme régie active). DISTINCT pour éviter les
    // doublons si plusieurs connexions de même plateforme existaient.
    const rows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT accountid, platform FROM "PlatformConnection"
       WHERE status = 'active' AND platform IN ('google_ads', 'meta', 'amazon_ads')`
    );
    const results = { google_ads: 0, meta: 0, amazon_ads: 0, accounts: 0 };
    const seenAccounts = new Set();
    for (const row of rows || []) {
      const accountId = row.accountid;
      const platform = String(row.platform || '').toLowerCase();
      if (!accountId) continue;
      seenAccounts.add(accountId);
      if (platform === 'google_ads') {
        await scheduleSyncGoogleAdsPerformance(accountId, 'scheduler');
        results.google_ads++;
      } else if (platform === 'meta') {
        await scheduleSyncMetaAdsPerformance(accountId, 'scheduler');
        results.meta++;
      } else if (platform === 'amazon_ads') {
        await scheduleSyncAmazonAdsPerformance(accountId, 'scheduler');
        results.amazon_ads++;
      }
    }
    results.accounts = seenAccounts.size;
    return res.json({ ok: true, enqueued: results });
  } catch (e) {
    console.error('Scheduler sync performance error:', e);
    return res.status(500).json({ message: 'Erreur scheduler sync performance', error: e.message });
  }
});

// Récupérer les items d'un feed (option: ?q= pour recherche titre/sku/brand)
// ── Scoring d'audit de flux extrait dans scoring/feed-audit.js (bloc 5) ──────
// Helpers purs d'agregation post-ingestion : buildAuditSummaryFromItems (couverture
// des champs depuis les items bruts), calculateFeedAuditSummary (agrege scores produit
// + couverture -> rapport feed-level avec piliers/bands/topIssues) et buildFeedAuditIssues.
// Aucune dependance a l'etat serveur ; ré-exposes ici via des const locales pour
// preserver les signatures vues par les appelants (maybeGenerateMarketingAuditReport,
// endpoint d'audit). Comportement strictement identique.
const feedAuditScoring = require('./scoring/feed-audit');
const buildFeedAuditIssues = feedAuditScoring.buildFeedAuditIssues;
const calculateFeedAuditSummary = feedAuditScoring.calculateFeedAuditSummary;
const buildAuditSummaryFromItems = feedAuditScoring.buildAuditSummaryFromItems;

async function refreshGoogleAccessTokenFromRefreshToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('Refresh token Google manquant');
  }
  const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return {
    accessToken: credentials.access_token || null,
    tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
  };
}

async function fetchMarketingAuditShopifyItems(audit, input = {}) {
  const connection = input.shopifyConnection || {};
  const secretId = connection.credentialId;
  const shop = connection.shop || (audit.shopurl ? String(audit.shopurl).replace(/^https?:\/\//, '').replace(/\/+$/, '') : '');
  if (!secretId || !shop) {
    throw new Error('Connexion Shopify incomplete');
  }
  const rows = await prisma.$queryRawUnsafe(`SELECT secretjson FROM "Credential" WHERE id = $1::text LIMIT 1`, secretId);
  const credential = rows?.[0];
  if (!credential) {
    throw new Error('Credential Shopify introuvable');
  }
  const secret = decryptObjectSecrets(typeof credential.secretjson === 'string' ? JSON.parse(credential.secretjson || '{}') : (credential.secretjson || {}));
  const accessToken = secret.accessToken || secret.access_token;
  if (!accessToken) {
    throw new Error('Token Shopify introuvable');
  }
  const products = await fetchAllShopifyProducts({ shop, accessToken, limit: 100, maxItems: 250 });
  return products.map((product) => ({
    title: product.variantTitle ? `${product.title} - ${product.variantTitle}` : product.title,
    descriptionText: product.description || null,
    descriptionHtml: product.descriptionHtml || null,
    imageUrl: product.imageUrl || null,
    brand: product.vendor || null,
    category: product.productType || null,
    productType: product.productType || null,
    sku: product.sku || null,
    mpn: product.sku || null,
    gtin: null,
    price: product.price,
    currency: product.currency || 'EUR',
    url: product.handle ? `https://${shop.replace(/\/+$/, '')}/products/${product.handle}` : null,
    inventory: product.inventory !== null && product.inventory !== undefined ? Number(product.inventory) : null,
    availability: Number(product.inventory || 0) > 0 ? 'in stock' : 'out of stock',
  }));
}

async function fetchMarketingAuditPrestashopItems(audit, input = {}) {
  const connection = decryptObjectSecrets(input.prestashopConnection || {});
  const shopUrl = connection.shopUrl || input.shopUrl || audit.shopurl;
  const apiKey = connection.apiKey || null;
  if (!shopUrl || !apiKey) {
    throw new Error('Connexion PrestaShop incomplete');
  }
  const products = await fetchPrestashopProducts({ baseUrl: shopUrl, apiKey, limit: 250 });
  const buildPrestashopPublicImageUrl = (baseUrl, imageId) => {
    const normalizedBase = String(baseUrl || '').trim().replace(/\/+$/, '');
    const normalizedImageId = String(imageId || '').trim();
    if (!normalizedBase || !normalizedImageId) return null;
    return `${normalizedBase}/img/p/${normalizedImageId.split('').join('/')}/${normalizedImageId}-large_default.jpg`;
  };
  return products.map((product) => {
    const productId = String(product.id || '').trim();
    const linkRewrite = Array.isArray(product.link_rewrite?.language)
      ? product.link_rewrite.language[0]?.['#text'] || product.link_rewrite.language[0]
      : product.link_rewrite?.language?.['#text'] || product.link_rewrite?.language || null;
    const name = Array.isArray(product.name?.language)
      ? product.name.language[0]?.['#text'] || product.name.language[0]
      : product.name?.language?.['#text'] || product.name?.language || `Produit ${productId}`;
    const descriptionHtml = Array.isArray(product.description?.language)
      ? product.description.language[0]?.['#text'] || product.description.language[0]
      : product.description?.language?.['#text'] || product.description?.language || null;
    const descriptionText = Array.isArray(product.description_short?.language)
      ? product.description_short.language[0]?.['#text'] || product.description_short.language[0]
      : product.description_short?.language?.['#text'] || product.description_short?.language || null;
    const defaultImageId = product.id_default_image?.['#text'] || product.id_default_image || null;
    const normalizedBase = String(shopUrl).replace(/\/+$/, '');
    const price = product.price != null && product.price !== '' ? Number(product.price) : null;
    const inventory = product.quantity != null && product.quantity !== '' ? Number(product.quantity) : null;
    return {
      title: name || `Produit ${productId}`,
      descriptionText: descriptionText || null,
      descriptionHtml: descriptionHtml || null,
      imageUrl: buildPrestashopPublicImageUrl(normalizedBase, defaultImageId),
      brand: product.manufacturer_name || null,
      category: product.id_category_default || null,
      productType: product.id_category_default || null,
      sku: product.reference || null,
      mpn: product.reference || null,
      gtin: product.ean13 || product.upc || null,
      price,
      currency: 'EUR',
      url: linkRewrite ? `${normalizedBase}/${productId}-${String(linkRewrite).trim()}.html` : null,
      inventory: Number.isFinite(inventory) ? inventory : null,
      availability: Number(inventory || 0) > 0 ? 'in stock' : 'out of stock',
    };
  });
}

function getTextValue(value) {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return null;
  if (typeof value['#text'] === 'string') return value['#text'].trim() || null;
  if (typeof value.__cdata === 'string') return value.__cdata.trim() || null;
  return null;
}

function parseAuditCsvRows(text) {
  const { parse } = require('csv-parse/sync');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const countCols = (delimiter) => firstLine.split(delimiter).length;
  const candidates = [',', '\t', ';', '|'];
  let delimiter = ',';
  let best = 0;
  for (const candidate of candidates) {
    const cols = countCols(candidate);
    if (cols > best) {
      best = cols;
      delimiter = candidate;
    }
  }
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    delimiter,
    relax_quotes: true,
    relax_column_count: true,
  });
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value || '{}') || {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
}

// Parse le champ `customfields` d'un FeedItem (string JSON ou objet) en objet.
// Alias historique attendu par le code destinations/activations (était appelé
// sans être défini → ReferenceError → 500 sur GET .../destinations).
function parseProductCustomFields(value) {
  return parseJsonObject(value);
}

function decryptPlatformConnection(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    accesstoken: decryptSecret(row.accesstoken),
    refreshtoken: decryptSecret(row.refreshtoken),
    metadata: decryptObjectSecrets(parseJsonObject(row.metadata)),
  };
}

function stringifyEncryptedJson(value) {
  return JSON.stringify(encryptObjectSecrets(value || {}));
}

async function upsertPlatformConnection({
  accountId,
  platform,
  merchantId = null,
  accessToken = null,
  refreshToken = null,
  tokenExpiry = null,
  email = null,
  status = 'active',
  metadata = {},
}) {
  if (!prismaReady || !prisma || !accountId || !platform) return;

  const metadataJson = typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {});
  const existing = await prisma.$queryRawUnsafe(`
    SELECT id FROM "PlatformConnection" WHERE accountid = $1::text AND platform = $2::text LIMIT 1
  `, accountId, platform);

  if (existing && existing.length > 0) {
    await prisma.$executeRawUnsafe(`
      UPDATE "PlatformConnection"
      SET merchantid = $1::text,
          accesstoken = $2::text,
          refreshtoken = COALESCE($3::text, refreshtoken),
          tokenexpiry = $4::timestamptz,
          email = $5::text,
          status = $6::text,
          metadata = $7::jsonb,
          updatedat = NOW()
      WHERE accountid = $8::text AND platform = $9::text
    `, merchantId, accessToken, refreshToken, tokenExpiry, email, status, metadataJson, accountId, platform);
    return;
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO "PlatformConnection" (id, accountid, platform, merchantid, accesstoken, refreshtoken, tokenexpiry, email, status, metadata, createdat, updatedat)
    VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::timestamptz, $8::text, $9::text, $10::jsonb, NOW(), NOW())
  `, crypto.randomUUID(), accountId, platform, merchantId, accessToken, refreshToken, tokenExpiry, email, status, metadataJson);
}

function normalizeAppLocale(locale) {
  const normalized = String(locale || '').trim().toLowerCase();
  if (!normalized) return 'fr';
  return /^[a-z]{2}(?:-[a-z]{2})?$/.test(normalized) ? normalized : 'fr';
}

function buildLocalizedAppUrl(appUrl, locale, pathname) {
  const safeLocale = normalizeAppLocale(locale);
  const safePath = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${String(pathname || '/')}`;
  return `${appUrl}/${safeLocale}${safePath}`;
}

function buildFluxRedirectUrl(appUrl, locale, params = {}) {
  const target = new URL(buildLocalizedAppUrl(appUrl, locale, '/flux'));
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    target.searchParams.set(key, String(value));
  }
  return target.toString();
}

// Redirige une surface dashboard vers le `returnTo` stocké (ex. /fr/channels)
// quand il est sûr, sinon retombe EXACTEMENT sur `fallbackBaseUrl` (comportement
// historique : /flux pour GMC, /performance pour Google Ads). Sert à ramener
// l'utilisateur sur la page d'où il a lancé la connexion.
function buildSurfaceReturnRedirectUrl(appUrl, returnTo, fallbackBaseUrl, params = {}) {
  const safe = normalizeDashboardReturnTo(returnTo, '');
  const target = safe ? new URL(safe, appUrl) : new URL(fallbackBaseUrl);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    target.searchParams.set(key, String(value));
  }
  return target.toString();
}

function normalizeEmbeddedReturnTo(value, fallback = '/embedded/channels') {
  const raw = String(value || '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || !raw.startsWith('/embedded')) {
    return fallback;
  }
  try {
    const target = new URL(raw, 'https://embedded.feedplug.local');
    return `${target.pathname}${target.search}`;
  } catch {
    return fallback;
  }
}

// Helpers dashboard (hors Shopify) extraits dans lib/platform-redirects.js pour
// être testables en isolation. Le wrapper local injecte APP_URL.
const {
  normalizeDashboardReturnTo,
  buildDashboardRedirectUrl: buildDashboardRedirectUrlBase,
} = require('./lib/platform-redirects');

function buildDashboardRedirectUrl(returnTo, params = {}, fallback = '/flux') {
  return buildDashboardRedirectUrlBase(APP_URL, returnTo, params, fallback);
}

async function buildEmbeddedShopifyAdminRedirectUrl({
  accountId,
  shop,
  returnTo = '/embedded/channels',
  fallbackUrl,
  params = {},
}) {
  const targetPath = new URL(
    normalizeEmbeddedReturnTo(returnTo, '/embedded/channels'),
    'https://embedded.feedplug.local'
  );
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    targetPath.searchParams.set(key, String(value));
  }

  let resolvedShop = normalizeShopifyShop(shop || '');
  if (!resolvedShop && accountId) {
    try {
      const credential = await findShopifyCredentialForAccount(accountId);
      resolvedShop = credential?.shop || '';
    } catch (error) {
      console.warn('⚠️ Impossible de résoudre le shop Shopify pour redirect embedded:', error?.message || error);
    }
  }

  if (resolvedShop && SHOPIFY_API_KEY) {
    const adminUrl = new URL(`https://${resolvedShop}/admin/apps/${encodeURIComponent(SHOPIFY_API_KEY)}`);
    adminUrl.searchParams.set('returnTo', `${targetPath.pathname}${targetPath.search}`);
    return adminUrl.toString();
  }

  const fallback = new URL(String(fallbackUrl || APP_URL || 'https://app.feedplug.com'));
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    fallback.searchParams.set(key, String(value));
  }
  return fallback.toString();
}

// Bloc 2 : extrait dans domains/gmc/push.js (helper pur). Re-export tel quel.
const parseGmcMerchantOptions = gmcDomain.parseGmcMerchantOptions;

// Enrichit chaque option Merchant Center avec son nom lisible. `accounts/authinfo`
// ne renvoie que les IDs ; on appelle accounts.get par compte (best-effort, en
// parallèle) pour récupérer le nom. Un client avec plusieurs GMC voit ainsi
// "Nom (ID)" au lieu d'un ID nu et peut choisir le bon compte.
// Bloc 2 : extrait dans domains/gmc/push.js (factory DI, a besoin de fetch).
// Wrapper de signature inchangee deleguant a l'instance gmcPush (affectee au boot).
async function enrichGmcMerchantNames(options, accessToken) {
  return gmcPush.enrichGmcMerchantNames(options, accessToken);
}

async function revokeGoogleOAuthToken(token) {
  const value = String(token || '').trim();
  if (!value) return;
  try {
    const body = new URLSearchParams({ token: value }).toString();
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (error) {
    console.warn('Google OAuth revoke skipped:', error?.message || error);
  }
}

async function saveGmcConnection({
  accountId,
  merchant,
  encryptedAccessToken,
  encryptedRefreshToken,
  tokenExpiry,
  email,
  scope,
}) {
  if (!accountId || !merchant?.merchantId) {
    throw new Error('Merchant Center indisponible pour cette connexion');
  }

  await upsertPlatformConnection({
    accountId,
    platform: 'gmc',
    merchantId: merchant.merchantId,
    accessToken: encryptedAccessToken,
    refreshToken: encryptedRefreshToken,
    tokenExpiry,
    email,
    status: 'active',
    metadata: {
      merchantName: merchant.merchantName || '',
      aggregatorId: merchant.aggregatorId || '',
      scope: scope || '',
    },
  });
}

function buildAuditCsvItemsFromRows(rows = []) {
  const normalizeKey = (value) => String(value || '').replace(/^[\uFEFF\s]+/, '').trim().toLowerCase();
  const findValue = (row, keys) => {
    const entries = Object.entries(row || {});
    for (const [key, value] of entries) {
      if (keys.includes(normalizeKey(key)) && value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
    return null;
  };

  return rows.slice(0, 250).map((row) => {
    const priceRaw = findValue(row, ['price', 'prix', 'sale_price']);
    const availabilityRaw = findValue(row, ['availability', 'stock', 'quantity']);
    return {
      title: findValue(row, ['title', 'name', 'product_title']) || null,
      descriptionText: findValue(row, ['description', 'description_text', 'product_description']) || null,
      descriptionHtml: findValue(row, ['description_html']) || null,
      imageUrl: findValue(row, ['image_link', 'image', 'image_url']) || null,
      brand: findValue(row, ['brand', 'vendor', 'marque']) || null,
      category: findValue(row, ['google_product_category', 'product_type', 'category']) || null,
      productType: findValue(row, ['product_type', 'category']) || null,
      sku: findValue(row, ['id', 'sku', 'item_id', 'product_id']) || null,
      mpn: findValue(row, ['mpn']) || null,
      gtin: findValue(row, ['gtin', 'ean', 'ean13', 'upc', 'barcode']) || null,
      price: priceRaw ? Number(String(priceRaw).replace(/[^\d.,-]/g, '').replace(',', '.')) : null,
      currency: findValue(row, ['currency']) || 'EUR',
      url: findValue(row, ['link', 'url']) || null,
      inventory: null,
      availability: availabilityRaw ? String(availabilityRaw).toLowerCase() : null,
      condition: findValue(row, ['condition']) || null,
    };
  });
}

function buildAuditXmlItems(text) {
  const { XMLParser } = require('fast-xml-parser');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: true });
  const data = parser.parse(text);
  const rawItems = data?.rss?.channel?.item || data?.feed?.entry || data?.products?.product || data?.prestashop?.products?.product || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  return items.slice(0, 250).map((item) => ({
    title: getTextValue(item.title) || getTextValue(item.name) || null,
    descriptionText: getTextValue(item.description) || getTextValue(item.summary) || null,
    descriptionHtml: getTextValue(item.description) || null,
    imageUrl: getTextValue(item['g:image_link']) || getTextValue(item.image_link) || getTextValue(item.image) || null,
    brand: getTextValue(item['g:brand']) || getTextValue(item.brand) || null,
    category: getTextValue(item['g:google_product_category']) || getTextValue(item['g:product_type']) || getTextValue(item.category) || null,
    productType: getTextValue(item['g:product_type']) || getTextValue(item.category) || null,
    sku: getTextValue(item['g:id']) || getTextValue(item.id) || null,
    mpn: getTextValue(item['g:mpn']) || getTextValue(item.mpn) || null,
    gtin: getTextValue(item['g:gtin']) || getTextValue(item.gtin) || null,
    price: (() => {
      const rawPrice = getTextValue(item['g:price']) || getTextValue(item.price);
      return rawPrice ? Number(String(rawPrice).replace(/[^\d.,-]/g, '').replace(',', '.')) : null;
    })(),
    currency: 'EUR',
    url: getTextValue(item.link) || getTextValue(item.url) || null,
    inventory: null,
    availability: getTextValue(item['g:availability']) || getTextValue(item.availability) || null,
    condition: getTextValue(item['g:condition']) || getTextValue(item.condition) || null,
  }));
}

async function fetchMarketingAuditFileItems(audit, input = {}) {
  const connection = input.csvConnection || {};
  const feedUrl = connection.feedUrl || input.shopUrl || audit.shopurl;
  if (!feedUrl) {
    throw new Error('URL de flux introuvable');
  }
  // SSRF guard : on refuse les IP internes / metadata cloud — l'URL vient d'un
  // formulaire prospect non authentifié.
  const { safeFetch } = require('./lib/safe-url');
  const response = await safeFetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Erreur recuperation flux ${response.status}`);
  }
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Flux vide');
  }
  return trimmed.startsWith('<')
    ? buildAuditXmlItems(trimmed)
    : buildAuditCsvItemsFromRows(parseAuditCsvRows(trimmed));
}

async function fetchMarketingAuditGmcData(audit, input = {}) {
  const connection = decryptObjectSecrets(input.gmcConnection || {});
  let accessToken = connection.accessToken || null;
  const refreshToken = connection.refreshToken || null;
  const merchantId = connection.merchantId || audit.merchantid || audit.merchantId;
  if (!merchantId) {
    throw new Error('Merchant ID introuvable');
  }

  const fetchJson = async (url) => {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 401 && refreshToken) {
      const refreshed = await refreshGoogleAccessTokenFromRefreshToken(refreshToken);
      accessToken = refreshed.accessToken;
      connection.accessToken = refreshed.accessToken;
      connection.tokenExpiry = refreshed.tokenExpiry;
      input.gmcConnection = connection;
      await prisma.$executeRawUnsafe(`
        UPDATE marketing_audits
        SET inputjson = $1::jsonb, "updatedAt" = NOW()
        WHERE id = $2::text
      `, stringifyEncryptedJson(input), audit.id);
      const retry = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!retry.ok) {
        throw new Error(`Erreur GMC ${retry.status}`);
      }
      return retry.json();
    }
    if (!response.ok) {
      throw new Error(`Erreur GMC ${response.status}`);
    }
    return response.json();
  };

  if (!accessToken && refreshToken) {
    const refreshed = await refreshGoogleAccessTokenFromRefreshToken(refreshToken);
    accessToken = refreshed.accessToken;
    connection.accessToken = refreshed.accessToken;
    connection.tokenExpiry = refreshed.tokenExpiry;
    input.gmcConnection = connection;
    await prisma.$executeRawUnsafe(`
      UPDATE marketing_audits
      SET inputjson = $1::jsonb, "updatedAt" = NOW()
      WHERE id = $2::text
    `, stringifyEncryptedJson(input), audit.id);
  }
  if (!accessToken) {
    throw new Error('Token GMC introuvable');
  }

  // Merchant API : products.list renvoie des produits « traités » avec le statut
  // embarqué (productStatus) → une seule requête remplace products + productstatuses
  // de la Content API v2.1 (fermée le 18/08/2026). Attributs sous productAttributes ;
  // prix en amountMicros ; statut par reportingContext (SHOPPING_ADS) avec des listes
  // approved/disapprovedCountries au lieu d'un champ `status` unique.
  const productsData = await fetchJson(`https://merchantapi.googleapis.com/products/v1/accounts/${merchantId}/products?pageSize=250`);
  const items = (productsData.products || []).map((product) => {
    const attrs = product.productAttributes || {};
    const status = product.productStatus || null;
    const destinationStatuses = Array.isArray(status?.destinationStatuses) ? status.destinationStatuses : [];
    const shoppingStatus = destinationStatuses.find((entry) => entry.reportingContext === 'SHOPPING_ADS') || destinationStatuses[0] || null;
    // Statut dérivé du modèle Merchant API : disapproved si au moins un pays refusé.
    const disapproved = Array.isArray(shoppingStatus?.disapprovedCountries) && shoppingStatus.disapprovedCountries.length > 0;
    const approved = Array.isArray(shoppingStatus?.approvedCountries) && shoppingStatus.approvedCountries.length > 0;
    const gmcStatus = shoppingStatus ? (disapproved ? 'disapproved' : (approved ? 'approved' : 'pending')) : null;
    const micros = attrs.price?.amountMicros;
    return {
      title: attrs.title || null,
      descriptionText: attrs.description || null,
      descriptionHtml: attrs.description || null,
      imageUrl: attrs.imageLink || null,
      brand: attrs.brand || null,
      category: attrs.googleProductCategory || null,
      googleProductCategory: attrs.googleProductCategory || null,
      sku: product.offerId || null,
      mpn: attrs.mpn || null,
      gtin: (Array.isArray(attrs.gtins) ? attrs.gtins[0] : attrs.gtin) || null,
      price: micros != null ? Number(micros) / 1e6 : null,
      currency: attrs.price?.currencyCode || null,
      url: attrs.link || null,
      availability: attrs.availability || null,
      inventory: null,
      gmcStatus,
      itemLevelIssues: status?.itemLevelIssues || [],
    };
  });

  const issueCount = items.reduce((sum, item) => sum + (Array.isArray(item.itemLevelIssues) ? item.itemLevelIssues.length : 0), 0);
  const disapprovedCount = items.filter((item) => item.gmcStatus && String(item.gmcStatus).toLowerCase() === 'disapproved').length;
  return {
    items,
    diagnostics: {
      issueCount,
      disapprovalRate: items.length ? Math.round((disapprovedCount / items.length) * 100) : 0,
    },
  };
}

// ── Échantillon before/after pour le PDF d'audit ─────────────────────────────

// Récupère les items du catalogue selon le connecteur de l'audit.
async function fetchAuditItems(auditRow, input = {}) {
  const connector = String(auditRow.connectortype || '').toUpperCase();
  if (connector === 'SHOPIFY') {
    return { items: await fetchMarketingAuditShopifyItems(auditRow, input), diagnostics: input.gmcDiagnostics || {} };
  }
  if (connector === 'PRESTASHOP') {
    return { items: await fetchMarketingAuditPrestashopItems(auditRow, input), diagnostics: input.gmcDiagnostics || {} };
  }
  if (connector === 'CSV') {
    return { items: await fetchMarketingAuditFileItems(auditRow, input), diagnostics: input.gmcDiagnostics || {} };
  }
  if (connector === 'GMC') {
    return await fetchMarketingAuditGmcData(auditRow, input);
  }
  return null;
}

function auditFieldHasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

// Liste des champs faibles d'une fiche (clés normalisées).
function auditItemMissingFields(item) {
  const missing = [];
  if (!auditFieldHasValue(item.descriptionText) && !auditFieldHasValue(item.descriptionHtml)) missing.push('description');
  if (!auditFieldHasValue(item.gtin) && !auditFieldHasValue(item.mpn)) missing.push('identifier');
  if (!auditFieldHasValue(item.brand)) missing.push('brand');
  if (!auditFieldHasValue(item.category) && !auditFieldHasValue(item.googleProductCategory) && !auditFieldHasValue(item.productType)) missing.push('category');
  if (String(item.title || '').trim().length < 35) missing.push('title');
  return missing;
}

// 3 fiches représentatives : titre présent, mais le plus de blocages possible.
function selectAuditSampleItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => auditFieldHasValue(it.title))
    .map((it) => ({ it, weak: auditItemMissingFields(it).length }))
    .filter((s) => s.weak > 0)
    .sort((a, b) => b.weak - a.weak)
    .slice(0, 3)
    .map((s) => s.it);
}

function auditExcerpt(value, max) {
  const text = String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function parseAiJsonResponse(text) {
  if (!text) return null;
  let cleaned = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Version corrigée d'une fiche via l'IA (titre, description, attributs).
async function generateAuditAfterVersion(item) {
  const systemPrompt = `Tu es un expert en optimisation de flux produit e-commerce (Google Shopping, marketplaces). On te donne une fiche produit faible, tu produis une version corrigée.
Règles strictes :
- Garde la langue d'origine du produit.
- Titre : 60 à 140 caractères, exprime le type de produit, la marque et l'attribut différenciant principal, sans superlatifs marketing.
- Description : 2 à 3 phrases factuelles et structurées, sans inventer de spécifications techniques inconnues.
- Attributs : déduis uniquement ce qui est raisonnablement inférable (catégorie, type de produit, couleur ou matière si évident). N'invente JAMAIS un GTIN ou un MPN.
Réponds UNIQUEMENT avec un JSON valide, sans texte autour : {"title":"...","description":"...","attributes":[{"label":"...","value":"..."}]}`;
  const userPrompt = `Fiche produit actuelle :
Titre : ${item.title || '(vide)'}
Description : ${auditExcerpt(item.descriptionText || item.descriptionHtml || '', 400) || '(vide)'}
Marque : ${item.brand || '(vide)'}
Catégorie : ${item.category || item.googleProductCategory || item.productType || '(vide)'}
Prix : ${item.price != null ? item.price : '(vide)'} ${item.currency || ''}`.trim();

  const response = await callAIWithCache(
    prisma,
    'audit_before_after',
    { title: item.title || '', brand: item.brand || '', sku: item.sku || '' },
    systemPrompt,
    userPrompt,
    String(item.sku || item.gtin || 'audit-sample'),
    false
  );
  const parsed = parseAiJsonResponse(response?.text);
  if (!parsed || !parsed.title) {
    console.warn('[audit_before_after] parse fail. textLen=%d preview=%s parsed=%s',
      (response?.text || '').length,
      String(response?.text || '').slice(0, 220).replace(/\s+/g, ' '),
      parsed ? `keys=${Object.keys(parsed).join(',')}` : 'null'
    );
    return null;
  }
  return {
    title: String(parsed.title).slice(0, 200),
    description: String(parsed.description || '').slice(0, 600),
    attributes: Array.isArray(parsed.attributes)
      ? parsed.attributes
        .slice(0, 5)
        .map((a) => ({ label: String(a?.label || '').slice(0, 40), value: String(a?.value || '').slice(0, 90) }))
        .filter((a) => a.label && a.value)
      : [],
  };
}

// Génère une image "after" lifestyle (fond studio premium, qualité Shopping)
// à partir de l'image originale du produit. Retourne l'URL GCS publique ou
// null si l'image source manque ou si la gen Vertex échoue. Coût ~$0.02
// par image (Gemini 2.5 Flash Image), latence 3-7s — appliqué uniquement
// sur le 1er sample (hero) pour contenir budget et délai.
async function generateAuditAfterImage(item) {
  const sourceUrl = auditFieldHasValue(item.imageUrl) ? String(item.imageUrl).trim() : '';
  if (!sourceUrl) return null;
  try {
    const productContext = [item.brand, item.category || item.googleProductCategory || item.productType]
      .filter(Boolean).join(' · ').slice(0, 120);
    const productDescription = auditExcerpt(item.descriptionText || item.descriptionHtml || '', 200) || (item.title || '');
    const result = await generateLifestyleImage(sourceUrl, PRESET_SCENES.neutral, {
      productContext,
      productDescription,
    });
    return result?.url || null;
  } catch (imgError) {
    console.warn('Audit after-image gen échouée:', imgError.message);
    return null;
  }
}

// Construit jusqu'à 3 paires before/after pour le PDF d'audit.
// Sur le 1er sample (hero), on génère aussi une image "after" Vertex pour
// montrer le rendu Shopping/Amazon optimisé. Les autres samples restent
// en texte-only (économie + latence).
async function generateAuditSampleProducts(items) {
  const samples = selectAuditSampleItems(items);
  const results = [];
  let heroImageDone = false;
  for (let i = 0; i < samples.length; i += 1) {
    const item = samples[i];
    const before = {
      title: String(item.title || '').trim(),
      description: auditExcerpt(item.descriptionText || item.descriptionHtml || '', 240),
      imageUrl: auditFieldHasValue(item.imageUrl) ? item.imageUrl : null,
      issues: auditItemMissingFields(item),
    };
    let after = null;
    try {
      after = await generateAuditAfterVersion(item);
    } catch (aiError) {
      console.warn('Audit before/after IA échouée:', aiError.message);
    }
    // Image lifestyle générée sur le PREMIER sample qui dispose d'une image
    // source (pas forcément index 0 : si sample[0] n'a pas d'image et que
    // sample[1] en a une, c'est lui le hero visuel). Un seul appel Vertex
    // par audit pour contenir coût et latence.
    if (!heroImageDone && after && before.imageUrl) {
      const imageUrl = await generateAuditAfterImage(item);
      if (imageUrl) {
        after.imageUrl = imageUrl;
        heroImageDone = true;
      }
    }
    results.push({ before, after });
  }
  return results;
}

// Backfill : génère l'échantillon before/after si un audit "ready" ne l'a pas.
// Inclut aussi le backfill ciblé de l'image "after" du sample hero pour les
// audits générés avant l'ajout du visuel avant/après (rétrocompatibilité).
async function ensureAuditBeforeAfter(audit) {
  if (!audit || !prismaReady || !prisma) return audit;
  const report = typeof audit.reportjson === 'string' ? JSON.parse(audit.reportjson || '{}') : (audit.reportjson || {});
  if (audit.status !== 'ready' || !report || !Number.isFinite(Number(report.score))) return audit;

  const hasSamples = Array.isArray(report.sampleProducts) && report.sampleProducts.length > 0;
  // Le "hero visuel" n'est pas forcément le sample[0] : c'est le premier
  // sample qui dispose d'une before.imageUrl utilisable. Si sample[0] n'a
  // pas d'image source, l'image after se génère sur le sample suivant.
  const heroIndex = hasSamples
    ? report.sampleProducts.findIndex((s) => s && s.before?.imageUrl)
    : -1;
  const heroVisual = heroIndex >= 0 ? report.sampleProducts[heroIndex] : null;
  // 3 cas distincts :
  //  1. Pas de samples → génération complète.
  //  2. Samples avec tous les `after` null = coquilles vides (souvent dû à
  //     un modèle Gemini déprécié lors de la 1re gen) → on regénère tout.
  //  3. Hero visuel a un after textuel mais pas d'image → backfill image ciblé.
  const allAfterNull = hasSamples && report.sampleProducts.every((s) => !s || !s.after);
  const needsFullRegen = !hasSamples || allAfterNull;
  const heroNeedsImage = !needsFullRegen && !!(heroVisual && heroVisual.after && !heroVisual.after.imageUrl);

  if (!needsFullRegen && !heroNeedsImage) return audit;

  try {
    const input = typeof audit.inputjson === 'string' ? JSON.parse(audit.inputjson || '{}') : (audit.inputjson || {});

    if (heroNeedsImage) {
      // Backfill ciblé : on regénère uniquement l'image after du hero visuel
      // (= 1er sample avec before.imageUrl, pas forcément index 0), tout
      // le reste reste figé (texte before/after, autres samples).
      const fetched = await fetchAuditItems(audit, input);
      const heroItem = (fetched?.items || []).find((it) =>
        (it.title || '').trim() === (heroVisual.before.title || '').trim()
      );
      if (heroItem) {
        const imageUrl = await generateAuditAfterImage(heroItem);
        if (imageUrl) {
          report.sampleProducts[heroIndex].after.imageUrl = imageUrl;
        }
      }
    } else {
      const fetched = await fetchAuditItems(audit, input);
      if (!fetched || !Array.isArray(fetched.items)) return audit;
      report.sampleProducts = await generateAuditSampleProducts(fetched.items);
    }

    await prisma.$executeRawUnsafe(`
      UPDATE marketing_audits SET reportjson = $1::jsonb, "updatedAt" = NOW() WHERE id = $2::text
    `, JSON.stringify(report), audit.id);
    const refreshed = await prisma.$queryRawUnsafe(`SELECT * FROM marketing_audits WHERE id = $1::text LIMIT 1`, audit.id);
    return refreshed?.[0] || audit;
  } catch (backfillError) {
    console.warn('Backfill before/after échoué:', backfillError.message);
    return audit;
  }
}

async function maybeGenerateMarketingAuditReport(auditRow) {
  if (!auditRow || !prismaReady || !prisma) return auditRow;
  const currentReport = typeof auditRow.reportjson === 'string' ? JSON.parse(auditRow.reportjson || '{}') : (auditRow.reportjson || {});
  if (auditRow.status === 'ready' && currentReport && Object.keys(currentReport).length > 0) {
    return auditRow;
  }
  if (auditRow.status !== 'source_connected') {
    return auditRow;
  }

  const input = typeof auditRow.inputjson === 'string' ? JSON.parse(auditRow.inputjson || '{}') : (auditRow.inputjson || {});
  let diagnostics = input.gmcDiagnostics || {};

  const fetched = await fetchAuditItems(auditRow, input);
  if (!fetched || !Array.isArray(fetched.items)) {
    return auditRow;
  }
  const items = fetched.items;
  if (fetched.diagnostics) {
    diagnostics = fetched.diagnostics;
  }

  const summary = buildAuditSummaryFromItems(items);
  const scoredItems = items.map((item) => calculateAdvancedQualityScore(item, {}));
  const aggregate = calculateFeedAuditSummary(summary, scoredItems);
  const report = {
    score: aggregate.score,
    potentialScore: aggregate.potentialScore,
    estimatedAdditionalApprovedProducts: aggregate.estimatedAdditionalApprovedProducts,
    estimatedVisibilityLiftPct: aggregate.estimatedVisibilityLiftPct,
    summary: aggregate.metrics,
    scoreBreakdown: aggregate.scoreBreakdown,
    auditPillars: aggregate.auditPillars,
    scoreBand: aggregate.scoreBand,
    connectorType: String(auditRow.connectortype || 'OTHER').toUpperCase(),
    targetChannels: normalizeTargetChannels(typeof auditRow.targetchannels === 'string' ? JSON.parse(auditRow.targetchannels || '[]') : auditRow.targetchannels || []),
    coverage: {
      title: summary.total ? Math.round(((summary.total - summary.missing_title) / summary.total) * 100) : 0,
      description: summary.total ? Math.round(((summary.total - summary.missing_description) / summary.total) * 100) : 0,
      image: summary.total ? Math.round(((summary.total - summary.missing_image) / summary.total) * 100) : 0,
      brand: summary.total ? Math.round(((summary.total - summary.missing_brand) / summary.total) * 100) : 0,
      category: summary.total ? Math.round(((summary.total - summary.missing_category) / summary.total) * 100) : 0,
      identifier: summary.total ? Math.round(((summary.total - summary.missing_identifier) / summary.total) * 100) : 0,
      price: summary.total ? Math.round(((summary.total - summary.missing_price) / summary.total) * 100) : 0,
      url: summary.total ? Math.round(((summary.total - summary.missing_link) / summary.total) * 100) : 0,
      availability: summary.total ? Math.round(((summary.total - summary.missing_availability) / summary.total) * 100) : 0,
    },
    gmcDiagnostics: {
      disapprovalRate: Number(diagnostics.disapprovalRate || 0),
      issueCount: Number(diagnostics.issueCount || 0),
      diagnosticsScore: Math.max(35, 100 - Number(diagnostics.disapprovalRate || 0) - Math.min(30, Number(diagnostics.issueCount || 0) * 2)),
    },
    topIssues: aggregate.topIssues,
    opportunities: [
      {
        label: 'Produits a remettre en diffusion',
        value: aggregate.estimatedAdditionalApprovedProducts,
        detail: 'Volume potentiel a recuperer en corrigeant les blocages techniques les plus penalistes.',
      },
      {
        label: 'Gain de visibilite estime',
        value: `${aggregate.estimatedVisibilityLiftPct}%`,
        detail: 'Projection structurelle liee a la remise a niveau des piliers faibles du flux.',
      },
      {
        label: 'Produits deja prets a scaler',
        value: `${aggregate.metrics.approvalReadyRate}%`,
        detail: 'Part du catalogue deja suffisamment saine pour accelerer sans reprise lourde.',
      },
      {
        label: 'Score moyen fiche produit',
        value: `${aggregate.metrics.averageProductScore}/100`,
        detail: 'Mesure la qualite moyenne des fiches auditees, independamment des seuls blocages de diffusion.',
      },
    ],
    methodology: aggregate.methodology,
  };

  try {
    report.sampleProducts = await generateAuditSampleProducts(items);
  } catch (sampleError) {
    console.warn('Génération échantillon audit échouée:', sampleError.message);
    report.sampleProducts = [];
  }

  await prisma.$executeRawUnsafe(`
    UPDATE marketing_audits
    SET reportjson = $1::jsonb,
        inputjson = $2::jsonb,
        status = 'ready',
        "updatedAt" = NOW()
    WHERE id = $3::text
  `, JSON.stringify(report), stringifyEncryptedJson(input), auditRow.id);

  const refreshed = await prisma.$queryRawUnsafe(`SELECT * FROM marketing_audits WHERE id = $1::text LIMIT 1`, auditRow.id);
  return refreshed?.[0] || auditRow;
}

// Export feed as CSV (Google Merchant Center style)
function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let s = String(val).replace(/"/g, '""');
  // Neutralise l'injection de formule (Excel/Calc) : préfixe ' si la cellule
  // commence par un caractère interprété comme formule.
  if (s.length > 0 && '=+-@\t\r'.includes(s[0])) {
    s = `'${s}`;
  }
  return `"${s}"`;
}

/** Normalise la disponibilité vers les valeurs officielles GMC (underscore). Utilisé pour CSV et Content API. */
// Bloc 2 : extraits dans domains/gmc/push.js (helpers purs). Re-export tel quel.
// NB : utilises aussi par les chemins Amazon/Meta ci-dessous (symboles preserves).
const normalizeAvailabilityForGMC = gmcDomain.normalizeAvailabilityForGMC;

/** Normalise la condition vers les valeurs GMC : new, refurbished, used. */
const normalizeConditionForGMC = gmcDomain.normalizeConditionForGMC;

// Config des canaux Amazon (marketplaceId SP-API EU)
// Bloc 3 : table des canaux Amazon + normalisations Amazon extraites dans
// domains/amazon/push.js. Ré-exposées ici via des const locales pour préserver
// les symboles vus par les autres appelants (génération feed Amazon, routes
// /channels Amazon). Comportement strictement identique.
const AMAZON_CHANNEL_CONFIG = amazonDomain.AMAZON_CHANNEL_CONFIG;
const normalizeConditionForAmazon = amazonDomain.normalizeConditionForAmazon;

/** Normalise la condition pour Cdiscount : 1=Neuf, 2=Occasion, 3=Reconditionné. */
function normalizeConditionForCdiscount(raw) {
  const s = (raw && String(raw).toLowerCase().trim()) || '';
  if (s === 'refurbished' || s === 'reconditionné') return '3';
  if (s === 'used' || s === 'occasion') return '2';
  return '1';
}

/** Normalise la condition pour Rakuten : N, CN, TBE, BE, EC. */
function normalizeConditionForRakuten(raw) {
  const s = (raw && String(raw).toLowerCase().trim()) || '';
  if (s === 'refurbished' || s === 'reconditionné') return 'EC';
  if (s === 'used' || s === 'occasion') return 'BE';
  if (s === 'tbe' || s === 'très bon état') return 'TBE';
  if (s === 'cn' || s === 'comme neuf') return 'CN';
  return 'N';
}

const { getOptimizedContentForPlatform, mergeOptimizedContent, hasStoredOptimizedContent } = require('./utils/platform-content');

/** Normalise la disponibilité pour ChatGPT Product Feed Spec : in_stock, out_of_stock, pre_order, backorder, unknown. */
function normalizeAvailabilityForChatGPT(raw, inventory) {
  const s = (raw && String(raw).toLowerCase()) || '';
  if (['in_stock', 'out_of_stock', 'pre_order', 'backorder', 'unknown'].includes(s)) return s;
  if (s.includes('preorder') || s.includes('pre-order')) return 'pre_order';
  if (s.includes('backorder') || s.includes('back-order')) return 'backorder';
  if (s.includes('in stock') || s.includes('instock') || s === 'in stock') return 'in_stock';
  if (inventory != null && parseInt(inventory, 10) > 0) return 'in_stock';
  return 'out_of_stock';
}

/** Normalise un FeedItem pour l'export ChatGPT (Product Feed Spec OpenAI / Agentic Commerce Protocol). */
function normalizeForChatGPT(item, config) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const currencyCode = item.currency || cf.currency || config?.currency || 'EUR';
  const storeCountry = config?.storeCountry || config?.country || 'FR';
  const sellerName = config?.sellerName || 'Merchant';
  const sellerUrl = config?.sellerUrl || config?.link || '';
  const returnPolicy = config?.returnPolicy || config?.return_policy || '';
  const itemId = ((item.originid ?? item.originId) || item.id || item.sku).toString().substring(0, 100);
  const groupId = cf.item_group_id || itemId;
  const imageUrl = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  const linkUrl = item.url || cf.link || '';
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const inv = item.inventory;
  const availability = normalizeAvailabilityForChatGPT(cf.availability || cf.inventory, inv);
  const hasVariants = !!(cf.item_group_id || cf.color || cf.size);
  const priceStr = price ? `${price} ${currencyCode}` : '';
  const { title, description: descContent } = getOptimizedContentForPlatform(item, 'chatgpt');

  return {
    item_id: itemId,
    title: title.toString().substring(0, 150) || itemId,
    description: descContent.substring(0, 5000) || (item.title || '').substring(0, 500),
    url: linkUrl || `https://example.com/product/${itemId}`,
    brand: (item.brand || cf.brand || 'Generic').toString().substring(0, 70),
    image_url: imageUrl || '',
    price: priceStr,
    availability,
    group_id: groupId.substring(0, 70),
    listing_has_variations: hasVariants,
    is_eligible_search: 'true',
    is_eligible_checkout: 'false',
    seller_name: sellerName.substring(0, 70),
    seller_url: sellerUrl || linkUrl || `https://example.com`,
    return_policy: returnPolicy || sellerUrl || `https://example.com`,
    target_countries: [storeCountry],
    store_country: storeCountry,
    condition: (item.condition || cf.condition || 'new').toLowerCase(),
    gtin: item.gtin || cf.gtin || cf.GTIN || '',
    mpn: (item.mpn || cf.mpn || cf.MPN || item.sku || '').toString().substring(0, 70)
  };
}

/** Normalise un FeedItem pour l'export Cdiscount Pro (CSV). */
function normalizeForCdiscount(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
  const descRaw = optDesc.replace(/<[^>]*>/g, '').trim();
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const gtin = item.gtin || cf.gtin || cf.GTIN || '';
  const sku = (item.sku || item.originid || item.originId || item.id).toString().substring(0, 100);
  const productName = (optTitle || item.title || sku).toString().substring(0, 200);
  const imageUrl = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  const productUrl = item.url || cf.link || '';
  return {
    SellerProductId: sku,
    ProductEan: gtin,
    Price: price,
    Stock: item.inventory != null ? Math.max(0, parseInt(item.inventory, 10)) : 0,
    ProductCondition: normalizeConditionForCdiscount(item.condition || cf.condition),
    ProductName: productName,
    ProductDescription: descRaw.substring(0, 2000),
    ImageUrl: imageUrl,
    ProductUrl: productUrl,
    Brand: (item.brand || cf.brand || '').toString().substring(0, 50) || ''
  };
}

/** Normalise un FeedItem pour l'export Rakuten (CSV, format compatible FULLADVERT). */
function normalizeForRakuten(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
  const descRaw = optDesc.replace(/<[^>]*>/g, '').trim();
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const gtin = item.gtin || cf.gtin || cf.GTIN || '';
  const sku = (item.sku || item.originid || item.originId || item.id).toString().substring(0, 40);
  const imageUrl = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  const commentaireAnnonce = (optTitle || item.title || sku).toString().substring(0, 500) + '\n' + descRaw.substring(0, 2000);
  return {
    sku,
    code_barres: gtin,
    prix: price,
    quantite: item.inventory != null ? Math.max(0, parseInt(item.inventory, 10)) : 0,
    qualite: normalizeConditionForRakuten(item.condition || cf.condition),
    commentaire_annonce: commentaireAnnonce,
    reconditionne: (item.condition && /refurbished|reconditionné|occasion|used/i.test(String(item.condition))) ? '1' : '0',
    url_images: imageUrl
  };
}

/** Normalise un FeedItem pour l'export Meta (Facebook Commerce / Catalogue). Champs requis : id, title, description, availability, condition, price, link, image_link, et au moins un de brand/mpn/gtin. */
function normalizeForMeta(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'meta');
  const descRaw = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || (item.descriptionText || item.descriptiontext || '').toString().replace(/<[^>]*>/g, '').trim();
  const currencyCode = item.currency || cf.currency || 'EUR';
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const priceStr = price ? `${price} ${currencyCode}` : '';
  const id = ((item.originid ?? item.originId) || item.id || item.sku).toString().substring(0, 100);
  const link = item.url || cf.link || '';
  const imageLink = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  const inv = item.inventory;
  const availability = normalizeAvailabilityForGMC(cf.availability || cf.inventory, inv);
  const condition = normalizeConditionForGMC(item.condition || cf.condition);
  const brand = (item.brand || cf.brand || '').toString().substring(0, 100) || '';
  const gtin = (item.gtin || cf.gtin || cf.GTIN || '').toString().substring(0, 50) || '';
  const mpn = (item.mpn || cf.mpn || cf.MPN || item.sku || '').toString().substring(0, 70) || '';
  return {
    id,
    title: (optTitle || item.title || id).toString().substring(0, 150),
    description: descRaw.substring(0, 5000),
    link: link || `https://example.com/product/${id}`,
    image_link: imageLink,
    availability,
    condition,
    price: priceStr,
    brand,
    gtin,
    mpn
  };
}

// Bloc 3 : normalisation Amazon extraite dans domains/amazon/push.js. Ré-exposée
// ici via une const locale pour préserver le symbole vu par les autres appelants
// (génération feed Amazon). Comportement strictement identique.
const normalizeForAmazon = amazonDomain.normalizeForAmazon;

/** Normalise un FeedItem pour l'export Bing / Microsoft Merchant Center (schéma proche GMC). */
function normalizeForBing(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
  const descRaw = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || (item.descriptionText || item.descriptiontext || '').toString().replace(/<[^>]*>/g, '').trim();
  const currencyCode = item.currency || cf.currency || 'EUR';
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const priceStr = price ? `${price} ${currencyCode}` : '';
  const id = ((item.originid ?? item.originId) || item.id || item.sku).toString().substring(0, 100);
  const link = item.url || cf.link || '';
  const imageLink = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  const inv = item.inventory;
  const availability = normalizeAvailabilityForGMC(cf.availability || cf.inventory, inv);
  const condition = normalizeConditionForGMC(item.condition || cf.condition);
  const brand = (item.brand || cf.brand || '').toString().substring(0, 100) || '';
  const gtin = (item.gtin || cf.gtin || cf.GTIN || '').toString().substring(0, 50) || '';
  const mpn = (item.mpn || cf.mpn || cf.MPN || item.sku || '').toString().substring(0, 70) || '';
  const googleProductCategory = (cf.google_product_category && String(cf.google_product_category).trim()) || 'Apparel & Accessories > Clothing';
  const productType = (cf.product_type && String(cf.product_type).trim()) || 'Products';
  return {
    id,
    title: (optTitle || item.title || id).toString().substring(0, 150),
    description: descRaw.substring(0, 5000),
    link: link || `https://example.com/product/${id}`,
    image_link: imageLink,
    additional_image_link: cf.additional_image_link || '',
    availability,
    price: priceStr,
    sale_price: cf.sale_price ? `${Number(cf.sale_price).toFixed(2)} ${currencyCode}` : '',
    brand,
    gtin,
    mpn,
    condition,
    google_product_category: googleProductCategory,
    product_type: productType,
    item_group_id: cf.item_group_id || ''
  };
}

/** Normalise un FeedItem pour l'export Pinterest (catalogue). Champs requis : id, title, description, link, image_link, price, availability. */
function normalizeForPinterest(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
  const descRaw = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || (item.descriptionText || item.descriptiontext || '').toString().replace(/<[^>]*>/g, '').trim();
  const currencyCode = item.currency || cf.currency || 'EUR';
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const priceStr = price ? `${price} ${currencyCode}` : '';
  const id = ((item.originid ?? item.originId) || item.id || item.sku).toString().substring(0, 127);
  const link = item.url || cf.link || '';
  const imageLink = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  const inv = item.inventory;
  const availability = normalizeAvailabilityForGMC(cf.availability || cf.inventory, inv);
  const availabilityPinterest = availability === 'in stock' ? 'in stock' : (availability === 'out of stock' ? 'out of stock' : 'preorder');
  return {
    id,
    title: (optTitle || item.title || id).toString().substring(0, 500),
    description: descRaw.substring(0, 10000),
    link: link || `https://example.com/product/${id}`,
    image_link: imageLink,
    price: priceStr,
    availability: availabilityPinterest,
    item_group_id: (cf.item_group_id || id).toString().substring(0, 127),
    product_type: (cf.product_type || cf.google_product_category || '').toString().substring(0, 1000),
    additional_image_link: cf.additional_image_link || ''
  };
}

/** Normalise un FeedItem pour l'export TikTok (catalogue / Data Feed). */
function normalizeForTikTok(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
  const descRaw = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || (item.descriptionText || item.descriptiontext || '').toString().replace(/<[^>]*>/g, '').trim();
  const currencyCode = item.currency || cf.currency || 'EUR';
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const id = ((item.originid ?? item.originId) || item.id || item.sku).toString().substring(0, 100);
  const link = item.url || cf.link || '';
  const imageLink = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  const quantity = item.inventory != null ? Math.max(0, parseInt(item.inventory, 10)) : 0;
  return {
    product_id: id,
    name: (optTitle || item.title || id).toString().substring(0, 255),
    description: descRaw.substring(0, 5000),
    price: price ? `${price} ${currencyCode}` : '',
    quantity,
    link: link || `https://example.com/product/${id}`,
    image_link: imageLink,
    brand: (item.brand || cf.brand || '').toString().substring(0, 100) || '',
    gtin: (item.gtin || cf.gtin || cf.GTIN || '').toString().substring(0, 50) || '',
    availability: quantity > 0 ? 'in stock' : 'out of stock'
  };
}

/** Normalise un FeedItem pour l'export Snapchat (Catalog Ads). */
function normalizeForSnapchat(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
  const descRaw = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || (item.descriptionText || item.descriptiontext || '').toString().replace(/<[^>]*>/g, '').trim();
  const currencyCode = item.currency || cf.currency || 'EUR';
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const priceStr = price ? `${price} ${currencyCode}` : '';
  const id = ((item.originid ?? item.originId) || item.id || item.sku).toString().substring(0, 100);
  const link = item.url || cf.link || '';
  const imageLink = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  const availability = normalizeAvailabilityForGMC(cf.availability || cf.inventory, item.inventory);
  const condition = normalizeConditionForGMC(item.condition || cf.condition);
  return {
    id,
    title: (optTitle || item.title || id).toString().substring(0, 150),
    description: descRaw.substring(0, 5000),
    link: link || `https://example.com/product/${id}`,
    image_link: imageLink,
    availability,
    condition,
    price: priceStr,
    brand: (item.brand || cf.brand || '').toString().substring(0, 100) || '',
    gtin: (item.gtin || cf.gtin || cf.GTIN || '').toString().substring(0, 50) || '',
    mpn: (item.mpn || cf.mpn || cf.MPN || item.sku || '').toString().substring(0, 70) || ''
  };
}

/** Normalise un FeedItem pour l'export Yandex Market (CSV générique). */
function normalizeForYandex(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
  const descRaw = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || (item.descriptionText || item.descriptiontext || '').toString().replace(/<[^>]*>/g, '').trim();
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const id = ((item.originid ?? item.originId) || item.id || item.sku).toString().substring(0, 100);
  const link = item.url || cf.link || '';
  const imageLink = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  const category = (cf.google_product_category || cf.product_type || '').toString().substring(0, 500) || '';
  return {
    id,
    name: (optTitle || item.title || id).toString().substring(0, 512),
    description: descRaw.substring(0, 3000),
    url: link || `https://example.com/product/${id}`,
    picture: imageLink,
    price,
    currency: item.currency || cf.currency || 'EUR',
    category,
    vendor: (item.brand || cf.brand || '').toString().substring(0, 255) || '',
    gtin: (item.gtin || cf.gtin || cf.GTIN || '').toString().substring(0, 50) || ''
  };
}

/** Normalise un FeedItem pour l'export Baidu (catalogue produit marché chinois). */
function normalizeForBaidu(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
  const descRaw = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || (item.descriptionText || item.descriptiontext || '').toString().replace(/<[^>]*>/g, '').trim();
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const id = ((item.originid ?? item.originId) || item.id || item.sku).toString().substring(0, 100);
  const link = item.url || cf.link || '';
  const imageLink = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  return {
    id,
    title: (optTitle || item.title || id).toString().substring(0, 200),
    description: descRaw.substring(0, 2000),
    link: link || `https://example.com/product/${id}`,
    image_link: imageLink,
    price,
    currency: item.currency || cf.currency || 'CNY',
    brand: (item.brand || cf.brand || '').toString().substring(0, 100) || '',
    category: (cf.google_product_category || cf.product_type || '').toString().substring(0, 200) || ''
  };
}

/** Normalise un FeedItem pour l'export Perplexity (Merchant / Buy with Pro – CSV produit). */
function normalizeForPerplexity(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
  const descRaw = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || (item.descriptionText || item.descriptiontext || '').toString().replace(/<[^>]*>/g, '').trim();
  const currencyCode = item.currency || cf.currency || 'EUR';
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const id = ((item.originid ?? item.originId) || item.id || item.sku).toString().substring(0, 100);
  const link = item.url || cf.link || '';
  const imageLink = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  return {
    id,
    title: (optTitle || item.title || id).toString().substring(0, 200),
    description: descRaw.substring(0, 2000),
    url: link || `https://example.com/product/${id}`,
    image_url: imageLink,
    price: price ? `${price} ${currencyCode}` : '',
    brand: (item.brand || cf.brand || '').toString().substring(0, 100) || ''
  };
}

/** Normalise un FeedItem pour l'export Google Gemini (Shopping / Merchant – CSV produit). */
function normalizeForGemini(item) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
  const descRaw = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || (item.descriptionText || item.descriptiontext || '').toString().replace(/<[^>]*>/g, '').trim();
  const currencyCode = item.currency || cf.currency || 'EUR';
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const id = ((item.originid ?? item.originId) || item.id || item.sku).toString().substring(0, 100);
  const link = item.url || cf.link || '';
  const imageLink = (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '';
  return {
    id,
    title: (optTitle || item.title || id).toString().substring(0, 200),
    description: descRaw.substring(0, 2000),
    link: link || `https://example.com/product/${id}`,
    image_link: imageLink,
    price: price ? `${price} ${currencyCode}` : '',
    brand: (item.brand || cf.brand || '').toString().substring(0, 100) || '',
    availability: normalizeAvailabilityForGMC(cf.availability || cf.inventory, item.inventory)
  };
}

// Récupérer un item spécifique avec son feed et mapping
// Endpoint de diagnostic pour vérifier les données d'un item
// Récupérer le score de qualité d'un item
// Historique du score produit (évolution dans le temps, pour graphique)
// Endpoint pour calculer le score global du catalogue
// Endpoint pour recalculer tous les scores avec le nouveau système avancé
// Analyser un CSV via upload de fichier
// Analyser un CSV et proposer un mapping automatique (via URL)
// ====== MARKETING LEADS ======

const MARKETING_STAGE_J0 = 'pending_j0';
const MARKETING_STAGE_J1 = 'pending_j1';
const MARKETING_STAGE_J3 = 'pending_j3';
const MARKETING_STAGE_J6 = 'pending_j6';
const MARKETING_STAGE_J10 = 'pending_j10';
const MARKETING_STAGE_DONE = 'completed';
const MARKETING_FORM_MIN_AGE_MS = 2500;
const MARKETING_FORM_MAX_AGE_MS = 1000 * 60 * 60 * 6;
const MARKETING_LEAD_SOURCE_WHITELIST = new Set([
  'landing_page',
  'demo_page',
  'pricing_contact',
  'use_case_demo',
  'audit_request',
]);

function addDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + days);
  return date;
}

function resolveMarketingOutboundStage(nurtureStage) {
  if (nurtureStage === MARKETING_STAGE_J1 || nurtureStage === MARKETING_STAGE_J3) {
    return 'j3';
  }
  if (nurtureStage === MARKETING_STAGE_J6 || nurtureStage === MARKETING_STAGE_J10) {
    return 'j10';
  }
  return 'j0';
}

// ── Nurture post-audit de flux (segments A / B) ──────────────────────────────
// Le lead d'un audit suit une séquence dédiée. Le segment réel (A = audit non
// terminé, B = audit vu) est déterminé au moment de l'envoi à partir du statut
// de l'audit ; seul le numéro d'étape est stocké dans `nurturestage`.
const MARKETING_STAGE_AUDIT_1 = 'audit_step_1';

function auditStepFromStage(stage) {
  const match = /^audit_step_([1-4])$/.exec(String(stage || ''));
  return match ? Number(match[1]) : null;
}

const AUDIT_NURTURE_ISSUE_LABELS = {
  fr: {
    title: 'Titres produit', description: 'Descriptions', image: 'Images principales',
    brand: 'Marque', category: 'Catégorisation',
    identifier: 'Identifiants produits (GTIN/MPN)', link: 'URLs produit',
  },
  en: {
    title: 'Product titles', description: 'Descriptions', image: 'Main images',
    brand: 'Brand', category: 'Categorization',
    identifier: 'Product identifiers (GTIN/MPN)', link: 'Product URLs',
  },
  es: {
    title: 'Títulos de producto', description: 'Descripciones', image: 'Imágenes principales',
    brand: 'Marca', category: 'Categorización',
    identifier: 'Identificadores de producto (GTIN/MPN)', link: 'URLs de producto',
  },
};

const AUDIT_NURTURE_BLOCAGE_FALLBACK = {
  fr: 'Attributs catalogue à compléter sur une partie des fiches',
  en: 'Catalog attributes to complete on part of the catalog',
  es: 'Atributos de catálogo por completar en parte del catálogo',
};

function auditIssueLabel(issue, loc) {
  const labels = AUDIT_NURTURE_ISSUE_LABELS[loc] || AUDIT_NURTURE_ISSUE_LABELS.fr;
  return labels[issue?.key] || issue?.label || AUDIT_NURTURE_BLOCAGE_FALLBACK[loc] || AUDIT_NURTURE_BLOCAGE_FALLBACK.fr;
}

function formatAuditIssueDetail(issue, loc) {
  const count = Number(issue?.affectedProducts || 0);
  const rate = Number(issue?.affectedRate || 0);
  if (!count) return '';
  if (loc === 'en') return `${count} products affected · ${rate}% of the catalog`;
  if (loc === 'es') return `${count} fichas afectadas · ${rate}% del catálogo`;
  return `${count} fiches concernées · ${rate}% du catalogue`;
}

function formatAuditBlocage(issue, loc) {
  const label = auditIssueLabel(issue, loc);
  const detail = formatAuditIssueDetail(issue, loc);
  return detail ? `${label} — ${detail}` : label;
}

function buildAuditIssuesList(issues, loc) {
  return (Array.isArray(issues) ? issues : []).slice(0, 3).map((issue) => ({
    label: auditIssueLabel(issue, loc),
    detail: formatAuditIssueDetail(issue, loc),
    severity: issue?.severity || 'low',
  }));
}

function buildAuditNurtureContext(lead, audit) {
  const loc = getEmailLocale(audit?.locale || lead?.locale || 'fr');
  const report = typeof audit?.reportjson === 'string'
    ? JSON.parse(audit.reportjson || '{}')
    : (audit?.reportjson || {});
  let input = {};
  try {
    input = typeof audit?.inputjson === 'string'
      ? JSON.parse(audit.inputjson || '{}')
      : (audit?.inputjson || {});
  } catch { input = {}; }

  const issues = Array.isArray(report.topIssues) ? report.topIssues : [];
  const blocages = issues.slice(0, 3).map((issue) => formatAuditBlocage(issue, loc));
  while (blocages.length < 3) blocages.push(AUDIT_NURTURE_BLOCAGE_FALLBACK[loc] || AUDIT_NURTURE_BLOCAGE_FALLBACK.fr);

  const publicBaseUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');

  return {
    prenom: lead?.firstName || '',
    societe: audit?.company || lead?.company || '',
    score: report.score ?? '',
    scorePotentiel: report.potentialScore ?? '',
    blocage1: blocages[0],
    blocage2: blocages[1],
    blocage3: blocages[2],
    issuesList: buildAuditIssuesList(issues, loc),
    produitsRecuperables: report.estimatedAdditionalApprovedProducts ?? '',
    gainVisibilite: report.estimatedVisibilityLiftPct ?? '',
    cms: input.cmsUsed || audit?.connectortype || '',
    lienAudit: `${publicBaseUrl}/${audit?.locale || 'fr'}/audit-flux/${audit?.sharetoken || ''}`,
    lienAuditPdf: `${(process.env.API_URL || 'https://api.feedplug.com').replace(/\/$/, '')}/api/v1/marketing/audits/${audit?.sharetoken || ''}/pdf`,
    lienRdv: process.env.MARKETING_RDV_URL || 'https://calendly.com/victorsoldet/30min',
  };
}

// Envoie l'étape de nurture post-audit pour un lead donné, puis programme la suivante.
async function sendAuditNurtureForLead(lead, step) {
  const auditRows = await prisma.$queryRawUnsafe(`
    SELECT *
    FROM marketing_audits
    WHERE leadid = $1::text OR LOWER(email) = LOWER($2::text)
    ORDER BY "createdAt" DESC
    LIMIT 1
  `, lead.id, lead.email);
  let audit = auditRows?.[0] || null;

  if (!audit) {
    // Lead marqué "audit" sans audit retrouvé : on clôture pour éviter une boucle.
    await markLeadMarketingProgress(lead.id, {
      nurtureStage: MARKETING_STAGE_DONE,
      nextMarketingEmailAt: null,
    });
    return;
  }

  // Si la source est connectée mais le rapport pas encore généré, on tente.
  try {
    audit = await maybeGenerateMarketingAuditReport(audit);
  } catch (genError) {
    console.warn('Audit nurture: génération rapport échouée:', genError.message);
  }

  const report = typeof audit.reportjson === 'string'
    ? JSON.parse(audit.reportjson || '{}')
    : (audit.reportjson || {});
  const hasReport = report && Number.isFinite(Number(report.score));
  const segment = (audit.status === 'pending_connection' || !hasReport) ? 'A' : 'B';

  // Le segment A ne compte que 2 mails.
  if (segment === 'A' && step > 2) {
    await markLeadMarketingProgress(lead.id, {
      nurtureStage: MARKETING_STAGE_DONE,
      nextMarketingEmailAt: null,
    });
    return;
  }

  const context = buildAuditNurtureContext(lead, audit);

  const resendContactId = await registerLeadInResend(lead);
  if (resendContactId) {
    await markLeadMarketingProgress(lead.id, { resendContactId });
  }

  await sendMarketingAuditNurtureEmail({
    email: lead.email,
    locale: audit.locale || lead.locale || 'fr',
    segment,
    step,
    context,
  });

  const now = new Date();
  let nextStage = MARKETING_STAGE_DONE;
  let nextAt = null;
  if (segment === 'A') {
    if (step === 1) { nextStage = 'audit_step_2'; nextAt = addDays(now, 3).toISOString(); }
  } else if (step === 1) {
    nextStage = 'audit_step_2'; nextAt = addDays(now, 2).toISOString();
  } else if (step === 2) {
    nextStage = 'audit_step_3'; nextAt = addDays(now, 4).toISOString();
  } else if (step === 3) {
    nextStage = 'audit_step_4'; nextAt = addDays(now, 5).toISOString();
  }

  await markLeadMarketingProgress(lead.id, {
    nurtureStage: nextStage,
    nextMarketingEmailAt: nextAt,
    lastMarketingEmailAt: now.toISOString(),
    marketingOptIn: true,
    unsubscribedAt: null,
  });
}

function buildLeadTrimmedInput(body = {}) {
  return {
    firstName: typeof body.firstName === 'string' ? body.firstName.trim() : '',
    lastName: typeof body.lastName === 'string' ? body.lastName.trim() : '',
    jobTitle: typeof body.jobTitle === 'string' ? body.jobTitle.trim() : '',
    phone: typeof body.phone === 'string' ? body.phone.trim() : '',
    company: typeof body.company === 'string' ? body.company.trim() : '',
    locale: typeof body.locale === 'string' ? body.locale.trim() : null,
  };
}

function normalizeMarketingLeadSource(source, fallback = 'landing_page') {
  const normalized = typeof source === 'string' ? source.trim().toLowerCase() : '';
  if (MARKETING_LEAD_SOURCE_WHITELIST.has(normalized)) {
    return normalized;
  }
  return fallback;
}

function hasUrlLikeContent(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return /(https?:\/\/|www\.|<a\b|href=|\.com\b|\.net\b|\.io\b)/i.test(raw);
}

function isLikelyGibberishToken(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length < 10 || /\s/.test(raw)) return false;

  const lettersOnly = raw.replace(/[^a-z]/gi, '');
  if (lettersOnly.length < 10) return false;

  const vowelCount = (lettersOnly.match(/[aeiouy]/gi) || []).length;
  const vowelRatio = vowelCount / lettersOnly.length;
  const hasLongConsonantRun = /[bcdfghjklmnpqrstvwxz]{5,}/i.test(lettersOnly);
  const alternatingCaseNoise = (raw.match(/[a-z][A-Z]|[A-Z][a-z]/g) || []).length >= 3;
  const mixedCase = /[a-z]/.test(raw) && /[A-Z]/.test(raw);

  return hasLongConsonantRun || vowelRatio < 0.24 || (mixedCase && alternatingCaseNoise);
}

function assessMarketingSubmissionRisk({ trimmed, email, extraFields = [] }) {
  const fields = [
    { label: 'firstName', value: trimmed?.firstName },
    { label: 'lastName', value: trimmed?.lastName },
    { label: 'jobTitle', value: trimmed?.jobTitle },
    { label: 'company', value: trimmed?.company },
    ...extraFields,
  ];

  let score = 0;
  let gibberishCount = 0;
  const reasons = [];

  for (const field of fields) {
    const value = String(field?.value || '').trim();
    if (!value) continue;

    if (hasUrlLikeContent(value)) {
      score += 3;
      reasons.push(`${field.label}:url_like`);
    }
    if (isLikelyGibberishToken(value)) {
      gibberishCount += 1;
      score += 2;
      reasons.push(`${field.label}:gibberish`);
    }
    if (value.length >= 24 && !/\s/.test(value)) {
      score += 1;
      reasons.push(`${field.label}:long_unbroken`);
    }
    if (/(.)\1{4,}/.test(value)) {
      score += 2;
      reasons.push(`${field.label}:repeated_chars`);
    }
  }

  const emailLocalPart = String(email || '').trim().split('@')[0] || '';
  const compactEmailLocalPart = emailLocalPart.replace(/[._+-]/g, '');
  if (isLikelyGibberishToken(compactEmailLocalPart)) {
    score += 1;
    reasons.push('email:gibberish_local_part');
  }

  return {
    blocked: gibberishCount >= 2 || score >= 4,
    reasons,
  };
}

async function validateMarketingSubmission({
  req,
  email,
  trimmed,
  requireCaptcha = false,
  extraFields = [],
}) {
  // Honeypot historique (companyWebsite) supprimé : les gestionnaires de mots
  // de passe (Dashlane, 1Password, Chrome autofill agressif) remplissent
  // l'input même caché et bloquaient de vraies submissions de prospects
  // (regression vue en prod 2026-06-12 sur honeypot_filled). On garde les
  // autres protections : Cloudflare Turnstile + rate limiter + spam risk
  // assessment + form age check ci-dessous.

  const startedAtMs = Number(req.body?.formStartedAt);
  if (Number.isFinite(startedAtMs)) {
    const elapsedMs = Date.now() - startedAtMs;
    if (elapsedMs < MARKETING_FORM_MIN_AGE_MS) {
      return { ok: false, status: 400, message: 'Demande refusée', reason: 'submitted_too_fast' };
    }
    if (elapsedMs > MARKETING_FORM_MAX_AGE_MS) {
      return { ok: false, status: 400, message: 'Session expirée. Rechargez la page puis réessayez.', reason: 'form_expired' };
    }
  }

  const spamAssessment = assessMarketingSubmissionRisk({ trimmed, email, extraFields });
  if (spamAssessment.blocked) {
    return {
      ok: false,
      status: 400,
      message: 'Demande refusée',
      reason: spamAssessment.reasons.join(','),
    };
  }

  const captchaToken = typeof req.body?.captchaToken === 'string' ? req.body.captchaToken.trim() : '';
  if (requireCaptcha || captchaToken) {
    const captchaCheck = await verifyTurnstileToken({
      token: captchaToken,
      remoteIp: getClientIp(req),
    });
    if (!captchaCheck.ok) {
      return { ok: false, status: 400, message: captchaCheck.message || 'Captcha invalide', reason: 'captcha_failed' };
    }
  }

  return { ok: true };
}

function serializeMarketingLead(lead) {
  return {
    ...lead,
    marketingOptIn: lead.marketingOptIn ?? lead.marketingoptin ?? false,
    resendContactId: lead.resendContactId ?? lead.resendcontactid ?? null,
    nurtureStage: lead.nurtureStage ?? lead.nurturestage ?? null,
    lastMarketingEmailAt: lead.lastMarketingEmailAt ?? lead.lastmarketingemailat ?? null,
    nextMarketingEmailAt: lead.nextMarketingEmailAt ?? lead.nextmarketingemailat ?? null,
    marketingClickCount: lead.marketingClickCount ?? lead.marketingclickcount ?? 0,
    lastMarketingClickAt: lead.lastMarketingClickAt ?? lead.lastmarketingclickat ?? null,
    lastMarketingClickTarget: lead.lastMarketingClickTarget ?? lead.lastmarketingclicktarget ?? null,
    unsubscribedAt: lead.unsubscribedAt ?? lead.unsubscribedat ?? null,
    createdAt: lead.createdAt
      ? (lead.createdAt.toISOString ? lead.createdAt.toISOString() : lead.createdAt)
      : new Date().toISOString(),
    updatedAt: lead.updatedAt
      ? (lead.updatedAt.toISOString ? lead.updatedAt.toISOString() : lead.updatedAt)
      : new Date().toISOString(),
  };
}

async function recordMarketingClick(email, target) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedTarget = String(target || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedTarget) return;

  const nowIso = new Date().toISOString();
  const prismaClient = await getPrismaClientOrThrow('Base marketing indisponible pour le tracking de clics');
  await prismaClient.$executeRawUnsafe(`
    UPDATE marketing_leads
    SET marketingclickcount = COALESCE(marketingclickcount, 0) + 1,
        lastmarketingclickat = $2::timestamptz,
        lastmarketingclicktarget = $3::text,
        "updatedAt" = $2::timestamptz
    WHERE email = $1::text
  `, normalizedEmail, nowIso, normalizedTarget);
}

async function markLeadMarketingProgress(leadId, update) {
  if (!leadId) return;

  const nowIso = new Date().toISOString();
  const prismaClient = await getPrismaClientOrThrow('Base marketing indisponible pour la mise à jour du lead');
  await prismaClient.$executeRawUnsafe(`
    UPDATE marketing_leads
    SET
      resendcontactid = COALESCE($2::text, resendcontactid),
      nurturestage = COALESCE($3::text, nurturestage),
      lastmarketingemailat = COALESCE($4::timestamptz, lastmarketingemailat),
      nextmarketingemailat = $5::timestamptz,
      marketingoptin = COALESCE($6::boolean, marketingoptin),
      unsubscribedat = $7::timestamptz,
      "updatedAt" = $8::timestamptz
    WHERE id = $1::text
  `,
    leadId,
    update.resendContactId || null,
    update.nurtureStage || null,
    update.lastMarketingEmailAt || null,
    update.nextMarketingEmailAt || null,
    update.marketingOptIn === undefined ? null : !!update.marketingOptIn,
    update.unsubscribedAt || null,
    nowIso
  );
}

async function markMarketingLeadConverted(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const prismaClient = await getPrismaClientOrThrow('Base marketing indisponible pour la conversion du lead');
  const existingRows = await prismaClient.$queryRawUnsafe(`
    SELECT * FROM marketing_leads WHERE email = $1::text LIMIT 1
  `, normalizedEmail);
  const existingLead = existingRows?.[0] || null;
  if (!existingLead) return null;

  const nowIso = new Date().toISOString();
  await prismaClient.$executeRawUnsafe(`
    UPDATE marketing_leads
    SET "status" = 'converted',
        nurturestage = $2::text,
        nextmarketingemailat = NULL,
        "updatedAt" = $3::timestamptz
    WHERE email = $1::text
  `, normalizedEmail, MARKETING_STAGE_DONE, nowIso);

  return existingLead;
}

async function registerLeadInResend(lead) {
  const contact = await syncMarketingContact({
    email: lead.email,
    firstName: lead.firstName,
    lastName: lead.lastName,
    unsubscribed: !!lead.unsubscribedAt || lead.marketingOptIn === false,
  });
  return contact?.id || contact?.object?.id || null;
}

async function sendLeadNurtureStage(lead, stage) {
  await sendMarketingNurtureEmail(lead.email, lead.firstName || '', lead.locale || 'fr', stage);

  const now = new Date();
  const update = {
    lastMarketingEmailAt: now.toISOString(),
    marketingOptIn: true,
    unsubscribedAt: null,
  };

  if (stage === 'j0') {
    update.nurtureStage = MARKETING_STAGE_J3;
    update.nextMarketingEmailAt = addDays(now, 3).toISOString();
  } else if (stage === 'j1' || stage === 'j3') {
    update.nurtureStage = MARKETING_STAGE_J10;
    update.nextMarketingEmailAt = addDays(now, 7).toISOString();
  } else {
    update.nurtureStage = MARKETING_STAGE_DONE;
    update.nextMarketingEmailAt = null;
  }

  await markLeadMarketingProgress(lead.id, update);
}

function resolveMarketingRedirectHref(rawHref) {
  const href = String(rawHref || '').trim();
  if (!href) return null;

  const allowedOrigins = [
    'https://feedplug.com',
    'https://www.feedplug.com',
    'https://app.feedplug.com',
  ];

  if (href.startsWith('/')) {
    return `https://feedplug.com${href}`;
  }

  try {
    const parsed = new URL(href);
    if (allowedOrigins.includes(parsed.origin)) {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function toPercent(value, fallback = 50) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeTargetChannels(value) {
  const allowed = new Set(['google_shopping', 'meta_ads', 'amazon', 'marketplaces', 'chatgpt']);
  const list = Array.isArray(value) ? value : [];
  return Array.from(new Set(list.map((item) => String(item || '').trim().toLowerCase()).filter((item) => allowed.has(item))));
}

function hasExplicitCoverage(coverage) {
  if (!coverage || typeof coverage !== 'object') return false;
  return ['title', 'description', 'image', 'brand', 'category', 'identifier', 'price', 'url', 'availability']
    .some((key) => Number.isFinite(Number(coverage[key])));
}

function deriveMarketingAuditCoverage(input = {}) {
  const connectorType = String(input.connectorType || 'OTHER').toUpperCase();
  const dataLevel = String(input.dataLevel || 'medium').trim().toLowerCase();
  const syncMode = String(input.syncMode || 'scheduled').trim().toLowerCase();
  const gmcStatus = String(input.gmcStatus || 'not_used').trim().toLowerCase();

  const base = {
    SHOPIFY: { title: 78, description: 64, image: 86, brand: 66, category: 56, identifier: 58, price: 95, url: 93, availability: 87 },
    PRESTASHOP: { title: 72, description: 57, image: 81, brand: 61, category: 49, identifier: 52, price: 92, url: 89, availability: 82 },
    GMC: { title: 79, description: 62, image: 84, brand: 72, category: 66, identifier: 69, price: 95, url: 92, availability: 88 },
    CSV: { title: 63, description: 48, image: 71, brand: 53, category: 42, identifier: 45, price: 89, url: 80, availability: 74 },
    OTHER: { title: 60, description: 46, image: 69, brand: 50, category: 40, identifier: 43, price: 87, url: 78, availability: 72 },
  }[connectorType] || { title: 60, description: 46, image: 69, brand: 50, category: 40, identifier: 43, price: 87, url: 78, availability: 72 };

  const dataAdjustments = {
    low: { title: -18, description: -16, image: -14, brand: -14, category: -15, identifier: -16, price: -6, url: -8, availability: -10 },
    medium: { title: 0, description: 0, image: 0, brand: 0, category: 0, identifier: 0, price: 0, url: 0, availability: 0 },
    high: { title: 11, description: 12, image: 8, brand: 9, category: 10, identifier: 11, price: 3, url: 4, availability: 5 },
  }[dataLevel] || { title: 0, description: 0, image: 0, brand: 0, category: 0, identifier: 0, price: 0, url: 0, availability: 0 };

  const syncAdjustments = {
    manual: { price: -10, availability: -13, url: -4, image: -3 },
    scheduled: { price: -3, availability: -4, url: 0, image: 0 },
    automatic: { price: 3, availability: 5, url: 1, image: 1 },
  }[syncMode] || { price: -3, availability: -4, url: 0, image: 0 };

  const gmcAdjustments = {
    not_used: { title: 0, category: 0, identifier: 0 },
    warnings: { title: -4, category: -7, identifier: -9 },
    many_disapprovals: { title: -8, category: -12, identifier: -16 },
    healthy: { title: 3, category: 4, identifier: 4 },
  }[gmcStatus] || { title: 0, category: 0, identifier: 0 };

  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => {
      const adjusted = value
        + (dataAdjustments[key] || 0)
        + (syncAdjustments[key] || 0)
        + (gmcAdjustments[key] || 0);
      return [key, Math.max(18, Math.min(98, Math.round(adjusted)))];
    })
  );
}

function buildMarketingAuditTopIssues(coverage, totalProducts, connectorType, targetChannels) {
  const fieldMeta = [
    {
      key: 'category',
      label: 'Categorisation',
      value: coverage.category,
      impact: 'La diffusion sur Google Shopping et les marketplaces restera sous-optimale.',
      recommendation: 'Completer google_product_category ou une taxonomie produit fiable.',
    },
    {
      key: 'identifier',
      label: 'Identifiants produit',
      value: coverage.identifier,
      impact: 'Les canaux transactionnels risquent le rejet ou une diffusion reduite.',
      recommendation: 'Renseigner GTIN, MPN ou SKU propre pour chaque produit actif.',
    },
    {
      key: 'title',
      label: 'Titres produit',
      value: coverage.title,
      impact: 'Le matching catalogue et la visibilite des annonces restent limites.',
      recommendation: 'Restructurer les titres avec marque, type et attributs distinctifs.',
    },
    {
      key: 'image',
      label: 'Images principales',
      value: coverage.image,
      impact: 'Le taux de clic et la readiness canal chutent fortement.',
      recommendation: 'Garantir une image principale exploitable pour tous les SKU prioritaires.',
    },
    {
      key: 'description',
      label: 'Descriptions',
      value: coverage.description,
      impact: 'Le flux manque de contexte semantique pour la diffusion et la conversion.',
      recommendation: 'Ajouter des descriptions plus riches avec usages et benefices.',
    },
    {
      key: 'brand',
      label: 'Marque',
      value: coverage.brand,
      impact: 'Les catalogues restent plus difficiles a classifier et a enchir intelligemment.',
      recommendation: 'Completer la marque ou la collection sur les produits eligibles.',
    },
    {
      key: 'url',
      label: 'URLs produit',
      value: coverage.url,
      impact: 'Le trafic sort mal du flux et certaines destinations deviennent non diffusables.',
      recommendation: 'Verifier que chaque produit pointe vers une URL propre et active.',
    },
  ];

  return fieldMeta
    .map((field) => {
      const gap = 100 - field.value;
      const affectedProducts = Math.round(totalProducts * (gap / 100));
      let severity = 'low';
      if (gap >= 35) severity = 'high';
      else if (gap >= 18) severity = 'medium';
      return {
        key: field.key,
        label: field.label,
        severity,
        affectedProducts,
        affectedRate: gap,
        impact: field.impact,
        recommendation: field.recommendation,
        channelsImpacted: targetChannels,
        connectorType,
      };
    })
    .sort((a, b) => b.affectedRate - a.affectedRate)
    .slice(0, 5);
}

function computeMarketingAuditReport(input = {}) {
  const connectorType = String(input.connectorType || 'OTHER').toUpperCase();
  const catalogSize = Math.max(1, Math.min(1000000, Number(input.catalogSize || 0) || 1));
  const targetChannels = normalizeTargetChannels(input.targetChannels);
  const coverageInput = hasExplicitCoverage(input.coverage) ? input.coverage : deriveMarketingAuditCoverage(input);
  const coverage = {
    title: toPercent(coverageInput.title, 72),
    description: toPercent(coverageInput.description, 58),
    image: toPercent(coverageInput.image, 76),
    brand: toPercent(coverageInput.brand, 61),
    category: toPercent(coverageInput.category, 45),
    identifier: toPercent(coverageInput.identifier, 49),
    price: toPercent(coverageInput.price, 92),
    url: toPercent(coverageInput.url, 88),
    availability: toPercent(coverageInput.availability, 79),
  };

  const connectorBaseline = {
    SHOPIFY: 72,
    PRESTASHOP: 64,
    GMC: 77,
    CSV: 58,
    OTHER: 54,
  }[connectorType] || 54;

  const channelWeights = {
    google_shopping: 1.2,
    meta_ads: 1.0,
    amazon: 1.25,
    marketplaces: 1.15,
    chatgpt: 0.9,
  };
  const activeChannels = targetChannels.length ? targetChannels : ['google_shopping'];
  const channelMultiplier = activeChannels.reduce((sum, channel) => sum + (channelWeights[channel] || 1), 0) / activeChannels.length;
  const diagnostics = input.gmcDiagnostics && typeof input.gmcDiagnostics === 'object' ? input.gmcDiagnostics : {};
  const disapprovalRate = toPercent(diagnostics.disapprovalRate, connectorType === 'GMC' ? 14 : 8);
  const issueCount = Math.max(0, Number(diagnostics.issueCount || 0));
  const diagnosticsScore = Math.max(35, 100 - disapprovalRate - Math.min(30, issueCount * 2));

  const channelReadiness = Math.round(
    activeChannels.reduce((sum, channel) => {
      if (channel === 'google_shopping') {
        return sum + ((coverage.title * 0.18) + (coverage.image * 0.18) + (coverage.price * 0.12) + (coverage.identifier * 0.18) + (coverage.category * 0.18) + (coverage.brand * 0.16));
      }
      if (channel === 'amazon') {
        return sum + ((coverage.title * 0.2) + (coverage.description * 0.18) + (coverage.image * 0.15) + (coverage.identifier * 0.2) + (coverage.brand * 0.12) + (coverage.price * 0.15));
      }
      if (channel === 'meta_ads') {
        return sum + ((coverage.title * 0.17) + (coverage.description * 0.18) + (coverage.image * 0.2) + (coverage.price * 0.15) + (coverage.url * 0.15) + (coverage.brand * 0.15));
      }
      if (channel === 'marketplaces') {
        return sum + ((coverage.title * 0.17) + (coverage.description * 0.16) + (coverage.image * 0.16) + (coverage.category * 0.16) + (coverage.identifier * 0.18) + (coverage.availability * 0.17));
      }
      return sum + ((coverage.title * 0.2) + (coverage.description * 0.22) + (coverage.image * 0.16) + (coverage.price * 0.12) + (coverage.url * 0.15) + (coverage.brand * 0.15));
    }, 0) / activeChannels.length
  );

  const dataCoverage = Math.round(
    (coverage.title * 0.14) +
    (coverage.description * 0.12) +
    (coverage.image * 0.14) +
    (coverage.brand * 0.08) +
    (coverage.category * 0.12) +
    (coverage.identifier * 0.14) +
    (coverage.price * 0.1) +
    (coverage.url * 0.08) +
    (coverage.availability * 0.08)
  );

  const currentScore = Math.max(
    25,
    Math.min(96, Math.round((dataCoverage * 0.48) + (channelReadiness * 0.27) + (connectorBaseline * 0.1) + (diagnosticsScore * 0.15)))
  );
  const recoverableGap = Math.round(
    ((100 - coverage.category) * 0.22) +
    ((100 - coverage.identifier) * 0.24) +
    ((100 - coverage.title) * 0.18) +
    ((100 - coverage.image) * 0.14) +
    ((100 - coverage.description) * 0.12) +
    ((100 - coverage.brand) * 0.1)
  );
  const potentialScore = Math.min(99, Math.round(currentScore + Math.max(10, Math.min(34, recoverableGap * 0.42 + (activeChannels.length * 2)))));

  const readyRate = Math.round(
    ((coverage.title * 0.15) + (coverage.image * 0.15) + (coverage.price * 0.1) + (coverage.url * 0.1) + (coverage.category * 0.15) + (coverage.identifier * 0.2) + (coverage.brand * 0.15)) / 1
  );
  const estimatedAdditionalApprovedProducts = Math.max(
    5,
    Math.min(
      catalogSize,
      Math.round(catalogSize * Math.min(0.72, ((potentialScore - currentScore) / 100) * (0.65 + ((channelMultiplier - 1) * 0.45))))
    )
  );
  const estimatedVisibilityLiftPct = Math.max(
    6,
    Math.min(58, Math.round(((potentialScore - currentScore) * 0.75) + ((activeChannels.length - 1) * 3)))
  );

  const topIssues = buildMarketingAuditTopIssues(coverage, catalogSize, connectorType, activeChannels);

  return {
    score: currentScore,
    potentialScore,
    estimatedAdditionalApprovedProducts,
    estimatedVisibilityLiftPct,
    summary: {
      totalProducts: catalogSize,
      sampleSize: catalogSize,
      averageProductScore: Math.round((currentScore * 0.55) + (dataCoverage * 0.45)),
      coverageRate: dataCoverage,
      approvalReadyRate: readyRate,
    },
    scoreBreakdown: {
      dataCoverage,
      productQuality: Math.round((currentScore * 0.55) + (dataCoverage * 0.45)),
      channelReadiness,
    },
    connectorType,
    targetChannels: activeChannels,
    coverage,
    gmcDiagnostics: {
      disapprovalRate,
      issueCount,
      diagnosticsScore,
    },
    topIssues,
    opportunities: [
      {
        label: 'Produits additionnels diffusable',
        value: estimatedAdditionalApprovedProducts,
        detail: 'Projection basee sur le volume catalogue, la couverture actuelle et les canaux cibles.',
      },
      {
        label: 'Gain de visibilite estime',
        value: `${estimatedVisibilityLiftPct}%`,
        detail: 'Potentiel calcule a partir du score recuperable et de la pression multicanal ciblee.',
      },
    ],
    methodology: {
      scoring: 'Le score combine la couverture des champs critiques, la readiness par canal vise et un facteur de complexite lie au connecteur.',
      estimation: 'Le potentiel combine le nombre de produits, les taux de couverture declares et les canaux cibles pour produire une estimation plus defensive.',
    },
  };
}

async function upsertMarketingLeadForAudit({ email, trimmed, locale, ipAddress, userAgent }) {
  const emailNormalized = String(email || '').trim().toLowerCase();
  const now = new Date();
  const nowIso = now.toISOString();
  // Le lead d'un audit entre dans la séquence post-audit (segment A/B),
  // 1er mail à J+1. On force l'étape même pour un lead déjà connu (ex.
  // early-access) : l'intention "audit" prime sur la séquence générique.
  const firstAuditEmailIso = addDays(now, 1).toISOString();
  if (!emailNormalized) return null;

  const prismaClient = await getPrismaClientOrThrow('Base marketing indisponible pour l’audit');
  const existing = await prismaClient.$queryRawUnsafe(`
    SELECT * FROM marketing_leads WHERE email = $1::text LIMIT 1
  `, emailNormalized);
  if (existing && existing.length > 0) {
    await prismaClient.$executeRawUnsafe(`
      UPDATE marketing_leads
      SET "firstName" = COALESCE(NULLIF($2::text, ''), "firstName"),
          "lastName" = COALESCE(NULLIF($3::text, ''), "lastName"),
          "jobTitle" = COALESCE(NULLIF($4::text, ''), "jobTitle"),
          phone = COALESCE(NULLIF($5::text, ''), phone),
          company = COALESCE(NULLIF($6::text, ''), company),
          locale = COALESCE($7::text, locale),
          source = 'audit_flux_marketing',
          marketingoptin = true,
          nurturestage = $8::text,
          nextmarketingemailat = $9::timestamptz,
          "updatedAt" = $10::timestamptz
      WHERE email = $1::text
        AND COALESCE("status", '') <> 'converted'
    `, emailNormalized, trimmed.firstName, trimmed.lastName, trimmed.jobTitle, trimmed.phone, trimmed.company, locale, MARKETING_STAGE_AUDIT_1, firstAuditEmailIso, nowIso);
    const refreshed = await prismaClient.$queryRawUnsafe(`SELECT * FROM marketing_leads WHERE email = $1::text LIMIT 1`, emailNormalized);
    return refreshed?.[0] || existing[0];
  }

  const leadId = crypto.randomUUID();
  await prismaClient.$executeRawUnsafe(`
    INSERT INTO marketing_leads (
      id, "firstName", "lastName", "jobTitle", phone, email, company,
      "ipAddress", "userAgent", locale, source, status,
      marketingoptin, nurturestage, nextmarketingemailat,
      "createdAt", "updatedAt"
    )
    VALUES (
      $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text,
      $8::text, $9::text, $10::text, 'audit_flux_marketing', 'new',
      true, $11::text, $12::timestamptz,
      $13::timestamptz, $13::timestamptz
    )
  `, leadId, trimmed.firstName, trimmed.lastName, trimmed.jobTitle, trimmed.phone, emailNormalized, trimmed.company, ipAddress, userAgent, locale, MARKETING_STAGE_AUDIT_1, firstAuditEmailIso, nowIso);
  const created = await prismaClient.$queryRawUnsafe(`SELECT * FROM marketing_leads WHERE id = $1::text LIMIT 1`, leadId);
  return created?.[0] || null;
}

function serializeMarketingAudit(audit) {
  if (!audit) return null;
  const report = typeof audit.reportjson === 'string' ? JSON.parse(audit.reportjson || '{}') : (audit.reportjson || {});
  const input = redactObjectSecrets(decryptObjectSecrets(typeof audit.inputjson === 'string' ? JSON.parse(audit.inputjson || '{}') : (audit.inputjson || {})));
  const targetChannels = typeof audit.targetchannels === 'string' ? JSON.parse(audit.targetchannels || '[]') : (audit.targetchannels || []);
  const publicBaseUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');
  const locale = audit.locale || 'fr';
  return {
    id: audit.id,
    shareToken: audit.sharetoken,
    shareUrl: `${publicBaseUrl}/${locale}/audit-flux/${audit.sharetoken}`,
    email: audit.email,
    company: audit.company,
    locale,
    connectorType: audit.connectortype,
    cmsUsed: input.cmsUsed || audit.connectortype,
    shopUrl: audit.shopurl,
    merchantId: audit.merchantid,
    catalogSize: Number(audit.catalogsize || 0),
    targetChannels,
    input,
    report: report && Object.keys(report).length > 0 ? report : null,
    status: audit.status,
    createdAt: audit.createdAt ? (audit.createdAt.toISOString ? audit.createdAt.toISOString() : audit.createdAt) : null,
    updatedAt: audit.updatedAt ? (audit.updatedAt.toISOString ? audit.updatedAt.toISOString() : audit.updatedAt) : null,
  };
}

// ── PDF d'audit premium extrait dans domains/audit/pdf.js (bloc 4) ───────────
// Génération HTML→PDF (Chromium/puppeteer-core, singleton + options inchangées)
// et fallback pdfkit. Aucune dépendance à l'état serveur ; ré-exposé ici via des
// const locales pour préserver les symboles injectés à registerMarketingRoutes.
const auditPdf = require('./domains/audit/pdf');
const buildAuditReportHtml = auditPdf.buildAuditReportHtml;
const renderAuditReportPdf = auditPdf.renderAuditReportPdf;
const buildMarketingAuditPdfBuffer = auditPdf.buildMarketingAuditPdfBuffer;

// ====== MARKETING (routes extraites dans routes/marketing.js) ======
const { registerMarketingRoutes } = require('./routes/marketing');
registerMarketingRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  requirePrismaForRequest,
  getPrismaClientOrThrow,
  authenticateToken,
  requireStaffAccess,
  marketingEarlyAccessLimiter,
  marketingAuditLimiter,
  marketingFeatureIdeaLimiter,
  getClientIp,
  auditStepFromStage,
  buildAuditIssuesList,
  buildAuditReportHtml,
  buildLeadTrimmedInput,
  buildMarketingAuditPdfBuffer,
  ensureAuditBeforeAfter,
  formatAuditBlocage,
  markLeadMarketingProgress,
  maybeGenerateMarketingAuditReport,
  normalizeMarketingLeadSource,
  normalizeTargetChannels,
  recordMarketingClick,
  registerLeadInResend,
  renderAuditReportPdf,
  resolveMarketingOutboundStage,
  resolveMarketingRedirectHref,
  sendAuditNurtureForLead,
  sendLeadNurtureStage,
  serializeMarketingAudit,
  serializeMarketingLead,
  stringifyEncryptedJson,
  upsertMarketingLeadForAudit,
  validateMarketingSubmission,
  APP_URL,
  MARKETING_STAGE_DONE,
  MARKETING_STAGE_J0,
});

// ====== AUTHENTICATION ======

// Routes d'authentification
const { registerAuthRoutes } = require('./routes/auth');
registerAuthRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  authenticateToken,
  smartAuthLimiter,
  registerLimiter,
  getClientIp,
  getLoginFailureStatus,
  recordLoginFailure,
  recordLoginSuccess,
  findUserByEmail,
  findUserById,
  issueAuthTokens,
  buildAuthUser,
  markMarketingLeadConverted,
  isStaffForUser,
  isStaffUser,
  verifyTurnstileToken,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  isTokenRevoked,
  jwtRefreshSecret: EFFECTIVE_JWT_REFRESH_SECRET,
  jwtVerifyOptions: JWT_VERIFY_OPTIONS,
});

let ensureCompanyInfoSchemaPromise = null;
async function ensureCompanyInfoSchema() {
  if (ensureCompanyInfoSchemaPromise) return ensureCompanyInfoSchemaPromise;
  ensureCompanyInfoSchemaPromise = (async () => {
    if (!(await ensurePrismaReady()) || !prisma) {
      throw new Error('Prisma indisponible');
    }
    await assertColumnsExist(prisma, 'Account', ['companyname', 'phonee164', 'billingemail'], '025_account_company_phone_billing.sql');
    await assertTableExists(prisma, 'OnboardingProgress', '017_billing_onboarding.sql');
  })().catch((error) => {
    ensureCompanyInfoSchemaPromise = null;
    throw error;
  });
  return ensureCompanyInfoSchemaPromise;
}

// Plan et limites (pour affichage frontend et barres de progression)
// ====== COMPTE singulier (3 routes /api/v1/account/* extraites dans routes/account.js, pattern routes/ingestion.js) ======
// Enregistrées plus bas dans run() via registerAccountSettingsRoutes(app, {...}). Bloc contigu,
// aucun doublon -> ordre de matching préservé.

// ====== COMPTE / PARAMÈTRES (GET account, PUT account, PUT profile, GET users) ======
app.get('/api/v1/accounts', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) {
      return res.status(403).json({ message: 'Compte non associé' });
    }
    let accounts;
    try {
      accounts = await prisma.$queryRawUnsafe(`
        SELECT id, name, plan, email, trialendsat, billingstatus, paymentgraceuntil
        FROM "Account" WHERE id = $1::text LIMIT 1
      `, accountId);
    } catch (err) {
      if (!err?.message || !/billingstatus|paymentgraceuntil|42703/i.test(err.message)) {
        throw err;
      }
      accounts = await prisma.$queryRawUnsafe(`
        SELECT id, name, plan, email, trialendsat
        FROM "Account" WHERE id = $1::text LIMIT 1
      `, accountId);
    }
    if (!accounts || accounts.length === 0) {
      return res.status(404).json({ message: 'Compte non trouvé' });
    }
    const account = accounts[0];
    const users = await prisma.$queryRawUnsafe(`
      SELECT id, email, firstname, lastname, role, createdat
      FROM "User" WHERE accountid = $1::text ORDER BY createdat DESC
    `, accountId);
    res.json({
      id: account.id,
      name: account.name,
      plan: account.plan || 'STARTER',
      email: account.email,
      trialEndsAt: account.trialendsat || null,
      billingStatus: account.billingstatus || null,
      paymentGraceUntil: account.paymentgraceuntil || null,
      users: (users || []).map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstname || '',
        lastName: u.lastname || '',
        role: u.role,
        status: u.status || 'ACTIVE',
        lastLoginAt: u.lastloginat || null,
        createdAt: u.createdat
      }))
    });
  } catch (error) {
    console.error('GET /accounts error:', error);
    res.status(500).json({ message: 'Erreur lors du chargement du compte' });
  }
});

app.put('/api/v1/accounts', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const role = (req.user && req.user.role) || '';
    if (!['OWNER', 'MANAGER'].includes(role)) {
      return res.status(403).json({ message: 'Permissions insuffisantes' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Le nom du compte est requis' });
    }
    await prisma.$executeRawUnsafe(`
      UPDATE "Account" SET name = $1::text, updatedat = NOW() WHERE id = $2::text
    `, name.trim(), accountId);
    res.json({ id: accountId, name: name.trim() });
  } catch (error) {
    console.error('PUT /accounts error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du compte' });
  }
});

// ===== RGPD : portabilité des données (export) =====
// Export JSON des données du compte : profil, équipe, feeds (+ comptage items),
// billing. OWNER uniquement. La privacy policy promet ce droit à la portabilité.
app.get('/api/v1/accounts/export', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent exporter les données du compte' });
    }
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) {
      return res.status(403).json({ message: 'Compte non associé' });
    }

    let accountRows;
    try {
      accountRows = await prisma.$queryRawUnsafe(`
        SELECT id, name, plan, email, companyname, billingemail, phonee164,
               trialendsat, billingstatus, paymentgraceuntil, createdat
        FROM "Account" WHERE id = $1::text LIMIT 1
      `, accountId);
    } catch (err) {
      if (!err?.message || !/billingstatus|paymentgraceuntil|companyname|billingemail|phonee164|42703/i.test(err.message)) {
        throw err;
      }
      accountRows = await prisma.$queryRawUnsafe(`
        SELECT id, name, plan, email, trialendsat, createdat
        FROM "Account" WHERE id = $1::text LIMIT 1
      `, accountId);
    }
    if (!accountRows || accountRows.length === 0) {
      return res.status(404).json({ message: 'Compte non trouvé' });
    }
    const account = accountRows[0];

    const users = await prisma.$queryRawUnsafe(`
      SELECT id, email, firstname, lastname, role, status, createdat
      FROM "User" WHERE accountid = $1::text ORDER BY createdat ASC
    `, accountId);

    // Feeds + comptage d'items par feed (LEFT JOIN pour inclure les feeds vides).
    let feeds = [];
    try {
      feeds = await prisma.$queryRawUnsafe(`
        SELECT f.id, f.name, f.status, f.frequency, f.createdat,
               COUNT(fi.id)::int AS itemcount
        FROM "Feed" f
        LEFT JOIN "FeedItem" fi ON fi.feedid = f.id
        WHERE f.accountid = $1::text
        GROUP BY f.id
        ORDER BY f.createdat ASC
      `, accountId);
    } catch (feedErr) {
      console.warn('GET /accounts/export feeds error:', feedErr?.message);
      feeds = [];
    }

    let billing = null;
    try {
      const billingRows = await prisma.$queryRawUnsafe(`
        SELECT companyname, siret, siren, vatnumber, addressline1, addressline2,
               postalcode, city, country, billingemail, createdat
        FROM "Billing" WHERE accountid = $1::text LIMIT 1
      `, accountId);
      billing = (billingRows && billingRows[0]) || null;
    } catch (billingErr) {
      console.warn('GET /accounts/export billing error:', billingErr?.message);
      billing = null;
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      format: 'feedplug-account-export-v1',
      account: {
        id: account.id,
        name: account.name,
        plan: account.plan || 'STARTER',
        email: account.email || null,
        companyName: account.companyname || null,
        billingEmail: account.billingemail || null,
        phone: account.phonee164 || null,
        trialEndsAt: account.trialendsat || null,
        billingStatus: account.billingstatus || null,
        paymentGraceUntil: account.paymentgraceuntil || null,
        createdAt: account.createdat || null,
      },
      users: (users || []).map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstname || '',
        lastName: u.lastname || '',
        role: u.role,
        status: u.status || 'ACTIVE',
        createdAt: u.createdat || null,
      })),
      feeds: (feeds || []).map(f => ({
        id: f.id,
        name: f.name,
        status: f.status,
        frequency: f.frequency,
        itemCount: typeof f.itemcount === 'number' ? f.itemcount : Number(f.itemcount || 0),
        createdAt: f.createdat || null,
      })),
      billing: billing ? {
        companyName: billing.companyname || null,
        siret: billing.siret || null,
        siren: billing.siren || null,
        vatNumber: billing.vatnumber || null,
        addressLine1: billing.addressline1 || null,
        addressLine2: billing.addressline2 || null,
        postalCode: billing.postalcode || null,
        city: billing.city || null,
        country: billing.country || null,
        billingEmail: billing.billingemail || null,
        createdAt: billing.createdat || null,
      } : null,
    };

    const filename = `feedplug-export-${accountId}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(exportPayload, null, 2));
  } catch (error) {
    console.error('GET /accounts/export error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'export des données du compte' });
  }
});

// ===== RGPD : suppression de compte (droit à l'effacement) =====
// DESTRUCTIF & IRRÉVERSIBLE. OWNER uniquement. Supprime l'Account et tout
// ce qui en dépend, puis révoque le token courant de l'appelant.
//
// Le schéma Prisma pose `onDelete: Cascade` sur la plupart des relations vers
// Account (User, Market, Destination, Billing, etc.) — la suppression de la
// ligne Account les efface automatiquement. MAIS quelques relations n'ont PAS
// de cascade et provoqueraient une violation de clé étrangère :
//   - FeedSource.account, Feed.account, ExportLog.account
// et la chaîne des feeds (FeedItem, IngestionRun, FeedError, EnrichmentSource,
// FeedItemRevision) doit être supprimée dans l'ordre enfant -> parent.
// StoreLocation / LocalInventory n'ont pas de FK vers Account mais portent un
// accountid : on les nettoie aussi pour ne laisser aucune donnée résiduelle.
// Le tout dans une transaction : soit tout part, soit rien.
app.delete('/api/v1/accounts', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent supprimer le compte' });
    }
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) {
      return res.status(403).json({ message: 'Compte non associé' });
    }

    // Vérifie l'existence avant la transaction (404 clair si déjà supprimé).
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Account" WHERE id = $1::text LIMIT 1`,
      accountId
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ message: 'Compte non trouvé' });
    }

    // Logique de suppression extraite & testée (tests/accounts/deletion.test.js).
    // Suppression ordonnée enfant -> parent (DELETE Account en dernier, déclenche
    // la cascade Prisma) puis révocation du token courant (RevokedJti, comme le
    // logout). Best-effort par table : l'erreur "table inexistante" (42P01) est
    // ignorée ; toute autre erreur fait échouer la transaction (rollback).
    const { runAccountDeletion } = require('./domains/accounts/deletion');
    await prisma.$transaction(async (tx) => {
      await runAccountDeletion(tx, accountId, {
        authorizationHeader: req.headers['authorization'],
        refreshToken: req.body?.refreshToken,
        jwtDecode: jwt.decode,
        onMissingTableWarn: (msg) => console.warn('DELETE /accounts: table absente, ignorée:', msg),
      });
    });

    return res.status(200).json({ message: 'Compte supprimé définitivement. Toutes vos données ont été effacées.' });
  } catch (error) {
    console.error('DELETE /accounts error:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du compte' });
  }
});

app.put('/api/v1/accounts/users/me', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const userId = req.user.id;
    const { firstName, lastName } = req.body || {};
    const updates = [];
    const args = [];
    let pos = 1;
    if (firstName !== undefined && typeof firstName === 'string') {
      updates.push(`firstname = $${pos}::text`);
      args.push(firstName.trim());
      pos++;
    }
    if (lastName !== undefined && typeof lastName === 'string') {
      updates.push(`lastname = $${pos}::text`);
      args.push(lastName.trim());
      pos++;
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour (firstName, lastName)' });
    }
    updates.push('updatedat = NOW()');
    args.push(userId);
    const sql = `UPDATE "User" SET ${updates.join(', ')} WHERE id = $${pos}::text`;
    await prisma.$executeRawUnsafe(sql, ...args);
    const updated = await findUserById(userId);
    if (!updated) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json({
      id: updated.id,
      email: updated.email,
      firstName: updated.firstname,
      lastName: updated.lastname,
      role: updated.role,
      accountId: updated.accountid
    });
  } catch (error) {
    console.error('PUT /accounts/users/me error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil' });
  }
});

app.get('/api/v1/accounts/users', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) {
      return res.status(403).json({ message: 'Compte non associé' });
    }
    const users = await prisma.$queryRawUnsafe(`
      SELECT id, email, firstname, lastname, role, createdat
      FROM "User" WHERE accountid = $1::text ORDER BY createdat DESC
    `, accountId);
    res.json((users || []).map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstname || '',
      lastName: u.lastname || '',
      role: u.role,
      status: u.status || 'ACTIVE',
      lastLoginAt: u.lastloginat || null,
      createdAt: u.createdat
    })));
  } catch (error) {
    console.error('GET /accounts/users error:', error);
    res.status(500).json({ message: 'Erreur lors du chargement des utilisateurs' });
  }
});

// Changer le rôle d'un membre (OWNER uniquement)
app.put('/api/v1/accounts/users/:userId/role', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent modifier les rôles' });
    }
    const { userId } = req.params;
    const { role } = req.body || {};
    const accountId = req.user.accountId || req.accountId;
    if (!['OWNER', 'MANAGER', 'VIEWER', 'AGENCY'].includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }
    if (userId === req.user.id) {
      return res.status(403).json({ message: 'Vous ne pouvez pas modifier votre propre rôle' });
    }
    const target = await prisma.$queryRawUnsafe(`
      SELECT id FROM "User" WHERE id = $1::text AND accountid = $2::text LIMIT 1
    `, userId, accountId);
    if (!target || target.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    await prisma.$executeRawUnsafe(`
      UPDATE "User" SET role = $1::text, updatedat = NOW() WHERE id = $2::text
    `, role, userId);
    res.json({ id: userId, role });
  } catch (error) {
    console.error('PUT /accounts/users/:userId/role error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du rôle' });
  }
});

// Retirer un membre du compte (OWNER uniquement)
app.delete('/api/v1/accounts/users/:userId', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent retirer des membres' });
    }
    const { userId } = req.params;
    const accountId = req.user.accountId || req.accountId;
    if (userId === req.user.id) {
      return res.status(403).json({ message: 'Vous ne pouvez pas vous retirer vous-même' });
    }
    const target = await prisma.$queryRawUnsafe(`
      SELECT id FROM "User" WHERE id = $1::text AND accountid = $2::text LIMIT 1
    `, userId, accountId);
    if (!target || target.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = $1::text`, userId);
    res.json({ message: 'Utilisateur retiré du compte' });
  } catch (error) {
    console.error('DELETE /accounts/users/:userId error:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

// Inviter un membre (OWNER ou MANAGER)
app.post('/api/v1/accounts/users/invite', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const role = (req.user && req.user.role) || '';
    if (!['OWNER', 'MANAGER'].includes(role)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour inviter' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { email, firstName, lastName, role: inviteRole } = req.body || {};
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ message: 'Email requis' });
    }
    const validRoles = ['OWNER', 'MANAGER', 'VIEWER', 'AGENCY'];
    const finalRole = validRoles.includes(inviteRole) ? inviteRole : 'VIEWER';
    const existing = await prisma.$queryRawUnsafe(`
      SELECT id FROM "User" WHERE email = $1::text LIMIT 1
    `, email.trim().toLowerCase());
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: 'Un utilisateur avec cet email existe déjà' });
    }
    const id = crypto.randomUUID();
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationTokenHash = hashAuthActionToken(invitationToken);
    const invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "User" (id, email, firstname, lastname, role, accountid, provider, password, resettoken, resettokenexpiry, status, createdat, updatedat)
        VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, 'local', '', $7::text, $8::timestamptz, 'INACTIVE', NOW(), NOW())
      `, id, email.trim().toLowerCase(), (firstName || '').trim(), (lastName || '').trim(), finalRole, accountId, invitationTokenHash, invitationExpiry);
    } catch (insertErr) {
      if (insertErr.message && insertErr.message.includes('status')) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "User" (id, email, firstname, lastname, role, accountid, provider, password, resettoken, resettokenexpiry, createdat, updatedat)
          VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, 'local', '', $7::text, $8::timestamptz, NOW(), NOW())
        `, id, email.trim().toLowerCase(), (firstName || '').trim(), (lastName || '').trim(), finalRole, accountId, invitationTokenHash, invitationExpiry);
      } else throw insertErr;
    }
    const inviterName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || null;
    const inviter = await findUserById(req.user.id);
    const inviterDisplayName = inviter ? [inviter.firstname, inviter.lastname].filter(Boolean).join(' ') : inviterName;
    sendInvitationEmail(email.trim(), (firstName || '').trim(), inviterDisplayName, invitationToken).catch(e => console.warn('Email invitation non envoyé:', e.message));
    res.status(201).json({
      id,
      email: email.trim().toLowerCase(),
      firstName: (firstName || '').trim(),
      lastName: (lastName || '').trim(),
      role: finalRole,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('POST /accounts/users/invite error:', error);
    res.status(500).json({ message: error.message || 'Erreur lors de l\'invitation' });
  }
});

// Changer le mot de passe (utilisateur connecté)

// ====== MARCHÉS (10 routes /api/v1/markets/* extraites dans routes/markets.js, pattern routes/ingestion.js) ======
// Enregistrées plus bas dans run() via registerMarketsRoutes(app, {...}) car les helpers
// injectés (createMarket, getHydratedMarketsForAccount, syncDestinationsForMarket, etc.) et
// la traduction (translateProductForMarket) sont définis/requis dans le scope ; le require
// est relocalisé en tête de routes/markets.js. Bloc contigu -> ordre de matching préservé.


// Onboarding + Billing B2B + Stripe
const { registerOnboardingBillingRoutes } = require('./routes/onboarding-billing');
registerOnboardingBillingRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  authenticateToken,
});

// Gestion de l'arrêt propre du serveur
// ====== ENRICHISSEMENT AUTOMATIQUE ======

// Analyser un produit pour identifier les enrichissements possibles
// Enrichir un produit automatiquement (optionnel: fields = tableau de clés à appliquer uniquement)
// Enrichir tous les produits d'un feed
// Enrichissement en masse amélioré avec IA et historique
// Statistiques d'enrichissement pour un feed (réponse 200 avec valeurs par défaut si table absente ou erreur)
// Resume global du catalogue pour un feed (non pagine)
// Historique des enrichissements pour un produit
// ----- Révisions (historisation) et retour au flux -----

// Liste des révisions d'un item
// Restaurer un item à une révision donnée
// Revenir aux valeurs du flux (dernière révision source = ingestion)
// Résout un identifiant item (id, sku ou mpn) vers l'id interne FeedItem
async function resolveItemId(prisma, id, accountId = null) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    const r = accountId
      ? await prisma.$queryRawUnsafe(`
          SELECT i.id
          FROM "FeedItem" i
          JOIN "Feed" f ON i.feedid = f.id
          WHERE i.id = $1::text AND f.accountid = $2::text
          LIMIT 1
        `, id, accountId)
      : await prisma.$queryRawUnsafe(`SELECT id FROM "FeedItem" WHERE id = $1::text LIMIT 1`, id);
    return r && r[0] ? r[0].id : null;
  }
  const byMpn = accountId
    ? await prisma.$queryRawUnsafe(`
        SELECT i.id
        FROM "FeedItem" i
        JOIN "Feed" f ON i.feedid = f.id
        WHERE i.mpn = $1::text AND f.accountid = $2::text
        LIMIT 1
      `, id, accountId)
    : await prisma.$queryRawUnsafe(`SELECT id FROM "FeedItem" WHERE mpn = $1::text LIMIT 1`, id);
  if (byMpn && byMpn[0]) return byMpn[0].id;
  const bySku = accountId
    ? await prisma.$queryRawUnsafe(`
        SELECT i.id
        FROM "FeedItem" i
        JOIN "Feed" f ON i.feedid = f.id
        WHERE i.sku = $1::text AND f.accountid = $2::text
        LIMIT 1
      `, id, accountId)
    : await prisma.$queryRawUnsafe(`SELECT id FROM "FeedItem" WHERE sku = $1::text LIMIT 1`, id);
  return bySku && bySku[0] ? bySku[0].id : null;
}

// PUT : mise à jour d'un item (édition manuelle) + création révision avant update
// PATCH : préférences de diffusion par canal pour un item (stockées dans customfields._channelOverrides)
// PATCH : sauvegarder le contenu optimisé par plateforme (titre, description) pour un item
// Liste de tous les comptes — RÉSERVÉ STAFF FEEDPLUG
// ====== ADMIN (4 routes /api/v1/admin/* staff extraites dans routes/admin.js, pattern routes/ingestion.js) ======
// Enregistrées plus bas dans run() via registerAdminRoutes(app, {...}). Bloc contigu,
// aucun doublon -> ordre de matching préservé. (/api/v1/admin/performance/purge reste avec performance.)

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server (graceful shutdown)');
  const GRACEFUL_SHUTDOWN_TIMEOUT_MS = parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || '30000', 10);
  const forceExit = () => {
    console.warn('Graceful shutdown timeout: forcing exit');
    process.exit(1);
  };
  const timeoutId = setTimeout(forceExit, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

  const done = async () => {
    clearTimeout(timeoutId);
    if (prisma && prismaReady) {
      await prisma.$disconnect();
    }
    process.exit(0);
  };

  if (server) {
    server.close((err) => {
      if (err) console.error('Error closing HTTP server:', err);
      done();
    });
  } else {
    await done();
  }
});

// ====== ROUTES MODULAIRES (ancien agrégateur supprimé) ======
// L'ancien `registerAllRoutes` (routes/index.js) était CASSÉ et silencieusement
// avalé par un try/catch : il appelait `registerAuthRoutes(app, prisma, …)` alors
// que routes/auth.js attend la signature `(app, deps)` → destructuration depuis
// `prisma` (null au moment de l'enregistrement) → throw. Résultat : seul
// registerHealthRoutes s'exécutait (1er appel) en n'enregistrant que des doublons
// morts, puis tout s'arrêtait. Net : AUCUNE route utile n'était servie par ce
// chemin (health/diagnostic/chaos servis inline ; auth/enrichment enregistrés
// directement ; accounts servi inline). Bloc + modules morts supprimés
// (routes/index.js, routes/health.js, routes/accounts.js) — route-inventory
// inchangé (preuve que c'était du code mort).

// ====== ENRICHISSEMENT IA ======

const { optimizeTitleWithAI, optimizeTitlesBatch, calculateTitleScore } = require('./optimization/title-optimizer');
const { optimizeDescriptionWithAI, optimizeDescriptionsBatch, calculateDescriptionScore } = require('./optimization/description-optimizer');
const { generateHighlightsWithAI } = require('./optimization/highlights-generator');
const { optimizeImage, optimizeImagesBatch } = require('./optimization/image-optimizer');
const { generateLifestyleImage, downloadImageAsBase64, PRESET_SCENES } = require('./optimization/lifestyle-image-generator');

// Générer des titres optimisés par IA pour plusieurs items (platform = GMC|META|AMAZON|CHATGPT)
// La route /api/v1/optimization/titles/generate est extraite dans routes/optimization.js
// (pattern routes/ingestion.js) ; enregistrée plus bas via registerOptimizationRoutes. Le require
// optimizeTitleWithAI ci-dessus reste car partagé par d'autres routes inline.

// ====== ENRICHISSEMENT IA (routes extraites dans routes/enrichment.js) ======
// ====== INGESTION (44 routes extraites dans routes/ingestion.js, pattern routes/enrichment.js) ======
// Enregistrees ici (et non a leur position d'origine) car certains helpers injectes
// sont des const initialisees plus haut dans run(); a ce point tous sont definis.
// Aucune route ne chevauche les chemins /api/v1/ingestion/* -> ordre de matching preserve.
const { registerIngestionRoutes } = require('./routes/ingestion');
registerIngestionRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
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
});

// ====== PLATEFORMES (38 routes /api/v1/platforms/* extraites dans routes/platforms.js, pattern routes/ingestion.js) ======
// Enregistrees ici (et non a leur position d'origine) car certains helpers injectes
// (executeGmcPush/executeAmazonPush/executeLiaShopifySync, scheduleAutoGmcPush, etc.) sont
// definis plus bas dans run(); a ce point ils sont hoistes (function declarations).
// La route /api/v1/marketing/audits/:shareToken/platforms/gmc/auth-url (non-platforms) reste
// dans server-minimal.js -> ordre de matching preserve.
const { registerComparatorRoutes } = require('./routes/comparator');
registerComparatorRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  ingestCsvFromUrl,
});

const { registerComparateurRoutes } = require('./routes/comparateur');
registerComparateurRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
});

// Auth CONSO du comparateur (magic-link) — population séparée du B2B.
const { registerComparatorAccountRoutes } = require('./routes/comparator-account');
const { sendComparatorMagicLinkEmail: sendComparatorMagicLink } = require('./email/email-service');
const { requireComparatorAuth: requireComparatorAuthMw } = registerComparatorAccountRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  sendMagicLinkEmail: sendComparatorMagicLink,
});

// Données du compte conso (intérêts, watchlist, feed perso) — réutilise le middleware auth ci-dessus.
const { registerComparatorAccountDataRoutes } = require('./routes/comparator-account-data');
registerComparatorAccountDataRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  requireComparatorAuth: requireComparatorAuthMw,
});

// Profil + suppression RGPD du compte conso — réutilise le middleware auth ci-dessus.
const { registerComparatorAccountProfileRoutes } = require('./routes/comparator-account-profile');
registerComparatorAccountProfileRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  requireComparatorAuth: requireComparatorAuthMw,
});

// Wallet cashback conso (lecture du ledger) — réutilise le middleware auth ci-dessus.
const { registerCashbackAccountRoutes } = require('./routes/cashback-account');
registerCashbackAccountRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  requireComparatorAuth: requireComparatorAuthMw,
});

// Poll interne des conversions AWIN (Cloud Scheduler, auth x-scheduler-secret) → ledger cashback.
const { registerCashbackRoutes } = require('./routes/cashback');
registerCashbackRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
});

// Abonnements push du compte conso (web + natif) — réutilise le middleware auth ci-dessus.
const { registerComparatorAccountPushRoutes } = require('./routes/comparator-account-push');
registerComparatorAccountPushRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  requireComparatorAuth: requireComparatorAuthMw,
});

// Cron interne des alertes baisse de prix (Cloud Scheduler, auth x-scheduler-secret).
const { registerComparatorAlertsRoutes } = require('./routes/comparator-alerts');
registerComparatorAlertsRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
});

const { registerPlatformsRoutes } = require('./routes/platforms');
registerPlatformsRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  AMAZON_APPLICATION_ID,
  AMAZON_CHANNEL_CONFIG,
  AMAZON_CONNECT_CODE_TTL_MS,
  AMAZON_LOGIN_URI,
  AMAZON_LWA_CLIENT_ID,
  AMAZON_LWA_CLIENT_SECRET,
  AMAZON_REDIRECT_URI,
  AMAZON_SELLER_CENTRAL_BASE,
  AMAZON_STATE_TTL_MS,
  APP_URL,
  GMC_SELECTION_TTL_MS,
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REDIRECT_URI,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  OAUTH_EPHEMERAL_FLOW_AMAZON_CONNECT,
  OAUTH_EPHEMERAL_FLOW_AMAZON_STATE,
  OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE,
  OAUTH_EPHEMERAL_FLOW_GMC_SELECTION,
  OAUTH_EPHEMERAL_FLOW_GOOGLE_ADS_OAUTH_STATE,
  OAUTH_EPHEMERAL_PROVIDER_AMAZON,
  OAUTH_EPHEMERAL_PROVIDER_GMC,
  OAuth2Client,
  authenticateJwtOrShopifySession,
  buildDashboardRedirectUrl,
  buildEmbeddedShopifyAdminRedirectUrl,
  buildFluxRedirectUrl,
  buildLocalizedAppUrl,
  buildSurfaceReturnRedirectUrl,
  checkChannelLimit,
  consumeOAuthEphemeralState,
  countChannelsForAccount,
  crypto,
  decryptSecret,
  encryptSecret,
  enrichGmcMerchantNames,
  executeAmazonPush,
  executeGmcPush,
  executeLiaShopifySync,
  getDestinationPushContext,
  getShopifyAdminAccessForAccount,
  normalizeAppLocale,
  normalizeDashboardReturnTo,
  normalizeEmbeddedReturnTo,
  parseJsonObject,
  readOAuthEphemeralState,
  requireAuth,
  resolveDefaultFeedIdForAccount,
  respondLiaScopeMissing,
  revokeGoogleOAuthToken,
  saveGmcConnection,
  scheduleAutoGmcPush,
  scheduleSyncGoogleAdsPerformance,
  shopifyAdminGraphql,
  storeOAuthEphemeralState,
  stringifyEncryptedJson,
  upsertPlatformConnection,
  verifyFeedAccess,
});

const { registerEnrichmentRoutes } = require('./routes/enrichment');
registerEnrichmentRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  storage,
  bucketName,
  normalizePlatformKey,
  canUseFeature,
  trackAiUsage,
  verifyItemAccess,
  getDestinationPushContext,
  resolveItemId,
});

// ====== NOTIFICATIONS (4 routes /api/v1/notifications/* extraites dans routes/notifications.js, pattern routes/ingestion.js) ======
// Enregistrées ici (et non à leur position d'origine) car requireAuth est défini
// plus bas dans run() (hoisté). Aucun autre chemin ne chevauche /api/v1/notifications.
const { registerNotificationsRoutes } = require('./routes/notifications');
registerNotificationsRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  requireAuth,
});

// ====== MARCHÉS (10 routes /api/v1/markets/* extraites dans routes/markets.js, pattern routes/ingestion.js) ======
const { registerMarketsRoutes } = require('./routes/markets');
registerMarketsRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  MARKET_PLATFORM_OPTIONS,
  authenticateToken,
  canManageMarkets,
  checkChannelLimit,
  countChannelsForAccount,
  createMarket,
  crypto,
  ensureMarketLocales,
  ensureMarketsBackfillForAccount,
  getHydratedMarketsForAccount,
  getMarketCurrency,
  getMarketName,
  getMarketsUnavailableResponse,
  inferAmazonChannelKeyForMarket,
  listPlatformAccountsForAccount,
  normalizeMarketChannelInput,
  normalizeMarketCode,
  normalizeMarketLocaleInput,
  normalizePlatformKey,
  parseJsonObject,
  pickPlatformAccountId,
  syncDestinationsForMarket,
  upsertMarketChannels,
});

// ====== COMPTE singulier (3 routes /api/v1/account/* extraites dans routes/account.js, pattern routes/ingestion.js) ======
const { registerAccountSettingsRoutes } = require('./routes/account');
registerAccountSettingsRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  authenticateToken,
  countChannelsForAccount,
  countProductsForAccount,
  ensureCompanyInfoSchema,
  getAccountAddonIA,
  getAccountMaxChannels,
  getAccountPlan,
  getPlanCapabilitiesForApi,
  requirePrismaForRequest,
});

// ====== ADMIN (4 routes /api/v1/admin/* staff extraites dans routes/admin.js, pattern routes/ingestion.js) ======
const { registerAdminRoutes } = require('./routes/admin');
registerAdminRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  authenticateToken,
  requireStaffAccess,
});

// ====== TESTS A/B (témoin + variant, statistiquement cohérents) ======
try {
  const { registerAbTestRoutes } = require('./routes/ab-tests');
  registerAbTestRoutes(app, {
    prisma,
    authenticateToken,
    getAccountId: (req) => req.accountId
  });
} catch (e) {
  console.warn('Routes AB tests non chargées:', e.message);
}

// ====== SCORING PAR CANAL (qualité + performance) ======
try {
  const { registerChannelScoringRoutes } = require('./routes/channel-scoring');
  registerChannelScoringRoutes(app, {
    // Getter : `prisma` est initialisé après l'enregistrement des routes.
    getPrisma: () => prisma,
    authenticateToken,
    getAccountId: (req) => req.accountId
  });
} catch (e) {
  console.warn('Routes scoring canaux non chargées:', e.message);
}

// ====== PERFORMANCE (6 routes extraites dans routes/performance.js, pattern routes/ingestion.js) ======
// Enregistrées ICI (position d'origine, après le scoring par canal) via registerPerformanceRoutes.
// Les requires propres au domaine (write-perf, sync-google-ads/meta-ads/amazon-ads) sont relocalisés
// dans le module. Bloc contigu (inclut /api/v1/admin/performance/purge) -> ordre de matching préservé.
const { registerPerformanceRoutes } = require('./routes/performance');
registerPerformanceRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  authenticateToken,
  decryptPlatformConnection,
  decryptSecret,
  verifyItemAccess,
});

// ====== OPTIMISATION (1 route /api/v1/optimization/titles/generate extraite dans routes/optimization.js) ======
const { registerOptimizationRoutes } = require('./routes/optimization');
registerOptimizationRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  authenticateToken,
  canUseFeature,
  checkAiQuota,
  optimizeTitleWithAI,
  quotaMessage,
  resolveItemId,
  trackAiUsage,
  verifyItemAccess,
});

// ====== DASHBOARD (1 route /api/v1/dashboard/overview extraite dans routes/dashboard.js) ======
const { registerDashboardRoutes } = require('./routes/dashboard');
registerDashboardRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  calculateDescriptionScore,
  calculateTitleScore,
  requireAuth,
});

// ====== EMBEDDED (4 routes /api/v1/embedded/* extraites dans routes/embedded.js, pattern routes/ingestion.js) ======
// Enregistrées ici car les helpers injectés (scheduleAutoGmcPush/LiaSync/Optimization,
// findShopifyFeedForAccount) sont des function declarations hoistées plus bas dans run().
const { registerEmbeddedRoutes } = require('./routes/embedded');
registerEmbeddedRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
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
});

// ====== BILLING SHOPIFY (4 routes /api/v1/billing/shopify/* extraites dans routes/shopify-billing.js) ======
// Enregistrées ici car findShopifyCredentialForAccount est une function declaration hoistée plus bas dans run().
const { registerShopifyBillingRoutes } = require('./routes/shopify-billing');
registerShopifyBillingRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  APP_URL,
  SHOPIFY_API_KEY,
  authenticateJwtOrShopifySession,
  findShopifyCredentialForAccount,
  shopifyBilling,
  shopifyManagedPricing,
});

// ====== CONNECTEURS SHOPIFY (6 routes extraites dans routes/connectors.js, pattern routes/ingestion.js) ======
const { registerConnectorsRoutes } = require('./routes/connectors');
registerConnectorsRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  APP_URL,
  OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
  OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
  SHOPIFY_ADMIN_API_VERSION,
  SHOPIFY_APPS,
  resolveShopifyApp,
  SHOPIFY_OAUTH_STATE_TTL_MS,
  authenticateToken,
  buildShopifyAdminGraphqlUrl,
  consumeOAuthEphemeralState,
  crypto,
  decryptObjectSecrets,
  normalizeShopifyShop,
  shopifyProvisioning,
  storeOAuthEphemeralState,
  stringifyEncryptedJson,
  verifyShopifyInstallHmac,
  // Session tokens = app embedded listée uniquement → pré-lié à ses creds.
  verifyShopifySessionToken: (token) =>
    verifyShopifySessionToken(token, {
      apiKey: SHOPIFY_APPS.listed.apiKey,
      apiSecret: SHOPIFY_APPS.listed.apiSecret,
    }),
});

// ====== PLATEFORMES — Google Merchant Center OAuth2 + Push ======



// ====== MARKETING AUDITS — connect (4 routes /api/v1/marketing/audits/:shareToken/* extraites dans routes/marketing-audits.js) ======
// Module frère de routes/marketing.js. Enregistrées ICI (position d'origine de la route gmc/auth-url).
// Aucun chevauchement de chemin/méthode avec les routes /api/v1/marketing/audits/:shareToken(/pdf) de
// routes/marketing.js (segments/méthodes distincts) -> ordre de matching préservé.
const { registerMarketingAuditsConnectRoutes } = require('./routes/marketing-audits');
registerMarketingAuditsConnectRoutes(app, {
  getPrisma: () => prisma,
  getPrismaReady: () => prismaReady,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE,
  OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
  OAUTH_EPHEMERAL_PROVIDER_GMC,
  OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
  OAuth2Client,
  SHOPIFY_APPS,
  resolveShopifyApp,
  SHOPIFY_OAUTH_STATE_TTL_MS,
  crypto,
  decryptObjectSecrets,
  fetchMarketingAuditFileItems,
  fetchPrestashopProducts,
  normalizeShopifyShop,
  storeOAuthEphemeralState,
  stringifyEncryptedJson,
});





















// ===== LIA × SHOPIFY POS — stock par emplacement Shopify =====
// Le marchand lie ses emplacements Shopify (POS) à ses codes magasins Google
// Business Profile ; le stock "available" par emplacement est ensuite
// synchronisé dans LocalInventory (à la demande + après chaque sync Shopify).
// Nécessite les scopes optionnels read_locations + read_inventory.

// Résout l'accès Admin API Shopify du compte (boutique + token déchiffré).
async function getShopifyAdminAccessForAccount(accountId) {
  const feed = await findShopifyFeedForAccount(accountId);
  if (!feed || !feed.shop || !feed.credentialId) return null;
  const credRows = await prisma.$queryRawUnsafe(
    `SELECT secretjson FROM "Credential" WHERE id = $1::text LIMIT 1`,
    feed.credentialId
  );
  if (!credRows?.length) return null;
  const secret = decryptObjectSecrets(
    typeof credRows[0].secretjson === 'string' ? JSON.parse(credRows[0].secretjson) : credRows[0].secretjson
  );
  const accessToken = secret.accessToken || secret.access_token;
  if (!accessToken) return null;
  return { shop: feed.shop, accessToken, feedId: feed.feedId };
}

async function shopifyAdminGraphql({ shop, accessToken, query, variables }) {
  const response = await fetch(buildShopifyAdminGraphqlUrl(shop), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error(`Shopify Admin API a répondu ${response.status}`);
    err.statusCode = 502;
    throw err;
  }
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const message = data.errors.map((e) => e?.message).filter(Boolean).join(' | ');
    const accessDenied = data.errors.some(
      (e) => e?.extensions?.code === 'ACCESS_DENIED' || /access denied/i.test(String(e?.message || ''))
    );
    const err = new Error(message || 'Erreur GraphQL Shopify');
    err.statusCode = accessDenied ? 403 : 502;
    err.scopeMissing = accessDenied;
    throw err;
  }
  return data?.data || {};
}

function respondLiaScopeMissing(res) {
  return res.status(403).json({
    code: 'SCOPE_MISSING',
    message: 'FeedPlug a besoin des autorisations Shopify "read_locations" et "read_inventory" pour lire le stock par emplacement.',
    requiredScopes: ['read_locations', 'read_inventory'],
  });
}



// Récupère le stock "available" par emplacement Shopify et l'upserte dans
// LocalInventory pour les magasins liés. offerId = FeedItem.originid (GID
// variant sans le préfixe gid://shopify/), identique au push GMC.
async function executeLiaShopifySync(accountId) {
  const mappings = await prisma.$queryRawUnsafe(
    `SELECT storecode, shopifylocationid FROM "StoreLocation" WHERE accountid = $1::text AND isactive = true AND shopifylocationid IS NOT NULL`,
    accountId
  );
  if (!mappings || mappings.length === 0) {
    return { synced: 0, stores: 0 };
  }
  const access = await getShopifyAdminAccessForAccount(accountId);
  if (!access) {
    const err = new Error('Aucune boutique Shopify connectée à ce compte.');
    err.statusCode = 404;
    throw err;
  }
  const storeCodeByLocation = new Map(mappings.map((m) => [m.shopifylocationid, m.storecode]));

  const rows = [];
  let cursor = null;
  let hasNextPage = true;
  let pages = 0;
  while (hasNextPage && pages < 200) {
    pages += 1;
    const data = await shopifyAdminGraphql({
      ...access,
      query: `
        query LiaInventory($first: Int!, $after: String) {
          productVariants(first: $first, after: $after) {
            pageInfo { hasNextPage endCursor }
            edges { node {
              id
              inventoryItem {
                inventoryLevels(first: 50) {
                  edges { node {
                    location { id }
                    quantities(names: ["available"]) { name quantity }
                  } }
                }
              }
            } }
          }
        }
      `,
      variables: { first: 100, after: cursor },
    });
    const connection = data?.productVariants;
    for (const edge of connection?.edges || []) {
      const node = edge?.node;
      const offerId = String(node?.id || '').replace(/^gid:\/\/shopify\//, '').substring(0, 50);
      if (!offerId) continue;
      for (const levelEdge of node?.inventoryItem?.inventoryLevels?.edges || []) {
        const level = levelEdge?.node;
        const storeCode = storeCodeByLocation.get(level?.location?.id);
        if (!storeCode) continue;
        const available = (level?.quantities || []).find((q) => q?.name === 'available');
        const quantity = Number(available?.quantity);
        if (!Number.isFinite(quantity)) continue;
        rows.push({ storeCode, offerId, quantity: Math.max(0, Math.trunc(quantity)) });
      }
    }
    hasNextPage = connection?.pageInfo?.hasNextPage === true;
    cursor = connection?.pageInfo?.endCursor || null;
  }

  const CHUNK = 500;
  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    const chunk = rows.slice(offset, offset + CHUNK);
    const values = [];
    const params = [accountId];
    for (const row of chunk) {
      const base = params.length;
      params.push(crypto.randomUUID(), row.storeCode, row.offerId, row.quantity);
      values.push(`($${base + 1}::text, $1::text, $${base + 2}::text, $${base + 3}::text, $${base + 4}::int, NOW(), NOW())`);
    }
    // availability remis à NULL : pour une ligne pilotée par le stock POS, la
    // disponibilité doit se déduire de la quantité (buildLiaRows), pas d'un
    // ancien import CSV qui dirait "in stock" avec un stock à zéro.
    await prisma.$executeRawUnsafe(`
      INSERT INTO "LocalInventory" (id, accountid, storecode, offerid, quantity, createdat, updatedat)
      VALUES ${values.join(', ')}
      ON CONFLICT (accountid, storecode, offerid) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        availability = NULL,
        updatedat = NOW()
    `, ...params);
  }
  return { synced: rows.length, stores: mappings.length };
}

// Sync LIA automatique (fire-and-forget, débouncée par compte) après les
// ingestions Shopify. No-op si aucun emplacement n'est lié.
const autoLiaSyncTimers = new Map();
// Sprint 2 : signature publique inchangée. Bloc 1 extrait dans
// domains/jobs/handlers.js ; wrappers de mêmes signatures délégant à jobHandlers.
function scheduleAutoLiaSync(accountId, reason, delayMs = AUTO_GMC_PUSH_DEBOUNCE_MS) {
  return jobHandlers.scheduleAutoLiaSync(accountId, reason, delayMs);
}
async function runAutoLiaSync(payload) {
  return jobHandlers.runAutoLiaSync(payload);
}










// Helper : rafraîchir le token d'accès GMC
async function refreshGMCToken(connection) {
  if (!connection.refreshtoken) {
    throw new Error('Pas de refresh token — reconnectez Google Merchant Center');
  }
  
  const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  const refreshToken = decryptSecret(connection.refreshtoken);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  // Mettre à jour en base
  if (prismaReady && prisma) {
    const expiry = credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null;
    await prisma.$executeRawUnsafe(`
      UPDATE "PlatformConnection" SET 
        accesstoken = $1::text,
        tokenexpiry = $2::timestamptz,
        status = 'active',
        updatedat = NOW()
      WHERE id = $3::text
    `, encryptSecret(credentials.access_token), expiry, connection.id);
  }
  
  return credentials.access_token;
}

// Helper : rafraîchir le token Amazon LWA
async function refreshAmazonToken(connection) {
  if (!connection.refreshtoken) {
    throw new Error('Pas de refresh token — reconnectez Amazon');
  }
  if (!AMAZON_LWA_CLIENT_ID || !AMAZON_LWA_CLIENT_SECRET) {
    throw new Error('Amazon LWA non configuré');
  }
  const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptSecret(connection.refreshtoken),
      client_id: AMAZON_LWA_CLIENT_ID,
      client_secret: AMAZON_LWA_CLIENT_SECRET
    }).toString()
  });
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text().catch(() => '');
    console.error('Amazon refresh token HTTP error:', tokenRes.status, errBody.substring(0, 500));
    // refresh_token révoqué/invalide (400 invalid_grant) → reconnexion requise.
    throw new Error('Token Amazon expiré ou révoqué — reconnectez Seller Central');
  }
  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    throw new Error(tokens.error_description || 'Erreur refresh token Amazon');
  }
  const expiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
  if (prismaReady && prisma) {
    await prisma.$executeRawUnsafe(`
      UPDATE "PlatformConnection" SET accesstoken = $1::text, tokenexpiry = $2::timestamptz, status = 'active', updatedat = NOW()
      WHERE id = $3::text
    `, encryptSecret(tokens.access_token), expiry, connection.id);
  }
  return tokens.access_token;
}

function createPushError(message, statusCode = 400, extras = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extras);
  return error;
}

function getOverrideKeyForPlatform(platformKey) {
  const normalizedPlatform = normalizePlatformKey(platformKey);
  if (normalizedPlatform === 'gmc') return 'google';
  if (normalizedPlatform === 'amazon') return 'amazon';
  return normalizedPlatform;
}

function getPlatformKeyFromOverrideKey(overrideKey) {
  const normalizedKey = String(overrideKey || '').trim().toLowerCase();
  if (normalizedKey === 'google') return 'gmc';
  return normalizePlatformKey(normalizedKey);
}

function getLegacyOverrideValue(customFields, platformKey) {
  const overrideKey = getOverrideKeyForPlatform(platformKey);
  const overrides = parseJsonObject(customFields?._channelOverrides);
  return overrides[overrideKey];
}

function isDestinationEffectivelyEnabled(destination, activationRow, customFields) {
  if (activationRow) {
    if (activationRow.isenabled === false) return false;
    if (String(activationRow.activationstatus || '').toLowerCase() === 'excluded') return false;
    return true;
  }
  return getLegacyOverrideValue(customFields, destination.platformKey) !== false;
}

async function loadProductActivationsByDestinationIds(productId, destinationIds = []) {
  if (!destinationIds.length) return [];
  return prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM "ProductActivation"
      WHERE productid = $1::text
        AND destinationid = ANY($2::text[])
    `,
    productId,
    destinationIds
  );
}

async function fetchItemCustomFields(itemId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT customfields FROM "FeedItem" WHERE id = $1::text LIMIT 1`,
    itemId
  );
  return parseProductCustomFields(rows?.[0]?.customfields);
}

async function syncLegacyChannelOverrideForPlatform(accountId, itemId, platformKey, currentCustomFields = null) {
  const normalizedPlatformKey = normalizePlatformKey(platformKey);
  const overrideKey = getOverrideKeyForPlatform(normalizedPlatformKey);
  const customFields = currentCustomFields || await fetchItemCustomFields(itemId);
  const destinationRows = await prisma.$queryRawUnsafe(
    `
      SELECT id, platformkey
      FROM "Destination"
      WHERE accountid = $1::text
        AND platformkey = $2::text
    `,
    accountId,
    normalizedPlatformKey
  );
  if (!destinationRows?.length) {
    return customFields;
  }

  const destinationIds = destinationRows.map((row) => row.id);
  const activationRows = await loadProductActivationsByDestinationIds(itemId, destinationIds);
  const activationByDestinationId = new Map(activationRows.map((row) => [row.destinationid, row]));
  const hasAnyEnabled = destinationRows.some((destination) =>
    isDestinationEffectivelyEnabled(
      { platformKey: destination.platformkey },
      activationByDestinationId.get(destination.id),
      customFields
    )
  );

  const nextCustomFields = {
    ...customFields,
    _channelOverrides: {
      ...parseJsonObject(customFields._channelOverrides),
      [overrideKey]: hasAnyEnabled,
    },
  };

  await prisma.$executeRawUnsafe(
    `UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`,
    JSON.stringify(nextCustomFields),
    itemId
  );

  return nextCustomFields;
}

async function syncDestinationActivationsForPlatformOverride(accountId, itemId, platformKey, isEnabled) {
  const normalizedPlatformKey = normalizePlatformKey(platformKey);
  if (!normalizedPlatformKey) return;
  const destinationRows = await prisma.$queryRawUnsafe(
    `
      SELECT id
      FROM "Destination"
      WHERE accountid = $1::text
        AND platformkey = $2::text
    `,
    accountId,
    normalizedPlatformKey
  );
  for (const destination of destinationRows || []) {
    const activationStatus = isEnabled ? 'active' : 'excluded';
    const excludedReason = isEnabled ? null : 'disabled_from_platform_toggle';
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
      destination.id,
      isEnabled,
      activationStatus,
      excludedReason
    );
  }
}

async function buildItemDestinationActivations(accountId, itemId) {
  await ensureMarketsBackfillForAccount(accountId);
  const [markets, customFields] = await Promise.all([
    getHydratedMarketsForAccount(accountId),
    fetchItemCustomFields(itemId),
  ]);

  const destinations = markets.flatMap((market) => {
    const localesById = new Map((market.locales || []).map((locale) => [locale.id, locale]));
    return (market.channels || []).flatMap((channel) =>
      (channel.destinations || []).map((destination) => ({
        id: destination.id,
        slug: destination.slug,
        status: destination.status,
        platformKey: destination.platformKey,
        platformLabel: getPlatformLabel(destination.platformKey),
        marketId: market.id,
        marketCode: market.code,
        marketName: market.name,
        localeCode: destination.marketLocaleId ? localesById.get(destination.marketLocaleId)?.localeCode || null : null,
        languageCode: destination.marketLocaleId ? localesById.get(destination.marketLocaleId)?.languageCode || null : null,
        countryCode: destination.marketLocaleId ? localesById.get(destination.marketLocaleId)?.countryCode || market.code : market.code,
        currencyCode: destination.currencyCode,
        externalScopeLabel: destination.externalScopeLabel || null,
      }))
    );
  });

  const activationRows = await loadProductActivationsByDestinationIds(itemId, destinations.map((destination) => destination.id));
  const activationByDestinationId = new Map(activationRows.map((row) => [row.destinationid, row]));
  const items = destinations.map((destination) => {
    const activationRow = activationByDestinationId.get(destination.id);
    const isEnabled = isDestinationEffectivelyEnabled(destination, activationRow, customFields);
    return {
      destinationId: destination.id,
      destinationSlug: destination.slug,
      status: destination.status,
      platformKey: destination.platformKey,
      platformLabel: destination.platformLabel,
      marketId: destination.marketId,
      marketCode: destination.marketCode,
      marketName: destination.marketName,
      localeCode: destination.localeCode,
      languageCode: destination.languageCode,
      countryCode: destination.countryCode,
      currencyCode: destination.currencyCode,
      externalScopeLabel: destination.externalScopeLabel,
      isEnabled,
      activationSource: activationRow ? 'destination' : 'legacy',
      activationStatus: activationRow?.activationstatus || (isEnabled ? 'active' : 'excluded'),
      excludedReason: activationRow?.excludedreason || null,
    };
  });

  return {
    itemId,
    channelOverrides: parseJsonObject(customFields._channelOverrides),
    summary: {
      totalDestinations: items.length,
      activeDestinations: items.filter((entry) => entry.isEnabled).length,
      marketCount: new Set(items.map((entry) => entry.marketId)).size,
    },
    destinations: items,
  };
}

async function filterItemsForDestinationActivation(items, destinationContext) {
  if (!destinationContext || !items?.length) return items;
  const productActivations = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM "ProductActivation"
      WHERE destinationid = $1::text
        AND productid = ANY($2::text[])
    `,
    destinationContext.id,
    items.map((item) => item.id)
  );
  const activationByItemId = new Map(productActivations.map((row) => [row.productid, row]));
  return items.filter((item) => {
    const cf = item.customfields && typeof item.customfields === 'object'
      ? item.customfields
      : parseProductCustomFields(item.customfields);
    return isDestinationEffectivelyEnabled(
      destinationContext,
      activationByItemId.get(item.id),
      cf
    );
  });
}

async function getDestinationPushContext(accountId, destinationId, expectedPlatform = null) {
  if (!destinationId) return null;
  if (!prismaReady || !prisma) {
    throw createPushError('Service non disponible', 503);
  }

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        d.*,
        m.code AS marketcode,
        m.name AS marketname,
        mc.settingsjson,
        mc.isenabled AS channelenabled,
        ml.localecode,
        ml.languagecode,
        ml.countrycode,
        pa.externalaccountname,
        pa.externalaccountid
      FROM "Destination" d
      JOIN "Market" m ON m.id = d.marketid
      JOIN "MarketChannel" mc ON mc.id = d.marketchannelid
      LEFT JOIN "MarketLocale" ml ON ml.id = d.marketlocaleid
      LEFT JOIN "PlatformAccount" pa ON pa.id = d.platformaccountid
      WHERE d.id = $1::text
        AND d.accountid = $2::text
      LIMIT 1
    `,
    destinationId,
    accountId
  );

  const row = rows?.[0];
  if (!row) {
    throw createPushError('Destination introuvable pour ce compte.', 404);
  }

  const platformKey = normalizePlatformKey(row.platformkey);
  if (expectedPlatform && platformKey !== normalizePlatformKey(expectedPlatform)) {
    throw createPushError(`La destination ${destinationId} ne correspond pas à la plateforme ${expectedPlatform}.`, 400);
  }
  if (row.channelenabled === false) {
    throw createPushError('Cette destination est désactivée. Réactivez le canal du marché avant de pousser.', 409);
  }

  return {
    id: row.id,
    slug: row.slug,
    status: row.status || 'draft',
    platformKey,
    marketCode: normalizeMarketCode(row.marketcode),
    marketName: row.marketname || getMarketName(row.marketcode),
    localeCode: row.localecode || null,
    languageCode: row.languagecode || null,
    countryCode: normalizeMarketCode(row.countrycode || row.marketcode),
    currencyCode: row.currencycode || getMarketCurrency(row.marketcode),
    externalScopeType: row.externalscopetype || null,
    externalScopeId: row.externalscopeid || null,
    externalScopeLabel: row.externalscopelabel || null,
    settings: parseJsonObject(row.settingsjson),
    config: parseJsonObject(row.configjson),
    platformAccountId: row.platformaccountid || null,
    platformAccountName: row.externalaccountname || null,
    platformAccountExternalId: row.externalaccountid || null,
  };
}

function buildDestinationPushLabel(destinationContext) {
  if (!destinationContext) return '';
  const baseLabel = destinationContext.externalScopeLabel
    || getPlatformLabel(destinationContext.platformKey)
    || destinationContext.platformKey;
  const localeLabel = destinationContext.localeCode ? ` (${destinationContext.localeCode})` : '';
  if (destinationContext.platformKey === 'amazon') {
    return `${baseLabel}${localeLabel}`;
  }
  return `${baseLabel} ${destinationContext.marketName || destinationContext.marketCode}${localeLabel}`.trim();
}

async function getActivePlatformConnectionForPush(accountId, platformKey) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM "PlatformConnection"
      WHERE accountid = $1::text
        AND platform = $2::text
        AND status = 'active'
      ORDER BY updatedat DESC NULLS LAST, createdat DESC
      LIMIT 1
    `,
    accountId,
    normalizePlatformKey(platformKey)
  );
  return rows?.[0] ? decryptPlatformConnection(rows[0]) : null;
}

// Bloc 3 : domaine Amazon push extrait dans domains/amazon/push.js (factory DI).
// Wrapper de signature inchangee deleguant a l'instance amazonPush (affectee au
// boot, avant createJobHandlers / hooks post-ingestion qui appellent executeAmazonPush).
// Tous les appelants (routes, hooks post-sync) gardent la meme signature.
async function executeAmazonPush({ accountId, feedId, destinationContext = null, channelKey = null }) {
  return amazonPush.executeAmazonPush({ accountId, feedId, destinationContext, channelKey });
}

// Bloc 2 : domaine GMC push extrait dans domains/gmc/push.js (factory DI).
// Wrapper de signature inchangee deleguant a l'instance gmcPush (affectee au boot,
// avant createJobHandlers qui recoit executeGmcPush par injection). Tous les
// appelants (routes, runAutoGmcPush bloc 1, ingestions) gardent la meme signature.
async function executeGmcPush({ accountId, userId, feedId, destinationContext = null }) {
  return gmcPush.executeGmcPush({ accountId, userId, feedId, destinationContext });
}

// ===== Push GMC automatique (fire-and-forget) =====
// Déclenché à la connexion GMC et après chaque ingestion réussie, pour que le
// Merchant Center reste synchronisé sans action manuelle. Best-effort : no-op
// si GMC n'est pas connecté, erreurs en log + ExportLog (via executeGmcPush),
// jamais remontées à l'appelant. Débouncé par feed pour absorber les rafales
// de webhooks produits.
const autoGmcPushTimers = new Map();
const AUTO_GMC_PUSH_DEBOUNCE_MS = Number(process.env.AUTO_GMC_PUSH_DEBOUNCE_MS || 30_000);

async function resolveDefaultFeedIdForAccount(accountId) {
  if (!accountId || !prismaReady || !prisma) return null;
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT f.id
      FROM "Feed" f
      WHERE f.accountid = $1::text
      ORDER BY (SELECT COUNT(*) FROM "FeedItem" fi WHERE fi.feedid = f.id) DESC, f.createdat ASC
      LIMIT 1
    `,
    accountId
  );
  return rows?.[0]?.id || null;
}

// Sprint 2 : signature publique inchangée (≈10 appelants). Délègue à enqueueJob
// (Cloud Tasks en prod → dédup distribuée par nom de tâche ; fallback setTimeout
// en dev). La `Map` autoGmcPushTimers reste utilisée par le fallback in-process
// de lib/jobs.js (clé identique), donc le debounce par feed est préservé.
// Bloc 1 extrait dans domains/jobs/handlers.js ; wrappers de signatures inchangées.
function scheduleAutoGmcPush(accountId, feedId, reason, delayMs = AUTO_GMC_PUSH_DEBOUNCE_MS) {
  return jobHandlers.scheduleAutoGmcPush(accountId, feedId, reason, delayMs);
}
async function runAutoGmcPush(payload) {
  return jobHandlers.runAutoGmcPush(payload);
}

// Auto-optim IA après ingestion : sans ce hook, les FeedItems sont pushés
// sur GMC/Amazon/Meta avec leurs titres et descriptions Shopify bruts.
// Aucune valeur ajoutée vs un feed direct. Ce scheduler tourne en background
// (debounce 15s pour absorber les bursts de webhooks) et appelle
// optimizeTitleWithAI + optimizeDescriptionWithAI sur les items sans
// customfields.optimized.gmc. Une fois l'optim faite, déclenche
// automatiquement scheduleAutoGmcPush pour propager les contenus optimisés.
const autoOptimizationTimers = new Map();
const AUTO_OPTIM_DEBOUNCE_MS = Number(process.env.AUTO_OPTIM_DEBOUNCE_MS || 15_000);
const AUTO_OPTIM_BATCH_SIZE = Number(process.env.AUTO_OPTIM_BATCH_SIZE || 50);

// ===== Instanciation de la factory du domaine GMC push (bloc 2) =====
// Doit precéder createJobHandlers (qui recoit executeGmcPush par injection).
// `prisma` injecte via getter (late-binding boot). `getOptimizedContentForPlatform`
// vient de utils/platform-content (deja requis plus haut). `translateItemsForDestination`
// (traduction marche Sprint 1) injecte via require local pour rester best-effort.
gmcPush = createGmcPush({
  getPrisma: () => prisma,
  fetch: (...args) => fetch(...args),
  crypto,
  getActivePlatformConnectionForPush,
  refreshGMCToken,
  filterItemsForDestinationActivation,
  getOptimizedContentForPlatform,
  translateItemsForDestination: require('./optimization/market-translation').translateItemsForDestination,
  findUserById,
  sendExportCompleteEmail,
  buildDestinationPushLabel,
  createPushError,
});

// ===== Instanciation de la factory du domaine Amazon push (bloc 3) =====
// Doit precéder createJobHandlers / les hooks post-ingestion (qui appellent
// executeAmazonPush via le wrapper). `prisma` injecté via getter (late-binding
// boot). `inferAmazonChannelKeyForMarket` vient de lib/markets (requis plus haut),
// `refreshAmazonToken` reste closure-scoped. `translateItemsForDestination`
// (traduction marché Sprint 1) injecté pour rester best-effort.
amazonPush = createAmazonPush({
  getPrisma: () => prisma,
  fetch: (...args) => fetch(...args),
  crypto,
  AMAZON_SP_API_BASE,
  getActivePlatformConnectionForPush,
  refreshAmazonToken,
  filterItemsForDestinationActivation,
  inferAmazonChannelKeyForMarket,
  translateItemsForDestination: require('./optimization/market-translation').translateItemsForDestination,
  buildDestinationPushLabel,
  createPushError,
});

// ===== Instanciation de la factory de handlers de jobs (bloc 1) =====
// À ce point, toutes les constantes (AUTO_*_DEBOUNCE_MS, AUTO_OPTIM_BATCH_SIZE)
// et les fonctions injectées (hoistées) sont disponibles. `prisma` est injecté
// via un getter pour préserver le late-binding (réassigné pendant le boot).
jobHandlers = createJobHandlers({
  getPrisma: () => prisma,
  enqueueBackgroundJob,
  JOB_TYPES,
  AUTO_GMC_PUSH_DEBOUNCE_MS,
  AUTO_OPTIM_DEBOUNCE_MS,
  AUTO_OPTIM_BATCH_SIZE,
  executeGmcPush,
  executeLiaShopifySync,
  getActivePlatformConnectionForPush,
  resolveDefaultFeedIdForAccount,
  getAccountAddonIA,
  checkAiQuota,
  optimizeTitleWithAI,
  optimizeDescriptionWithAI,
  trackAiUsage,
  runIngestionJob,
  // Sync auto des performances régies (reporting pré-launch).
  syncGoogleAdsPerformance,
  syncMetaAdsPerformance,
  syncAmazonAdsPerformance,
  decryptSecret,
  decryptPlatformConnection,
  perfAdsConfig: {
    googleAdsClientId: GOOGLE_ADS_CLIENT_ID,
    googleAdsClientSecret: GOOGLE_ADS_CLIENT_SECRET,
  },
});

// Bloc 1 extrait dans domains/jobs/handlers.js ; wrappers de signatures inchangées.
function scheduleAutoOptimization(accountId, feedId, reason, delayMs = AUTO_OPTIM_DEBOUNCE_MS) {
  return jobHandlers.scheduleAutoOptimization(accountId, feedId, reason, delayMs);
}

// Wrappers de schedulers de sync perf régies (délèguent à jobHandlers, invoqués
// au runtime post-boot). Utilisés par les callbacks OAuth régies et le scheduler.
function scheduleSyncGoogleAdsPerformance(accountId, reason) {
  return jobHandlers.scheduleSyncGoogleAdsPerformance(accountId, reason);
}
function scheduleSyncMetaAdsPerformance(accountId, reason) {
  return jobHandlers.scheduleSyncMetaAdsPerformance(accountId, reason);
}
function scheduleSyncAmazonAdsPerformance(accountId, reason) {
  return jobHandlers.scheduleSyncAmazonAdsPerformance(accountId, reason);
}

// Handler idempotent de l'auto-optimisation IA (bloc 1 extrait dans
// domains/jobs/handlers.js). Wrapper de signature inchangée délégant à jobHandlers.
async function runAutoOptimization(payload) {
  return jobHandlers.runAutoOptimization(payload);
}






// ====== DASHBOARD ======

// La route /api/v1/dashboard/overview est extraite dans routes/dashboard.js (pattern routes/ingestion.js) ;
// enregistrée plus bas via registerDashboardRoutes. Route isolée -> ordre de matching préservé.


// ====== SHOPIFY OAUTH CONNECTORS ======
// APP_URL déjà déclaré plus haut dans run()

// Les states OAuth Shopify sont stockés en base pour survivre aux redémarrages et au multi-instance.

// ====== CONNECTEURS SHOPIFY (6 routes extraites dans routes/connectors.js, pattern routes/ingestion.js) ======
// session-token/probe + connectors/shopify/{install,connect,callback,claim,verify}. Enregistrées plus bas
// via registerConnectorsRoutes(app, {...}). Entrelacées d'origine avec /api/v1/marketing/audits/.../connectors/*
// (préfixes distincts, aucun chevauchement) -> ordre de matching préservé. Helpers findShopify* restent inline.

// (marketing-audits) /api/v1/marketing/audits/:shareToken/connectors/{shopify,prestashop,file}/connect -> routes/marketing-audits.js

// Callback OAuth: échange code -> access_token, stockage en base
// (connectors) /api/v1/connectors/shopify/callback -> routes/connectors.js

// Lier une credential Shopify "en attente" (install via lien Partners) au compte courant
// (connectors) /api/v1/connectors/shopify/claim -> routes/connectors.js

// ============================================================
// Shopify Billing API (AppSubscription) — pour merchants installés via App Store
// ============================================================

/**
 * Récupère le credential Shopify lié à un account (le plus récent).
 * Retourne { credentialId, shop, accessToken } ou null si absent.
 */
async function findShopifyCredentialForAccount(accountId) {
  if (!accountId || !prismaReady || !prisma) return null;
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT c.id, c.secretjson
      FROM "Credential" c
      JOIN "FeedSource" s ON s.credentialid = c.id
      WHERE s.accountid = $1::text
        AND c.connector = 'SHOPIFY'::text
      ORDER BY c.createdat DESC
      LIMIT 1
    `,
    accountId
  );
  if (!rows || rows.length === 0) return null;
  const secret = rows[0].secretjson;
  const data = decryptObjectSecrets(typeof secret === 'string' ? JSON.parse(secret) : secret);
  const accessToken = data.accessToken || data.access_token;
  const shop = normalizeShopifyShop(data.shop || '');
  if (!accessToken || !shop) return null;
  return { credentialId: rows[0].id, shop, accessToken };
}

// POST /subscribe — Managed Pricing : retourne l'URL Shopify Admin où le
// merchant va choisir/approuver son plan. Plus de call appSubscriptionCreate :
// les apps Managed Pricing ne peuvent pas créer de charges via l'API.
// Après approbation, Shopify envoie le webhook app_subscriptions/update.
// ====== BILLING SHOPIFY (4 routes /api/v1/billing/shopify/* extraites dans routes/shopify-billing.js) ======
// Enregistrées plus bas via registerShopifyBillingRoutes(app, {...}). Bloc contigu,
// aucun chevauchement -> ordre de matching préservé.

// ============================================================
// Embedded Shopify — Sources (vue catalogue dans l'iframe Shopify Admin)
// ============================================================

/**
 * Retourne le feed Shopify principal d'un account (le plus récemment créé).
 * Convention FeedPlug : un install Shopify crée 1 Credential + 1 Source + 1 Feed.
 */
async function findShopifyFeedForAccount(accountId) {
  if (!accountId || !prismaReady || !prisma) return null;
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT f.id AS feed_id, f.name AS feed_name, f.status AS feed_status,
             s.id AS source_id, s.name AS source_name, s.status AS source_status,
             s.lastrunat AS last_run_at, s.createdat AS connected_at,
             c.secretjson AS secretjson, c.id AS credential_id
      FROM "Feed" f
      JOIN "FeedSource" s ON s.id = f.sourceid
      JOIN "Credential" c ON c.id = s.credentialid
      WHERE f.accountid = $1::text
        AND s.connector = 'SHOPIFY'::text
      ORDER BY f.createdat DESC
      LIMIT 1
    `,
    accountId
  );
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  let shop = '';
  try {
    const secret = decryptObjectSecrets(
      typeof row.secretjson === 'string' ? JSON.parse(row.secretjson) : row.secretjson
    );
    shop = normalizeShopifyShop(secret.shop || '');
  } catch {
    shop = '';
  }
  return {
    feedId: row.feed_id,
    feedName: row.feed_name,
    feedStatus: row.feed_status,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceStatus: row.source_status,
    lastRunAt: row.last_run_at,
    connectedAt: row.connected_at,
    credentialId: row.credential_id,
    shop,
  };
}

// GET /overview — état du catalogue Shopify pour l'embedded admin
// ====== EMBEDDED (4 routes /api/v1/embedded/* extraites dans routes/embedded.js, pattern routes/ingestion.js) ======
// Enregistrées plus bas via registerEmbeddedRoutes(app, {...}) (helpers injectés définis/hoistés plus bas).
// Bloc contigu, aucun chevauchement de chemin -> ordre de matching préservé.

// Vérification d'accès Shopify (ping Admin API)
// (connectors) /api/v1/connectors/shopify/verify -> routes/connectors.js

// ====== PROCESS LIFECYCLE ======

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  if (prisma && prismaReady) {
    await prisma.$disconnect();
  }
  process.exit(0);
});

// Résilience prod : capturer les rejets et exceptions non gérés → Sentry + log, puis exit sur uncaught
process.on('unhandledRejection', (reason, promise) => {
  console.error('unhandledRejection:', reason);
  try { require('@sentry/node').captureException(reason instanceof Error ? reason : new Error(String(reason))); } catch (_) {}
});

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  try { require('@sentry/node').captureException(err); } catch (_) {}
  setTimeout(() => process.exit(1), 1000);
});

// Gestionnaire d'erreurs global : poser CORS sur toute réponse d'erreur (évite "Failed to fetch" côté front).
app.use((err, req, res, next) => {
  const origin = (req.headers && req.headers.origin) ? (req.headers.origin || '').trim() : '';
  corsLib.setCorsHeaders(res, origin);
  next(err);
});
// Sentry : capture des erreurs Express (après toutes les routes)
const Sentry = require('@sentry/node');
Sentry.setupExpressErrorHandler(app);

// Gestionnaire d'erreurs terminal : réponse JSON normalisée, sans stack trace.
// Évite que le handler par défaut d'Express ne renvoie err.stack hors production.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  const rawStatus = Number.isInteger(err?.status)
    ? err.status
    : (Number.isInteger(err?.statusCode) ? err.statusCode : 500);
  const status = rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  const body = { message: 'Erreur interne du serveur' };
  // Pour les erreurs client (4xx) explicitement exposables (ex. body-parser),
  // on conserve le message ; jamais pour les 5xx.
  if (status < 500 && err?.expose === true && typeof err?.message === 'string' && err.message) {
    body.message = err.message;
  }
  res.status(status).json(body);
});

console.log(`🚀 Backend attaché (port ${port})`);
console.log(`🌍 CORS configuré pour: ${allowedOrigins.join(', ')}`);
console.log('📊 Stockage marketing persisté en base (fallback mémoire désactivé)');

// Contrôle de configuration : alerter si des secrets webhook manquent. Sans eux,
// les routes correspondantes ne sont pas enregistrées et l'app démarre "saine"
// alors que la facturation / les webhooks Shopify ne se synchronisent plus.
{
  const missingWebhookSecrets = [];
  if (!process.env.STRIPE_SECRET_KEY) missingWebhookSecrets.push('STRIPE_SECRET_KEY');
  if (!process.env.STRIPE_WEBHOOK_SECRET) missingWebhookSecrets.push('STRIPE_WEBHOOK_SECRET');
  if (!SHOPIFY_API_SECRET) missingWebhookSecrets.push('SHOPIFY_API_SECRET');
  if (missingWebhookSecrets.length > 0) {
    const detail = missingWebhookSecrets.join(', ');
    if (process.env.NODE_ENV === 'production') {
      console.error(`⛔ CONFIG WEBHOOK INCOMPLÈTE en production: ${detail} manquant(s). Les webhooks associés ne sont PAS enregistrés (facturation Stripe / conformité Shopify non synchronisées).`);
    } else {
      console.warn(`⚠️  Secrets webhook manquants: ${detail}. Webhooks associés désactivés (attendu hors production).`);
    }
  } else {
    console.log('✅ Secrets webhook (Stripe + Shopify) présents.');
  }

  // App connecteur Shopify : signaler une config asymétrique (une seule des deux
  // clés posée). buildShopifyApps exige les DEUX pour activer l'app → sinon elle
  // est silencieusement désactivée. On loggue l'état pour éviter un connecteur
  // qui semble "configuré" mais dont la route webhook n'est jamais montée.
  const hasConnKey = !!process.env.SHOPIFY_CONNECTOR_API_KEY;
  const hasConnSecret = !!process.env.SHOPIFY_CONNECTOR_API_SECRET;
  if (hasConnKey !== hasConnSecret) {
    const present = hasConnKey ? 'SHOPIFY_CONNECTOR_API_KEY' : 'SHOPIFY_CONNECTOR_API_SECRET';
    const missing = hasConnKey ? 'SHOPIFY_CONNECTOR_API_SECRET' : 'SHOPIFY_CONNECTOR_API_KEY';
    console.warn(`⚠️  App connecteur Shopify DÉSACTIVÉE : ${present} est posé mais ${missing} manque. /connect et l'audit-connect renverront 503, le webhook /connector n'est pas monté.`);
  } else if (hasConnKey && hasConnSecret) {
    console.log('✅ App connecteur Shopify activée (webhook /api/v1/webhooks/shopify/connector monté).');
  }
}

} // fin run()

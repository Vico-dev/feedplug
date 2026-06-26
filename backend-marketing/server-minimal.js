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
const { getPerformanceHistory, purgePerformanceHistory, CHANNELS } = require('./performance/write-perf');
const { syncGoogleAdsPerformance } = require('./performance/sync-google-ads');
const { syncMetaAdsPerformance } = require('./performance/sync-meta-ads');
const { syncAmazonAdsPerformance } = require('./performance/sync-amazon-ads');
const { createSharedAbuseProtection } = require('./lib/shared-abuse-store');
const { assertColumnsExist, assertTableExists } = require('./lib/schema-guards');
const { recordAiUsage, getAiUsage, AI_SOFT_CAP_MONTHLY } = require('./lib/ai-quota');
const { checkAiQuota, quotaMessage } = require('./lib/ai-caps');
const { createNotification } = require('./lib/notifications');
const { enqueueJob: enqueueBackgroundJob, configureJobs } = require('./lib/jobs');

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
};

// Routeur de jobs : appelé par le worker HTTP (/internal/jobs/run) ET par le
// fallback in-process de lib/jobs.js. Les handlers `runAutoX` / `runIngestionJob`
// sont des `async function` hoistées définies plus bas dans run().
async function dispatchJob(type, payload) {
  payload = payload || {};
  switch (type) {
    case JOB_TYPES.AUTO_GMC_PUSH:
      return runAutoGmcPush(payload);
    case JOB_TYPES.AUTO_OPTIMIZATION:
      return runAutoOptimization(payload);
    case JOB_TYPES.AUTO_LIA_SYNC:
      return runAutoLiaSync(payload);
    case JOB_TYPES.INGESTION_RUN:
      return runIngestionJob(payload);
    default:
      throw new Error('[jobs] type de job inconnu: ' + type);
  }
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

function verifyShopifySessionToken(token) {
  if (!token || !SHOPIFY_API_SECRET || !SHOPIFY_API_KEY) {
    throw new Error('Shopify session token verification unavailable');
  }

  const payload = jwt.verify(token, SHOPIFY_API_SECRET, {
    algorithms: ['HS256'],
    audience: SHOPIFY_API_KEY,
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

async function handleShopifyAppUninstalled(shopDomain) {
  if (!prismaReady || !prisma) return;
  const result = await shopifyHandleAppUninstalled({ prisma, shopDomain });
  if (!result.ok && result.error) {
    console.warn('Shopify uninstall cleanup skipped:', result.error);
  }
}

async function listShopifyFeedsForShop(shopDomain) {
  if (!shopDomain || !prismaReady || !prisma) {
    return [];
  }

  return prisma.$queryRawUnsafe(
    `
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
        AND c.secretjson->>'shop' = $1::text
      ORDER BY f.createdat DESC
    `,
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

async function triggerShopifyCatalogWebhookSync({ topic, shopDomain, payload }) {
  if (!shopDomain || !prismaReady || !prisma) {
    return;
  }

  const feeds = await listShopifyFeedsForShop(shopDomain);
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

// Shopify webhooks AVANT express.json() (nécessite le body raw pour la signature HMAC)
app.post(SHOPIFY_WEBHOOK_PATH, express.raw({ type: '*/*', limit: '2mb' }), async (req, res) => {
  const hmacHeader = req.get('x-shopify-hmac-sha256');
  if (!verifyShopifyWebhookHmac(req.body, hmacHeader, SHOPIFY_API_SECRET)) {
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
      await handleShopifyAppUninstalled(shopDomain);
    } else if (SHOPIFY_INCREMENTAL_WEBHOOK_TOPICS.has(topic) || SHOPIFY_FULL_SYNC_WEBHOOK_TOPICS.has(topic)) {
      if (shopDomain) {
        setImmediate(() => {
          triggerShopifyCatalogWebhookSync({ topic, shopDomain, payload }).catch((error) => {
            console.error(`Shopify webhook async sync failed (${topic} / ${shopDomain}):`, error);
          });
        });
      }
    } else if (topic === 'app_subscriptions/update') {
      // Sync l'état de l'abonnement Shopify (ACTIVE/CANCELLED/EXPIRED/FROZEN/DECLINED)
      // déclenché à chaque transition côté Shopify.
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
});

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

  // 2) Shopify session token
  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
    return res.status(403).json({ message: 'Token invalide' });
  }
  let shopifyAuth;
  try {
    shopifyAuth = verifyShopifySessionToken(token);
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
app.post('/api/v1/ingestion/sources', async (req, res) => {
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

// Lister les sources
app.get('/api/v1/ingestion/sources', async (req, res) => {
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

// Mettre à jour une source
app.put('/api/v1/ingestion/sources/:id', async (req, res) => {
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

// Supprimer une source
app.delete('/api/v1/ingestion/sources/:id', async (req, res) => {
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

// Créer un feed rattaché à une source
app.post('/api/v1/ingestion/feeds', async (req, res) => {
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

// Lister les feeds
app.get('/api/v1/ingestion/feeds', async (req, res) => {
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

app.get('/api/v1/ingestion/fields', async (req, res) => {
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

// Mettre à jour un feed
app.put('/api/v1/ingestion/feeds/:id', async (req, res) => {
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

// Endpoint pour créer automatiquement des flux pour les sources existantes sans flux
app.post('/api/v1/ingestion/create-missing-feeds', async (req, res) => {
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

// Trigger d'une exécution (IngestionRun)
app.post('/api/v1/ingestion/feeds/:id/runs', async (req, res) => {
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

// Sprint 2 (B-PROPER) — polling du statut d'ingestion (background mode). Le
// frontend appelle cet endpoint après un 202 pour suivre PENDING→RUNNING→
// SUCCESS/FAILED. Filtré par compte (sécurité multi-tenant via verifyFeedAccess).
app.get('/api/v1/ingestion/feeds/:id/runs', async (req, res) => {
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

// Endpoint pour forcer la mise à jour des customFields pour tous les produits d'un feed
app.post('/api/v1/ingestion/feeds/:id/force-update-customfields', async (req, res) => {
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

// ====== SOURCES SECONDAIRES D'ENRICHISSEMENT ======

// Lister les sources secondaires d'un flux
app.get('/api/v1/ingestion/feeds/:id/enrichment-sources', async (req, res) => {
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

// Créer une source secondaire
app.post('/api/v1/ingestion/feeds/:id/enrichment-sources', async (req, res) => {
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

// Appliquer manuellement les sources secondaires
app.post('/api/v1/ingestion/feeds/:id/apply-enrichment-sources', async (req, res) => {
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
app.put('/api/v1/ingestion/enrichment-sources/:id', async (req, res) => {
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

// Supprimer une source secondaire
app.delete('/api/v1/ingestion/enrichment-sources/:id', async (req, res) => {
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

// Endpoint pour exécuter automatiquement les feeds selon leur horaire programmé
// Cet endpoint est appelé par Cloud Scheduler toutes les heures
// ===== Centre de notifications in-app =====
app.use('/api/v1/notifications', requireAuth);

app.get('/api/v1/notifications', async (req, res) => {
  // Dégradation douce : si la table n'existe pas encore (migration 036 non
  // appliquée) ou erreur DB, on renvoie une liste vide plutôt qu'un 500.
  try {
    if (!prismaReady || !prisma) return res.json({ notifications: [], unreadCount: 0 });
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, type, priority, title, message, actionurl, read, createdat
       FROM notification WHERE accountid = $1::text
       ORDER BY createdat DESC LIMIT 50`,
      req.accountId
    );
    const unread = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM notification WHERE accountid = $1::text AND read = false`,
      req.accountId
    );
    res.json({
      notifications: (rows || []).map((n) => ({
        id: n.id,
        type: n.type,
        priority: n.priority,
        title: n.title,
        message: n.message,
        actionUrl: n.actionurl || null,
        read: n.read === true,
        timestamp: n.createdat,
      })),
      unreadCount: unread?.[0]?.c ?? 0,
    });
  } catch (e) {
    console.warn('GET notifications error (table absente?):', e?.message);
    res.json({ notifications: [], unreadCount: 0 });
  }
});

app.post('/api/v1/notifications/:id/read', async (req, res) => {
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    await prisma.$executeRawUnsafe(
      `UPDATE notification SET read = true WHERE id = $1::text AND accountid = $2::text`,
      req.params.id, req.accountId
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Mark notification read error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

app.post('/api/v1/notifications/read-all', async (req, res) => {
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    await prisma.$executeRawUnsafe(
      `UPDATE notification SET read = true WHERE accountid = $1::text AND read = false`,
      req.accountId
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Mark all notifications read error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

app.delete('/api/v1/notifications/:id', async (req, res) => {
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    await prisma.$executeRawUnsafe(
      `DELETE FROM notification WHERE id = $1::text AND accountid = $2::text`,
      req.params.id, req.accountId
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Delete notification error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

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
    if (providedSecret !== schedulerSecret) {
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

app.post('/api/v1/ingestion/scheduled-runs', async (req, res) => {
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
  const schedulerSecret = typeof process.env.SCHEDULER_SECRET === 'string' ? process.env.SCHEDULER_SECRET.trim() : '';
  // Auth : si un secret est configuré, on l'exige (timing-safe). Si OIDC est la
  // seule auth (pas de secret), on accepte (l'IAM Cloud Run a déjà vérifié le token).
  if (schedulerSecret) {
    const hdr = req.headers['x-scheduler-secret'] || req.headers['authorization'];
    const raw = Array.isArray(hdr) ? hdr[0] : hdr;
    const provided = typeof raw === 'string' ? raw.replace('Bearer ', '').trim() : '';
    const oidcPresent = !!(req.headers['authorization'] && /^Bearer /i.test(String(req.headers['authorization'])) && !req.headers['x-scheduler-secret']);
    if (!oidcPresent && !timingSafeSecretEqual(provided, schedulerSecret)) {
      return res.status(401).json({ message: 'Non autorisé' });
    }
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

// Récupérer les items d'un feed (option: ?q= pour recherche titre/sku/brand)
app.get('/api/v1/ingestion/feeds/:id/items', async (req, res) => {
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

function buildFeedAuditIssues(summary = {}) {
  const total = Math.max(Number(summary.total || 0), 1);
  const issueCandidates = [
    {
      key: 'title',
      label: 'Titres produits',
      missingCount: Number(summary.missing_title || 0),
      impact: 'Les produits perdent en couverture et en pertinence sur les canaux de diffusion.',
      recommendation: 'Retravailler les titres avec structure marque + type + attributs distinctifs.',
    },
    {
      key: 'description',
      label: 'Descriptions',
      missingCount: Number(summary.missing_description || 0),
      impact: 'Le flux manque de contexte semantique pour le matching et la conversion.',
      recommendation: 'Completer les descriptions avec benefices, caracteristiques et usages.',
    },
    {
      key: 'image',
      label: 'Images principales',
      missingCount: Number(summary.missing_image || 0),
      impact: 'Les produits deviennent difficilement diffusables et moins cliques.',
      recommendation: 'Ajouter une image principale exploitable pour chaque SKU actif.',
    },
    {
      key: 'brand',
      label: 'Marque',
      missingCount: Number(summary.missing_brand || 0),
      impact: 'Le ciblage catalogue et les diagnostics Merchant Center perdent en qualite.',
      recommendation: 'Renseigner la marque ou la collection pour tous les produits eligibles.',
    },
    {
      key: 'category',
      label: 'Categorisation',
      missingCount: Number(summary.missing_category || 0),
      impact: 'Le flux se diffuse moins bien et les encheres automatiques sont moins precises.',
      recommendation: 'Ajouter google_product_category, product_type ou une categorie interne fiable.',
    },
    {
      key: 'identifier',
      label: 'Identifiants produits',
      missingCount: Number(summary.missing_identifier || 0),
      impact: 'Les produits ont plus de risque de rejet ou de diffusion limitee.',
      recommendation: 'Completer GTIN, MPN ou SKU normalise selon le catalogue.',
    },
    {
      key: 'link',
      label: 'URLs produit',
      missingCount: Number(summary.missing_link || 0),
      impact: 'La diffusion transactionnelle et le suivi des visites sont degrades.',
      recommendation: 'Corriger les URLs vides, invalides ou non envoyees par la source.',
    },
  ];

  return issueCandidates
    .map((issue) => {
      const affectedProducts = issue.missingCount;
      const affectedRate = Math.round((affectedProducts / total) * 100);
      let severity = 'low';
      if (affectedRate >= 30) severity = 'high';
      else if (affectedRate >= 12) severity = 'medium';
      return {
        key: issue.key,
        label: issue.label,
        severity,
        affectedProducts,
        affectedRate,
        impact: issue.impact,
        recommendation: issue.recommendation,
      };
    })
    .filter((issue) => issue.affectedProducts > 0)
    .sort((a, b) => b.affectedRate - a.affectedRate)
    .slice(0, 5);
}

function calculateFeedAuditSummary(summary = {}, scoredItems = []) {
  const total = Number(summary.total || 0);
  if (total <= 0) {
    return {
      score: 0,
      potentialScore: 0,
      estimatedAdditionalApprovedProducts: 0,
      estimatedVisibilityLiftPct: 0,
      metrics: {
        totalProducts: 0,
        sampleSize: 0,
        averageProductScore: 0,
        coverageRate: 0,
        approvalReadyRate: 0,
      },
      scoreBreakdown: {
        dataCoverage: 0,
        productQuality: 0,
        channelReadiness: 0,
      },
      auditPillars: [],
      scoreBand: {
        label: 'Aucun signal',
        description: 'Impossible d evaluer le flux sans produits exploitables.',
      },
      topIssues: [],
      methodology: {
        scoring: 'Score calcule a partir de la couverture de donnees, d un echantillon de scores produit et de la readiness canal.',
        estimation: 'Le potentiel estime correspond a une hypothese conservative de produits additionnels diffusable apres correction des priorites.',
      },
    };
  }

  const pct = (value) => Math.round((Number(value || 0) / total) * 100);
  const completionRates = {
    title: 100 - pct(summary.missing_title),
    description: 100 - pct(summary.missing_description),
    image: 100 - pct(summary.missing_image),
    brand: 100 - pct(summary.missing_brand),
    category: 100 - pct(summary.missing_category),
    identifier: 100 - pct(summary.missing_identifier),
    price: 100 - pct(summary.missing_price),
    link: 100 - pct(summary.missing_link),
    availability: 100 - pct(summary.missing_availability),
  };

  const dataCoverage = Math.round(
    (completionRates.title * 0.16) +
    (completionRates.description * 0.12) +
    (completionRates.image * 0.16) +
    (completionRates.brand * 0.10) +
    (completionRates.category * 0.10) +
    (completionRates.identifier * 0.12) +
    (completionRates.price * 0.10) +
    (completionRates.link * 0.08) +
    (completionRates.availability * 0.06)
  );

  const scoredAverage = scoredItems.length
    ? Math.round(scoredItems.reduce((sum, item) => sum + Number(item.qualityScore || 0), 0) / scoredItems.length)
    : 0;
  const dimensionAverage = (key) => scoredItems.length
    ? Math.round(scoredItems.reduce((sum, item) => sum + Number(item.dimensions?.[key] || 0), 0) / scoredItems.length)
    : 0;
  const complianceAverage = dimensionAverage('compliance');
  const dataQualityAverage = dimensionAverage('dataQuality');
  const seoAverage = dimensionAverage('seo');
  const conversionAverage = dimensionAverage('conversion');
  const approvalReadyRate = pct(summary.ready_for_channels);
  const channelReadiness = Math.round(
    (approvalReadyRate * 0.7) +
    ((100 - pct(summary.blocking_core)) * 0.3)
  );

  const complianceHealth = Math.round(
    (complianceAverage * 0.55) +
    (completionRates.identifier * 0.2) +
    (completionRates.price * 0.1) +
    (completionRates.availability * 0.05) +
    ((100 - pct(summary.blocking_core)) * 0.1)
  );
  const catalogCompleteness = Math.round(
    (dataCoverage * 0.55) +
    (dataQualityAverage * 0.45)
  );
  const discoverability = Math.round(
    (seoAverage * 0.55) +
    (completionRates.title * 0.2) +
    (completionRates.category * 0.15) +
    (completionRates.image * 0.1)
  );
  const conversionReadiness = Math.round(
    (conversionAverage * 0.55) +
    (completionRates.image * 0.15) +
    (completionRates.description * 0.15) +
    (completionRates.brand * 0.05) +
    (completionRates.link * 0.1)
  );

  const score = Math.max(
    0,
    Math.min(100, Math.round(
      (complianceHealth * 0.3) +
      (catalogCompleteness * 0.3) +
      (discoverability * 0.2) +
      (conversionReadiness * 0.2)
    ))
  );

  const topIssues = buildFeedAuditIssues(summary);
  const improvementCapacity = Math.max(
    0,
    Math.round(
      topIssues.reduce((sum, issue) => {
        const factor = issue.severity === 'high' ? 0.45 : issue.severity === 'medium' ? 0.26 : 0.12;
        return sum + (issue.affectedRate * factor);
      }, 0)
    )
  );
  const weakestPillarGap = Math.max(
    0,
    75 - Math.min(complianceHealth, catalogCompleteness, discoverability, conversionReadiness)
  );
  const potentialScore = Math.min(100, score + Math.max(10, Math.min(38, improvementCapacity + Math.round(weakestPillarGap * 0.25))));
  const estimatedAdditionalApprovedProducts = Math.max(
    0,
    Math.min(
      total,
      Math.round((Number(summary.blocking_core || 0) * 0.65) + (Number(summary.missing_identifier || 0) * 0.35))
    )
  );
  const estimatedVisibilityLiftPct = Math.max(0, Math.min(55, Math.round(((potentialScore - score) * 0.95) + (approvalReadyRate < 60 ? 6 : 0))));
  const auditPillars = [
    {
      key: 'compliance',
      label: 'Conformite diffusion',
      score: complianceHealth,
      detail: 'Mesure la capacite du flux a etre accepte et exploitable sur les canaux transactionnels.',
    },
    {
      key: 'catalog',
      label: 'Completude catalogue',
      score: catalogCompleteness,
      detail: 'Mesure la richesse et la fiabilite des attributs essentiels du catalogue.',
    },
    {
      key: 'discovery',
      label: 'Decouvrabilite',
      score: discoverability,
      detail: 'Mesure la capacite du flux a bien matcher les requetes et la taxonomie des canaux.',
    },
    {
      key: 'conversion',
      label: 'Readiness conversion',
      score: conversionReadiness,
      detail: 'Mesure la capacite du flux a generer du clic qualifie puis de la conversion.',
    },
  ];
  const scoreBand = score >= 85
    ? { label: 'Avance', description: 'Le flux est solide mais peut encore debloquer du volume et de la precision multicanal.' }
    : score >= 70
      ? { label: 'Exploitable', description: 'Le flux est diffusable mais laisse encore trop de valeur sur la table.' }
      : score >= 50
        ? { label: 'Fragile', description: 'Le catalogue diffuse partiellement, avec des angles morts importants a corriger.' }
        : { label: 'Critique', description: 'Le flux perd beaucoup de valeur avant meme la phase de diffusion.' };

  return {
    score,
    potentialScore,
    estimatedAdditionalApprovedProducts,
    estimatedVisibilityLiftPct,
    metrics: {
      totalProducts: total,
      sampleSize: scoredItems.length,
      averageProductScore: scoredAverage,
      coverageRate: dataCoverage,
      approvalReadyRate,
    },
    scoreBreakdown: {
      dataCoverage,
      productQuality: scoredAverage,
      channelReadiness,
    },
    auditPillars,
    scoreBand,
    topIssues,
    methodology: {
      scoring: 'Le score combine quatre piliers: conformite diffusion, completude catalogue, decouvrabilite et readiness conversion, alimentes par la couverture des champs et un echantillon de scores produit.',
      estimation: 'Le potentiel estime valorise les points de friction les plus diffusants, la part de produits bloquants et l ecart entre les piliers faibles et un niveau exploitable.',
    },
  };
}

function buildAuditSummaryFromItems(items = []) {
  const total = items.length;
  const normalizedItems = Array.isArray(items) ? items : [];
  const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';
  const hasIdentifier = (item) => hasValue(item.gtin) || hasValue(item.mpn) || hasValue(item.sku);
  const hasCategory = (item) => hasValue(item.category) || hasValue(item.googleProductCategory) || hasValue(item.productType);
  const hasAvailability = (item) => hasValue(item.availability) || item.inventory !== null && item.inventory !== undefined;
  const isReady = (item) => hasValue(item.title) && hasValue(item.imageUrl) && hasValue(item.price) && hasValue(item.url) && hasIdentifier(item) && hasCategory(item) && hasAvailability(item);
  const isBlocking = (item) => !hasValue(item.title) || !hasValue(item.imageUrl) || !hasValue(item.price) || !hasIdentifier(item);

  return {
    total,
    missing_title: normalizedItems.filter((item) => !hasValue(item.title)).length,
    missing_description: normalizedItems.filter((item) => !hasValue(item.descriptionText) && !hasValue(item.descriptionHtml)).length,
    missing_image: normalizedItems.filter((item) => !hasValue(item.imageUrl)).length,
    missing_brand: normalizedItems.filter((item) => !hasValue(item.brand)).length,
    missing_category: normalizedItems.filter((item) => !hasCategory(item)).length,
    missing_identifier: normalizedItems.filter((item) => !hasIdentifier(item)).length,
    missing_price: normalizedItems.filter((item) => !hasValue(item.price)).length,
    missing_link: normalizedItems.filter((item) => !hasValue(item.url)).length,
    missing_availability: normalizedItems.filter((item) => !hasAvailability(item)).length,
    ready_for_channels: normalizedItems.filter((item) => isReady(item)).length,
    blocking_core: normalizedItems.filter((item) => isBlocking(item)).length,
  };
}

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

function parseGmcMerchantOptions(accountsData) {
  const rawEntries = Array.isArray(accountsData?.accountIdentifiers) ? accountsData.accountIdentifiers : [];
  const seen = new Set();
  const options = [];

  for (const entry of rawEntries) {
    const merchantId = String(entry?.merchantId || entry?.merchantid || entry?.aggregatorId || entry?.aggregatorid || '').trim();
    if (!merchantId || seen.has(merchantId)) continue;
    seen.add(merchantId);

    const merchantName = String(
      entry?.name ||
      entry?.accountName ||
      entry?.displayName ||
      entry?.merchantName ||
      ''
    ).trim();
    const aggregatorId = String(entry?.aggregatorId || entry?.aggregatorid || '').trim();

    options.push({
      merchantId,
      merchantName: merchantName || '',
      aggregatorId: aggregatorId || '',
      label: merchantName ? `${merchantName} (${merchantId})` : `Merchant Center ${merchantId}`,
    });
  }

  return options;
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

  const productsData = await fetchJson(`https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/products?maxResults=250`);
  const statusesData = await fetchJson(`https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/productstatuses?maxResults=250`);
  const statusByOfferId = new Map((statusesData.resources || []).map((entry) => [entry.productId, entry]));
  const items = (productsData.resources || []).map((product) => {
    const status = statusByOfferId.get(product.id) || null;
    const destinationStatuses = Array.isArray(status?.destinationStatuses) ? status.destinationStatuses : [];
    const shoppingStatus = destinationStatuses.find((entry) => entry.destination === 'Shopping_ads') || destinationStatuses[0] || null;
    return {
      title: product.title || null,
      descriptionText: product.description || null,
      descriptionHtml: product.description || null,
      imageUrl: product.imageLink || null,
      brand: product.brand || null,
      category: product.googleProductCategory || null,
      googleProductCategory: product.googleProductCategory || null,
      sku: product.offerId || null,
      mpn: product.mpn || null,
      gtin: product.gtin || null,
      price: product.price?.value ? Number(product.price.value) : null,
      currency: product.price?.currency || null,
      url: product.link || null,
      availability: product.availability || null,
      inventory: null,
      gmcStatus: shoppingStatus?.status || null,
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
function normalizeAvailabilityForGMC(raw, inventory) {
  const s = (raw && String(raw).toLowerCase()) || '';
  if (s === 'in_stock' || s === 'preorder' || s === 'backorder') return s;
  if (s.includes('preorder') || s.includes('pre-order')) return 'preorder';
  if (s.includes('backorder') || s.includes('back-order')) return 'backorder';
  if (s.includes('in stock') || s.includes('instock') || s === 'in stock') return 'in_stock';
  if (inventory != null && parseInt(inventory, 10) > 0) return 'in_stock';
  return 'out_of_stock';
}

/** Normalise la condition vers les valeurs GMC : new, refurbished, used. */
function normalizeConditionForGMC(raw) {
  const s = (raw && String(raw).toLowerCase().trim()) || '';
  if (['new', 'refurbished', 'used'].includes(s)) return s;
  if (/neuf|new|nouveau|nuevo/i.test(s)) return 'new';
  if (/reconditionn|refurbished|recondition/i.test(s)) return 'refurbished';
  if (/usag|used|occasion|second/i.test(s)) return 'used';
  return 'new';
}

// Config des canaux Amazon (marketplaceId SP-API EU)
const AMAZON_CHANNEL_CONFIG = {
  amazon_fr: { marketplaceId: 'A13V1IB3VIYzH9', currency: 'EUR', countryCode: 'FR', locale: 'fr_FR', label: 'Amazon FR' },
  amazon_uk: { marketplaceId: 'A1F83G8C2ARO7P', currency: 'GBP', countryCode: 'GB', locale: 'en_GB', label: 'Amazon UK' },
  amazon_de: { marketplaceId: 'A1PA6795UKMFR9', currency: 'EUR', countryCode: 'DE', locale: 'de_DE', label: 'Amazon DE' },
  amazon_it: { marketplaceId: 'APLT6OXPXZ7JE', currency: 'EUR', countryCode: 'IT', locale: 'it_IT', label: 'Amazon IT' },
  amazon_es: { marketplaceId: 'A1RKKUPIHCS9HS', currency: 'EUR', countryCode: 'ES', locale: 'es_ES', label: 'Amazon ES' }
};


/** Normalise la condition pour Amazon : New, Refurbished, Used (première lettre majuscule). */
function normalizeConditionForAmazon(raw) {
  const s = (raw && String(raw).toLowerCase().trim()) || '';
  if (s === 'refurbished') return 'Refurbished';
  if (s === 'used') return 'Used';
  return 'New';
}

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

/** Normalise un FeedItem pour l'export Amazon (CSV / Listings). Limites : item_name 200 car., bullet 500, etc. */
function normalizeForAmazon(item, channelConfig, options = {}) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc, highlights } = getOptimizedContentForPlatform(item, 'amazon', options);
  const descRaw = optDesc.replace(/<[^>]*>/g, '').trim();
  const currency = channelConfig?.currency || item.currency || cf.currency || 'EUR';
  const price = item.price != null ? Number(item.price).toFixed(2) : '';
  const gtin = item.gtin || cf.gtin || cf.GTIN || '';
  const mpn = item.mpn || cf.mpn || cf.MPN || item.sku || '';
  const sku = (item.sku || item.originid || item.originId || item.id).toString().substring(0, 40);
  const itemName = (optTitle || item.title || sku).toString().substring(0, 200);
  // Utiliser les highlights IA si disponibles, sinon fallback sur la description
  const bullet = highlights.length > 0
    ? highlights.map(h => h.substring(0, 500)).join(' | ')
    : (descRaw.substring(0, 500) || itemName);
  const productId = ((item.originid ?? item.originId) || item.id).toString().substring(0, 50);
  return {
    product_id: productId,
    sku,
    item_name: itemName,
    brand: (item.brand || cf.brand || '').toString().substring(0, 50) || 'Generic',
    bullet_point: bullet,
    product_description: descRaw.substring(0, 2000),
    standard_price: price ? `${price} ${currency}` : '',
    quantity: item.inventory != null ? Math.max(0, parseInt(item.inventory, 10)) : 0,
    main_image_url: (item.imageurl ?? item.imageUrl) || cf.image_link || cf.imageUrl || '',
    condition_type: normalizeConditionForAmazon(item.condition || cf.condition),
    external_product_id: gtin || mpn || '',
    external_product_id_type: gtin ? 'ean' : (mpn ? 'upc' : ''),
    manufacturer: (item.brand || cf.brand || '').toString().substring(0, 50) || '',
    link: item.url || cf.link || ''
  };
}

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

app.get('/api/v1/ingestion/feeds/:id/export', async (req, res) => {
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

// Récupérer un item spécifique avec son feed et mapping
app.get('/api/v1/ingestion/items/:id', async (req, res) => {
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

// Endpoint de diagnostic pour vérifier les données d'un item
app.get('/api/v1/ingestion/items/:id/debug', async (req, res) => {
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

// Récupérer le score de qualité d'un item
app.get('/api/v1/ingestion/items/:id/score', async (req, res) => {
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

// Historique du score produit (évolution dans le temps, pour graphique)
app.get('/api/v1/ingestion/items/:id/score-history', async (req, res) => {
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

// Endpoint pour calculer le score global du catalogue
app.get('/api/v1/ingestion/catalogue/score', async (req, res) => {
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

// Endpoint pour recalculer tous les scores avec le nouveau système avancé
app.post('/api/v1/ingestion/recalculate-all-scores', async (req, res) => {
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

// Analyser un CSV via upload de fichier
app.post('/api/v1/ingestion/upload-csv', upload.single('file'), async (req, res) => {
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

// Analyser un CSV et proposer un mapping automatique (via URL)
app.post('/api/v1/ingestion/analyze-csv', async (req, res) => {
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

// ── PDF d'audit premium (HTML → PDF via Chromium) ────────────────────────────

const AUDIT_PDF_FIELD_LABELS_FR = {
  description: 'Description', identifier: 'Identifiant (GTIN/MPN)',
  brand: 'Marque', category: 'Catégorie', title: 'Titre',
};

function auditPdfEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Style d'un blocage selon la sévérité — calqué sur getIssueStyle() du front.
const AUDIT_PDF_SEVERITY = {
  high: { border: '#FECACA', bg: '#FEF1F1', text: '#B42318', label: 'Priorité haute' },
  medium: { border: '#FDE68A', bg: '#FEF6E7', text: '#B45309', label: 'Priorité moyenne' },
  low: { border: '#CFCFCF', bg: '#F2F2F2', text: '#2A2A2A', label: 'Priorité basse' },
};

// Radar / "araignée" SVG des piliers du flux — lecture instantanée des points faibles.
function buildAuditRadarSvg(pillars) {
  const list = (Array.isArray(pillars) ? pillars : []).slice(0, 6);
  const n = list.length;
  if (n < 3) return '';
  const cx = 230;
  const cy = 152;
  const R = 84;
  const angle = (i) => (-90 + i * (360 / n)) * Math.PI / 180;
  const point = (i, radius) => {
    const a = angle(i);
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  };
  const clampScore = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const polyPoints = (radiusFor) => list
    .map((_, i) => point(i, radiusFor(i)).map((v) => v.toFixed(1)).join(','))
    .join(' ');

  const rings = [0.25, 0.5, 0.75, 1]
    .map((lvl) => `<polygon points="${polyPoints(() => R * lvl)}" fill="none" stroke="#E5E5E5" stroke-width="1"/>`)
    .join('');
  const axes = list
    .map((_, i) => {
      const [x, y] = point(i, R);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#E5E5E5" stroke-width="1"/>`;
    })
    .join('');
  const dataPoints = polyPoints((i) => (R * clampScore(list[i].score)) / 100);
  const dots = list
    .map((_, i) => {
      const [x, y] = point(i, (R * clampScore(list[i].score)) / 100);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="#2A6FE8"/>`;
    })
    .join('');
  const labels = list
    .map((p, i) => {
      const [lx, ly] = point(i, R + 15);
      const anchor = lx > cx + 6 ? 'start' : lx < cx - 6 ? 'end' : 'middle';
      const dy = ly < cy - 6 ? -3 : ly > cy + 6 ? 11 : 4;
      const v = Math.round(clampScore(p.score));
      return `<text x="${lx.toFixed(1)}" y="${(ly + dy).toFixed(1)}" text-anchor="${anchor}" font-size="9.5" font-weight="600" fill="#2A2A2A">${auditPdfEscape(p.label)}</text>`
        + `<text x="${lx.toFixed(1)}" y="${(ly + dy + 12).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="#2A6FE8">${v}/100</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 460 312" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="'Hanken Grotesk',sans-serif">
    ${rings}${axes}
    <polygon points="${dataPoints}" fill="rgba(42,111,232,0.14)" stroke="#2A6FE8" stroke-width="2" stroke-linejoin="round"/>
    ${dots}${labels}
  </svg>`;
}

// Construit le document HTML (print A4) du rapport d'audit.
// Aligné sur le design system FeedPlug ("Tesla mineral") : surface off-white,
// encre near-black, accent bleu acier #2A6FE8, typo Bricolage / Hanken Grotesk.
function buildAuditReportHtml(audit) {
  const esc = auditPdfEscape;
  const report = audit.report || {};
  const score = Math.max(0, Math.min(100, Math.round(Number(report.score) || 0)));
  const potential = Math.max(0, Math.min(100, Math.round(Number(report.potentialScore) || 0)));
  const band = report.scoreBand || {};
  const pillars = Array.isArray(report.auditPillars) ? report.auditPillars : [];
  const issues = Array.isArray(report.topIssues) ? report.topIssues : [];
  const samples = Array.isArray(report.sampleProducts) ? report.sampleProducts : [];
  const createdAt = audit.createdAt ? new Date(audit.createdAt) : new Date();
  const dateStr = createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const radarSvg = buildAuditRadarSvg(pillars);
  const pillarsHtml = pillars.map((p) => {
    const v = Math.max(0, Math.min(100, Math.round(Number(p.score) || 0)));
    return `
    <div style="margin-bottom:14px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:12.5px;font-weight:600;color:#0A0A0A;">${esc(p.label)}</td>
        <td style="text-align:right;font-size:12.5px;font-weight:700;color:#2A6FE8;">${v}/100</td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr>
        <td style="background:#E5E5E5;border-radius:999px;font-size:0;">
          <table width="${Math.max(4, v)}%" cellpadding="0" cellspacing="0"><tr>
            <td style="background:#2A6FE8;height:7px;border-radius:999px;font-size:0;">&nbsp;</td>
          </tr></table>
        </td>
      </tr></table>
    </div>`;
  }).join('');

  const issuesHtml = issues.slice(0, 5).map((it, idx) => {
    const sev = AUDIT_PDF_SEVERITY[it.severity] || AUDIT_PDF_SEVERITY.low;
    return `
    <div class="issue" style="background:${sev.bg};border:1px solid ${sev.border};">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${sev.text};">${esc(sev.label)}</div>
          <div style="font-size:15px;font-weight:700;color:#0A0A0A;margin-top:6px;">${idx + 1}. ${esc(it.label)}</div>
        </td>
        <td style="vertical-align:top;text-align:right;width:60px;">
          <span style="display:inline-block;background:#fff;border:1px solid ${sev.border};color:${sev.text};font-size:12px;font-weight:700;border-radius:999px;padding:4px 9px;">${esc(it.affectedRate || 0)}%</span>
        </td>
      </tr></table>
      <div style="font-size:12.5px;line-height:1.65;color:#2A2A2A;margin-top:10px;">${esc(it.affectedProducts || 0)} produits concernés. ${esc(it.impact || '')}</div>
      ${it.recommendation ? `<div style="font-size:12.5px;line-height:1.65;color:#2A2A2A;margin-top:5px;"><strong style="color:#0A0A0A;">Action recommandée :</strong> ${esc(it.recommendation)}</div>` : ''}
    </div>`;
  }).join('');

  const samplesHtml = samples.map((s, idx) => {
    const before = s.before || {};
    const after = s.after || null;
    const beforeIssues = Array.isArray(before.issues)
      ? before.issues.map((k) => AUDIT_PDF_FIELD_LABELS_FR[k] || k)
      : [];
    const afterAttrs = after && Array.isArray(after.attributes) ? after.attributes : [];
    // Images affichées uniquement si on a l'après (sample hero only),
    // sinon on garde une mise en page symétrique full-texte.
    const showImages = !!(before.imageUrl && after && after.imageUrl);
    const imgStyle = 'display:block;width:100%;height:130px;object-fit:contain;background:#FFFFFF;border-radius:14px;margin-bottom:10px;';
    return `
    <div class="ba-block">
      <div class="eyebrow" style="margin-bottom:9px;">Fiche produit ${idx + 1}</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>
        <td style="width:50%;vertical-align:top;padding-right:8px;">
          <div class="ba-card" style="background:#FEF1F1;border:1px solid #FECACA;">
            ${showImages ? `<img src="${esc(before.imageUrl)}" style="${imgStyle}" alt="Avant">` : ''}
            <div class="ba-tag" style="color:#B42318;">Avant</div>
            <div class="ba-title">${esc(before.title) || '<span style="color:#B0B0B0;">(titre vide)</span>'}</div>
            <div class="ba-desc">${esc(before.description) || '<span style="color:#B0B0B0;">(description vide)</span>'}</div>
            ${beforeIssues.length ? `<div style="margin-top:10px;">${beforeIssues.map((i) => `<span class="chip" style="background:#fff;border:1px solid #FECACA;color:#B42318;">✕ ${esc(i)}</span>`).join('')}</div>` : ''}
          </div>
        </td>
        <td style="width:50%;vertical-align:top;padding-left:8px;">
          <div class="ba-card" style="background:#ECFDF3;border:1px solid #BBF7D0;">
            ${showImages ? `<img src="${esc(after.imageUrl)}" style="${imgStyle}" alt="Après">` : ''}
            <div class="ba-tag" style="color:#15803D;">Après — corrigé par FeedPlug</div>
            ${after ? `
            <div class="ba-title">${esc(after.title)}</div>
            <div class="ba-desc">${esc(after.description)}</div>
            ${afterAttrs.length ? `<div style="margin-top:10px;">${afterAttrs.map((a) => `<div style="font-size:11.5px;color:#0A0A0A;margin-bottom:3px;"><strong style="color:#15803D;">${esc(a.label)} :</strong> ${esc(a.value)}</div>`).join('')}</div>` : ''}
            ` : '<div class="ba-desc" style="color:#6F6F6F;">Version optimisée générée dans votre espace FeedPlug.</div>'}
          </div>
        </td>
      </tr></table>
    </div>`;
  }).join('');

  const planSteps = issues.slice(0, 4).map((it) => it.recommendation || `Corriger : ${it.label}`);
  planSteps.push('Brancher FeedPlug pour appliquer et maintenir ces corrections automatiquement sur tous les canaux.');
  const planHtml = planSteps.map((step, idx) => `
    <tr>
      <td style="width:32px;vertical-align:top;padding:7px 0;">
        <div style="width:26px;height:26px;line-height:26px;text-align:center;background:#E8EFFB;border-radius:999px;color:#2A6FE8;font-size:12px;font-weight:700;">${idx + 1}</div>
      </td>
      <td style="padding:7px 0 7px 12px;font-size:13.5px;line-height:1.6;color:#2A2A2A;">${esc(step)}</td>
    </tr>`).join('');

  const statCell = (value, label, color) => `
    <div class="stat">
      <div class="stat-v" style="color:${color};">${esc(value)}</div>
      <div class="stat-l">${esc(label)}</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin:0; background:#FAFAFA; color:#0A0A0A;
    font-family:'Hanken Grotesk',ui-sans-serif,system-ui,-apple-system,sans-serif;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .display { font-family:'Bricolage Grotesque','Hanken Grotesk',sans-serif; }
  .cover { padding:46px 56px 30px; border-bottom:1px solid #E5E5E5; }
  .wrap { padding:36px 56px 48px; }
  .eyebrow { font-size:11px; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; color:#2A6FE8; }
  /* Empêcher un titre h2 d'être laissé seul en bas de page sans son contenu.
     break-after:avoid est la prop moderne, page-break-after:avoid le fallback
     historique encore lu par Chromium / Skia PDF. */
  h2 { font-family:'Bricolage Grotesque',sans-serif; font-size:19px; font-weight:700; color:#0A0A0A; margin:0 0 14px; letter-spacing:-0.01em; page-break-after:avoid; break-after:avoid; }
  .section { margin-bottom:28px; }
  .card { background:#FFFFFF; border:1px solid #E5E5E5; border-radius:20px; padding:22px; page-break-inside:avoid; }
  .issue { border-radius:20px; padding:18px 20px; margin-bottom:12px; page-break-inside:avoid; }
  .ba-block { margin-bottom:16px; page-break-inside:avoid; }
  .ba-card { border-radius:20px; padding:16px 17px; min-height:148px; }
  .ba-tag { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:9px; }
  .ba-title { font-size:13px; font-weight:700; color:#0A0A0A; line-height:1.42; margin-bottom:7px; }
  .ba-desc { font-size:11.5px; color:#2A2A2A; line-height:1.6; }
  .chip { display:inline-block; font-size:10px; font-weight:600; border-radius:6px; padding:3px 8px; margin:0 5px 5px 0; }
  .stat { background:#FFFFFF; border:1px solid #E5E5E5; border-radius:20px; padding:20px 18px; }
  .stat-v { font-family:'Bricolage Grotesque',sans-serif; font-size:32px; font-weight:700; line-height:1; letter-spacing:-0.04em; }
  .stat-l { font-size:12.5px; color:#6F6F6F; margin-top:9px; line-height:1.45; }
</style></head>
<body>
  <div class="cover">
    <div class="display" style="font-size:18px;font-weight:700;color:#0A0A0A;letter-spacing:-0.02em;">FeedPlug</div>
    <div class="eyebrow" style="margin-top:34px;">Rapport d'audit · ${esc(dateStr)}</div>
    <div class="display" style="font-size:34px;font-weight:700;color:#0A0A0A;letter-spacing:-0.02em;margin-top:10px;">Audit de flux produit</div>
    <div style="font-size:14px;color:#6F6F6F;margin-top:10px;">
      ${esc(audit.company || 'Votre catalogue')} &nbsp;·&nbsp; ${esc(audit.cmsUsed || audit.connectorType || 'Source')} &nbsp;·&nbsp; ${esc((report.summary && report.summary.totalProducts) || audit.catalogSize || 0)} produits
    </div>
  </div>
  <div class="wrap">

    <div class="section">
      <h2>Synthèse</h2>
      <div class="card">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            <div style="font-size:12.5px;font-weight:600;color:#6F6F6F;">Score actuel du flux</div>
            <div class="display" style="font-size:52px;font-weight:700;line-height:1;letter-spacing:-0.04em;color:#2A6FE8;margin-top:6px;">${score}<span style="font-size:20px;color:#B0B0B0;">/100</span></div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:#E8EFFB;border-radius:999px;padding:9px 16px;font-size:13px;font-weight:700;color:#1F58C0;">Potentiel atteignable&nbsp;: ${potential}/100</span>
          </td>
        </tr></table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>
          <td style="background:#E5E5E5;border-radius:999px;font-size:0;">
            <table width="${Math.max(4, score)}%" cellpadding="0" cellspacing="0"><tr><td style="background:#2A6FE8;height:10px;border-radius:999px;font-size:0;">&nbsp;</td></tr></table>
          </td>
        </tr></table>
        ${band.label ? `<div style="margin-top:16px;padding-top:15px;border-top:1px solid #E5E5E5;font-size:13px;line-height:1.65;color:#2A2A2A;"><strong class="display" style="color:#0A0A0A;">Niveau ${esc(band.label)}.</strong> ${esc(band.description || '')}</div>` : ''}
      </div>
    </div>

    <div class="section">
      <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>
        <td style="width:33.33%;padding-right:7px;vertical-align:top;">${statCell(report.estimatedAdditionalApprovedProducts || 0, 'produits récupérables', '#15803D')}</td>
        <td style="width:33.33%;padding:0 7px;vertical-align:top;">${statCell(`+${report.estimatedVisibilityLiftPct || 0}%`, 'de visibilité estimée', '#2A6FE8')}</td>
        <td style="width:33.33%;padding-left:7px;vertical-align:top;">${statCell(`${(report.summary && report.summary.approvalReadyRate) || 0}%`, 'produits déjà prêts', '#2A6FE8')}</td>
      </tr></table>
    </div>

    ${pillars.length ? `<div class="section">
      <h2>Le profil de votre flux</h2>
      <div class="card">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:54%;vertical-align:middle;padding-right:18px;">${radarSvg}</td>
          <td style="width:46%;vertical-align:middle;padding-left:20px;border-left:1px solid #E5E5E5;">${pillarsHtml}</td>
        </tr></table>
      </div>
    </div>` : ''}

    <div class="section">
      <h2>Les blocages prioritaires</h2>
      ${issuesHtml || '<div class="card">Aucun blocage majeur détecté.</div>'}
    </div>

    ${samples.length ? `<div class="section">
      <h2>Avant / Après sur votre catalogue</h2>
      <p style="font-size:13px;color:#6F6F6F;margin:0 0 16px;line-height:1.6;">Un échantillon de vos fiches, corrigées par FeedPlug — titres, descriptions et attributs.</p>
      ${samplesHtml}
    </div>` : ''}

    <div class="section">
      <h2>Plan d'action</h2>
      <div class="card"><table width="100%" cellpadding="0" cellspacing="0">${planHtml}</table></div>
    </div>

    <div style="border-top:1px solid #E5E5E5;padding-top:18px;">
      ${report.methodology ? `<div style="font-size:10.5px;color:#B0B0B0;line-height:1.65;">${esc(report.methodology.scoring || '')} ${esc(report.methodology.estimation || '')}</div>` : ''}
      <div style="margin-top:13px;font-size:12px;color:#6F6F6F;">Audit complet et version optimisée du catalogue&nbsp;: <strong style="color:#2A6FE8;">${esc(audit.shareUrl || 'feedplug.com')}</strong></div>
    </div>

  </div>
</body></html>`;
}

let auditPdfBrowserPromise = null;

// Résout le chemin du binaire Chromium parmi les emplacements connus.
function resolveChromiumPath() {
  const fs = require('fs');
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch { /* ignore */ }
  }
  return candidates[0] || '/usr/bin/chromium';
}

// Lance (ou réutilise) un Chromium headless adapté à Cloud Run.
async function getAuditPdfBrowser() {
  const puppeteer = require('puppeteer-core');
  if (auditPdfBrowserPromise) {
    try {
      const existing = await auditPdfBrowserPromise;
      if (existing && existing.connected !== false && existing.isConnected && existing.isConnected()) {
        return existing;
      }
    } catch {
      auditPdfBrowserPromise = null;
    }
  }
  const executablePath = resolveChromiumPath();
  console.log(`🖨️  Lancement Chromium pour PDF audit: ${executablePath}`);
  auditPdfBrowserPromise = puppeteer.launch({
    executablePath,
    headless: true,
    dumpio: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-crash-reporter',
      '--disable-breakpad',
      '--disable-software-rasterizer',
    ],
  });
  return auditPdfBrowserPromise;
}

// Rend un document HTML en PDF (buffer) via Chromium headless.
async function renderAuditReportPdf(html) {
  const browser = await getAuditPdfBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    const pdfData = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    // Puppeteer v23 renvoie un Uint8Array : on le convertit en Buffer Node
    // pour qu'Express l'envoie en binaire (sinon sérialisé en JSON).
    return Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);
  } finally {
    await page.close().catch(() => {});
  }
}

function buildMarketingAuditPdfBuffer(auditPayload) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const audit = auditPayload || {};
    const report = audit.report || {};
    const summary = report.summary || {};
    const issues = Array.isArray(report.topIssues) ? report.topIssues : [];
    const isReady = audit.status === 'ready' && report && Object.keys(report).length > 0;

    doc.fontSize(24).fillColor('#0f172a').text('FeedPlug - Audit de flux produit');
    doc.moveDown(0.4);
    doc.fontSize(12).fillColor('#475569').text(`${audit.company || 'Entreprise'} · ${audit.cmsUsed || audit.connectorType || 'SOURCE'} · ${summary.totalProducts || audit.catalogSize || 0} produits`);
    doc.text(`Lien partageable: ${audit.shareUrl || ''}`);
    doc.moveDown();

    if (!isReady) {
      doc.fontSize(16).fillColor('#0f172a').text('Statut');
      doc.moveDown(0.4);
      doc.fontSize(12).fillColor('#111827').text('Audit technique gratuit en preparation.');
      doc.text('Le score n est pas encore affiche, car FeedPlug attend une connexion reelle a la source pour analyser les donnees du flux.');
      doc.moveDown(0.6);
      doc.text(`Statut actuel: ${audit.status || 'pending_connection'}`);
      doc.moveDown();
      doc.fontSize(16).fillColor('#0f172a').text('Prochaine etape');
      doc.moveDown(0.4);
      doc.fontSize(12).fillColor('#111827').text('Connectez la source catalogue pour lancer l analyse technique reelle.');
      doc.end();
      return;
    }

    doc.fontSize(16).fillColor('#0f172a').text('Synthese');
    doc.moveDown(0.4);
    doc.fontSize(12).fillColor('#111827');
    doc.text(`Score actuel: ${report.score || 0}/100`);
    doc.text(`Potentiel estime: ${report.potentialScore || 0}/100`);
    doc.text(`Produits recuperables: ${report.estimatedAdditionalApprovedProducts || 0}`);
    doc.text(`Gain de visibilite estime: ${report.estimatedVisibilityLiftPct || 0}%`);
    doc.moveDown();

    doc.fontSize(16).fillColor('#0f172a').text('Breakdown');
    doc.moveDown(0.4);
    doc.fontSize(12).fillColor('#111827');
    const breakdown = report.scoreBreakdown || {};
    doc.text(`Couverture des donnees: ${breakdown.dataCoverage || 0}/100`);
    doc.text(`Qualite produit moyenne: ${breakdown.productQuality || 0}/100`);
    doc.text(`Readiness canal: ${breakdown.channelReadiness || 0}/100`);
    doc.text(`Produits deja prets: ${summary.approvalReadyRate || 0}%`);
    doc.moveDown();

    doc.fontSize(16).fillColor('#0f172a').text('Priorites');
    doc.moveDown(0.4);
    issues.slice(0, 5).forEach((issue, index) => {
      doc.fontSize(12).fillColor('#111827').text(`${index + 1}. ${issue.label} - ${issue.affectedRate || 0}% du catalogue`, { continued: false });
      doc.fontSize(11).fillColor('#475569').text(`Impact: ${issue.impact || ''}`);
      doc.text(`Action: ${issue.recommendation || ''}`);
      doc.moveDown(0.5);
    });

    if (report.methodology) {
      doc.moveDown();
      doc.fontSize(16).fillColor('#0f172a').text('Methodologie');
      doc.moveDown(0.4);
      doc.fontSize(11).fillColor('#475569').text(report.methodology.scoring || '');
      doc.moveDown(0.3);
      doc.text(report.methodology.estimation || '');
    }

    doc.end();
  });
}

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
app.get('/api/v1/account/capabilities', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) {
      return res.status(403).json({ message: 'Compte non associé' });
    }
    const [plan, addonIA, maxChannelsFromAccount, sourcesRows, feedsRows, productCount, channelsCount] = await Promise.all([
      getAccountPlan(prisma, accountId),
      getAccountAddonIA(prisma, accountId),
      getAccountMaxChannels(prisma, accountId),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "FeedSource" WHERE accountid = $1::text`, accountId),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Feed" WHERE accountid = $1::text`, accountId),
      countProductsForAccount(prisma, accountId),
      countChannelsForAccount(prisma, accountId),
    ]);
    const usage = {
      sourcesCount: sourcesRows?.[0]?.c ?? 0,
      feedsCount: feedsRows?.[0]?.c ?? 0,
      productsCount: productCount,
      channelsCount,
    };
    res.json({
      ...getPlanCapabilitiesForApi(plan, addonIA, maxChannelsFromAccount),
      usage,
    });
  } catch (e) {
    console.error('GET /account/capabilities error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

// Infos entreprise / facturation (prospection, obligatoire pour tous les comptes)
app.get('/api/v1/account/company-info', authenticateToken, async (req, res) => {
  const emptyCompanyInfo = {
    companyName: null,
    phoneE164: null,
    billingEmail: null,
    hasCompletedCompanyInfo: false,
    vatNumber: null,
    siren: null,
    billingAddress: null,
  };
  try {
    const prismaClient = await requirePrismaForRequest(res, 'Service non disponible');
    if (!prismaClient) return;
    await ensureCompanyInfoSchema();

    const accountId = req.user.accountId || req.accountId;
    if (!accountId) return res.status(403).json({ message: 'Compte non associé' });

    const rows = await prismaClient.$queryRawUnsafe(`
      SELECT companyname, phonee164, billingemail FROM "Account" WHERE id = $1::text LIMIT 1
    `, accountId);
    const accountRow = rows?.[0] || {};
    const companyName = accountRow.companyname ?? null;
    const phoneE164 = accountRow.phonee164 ?? null;
    const billingEmail = accountRow.billingemail ?? null;

    let data = {};
    try {
      const progressRows = await prismaClient.$queryRawUnsafe(`
        SELECT collecteddata FROM "OnboardingProgress" WHERE accountid = $1::text LIMIT 1
      `, accountId);
      const collected = progressRows?.[0]?.collecteddata;
      data = typeof collected === 'object' && collected !== null ? collected : (collected ? JSON.parse(collected) : {});
    } catch (_) {
      data = {};
    }

    const vatNum = data.vatNumber ?? null;
    const sirenVal = data.siren ?? null;
    const billingAddress =
      data.billingAddress && typeof data.billingAddress === 'object'
        ? data.billingAddress
        : null;
    const hasCompletedCompanyInfo = !!(companyName && phoneE164 && billingEmail && vatNum && sirenVal && String(sirenVal).length === 9);

    res.json({
      ...emptyCompanyInfo,
      companyName,
      phoneE164,
      billingEmail,
      hasCompletedCompanyInfo,
      vatNumber: vatNum,
      siren: sirenVal,
      billingAddress,
    });
  } catch (e) {
    console.error('GET /account/company-info error:', e);
    res.status(500).json({ message: e?.message || 'Erreur' });
  }
});

app.put('/api/v1/account/company-info', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    await ensureCompanyInfoSchema();
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) return res.status(403).json({ message: 'Compte non associé' });
    const body = req.body || {};
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : null;
    if (!companyName) {
      return res.status(400).json({ message: 'Le nom de l\'entreprise est requis.' });
    }
    // Activation : seul le nom de l'entreprise est requis à l'onboarding.
    // Téléphone, TVA, SIREN et adresse sont optionnels ici — les informations
    // de facturation complètes sont collectées au moment du checkout.
    const phoneE164 = typeof body.phoneE164 === 'string' ? body.phoneE164.trim() || null : null;
    const billingEmail = typeof body.billingEmail === 'string' ? body.billingEmail.trim() || null : null;
    const vatNumber = typeof body.vatNumber === 'string' ? body.vatNumber.trim() || null : null;
    const siren = typeof body.siren === 'string' ? body.siren.trim().replace(/\s/g, '') || null : null;
    if (siren && siren.length !== 9) {
      return res.status(400).json({ message: 'Le SIREN doit comporter 9 chiffres.' });
    }
    const addressLine1 = typeof body.addressLine1 === 'string' ? body.addressLine1.trim() || null : null;
    const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() || null : null;
    const city = typeof body.city === 'string' ? body.city.trim() || null : null;
    const country = typeof body.country === 'string' ? body.country.trim() || 'FR' : 'FR';
    await prisma.$executeRawUnsafe(`
      UPDATE "Account" SET companyname = $1::text, phonee164 = $2::text, billingemail = $3::text, updatedat = NOW()
      WHERE id = $4::text
    `, companyName, phoneE164, billingEmail, accountId);
    const billingAddress = {
      addressLine1: addressLine1,
      addressLine2: typeof body.addressLine2 === 'string' ? body.addressLine2.trim() || null : null,
      postalCode,
      city,
      country,
    };
    const existingProgressRows = await prisma.$queryRawUnsafe(`
      SELECT currentstep, completedsteps, collecteddata
      FROM "OnboardingProgress"
      WHERE accountid = $1::text
      LIMIT 1
    `, accountId);
    const existingProgress = existingProgressRows?.[0] || null;
    let completedSteps = [];
    try {
      completedSteps = Array.isArray(existingProgress?.completedsteps)
        ? existingProgress.completedsteps
        : (existingProgress?.completedsteps ? JSON.parse(existingProgress.completedsteps) : []);
    } catch {
      completedSteps = [];
    }
    if (!completedSteps.includes('company_info')) completedSteps.push('company_info');
    let existingCollectedData = {};
    try {
      existingCollectedData =
        existingProgress?.collecteddata && typeof existingProgress.collecteddata === 'object'
          ? existingProgress.collecteddata
          : (existingProgress?.collecteddata ? JSON.parse(existingProgress.collecteddata) : {});
    } catch {
      existingCollectedData = {};
    }
    const extraData = {
      ...existingCollectedData,
      billingAddress,
      vatNumber,
      siren,
      companyInfoCompletedAt: new Date().toISOString(),
    };
    await prisma.$executeRawUnsafe(`
      INSERT INTO "OnboardingProgress" (id, accountid, currentstep, completedsteps, collecteddata, updatedat)
      VALUES (gen_random_uuid()::text, $1::text, 'welcome', '[]'::jsonb, $2::jsonb, NOW())
      ON CONFLICT (accountid) DO UPDATE SET
        currentstep = COALESCE("OnboardingProgress".currentstep, 'welcome'),
        completedsteps = $3::jsonb,
        collecteddata = COALESCE("OnboardingProgress".collecteddata, '{}'::jsonb) || EXCLUDED.collecteddata,
        updatedat = NOW()
    `, accountId, JSON.stringify(extraData), JSON.stringify(completedSteps));
    res.json({ companyName, phoneE164, billingEmail });
  } catch (e) {
    console.error('PUT /account/company-info error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

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

app.get('/api/v1/markets', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    await ensureMarketsBackfillForAccount(accountId);
    const markets = await getHydratedMarketsForAccount(accountId);
    res.json({ markets });
  } catch (error) {
    console.error('GET /markets error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors du chargement des marchés' });
  }
});

app.post('/api/v1/markets', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour créer un marché' });
    }
    const accountId = req.user.accountId || req.accountId;
    await ensureMarketsBackfillForAccount(accountId);

    const body = req.body || {};
    const code = normalizeMarketCode(body.code || body.marketCode || body.targetMarketCode || '');
    if (!code) {
      return res.status(400).json({ message: 'Le code marché est requis (ex. IT, BE, CH).' });
    }

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Market" WHERE accountid = $1::text AND code = $2::text LIMIT 1`,
      accountId,
      code
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: `Le marché ${code} existe déjà sur ce compte.` });
    }

    const existingMarkets = await getHydratedMarketsForAccount(accountId);
    const sourceMarketId = body.sourceMarketId || null;
    const sourceMarket = sourceMarketId
      ? existingMarkets.find((market) => market.id === sourceMarketId)
      : null;
    if (sourceMarketId && !sourceMarket) {
      return res.status(404).json({ message: 'Marché source introuvable sur ce compte.' });
    }

    const name = String(body.name || '').trim() || getMarketName(code);
    const countryCodes = Array.isArray(body.countryCodes) && body.countryCodes.length > 0
      ? body.countryCodes.map((entry) => normalizeMarketCode(entry)).filter(Boolean)
      : [code];
    const defaultCurrencyCode = String(body.defaultCurrencyCode || sourceMarket?.defaultCurrencyCode || getMarketCurrency(code)).trim().toUpperCase();
    const marketId = await createMarket(accountId, {
      code,
      name,
      sourceMarketId,
      countryCodes,
      defaultCurrencyCode,
      status: String(body.status || 'draft').trim() || 'draft',
      pricingPolicyJson: body.pricingPolicy || body.pricingPolicyJson || sourceMarket?.pricingPolicy || {},
      shippingPolicyJson: body.shippingPolicy || body.shippingPolicyJson || sourceMarket?.shippingPolicy || {},
      taxPolicyJson: body.taxPolicy || body.taxPolicyJson || sourceMarket?.taxPolicy || {},
      contentStrategyJson: body.contentStrategy || body.contentStrategyJson || sourceMarket?.contentStrategy || {},
      publicationDefaultsJson: body.publicationDefaults || body.publicationDefaultsJson || sourceMarket?.publicationDefaults || {},
    });

    const marketRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Market" WHERE id = $1::text AND accountid = $2::text LIMIT 1`,
      marketId,
      accountId
    );
    const marketRow = marketRows?.[0];
    const localesInput = Array.isArray(body.locales) && body.locales.length > 0
      ? body.locales
      : (sourceMarket?.locales || []);
    await ensureMarketLocales(marketId, code, localesInput);

    const platformAccounts = await listPlatformAccountsForAccount(accountId);
    const channelsInput = Array.isArray(body.channels) && body.channels.length > 0
      ? body.channels
      : (sourceMarket?.channels || []).map((channel) => ({
        platformKey: channel.platformKey,
        platformAccountId: channel.platformAccountId,
        status: channel.status,
        isEnabled: channel.isEnabled,
        settingsJson: channel.settings,
      }));
    if (channelsInput.length > 0) {
      await upsertMarketChannels(marketRow, channelsInput, platformAccounts);
    }
    await syncDestinationsForMarket(accountId, marketId);

    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === marketId);
    res.status(201).json({ market });
  } catch (error) {
    console.error('POST /markets error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de la création du marché' });
  }
});

app.get('/api/v1/markets/:marketId', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    await ensureMarketsBackfillForAccount(accountId);
    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === req.params.marketId);
    if (!market) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }
    res.json({ market });
  } catch (error) {
    console.error('GET /markets/:marketId error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors du chargement du marché' });
  }
});

app.patch('/api/v1/markets/:marketId', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour modifier ce marché' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId } = req.params;
    const body = req.body || {};
    const marketRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Market" WHERE id = $1::text AND accountid = $2::text LIMIT 1`,
      marketId,
      accountId
    );
    const marketRow = marketRows?.[0];
    if (!marketRow) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }

    const updates = [];
    const params = [];
    let index = 1;
    const pushText = (column, value) => {
      updates.push(`${column} = $${index++}::text`);
      params.push(value);
    };
    const pushJson = (column, value) => {
      updates.push(`${column} = $${index++}::jsonb`);
      params.push(JSON.stringify(value || {}));
    };

    if (body.code !== undefined) {
      const nextCode = normalizeMarketCode(body.code);
      if (!nextCode) return res.status(400).json({ message: 'Code marché invalide.' });
      const duplicate = await prisma.$queryRawUnsafe(
        `SELECT id FROM "Market" WHERE accountid = $1::text AND code = $2::text AND id != $3::text LIMIT 1`,
        accountId,
        nextCode,
        marketId
      );
      if (duplicate && duplicate.length > 0) {
        return res.status(409).json({ message: `Le marché ${nextCode} existe déjà sur ce compte.` });
      }
      pushText('code', nextCode);
    }
    if (body.name !== undefined) pushText('name', String(body.name || '').trim() || marketRow.name);
    if (body.defaultCurrencyCode !== undefined) pushText('defaultcurrencycode', String(body.defaultCurrencyCode || '').trim().toUpperCase() || marketRow.defaultcurrencycode);
    if (body.status !== undefined) pushText('status', String(body.status || '').trim() || marketRow.status);
    if (body.countryCodes !== undefined) pushJson('countrycodesjson', Array.isArray(body.countryCodes) ? body.countryCodes.map((entry) => normalizeMarketCode(entry)).filter(Boolean) : [marketRow.code]);
    if (body.pricingPolicy !== undefined || body.pricingPolicyJson !== undefined) pushJson('pricingpolicyjson', body.pricingPolicy || body.pricingPolicyJson || {});
    if (body.shippingPolicy !== undefined || body.shippingPolicyJson !== undefined) pushJson('shippingpolicyjson', body.shippingPolicy || body.shippingPolicyJson || {});
    if (body.taxPolicy !== undefined || body.taxPolicyJson !== undefined) pushJson('taxpolicyjson', body.taxPolicy || body.taxPolicyJson || {});
    if (body.contentStrategy !== undefined || body.contentStrategyJson !== undefined) pushJson('contentstrategyjson', body.contentStrategy || body.contentStrategyJson || {});
    if (body.publicationDefaults !== undefined || body.publicationDefaultsJson !== undefined) pushJson('publicationdefaultsjson', body.publicationDefaults || body.publicationDefaultsJson || {});

    if (updates.length === 0) {
      const markets = await getHydratedMarketsForAccount(accountId);
      return res.json({ market: markets.find((entry) => entry.id === marketId) || null });
    }

    updates.push('updatedat = NOW()');
    params.push(marketId);
    await prisma.$executeRawUnsafe(
      `UPDATE "Market" SET ${updates.join(', ')} WHERE id = $${index}::text`,
      ...params
    );
    await syncDestinationsForMarket(accountId, marketId);
    const markets = await getHydratedMarketsForAccount(accountId);
    res.json({ market: markets.find((entry) => entry.id === marketId) || null });
  } catch (error) {
    console.error('PATCH /markets/:marketId error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de la mise à jour du marché' });
  }
});

app.post('/api/v1/markets/:marketId/locales', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour modifier les langues du marché' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId } = req.params;
    const marketRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Market" WHERE id = $1::text AND accountid = $2::text LIMIT 1`,
      marketId,
      accountId
    );
    const marketRow = marketRows?.[0];
    if (!marketRow) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }

    const currentLocales = await prisma.$queryRawUnsafe(
      `SELECT * FROM "MarketLocale" WHERE marketid = $1::text ORDER BY isdefault DESC, localecode ASC`,
      marketId
    );
    const localeInput = normalizeMarketLocaleInput(req.body || {}, marketRow.code, currentLocales.length);
    if (!localeInput.localeCode) {
      return res.status(400).json({ message: 'localeCode requis (ex. it-IT, fr-BE).' });
    }
    const existing = (currentLocales || []).find((locale) => String(locale.localecode).toLowerCase() === localeInput.localeCode.toLowerCase());
    if (localeInput.isDefault) {
      await prisma.$executeRawUnsafe(
        `UPDATE "MarketLocale" SET isdefault = false, updatedat = NOW() WHERE marketid = $1::text`,
        marketId
      );
    }
    if (existing) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "MarketLocale"
          SET languagecode = $1::text,
              countrycode = $2::text,
              isdefault = $3::boolean,
              isrequiredlaunch = $4::boolean,
              translationmode = $5::text,
              updatedat = NOW()
          WHERE id = $6::text
        `,
        localeInput.languageCode,
        localeInput.countryCode,
        localeInput.isDefault,
        localeInput.isRequiredLaunch,
        localeInput.translationMode,
        existing.id
      );
    } else {
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
        localeInput.localeCode,
        localeInput.languageCode,
        localeInput.countryCode,
        localeInput.isDefault,
        localeInput.isRequiredLaunch,
        localeInput.translationMode
      );
    }
    await syncDestinationsForMarket(accountId, marketId);
    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === marketId);
    res.status(existing ? 200 : 201).json({ market, localeCode: localeInput.localeCode });
  } catch (error) {
    console.error('POST /markets/:marketId/locales error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de l’ajout de la langue du marché' });
  }
});

app.patch('/api/v1/markets/:marketId/locales/:localeId', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour modifier cette langue' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId, localeId } = req.params;
    const localeRows = await prisma.$queryRawUnsafe(
      `
        SELECT ml.*, m.code AS marketcode
        FROM "MarketLocale" ml
        JOIN "Market" m ON m.id = ml.marketid
        WHERE ml.id = $1::text AND ml.marketid = $2::text AND m.accountid = $3::text
        LIMIT 1
      `,
      localeId,
      marketId,
      accountId
    );
    const localeRow = localeRows?.[0];
    if (!localeRow) {
      return res.status(404).json({ message: 'Langue de marché introuvable' });
    }

    const mergedInput = normalizeMarketLocaleInput(
      {
        localeCode: req.body?.localeCode || localeRow.localecode,
        languageCode: req.body?.languageCode || localeRow.languagecode,
        countryCode: req.body?.countryCode || localeRow.countrycode,
        isDefault: req.body?.isDefault === true,
        isRequiredLaunch: req.body?.isRequiredLaunch ?? localeRow.isrequiredlaunch,
        translationMode: req.body?.translationMode || localeRow.translationmode,
      },
      localeRow.marketcode,
      0
    );
    if (mergedInput.isDefault) {
      await prisma.$executeRawUnsafe(
        `UPDATE "MarketLocale" SET isdefault = false, updatedat = NOW() WHERE marketid = $1::text`,
        marketId
      );
    }
    await prisma.$executeRawUnsafe(
      `
        UPDATE "MarketLocale"
        SET localecode = $1::text,
            languagecode = $2::text,
            countrycode = $3::text,
            isdefault = $4::boolean,
            isrequiredlaunch = $5::boolean,
            translationmode = $6::text,
            updatedat = NOW()
        WHERE id = $7::text
      `,
      mergedInput.localeCode,
      mergedInput.languageCode,
      mergedInput.countryCode,
      mergedInput.isDefault,
      mergedInput.isRequiredLaunch,
      mergedInput.translationMode,
      localeId
    );
    await syncDestinationsForMarket(accountId, marketId);
    const markets = await getHydratedMarketsForAccount(accountId);
    res.json({ market: markets.find((entry) => entry.id === marketId) || null });
  } catch (error) {
    console.error('PATCH /markets/:marketId/locales/:localeId error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la langue du marché' });
  }
});

app.post('/api/v1/markets/:marketId/channels', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour modifier les canaux du marché' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId } = req.params;
    const marketRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Market" WHERE id = $1::text AND accountid = $2::text LIMIT 1`,
      marketId,
      accountId
    );
    const marketRow = marketRows?.[0];
    if (!marketRow) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }

    const candidate = normalizeMarketChannelInput(req.body || {}, marketRow.code);
    if (!candidate.platformKey || !MARKET_PLATFORM_OPTIONS.includes(candidate.platformKey)) {
      return res.status(400).json({ message: 'platformKey invalide pour ce marché.' });
    }

    // Quota canaux : un nouveau canal de marché compte dans max_channels au
    // même titre qu'un canal d'export (compteur unifié).
    const existingChannelRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM "MarketChannel" WHERE marketid = $1::text AND platformkey = $2::text LIMIT 1`,
      marketId,
      candidate.platformKey
    );
    const isNewChannel = !existingChannelRows?.[0];
    if (isNewChannel) {
      const currentChannels = await countChannelsForAccount(prisma, accountId);
      const channelLimit = await checkChannelLimit(prisma, accountId, currentChannels);
      if (!channelLimit.allowed) {
        return res.status(403).json({ code: 'PLAN_LIMIT', message: channelLimit.message });
      }
    }

    const platformAccounts = await listPlatformAccountsForAccount(accountId);
    await upsertMarketChannels(marketRow, [candidate], platformAccounts);
    await syncDestinationsForMarket(accountId, marketId);
    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === marketId);
    const channel = market?.channels?.find((entry) => entry.platformKey === candidate.platformKey) || null;
    res.status(201).json({ market, channel });
  } catch (error) {
    console.error('POST /markets/:marketId/channels error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de l’ajout du canal du marché' });
  }
});

app.patch('/api/v1/markets/:marketId/channels/:channelId', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour modifier ce canal' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId, channelId } = req.params;
    const channelRows = await prisma.$queryRawUnsafe(
      `
        SELECT mc.*, m.code AS marketcode
        FROM "MarketChannel" mc
        JOIN "Market" m ON m.id = mc.marketid
        WHERE mc.id = $1::text AND mc.marketid = $2::text AND m.accountid = $3::text
        LIMIT 1
      `,
      channelId,
      marketId,
      accountId
    );
    const channelRow = channelRows?.[0];
    if (!channelRow) {
      return res.status(404).json({ message: 'Canal de marché introuvable' });
    }

    const platformAccounts = await listPlatformAccountsForAccount(accountId);
    const updates = [];
    const params = [];
    let index = 1;
    if (req.body?.platformAccountId !== undefined) {
      updates.push(`platformaccountid = $${index++}::text`);
      params.push(pickPlatformAccountId(platformAccounts, channelRow.platformkey, req.body.platformAccountId));
    }
    if (req.body?.status !== undefined) {
      updates.push(`status = $${index++}::text`);
      params.push(String(req.body.status || '').trim() || channelRow.status);
    }
    if (req.body?.isEnabled !== undefined) {
      updates.push(`isenabled = $${index++}::boolean`);
      params.push(req.body.isEnabled !== false);
    }
    if (req.body?.settingsJson !== undefined || req.body?.settings !== undefined) {
      const settingsJson = {
        ...parseJsonObject(channelRow.settingsjson),
        ...parseJsonObject(req.body.settingsJson || req.body.settings || {}),
      };
      if (normalizePlatformKey(channelRow.platformkey) === 'amazon' && !settingsJson.legacyChannelKey) {
        const legacyChannelKey = inferAmazonChannelKeyForMarket(channelRow.marketcode);
        if (legacyChannelKey) settingsJson.legacyChannelKey = legacyChannelKey;
      }
      updates.push(`settingsjson = $${index++}::jsonb`);
      params.push(JSON.stringify(settingsJson));
    }
    if (updates.length === 0) {
      const markets = await getHydratedMarketsForAccount(accountId);
      return res.json({ market: markets.find((entry) => entry.id === marketId) || null });
    }

    updates.push('updatedat = NOW()');
    params.push(channelId);
    await prisma.$executeRawUnsafe(
      `UPDATE "MarketChannel" SET ${updates.join(', ')} WHERE id = $${index}::text`,
      ...params
    );
    await syncDestinationsForMarket(accountId, marketId);
    const markets = await getHydratedMarketsForAccount(accountId);
    res.json({ market: markets.find((entry) => entry.id === marketId) || null });
  } catch (error) {
    console.error('PATCH /markets/:marketId/channels/:channelId error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de la mise à jour du canal du marché' });
  }
});

app.get('/api/v1/markets/:marketId/readiness', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    await ensureMarketsBackfillForAccount(accountId);
    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === req.params.marketId);
    if (!market) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }
    res.json({ readiness: market.readiness, market });
  } catch (error) {
    console.error('GET /markets/:marketId/readiness error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors du calcul de la readiness du marché' });
  }
});

// GET /api/v1/markets/:marketId/preview?productId=<feedItemId>&localeId=<marketLocaleId>&refresh=1
//
// Renvoie côte à côte le produit source et sa version traduite pour la
// locale par défaut (ou la locale demandée) du marché. Sert au composant
// MarketPreviewPanel côté front. La traduction est mise en cache via la
// table AICache (cf. ai/ai-wrapper.js) — `refresh=1` la bypass.
const { translateProductForMarket } = require('./optimization/market-translation');
app.get('/api/v1/markets/:marketId/preview', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId } = req.params;
    const productId = String(req.query.productId || '').trim();
    const requestedLocaleId = String(req.query.localeId || '').trim();
    const forceRefresh = String(req.query.refresh || '').trim() === '1';

    if (!productId) {
      return res.status(400).json({ message: 'Paramètre productId requis' });
    }

    // 1. Marché + locales + vérification d'ownership.
    await ensureMarketsBackfillForAccount(accountId);
    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === marketId);
    if (!market) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }
    const locales = Array.isArray(market.locales) ? market.locales : [];
    if (locales.length === 0) {
      return res.status(400).json({ message: 'Aucune locale configurée pour ce marché.' });
    }
    const targetLocale = requestedLocaleId
      ? locales.find((entry) => entry.id === requestedLocaleId)
      : (locales.find((entry) => entry.isDefault) || locales[0]);
    if (!targetLocale) {
      return res.status(404).json({ message: 'Locale introuvable pour ce marché.' });
    }

    // 2. Chargement du produit en vérifiant qu'il appartient bien à l'account.
    const productRows = await prisma.$queryRawUnsafe(
      `SELECT i.id, i.title, i.descriptionhtml, i.descriptiontext, i.brand, i.sku, i.imageurl, i.url, i.price, i.currency
       FROM "FeedItem" i
       JOIN "Feed" f ON f.id = i.feedid
       WHERE i.id = $1::text AND f.accountid = $2::text
       LIMIT 1`,
      productId,
      accountId
    );
    if (!productRows || productRows.length === 0) {
      return res.status(404).json({ message: 'Produit introuvable dans votre catalogue.' });
    }
    const row = productRows[0];
    const product = {
      id: row.id,
      title: row.title || '',
      descriptionText: row.descriptiontext || '',
      descriptionHtml: row.descriptionhtml || '',
      brand: row.brand || '',
      sku: row.sku || '',
      imageUrl: row.imageurl || '',
      url: row.url || '',
      price: row.price,
      currency: row.currency || market.defaultCurrencyCode,
    };

    // 3. Appel du service de traduction.
    const result = await translateProductForMarket(prisma, product, targetLocale, { forceRefresh });

    res.json({
      market: { id: market.id, code: market.code, name: market.name },
      locale: {
        id: targetLocale.id,
        localeCode: targetLocale.localeCode,
        languageCode: targetLocale.languageCode,
        countryCode: targetLocale.countryCode,
        translationMode: targetLocale.translationMode,
        isDefault: !!targetLocale.isDefault,
      },
      product: { id: product.id, sku: product.sku, brand: product.brand, imageUrl: product.imageUrl, url: product.url, price: product.price, currency: product.currency },
      source: { title: product.title, descriptionText: product.descriptionText },
      translated: result.translated,
      meta: {
        mode: result.mode,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        cached: result.cached,
        provider: result.provider,
        cost: result.cost,
        tokensUsed: result.tokensUsed,
      },
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('GET /markets/:marketId/preview error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de la prévisualisation du marché.', error: error?.message });
  }
});


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
app.get('/api/v1/ingestion/items/:id/enrichment-analysis', async (req, res) => {
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

// Enrichir un produit automatiquement (optionnel: fields = tableau de clés à appliquer uniquement)
app.post('/api/v1/ingestion/items/:id/enrich', async (req, res) => {
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

// Enrichir tous les produits d'un feed
app.post('/api/v1/ingestion/feeds/:id/enrich-all', async (req, res) => {
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

// Enrichissement en masse amélioré avec IA et historique
app.post('/api/v1/ingestion/feeds/:id/enrich-all-advanced', async (req, res) => {
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

// Statistiques d'enrichissement pour un feed (réponse 200 avec valeurs par défaut si table absente ou erreur)
app.get('/api/v1/ingestion/feeds/:id/enrichment-stats', async (req, res) => {
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

// Resume global du catalogue pour un feed (non pagine)
app.get('/api/v1/ingestion/feeds/:id/catalogue-summary', async (req, res) => {
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

// Historique des enrichissements pour un produit
app.get('/api/v1/ingestion/items/:id/enrichment-history', async (req, res) => {
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

// ----- Révisions (historisation) et retour au flux -----

// Liste des révisions d'un item
app.get('/api/v1/ingestion/items/:id/revisions', async (req, res) => {
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

// Restaurer un item à une révision donnée
app.post('/api/v1/ingestion/items/:id/restore', async (req, res) => {
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

// Revenir aux valeurs du flux (dernière révision source = ingestion)
app.post('/api/v1/ingestion/items/:id/revert-to-feed', async (req, res) => {
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
app.put('/api/v1/ingestion/items/:id', async (req, res) => {
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

// PATCH : préférences de diffusion par canal pour un item (stockées dans customfields._channelOverrides)
app.patch('/api/v1/ingestion/items/:id/channels', async (req, res) => {
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

// PATCH : sauvegarder le contenu optimisé par plateforme (titre, description) pour un item
app.patch('/api/v1/ingestion/items/:id/optimized', async (req, res) => {
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

// Liste de tous les comptes — RÉSERVÉ STAFF FEEDPLUG
app.get('/api/v1/admin/accounts', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Base de données non disponible' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').toString().trim();

    let whereClause = '';
    const params = [];
    let paramIdx = 1;
    if (search) {
      whereClause = `WHERE a.name ILIKE $${paramIdx}::text OR a.email ILIKE $${paramIdx}::text`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    let accountsResult;
    let hasAddonIAColumn = false;
    try {
      const withAddonia = await prisma.$queryRawUnsafe(`
        SELECT 
          a.id, a.name, a.plan, a.email, a.trialendsat, a.addonia, a.createdat, a.updatedat,
          (SELECT COUNT(*)::int FROM "User" u WHERE u.accountid = a.id) as users_count,
          (SELECT COUNT(*)::int FROM "FeedSource" s WHERE s.accountid = a.id) as sources_count,
          (SELECT COUNT(*)::int FROM "Feed" f WHERE f.accountid = a.id) as feeds_count
        FROM "Account" a
        ${whereClause}
        ORDER BY a.createdat DESC
        LIMIT $${paramIdx}::int OFFSET $${paramIdx + 1}::int
      `, ...params, limit, skip);
      accountsResult = withAddonia;
      hasAddonIAColumn = true;
    } catch (err) {
      if (err?.message && /addonia|column.*does not exist/i.test(err.message)) {
        accountsResult = await prisma.$queryRawUnsafe(`
          SELECT 
            a.id, a.name, a.plan, a.email, a.trialendsat, a.createdat, a.updatedat,
            (SELECT COUNT(*)::int FROM "User" u WHERE u.accountid = a.id) as users_count,
            (SELECT COUNT(*)::int FROM "FeedSource" s WHERE s.accountid = a.id) as sources_count,
            (SELECT COUNT(*)::int FROM "Feed" f WHERE f.accountid = a.id) as feeds_count
          FROM "Account" a
          ${whereClause}
          ORDER BY a.createdat DESC
          LIMIT $${paramIdx}::int OFFSET $${paramIdx + 1}::int
        `, ...params, limit, skip);
      } else {
        throw err;
      }
    }

    const [totalResult] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count FROM "Account" a ${whereClause}
      `, ...params)
    ]);

    const total = totalResult[0]?.count || 0;
    const toIso = (d) => (d && (d.toISOString ? d.toISOString() : d)) || null;
    const accounts = (accountsResult || []).map(acc => ({
      id: acc.id,
      name: acc.name,
      plan: acc.plan || 'STARTER',
      email: acc.email,
      trialEndsAt: toIso(acc.trialendsat),
      addonIA: hasAddonIAColumn ? !!acc.addonia : false,
      createdAt: toIso(acc.createdat),
      updatedAt: toIso(acc.updatedat),
      usersCount: acc.users_count ?? 0,
      sourcesCount: acc.sources_count ?? 0,
      feedsCount: acc.feeds_count ?? 0,
    }));

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      accounts,
    });
  } catch (err) {
    console.error('Erreur GET /admin/accounts:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des comptes' });
  }
});

// Modifier le plan et/ou la date de fin d'essai d'un compte — RÉSERVÉ STAFF
const ALLOWED_PLANS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
app.patch('/api/v1/admin/accounts/:accountId', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Base de données non disponible' });
    }
    const { accountId } = req.params;
    const { plan, trialEndsAt, addonIA } = req.body || {};

    const setClauses = [];
    const params = [accountId];
    let paramIdx = 2;
    if (plan !== undefined) {
      if (!ALLOWED_PLANS.includes(plan)) {
        return res.status(400).json({ message: 'Plan invalide. Valeurs autorisées: STARTER, PROFESSIONAL, ENTERPRISE' });
      }
      setClauses.push(`plan = $${paramIdx}::text`);
      params.push(plan);
      paramIdx++;
    }
    if (trialEndsAt !== undefined) {
      setClauses.push(`trialendsat = $${paramIdx}::timestamptz`);
      params.push(trialEndsAt === null || trialEndsAt === '' ? null : new Date(trialEndsAt));
      paramIdx++;
    }
    let addonIASkipped = false;
    if (addonIA !== undefined) {
      setClauses.push(`addonia = $${paramIdx}::boolean`);
      params.push(!!addonIA);
      paramIdx++;
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ message: 'Indiquez au moins plan, trialEndsAt ou addonIA' });
    }
    setClauses.push('updatedat = NOW()');

    const check = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Account" WHERE id = $1::text LIMIT 1`,
      accountId
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ message: 'Compte non trouvé' });
    }

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Account" SET ${setClauses.join(', ')} WHERE id = $1::text`,
        ...params
      );
    } catch (updateErr) {
      if (addonIA !== undefined && updateErr?.message && /addonia|column.*does not exist|42703/i.test(updateErr.message)) {
        addonIASkipped = true;
        const retryClauses = [];
        const retryParams = [accountId];
        let ri = 2;
        if (plan !== undefined) {
          retryClauses.push(`plan = $${ri}::text`);
          retryParams.push(plan);
          ri++;
        }
        if (trialEndsAt !== undefined) {
          retryClauses.push(`trialendsat = $${ri}::timestamptz`);
          retryParams.push(trialEndsAt === null || trialEndsAt === '' ? null : new Date(trialEndsAt));
          ri++;
        }
        if (retryClauses.length === 0) {
          return res.status(400).json({ message: 'Indiquez au moins plan ou trialEndsAt pour enregistrer sans Pack IA' });
        }
        retryClauses.push('updatedat = NOW()');
        retryParams.push(accountId);
        await prisma.$executeRawUnsafe(
          `UPDATE "Account" SET ${retryClauses.join(', ')} WHERE id = $${ri}::text`,
          ...retryParams
        );
      } else {
        throw updateErr;
      }
    }

    let updated;
    try {
      [updated] = await prisma.$queryRawUnsafe(
        `SELECT id, plan, trialendsat, addonia, updatedat FROM "Account" WHERE id = $1::text LIMIT 1`,
        accountId
      );
    } catch (selErr) {
      if (selErr?.message && /addonia|42703/i.test(selErr.message)) {
        [updated] = await prisma.$queryRawUnsafe(
          `SELECT id, plan, trialendsat, updatedat FROM "Account" WHERE id = $1::text LIMIT 1`,
          accountId
        );
        updated.addonia = false;
      } else {
        throw selErr;
      }
    }
    const toIso = (d) => (d && (d.toISOString ? d.toISOString() : d)) || null;
    return res.json({
      message: addonIASkipped ? 'Compte mis à jour. Pack IA non enregistré : exécutez la migration 024 (colonne addonia) en base.' : 'Compte mis à jour',
      account: {
        id: updated.id,
        plan: updated.plan || 'STARTER',
        trialEndsAt: toIso(updated.trialendsat),
        addonIA: !!updated.addonia,
        updatedAt: toIso(updated.updatedat),
      },
    });
  } catch (err) {
    console.error('Erreur PATCH /admin/accounts/:accountId:', err);
    const msg = err?.message || 'Erreur lors de la mise à jour du compte';
    return res.status(500).json({ message: msg });
  }
});

// Endpoint historique désactivé : les migrations runtime ne sont plus autorisées
app.post('/api/v1/admin/apply-addon-ia-migration', authenticateToken, requireStaffAccess, async (req, res) => {
  return res.status(410).json({
    message: 'Les migrations runtime ont été supprimées. Appliquez 024_account_addon_ia.sql hors process.',
  });
});

// Endpoint historique désactivé : les migrations runtime ne sont plus autorisées
app.post('/api/v1/admin/apply-enrichment-migration', authenticateToken, requireStaffAccess, async (req, res) => {
  return res.status(410).json({
    message: 'Les migrations runtime ont été supprimées. Appliquez 008_enrichment_history.sql hors process.',
  });
});

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

// ====== ROUTES MODULAIRES ======
try {
  const { registerAllRoutes } = require('./routes/index');
  const getPrismaReady = () => prismaReady;
  registerAllRoutes(app, prisma, getPrismaReady, {
    EFFECTIVE_JWT_SECRET,
    EFFECTIVE_JWT_REFRESH_SECRET,
    chaos,
    authenticateToken,
    requireStaffAccess,
    verifyFeedAccess,
    verifySourceAccess,
    verifyItemAccess,
    findUserByEmail,
    findUserById,
    issueAuthTokens,
    buildAuthUser,
    hashAuthActionToken,
    canUseFeature,
    getHealthSnapshot: async () => {
      chaos.maybeFailDb();
      let dbOk = false;
      let dbLatencyMs = null;
      if (prismaReady && prisma) {
        const start = Date.now();
        try {
          await withTimeout(prisma.$queryRaw`SELECT 1`, 5000, 'Health DB');
          dbOk = true;
          dbLatencyMs = Date.now() - start;
        } catch (err) {
          console.warn('Health check DB:', err?.message || err);
        }
      }
      return {
        ready: prismaReady && dbOk,
        status: prismaReady && dbOk ? 'OK' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        prismaReady,
        dbOk,
        dbLatencyMs,
      };
    },
  });
  console.log('✅ Routes modulaires enregistrées');
} catch (e) {
  console.warn('Routes modulaires non chargées:', e.message);
}

// ====== ENRICHISSEMENT IA ======

const { optimizeTitleWithAI, optimizeTitlesBatch, calculateTitleScore } = require('./optimization/title-optimizer');
const { optimizeDescriptionWithAI, optimizeDescriptionsBatch, calculateDescriptionScore } = require('./optimization/description-optimizer');
const { generateHighlightsWithAI } = require('./optimization/highlights-generator');
const { optimizeImage, optimizeImagesBatch } = require('./optimization/image-optimizer');
const { generateLifestyleImage, downloadImageAsBase64, PRESET_SCENES } = require('./optimization/lifestyle-image-generator');

// Générer des titres optimisés par IA pour plusieurs items (platform = GMC|META|AMAZON|CHATGPT)
app.post('/api/v1/optimization/titles/generate', authenticateToken, async (req, res) => {
  try {
    const { itemIds, platform } = req.body || {};
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ message: 'itemIds requis (tableau non vide)' });
    }
    const MAX_ITEMS = 50;
    if (itemIds.length > MAX_ITEMS) {
      return res.status(400).json({ message: `Maximum ${MAX_ITEMS} produits par requête` });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.accountId;
    const addonIA = await canUseFeature(prisma, accountId, 'addonIA');
    if (!addonIA.allowed) {
      return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
    }
    // A3 — hard cap texte avant les appels Gemini (1 op = 1 titre / produit).
    const quota = await checkAiQuota(prisma, accountId, 'text', itemIds.length);
    if (!quota.allowed) {
      return res.status(429).json({ code: 'AI_QUOTA', message: quotaMessage(quota), used: quota.used, cap: quota.cap, remaining: quota.remaining, requested: itemIds.length });
    }
    const plat = platform ? String(platform).toUpperCase().replace(/GOOGLE/, 'GMC') : 'GMC';
    const result = {};
    let aiCalls = 0;
    for (const itemId of itemIds) {
      const itemIdStr = String(itemId);
      const resolvedId = await resolveItemId(prisma, itemIdStr, accountId) || itemIdStr;
      const verified = await verifyItemAccess(resolvedId, accountId);
      if (!verified) {
        result[itemIdStr] = '';
        continue;
      }
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "FeedItem" WHERE id = $1::text`, resolvedId);
      if (!rows || rows.length === 0) {
        result[itemIdStr] = '';
        continue;
      }
      const item = rows[0];
      let customFields = {};
      if (item.customfields) {
        try {
          customFields = typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields;
        } catch (e) {
          customFields = {};
        }
      }
      const product = { ...item, customFields };
      try {
        aiCalls++;
        const opt = await optimizeTitleWithAI(prisma, product, { platform: plat, forceRefresh: false });
        result[itemIdStr] = opt.optimizedTitle || item.title || '';
      } catch (err) {
        console.warn('Erreur optimisation titre pour', itemIdStr, err.message);
        result[itemIdStr] = item.title || '';
      }
    }
    // B1 — comptage de la consommation IA (1 op = 1 titre généré).
    if (aiCalls > 0) trackAiUsage(accountId, aiCalls);
    const hasAny = Object.values(result).some((v) => v && String(v).trim());
    if (!hasAny && itemIds.length > 0) {
      result._error = 'Aucun titre optimisé généré. Vérifiez que l\'IA est configurée (clé Gemini) ou réessayez.';
    }
    res.json(result);
  } catch (error) {
    console.error('Erreur optimization/titles/generate:', error);
    res.status(500).json({ message: error.message || 'Erreur génération titres' });
  }
});

// ====== ENRICHISSEMENT IA (routes extraites dans routes/enrichment.js) ======
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

// ====== PERFORMANCE PAR CANAL (historique + purge) ======
// GET /api/v1/performance/dashboard — agrégats par plateforme, top produits, par catégorie (ROAS, coût, revenus)
// Auth mixte : JWT cookie (dashboard standalone via proxy Next) ou session token Shopify (embedded).
app.get('/api/v1/performance/dashboard', async (req, res) => {
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

// ====== PLATEFORMES — Google Merchant Center OAuth2 + Push ======

// 0. Diagnostic OAuth (redirect_uri à ajouter dans la Console Google)
app.get('/api/v1/platforms/gmc/oauth-config', requireAuth, (req, res) => {
  res.json({
    redirectUri: GOOGLE_REDIRECT_URI,
    hint: 'Ajoutez exactement cette URL dans Google Cloud Console → APIs & Services → Identifiants → Client OAuth 2.0 → URI de redirection autorisés',
  });
});

// 1. Générer l'URL d'autorisation OAuth2 GMC
app.get('/api/v1/platforms/gmc/auth-url', authenticateJwtOrShopifySession, async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Connexion Google Merchant Center non configurée.' });
  }
  const scopes = [
    'https://www.googleapis.com/auth/content',         // Content API (produits)
    'https://www.googleapis.com/auth/userinfo.email'    // Email utilisateur
  ];
  const locale = normalizeAppLocale(req.query.locale);
  const embeddedSurface = String(req.query.surface || '').trim().toLowerCase() === 'embedded';
  const returnTo = embeddedSurface
    ? normalizeEmbeddedReturnTo(req.query.returnTo, '/embedded/channels')
    : normalizeDashboardReturnTo(req.query.returnTo, ''); // '' → le callback retombe sur /flux
  const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

  // State CSRF : on stocke le payload en base derrière un UUID opaque au lieu
  // de l'embarquer dans le state OAuth (qui pouvait être forgé par un tiers).
  const stateId = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: stateId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE,
      payload: {
        accountId: req.accountId,
        locale,
        surface: embeddedSurface ? 'embedded' : 'dashboard',
        returnTo,
      },
      ttlMs: 10 * 60 * 1000,
    });
  } catch (stateError) {
    console.error('GMC auth-url state store:', stateError);
    return res.status(503).json({ message: 'Connexion Google Merchant Center temporairement indisponible.' });
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: scopes,
    state: stateId,
  });

  res.json({ authUrl });
});

app.get('/api/v1/marketing/audits/:shareToken/platforms/gmc/auth-url', async (req, res) => {
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    if (!shareToken) {
      return res.status(400).json({ message: 'Token audit manquant' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const rows = await prisma.$queryRawUnsafe(`
      SELECT sharetoken, locale FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1
    `, shareToken);
    if (!rows?.length) {
      return res.status(404).json({ message: 'Audit introuvable' });
    }
    const scopes = [
      'https://www.googleapis.com/auth/content',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
    const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    const stateId = crypto.randomUUID();
    await storeOAuthEphemeralState({
      id: stateId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE,
      payload: { auditShareToken: shareToken, locale: rows[0].locale || 'fr', mode: 'marketing_audit_gmc' },
      ttlMs: 10 * 60 * 1000,
    });
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent select_account',
      scope: scopes,
      state: stateId,
    });
    res.json({ authUrl });
  } catch (error) {
    console.error('Marketing audit GMC auth-url error:', error);
    res.status(500).json({ message: 'Erreur generation URL GMC' });
  }
});

// 2. Callback OAuth2 — échangez le code contre des tokens
app.get('/api/v1/platforms/gmc/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const appUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');

    if (!code) {
      return res.redirect(buildFluxRedirectUrl(appUrl, 'fr', { gmc: 'error', message: 'Code OAuth Google manquant.' }));
    }

    let accountId;
    let auditShareToken;
    let auditLocale = 'fr';
    let dashboardLocale = 'fr';
    let embeddedSurface = false;
    let embeddedReturnTo = '/embedded/channels';
    // On récupère le payload via l'UUID opaque stocké côté serveur — il a été
    // émis par nous, à usage unique, et expire en 10 min (CSRF guard).
    let stateData;
    try {
      stateData = await consumeOAuthEphemeralState({
        id: String(state || ''),
        provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
        flow: OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE,
      });
    } catch (stateError) {
      console.error('GMC callback state lookup:', stateError);
      return res.redirect(buildFluxRedirectUrl(appUrl, 'fr', { gmc: 'error', message: 'Etat OAuth Google invalide.' }));
    }
    if (!stateData) {
      return res.redirect(buildFluxRedirectUrl(appUrl, 'fr', { gmc: 'error', message: 'Etat OAuth Google invalide ou expiré.' }));
    }
    accountId = stateData.accountId;
    auditShareToken = stateData.auditShareToken;
    auditLocale = normalizeAppLocale(stateData.locale || 'fr');
    dashboardLocale = normalizeAppLocale(stateData.locale || 'fr');
    embeddedSurface = stateData.surface === 'embedded';
    embeddedReturnTo = normalizeEmbeddedReturnTo(stateData.returnTo, '/embedded/channels');

    if (!accountId && !auditShareToken) {
      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: buildFluxRedirectUrl(appUrl, dashboardLocale, {
            gmc: 'error',
            message: 'Compte FeedPlug manquant pour la connexion GMC.',
          }),
          params: {
            gmc: 'error',
            message: 'Compte FeedPlug manquant pour la connexion GMC.',
          },
        }));
      }
      return res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, buildLocalizedAppUrl(appUrl, dashboardLocale, '/flux'), {
        gmc: 'error',
        message: 'Compte FeedPlug manquant pour la connexion GMC.',
      }));
    }
    
    const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    
    // Échanger le code contre des tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Récupérer l'email de l'utilisateur Google
    let email = '';
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        email = userInfo.email || '';
      }
    } catch {}
    
    // Récupérer les comptes Merchant Center disponibles
    let merchantName = '';
    let merchantOptions = [];
    try {
      const accountsRes = await fetch('https://shoppingcontent.googleapis.com/content/v2.1/accounts/authinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        merchantOptions = parseGmcMerchantOptions(accountsData);
        if (merchantOptions.length > 0) {
          merchantName = merchantOptions[0].merchantName || '';
        }
      }
    } catch (e) {
      console.warn('Erreur récupération comptes MC:', e.message);
    }

    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
    const encryptedAccessToken = tokens.access_token ? encryptSecret(tokens.access_token) : null;
    const encryptedRefreshToken = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null;
    const selectedMerchant = merchantOptions[0] || null;

    if (!selectedMerchant?.merchantId) {
      if (auditShareToken) {
        return res.redirect(`${appUrl}/${auditLocale}/audit-flux/${auditShareToken}?error=no_merchant_account`);
      }
      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: buildFluxRedirectUrl(appUrl, dashboardLocale, {
            gmc: 'error',
            message: 'Aucun Merchant Center accessible n’a ete trouve pour ce compte Google.',
          }),
          params: {
            gmc: 'error',
            message: 'Aucun Merchant Center accessible n’a ete trouve pour ce compte Google.',
          },
        }));
      }
      return res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, buildLocalizedAppUrl(appUrl, dashboardLocale, '/flux'), {
        gmc: 'error',
        message: 'Aucun Merchant Center accessible n’a ete trouve pour ce compte Google.',
      }));
    }

    if (accountId && merchantOptions.length > 1) {
      const selectionId = crypto.randomUUID();
      await storeOAuthEphemeralState({
        id: selectionId,
        provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
        flow: OAUTH_EPHEMERAL_FLOW_GMC_SELECTION,
        payload: {
          accountId,
          locale: dashboardLocale,
          email,
          merchants: merchantOptions,
          tokenExpiry: expiry,
          encryptedAccessToken,
          encryptedRefreshToken,
          scope: tokens.scope || '',
        },
        ttlMs: GMC_SELECTION_TTL_MS,
      });

      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: buildFluxRedirectUrl(appUrl, dashboardLocale, {
            gmc: 'select',
            selection: selectionId,
          }),
          params: {
            gmc: 'select',
            selection: selectionId,
          },
        }));
      }

      return res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, buildLocalizedAppUrl(appUrl, dashboardLocale, '/flux'), {
        gmc: 'select',
        selection: selectionId,
      }));
    }
    
    // Sauvegarder la connexion en base
    if (prismaReady && prisma && accountId) {
      await saveGmcConnection({
        accountId,
        merchant: selectedMerchant,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiry: expiry,
        email,
        scope: tokens.scope || '',
      });
      // Premier push immédiat : le marchand attend de voir ses produits dans
      // Merchant Center dès la connexion, sans passer par la page Flux.
      scheduleAutoGmcPush(accountId, null, 'connexion GMC', 0);
    }
    
    if (prismaReady && prisma && auditShareToken) {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1`, auditShareToken);
      if (rows?.length) {
        const audit = rows[0];
        const input = decryptObjectSecrets(typeof audit.inputjson === 'string' ? JSON.parse(audit.inputjson || '{}') : (audit.inputjson || {}));
        input.gmcConnection = {
          merchantId: selectedMerchant.merchantId || null,
          email,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiry: expiry,
          connectedAt: new Date().toISOString(),
          merchantName: selectedMerchant.merchantName || merchantName || '',
        };
        await prisma.$executeRawUnsafe(`
          UPDATE marketing_audits
          SET merchantid = COALESCE($1::text, merchantid),
              connectortype = 'GMC',
              inputjson = $2::jsonb,
              status = 'source_connected',
              "updatedAt" = NOW()
          WHERE sharetoken = $3::text
        `, selectedMerchant.merchantId || null, stringifyEncryptedJson(input), auditShareToken);
      }
      return res.redirect(`${appUrl}/${auditLocale}/audit-flux/${auditShareToken}?gmc=connected`);
    }

    // Rediriger vers le frontend avec succès (APP_URL pour multi-env)
    if (embeddedSurface) {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId,
        returnTo: embeddedReturnTo,
        fallbackUrl: buildFluxRedirectUrl(appUrl, dashboardLocale, {
          gmc: 'connected',
          merchant: selectedMerchant.merchantId || '',
        }),
        params: {
          gmc: 'connected',
          merchant: selectedMerchant.merchantId || '',
        },
      }));
    }

    res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, buildLocalizedAppUrl(appUrl, dashboardLocale, '/flux'), {
      gmc: 'connected',
      merchant: selectedMerchant.merchantId || '',
    }));
  } catch (error) {
    console.error('GMC OAuth callback error:', error);
    const appUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');
    res.redirect(buildFluxRedirectUrl(appUrl, 'fr', {
      gmc: 'error',
      message: error.message || 'Connexion Google Merchant Center impossible.',
    }));
  }
});

// 3. Statut de la connexion GMC
app.get('/api/v1/platforms/gmc/status', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.json({ connected: false });
    }
    
    const connections = await prisma.$queryRawUnsafe(`
      SELECT * FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'gmc'
    `, req.accountId);
    
    if (!connections || connections.length === 0) {
      return res.json({ connected: false });
    }
    
    const conn = connections[0];
    const isExpired = conn.tokenexpiry && new Date(conn.tokenexpiry) < new Date();
    const metadata = parseJsonObject(conn.metadata);
    
    res.json({
      connected: conn.status === 'active',
      merchantId: conn.merchantid,
      merchantName: metadata.merchantName || '',
      email: conn.email,
      tokenExpired: isExpired,
      connectedAt: conn.createdat
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

// 4. Déconnecter GMC
app.delete('/api/v1/platforms/gmc/disconnect', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (prismaReady && prisma) {
      const connections = await prisma.$queryRawUnsafe(`
        SELECT accesstoken, refreshtoken
        FROM "PlatformConnection"
        WHERE accountid = $1::text AND platform = 'gmc'
        LIMIT 1
      `, req.accountId);

      if (connections?.length) {
        await revokeGoogleOAuthToken(
          decryptSecret(connections[0].refreshtoken) || decryptSecret(connections[0].accesstoken)
        );
      }

      await prisma.$executeRawUnsafe(`
        DELETE FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'gmc'
      `, req.accountId);
    }
    res.json({ disconnected: true, message: 'Google Merchant Center déconnecté' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/v1/platforms/gmc/selection/:selectionId', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const selectionId = String(req.params.selectionId || '').trim();
    if (!selectionId) {
      return res.status(400).json({ message: 'Selection GMC manquante.' });
    }

    const payload = await readOAuthEphemeralState({
      id: selectionId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GMC_SELECTION,
    });

    if (!payload || payload.accountId !== req.accountId) {
      return res.status(404).json({ message: 'Cette selection GMC a expire ou n’est plus disponible.' });
    }

    res.json({
      selectionId,
      email: payload.email || '',
      merchants: Array.isArray(payload.merchants) ? payload.merchants : [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Impossible de charger la selection GMC.' });
  }
});

app.post('/api/v1/platforms/gmc/select-merchant', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const selectionId = String(req.body?.selectionId || '').trim();
    const merchantId = String(req.body?.merchantId || '').trim();

    if (!selectionId || !merchantId) {
      return res.status(400).json({ message: 'selectionId et merchantId sont requis.' });
    }

    const payload = await readOAuthEphemeralState({
      id: selectionId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GMC_SELECTION,
    });

    if (!payload || payload.accountId !== req.accountId) {
      return res.status(404).json({ message: 'Cette selection GMC a expire ou n’est plus disponible.' });
    }

    const merchants = Array.isArray(payload.merchants) ? payload.merchants : [];
    const selectedMerchant = merchants.find((entry) => String(entry?.merchantId || '') === merchantId);
    if (!selectedMerchant) {
      return res.status(400).json({ message: 'Merchant Center introuvable dans cette selection.' });
    }

    await saveGmcConnection({
      accountId: req.accountId,
      merchant: selectedMerchant,
      encryptedAccessToken: payload.encryptedAccessToken || null,
      encryptedRefreshToken: payload.encryptedRefreshToken || null,
      tokenExpiry: payload.tokenExpiry || null,
      email: payload.email || '',
      scope: payload.scope || '',
    });

    await consumeOAuthEphemeralState({
      id: selectionId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GMC_SELECTION,
    });

    // Premier push immédiat après le choix du compte Merchant Center.
    scheduleAutoGmcPush(req.accountId, null, 'connexion GMC', 0);

    res.json({
      connected: true,
      merchantId: selectedMerchant.merchantId,
      merchantName: selectedMerchant.merchantName || '',
      email: payload.email || '',
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Impossible de finaliser la connexion GMC.' });
  }
});

// ===== GOOGLE ADS — Connexion OAuth2 pour sync performance (shopping_performance_view) =====
app.get('/api/v1/platforms/google-ads/auth-url', authenticateJwtOrShopifySession, async (req, res) => {
  if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Connexion Google Ads non configurée (GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET).' });
  }
  const scopes = ['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/userinfo.email'];
  const oauth2Client = new OAuth2Client(GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REDIRECT_URI);
  const embeddedSurface = String(req.query.surface || '').trim().toLowerCase() === 'embedded';
  const returnTo = embeddedSurface
    ? normalizeEmbeddedReturnTo(req.query.returnTo, '/embedded/channels')
    : normalizeDashboardReturnTo(req.query.returnTo, ''); // '' → le callback retombe sur /performance
  const stateId = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: stateId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GOOGLE_ADS_OAUTH_STATE,
      payload: {
        accountId: req.accountId,
        platform: 'google_ads',
        surface: embeddedSurface ? 'embedded' : 'dashboard',
        returnTo,
      },
      ttlMs: 10 * 60 * 1000,
    });
  } catch (stateError) {
    console.error('Google Ads auth-url state store:', stateError);
    return res.status(503).json({ message: 'Connexion Google Ads temporairement indisponible.' });
  }
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: stateId,
  });
  res.json({ authUrl });
});

app.get('/api/v1/platforms/google-ads/callback', async (req, res) => {
  const appUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');
  const performanceRedirect = `${appUrl}/performance`;
  let stateData = null;
  try {
    const { code, state } = req.query;
    if (!code) return res.redirect(`${performanceRedirect}?error=no_code`);
    try {
      stateData = await consumeOAuthEphemeralState({
        id: String(state || ''),
        provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
        flow: OAUTH_EPHEMERAL_FLOW_GOOGLE_ADS_OAUTH_STATE,
      });
    } catch (stateError) {
      console.error('Google Ads callback state lookup:', stateError);
      return res.redirect(`${performanceRedirect}?error=invalid_state`);
    }
    if (!stateData) {
      return res.redirect(`${performanceRedirect}?error=invalid_state`);
    }
    const accountId = stateData.accountId;
    const embeddedSurface = stateData.surface === 'embedded';
    const embeddedReturnTo = normalizeEmbeddedReturnTo(stateData.returnTo, '/embedded/channels');
    if (!accountId || !GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET) {
      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: `${performanceRedirect}?error=config`,
          params: { google_ads: 'error', message: 'Configuration Google Ads manquante.' },
        }));
      }
      return res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, performanceRedirect, {
        google_ads: 'error',
        error: 'config',
        message: 'Configuration Google Ads manquante.',
      }));
    }
    const oauth2Client = new OAuth2Client(GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REDIRECT_URI);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    let email = '';
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        email = userInfo.email || '';
      }
    } catch {}
    let customerId = null;
    try {
      const listRes = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      if (listRes.ok) {
        const data = await listRes.json();
        if (data.resourceNames && data.resourceNames.length > 0) {
          const r = data.resourceNames[0];
          customerId = r.replace(/^customers\//, '');
        }
      }
    } catch (e) {
      console.warn('List accessible customers Google Ads:', e.message);
    }
    if (prismaReady && prisma) {
      const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
      await upsertPlatformConnection({
        accountId,
        platform: 'google_ads',
        merchantId: customerId || '',
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
        tokenExpiry: expiry,
        email,
        status: 'active',
        metadata: {},
      });
    }
    if (embeddedSurface) {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId,
        returnTo: embeddedReturnTo,
        fallbackUrl: `${performanceRedirect}?google_ads=connected&customer=${customerId || ''}`,
        params: { google_ads: 'connected', customer: customerId || '' },
      }));
    }

    res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, performanceRedirect, {
      google_ads: 'connected',
      customer: customerId || '',
    }));
  } catch (error) {
    console.error('Google Ads OAuth callback error:', error);
    if (stateData?.surface === 'embedded') {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId: stateData.accountId,
        returnTo: normalizeEmbeddedReturnTo(stateData.returnTo, '/embedded/channels'),
        fallbackUrl: `${appUrl}/performance?error=oauth_failed&message=${encodeURIComponent(error.message)}`,
        params: { google_ads: 'error', message: error.message || 'Connexion Google Ads impossible.' },
      }));
    }
    res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData?.returnTo, performanceRedirect, {
      google_ads: 'error',
      error: 'oauth_failed',
      message: error.message || 'Connexion Google Ads impossible.',
    }));
  }
});

app.get('/api/v1/platforms/google-ads/status', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) return res.json({ connected: false });
    const connections = await prisma.$queryRawUnsafe(
      `SELECT merchantid, email, status, createdat FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'google_ads'`,
      req.accountId
    );
    if (!connections || connections.length === 0) return res.json({ connected: false });
    const conn = connections[0];
    res.json({
      connected: conn.status === 'active',
      customerId: conn.merchantid,
      email: conn.email,
      connectedAt: conn.createdat
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

app.delete('/api/v1/platforms/google-ads/disconnect', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (prismaReady && prisma) {
      await prisma.$executeRawUnsafe(`DELETE FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'google_ads'`, req.accountId);
    }
    res.json({ message: 'Google Ads déconnecté' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== AMAZON — Canaux (FR, UK, DE, IT, ES) + Export =====
// 1. Liste des canaux Amazon du compte
app.get('/api/v1/platforms/amazon/channels', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.json({ channels: [] });
    }
    const channels = await prisma.$queryRawUnsafe(`
      SELECT id, platform, channelkey, label, config, isactive, createdat
      FROM "ExportChannel"
      WHERE accountid = $1::text AND platform = 'amazon' AND isactive = true
      ORDER BY channelkey
    `, req.accountId);
    res.json({ channels: channels || [] });
  } catch (error) {
    console.error('Amazon channels list error:', error);
    res.status(500).json({ message: error.message, channels: [] });
  }
});

// 2. Créer un canal Amazon (amazon_fr, amazon_uk, amazon_de, amazon_it, amazon_es)
app.post('/api/v1/platforms/amazon/channels', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const { channelKey } = req.body || {};
    const key = (channelKey || '').toLowerCase();
    if (!AMAZON_CHANNEL_CONFIG[key]) {
      return res.status(400).json({
        message: 'Canal invalide. Utilisez channelKey: amazon_fr, amazon_uk, amazon_de, amazon_it ou amazon_es'
      });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const currentChannels = await countChannelsForAccount(prisma, req.accountId);
    const channelLimit = await checkChannelLimit(prisma, req.accountId, currentChannels);
    if (!channelLimit.allowed) {
      return res.status(403).json({ code: 'PLAN_LIMIT', message: channelLimit.message });
    }
    const config = AMAZON_CHANNEL_CONFIG[key];
    const channelId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "ExportChannel" (id, accountid, platform, channelkey, label, config, isactive, createdat, updatedat)
      VALUES ($1::text, $2::text, 'amazon', $3::text, $4::text, $5::jsonb, true, NOW(), NOW())
      ON CONFLICT (accountid, platform, channelkey) DO UPDATE SET
        label = $4::text,
        config = $5::jsonb,
        isactive = true,
        updatedat = NOW()
    `, channelId, req.accountId, key, config.label, JSON.stringify(config));
    const [created] = await prisma.$queryRawUnsafe(`
      SELECT id, platform, channelkey, label, config, isactive, createdat
      FROM "ExportChannel"
      WHERE accountid = $1::text AND platform = 'amazon' AND channelkey = $2::text
    `, req.accountId, key);
    res.status(201).json(created || { channelKey: key, label: config.label });
  } catch (error) {
    console.error('Amazon channel create error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 3. Supprimer (désactiver) un canal Amazon
app.delete('/api/v1/platforms/amazon/channels/:channelKey', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const key = (req.params.channelKey || '').toLowerCase();
    if (!AMAZON_CHANNEL_CONFIG[key]) {
      return res.status(400).json({ message: 'Canal invalide' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    await prisma.$executeRawUnsafe(`
      UPDATE "ExportChannel" SET isactive = false, updatedat = NOW()
      WHERE accountid = $1::text AND platform = 'amazon' AND channelkey = $2::text
    `, req.accountId, key);
    res.json({ message: `Canal ${key} désactivé` });
  } catch (error) {
    console.error('Amazon channel delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 4. Canaux disponibles (référence, sans compte)
app.get('/api/v1/platforms/amazon/channels/available', (_req, res) => {
  res.json({
    channels: Object.entries(AMAZON_CHANNEL_CONFIG).map(([k, v]) => ({
      channelKey: k,
      label: v.label,
      marketplaceId: v.marketplaceId,
      currency: v.currency,
      countryCode: v.countryCode
    }))
  });
});

// ===== GOOGLE LOCAL INVENTORY ADS (LIA) — Magasins + inventaire par magasin =====
// 1. Liste des magasins actifs du compte
app.get('/api/v1/platforms/lia/stores', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.json({ stores: [] });
    }
    const stores = await prisma.$queryRawUnsafe(`
      SELECT id, storecode AS "storeCode", name, address, isactive AS "isActive", createdat AS "createdAt"
      FROM "StoreLocation"
      WHERE accountid = $1::text AND isactive = true
      ORDER BY storecode
    `, req.accountId);
    res.json({ stores: stores || [] });
  } catch (error) {
    console.error('LIA stores list error:', error);
    res.status(500).json({ message: error.message, stores: [] });
  }
});

// 2. Créer / mettre à jour un magasin (storeCode = code magasin Google Business Profile)
app.post('/api/v1/platforms/lia/stores', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const { validateStoreInput } = require('./lib/local-inventory');
    const validation = validateStoreInput(req.body || {});
    if (!validation.ok) {
      return res.status(400).json({ message: validation.error });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const { storeCode, name, address } = validation.value;
    const storeId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "StoreLocation" (id, accountid, storecode, name, address, isactive, createdat, updatedat)
      VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, true, NOW(), NOW())
      ON CONFLICT (accountid, storecode) DO UPDATE SET
        name = $4::text,
        address = $5::text,
        isactive = true,
        updatedat = NOW()
    `, storeId, req.accountId, storeCode, name, address);
    const [created] = await prisma.$queryRawUnsafe(`
      SELECT id, storecode AS "storeCode", name, address, isactive AS "isActive", createdat AS "createdAt"
      FROM "StoreLocation"
      WHERE accountid = $1::text AND storecode = $2::text
    `, req.accountId, storeCode);
    res.status(201).json(created || { storeCode, name, address });
  } catch (error) {
    console.error('LIA store create error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 3. Supprimer (désactiver) un magasin
app.delete('/api/v1/platforms/lia/stores/:storeCode', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const { normalizeStoreCode } = require('./lib/local-inventory');
    const storeCode = normalizeStoreCode(req.params.storeCode);
    if (!storeCode) {
      return res.status(400).json({ message: 'Code magasin invalide' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    await prisma.$executeRawUnsafe(`
      UPDATE "StoreLocation" SET isactive = false, updatedat = NOW()
      WHERE accountid = $1::text AND storecode = $2::text
    `, req.accountId, storeCode);
    res.json({ message: `Magasin ${storeCode} désactivé` });
  } catch (error) {
    console.error('LIA store delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 4. Inventaire par magasin — lecture (filtre optionnel ?storeCode=)
app.get('/api/v1/platforms/lia/inventory', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.json({ inventory: [] });
    }
    const { normalizeStoreCode } = require('./lib/local-inventory');
    const requestedStoreCode = req.query.storeCode ? normalizeStoreCode(req.query.storeCode) : null;
    if (req.query.storeCode && !requestedStoreCode) {
      return res.status(400).json({ message: 'Code magasin invalide' });
    }
    const limit = Math.min(parseInt(req.query.limit) || 1000, 5000);
    const params = [req.accountId];
    let where = 'accountid = $1::text';
    if (requestedStoreCode) {
      params.push(requestedStoreCode);
      where += ' AND storecode = $2::text';
    }
    params.push(limit);
    const inventory = await prisma.$queryRawUnsafe(`
      SELECT storecode AS "storeCode", offerid AS "offerId", quantity, availability,
             price, saleprice AS "salePrice", pickupmethod AS "pickupMethod", pickupsla AS "pickupSla",
             updatedat AS "updatedAt"
      FROM "LocalInventory"
      WHERE ${where}
      ORDER BY storecode, offerid
      LIMIT $${params.length}::int
    `, ...params);
    res.json({ inventory: inventory || [] });
  } catch (error) {
    console.error('LIA inventory list error:', error);
    res.status(500).json({ message: error.message, inventory: [] });
  }
});

// 5. Inventaire par magasin — upsert en masse { rows: [{ storeCode, offerId, quantity, ... }] }
app.post('/api/v1/platforms/lia/inventory', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const { validateInventoryRows } = require('./lib/local-inventory');
    const validation = validateInventoryRows(req.body?.rows);
    if (!validation.ok) {
      return res.status(400).json({ message: 'Lignes d\'inventaire invalides', errors: validation.errors.slice(0, 20) });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    // Les codes magasins référencés doivent exister (et être actifs) sur le compte
    const stores = await prisma.$queryRawUnsafe(`
      SELECT storecode FROM "StoreLocation" WHERE accountid = $1::text AND isactive = true
    `, req.accountId);
    const knownStores = new Set((stores || []).map(s => s.storecode));
    const unknown = [...new Set(validation.rows.map(r => r.storeCode).filter(code => !knownStores.has(code)))];
    if (unknown.length > 0) {
      return res.status(400).json({ message: `Magasins inconnus : ${unknown.slice(0, 10).join(', ')}. Créez-les d'abord.` });
    }
    const CHUNK = 500;
    for (let offset = 0; offset < validation.rows.length; offset += CHUNK) {
      const chunk = validation.rows.slice(offset, offset + CHUNK);
      const values = [];
      const params = [req.accountId];
      for (const row of chunk) {
        const base = params.length;
        params.push(crypto.randomUUID(), row.storeCode, row.offerId, row.quantity, row.availability, row.price, row.salePrice, row.pickupMethod, row.pickupSla);
        values.push(`($${base + 1}::text, $1::text, $${base + 2}::text, $${base + 3}::text, $${base + 4}::int, $${base + 5}::text, $${base + 6}::numeric, $${base + 7}::numeric, $${base + 8}::text, $${base + 9}::text, NOW(), NOW())`);
      }
      await prisma.$executeRawUnsafe(`
        INSERT INTO "LocalInventory" (id, accountid, storecode, offerid, quantity, availability, price, saleprice, pickupmethod, pickupsla, createdat, updatedat)
        VALUES ${values.join(', ')}
        ON CONFLICT (accountid, storecode, offerid) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          availability = EXCLUDED.availability,
          price = EXCLUDED.price,
          saleprice = EXCLUDED.saleprice,
          pickupmethod = EXCLUDED.pickupmethod,
          pickupsla = EXCLUDED.pickupsla,
          updatedat = NOW()
      `, ...params);
    }
    res.json({ message: `${validation.rows.length} ligne(s) d'inventaire enregistrée(s)`, upserted: validation.rows.length });
  } catch (error) {
    console.error('LIA inventory upsert error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 7. URL publique du flux LIA pour configuration Google Merchant Center.
// Retourne l'URL d'export prête à coller dans GMC (Feeds → Add primary feed).
// Une URL globale + une URL par store actif (au cas où le merchant configure
// un flux par magasin dans GMC).
app.get('/api/v1/platforms/lia/feed-url', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const feedRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Feed" WHERE accountid = $1::text AND status = 'ACTIVE'::text ORDER BY createdat ASC LIMIT 1`,
      req.accountId
    );
    const feedId = feedRows?.[0]?.id;
    if (!feedId) {
      return res.status(404).json({
        message: 'Aucun flux actif sur ce compte. Synchronisez d\'abord votre catalogue.',
      });
    }
    const stores = await prisma.$queryRawUnsafe(
      `SELECT storecode AS "storeCode" FROM "StoreLocation" WHERE accountid = $1::text AND isactive = true ORDER BY storecode`,
      req.accountId
    );
    const apiBase = (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const globalUrl = `${apiBase}/api/v1/ingestion/feeds/${encodeURIComponent(feedId)}/export?platform=lia&format=csv`;
    const perStoreUrls = (stores || []).map((s) => ({
      storeCode: s.storeCode,
      url: `${globalUrl}&storeCode=${encodeURIComponent(s.storeCode)}`,
    }));
    return res.json({
      feedId,
      globalUrl,
      perStoreUrls,
      stores: stores?.length || 0,
    });
  } catch (error) {
    console.error('LIA feed-url error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 6. Inventaire par magasin — DELETE unitaire (1 store × 1 offre)
app.delete('/api/v1/platforms/lia/inventory/:storeCode/:offerId', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const { normalizeStoreCode } = require('./lib/local-inventory');
    const storeCode = normalizeStoreCode(req.params.storeCode);
    if (!storeCode) {
      return res.status(400).json({ message: 'Code magasin invalide' });
    }
    const offerId = String(req.params.offerId || '').trim();
    if (!offerId) {
      return res.status(400).json({ message: 'offerId manquant' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    await prisma.$executeRawUnsafe(`
      DELETE FROM "LocalInventory"
      WHERE accountid = $1::text AND storecode = $2::text AND offerid = $3::text
    `, req.accountId, storeCode, offerId);
    res.json({ message: `Ligne d'inventaire supprimée (${storeCode} × ${offerId})` });
  } catch (error) {
    console.error('LIA inventory delete error:', error);
    res.status(500).json({ message: error.message });
  }
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

// 8. Emplacements Shopify du marchand + mapping actuel vers les magasins LIA.
app.get('/api/v1/platforms/lia/shopify/locations', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const access = await getShopifyAdminAccessForAccount(req.accountId);
    if (!access) {
      return res.status(404).json({ message: 'Aucune boutique Shopify connectée à ce compte.' });
    }
    const data = await shopifyAdminGraphql({
      ...access,
      query: `
        query LiaLocations {
          locations(first: 50, includeInactive: false) {
            edges { node { id name fulfillsOnlineOrders address { formatted } } }
          }
        }
      `,
    });
    const mappings = await prisma.$queryRawUnsafe(
      `SELECT storecode, shopifylocationid FROM "StoreLocation" WHERE accountid = $1::text AND isactive = true AND shopifylocationid IS NOT NULL`,
      req.accountId
    );
    const storeCodeByLocation = new Map((mappings || []).map((m) => [m.shopifylocationid, m.storecode]));
    const locations = (data?.locations?.edges || []).map(({ node }) => ({
      id: node.id,
      name: node.name || '',
      address: Array.isArray(node.address?.formatted) ? node.address.formatted.join(', ') : '',
      fulfillsOnlineOrders: node.fulfillsOnlineOrders === true,
      storeCode: storeCodeByLocation.get(node.id) || null,
    }));
    res.json({ locations });
  } catch (error) {
    if (error?.scopeMissing) return respondLiaScopeMissing(res);
    console.error('LIA shopify locations error:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

// 9. Lier un emplacement Shopify à un code magasin Google Business Profile.
app.post('/api/v1/platforms/lia/shopify/locations/link', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const { validateStoreInput } = require('./lib/local-inventory');
    const locationId = String(req.body?.locationId || '').trim();
    if (!/^gid:\/\/shopify\/Location\/\d+$/.test(locationId)) {
      return res.status(400).json({ message: 'locationId Shopify invalide.' });
    }
    const validation = validateStoreInput(req.body || {});
    if (!validation.ok) {
      return res.status(400).json({ message: validation.error });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const { storeCode, name, address } = validation.value;
    // Un emplacement Shopify ne peut alimenter qu'un seul magasin LIA :
    // on détache l'éventuel mapping précédent avant l'upsert.
    await prisma.$executeRawUnsafe(
      `UPDATE "StoreLocation" SET shopifylocationid = NULL, updatedat = NOW() WHERE accountid = $1::text AND shopifylocationid = $2::text AND storecode <> $3::text`,
      req.accountId, locationId, storeCode
    );
    await prisma.$executeRawUnsafe(`
      INSERT INTO "StoreLocation" (id, accountid, storecode, name, address, shopifylocationid, isactive, createdat, updatedat)
      VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, true, NOW(), NOW())
      ON CONFLICT (accountid, storecode) DO UPDATE SET
        name = COALESCE($4::text, "StoreLocation".name),
        address = COALESCE($5::text, "StoreLocation".address),
        shopifylocationid = $6::text,
        isactive = true,
        updatedat = NOW()
    `, crypto.randomUUID(), req.accountId, storeCode, name, address, locationId);
    res.status(201).json({ storeCode, locationId });
  } catch (error) {
    console.error('LIA shopify link error:', error);
    res.status(500).json({ message: error.message });
  }
});

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
// Sprint 2 : signature publique inchangée. Délègue à enqueueJob.
function scheduleAutoLiaSync(accountId, reason, delayMs = AUTO_GMC_PUSH_DEBOUNCE_MS) {
  if (!accountId) return;
  enqueueBackgroundJob(
    JOB_TYPES.AUTO_LIA_SYNC,
    { accountId, reason },
    { dedupKey: `${accountId}`, scheduleDelayMs: Math.max(0, delayMs), dedupWindowMs: AUTO_GMC_PUSH_DEBOUNCE_MS }
  ).catch((err) => console.warn(`⚠️ enqueue auto_lia_sync échoué (${reason}):`, err?.message || err));
}

// Handler idempotent de la sync LIA. No-op si aucun emplacement lié.
async function runAutoLiaSync({ accountId, reason }) {
  if (!accountId) return;
  try {
    const result = await executeLiaShopifySync(accountId);
    if (result.synced > 0) {
      console.log(`🏬 Sync LIA auto (${reason}) : ${result.synced} lignes de stock sur ${result.stores} magasin(s)`);
    }
  } catch (err) {
    console.warn(`⚠️ Sync LIA auto (${reason}) échouée pour account ${accountId}:`, err?.message || err);
  }
}

// 10. Sync manuelle du stock POS → inventaire LIA.
app.post('/api/v1/platforms/lia/shopify/sync', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const result = await executeLiaShopifySync(req.accountId);
    res.json({
      message: result.stores === 0
        ? 'Aucun emplacement Shopify lié à un magasin. Liez vos emplacements d\'abord.'
        : `${result.synced} ligne(s) de stock synchronisée(s) depuis ${result.stores} emplacement(s) Shopify`,
      ...result,
    });
  } catch (error) {
    if (error?.scopeMissing) return respondLiaScopeMissing(res);
    console.error('LIA shopify sync error:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

// 5. Connexion Amazon — auth-url pour OAuth LWA
app.get('/api/v1/platforms/amazon/auth-url', authenticateJwtOrShopifySession, async (req, res) => {
  if (!AMAZON_APPLICATION_ID || !AMAZON_REDIRECT_URI || !AMAZON_LOGIN_URI) {
    // État normal (Amazon SP-API pas encore activé), pas une erreur
    // serveur : 200 + configured:false. Cf /connect-init pour la raison.
    return res.status(200).json({
      message: 'Amazon OAuth non configuré',
      configured: false
    });
  }
  const embeddedSurface = String(req.query.surface || '').trim().toLowerCase() === 'embedded';
  const returnTo = normalizeEmbeddedReturnTo(req.query.returnTo, '/embedded/channels');
  const state = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: state,
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_STATE,
      payload: {
        accountId: req.accountId,
        surface: embeddedSurface ? 'embedded' : 'dashboard',
        returnTo,
      },
      ttlMs: AMAZON_STATE_TTL_MS,
    });
  } catch (error) {
    console.error('Amazon auth-url state persistence error:', error);
    return res.status(503).json({ message: 'Connexion Amazon temporairement indisponible', configured: true });
  }
  const authUrl = `${AMAZON_SELLER_CENTRAL_BASE}/apps/authorize/consent?application_id=${encodeURIComponent(AMAZON_APPLICATION_ID)}&state=${encodeURIComponent(state)}`;
  res.json({ authUrl, state, configured: true });
});

// 5b. Log-in URI — reçoit Amazon (amazon_callback_uri, amazon_state, selling_partner_id), redirige vers Amazon
app.get('/api/v1/platforms/amazon/login', async (req, res) => {
  const { amazon_callback_uri, amazon_state, selling_partner_id } = req.query;
  if (!amazon_callback_uri || !amazon_state) {
    return res.status(400).send('Paramètres Amazon manquants (amazon_callback_uri, amazon_state)');
  }
  const accountId = req.cookies?.fp_amazon_connect_account;
  if (!accountId) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=no_session`);
  }
  res.clearCookie('fp_amazon_connect_account', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  const state = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: state,
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_STATE,
      payload: { accountId, sellingPartnerId: selling_partner_id || null },
      ttlMs: AMAZON_STATE_TTL_MS,
    });
  } catch (error) {
    console.error('Amazon login state persistence error:', error);
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=state_persist`);
  }
  const redirectUrl = `${amazon_callback_uri}?redirect_uri=${encodeURIComponent(AMAZON_REDIRECT_URI)}&amazon_state=${encodeURIComponent(amazon_state)}&state=${encodeURIComponent(state)}`;
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.redirect(redirectUrl);
});

// 5c. Redirect URI — reçoit code, échange pour tokens, stocke
app.get('/api/v1/platforms/amazon/callback', async (req, res) => {
  const { state, selling_partner_id, spapi_oauth_code } = req.query;
  if (!spapi_oauth_code || !state) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=missing_params`);
  }

  let stored = null;
  try {
    stored = await consumeOAuthEphemeralState({
      id: String(state),
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_STATE,
    });
  } catch (error) {
    console.error('Amazon callback state lookup error:', error);
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=state_lookup`);
  }
  if (!stored?.accountId) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=invalid_state`);
  }
  const accountId = stored.accountId;
  const embeddedSurface = stored.surface === 'embedded';
  const embeddedReturnTo = normalizeEmbeddedReturnTo(stored.returnTo, '/embedded/channels');
  const sellerId = selling_partner_id || stored.sellingPartnerId || null;
  if (!AMAZON_LWA_CLIENT_ID || !AMAZON_LWA_CLIENT_SECRET || !AMAZON_REDIRECT_URI) {
    if (embeddedSurface) {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId,
        returnTo: embeddedReturnTo,
        fallbackUrl: `${APP_URL}/flux?amazon=error&reason=config`,
        params: { amazon: 'error', reason: 'config' },
      }));
    }
    return res.redirect(buildDashboardRedirectUrl(stored.returnTo, { amazon: 'error', reason: 'config' }));
  }
  try {
    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: spapi_oauth_code,
        redirect_uri: AMAZON_REDIRECT_URI,
        client_id: AMAZON_LWA_CLIENT_ID,
        client_secret: AMAZON_LWA_CLIENT_SECRET
      }).toString()
    });
    // Amazon peut répondre 4xx/5xx (redirect_uri non enregistrée, client
    // invalide…) : on lit le corps brut pour le log avant de tenter le JSON,
    // sinon on masque la vraie cause derrière une erreur de parse opaque.
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => '');
      console.error('Amazon token exchange HTTP error:', tokenRes.status, errBody.substring(0, 500));
      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: `${APP_URL}/flux?amazon=error&reason=token_exchange`,
          params: { amazon: 'error', reason: 'token_exchange' },
        }));
      }
      return res.redirect(buildDashboardRedirectUrl(stored.returnTo, { amazon: 'error', reason: 'token_exchange' }));
    }
    const tokens = await tokenRes.json();
    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('Amazon token exchange failed:', tokens);
      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: `${APP_URL}/flux?amazon=error&reason=token_exchange`,
          params: { amazon: 'error', reason: 'token_exchange' },
        }));
      }
      return res.redirect(buildDashboardRedirectUrl(stored.returnTo, { amazon: 'error', reason: 'token_exchange' }));
    }
    const expiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    if (prismaReady && prisma) {
      const existing = await prisma.$queryRawUnsafe(`
        SELECT id FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon' LIMIT 1
      `, accountId);
      const connId = crypto.randomUUID();
      const meta = stringifyEncryptedJson({ sellerId });
      if (existing && existing.length > 0) {
        await prisma.$executeRawUnsafe(`
          UPDATE "PlatformConnection" SET merchantid = COALESCE($1::text, merchantid), accesstoken = $2::text, refreshtoken = COALESCE($3::text, refreshtoken),
          tokenexpiry = $4::timestamptz, status = 'active', metadata = $5::jsonb, updatedat = NOW()
          WHERE accountid = $6::text AND platform = 'amazon'
        `, sellerId || null, encryptSecret(tokens.access_token), encryptSecret(tokens.refresh_token), expiry, meta, accountId);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "PlatformConnection" (id, accountid, platform, merchantid, accesstoken, refreshtoken, tokenexpiry, status, metadata, createdat, updatedat)
          VALUES ($1::text, $2::text, 'amazon', $3::text, $4::text, $5::text, $6::timestamptz, 'active', $7::jsonb, NOW(), NOW())
        `, connId, accountId, sellerId || null, encryptSecret(tokens.access_token), encryptSecret(tokens.refresh_token), expiry, meta);
      }
    }
    if (embeddedSurface) {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId,
        returnTo: embeddedReturnTo,
        fallbackUrl: `${APP_URL}/flux?amazon=connected&seller=${sellerId || ''}`,
        params: { amazon: 'connected', seller: sellerId || '' },
      }));
    }
    return res.redirect(buildDashboardRedirectUrl(stored.returnTo, { amazon: 'connected', seller: sellerId || '' }));
  } catch (e) {
    console.error('Amazon callback error:', e);
    if (embeddedSurface) {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId,
        returnTo: embeddedReturnTo,
        fallbackUrl: `${APP_URL}/flux?amazon=error&reason=server`,
        params: { amazon: 'error', reason: 'server' },
      }));
    }
    return res.redirect(buildDashboardRedirectUrl(stored.returnTo, { amazon: 'error', reason: 'server' }));
  }
});

// 5d. Init connexion — retourne l'URL à visiter pour lancer le flow OAuth
app.get('/api/v1/platforms/amazon/connect-init', authenticateJwtOrShopifySession, async (req, res) => {
  if (!AMAZON_APPLICATION_ID) {
    // État normal (Amazon SP-API pas encore activé côté infra), pas une
    // erreur serveur : 200 + flag configured:false. Évite que les clics
    // répétés du merchant ne polluent les alertes Cloud Monitoring 5xx.
    return res.status(200).json({ configured: false, message: 'Amazon OAuth non configuré' });
  }
  const embeddedSurface = String(req.query.surface || '').trim().toLowerCase() === 'embedded';
  const returnTo = embeddedSurface
    ? normalizeEmbeddedReturnTo(req.query.returnTo, '/embedded/channels')
    : normalizeDashboardReturnTo(req.query.returnTo, '/flux');
  const code = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: code,
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_CONNECT,
      payload: {
        accountId: req.accountId,
        surface: embeddedSurface ? 'embedded' : 'dashboard',
        returnTo,
      },
      ttlMs: AMAZON_CONNECT_CODE_TTL_MS,
    });
  } catch (error) {
    console.error('Amazon connect-init code persistence error:', error);
    return res.status(503).json({ configured: true, message: 'Connexion Amazon temporairement indisponible' });
  }
  const baseUrl = req.protocol + '://' + req.get('host');
  const connectUrl = `${baseUrl}/api/v1/platforms/amazon/connect?code=${code}`;
  res.json({ connectUrl, configured: true });
});

// 5e. Point d'entrée pour lancer la connexion — ?code=xxx, set cookie, redirige vers Seller Central
app.get('/api/v1/platforms/amazon/connect', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=missing_code`);
  }

  let stored = null;
  try {
    stored = await consumeOAuthEphemeralState({
      id: String(code),
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_CONNECT,
    });
  } catch (error) {
    console.error('Amazon connect code lookup error:', error);
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=code_lookup`);
  }
  if (!stored?.accountId) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=invalid_code`);
  }
  const accountId = stored.accountId;
  const embeddedSurface = stored.surface === 'embedded';
  const safeReturnTo = embeddedSurface
    ? normalizeEmbeddedReturnTo(stored.returnTo, '/embedded/channels')
    : normalizeDashboardReturnTo(stored.returnTo, '/flux');
  if (!AMAZON_APPLICATION_ID) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=not_configured`);
  }
  const state = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: state,
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_STATE,
      payload: {
        accountId,
        surface: embeddedSurface ? 'embedded' : 'dashboard',
        returnTo: safeReturnTo,
      },
      ttlMs: AMAZON_STATE_TTL_MS,
    });
  } catch (error) {
    console.error('Amazon connect state persistence error:', error);
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=state_persist`);
  }
  res.cookie('fp_amazon_connect_account', accountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AMAZON_STATE_TTL_MS,
    path: '/'
  });
  const authUrl = `${AMAZON_SELLER_CENTRAL_BASE}/apps/authorize/consent?application_id=${encodeURIComponent(AMAZON_APPLICATION_ID)}&state=${encodeURIComponent(state)}`;
  res.redirect(authUrl);
});

// 5f. Connexion manuelle (refresh_token) — pour tests ou app privée
app.post('/api/v1/platforms/amazon/connect', authenticateJwtOrShopifySession, async (req, res) => {
  const { refresh_token, seller_id } = req.body || {};
  if (!refresh_token) {
    return res.status(400).json({ message: 'refresh_token requis' });
  }
  if (!AMAZON_LWA_CLIENT_ID || !AMAZON_LWA_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Amazon LWA non configuré (AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET)' });
  }
  try {
    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        client_id: AMAZON_LWA_CLIENT_ID,
        client_secret: AMAZON_LWA_CLIENT_SECRET
      }).toString()
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      return res.status(400).json({ message: 'Token invalide ou expiré. Vérifiez votre refresh_token.', error: tokens.error_description });
    }
    const expiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    if (prismaReady && prisma) {
      const existing = await prisma.$queryRawUnsafe(`
        SELECT id FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon' LIMIT 1
      `, req.accountId);
      const connId = crypto.randomUUID();
      const meta = stringifyEncryptedJson({ sellerId: seller_id });
      if (existing && existing.length > 0) {
        await prisma.$executeRawUnsafe(`
          UPDATE "PlatformConnection" SET merchantid = COALESCE($1::text, merchantid), accesstoken = $2::text, refreshtoken = COALESCE($3::text, refreshtoken),
          tokenexpiry = $4::timestamptz, status = 'active', metadata = $5::jsonb, updatedat = NOW()
          WHERE accountid = $6::text AND platform = 'amazon'
        `, seller_id || null, encryptSecret(tokens.access_token), encryptSecret(refresh_token), expiry, meta, req.accountId);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "PlatformConnection" (id, accountid, platform, merchantid, accesstoken, refreshtoken, tokenexpiry, status, metadata, createdat, updatedat)
          VALUES ($1::text, $2::text, 'amazon', $3::text, $4::text, $5::text, $6::timestamptz, 'active', $7::jsonb, NOW(), NOW())
        `, connId, req.accountId, seller_id || null, encryptSecret(tokens.access_token), encryptSecret(refresh_token), expiry, meta);
      }
    }
    res.json({ message: 'Amazon connecté', connected: true });
  } catch (e) {
    console.error('Amazon connect error:', e);
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/v1/platforms/amazon/status', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.json({ connected: false });
    }
    const connections = await prisma.$queryRawUnsafe(`
      SELECT * FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon' AND status = 'active'
    `, req.accountId);
    const conn = connections && connections[0];
    if (!conn) {
      return res.json({ connected: false });
    }
    const isExpired = conn.tokenexpiry && new Date(conn.tokenexpiry) < new Date();
    res.json({
      connected: conn.status === 'active',
      sellerId: conn.merchantid,
      tokenExpired: isExpired,
      connectedAt: conn.createdat
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

app.delete('/api/v1/platforms/amazon/disconnect', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (prismaReady && prisma) {
      await prisma.$executeRawUnsafe(`
        DELETE FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon'
      `, req.accountId);
    }
    res.json({ message: 'Amazon déconnecté' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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

async function executeAmazonPush({ accountId, feedId, destinationContext = null, channelKey = null }) {
  const resolvedChannelKey = String(
    channelKey
      || destinationContext?.settings?.legacyChannelKey
      || inferAmazonChannelKeyForMarket(destinationContext?.marketCode || '')
      || 'amazon_fr'
  ).toLowerCase();
  const channelConfig = AMAZON_CHANNEL_CONFIG[resolvedChannelKey];
  if (!channelConfig) {
    throw createPushError('Canal Amazon invalide. Utilisez une destination Amazon ou channel=amazon_fr|amazon_uk|amazon_de|amazon_it|amazon_es.', 400);
  }

  const conn = await getActivePlatformConnectionForPush(accountId, 'amazon');
  if (!conn) {
    throw createPushError('Amazon non connecté. Connectez votre compte Seller Central d\'abord.', 400);
  }

  let accessToken = conn.accesstoken;
  if (conn.tokenexpiry && new Date(conn.tokenexpiry) < new Date()) {
    try {
      accessToken = await refreshAmazonToken(conn);
    } catch (refreshErr) {
      throw createPushError('Token Amazon expiré. Reconnectez votre compte.', 401, { reconnect: true });
    }
  }

  const meta = conn.metadata || {};
  const sellerId = conn.merchantid || meta.sellerId;
  if (!sellerId) {
    throw createPushError('Seller ID manquant. Reconnectez Amazon.', 400);
  }

  const legacyAmazonFilter = destinationContext
    ? ''
    : `AND (customfields->'_channelOverrides'->>'amazon' IS NULL OR customfields->'_channelOverrides'->>'amazon' != 'false')`;
  let items = await prisma.$queryRawUnsafe(
    `
      SELECT id, feedid AS "feedId", originid AS "originId", url, title,
             descriptionhtml AS "descriptionHtml", descriptiontext AS "descriptionText", imageurl AS "imageUrl",
             brand, sku, price, currency, inventory, customfields, gtin, mpn
      FROM "FeedItem"
      WHERE feedid = $1::text
        ${legacyAmazonFilter}
    `,
    feedId
  );
  items = await filterItemsForDestinationActivation(items, destinationContext);

  // Traduction par marché (v2) — best-effort.
  try {
    const { translateItemsForDestination } = require('./optimization/market-translation');
    const { items: translated, stats } = await translateItemsForDestination(prisma, items, destinationContext, { prisma, accountId });
    items = translated;
    if (stats.quotaExceeded) {
      console.warn('[market-translation] amazon push : plafond IA texte atteint → contenu source (pas de traduction)');
    } else if (!stats.skipped) {
      console.log(`[market-translation] amazon push → ${destinationContext?.localeCode || stats.targetLanguage} : translated=${stats.translated} cached=${stats.cached} failed=${stats.failed}`);
    }
  } catch (translationErr) {
    console.warn('⚠️ Traduction marché ignorée (amazon push):', translationErr?.message);
  }

  if (!items || items.length === 0) {
    const emptyStateRows = await prisma.$queryRawUnsafe(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE customfields->'_channelOverrides'->>'amazon' = 'false'
          )::int AS amazon_disabled
        FROM "FeedItem"
        WHERE feedid = $1::text
      `,
      feedId
    );

    const emptyState = emptyStateRows?.[0] || {};
    const totalFeedItems = Number(emptyState.total || 0);
    const amazonDisabledItems = Number(emptyState.amazon_disabled || 0);

    let message = destinationContext
      ? `Aucun produit à pousser : aucun produit actif pour ${destinationContext.marketName || destinationContext.slug || 'cette destination Amazon'}.`
      : 'Aucun produit à pousser : aucun produit éligible pour Amazon.';
    let reason = destinationContext ? 'destination_empty' : 'no_eligible_products';

    if (totalFeedItems === 0) {
      message = 'Aucun produit à pousser : ce flux ne contient actuellement aucun produit synchronisé.';
      reason = 'empty_feed';
    } else if (amazonDisabledItems === totalFeedItems) {
      message = 'Aucun produit à pousser : tous les produits de ce flux sont désactivés pour Amazon.';
      reason = 'amazon_disabled';
    }

    return {
      message,
      total: 0,
      succeeded: 0,
      failed: 0,
      reason,
      totalFeedItems,
      amazonDisabledItems,
      destinationId: destinationContext?.id || null,
      destinationSlug: destinationContext?.slug || null,
      channelKey: resolvedChannelKey,
    };
  }

  let succeeded = 0;
  let failed = 0;
  const errors = [];
  let authFailure = false;   // 401/403 SP-API → access token invalide, reconnexion requise
  let rateLimited = false;   // 429 SP-API → throttling Amazon
  const marketplaceId = channelConfig.marketplaceId;
  const currency = channelConfig.currency;

  for (const item of items) {
    try {
      const cf = typeof item.customfields === 'string' ? JSON.parse(item.customfields || '{}') : (item.customfields || {});
      const n = normalizeForAmazon({ ...item, customfields: cf }, channelConfig, { destinationId: destinationContext?.id || null });
      const sku = n.sku;
      const priceVal = parseFloat((n.standard_price || '').split(' ')[0] || '0');
      const payload = {
        productType: 'PRODUCT',
        attributes: {
          item_name: [{ value: n.item_name, marketplace_id: marketplaceId }],
          product_description: [{ value: n.product_description, marketplace_id: marketplaceId }],
          bullet_point: [{ value: n.bullet_point, marketplace_id: marketplaceId }],
          brand: [{ value: n.brand, marketplace_id: marketplaceId }],
          condition_type: [{ value: n.condition_type, marketplace_id: marketplaceId }],
          list_price: [{ value: { value: priceVal, currency }, marketplace_id: marketplaceId }],
          fulfillment_availability: [{ value: [{ quantity: n.quantity }], marketplace_id: marketplaceId }],
          main_image: [{ value: [{ link: n.main_image_url }], marketplace_id: marketplaceId }]
        }
      };
      if (n.external_product_id) {
        payload.attributes.external_product_id = [{ value: n.external_product_id, marketplace_id: marketplaceId }];
        payload.attributes.external_product_id_type = [{ value: n.external_product_id_type, marketplace_id: marketplaceId }];
      }
      const putRes = await fetch(`${AMAZON_SP_API_BASE}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}?marketplaceIds=${marketplaceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-amz-access-token': accessToken,
          'User-Agent': 'FeedPlug/1.0 (Language=JavaScript)'
        },
        body: JSON.stringify(payload)
      });
      if (putRes.ok) {
        succeeded++;
      } else {
        const errText = await putRes.text().catch(() => '');
        failed++;
        if (putRes.status === 401 || putRes.status === 403) authFailure = true;
        if (putRes.status === 429) rateLimited = true;
        errors.push({ sku, status: putRes.status, error: errText.substring(0, 200) });
      }
    } catch (e) {
      failed++;
      errors.push({ sku: item.sku || item.id, error: e.message });
    }
  }

  const logId = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "ExportLog" (id, accountid, feedid, platform, status, totalproducts, succeeded, failed, errormessage, createdat)
      VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::int, $7::int, $8::int, $9::text, NOW())
    `,
    logId,
    accountId,
    feedId,
    destinationContext?.slug || resolvedChannelKey,
    failed > 0 ? 'partial' : 'success',
    items.length,
    succeeded,
    failed,
    errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : null
  );

  // Tout a échoué sur une erreur d'auth → l'access token est invalide même
  // après refresh : on demande explicitement une reconnexion côté UI.
  if (succeeded === 0 && authFailure) {
    throw createPushError(
      'Connexion Amazon refusée par SP-API. Reconnectez Seller Central.',
      401,
      { reconnect: true, logId }
    );
  }

  const destinationLabel = buildDestinationPushLabel(destinationContext) || channelConfig.label;
  let message = `Push Amazon ${destinationLabel} : ${succeeded} produits envoyés, ${failed} erreurs`;
  if (rateLimited) {
    message += ' (throttling Amazon détecté — réessayez dans quelques minutes)';
  }
  return {
    message,
    total: items.length,
    succeeded,
    failed,
    rateLimited,
    errors: errors.slice(0, 10),
    logId,
    destinationId: destinationContext?.id || null,
    destinationSlug: destinationContext?.slug || null,
    channelKey: resolvedChannelKey,
  };
}

async function executeGmcPush({ accountId, userId, feedId, destinationContext = null }) {
  const conn = await getActivePlatformConnectionForPush(accountId, 'gmc');
  if (!conn) {
    throw createPushError('Google Merchant Center non connecté. Connectez votre compte d\'abord.', 400);
  }
  if (!conn.merchantid) {
    throw createPushError('Aucun Merchant Center ID trouvé. Reconnectez votre compte.', 400);
  }

  let accessToken = conn.accesstoken;
  if (conn.tokenexpiry && new Date(conn.tokenexpiry) < new Date()) {
    try {
      accessToken = await refreshGMCToken(conn);
    } catch (refreshErr) {
      throw createPushError('Token expiré et impossible de rafraîchir. Reconnectez Google Merchant Center.', 401, { reconnect: true });
    }
  }

  const legacyGoogleFilter = destinationContext
    ? ''
    : `AND (customfields->'_channelOverrides'->>'google' IS NULL OR customfields->'_channelOverrides'->>'google' != 'false')`;
  let items = await prisma.$queryRawUnsafe(
    `
      SELECT id, feedid AS "feedId", originid AS "originId", url, title,
             descriptionhtml AS "descriptionHtml", descriptiontext AS "descriptionText", imageurl AS "imageUrl",
             brand, sku, price, currency, inventory, customfields, gtin, mpn
      FROM "FeedItem"
      WHERE feedid = $1::text
        ${legacyGoogleFilter}
    `,
    feedId
  );
  const itemsBeforeDestFilter = items.length;
  items = await filterItemsForDestinationActivation(items, destinationContext);
  // Diag : si push retourne "Aucun produit à pousser" sans log applicatif,
  // on ne sait pas si le feed est vide en BDD, si le filter Google les a
  // exclus, ou si le filter destination a tout retiré. Log ces compteurs.
  console.log(`[gmc-push] account=${accountId} feed=${feedId} merchantId=${conn.merchantid} itemsAfterSqlFilter=${itemsBeforeDestFilter} itemsAfterDestActivation=${items.length} destinationContext=${destinationContext ? destinationContext.slug || destinationContext.id : 'default'}`);

  // Traduction par marché (v2) — best-effort.
  try {
    const { translateItemsForDestination } = require('./optimization/market-translation');
    const { items: translated, stats } = await translateItemsForDestination(prisma, items, destinationContext, { prisma, accountId });
    items = translated;
    if (stats.quotaExceeded) {
      console.warn('[market-translation] gmc push : plafond IA texte atteint → contenu source (pas de traduction)');
    } else if (!stats.skipped) {
      console.log(`[market-translation] gmc push → ${destinationContext?.localeCode || stats.targetLanguage} : translated=${stats.translated} cached=${stats.cached} failed=${stats.failed}`);
    }
  } catch (translationErr) {
    console.warn('⚠️ Traduction marché ignorée (gmc push):', translationErr?.message);
  }

  if (!items || items.length === 0) {
    return {
      message: destinationContext
        ? `Aucun produit à pousser pour ${destinationContext.marketName || destinationContext.slug || 'cette destination'}`
        : 'Aucun produit à pousser',
      total: 0,
      succeeded: 0,
      failed: 0,
      destinationId: destinationContext?.id || null,
      destinationSlug: destinationContext?.slug || null,
    };
  }

  const merchantId = conn.merchantid;
  const targetCountry = destinationContext?.countryCode || destinationContext?.marketCode || 'FR';
  const contentLanguage = String(destinationContext?.languageCode || 'fr').toLowerCase();
  let succeeded = 0;
  let failed = 0;
  const errors = [];

  const batchSize = 50;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const DEFAULT_GMC_CATEGORY = 'Apparel & Accessories > Clothing';
    const entries = batch.map((item, idx) => {
      const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
      const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc', { destinationId: destinationContext?.id || null });
      const title = (optTitle || item.title || '').substring(0, 150);
      const description = (optDesc || '').replace(/<[^>]*>/g, '').substring(0, 5000);
      const price = item.price ? { value: String(Number(item.price).toFixed(2)), currency: item.currency || destinationContext?.currencyCode || 'EUR' } : undefined;
      const availability = normalizeAvailabilityForGMC(cf.availability || cf.inventory, item.inventory);
      const googleProductCategory = (cf.google_product_category && String(cf.google_product_category).trim()) || DEFAULT_GMC_CATEGORY;
      const condition = normalizeConditionForGMC(item.condition || cf.condition);
      const offerId = ((item.originid ?? item.originId) || item.id).toString().substring(0, 50);
      return {
        batchId: idx,
        merchantId: merchantId,
        method: 'insert',
        product: {
          offerId: offerId,
          title: title,
          description: description.replace(/<[^>]*>/g, ''),
          link: item.url || cf.link || '',
          imageLink: (item.imageurl ?? item.imageUrl) || cf.image_link || '',
          availability: availability,
          price: price,
          brand: item.brand || cf.brand || '',
          gtin: item.gtin || cf.gtin || undefined,
          mpn: item.mpn || cf.mpn || item.sku || undefined,
          condition: condition,
          googleProductCategory: googleProductCategory,
          channel: 'online',
          contentLanguage,
          targetCountry
        }
      };
    });

    try {
      const batchRes = await fetch(`https://shoppingcontent.googleapis.com/content/v2.1/products/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entries })
      });

      if (batchRes.ok) {
        const batchData = await batchRes.json();
        for (const entry of (batchData.entries || [])) {
          if (entry.errors && entry.errors.errors && entry.errors.errors.length > 0) {
            failed++;
            errors.push({ productId: batch[entry.batchId]?.id, errors: entry.errors.errors.map(e => e.message) });
          } else {
            succeeded++;
          }
        }
      } else {
        const errText = await batchRes.text();
        console.error('GMC batch error:', batchRes.status, errText);
        if (batchRes.status === 401) {
          await prisma.$executeRawUnsafe(`UPDATE "PlatformConnection" SET status = 'expired', updatedat = NOW() WHERE id = $1::text`, conn.id);
          throw createPushError('Token GMC expiré. Reconnectez votre compte.', 401, { reconnect: true });
        }
        failed += batch.length;
        errors.push({ batch: `${i}-${i + batch.length}`, error: errText.substring(0, 200) });
      }
    } catch (batchErr) {
      if (batchErr?.statusCode) {
        throw batchErr;
      }
      console.error('GMC batch fetch error:', batchErr);
      failed += batch.length;
      errors.push({ batch: `${i}-${i + batch.length}`, error: batchErr.message });
    }
  }

  const isMcaError = failed > 0 && succeeded === 0 && errors.some(e =>
    (Array.isArray(e.errors) && e.errors.some(msg => typeof msg === 'string' && msg.includes('products manager access'))) ||
    (typeof e.error === 'string' && e.error.includes('products manager access'))
  );

  const logId = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "ExportLog" (id, accountid, feedid, platform, status, totalproducts, succeeded, failed, errormessage, createdat)
      VALUES ($1::text, $2::text, $3::text, 'gmc', $4::text, $5::int, $6::int, $7::int, $8::text, NOW())
    `,
    logId,
    accountId,
    feedId,
    failed > 0 ? 'partial' : 'success',
    items.length,
    succeeded,
    failed,
    errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null
  );

  try {
    const user = await findUserById(userId);
    if (user?.email) {
      sendExportCompleteEmail(user.email, `Feed ${feedId.substring(0, 8)}`, { succeeded, failed, total: items.length })
        .catch(e => console.warn('Email export non envoyé:', e.message));
    }
  } catch {}

  const destinationLabel = buildDestinationPushLabel(destinationContext);
  return {
    message: isMcaError
      ? `Compte MCA détecté : le compte Merchant Center sélectionné est un agrégateur. Reconnectez en choisissant un sous-compte enfant.`
      : `Push ${destinationLabel || 'Google Merchant Center'} terminé : ${succeeded} produits envoyés, ${failed} erreurs`,
    total: items.length,
    succeeded,
    failed,
    mcaError: isMcaError || undefined,
    errors: errors.slice(0, 10),
    logId,
    destinationId: destinationContext?.id || null,
    destinationSlug: destinationContext?.slug || null,
    targetCountry,
    contentLanguage,
  };
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
function scheduleAutoGmcPush(accountId, feedId, reason, delayMs = AUTO_GMC_PUSH_DEBOUNCE_MS) {
  if (!accountId) return;
  const dedupKey = `${accountId}:${feedId || 'default'}`;
  enqueueBackgroundJob(
    JOB_TYPES.AUTO_GMC_PUSH,
    { accountId, feedId: feedId || null, reason },
    { dedupKey, scheduleDelayMs: Math.max(0, delayMs), dedupWindowMs: AUTO_GMC_PUSH_DEBOUNCE_MS }
  ).catch((err) => console.warn(`⚠️ enqueue auto_gmc_push échoué (${reason}):`, err?.message || err));
}

// Handler idempotent du push GMC auto. No-op si GMC non connecté ou pas de feed.
async function runAutoGmcPush({ accountId, feedId, reason }) {
  if (!accountId) return;
  try {
    const conn = await getActivePlatformConnectionForPush(accountId, 'gmc');
    if (!conn || !conn.merchantid) return;
    const targetFeedId = feedId || await resolveDefaultFeedIdForAccount(accountId);
    if (!targetFeedId) return;
    const result = await executeGmcPush({ accountId, userId: null, feedId: targetFeedId });
    console.log(`🔄 Push GMC auto (${reason}) : feed ${targetFeedId} → ${result.succeeded} envoyés, ${result.failed} erreurs`);
  } catch (err) {
    console.warn(`⚠️ Push GMC auto (${reason}) échoué pour account ${accountId}:`, err?.message || err);
  }
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

// Sprint 2 : signature publique inchangée. Délègue à enqueueJob.
function scheduleAutoOptimization(accountId, feedId, reason, delayMs = AUTO_OPTIM_DEBOUNCE_MS) {
  if (!accountId) return;
  // Pas de feedId connu = fallback direct sur push GMC (le push résoudra le
  // default feed lui-même). On ne peut pas optimiser sans target feed.
  if (!feedId) {
    scheduleAutoGmcPush(accountId, feedId, reason);
    return;
  }
  const dedupKey = `${accountId}:${feedId}`;
  enqueueBackgroundJob(
    JOB_TYPES.AUTO_OPTIMIZATION,
    { accountId, feedId, reason },
    { dedupKey, scheduleDelayMs: Math.max(0, delayMs), dedupWindowMs: AUTO_OPTIM_DEBOUNCE_MS }
  ).catch((err) => console.warn(`⚠️ enqueue auto_optimization échoué (${reason}):`, err?.message || err));
}

// Handler idempotent de l'auto-optimisation IA. Re-exécutable : ne ré-optimise
// que les items sans customfields.optimized.gmc.title, puis push GMC.
async function runAutoOptimization({ accountId, feedId, reason }) {
  if (!accountId || !feedId) return;
  {
    try {
      // B1 — pas d'auto-optimisation IA sans pack IA : on pousse le contenu brut.
      const hasIA = await getAccountAddonIA(prisma, accountId);
      if (!hasIA) {
        scheduleAutoGmcPush(accountId, feedId, `${reason} → sans pack IA (push brut)`, 0);
        return;
      }
      const items = await prisma.$queryRawUnsafe(`
        SELECT id, title, descriptiontext, descriptionhtml, brand, sku,
               customfields, gtin, mpn, price, currency
        FROM "FeedItem"
        WHERE feedid = $1::text
          AND (
            customfields IS NULL
            OR customfields->'optimized'->'gmc'->>'title' IS NULL
            OR customfields->'optimized'->'gmc'->>'title' = ''
          )
        LIMIT ${AUTO_OPTIM_BATCH_SIZE}
      `, feedId);

      if (!items?.length) {
        console.log(`✨ Auto-optim (${reason}) feed ${feedId} : aucun produit à optimiser → push direct`);
        scheduleAutoGmcPush(accountId, feedId, `${reason} → push direct`, 0);
        return;
      }

      // A3 — hard cap texte : au-delà du plafond, on n'appelle PAS Gemini pour
      // l'auto-optimisation — on pousse le contenu brut (comme le chemin sans
      // pack IA). 1 op = titre + description par produit (2 appels), mais on
      // compte 1 op/produit pour rester cohérent avec trackAiUsage plus bas.
      const autoQuota = await checkAiQuota(prisma, accountId, 'text', items.length);
      if (!autoQuota.allowed) {
        console.warn(`⚠️ Auto-optim (${reason}) feed ${feedId} : plafond IA texte atteint (${autoQuota.used}/${autoQuota.cap}) → push brut`);
        scheduleAutoGmcPush(accountId, feedId, `${reason} → plafond IA atteint (push brut)`, 0);
        return;
      }

      let succeeded = 0;
      let failed = 0;
      for (const item of items) {
        try {
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
          const [titleRes, descRes] = await Promise.all([
            optimizeTitleWithAI(prisma, product, { platform: 'GMC' }).catch((e) => {
              console.warn(`⚠️ Auto-optim title ${item.id} :`, e?.message);
              return null;
            }),
            optimizeDescriptionWithAI(prisma, product, { platform: 'GMC' }).catch((e) => {
              console.warn(`⚠️ Auto-optim desc ${item.id} :`, e?.message);
              return null;
            }),
          ]);

          const optimizedTitle = titleRes?.optimizedTitle || product.title;
          const optimizedDescription = descRes?.optimizedDescription || product.description;
          if (!optimizedTitle && !optimizedDescription) {
            failed++;
            continue;
          }

          const payload = {
            title: optimizedTitle,
            description: optimizedDescription,
            optimizedAt: new Date().toISOString(),
          };

          await prisma.$executeRawUnsafe(
            `UPDATE "FeedItem"
             SET customfields = jsonb_set(
               COALESCE(customfields, '{}'::jsonb),
               '{optimized,gmc}',
               $1::jsonb,
               true
             ),
             updatedat = NOW()
             WHERE id = $2::text`,
            JSON.stringify(payload),
            item.id
          );
          succeeded++;
        } catch (itemErr) {
          console.warn(`⚠️ Auto-optim item ${item.id} échoué :`, itemErr?.message || itemErr);
          failed++;
        }
      }
      console.log(`✨ Auto-optim (${reason}) feed ${feedId} : ${succeeded} optimisés, ${failed} erreurs (sur ${items.length}) → push GMC`);
      // B1 — comptage de la consommation IA (titre + description par produit optimisé).
      trackAiUsage(accountId, succeeded);
      scheduleAutoGmcPush(accountId, feedId, `${reason} → post-optim`, 0);
    } catch (err) {
      console.warn(`⚠️ Auto-optim (${reason}) échoué pour feed ${feedId} :`, err?.message || err);
      // Fallback : push GMC quand même, mieux du brut que rien.
      scheduleAutoGmcPush(accountId, feedId, `${reason} → fallback (optim KO)`, 0);
    }
  }
}

// Push produits vers Amazon SP-API (Listings Items API)
app.post('/api/v1/platforms/amazon/push/:feedId', requireAuth, async (req, res) => {
  try {
    const { feedId } = req.params;
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!await verifyFeedAccess(feedId, req.accountId)) {
      return res.status(403).json({ message: 'Accès refusé à ce flux' });
    }
    const destinationContext = req.query.destinationId
      ? await getDestinationPushContext(req.accountId, String(req.query.destinationId), 'amazon')
      : null;
    const result = await executeAmazonPush({
      accountId: req.accountId,
      feedId,
      destinationContext,
      channelKey: req.query.channel || req.body?.channel || null,
    });
    res.json(result);
  } catch (error) {
    console.error('Amazon push error:', error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      reconnect: error.reconnect === true || undefined,
    });
  }
});

// Push produits vers Google Merchant Center
app.post('/api/v1/platforms/gmc/push/:feedId', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const { feedId } = req.params;
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!await verifyFeedAccess(feedId, req.accountId)) {
      return res.status(403).json({ message: 'Accès refusé à ce flux' });
    }
    const destinationContext = req.query.destinationId
      ? await getDestinationPushContext(req.accountId, String(req.query.destinationId), 'gmc')
      : null;
    const result = await executeGmcPush({
      accountId: req.accountId,
      userId: req.user?.id || null,
      feedId,
      destinationContext,
    });
    res.json(result);
  } catch (error) {
    console.error('GMC push error:', error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      reconnect: error.reconnect === true || undefined,
    });
  }
});

// Variante sans feedId : pousse le feed par défaut du compte. Utilisée par
// l'app Shopify embedded, qui ne connaît pas les ids de feeds (les routes
// /ingestion sont réservées au dashboard JWT).
app.post('/api/v1/platforms/gmc/push', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const feedId = await resolveDefaultFeedIdForAccount(req.accountId);
    if (!feedId) {
      return res.status(404).json({ message: 'Aucun flux produit trouvé pour ce compte.' });
    }
    const result = await executeGmcPush({
      accountId: req.accountId,
      userId: req.user?.id || null,
      feedId,
    });
    res.json(result);
  } catch (error) {
    console.error('GMC push (default feed) error:', error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      reconnect: error.reconnect === true || undefined,
    });
  }
});

// Dernier push GMC du compte (pour afficher l'état de sync dans l'app embedded).
app.get('/api/v1/platforms/gmc/last-push', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.json({ lastPush: null });
    }
    const rows = await prisma.$queryRawUnsafe(
      `
        SELECT status, totalproducts, succeeded, failed, errormessage, createdat
        FROM "ExportLog"
        WHERE accountid = $1::text AND platform = 'gmc'
        ORDER BY createdat DESC
        LIMIT 1
      `,
      req.accountId
    );
    const row = rows?.[0];
    res.json({
      lastPush: row
        ? {
            status: row.status,
            total: row.totalproducts,
            succeeded: row.succeeded,
            failed: row.failed,
            createdAt: row.createdat,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 6. Historique des exports
app.get('/api/v1/platforms/export-logs', requireAuth, async (req, res) => {
  try {
    if (!prismaReady || !prisma) return res.json([]);
    
    const logs = await prisma.$queryRawUnsafe(`
      SELECT el.*, f.name as feedname 
      FROM "ExportLog" el 
      LEFT JOIN "Feed" f ON el.feedid = f.id
      WHERE el.accountid = $1::text
      ORDER BY el.createdat DESC LIMIT 20
    `, req.accountId);
    
    res.json(logs || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ====== DASHBOARD ======

app.get('/api/v1/dashboard/overview', requireAuth, async (req, res) => {
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


// ====== SHOPIFY OAUTH CONNECTORS ======
// APP_URL déjà déclaré plus haut dans run()

// Les states OAuth Shopify sont stockés en base pour survivre aux redémarrages et au multi-instance.

app.post('/api/v1/shopify/session-token/probe', async (req, res) => {
  try {
    const authHeader = String(req.headers['authorization'] || '').trim();
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const token = bearerToken || String(req.headers['x-shopify-session-token'] || '').trim();

    if (!token) {
      return res.status(401).json({ message: 'Shopify session token requis' });
    }

    const { payload, shop } = verifyShopifySessionToken(token);
    return res.json({
      ok: true,
      shop,
      sub: payload.sub || null,
      dest: payload.dest || null,
    });
  } catch (error) {
    console.warn('Shopify session token probe failed:', error?.message || error);
    return res.status(401).json({ message: 'Shopify session token invalide' });
  }
});

// GET /install : point d'entrée pour le lien d'installation généré par Partners (Custom distribution).
// Reçoit shop, timestamp, hmac ; vérifie HMAC puis redirige vers l'écran d'autorisation.
app.get('/api/v1/connectors/shopify/install', async (req, res) => {
  try {
    const { shop, timestamp, hmac } = req.query;
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      return res.status(500).send('Clés Shopify non configurées');
    }
    if (!shop || !hmac) {
      return res.status(400).send('Paramètres shop et hmac requis');
    }
    if (!verifyShopifyInstallHmac(req.query || {}, SHOPIFY_API_SECRET)) {
      return res.status(400).send('Signature HMAC invalide');
    }
    const normalizedShop = normalizeShopifyShop(shop);
    if (!normalizedShop) {
      return res.status(400).send('Nom de boutique Shopify invalide');
    }
    const state = crypto.randomUUID();
    try {
      await storeOAuthEphemeralState({
        id: state,
        provider: OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
        flow: OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
        payload: {
          shop: normalizedShop,
          guest: true,
          locale: ['fr', 'en', 'es'].includes(String(req.query?.locale || ''))
            ? String(req.query.locale)
            : 'fr',
        },
        ttlMs: SHOPIFY_OAUTH_STATE_TTL_MS,
      });
    } catch (error) {
      console.error('Shopify install state persistence error:', error);
      return res.status(503).send('Connexion Shopify temporairement indisponible');
    }
    const authUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${encodeURIComponent(
      SHOPIFY_API_KEY
    )}&scope=${encodeURIComponent(SHOPIFY_SCOPES)}&redirect_uri=${encodeURIComponent(
      SHOPIFY_CALLBACK_URL
    )}&state=${encodeURIComponent(state)}&grant_options[]=`;
    res.redirect(302, authUrl);
  } catch (err) {
    console.error('Shopify install error:', err);
    res.status(500).send('Erreur installation Shopify');
  }
});

// Init OAuth: redirige vers l'écran d'autorisation Shopify
app.post('/api/v1/connectors/shopify/connect', authenticateToken, async (req, res) => {
  try {
    const { shop, locale, host } = req.body || {};
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      return res.status(500).json({ message: 'Clés Shopify non configurées côté serveur' });
    }
    if (!shop) {
      return res.status(400).json({ message: 'Paramètre shop requis' });
    }
    const normalizedShop = normalizeShopifyShop(shop);
    if (!normalizedShop) {
      return res.status(400).json({ message: 'Nom de boutique Shopify invalide' });
    }
    const state = crypto.randomUUID();

    // Stocker l'accountId pour l'associer au callback
    try {
      await storeOAuthEphemeralState({
        id: state,
        provider: OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
        flow: OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
        payload: {
          accountId: req.user.accountId,
          userId: req.user.id,
          shop: normalizedShop,
          locale: ['fr', 'en', 'es'].includes(String(locale)) ? String(locale) : 'fr',
          host: typeof host === 'string' ? host.trim() : '',
        },
        ttlMs: SHOPIFY_OAUTH_STATE_TTL_MS,
      });
    } catch (error) {
      console.error('Shopify connect state persistence error:', error);
      return res.status(503).json({ message: 'Connexion Shopify temporairement indisponible' });
    }

    const authUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${encodeURIComponent(
      SHOPIFY_API_KEY
    )}&scope=${encodeURIComponent(SHOPIFY_SCOPES)}&redirect_uri=${encodeURIComponent(
      SHOPIFY_CALLBACK_URL
    )}&state=${encodeURIComponent(state)}&grant_options[]=`;

    res.json({ url: authUrl });
  } catch (err) {
    console.error('Shopify connect error:', err);
    res.status(500).json({ message: 'Erreur lors de l\'init OAuth Shopify' });
  }
});

app.post('/api/v1/marketing/audits/:shareToken/connectors/shopify/connect', async (req, res) => {
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    const { shop } = req.body || {};
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      return res.status(500).json({ message: 'Clés Shopify non configurées côté serveur' });
    }
    if (!shareToken) {
      return res.status(400).json({ message: 'Token audit manquant' });
    }
    if (!shop) {
      return res.status(400).json({ message: 'Paramètre shop requis' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const audits = await prisma.$queryRawUnsafe(`SELECT sharetoken, locale FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1`, shareToken);
    if (!audits?.length) {
      return res.status(404).json({ message: 'Audit introuvable' });
    }
    const normalizedShop = normalizeShopifyShop(shop);
    if (!normalizedShop) {
      return res.status(400).json({ message: 'Nom de boutique Shopify invalide' });
    }
    const state = crypto.randomUUID();
    try {
      await storeOAuthEphemeralState({
        id: state,
        provider: OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
        flow: OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
        payload: {
          shop: normalizedShop,
          guest: true,
          auditShareToken: shareToken,
          locale: audits[0].locale || 'fr',
        },
        ttlMs: SHOPIFY_OAUTH_STATE_TTL_MS,
      });
    } catch (error) {
      console.error('Shopify marketing audit state persistence error:', error);
      return res.status(503).json({ message: 'Connexion Shopify temporairement indisponible' });
    }
    const authUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${encodeURIComponent(
      SHOPIFY_API_KEY
    )}&scope=${encodeURIComponent(SHOPIFY_SCOPES)}&redirect_uri=${encodeURIComponent(
      SHOPIFY_CALLBACK_URL
    )}&state=${encodeURIComponent(state)}&grant_options[]=`;
    res.json({ url: authUrl });
  } catch (err) {
    console.error('Shopify marketing audit connect error:', err);
    res.status(500).json({ message: 'Erreur lors de l init OAuth Shopify' });
  }
});

app.post('/api/v1/marketing/audits/:shareToken/connectors/prestashop/connect', async (req, res) => {
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    const shopUrl = typeof req.body?.shopUrl === 'string' ? req.body.shopUrl.trim() : '';
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    if (!shareToken) {
      return res.status(400).json({ message: 'Token audit manquant' });
    }
    if (!shopUrl || !apiKey) {
      return res.status(400).json({ message: 'URL boutique et cle API PrestaShop requises' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const audits = await prisma.$queryRawUnsafe(`SELECT * FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1`, shareToken);
    if (!audits?.length) {
      return res.status(404).json({ message: 'Audit introuvable' });
    }

    const normalizedShopUrl = /^https?:\/\//i.test(shopUrl) ? shopUrl.replace(/\/+$/, '') : `https://${shopUrl.replace(/\/+$/, '')}`;
    await fetchPrestashopProducts({ baseUrl: normalizedShopUrl, apiKey, limit: 20 });

    const audit = audits[0];
    const input = decryptObjectSecrets(typeof audit.inputjson === 'string' ? JSON.parse(audit.inputjson || '{}') : (audit.inputjson || {}));
    input.prestashopConnection = {
      shopUrl: normalizedShopUrl,
      apiKey,
      connectedAt: new Date().toISOString(),
    };

    await prisma.$executeRawUnsafe(`
      UPDATE marketing_audits
      SET shopurl = COALESCE($1::text, shopurl),
          connectortype = 'PRESTASHOP',
          inputjson = $2::jsonb,
          status = 'source_connected',
          "updatedAt" = NOW()
      WHERE sharetoken = $3::text
    `, normalizedShopUrl, stringifyEncryptedJson(input), shareToken);

    return res.json({
      success: true,
      message: 'Source PrestaShop connectee',
    });
  } catch (error) {
    console.error('Prestashop marketing audit connect error:', error);
    return res.status(500).json({ message: error.message || 'Erreur lors de la connexion PrestaShop' });
  }
});

app.post('/api/v1/marketing/audits/:shareToken/connectors/file/connect', async (req, res) => {
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    const feedUrl = typeof req.body?.feedUrl === 'string' ? req.body.feedUrl.trim() : '';
    if (!shareToken) {
      return res.status(400).json({ message: 'Token audit manquant' });
    }
    if (!feedUrl) {
      return res.status(400).json({ message: 'URL de flux requise' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const audits = await prisma.$queryRawUnsafe(`SELECT * FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1`, shareToken);
    if (!audits?.length) {
      return res.status(404).json({ message: 'Audit introuvable' });
    }

    const normalizedFeedUrl = /^https?:\/\//i.test(feedUrl) ? feedUrl.trim() : `https://${feedUrl.trim()}`;
    await fetchMarketingAuditFileItems({ ...audits[0], shopurl: normalizedFeedUrl }, { csvConnection: { feedUrl: normalizedFeedUrl } });

    const audit = audits[0];
    const input = decryptObjectSecrets(typeof audit.inputjson === 'string' ? JSON.parse(audit.inputjson || '{}') : (audit.inputjson || {}));
    input.csvConnection = {
      feedUrl: normalizedFeedUrl,
      connectedAt: new Date().toISOString(),
    };

    await prisma.$executeRawUnsafe(`
      UPDATE marketing_audits
      SET shopurl = COALESCE($1::text, shopurl),
          connectortype = 'CSV',
          inputjson = $2::jsonb,
          status = 'source_connected',
          "updatedAt" = NOW()
      WHERE sharetoken = $3::text
    `, normalizedFeedUrl, stringifyEncryptedJson(input), shareToken);

    return res.json({
      success: true,
      message: 'Flux CSV/XML connecte',
    });
  } catch (error) {
    console.error('File marketing audit connect error:', error);
    return res.status(500).json({ message: error.message || 'Erreur lors de la connexion du flux' });
  }
});

// Callback OAuth: échange code -> access_token, stockage en base
app.get('/api/v1/connectors/shopify/callback', async (req, res) => {
  try {
    const { shop, code, state } = req.query;
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      return res.status(500).send('Clés Shopify non configurées');
    }
    if (!shop || !code || !state) {
      return res.status(400).send('Requête invalide (shop/code/state manquant)');
    }
    const normalizedShop = normalizeShopifyShop(shop);
    if (!normalizedShop) {
      return res.status(400).send('Nom de boutique Shopify invalide');
    }
    if (!verifyShopifyInstallHmac(req.query || {}, SHOPIFY_API_SECRET)) {
      return res.status(400).send('Signature HMAC Shopify invalide');
    }

    let oauthContext = null;
    try {
      oauthContext = await consumeOAuthEphemeralState({
        id: String(state),
        provider: OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
        flow: OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
      });
    } catch (error) {
      console.error('Shopify callback state lookup error:', error);
      return res.status(503).send('Connexion Shopify temporairement indisponible');
    }
    if (!oauthContext?.shop || String(oauthContext.shop).toLowerCase() !== normalizedShop.toLowerCase()) {
      return res.status(400).send('State OAuth Shopify invalide ou expiré');
    }

    const tokenUrl = `https://${normalizedShop}/admin/oauth/access_token`;
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      console.error('Shopify token exchange failed:', tokenResp.status, text);
      return res.status(502).send('Échec échange de token Shopify');
    }
    const tokenJson = await tokenResp.json();
    // tokenJson: { access_token, scope }

    // Stocker le token en base de données
    const isGuestInstall = oauthContext && oauthContext.guest === true;
    if (prismaReady && prisma && (oauthContext || isGuestInstall)) {
      try {
        const credId = crypto.randomUUID();
        const now = new Date().toISOString();
        const secretData = stringifyEncryptedJson({
          accessToken: tokenJson.access_token,
          scope: tokenJson.scope,
          shop: normalizedShop,
        });

        await prisma.$executeRawUnsafe(`
          INSERT INTO "Credential" (id, name, connector, secretjson, createdat, updatedat)
          VALUES ($1::text, $2::text, 'SHOPIFY'::text, $3::jsonb, $4::timestamptz, $4::timestamptz)
          ON CONFLICT (id) DO UPDATE SET secretjson = $3::jsonb, updatedat = $4::timestamptz
        `, credId, `Shopify - ${normalizedShop}`, secretData, now);

        if (!isGuestInstall && oauthContext && oauthContext.accountId) {
          // Flux Connect depuis FeedPlug : créer la source et le feed liés au compte
          const sourceId = crypto.randomUUID();
          const feedId = crypto.randomUUID();
          const sourceName = 'Shopify - ' + normalizedShop;
          const configData = JSON.stringify({ shop: normalizedShop });
          const mappingData = JSON.stringify({
            id: 'id',
            title: 'title',
            link: 'handle',
          });
          await prisma.$executeRawUnsafe(`
            INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, credentialid, accountid, createdat, updatedat)
            VALUES ($1::text, $2::text, 'SHOPIFY'::text, $3::jsonb, 'DAILY'::text, 'ACTIVE'::text, $4::text, $5::text, $6::timestamptz, $6::timestamptz)
          `, sourceId, sourceName, configData, credId, oauthContext.accountId, now);
          await prisma.$executeRawUnsafe(`
            INSERT INTO "Feed" (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, createdat, updatedat, accountid)
            VALUES ($1::text, $2::text, $3::text, 'DAILY'::text, 'ACTIVE'::text, $4::jsonb, 'guid_or_url'::text, $5::timestamptz, $5::timestamptz, $6::text)
          `, feedId, 'Flux principal - ' + sourceName, sourceId, mappingData, now, oauthContext.accountId);
          console.log('✅ Shopify credential + source + feed créés pour ' + normalizedShop + ' (account: ' + oauthContext.accountId + ')');
        } else if (isGuestInstall && !oauthContext?.auditShareToken) {
          // Install depuis Shopify App Store : auto-provision un Account
          // FeedPlug pour que le merchant soit utilisable immédiatement
          // (requis pour Built for Shopify : pas d'étape de signup séparée).
          try {
            const provision = await shopifyProvisioning.provisionAccountFromShopify({
              prisma,
              shop: normalizedShop,
              accessToken: tokenJson.access_token,
              credentialId: credId,
            });
            if (provision.provisioned) {
              console.log(`✅ Shopify auto-provisioning : Account ${provision.accountId} créé pour ${normalizedShop}`);
            } else if (provision.existing && provision.accountId) {
              console.log(`✅ Shopify auto-provisioning : Account ${provision.accountId} déjà existant pour ${normalizedShop} (${provision.reason})`);
            } else {
              console.log(`ℹ️ Shopify auto-provisioning skipped pour ${normalizedShop} : ${provision.reason}`);
            }
          } catch (provisionErr) {
            // On dégrade vers le flow guest classique : credential créé mais
            // pas de compte. Le merchant pourra claim manuellement.
            console.warn('⚠️ Shopify auto-provisioning échoué pour ' + normalizedShop + ':', provisionErr?.message || provisionErr);
          }
        } else {
          // Flux install via lien Partners (guest) AVEC audit ou autre contexte non-provisionnable
          console.log(`✅ Shopify credential créé pour ${normalizedShop} (en attente de liaison)`);
          if (oauthContext?.auditShareToken) {
            try {
              const audits = await prisma.$queryRawUnsafe(`SELECT * FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1`, oauthContext.auditShareToken);
              if (audits?.length) {
                const audit = audits[0];
                const input = decryptObjectSecrets(typeof audit.inputjson === 'string' ? JSON.parse(audit.inputjson || '{}') : (audit.inputjson || {}));
                input.shopifyConnection = {
                  shop: normalizedShop,
                  credentialId: credId,
                  connectedAt: now,
                };
                await prisma.$executeRawUnsafe(`
                  UPDATE marketing_audits
                  SET shopurl = COALESCE($1::text, shopurl),
                      connectortype = 'SHOPIFY',
                      inputjson = $2::jsonb,
                      status = 'source_connected',
                      "updatedAt" = NOW()
                  WHERE sharetoken = $3::text
                `, `https://${normalizedShop}`, stringifyEncryptedJson(input), oauthContext.auditShareToken);
              }
            } catch (auditUpdateError) {
              console.warn('⚠️ Impossible de lier la connexion Shopify à l audit public:', auditUpdateError.message);
            }
          }
        }
      } catch (dbErr) {
        console.error('Erreur stockage credential Shopify:', dbErr.message);
      }
    } else if (!oauthContext && !isGuestInstall) {
      console.warn('⚠️ Token Shopify reçu mais pas pu stocker en DB (prisma non ready ou context manquant)');
    }

    const resolvedLocale = ['fr', 'en', 'es'].includes(String(oauthContext?.locale || ''))
      ? String(oauthContext.locale)
      : 'fr';
    const resolvedHost = typeof req.query?.host === 'string' && req.query.host.trim()
      ? req.query.host.trim()
      : (typeof oauthContext?.host === 'string' ? oauthContext.host.trim() : '');

    // Quand l'install vient de Shopify (App Store / lien Partners / app embedded),
    // on doit rediriger DANS Shopify Admin pour que l'app se charge dans l'iframe.
    // Une redirection vers APP_URL standalone casse l'expérience embedded et
    // déclenche un rejet "doesn't stay within the iframe" lors de la review BFS.
    //
    // Le flux audit-flux (audit public) garde un redirect direct vers APP_URL
    // car ce n'est pas un contexte embedded Shopify.
    const cameFromShopifyAdmin = isGuestInstall || Boolean(resolvedHost);
    const isAuditFlow = Boolean(oauthContext?.auditShareToken);

    let redirectUrl;
    if (cameFromShopifyAdmin && !isAuditFlow && SHOPIFY_API_KEY) {
      // Redirige vers l'URL canonique de l'app embedded dans Shopify Admin.
      // Format : https://{shop}/admin/apps/{api_key}
      // Shopify Admin charge alors notre iframe avec les bons paramètres host/embedded.
      const embeddedParams = new URLSearchParams({
        shopify: 'connected',
        shop: normalizedShop,
      });
      if (isGuestInstall) embeddedParams.set('guest', '1');
      redirectUrl = `https://${normalizedShop}/admin/apps/${encodeURIComponent(SHOPIFY_API_KEY)}?${embeddedParams.toString()}`;
    } else if (isAuditFlow) {
      redirectUrl = `${APP_URL}/${resolvedLocale}/audit-flux/${encodeURIComponent(oauthContext.auditShareToken)}?shopify=connected`;
    } else {
      // Install initié depuis feedplug.com (user déjà loggué, pas de contexte Shopify Admin) :
      // retour direct sur le dashboard FeedPlug.
      const redirectParams = new URLSearchParams({
        shopify: 'connected',
        shop: normalizedShop,
      });
      if (isGuestInstall) {
        redirectParams.set('guest', '1');
      }
      if (resolvedHost) {
        redirectParams.set('host', resolvedHost);
        redirectParams.set('embedded', '1');
      }
      redirectUrl = `${APP_URL}/${resolvedLocale}/sources?${redirectParams.toString()}`;
    }
    res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('Shopify callback error:', err);
    res.status(500).send('Erreur callback Shopify');
  }
});

// Lier une credential Shopify "en attente" (install via lien Partners) au compte courant
app.post('/api/v1/connectors/shopify/claim', authenticateToken, async (req, res) => {
  try {
    const { shop } = req.body;
    if (!shop || !prismaReady || !prisma) {
      return res.status(400).json({ message: 'Paramètre shop requis ou base indisponible' });
    }
    const normalizedShop = normalizeShopifyShop(shop);
    if (!normalizedShop) {
      return res.status(400).json({ message: 'Nom de boutique Shopify invalide' });
    }
    const accountId = req.user.accountId;
    const creds = await prisma.$queryRawUnsafe(`
      SELECT c.id FROM "Credential" c
      WHERE c.connector = 'SHOPIFY' AND c.secretjson->>'shop' = $1
      AND NOT EXISTS (SELECT 1 FROM "FeedSource" f WHERE f."credentialid" = c.id)
      LIMIT 1
    `, normalizedShop);
    if (!creds || creds.length === 0) {
      return res.status(404).json({ message: 'Aucune connexion Shopify en attente pour cette boutique' });
    }
    const credId = creds[0].id;
    const sourceId = crypto.randomUUID();
    const feedId = crypto.randomUUID();
    const sourceName = 'Shopify - ' + normalizedShop;
    const configData = JSON.stringify({ shop: normalizedShop });
    const mappingData = JSON.stringify({
      id: 'id',
      title: 'title',
      link: 'handle',
    });
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, credentialid, accountid, createdat, updatedat)
      VALUES ($1::text, $2::text, 'SHOPIFY'::text, $3::jsonb, 'DAILY'::text, 'ACTIVE'::text, $4::text, $5::text, $6::timestamptz, $6::timestamptz)
    `, sourceId, sourceName, configData, credId, accountId, now);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Feed" (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, createdat, updatedat, accountid)
      VALUES ($1::text, $2::text, $3::text, 'DAILY'::text, 'ACTIVE'::text, $4::jsonb, 'guid_or_url'::text, $5::timestamptz, $5::timestamptz, $6::text)
    `, feedId, 'Flux principal - ' + sourceName, sourceId, mappingData, now, accountId);
    console.log(`✅ Shopify source liée pour ${normalizedShop} (account: ${accountId})`);
    res.json({ ok: true, shop: normalizedShop });
  } catch (err) {
    console.error('Shopify claim error:', err);
    res.status(500).json({ message: 'Erreur lors de la liaison' });
  }
});

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
app.post('/api/v1/billing/shopify/subscribe', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const accountId = req.user.accountId;
    // `plan` est OPTIONNEL : Managed Pricing redirige de toute façon vers la
    // page de sélection Shopify (pas de deep-link plan possible). On accepte
    //  - sans plan : on ouvre juste la page de sélection (choix + approbation
    //    en une seule fois côté Shopify) — pas de trace PENDING.
    //  - avec plan : on valide le handle et on trace l'intention en DB.
    const planHandleRaw = String(req.body?.plan || '').trim().toLowerCase();
    const plan = planHandleRaw ? shopifyManagedPricing.getPlan(planHandleRaw) : null;
    if (planHandleRaw && !plan) {
      return res.status(400).json({
        message: 'Plan inconnu. Valeurs valides : starter, pro, business, premium.',
      });
    }

    const credential = await findShopifyCredentialForAccount(accountId);
    if (!credential) {
      return res.status(409).json({
        message: 'Boutique Shopify non connectée.',
      });
    }

    const confirmationUrl = shopifyManagedPricing.buildManagedPricingUrl({
      shop: credential.shop,
      planHandle: plan ? plan.handle : undefined,
    });

    // Trace la tentative en DB (status PENDING) uniquement si un plan précis a
    // été cliqué. Le subscription_id réel est attribué par Shopify lors de
    // l'approbation et nous arrive via webhook app_subscriptions/update.
    if (plan) {
      await shopifyBilling.upsertShopifySubscription({
        prisma,
        row: {
          accountId,
          shopDomain: credential.shop,
          shopifySubscriptionId: `pending_${accountId}_${plan.handle}_${Date.now()}`,
          planKey: plan.handle.toUpperCase(),
          priceAmount: plan.priceEur,
          currency: 'EUR',
          interval: 'EVERY_30_DAYS',
          status: 'PENDING',
          trialDays: plan.trialDays || 0,
          confirmationUrl,
          returnUrl: null,
          testMode: process.env.NODE_ENV !== 'production',
        },
      });
    }

    return res.json({
      confirmationUrl,
      plan: plan ? plan.handle : null,
      priceEur: plan ? plan.priceEur : null,
    });
  } catch (err) {
    console.error('Shopify managed pricing subscribe error:', err);
    return res.status(500).json({ message: 'Erreur création abonnement Shopify', detail: err?.message });
  }
});

// GET /return — appelé par Shopify après que le merchant approuve l'abonnement
// Met à jour le status localement, puis redirige vers l'app embedded.
app.get('/api/v1/billing/shopify/return', async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).send('Service indisponible');
    }
    const accountId = String(req.query.account || '').trim();
    if (!accountId) {
      return res.status(400).send('account manquant');
    }

    const subRow = await shopifyBilling.findActiveSubscriptionForAccount({ prisma, accountId });
    if (!subRow) {
      return res.status(404).send('Aucune subscription en attente');
    }

    const credential = await findShopifyCredentialForAccount(accountId);
    if (credential) {
      try {
        const fresh = await shopifyBilling.getAppSubscription({
          shop: credential.shop,
          accessToken: credential.accessToken,
          subscriptionId: subRow.shopify_subscription_id,
        });
        if (fresh?.status) {
          await shopifyBilling.markShopifySubscriptionStatus({
            prisma,
            shopifySubscriptionId: subRow.shopify_subscription_id,
            status: fresh.status,
            currentPeriodEnd: fresh.currentPeriodEnd,
          });
          if (fresh.status === 'ACTIVE') {
            await prisma.$executeRawUnsafe(
              `
                UPDATE "Account"
                SET plan = $2::text,
                    billing_provider = 'SHOPIFY'::text,
                    billingstatus = 'active'::text,
                    paymentgraceuntil = NULL,
                    updatedat = NOW()
                WHERE id = $1::text
              `,
              accountId,
              subRow.plan_key
            );
          }
        }
      } catch (verifyErr) {
        console.warn('Shopify billing return verify failed:', verifyErr?.message);
      }
    }

    const shopForRedirect = subRow.shop_domain;
    if (SHOPIFY_API_KEY && shopForRedirect) {
      return res.redirect(302, `https://${shopForRedirect}/admin/apps/${encodeURIComponent(SHOPIFY_API_KEY)}?billing=ok`);
    }
    return res.redirect(302, `${APP_URL}/fr/facturation?shopify=connected`);
  } catch (err) {
    console.error('Shopify billing return error:', err);
    return res.status(500).send('Erreur traitement retour Shopify Billing');
  }
});

// POST /cancel — annule la subscription Shopify active du compte
// GET /current — état de la subscription Shopify active du compte
app.get('/api/v1/billing/shopify/current', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const sub = await shopifyBilling.findActiveSubscriptionForAccount({
      prisma,
      accountId: req.user.accountId,
    });
    if (!sub) {
      return res.json({ active: false });
    }
    return res.json({
      active: sub.status === 'ACTIVE' || sub.status === 'PENDING',
      subscriptionId: sub.shopify_subscription_id,
      planKey: sub.plan_key,
      priceAmount: Number(sub.price_amount),
      currency: sub.currency,
      interval: sub.interval,
      status: sub.status,
      trialEndsAt: sub.trial_ends_at,
      currentPeriodEnd: sub.current_period_end,
      testMode: sub.test_mode === true,
    });
  } catch (err) {
    console.error('Shopify billing current error:', err);
    return res.status(500).json({ message: 'Erreur récupération abonnement', detail: err?.message });
  }
});

app.post('/api/v1/billing/shopify/cancel', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const accountId = req.user.accountId;
    const subRow = await shopifyBilling.findActiveSubscriptionForAccount({ prisma, accountId });
    if (!subRow) {
      return res.status(404).json({ message: 'Aucune subscription Shopify active' });
    }
    const credential = await findShopifyCredentialForAccount(accountId);
    const subId = subRow.shopify_subscription_id || '';
    const isPendingPlaceholder = subId.startsWith('pending_');

    // Cas 1 : sub PENDING (placeholder, jamais approuvée) ou pas de credential valide
    //         → on annule juste localement, pas de call Shopify (qui échouerait
    //         de toutes façons : pas de subscription Shopify à annuler).
    // Cas 2 : sub ACTIVE avec credential valide → on call Shopify pour annuler.
    if (!isPendingPlaceholder && credential) {
      try {
        await shopifyBilling.cancelAppSubscription({
          shop: credential.shop,
          accessToken: credential.accessToken,
          subscriptionId: subId,
          prorate: Boolean(req.body?.prorate),
        });
      } catch (cancelErr) {
        // Si le token est invalide (merchant a désinstallé puis revenu) ou la
        // sub n'existe plus côté Shopify, on tombe quand même en CANCELLED
        // localement plutôt que de bloquer le merchant.
        console.warn('Shopify cancel API failed, marking cancelled locally only:', cancelErr?.message || cancelErr);
      }
    }

    await shopifyBilling.markShopifySubscriptionStatus({
      prisma,
      shopifySubscriptionId: subId,
      status: 'CANCELLED',
      cancelled: true,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Shopify billing cancel error:', err);
    return res.status(500).json({ message: 'Erreur annulation', detail: err?.message });
  }
});

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
app.get('/api/v1/embedded/sources/overview', authenticateJwtOrShopifySession, async (req, res) => {
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

// Vérification d'accès Shopify (ping Admin API)
app.get('/api/v1/connectors/shopify/verify', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const requestedShop = typeof req.query?.shop === 'string' ? req.query.shop.trim() : '';
    const normalizedShop = requestedShop ? normalizeShopifyShop(requestedShop) : '';
    if (requestedShop && !normalizedShop) {
      return res.status(400).json({ message: 'Nom de boutique Shopify invalide' });
    }

    const rows = normalizedShop
      ? await prisma.$queryRawUnsafe(
          `
            SELECT c.secretjson
            FROM "Credential" c
            JOIN "FeedSource" s ON s.credentialid = c.id
            WHERE c.connector = 'SHOPIFY'::text
              AND s.accountid = $1::text
              AND c.secretjson->>'shop' = $2::text
            ORDER BY c.createdat DESC
            LIMIT 1
          `,
          req.user.accountId,
          normalizedShop
        )
      : await prisma.$queryRawUnsafe(
          `
            SELECT c.secretjson
            FROM "Credential" c
            JOIN "FeedSource" s ON s.credentialid = c.id
            WHERE c.connector = 'SHOPIFY'::text
              AND s.accountid = $1::text
            ORDER BY c.createdat DESC
            LIMIT 1
          `,
          req.user.accountId
        );

    if (!rows?.length) {
      return res.status(404).json({ message: 'Aucune boutique Shopify connectée pour ce compte' });
    }

    const secret = decryptObjectSecrets(
      typeof rows[0].secretjson === 'string' ? JSON.parse(rows[0].secretjson) : rows[0].secretjson
    );
    const accessToken = secret.accessToken || secret.access_token || '';
    const resolvedShop = normalizeShopifyShop(secret.shop || normalizedShop);
    if (!resolvedShop || !accessToken) {
      return res.status(409).json({ message: 'Connexion Shopify incomplète, reconnectez la boutique' });
    }

    const resp = await fetch(buildShopifyAdminGraphqlUrl(resolvedShop), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': String(accessToken),
      },
      body: JSON.stringify({ query: '{ shop { name } }' }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(resp.status).json({
        message: 'Erreur de verification Shopify',
        detail: json,
        shop: resolvedShop,
        apiVersion: SHOPIFY_ADMIN_API_VERSION,
      });
    }
    res.json({
      ok: true,
      shop: resolvedShop,
      apiVersion: SHOPIFY_ADMIN_API_VERSION,
      data: json.data || json,
    });
  } catch (err) {
    console.error('Shopify verify error:', err);
    res.status(500).json({ message: 'Erreur vérification Shopify' });
  }
});

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
}

} // fin run()

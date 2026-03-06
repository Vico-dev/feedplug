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
  app.use(express.json({ limit: '10mb' }));
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
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { sendWelcomeEmail, sendSyncCompleteEmail, sendExportCompleteEmail, sendErrorEmail, sendPasswordResetEmail, sendInvitationEmail } = require('./email/email-service');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const { Storage } = require('@google-cloud/storage');
const { withTimeout } = require('./lib/resilience');
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

// Initialiser Prisma Client
let prisma;
let prismaReady = false;
// Ingestion handlers
const { ingestCsvFromUrl } = require('./ingestion/csv');
const { ingestShopifyFromApi } = require('./ingestion/shopify');
// Scoring handlers - Nouveau système avancé multi-dimensionnel
const { 
  updateAdvancedQualityScore, 
  getAdvancedQualityScore,
  calculateAdvancedQualityScore 
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

// Fonction d'initialisation de Prisma
const initPrisma = async () => {
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
    
    // Augmenter le timeout de connexion
    prisma.$connect = prisma.$connect || (() => Promise.resolve());

    console.log('🔍 DATABASE_URL format:', process.env.DATABASE_URL ? 
      process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@').substring(0, 100) + '...' : 
      'NOT SET');

    await prisma.$connect();
    console.log('✅ Prisma connected successfully');
    
    // Tester une requête simple pour vérifier que la connexion fonctionne
    try {
      await prisma.$queryRaw`SELECT 1 as test`;
      console.log('✅ Database connection test successful');
    } catch (testError) {
      console.error('❌ Database connection test failed:', testError.message);
      throw testError;
    }

    // Vérifier si la table marketing_leads existe, sinon la créer
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'marketing_leads'
        )
      `;
      
      if (!tableExists[0].exists) {
        console.log('🔧 Création de la table marketing_leads...');
        try {
          await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS marketing_leads (
              id TEXT PRIMARY KEY,
              "firstName" TEXT NOT NULL,
              "lastName" TEXT NOT NULL,
              "jobTitle" TEXT NOT NULL,
              phone TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL,
              company TEXT NOT NULL,
              "ipAddress" TEXT,
              "userAgent" TEXT,
              locale TEXT,
              source TEXT,
              status TEXT DEFAULT 'new',
              notes TEXT,
              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
          `);
          await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS marketing_leads_email_idx ON marketing_leads(email)`);
          await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS marketing_leads_createdAt_idx ON marketing_leads("createdAt")`);
          await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS marketing_leads_status_idx ON marketing_leads(status)`);
          
          console.log('✅ Table marketing_leads créée avec succès');
        } catch (createError) {
          console.error('❌ Erreur lors de la création de la table:', createError.message);
          throw createError;
        }
      }
    } catch (checkError) {
      console.warn('⚠️  Erreur lors de la vérification de la table marketing_leads:', checkError.message);
    }

    // Appliquer migrations ingestion si présentes
    try {
      const migrationPath = path.join(__dirname, 'prisma', 'migrations', '002_ingestion_models.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('🔧 Application de la migration ingestion (002)...');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        const statements = sql
          .split(/;\s*\n/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
          try {
            await prisma.$executeRawUnsafe(stmt);
          } catch (e) {
            // Ignorer les erreurs non-critiques sur IF NOT EXISTS répétés
            const msg = (e && e.message) ? e.message : String(e);
            if (!/already exists|IF NOT EXISTS|duplicate/i.test(msg)) {
              console.warn('⚠️  Migration ingestion statement error:', msg.substring(0, 200));
            }
          }
        }
        console.log('✅ Migration ingestion appliquée (ou déjà en place)');
      } else {
        console.log('ℹ️  Migration 002 non trouvée, on continue');
      }
    } catch (migErr) {
      console.warn('⚠️  Erreur lors de l\'application de la migration ingestion:', migErr?.message || migErr);
    }
    
    // Vérifier et créer les colonnes manquantes pour les tables ingestion
    try {
      // FeedSource
      const feedSourceColumns = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'FeedSource' AND table_schema = 'public'
      `;
      const feedSourceColumnNames = feedSourceColumns.map(c => c.column_name.toLowerCase());
      
      const feedSourceRequiredColumns = [
        { name: 'configjson', type: 'JSONB NOT NULL DEFAULT \'{}\'::jsonb' },
        { name: 'defaultfreq', type: 'TEXT NOT NULL DEFAULT \'DAILY\'' },
        { name: 'status', type: 'TEXT NOT NULL DEFAULT \'ACTIVE\'' },
        { name: 'lastrunat', type: 'TIMESTAMPTZ' },
        { name: 'createdat', type: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()' },
        { name: 'updatedat', type: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()' },
        { name: 'credentialid', type: 'TEXT' },
        { name: 'scheduletime', type: 'TEXT' } // Heure de mise à jour au format HH:MM (ex: "02:00")
      ];
      
      for (const col of feedSourceRequiredColumns) {
        if (!feedSourceColumnNames.includes(col.name.toLowerCase())) {
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "FeedSource" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`);
            console.log(`✅ Colonne FeedSource.${col.name} ajoutée`);
          } catch (alterError) {
            console.warn(`⚠️  Erreur lors de l'ajout de FeedSource.${col.name}:`, alterError.message.substring(0, 100));
          }
        }
      }
      
        // Feed
      const feedColumns = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Feed' AND table_schema = 'public'
      `;
      const feedColumnNames = feedColumns.map(c => c.column_name);
      
      const feedRequiredColumns = [
        { name: 'sourceId', type: 'TEXT NOT NULL' },
        { name: 'mappingJson', type: 'JSONB NOT NULL DEFAULT \'{}\'::jsonb' },
        { name: 'frequency', type: 'TEXT NOT NULL DEFAULT \'DAILY\'' },
        { name: 'status', type: 'TEXT NOT NULL DEFAULT \'ACTIVE\'' },
        { name: 'dedupStrategy', type: 'TEXT NOT NULL DEFAULT \'guid_or_url\'' },
        { name: 'createdAt', type: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()' },
        { name: 'updatedAt', type: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()' }
      ];
      
      for (const col of feedRequiredColumns) {
        if (!feedColumnNames.includes(col.name)) {
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Feed" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`);
            console.log(`✅ Colonne Feed.${col.name} ajoutée`);
          } catch (alterError) {
            console.warn(`⚠️  Erreur lors de l'ajout de Feed.${col.name}:`, alterError.message.substring(0, 100));
          }
        }
      }
      
        // FeedItem
        const feedItemColumns = await prisma.$queryRaw`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'FeedItem' AND table_schema = 'public'
        `;
        const feedItemColumnNames = feedItemColumns.map(c => c.column_name.toLowerCase());
        
        const feedItemRequiredColumns = [
          { name: 'gtin', type: 'TEXT' },
          { name: 'mpn', type: 'TEXT' },
          { name: 'condition', type: 'TEXT' },
          { name: 'customfields', type: 'JSONB' }
        ];
        
        for (const col of feedItemRequiredColumns) {
          if (!feedItemColumnNames.includes(col.name.toLowerCase())) {
            try {
              await prisma.$executeRawUnsafe(`ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
              console.log(`✅ Colonne FeedItem.${col.name} ajoutée`);
            } catch (alterError) {
              console.warn(`⚠️  Erreur lors de l'ajout de FeedItem.${col.name}:`, alterError.message.substring(0, 100));
            }
          }
        }
        
      console.log('✅ Vérification des colonnes ingestion terminée');
    } catch (checkError) {
      console.warn('⚠️  Erreur lors de la vérification des colonnes:', checkError.message);
    }

    // Migration 011 : colonne avg_score_after sur IngestionRun (évolution score dashboard)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "IngestionRun" ADD COLUMN IF NOT EXISTS avg_score_after INT
      `);
      console.log('✅ IngestionRun.avg_score_after vérifiée');
    } catch (m011Err) {
      console.warn('⚠️  Migration 011 (avg_score_after):', m011Err.message?.substring(0, 80));
    }

    // Vérifier que les tables de scoring existent (ProductScore, PerformanceChannel)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProductScore" (
          id TEXT PRIMARY KEY,
          itemid TEXT NOT NULL UNIQUE REFERENCES "FeedItem"(id) ON DELETE CASCADE,
          qualityscore INTEGER NOT NULL DEFAULT 0 CHECK (qualityscore >= 0 AND qualityscore <= 100),
          performancescore INTEGER NOT NULL DEFAULT 0 CHECK (performancescore >= 0 AND performancescore <= 100),
          qualitydetails JSONB,
          performancedetails JSONB,
          updatedat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          createdat TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_productscore_itemid ON "ProductScore"(itemid)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_productscore_quality ON "ProductScore"(qualityscore)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_productscore_performance ON "ProductScore"(performancescore)`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PerformanceChannel" (
          id TEXT PRIMARY KEY,
          scoreid TEXT NOT NULL REFERENCES "ProductScore"(id) ON DELETE CASCADE,
          channel TEXT NOT NULL CHECK (channel IN ('GOOGLE_ADS','META_ADS','AMAZON','MIRAKL','SHOPIFY','OTHER')),
          metrics JSONB NOT NULL,
          channelscore INTEGER NOT NULL DEFAULT 0 CHECK (channelscore >= 0 AND channelscore <= 100),
          period TEXT NOT NULL,
          date TIMESTAMPTZ NOT NULL,
          createdat TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_perfchannel_scoreid ON "PerformanceChannel"(scoreid)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_perfchannel_channel ON "PerformanceChannel"(channel)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_perfchannel_date ON "PerformanceChannel"(date)`);

      // Table d'historique des perfs (une ligne par produit, canal, jour) — rétention 90 j, purge quotidienne
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PerformanceChannelHistory" (
          id TEXT PRIMARY KEY,
          scoreid TEXT NOT NULL REFERENCES "ProductScore"(id) ON DELETE CASCADE,
          channel TEXT NOT NULL CHECK (channel IN ('GOOGLE_ADS','META_ADS','AMAZON','MIRAKL','SHOPIFY','OTHER')),
          period TEXT NOT NULL,
          date DATE NOT NULL,
          metrics JSONB NOT NULL,
          channelscore INTEGER NOT NULL DEFAULT 0 CHECK (channelscore >= 0 AND channelscore <= 100),
          createdat TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_perfhistory_unique ON "PerformanceChannelHistory" (scoreid, channel, period, date)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_perfhistory_scoreid ON "PerformanceChannelHistory"(scoreid)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_perfhistory_channel ON "PerformanceChannelHistory"(channel)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_perfhistory_date ON "PerformanceChannelHistory"(date)`);

      console.log('✅ Tables de scoring vérifiées');
    } catch (scoringError) {
      console.warn('⚠️  Erreur lors de la vérification des tables de scoring:', scoringError.message);
    }

    // Migration 014 : Rule, FeedItemRevision, BulkEditOperation (moteur de règles + historisation)
    try {
      const migration014Path = path.join(__dirname, 'prisma', 'migrations', '014_rules_revisions_bulk_edit.sql');
      if (fs.existsSync(migration014Path)) {
        console.log('🔧 Application de la migration 014 (règles, révisions, bulk edit)...');
        const sql = fs.readFileSync(migration014Path, 'utf8');
        const statements = sql
          .split(/;\s*\n/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
          try {
            await prisma.$executeRawUnsafe(stmt);
          } catch (e) {
            const msg = (e && e.message) ? e.message : String(e);
            if (!/already exists|IF NOT EXISTS|duplicate/i.test(msg)) {
              console.warn('⚠️  Migration 014 statement:', msg.substring(0, 150));
            }
          }
        }
        console.log('✅ Migration 014 appliquée (ou déjà en place)');
      }
    } catch (m014Err) {
      console.warn('⚠️  Migration 014:', m014Err?.message?.substring(0, 100));
    }

    // Migration 015 : sources secondaires d'enrichissement
    try {
      const migration015Path = path.join(__dirname, 'prisma', 'migrations', '015_enrichment_source.sql');
      if (fs.existsSync(migration015Path)) {
        console.log('🔧 Application de la migration 015 (EnrichmentSource)...');
        const sql = fs.readFileSync(migration015Path, 'utf8');
        const statements = sql
          .split(/;\s*\n/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
          try {
            await prisma.$executeRawUnsafe(stmt);
          } catch (e) {
            const msg = (e && e.message) ? e.message : String(e);
            if (!/already exists|IF NOT EXISTS|duplicate/i.test(msg)) {
              console.warn('⚠️  Migration 015 statement:', msg.substring(0, 150));
            }
          }
        }
        console.log('✅ Migration 015 appliquée (ou déjà en place)');
      }
    } catch (m015Err) {
      console.warn('⚠️  Migration 015:', m015Err?.message?.substring(0, 100));
    }

    // Migration 018 : tests A/B (témoin + variant)
    try {
      const migration018Path = path.join(__dirname, 'prisma', 'migrations', '018_ab_test.sql');
      if (fs.existsSync(migration018Path)) {
        const sql = fs.readFileSync(migration018Path, 'utf8');
        const statements = sql
          .split(/;\s*\n/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
          try {
            await prisma.$executeRawUnsafe(stmt + (stmt.endsWith(';') ? '' : ';'));
          } catch (e) {
            const msg = (e && e.message) ? e.message : String(e);
            if (!/already exists|IF NOT EXISTS|duplicate|does not exist/i.test(msg)) {
              console.warn('⚠️  Migration 018 statement:', msg.substring(0, 150));
            }
          }
        }
        console.log('✅ Migration 018 (AB tests) appliquée ou déjà en place');
      }
    } catch (m018Err) {
      console.warn('⚠️  Migration 018:', m018Err?.message?.substring(0, 100));
    }

    // Enregistrer les routes du module Optimiser (règles IF-THEN)
    try {
      registerRulesRoutes(app, prisma, () => prismaReady);
      console.log('✅ Routes Optimiser (rules) enregistrées');
    } catch (rulesErr) {
      console.warn('⚠️  Enregistrement routes rules:', rulesErr?.message);
    }

    prismaReady = true;
    return true;
  } catch (error) {
    console.error('⚠️  Prisma initialization error:', error.message);
    console.error('⚠️  Error details:', {
      code: error.code,
      meta: error.meta,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    console.warn('⚠️  Falling back to in-memory storage');
    prismaReady = false;
    return false;
  }
};

// Stockage en mémoire (fallback si Prisma n'est pas disponible)
const inMemoryLeads = [];

// Initialiser Prisma au démarrage (non-bloquant)
initPrisma().catch(err => {
  console.error('❌ Error initializing Prisma:', err);
  console.error('❌ Full error:', JSON.stringify({
    message: err.message,
    code: err.code,
    meta: err.meta,
    name: err.name
  }, null, 2));
  prismaReady = false;
});

// Réessayer l'initialisation toutes les 30 secondes si Prisma n'est pas prêt
setInterval(async () => {
  if (!prismaReady) {
    console.log('🔄 Réessai d\'initialisation de Prisma...');
    try {
      await initPrisma();
      if (prismaReady) {
        console.log('✅ Prisma initialisé avec succès après réessai');
      }
    } catch (err) {
      console.error('❌ Échec du réessai d\'initialisation de Prisma:', err.message);
    }
  }
}, 30000); // Toutes les 30 secondes

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

// Store pour tracker les échecs de connexion par IP
const loginFailures = new Map();

// Fonction pour obtenir l'IP réelle
const getClientIp = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         'unknown';
};

// Fonctions utilitaires pour gérer les échecs de connexion
const recordLoginFailure = (clientIp) => {
  const now = Date.now();
  if (!loginFailures.has(clientIp)) {
    loginFailures.set(clientIp, { attempts: [] });
  }
  loginFailures.get(clientIp).attempts.push(now);
};

const recordLoginSuccess = (clientIp) => {
  loginFailures.delete(clientIp);
};

const isBlocked = (clientIp) => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxFailures = 5;
  
  if (!loginFailures.has(clientIp)) {
    return { blocked: false };
  }
  
  const failures = loginFailures.get(clientIp);
  failures.attempts = failures.attempts.filter(time => now - time < windowMs);
  
  if (failures.attempts.length === 0) {
    loginFailures.delete(clientIp);
    return { blocked: false };
  }
  
  if (failures.attempts.length >= maxFailures) {
    const oldestAttempt = failures.attempts[0];
    const remainingTime = Math.ceil((windowMs - (now - oldestAttempt)) / 1000 / 60);
    return { 
      blocked: true, 
      remainingTime 
    };
  }
  
  return { blocked: false };
};

const createSmartAuthLimiter = () => {
  return (req, res, next) => {
    const clientIp = getClientIp(req);
    const blockStatus = isBlocked(clientIp);
    
    if (blockStatus.blocked) {
      return res.status(429).json({ 
        message: `Trop de tentatives de connexion échouées. Réessayez dans ${blockStatus.remainingTime} minute(s).` 
      });
    }
    
    req.clientIp = clientIp;
    next();
  };
};

const smartAuthLimiter = createSmartAuthLimiter();

// Rate limit global sur /api/v1 — ne JAMAIS compter les preflights CORS (OPTIONS ou requête avec Access-Control-Request-Method).
// Les logs montrent des OPTIONS en 429 : elles atteignent le limiter (proxy peut changer la méthode). On les exclut explicitement.
function isPreflightRequest(req) {
  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') return true;
  if (req.headers['access-control-request-method'] && req.headers['origin']) return true;
  return false;
}
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  skip: (req) => isPreflightRequest(req),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  handler: (req, res) => {
    res.status(429).json({ message: 'Trop de requêtes. Réessayez dans une minute.' });
  },
});
app.use('/api/v1', apiRateLimiter);

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

// Store temporaire pour le flow OAuth Amazon (state -> accountId, code -> accountId), TTL 15 min
const amazonOAuthStateStore = new Map();
const amazonConnectCodeStore = new Map();
const AMAZON_STATE_TTL_MS = 15 * 60 * 1000;
function pruneAmazonStateStore() {
  const now = Date.now();
  for (const [k, v] of amazonOAuthStateStore.entries()) {
    if (now - v.createdAt > AMAZON_STATE_TTL_MS) amazonOAuthStateStore.delete(k);
  }
  for (const [k, v] of amazonConnectCodeStore.entries()) {
    if (now - v.createdAt > 5 * 60 * 1000) amazonConnectCodeStore.delete(k);
  }
}
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Helper: chercher un user dans la table User (DB) avec fallback sur testUsers en dev
async function findUserByEmail(email) {
  if (prismaReady && prisma) {
    try {
      const users = await prisma.$queryRawUnsafe(`
        SELECT u.*, a.name as accountname, a.plan as accountplan, a.trialendsat
        FROM "User" u
        JOIN "Account" a ON u.accountid = a.id
        WHERE u.email = $1::text
        LIMIT 1
      `, email);
      if (users && users.length > 0) return users[0];
    } catch (err) {
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
        SELECT u.*, a.name as accountname, a.plan as accountplan, a.trialendsat
        FROM "User" u
        JOIN "Account" a ON u.accountid = a.id
        WHERE u.id = $1::text
        LIMIT 1
      `, id);
      if (users && users.length > 0) return users[0];
    } catch (err) {
      console.warn('Erreur lookup user by ID:', err.message);
    }
  }
  return null;
}

// Stripe webhook AVANT express.json() (nécessite body raw pour signature)
const { registerStripeWebhook } = require('./routes/onboarding-billing');
registerStripeWebhook(app, { getPrisma: () => prisma, getPrismaReady: () => prismaReady });

// Limite 10 MB pour permettre image base64 sur generate-lifestyle-image (évite PayloadTooLargeError)
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Chaos Monkey : injection de pannes (staging uniquement, après avoir appelé POST /chaos/trigger)
app.use('/api/v1', chaos.chaosMiddleware);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token d\'accès requis' });
  }

  jwt.verify(token, EFFECTIVE_JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token invalide' });
    }
    req.user = user;
    req.accountId = user.accountId;
    next();
  });
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

// Middleware : requiert un token JWT valide ET extrait accountId. Bloque si absent.
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentification requise' });
  }

  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    req.user = decoded;
    req.accountId = decoded.accountId;

    if (!req.accountId) {
      return res.status(403).json({ message: 'Compte non associé au token' });
    }

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
app.use('/api/v1/performance', requireAuth);

// Middleware auto-vérification d'ownership pour les routes feeds/:id/*
app.use('/api/v1/ingestion/feeds/:id', async (req, res, next) => {
  // Seulement pour les sous-routes (items, export, runs, etc.)
  if (req.params.id && req.accountId && prismaReady && prisma) {
    const hasAccess = await verifyFeedAccess(req.params.id, req.accountId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Accès refusé à ce flux' });
    }
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

// ====== HEALTH & DIAGNOSTIC ======

const HEALTH_DB_TIMEOUT_MS = 5000;

app.get('/api/v1/health', async (req, res) => {
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

  const healthy = prismaReady && dbOk;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
  });
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

// Endpoint pour nettoyer la table Feed (supprimer les colonnes en double)
app.post('/api/v1/cleanup-feed-table', authenticateToken, requireStaffAccess, async (req, res) => {
  if (!prismaReady || !prisma) {
    return res.status(503).json({ message: 'Prisma non disponible' });
  }

  const results = {
    timestamp: new Date().toISOString(),
    actions: []
  };

  try {
    // Supprimer les colonnes en camelCase (garder uniquement les minuscules)
    const columnsToDrop = ['sourceId', 'mappingJson', 'dedupStrategy', 'createdAt', 'updatedAt'];
    
    for (const col of columnsToDrop) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Feed" DROP COLUMN IF EXISTS "${col}"`);
        results.actions.push({ action: 'drop_column', column: col, status: 'success' });
      } catch (e) {
        results.actions.push({ action: 'drop_column', column: col, status: 'error', message: e.message.substring(0, 100) });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({
      message: 'Erreur lors du nettoyage de la table Feed',
      error: error.message
    });
  }
});

// Endpoint pour forcer la création des colonnes manquantes
app.post('/api/v1/fix-schema', authenticateToken, requireStaffAccess, async (req, res) => {
  if (!prismaReady || !prisma) {
    return res.status(503).json({ message: 'Prisma non disponible' });
  }

  const results = {
    timestamp: new Date().toISOString(),
    fixes: []
  };

  try {
    // Vérifier et créer les colonnes manquantes pour FeedSource
    const feedSourceColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'FeedSource' AND table_schema = 'public'
    `;
    const columnNames = feedSourceColumns.map(c => c.column_name);
    
    // Liste des colonnes nécessaires pour FeedSource
    const feedSourceRequiredColumns = [
      { name: 'configJson', type: 'JSONB NOT NULL DEFAULT \'{}\'::jsonb' },
      { name: 'defaultFreq', type: 'TEXT NOT NULL DEFAULT \'DAILY\'' },
      { name: 'status', type: 'TEXT NOT NULL DEFAULT \'ACTIVE\'' },
      { name: 'lastRunAt', type: 'TIMESTAMPTZ' },
      { name: 'createdAt', type: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()' },
      { name: 'updatedAt', type: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()' },
      { name: 'credentialId', type: 'TEXT' }
    ];
    
    for (const col of feedSourceRequiredColumns) {
      if (!columnNames.includes(col.name)) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "FeedSource" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`);
          results.fixes.push({ table: 'FeedSource', column: col.name, status: 'created' });
        } catch (e) {
          results.fixes.push({ table: 'FeedSource', column: col.name, status: 'error', message: e.message.substring(0, 100) });
        }
      }
    }

    // Vérifier Feed
    const feedColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Feed' AND table_schema = 'public'
    `;
    const feedColumnNames = feedColumns.map(c => c.column_name);
    
    // Liste des colonnes nécessaires pour Feed
    const feedRequiredColumns = [
      { name: 'sourceId', type: 'TEXT NOT NULL' },
      { name: 'mappingJson', type: 'JSONB NOT NULL DEFAULT \'{}\'::jsonb' },
      { name: 'frequency', type: 'TEXT NOT NULL DEFAULT \'DAILY\'' },
      { name: 'status', type: 'TEXT NOT NULL DEFAULT \'ACTIVE\'' },
      { name: 'dedupStrategy', type: 'TEXT NOT NULL DEFAULT \'guid_or_url\'' },
      { name: 'createdAt', type: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()' },
      { name: 'updatedAt', type: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()' }
    ];
    
    for (const col of feedRequiredColumns) {
      if (!feedColumnNames.includes(col.name)) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Feed" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`);
          results.fixes.push({ table: 'Feed', column: col.name, status: 'created' });
        } catch (e) {
          results.fixes.push({ table: 'Feed', column: col.name, status: 'error', message: e.message.substring(0, 100) });
        }
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la correction du schéma',
      error: error.message 
    });
  }
});

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

    const acctId = req.accountId || 'default-account';
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
      const willCreateFeed = connector === 'CSV' || connector === 'SHOPIFY' || connector === 'ERP' || connector === 'PIM';
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
        if (connector === 'CSV' || connector === 'SHOPIFY' || connector === 'ERP' || connector === 'PIM') {
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
    const acctId = req.accountId || 'default-account';
    if (prismaReady && prisma) {
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
    if (prismaReady && prisma) {
      // Utiliser une requête raw pour éviter les problèmes d'enums
      const feeds = await prisma.$queryRawUnsafe(`
        SELECT 
          f.id,
          f.name,
          f.sourceid,
          f.frequency,
          f.status,
          f.mappingjson,
          f.dedupstrategy,
          f.createdat,
          f.updatedat,
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
        WHERE f.accountid = $1::text
        ORDER BY f.createdat DESC
      `, req.accountId);
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
        createdAt: feed.createdat,
        updatedAt: feed.updatedat,
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

// Mettre à jour un feed
app.put('/api/v1/ingestion/feeds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, frequency, status, mappingJson, dedupStrategy } = req.body || {};
    
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
    const acctId = req.accountId || 'default-account';
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
          req.accountId || source.accountid || 'default-account'
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
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible (runs)' });
    }
    const acctId = req.accountId || 'default-account';
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
      const secretData = typeof secret === 'string' ? JSON.parse(secret) : secret;
      const accessToken = secretData.accessToken || secretData.access_token;

      if (!accessToken) {
        return res.status(400).json({
          message: 'Token d\'accès Shopify manquant.',
          detail: 'Reconnectez votre boutique Shopify depuis la page Sources.'
        });
      }

      const normalizedShop = shop.endsWith('.myshopify.com') ? shop : `${shop}.myshopify.com`;

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

      return res.status(201).json({ message: 'Ingestion Shopify effectuée', ...result });
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
    const acctId = req.accountId || 'default-account';
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
    const acctId = req.accountId || 'default-account';
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
app.post('/api/v1/ingestion/scheduled-runs', async (req, res) => {
  try {
    // Authentification simple via header (optionnel, pour la sécurité)
    const schedulerSecret = process.env.SCHEDULER_SECRET;
    if (schedulerSecret) {
      const authHeader = req.headers['x-scheduler-secret'] || req.headers['authorization'];
      const providedSecret = authHeader?.replace('Bearer ', '') || authHeader;
      if (providedSecret !== schedulerSecret) {
        return res.status(401).json({ message: 'Non autorisé' });
      }
    }

    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Récupérer tous les feeds actifs avec leur source (credentialid pour Shopify)
    const feeds = await prisma.$queryRawUnsafe(`
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
          const secretData = typeof secret === 'string' ? JSON.parse(secret) : secret;
          const accessToken = secretData.accessToken || secretData.access_token;
          if (!accessToken) {
            results.errors.push({
              feedId: feed.feed_id,
              feedName: feed.feed_name,
              error: 'Token d\'accès Shopify manquant'
            });
            continue;
          }
          const normalizedShop = shop.endsWith('.myshopify.com') ? shop : `${shop}.myshopify.com`;
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
          console.log(`✅ Feed Shopify ${feed.feed_name} exécuté avec succès`);
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
        console.log(`✅ Feed ${feed.feed_name} exécuté avec succès`);
      } catch (error) {
        console.error(`❌ Erreur lors de l'exécution du feed ${feed.feed_name}:`, error.message);
        results.errors.push({
          feedId: feed.feed_id,
          feedName: feed.feed_name,
          error: error.message
        });
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

// Récupérer les items d'un feed (option: ?q= pour recherche titre/sku/brand)
app.get('/api/v1/ingestion/feeds/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 2000, 10000);
    const offset = parseInt(req.query.offset) || 0;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }

    const hasSearch = q.length > 0;
    const searchPattern = hasSearch ? `%${q.replace(/%/g, '\\%')}%` : null;

    let totalResult;
    let items;
    if (hasSearch && searchPattern) {
      totalResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "FeedItem"
        WHERE "feedid" = $1::text
        AND (title ILIKE $2 OR sku ILIKE $2 OR brand ILIKE $2)
      `, id, searchPattern);
      const total = parseInt(totalResult[0].count);
      items = await prisma.$queryRawUnsafe(`
        SELECT * FROM "FeedItem"
        WHERE "feedid" = $1::text
        AND (title ILIKE $2 OR sku ILIKE $2 OR brand ILIKE $2)
        ORDER BY "createdat" DESC
        LIMIT $3::int OFFSET $4::int
      `, id, searchPattern, limit, offset);
      res.json({
        items: items,
        total: total,
        limit: limit,
        offset: offset,
        hasMore: offset + items.length < total
      });
    } else {
      totalResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "FeedItem" WHERE "feedid" = $1::text
      `, id);
      const total = parseInt(totalResult[0].count);
      items = await prisma.$queryRawUnsafe(`
        SELECT * FROM "FeedItem"
        WHERE "feedid" = $1::text
        ORDER BY "createdat" DESC
        LIMIT $2::int OFFSET $3::int
      `, id, limit, offset);
      res.json({
        items: items,
        total: total,
        limit: limit,
        offset: offset,
        hasMore: offset + items.length < total
      });
    }
  } catch (e) {
    console.error('List FeedItems error:', e);
    res.status(500).json({ message: 'Erreur listing items' });
  }
});

// Export feed as CSV (Google Merchant Center style)
function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const s = String(val).replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
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

const { getOptimizedContentForPlatform, mergeOptimizedContent } = require('./utils/platform-content');

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
function normalizeForAmazon(item, channelConfig) {
  const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
  const { title: optTitle, description: optDesc, highlights } = getOptimizedContentForPlatform(item, 'amazon');
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
    const platform = (req.query.platform || 'gmc').toLowerCase();
    const format = (req.query.format || (platform === 'chatgpt' ? 'json' : 'csv')).toLowerCase();
    const channel = (req.query.channel || '').toLowerCase();

    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 10000, 50000);

    const SUPPORTED_PLATFORMS = ['gmc', 'meta', 'amazon', 'cdiscount', 'rakuten', 'chatgpt', 'bing', 'pinterest', 'tiktok', 'snapchat', 'yandex', 'baidu', 'perplexity', 'gemini'];
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return res.status(400).json({ message: 'Plateforme non supportée. Utilisez platform=gmc|meta|amazon|cdiscount|rakuten|chatgpt|bing|pinterest|tiktok|snapchat|yandex|baidu|perplexity|gemini.' });
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
    const overrideKeyMap = { gmc: 'google', meta: 'meta', chatgpt: 'chatgpt', bing: 'bing', pinterest: 'pinterest', tiktok: 'tiktok', snapchat: 'snapchat', yandex: 'yandex', baidu: 'baidu', perplexity: 'perplexity', gemini: 'gemini' };
    const overrideKey = overrideKeyMap[platform] || null;
    const excludeOverrides = overrideKey
      ? `AND (customfields->'_channelOverrides'->>'${overrideKey}' IS NULL OR customfields->'_channelOverrides'->>'${overrideKey}' != 'false')`
      : '';
    // Requête avec colonnes en camelCase (alignée migration 002_ingestion_models.sql). En PostgreSQL les identifiants quotés gardent la casse.
    let items = await prisma.$queryRawUnsafe(`
      SELECT id, "feedId", "originId", url, title, "descriptionHtml", "descriptionText", "imageUrl",
             brand, sku, price, currency, inventory, "publishedAt", "updatedAt", "contentHash", "createdAt",
             gtin, mpn, condition, customfields
      FROM "FeedItem"
      WHERE "feedId" = $1::text ${excludeOverrides}
      ORDER BY "createdAt" DESC
      LIMIT $2::int
    `, id, limit);

    // Appliquer les règles Optimiser à la volée (sans modifier la DB) pour cet export
    const channelKey = platform === 'gmc' ? 'gmc' : (platform === 'amazon' ? (channel || 'amazon') : (platform === 'chatgpt' ? 'chatgpt' : platform));
    try {
      const { applyRules, getActiveRules } = require('./rules/engine');
      const accountId = req.accountId || 'default-account';
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
      applyRules(itemsCopy, activeRules, id, channelKey, { ruleAbAssignments });
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
        const titleForExport = abTitleMap.get(item.id) ?? getOptimizedContentForPlatform(item, 'gmc').title;
        const optTitle = titleForExport;
        const { description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
        let desc = (typeof optDesc === 'string' ? optDesc.replace(/<[^>]*>/g, '').trim() : '') || '';
        if (abDescriptionMap.has(item.id)) desc = String(abDescriptionMap.get(item.id)).replace(/<[^>]*>/g, '').trim().substring(0, 5000);
        const inv = item.inventory;
        const availability = normalizeAvailabilityForGMC(cf.availability || cf.inventory, inv);
        const currencyCode = item.currency || cf.currency || 'EUR';
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
      filename = `feed-gmc-${id}.csv`;
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
        const n = normalizeForAmazon(item, channelConfig);
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
      filename = `feed-amazon-${channel}-${id}.csv`;
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

    const accountId = req.accountId || 'default-account';
    
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

    const accountId = req.accountId || 'default-account';

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
    const accountId = req.accountId || 'default-account';

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
    const accountId = req.accountId || 'default-account';
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
    const rows = await prisma.$queryRawUnsafe(`
      SELECT qualityscore AS "qualityScore", recordedat AS "recordedAt"
      FROM "ProductScoreHistory"
      WHERE itemid = $1::text
      ORDER BY recordedat ASC
      LIMIT 60
    `, itemIdCanonical);
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
    if (!prismaReady || !prisma) {
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
        distribution: {},
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

      // Distribution
      if (qualityScore >= 80) distribution.excellent++;
      else if (qualityScore >= 60) distribution.good++;
      else if (qualityScore >= 40) distribution.medium++;
      else distribution.poor++;

      // Dimensions
      const details = score.qualitydetails || {};
      if (details.dimensions) {
        if (details.dimensions.compliance !== undefined) dimensionScores.compliance.push(details.dimensions.compliance);
        if (details.dimensions.dataQuality !== undefined) dimensionScores.dataQuality.push(details.dimensions.dataQuality);
        if (details.dimensions.seo !== undefined) dimensionScores.seo.push(details.dimensions.seo);
        if (details.dimensions.conversion !== undefined) dimensionScores.conversion.push(details.dimensions.conversion);
      }

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

    res.json({
      globalScore,
      totalProducts,
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
      byDimension,
      byFeed,
      recommendations
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
    const acctId = req.accountId || 'default-account';
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

// Endpoint pour Early Access (marketing leads)
app.post('/api/v1/marketing/early-access', async (req, res) => {
  try {
    const { firstName, lastName, jobTitle, phone, email, company, locale } = req.body;

    if (!email) {
      return res.status(400).json({ 
        message: 'Email requis' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Email invalide' });
    }

    const emailNormalized = email.toLowerCase().trim();
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || null;

    // Vérifier si le lead existe déjà
    let existingLead;
    try {
      if (prismaReady && prisma) {
        existingLead = await prisma.$queryRawUnsafe(`
          SELECT * FROM marketing_leads WHERE email = $1::text
        `, emailNormalized);
        if (existingLead && existingLead.length > 0) {
          existingLead = existingLead[0];
        } else {
          existingLead = null;
        }
      } else {
        existingLead = inMemoryLeads.find(l => l.email === emailNormalized);
      }
    } catch (err) {
      existingLead = inMemoryLeads.find(l => l.email === emailNormalized);
    }

    if (existingLead) {
      return res.status(200).json({ 
        message: 'Vous êtes déjà inscrit !',
        alreadyRegistered: true 
      });
    }

    // Sauvegarder le lead
    const leadId = crypto.randomUUID();
    const now = new Date().toISOString();
    let newLead;

    try {
      if (prismaReady && prisma) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO marketing_leads (id, "firstName", "lastName", "jobTitle", phone, email, company, "ipAddress", "userAgent", locale, source, status, "createdAt", "updatedAt")
          VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, $9::text, $10::text, $11::text, $12::text, $13::timestamptz, $14::timestamptz)
        `,
          leadId,
          (firstName || '').trim(),
          (lastName || '').trim(),
          (jobTitle || '').trim(),
          (phone || '').trim(),
          emailNormalized,
          (company || '').trim(),
          ipAddress,
          userAgent,
          locale || null,
          'landing_page',
          'new',
          now,
          now
        );
        const saved = await prisma.$queryRawUnsafe(`
          SELECT * FROM marketing_leads WHERE id = $1::text
        `, leadId);
        newLead = saved[0];
      } else {
        newLead = {
          id: leadId,
          firstName: (firstName || '').trim(),
          lastName: (lastName || '').trim(),
          jobTitle: (jobTitle || '').trim(),
          phone: (phone || '').trim(),
          email: emailNormalized,
          company: (company || '').trim(),
          ipAddress: ipAddress,
          userAgent: userAgent,
          locale: locale || null,
          source: 'landing_page',
          status: 'new',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        inMemoryLeads.push(newLead);
      }
    } catch (saveError) {
      console.error('Error saving lead to DB (fallback to memory):', saveError);
      newLead = {
        id: leadId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobTitle: jobTitle.trim(),
        phone: phone.trim(),
        email: emailNormalized,
        company: company.trim(),
        ipAddress: ipAddress,
        userAgent: userAgent,
        locale: locale || null,
        source: 'landing_page',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryLeads.push(newLead);
      console.warn('LEAD SAVED TO FALLBACK (DB FAILED) — email:', emailNormalized, '— recover from inMemoryLeads or logs');
    }

    console.log(`✅ Nouveau lead Early Access: ${newLead.firstName || 'N/A'} (${newLead.email})`);

    res.status(201).json({ 
      message: 'Inscription réussie ! Nous vous contacterons bientôt.',
      success: true 
    });
  } catch (error) {
    console.error('Early access error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
});

// Idées de fonctionnalités (page Roadmap) — stockage en mémoire si table absente
const inMemoryFeatureIdeas = [];
app.post('/api/v1/marketing/feature-idea', async (req, res) => {
  try {
    const { email, name, idea } = req.body;

    if (!email || !idea || typeof idea !== 'string') {
      return res.status(400).json({
        message: 'Merci de renseigner votre email et votre idée.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ message: 'Email invalide.' });
    }

    const ideaTrimmed = idea.trim();
    if (ideaTrimmed.length < 10) {
      return res.status(400).json({
        message: 'Décrivez votre idée en au moins quelques mots (10 caractères minimum).',
      });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const emailNormalized = email.toLowerCase().trim();

    try {
      if (prismaReady && prisma) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO feature_ideas (id, email, name, idea, "createdAt")
          VALUES ($1::text, $2::text, $3::text, $4::text, $5::timestamptz)
        `, id, emailNormalized, (name && name.trim()) || null, ideaTrimmed, now);
      } else {
        throw new Error('Prisma not ready');
      }
    } catch (dbErr) {
      inMemoryFeatureIdeas.push({
        id,
        email: emailNormalized,
        name: (name && name.trim()) || null,
        idea: ideaTrimmed,
        createdAt: now,
      });
    }

    console.log(`💡 Nouvelle idée feature: ${emailNormalized} — ${ideaTrimmed.slice(0, 50)}…`);

    res.status(201).json({
      message: 'Merci ! Votre idée a bien été enregistrée.',
      success: true,
    });
  } catch (error) {
    console.error('Feature idea error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi. Réessayez plus tard.' });
  }
});

// Récupérer les idées feature (protégé - OWNER uniquement, rôle depuis JWT)
app.get('/api/v1/marketing/feature-ideas', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    let ideas, total;
    try {
      if (prismaReady && prisma) {
        const [ideasResult, totalResult] = await Promise.all([
          prisma.$queryRawUnsafe(`
            SELECT * FROM feature_ideas
            ORDER BY "createdAt" DESC
            LIMIT $1::int OFFSET $2::int
          `, limit, skip),
          prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM feature_ideas`)
        ]);
        ideas = ideasResult;
        total = parseInt(totalResult[0].count);
      } else {
        total = inMemoryFeatureIdeas.length;
        ideas = inMemoryFeatureIdeas.slice(skip, skip + limit);
      }
    } catch (err) {
      total = inMemoryFeatureIdeas.length;
      ideas = inMemoryFeatureIdeas.slice(skip, skip + limit);
    }

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      ideas: (ideas || []).map(idea => ({
        id: idea.id,
        email: idea.email,
        name: idea.name,
        idea: idea.idea,
        createdAt: idea.createdAt ? (idea.createdAt.toISOString ? idea.createdAt.toISOString() : idea.createdAt) : new Date().toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching feature ideas:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des idées' });
  }
});

// Endpoint pour récupérer les leads - RÉSERVÉ STAFF FEEDPLUG (données prospect internes)
app.get('/api/v1/marketing/leads', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    let leads, total;
    try {
      if (prismaReady && prisma) {
        const [leadsResult, totalResult] = await Promise.all([
          prisma.$queryRawUnsafe(`
            SELECT * FROM marketing_leads 
            ORDER BY "createdAt" DESC 
            LIMIT $1::int OFFSET $2::int
          `, limit, skip),
          prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM marketing_leads`)
        ]);
        leads = leadsResult;
        total = parseInt(totalResult[0].count);
      } else {
        total = inMemoryLeads.length;
        leads = inMemoryLeads.slice(skip, skip + limit);
      }
    } catch (err) {
      total = inMemoryLeads.length;
      leads = inMemoryLeads.slice(skip, skip + limit);
    }

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      leads: leads.map(lead => ({
        ...lead,
        createdAt: lead.createdAt ? (lead.createdAt.toISOString ? lead.createdAt.toISOString() : lead.createdAt) : new Date().toISOString(),
        updatedAt: lead.updatedAt ? (lead.updatedAt.toISOString ? lead.updatedAt.toISOString() : lead.updatedAt) : new Date().toISOString()
      }))
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des leads' });
  }
});

// Mise à jour d'un lead (statut, notes) — RÉSERVÉ STAFF FEEDPLUG
app.put('/api/v1/marketing/leads/:id', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body || {};
    const updates = {};
    if (status !== undefined) updates.status = String(status).trim();
    if (notes !== undefined) updates.notes = notes === null ? null : String(notes);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Données à mettre à jour requises (status et/ou notes)' });
    }

    const now = new Date().toISOString();

    const applyToLead = (lead) => {
      if (updates.status !== undefined) lead.status = updates.status;
      if (updates.notes !== undefined) lead.notes = updates.notes;
      lead.updatedAt = new Date(now);
    };

    if (prismaReady && prisma) {
      const parts = [];
      const args = [id];
      let pos = 2;
      if (updates.status !== undefined) {
        parts.push(`"status" = $${pos}::text`);
        args.push(updates.status);
        pos++;
      }
      if (updates.notes !== undefined) {
        parts.push(`"notes" = $${pos}::text`);
        args.push(updates.notes);
        pos++;
      }
      parts.push(`"updatedAt" = $${pos}::timestamptz`);
      args.push(now);
      const sql = `UPDATE marketing_leads SET ${parts.join(', ')} WHERE id = $1::text`;
      const result = await prisma.$executeRawUnsafe(sql, ...args);
      if (result === 0) {
        const inMem = inMemoryLeads.find(l => l.id === id);
        if (inMem) {
          applyToLead(inMem);
          return res.json({ success: true, lead: inMem });
        }
        return res.status(404).json({ message: 'Lead introuvable' });
      }
      return res.json({ success: true });
    }

    const inMem = inMemoryLeads.find(l => l.id === id);
    if (!inMem) return res.status(404).json({ message: 'Lead introuvable' });
    applyToLead(inMem);
    return res.json({ success: true, lead: inMem });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du lead' });
  }
});

// ====== AUTHENTICATION ======

// Routes d'authentification
app.post('/api/v1/auth/login', smartAuthLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);

    if (!user) {
      recordLoginFailure(getClientIp(req));
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      recordLoginFailure(getClientIp(req));
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    recordLoginSuccess(getClientIp(req));
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, accountId: user.accountid },
      EFFECTIVE_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      accessToken,
      token: accessToken, // rétro-compatibilité
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstname,
        lastName: user.lastname,
        role: user.role,
        accountId: user.accountid,
        accountName: user.accountname,
        trialEndsAt: user.trialendsat || null,
        isStaff: isStaffForUser({ email: user.email, accountId: user.accountid })
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
});

// Inscription
// Rate limiter spécifique au register (3 par IP par heure)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: { message: 'Trop de tentatives d\'inscription. Réessayez dans 1 heure.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
});

app.post('/api/v1/auth/register', registerLimiter, async (req, res) => {
  try {
    const { email, password, firstName, lastName, company, accountName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    
    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Format d\'email invalide' });
    }
    
    // Validation mot de passe (min 8 caractères, 1 majuscule, 1 chiffre)
    if (password.length < 8) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères' });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins une majuscule' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins un chiffre' });
    }
    
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    // Vérifier si l'email existe déjà
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'Un compte avec cet email existe déjà' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const accountId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const finalAccountName = accountName || company || `${firstName || ''} ${lastName || ''}`.trim() || 'Mon entreprise';
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // Créer le compte avec essai gratuit 30 jours
    await prisma.$executeRaw`
      INSERT INTO "Account" (id, name, plan, email, trialendsat, createdat, updatedat)
      VALUES (${accountId}::text, ${finalAccountName}::text, 'STARTER', ${email}::text, ${trialEndsAt}, NOW(), NOW())
    `;
    
    // Créer l'utilisateur
    await prisma.$executeRaw`
      INSERT INTO "User" (id, email, password, firstname, lastname, role, accountid, provider, createdat, updatedat)
      VALUES (${userId}::text, ${email}::text, ${hashedPassword}::text, ${firstName || ''}::text, ${lastName || ''}::text, 'OWNER', ${accountId}::text, 'local', NOW(), NOW())
    `;
    
    const accessToken = jwt.sign(
      { id: userId, email, role: 'OWNER', accountId },
      EFFECTIVE_JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Envoyer email de bienvenue (async, ne bloque pas la réponse)
    sendWelcomeEmail(email, firstName).catch(e => console.warn('Email bienvenue non envoyé:', e.message));
    
    res.status(201).json({
      accessToken,
      token: accessToken, // rétro-compatibilité
      user: {
        id: userId,
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        role: 'OWNER',
        accountId,
        accountName,
        trialEndsAt: trialEndsAt.toISOString(),
        isStaff: isStaffForUser({ email, accountId })
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
});

// Profil utilisateur courant
app.get('/api/v1/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      role: user.role,
      accountId: user.accountid,
      account: user.accountname ? { name: user.accountname, plan: user.accountplan || 'STARTER', slug: (user.accountname || '').toLowerCase().replace(/\s+/g, '-') } : undefined,
      accountName: user.accountname,
      plan: user.accountplan || 'STARTER',
      trialEndsAt: user.trialendsat || null,
      isStaff: isStaffUser(req)
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur' });
  }
});

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
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) return res.status(403).json({ message: 'Compte non associé' });
    const rows = await prisma.$queryRawUnsafe(`
      SELECT companyname, phonee164, billingemail FROM "Account" WHERE id = $1::text LIMIT 1
    `, accountId);
    const a = rows?.[0] || {};
    let companyName = a.companyname ?? null;
    let phoneE164 = a.phonee164 ?? null;
    let billingEmail = a.billingemail ?? null;
    let data = {};
    try {
      const progressRows = await prisma.$queryRawUnsafe(`
        SELECT collecteddata FROM "OnboardingProgress" WHERE accountid = $1::text LIMIT 1
      `, accountId);
      const collected = progressRows?.[0]?.collecteddata;
      data = typeof collected === 'object' && collected !== null ? collected : (collected ? JSON.parse(collected) : {});
    } catch (_) {
      data = {};
    }
    const vatNum = data.vatNumber ?? null;
    const sirenVal = data.siren ?? null;
    const hasCompletedCompanyInfo = !!(companyName && phoneE164 && billingEmail && vatNum && sirenVal && String(sirenVal).length === 9);
    res.json({
      companyName,
      phoneE164,
      billingEmail,
      hasCompletedCompanyInfo,
      vatNumber: vatNum,
      siren: sirenVal,
    });
  } catch (e) {
    console.error('GET /account/company-info error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

app.put('/api/v1/account/company-info', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) return res.status(403).json({ message: 'Compte non associé' });
    const body = req.body || {};
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : null;
    const phoneE164 = typeof body.phoneE164 === 'string' ? body.phoneE164.trim() : null;
    const billingEmail = typeof body.billingEmail === 'string' ? body.billingEmail.trim() : null;
    if (!companyName || !phoneE164 || !billingEmail) {
      return res.status(400).json({ message: 'Nom de l\'entreprise, téléphone et email de facturation sont requis.' });
    }
    const vatNumber = typeof body.vatNumber === 'string' ? body.vatNumber.trim() || null : null;
    const siren = typeof body.siren === 'string' ? body.siren.trim().replace(/\s/g, '') || null : null;
    if (!vatNumber) {
      return res.status(400).json({ message: 'Le numéro de TVA intracommunautaire est requis.' });
    }
    if (!siren || siren.length !== 9) {
      return res.status(400).json({ message: 'Le SIREN est requis (9 chiffres).' });
    }
    const addressLine1 = typeof body.addressLine1 === 'string' ? body.addressLine1.trim() || null : null;
    const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() || null : null;
    const city = typeof body.city === 'string' ? body.city.trim() || null : null;
    const country = typeof body.country === 'string' ? body.country.trim() || 'FR' : 'FR';
    if (!addressLine1 || !postalCode || !city || !country) {
      return res.status(400).json({ message: 'L\'adresse de facturation est obligatoire (adresse, code postal, ville, pays).' });
    }
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
    const extraData = { billingAddress, vatNumber, siren };
    await prisma.$executeRawUnsafe(`
      INSERT INTO "OnboardingProgress" (id, accountid, currentstep, completedsteps, collecteddata, updatedat)
      VALUES (gen_random_uuid()::text, $1::text, 'welcome', '[]'::jsonb, $2::jsonb, NOW())
      ON CONFLICT (accountid) DO UPDATE SET
        collecteddata = COALESCE("OnboardingProgress".collecteddata, '{}'::jsonb) || EXCLUDED.collecteddata,
        updatedat = NOW()
    `, accountId, JSON.stringify(extraData));
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
    const accounts = await prisma.$queryRawUnsafe(`
      SELECT id, name, plan, email, trialendsat
      FROM "Account" WHERE id = $1::text LIMIT 1
    `, accountId);
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
    const invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "User" (id, email, firstname, lastname, role, accountid, provider, password, resettoken, resettokenexpiry, status, createdat, updatedat)
        VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, 'local', '', $7::text, $8::timestamptz, 'INACTIVE', NOW(), NOW())
      `, id, email.trim().toLowerCase(), (firstName || '').trim(), (lastName || '').trim(), finalRole, accountId, invitationToken, invitationExpiry);
    } catch (insertErr) {
      if (insertErr.message && insertErr.message.includes('status')) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "User" (id, email, firstname, lastname, role, accountid, provider, password, resettoken, resettokenexpiry, createdat, updatedat)
          VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, 'local', '', $7::text, $8::timestamptz, NOW(), NOW())
        `, id, email.trim().toLowerCase(), (firstName || '').trim(), (lastName || '').trim(), finalRole, accountId, invitationToken, invitationExpiry);
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
app.put('/api/v1/auth/me/password', authenticateToken, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Mot de passe actuel et nouveau requis' });
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre' });
    }
    const userId = req.user.id;
    const users = await prisma.$queryRawUnsafe(`
      SELECT id, password FROM "User" WHERE id = $1::text LIMIT 1
    `, userId);
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    const user = users[0];
    if (!user.password) {
      return res.status(400).json({ message: 'Compte connecté via Google. Utilisez la déconnexion puis la réinitialisation si besoin.' });
    }
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.$executeRawUnsafe(`
      UPDATE "User" SET password = $1::text, updatedat = NOW() WHERE id = $2::text
    `, hashed, userId);
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('PUT /auth/me/password error:', error);
    res.status(500).json({ message: 'Erreur lors du changement de mot de passe' });
  }
});

// Google Auth - Connexion / Inscription avec Google
const GOOGLE_AUTH_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
app.post('/api/v1/auth/google', smartAuthLimiter, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Token Google requis' });
    }
    if (!GOOGLE_AUTH_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID non configuré pour auth Google');
      return res.status(500).json({ message: 'Authentification Google non configurée' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }

    const client = new OAuth2Client(GOOGLE_AUTH_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_AUTH_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Token Google invalide' });
    }

    const email = payload.email;
    const googleId = payload.sub;
    const givenName = payload.given_name || '';
    const familyName = payload.family_name || '';

    let user = await findUserByEmail(email);
    if (user) {
      if (user.provider !== 'google') {
        return res.status(409).json({ message: 'Un compte existe déjà avec cet email. Connectez-vous avec votre mot de passe.' });
      }
    } else {
      const accountId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      const googleAccountName = payload.name || `${givenName} ${familyName}`.trim() || 'Mon entreprise';
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      await prisma.$executeRaw`
        INSERT INTO "Account" (id, name, plan, email, trialendsat, createdat, updatedat)
        VALUES (${accountId}::text, ${googleAccountName}::text, 'STARTER', ${email}::text, ${trialEndsAt}, NOW(), NOW())
      `;
      await prisma.$executeRaw`
        INSERT INTO "User" (id, email, password, firstname, lastname, role, accountid, provider, providerid, createdat, updatedat)
        VALUES (${userId}::text, ${email}::text, NULL, ${givenName}::text, ${familyName}::text, 'OWNER', ${accountId}::text, 'google', ${googleId}::text, NOW(), NOW())
      `;
      user = await findUserByEmail(email);
      sendWelcomeEmail(email, givenName).catch(e => console.warn('Email bienvenue non envoyé:', e.message));
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, accountId: user.accountid },
      EFFECTIVE_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      accessToken,
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstname || '',
        lastName: user.lastname || '',
        role: user.role,
        accountId: user.accountid,
        accountName: user.accountname,
        trialEndsAt: user.trialendsat || null,
        isStaff: isStaffForUser({ email: user.email, accountId: user.accountid })
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: error.message || 'Erreur lors de la connexion Google' });
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
    const accountId = req.accountId || 'default-account';

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
    const accountId = req.accountId || 'default-account';

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
      const params = [];
      const valuePlaceholders = batch.map((row, i) => {
        const base = i * 9;
        return `($${base + 1}::text, $${base + 2}::text, $${base + 3}::text, $${base + 4}::jsonb, $${base + 5}::jsonb, $${base + 6}::text, $${base + 7}::text, $${base + 8}::text, $${base + 9}::timestamptz)`;
      });
      for (const row of batch) {
        params.push(row.id, row.itemId, id, row.enrichments, row.alerts, row.method, row.aiProvider, row.aiModel, now);
      }
      const sql = `INSERT INTO "EnrichmentHistory" (id, "itemId", "feedId", "enrichedFields", alerts, method, "aiProvider", "aiModel", "createdAt") VALUES ${valuePlaceholders.join(', ')}`;
      await prisma.$executeRawUnsafe(sql, ...params);
    }

    // Mettre à jour les statistiques
    await prisma.$executeRawUnsafe(`
      INSERT INTO "EnrichmentStats" (id, "feedId", date, "totalItems", "enrichedItems", "fieldsEnriched", "alertsGenerated", "aiEnrichments", "rulesEnrichments", "createdAt", "updatedAt")
      VALUES ($1::text, $2::text, $3::date, $4::int, $5::int, $6::int, $7::int, $8::int, $9::int, $10::timestamptz, $11::timestamptz)
      ON CONFLICT ("feedId", date) 
      DO UPDATE SET 
        "totalItems" = "EnrichmentStats"."totalItems" + $4::int,
        "enrichedItems" = "EnrichmentStats"."enrichedItems" + $5::int,
        "fieldsEnriched" = "EnrichmentStats"."fieldsEnriched" + $6::int,
        "alertsGenerated" = "EnrichmentStats"."alertsGenerated" + $7::int,
        "aiEnrichments" = "EnrichmentStats"."aiEnrichments" + $8::int,
        "rulesEnrichments" = "EnrichmentStats"."rulesEnrichments" + $9::int,
        "updatedAt" = $11::timestamptz
    `, 
      require('crypto').randomUUID(), id, today,
      items.length, enrichedCount, fieldsEnrichedCount, allAlerts.length,
      aiEnrichmentsCount, rulesEnrichmentsCount, now, now
    );

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

// Historique des enrichissements pour un produit
app.get('/api/v1/ingestion/items/:id/enrichment-history', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }
    const accountId = req.accountId || 'default-account';
    const itemId = await resolveItemId(prisma, id);
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
    const accountId = req.accountId || 'default-account';
    const itemId = await resolveItemId(prisma, id);
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
    const accountId = req.accountId || 'default-account';
    const itemId = await resolveItemId(prisma, id);
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
    const accountId = req.accountId || 'default-account';
    const itemId = await resolveItemId(prisma, id);
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
async function resolveItemId(prisma, id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    const r = await prisma.$queryRawUnsafe(`SELECT id FROM "FeedItem" WHERE id = $1::text LIMIT 1`, id);
    return r && r[0] ? r[0].id : null;
  }
  const byMpn = await prisma.$queryRawUnsafe(`SELECT id FROM "FeedItem" WHERE mpn = $1::text LIMIT 1`, id);
  if (byMpn && byMpn[0]) return byMpn[0].id;
  const bySku = await prisma.$queryRawUnsafe(`SELECT id FROM "FeedItem" WHERE sku = $1::text LIMIT 1`, id);
  return bySku && bySku[0] ? bySku[0].id : null;
}

// PUT : mise à jour d'un item (édition manuelle) + création révision avant update
app.put('/api/v1/ingestion/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
    const accountId = req.accountId || 'default-account';
    const itemId = await resolveItemId(prisma, id);
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
    const accountId = req.accountId || 'default-account';
    const itemId = await resolveItemId(prisma, id);
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
    return res.json({ channelOverrides: overrides });
  } catch (e) {
    console.error('Erreur PATCH channels:', e);
    return res.status(500).json({ message: 'Erreur mise à jour canaux', error: e.message });
  }
});

// PATCH : sauvegarder le contenu optimisé par plateforme (titre, description) pour un item
app.patch('/api/v1/ingestion/items/:id/optimized', async (req, res) => {
  try {
    const { id } = req.params;
    const { platform, title, description } = req.body || {};
    if (!platform || typeof platform !== 'string') {
      return res.status(400).json({ message: 'platform requis (gmc|meta|amazon|chatgpt)' });
    }
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Prisma non disponible' });
    const accountId = req.accountId || 'default-account';
    const itemId = await resolveItemId(prisma, id);
    if (!itemId) return res.status(404).json({ message: 'Item non trouvé' });
    if (!await verifyItemAccess(itemId, accountId)) return res.status(403).json({ message: 'Accès refusé' });
    const platKey = String(platform).toLowerCase().replace('google', 'gmc');
    if (!['gmc', 'meta', 'amazon', 'chatgpt'].includes(platKey)) {
      return res.status(400).json({ message: 'plateforme invalide. Utilisez gmc, meta, amazon ou chatgpt.' });
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
    if (Object.keys(content).length === 0) return res.json({ message: 'Aucune modification', customfields: cf });
    const newCf = mergeOptimizedContent(cf, platKey, content);
    await prisma.$executeRawUnsafe(
      `UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`,
      JSON.stringify(newCf),
      itemId
    );
    return res.json({ message: 'Contenu optimisé sauvegardé', platform: platKey });
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

// Appliquer la migration 024 : colonne addonia (Pack IA) sur Account — RÉSERVÉ STAFF
app.post('/api/v1/admin/apply-addon-ia-migration', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS addonia BOOLEAN NOT NULL DEFAULT false
    `);
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN "Account".addonia IS 'Pack IA souscrit (+49 € HT/mois) : génération titres + images'
    `).catch(() => {});
    return res.json({ message: 'Migration 024 (addonia) appliquée. Vous pouvez maintenant activer le Pack IA par compte.' });
  } catch (err) {
    console.error('Erreur apply-addon-ia-migration:', err);
    return res.status(500).json({ message: err?.message || 'Erreur lors de la migration' });
  }
});

// Endpoint temporaire pour appliquer la migration d'enrichissement
app.post('/api/v1/admin/apply-enrichment-migration', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }

    console.log('📦 Application de la migration d\'enrichissement...');

    // Créer la table EnrichmentHistory
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EnrichmentHistory" (
        id              TEXT PRIMARY KEY,
        "itemId"          TEXT NOT NULL REFERENCES "FeedItem"(id) ON DELETE CASCADE,
        "feedId"          TEXT REFERENCES "Feed"(id) ON DELETE SET NULL,
        "enrichedFields"  JSONB NOT NULL,
        alerts          JSONB,
        method          TEXT NOT NULL DEFAULT 'automatic',
        "aiProvider"      TEXT,
        "aiModel"         TEXT,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_enrichmenthistory_itemid ON "EnrichmentHistory"("itemId")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_enrichmenthistory_feedid ON "EnrichmentHistory"("feedId")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_enrichmenthistory_createdat ON "EnrichmentHistory"("createdAt")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_enrichmenthistory_method ON "EnrichmentHistory"(method)
    `);

    // Créer la table EnrichmentStats
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EnrichmentStats" (
        id                    TEXT PRIMARY KEY,
        "feedId"                TEXT NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
        date                  DATE NOT NULL,
        "totalItems"            INT NOT NULL DEFAULT 0,
        "enrichedItems"         INT NOT NULL DEFAULT 0,
        "fieldsEnriched"        INT NOT NULL DEFAULT 0,
        "alertsGenerated"       INT NOT NULL DEFAULT 0,
        "alertsResolved"        INT NOT NULL DEFAULT 0,
        "aiEnrichments"         INT NOT NULL DEFAULT 0,
        "rulesEnrichments"      INT NOT NULL DEFAULT 0,
        "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE("feedId", date)
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_enrichmentstats_feedid ON "EnrichmentStats"("feedId")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_enrichmentstats_date ON "EnrichmentStats"(date)
    `);

    console.log('✅ Migration d\'enrichissement appliquée avec succès');

    res.json({
      message: 'Migration appliquée avec succès',
      tables: ['EnrichmentHistory', 'EnrichmentStats']
    });
  } catch (e) {
    console.error('Erreur application migration:', e);
    res.status(500).json({ message: 'Erreur application migration', error: e.message });
  }
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
    const accountId = req.accountId || 'default-account';
    const addonIA = await canUseFeature(prisma, accountId, 'addonIA');
    if (!addonIA.allowed) {
      return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
    }
    const plat = platform ? String(platform).toUpperCase().replace(/GOOGLE/, 'GMC') : 'GMC';
    const result = {};
    for (const itemId of itemIds) {
      const itemIdStr = String(itemId);
      const resolvedId = await resolveItemId(prisma, itemIdStr) || itemIdStr;
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
        const opt = await optimizeTitleWithAI(prisma, product, { platform: plat, forceRefresh: false });
        result[itemIdStr] = opt.optimizedTitle || item.title || '';
      } catch (err) {
        console.warn('Erreur optimisation titre pour', itemIdStr, err.message);
        result[itemIdStr] = item.title || '';
      }
    }
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

// Optimiser le titre d'un produit (optionnel: savePlatform = gmc|meta|amazon|chatgpt pour sauvegarder dans optimized[platform])
app.post('/api/v1/enrichment/optimize-title', async (req, res) => {
  try {
    const { itemId, platform, industry, forceRefresh, savePlatform } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ message: 'itemId requis' });
    }
    
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const accountId = req.accountId || 'default-account';
    const addonIA = await canUseFeature(prisma, accountId, 'addonIA');
    if (!addonIA.allowed) {
      return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
    }
    const resolvedId = await resolveItemId(prisma, String(itemId));
    if (!resolvedId) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    if (!(await verifyItemAccess(resolvedId, accountId))) {
      return res.status(403).json({ message: 'Accès refusé à ce produit' });
    }
    
    const items = await prisma.$queryRawUnsafe(`SELECT * FROM "FeedItem" WHERE id = $1::text`, resolvedId);
    
    if (!items || items.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    const plat = platform || 'GMC';
    const result = await optimizeTitleWithAI(prisma, items[0], { platform: plat, industry, forceRefresh: forceRefresh || false });
    
    if (savePlatform && result.optimizedTitle && (await verifyItemAccess(items[0].id, req.accountId || 'default-account'))) {
      const platKey = String(savePlatform).toLowerCase().replace('google', 'gmc');
      if (['gmc', 'meta', 'amazon', 'chatgpt'].includes(platKey)) {
        let cf = items[0].customfields;
        try { cf = typeof cf === 'string' ? JSON.parse(cf || '{}') : (cf || {}); } catch (e) { cf = {}; }
        const newCf = mergeOptimizedContent(cf, platKey, { title: result.optimizedTitle });
        await prisma.$executeRawUnsafe(`UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`, JSON.stringify(newCf), items[0].id);
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erreur optimize-title:', error);
    res.status(500).json({ message: error.message });
  }
});

// Optimiser la description d'un produit (optionnel: savePlatform pour sauvegarder dans optimized[platform])
app.post('/api/v1/enrichment/optimize-description', async (req, res) => {
  try {
    const { itemId, platform, industry, forceRefresh, savePlatform } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ message: 'itemId requis' });
    }
    
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const accountId = req.accountId || 'default-account';
    const resolvedId = await resolveItemId(prisma, String(itemId));
    if (!resolvedId) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    if (!(await verifyItemAccess(resolvedId, accountId))) {
      return res.status(403).json({ message: 'Accès refusé à ce produit' });
    }
    
    const items = await prisma.$queryRawUnsafe(`SELECT * FROM "FeedItem" WHERE id = $1::text`, resolvedId);
    
    if (!items || items.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    const plat = platform || 'GMC';
    const result = await optimizeDescriptionWithAI(prisma, items[0], { platform: plat, industry, forceRefresh: forceRefresh || false });
    
    if (savePlatform && result.optimizedDescription && (await verifyItemAccess(items[0].id, req.accountId || 'default-account'))) {
      const platKey = String(savePlatform).toLowerCase().replace('google', 'gmc');
      if (['gmc', 'meta', 'amazon', 'chatgpt'].includes(platKey)) {
        let cf = items[0].customfields;
        try { cf = typeof cf === 'string' ? JSON.parse(cf || '{}') : (cf || {}); } catch (e) { cf = {}; }
        const newCf = mergeOptimizedContent(cf, platKey, { description: result.optimizedDescription });
        await prisma.$executeRawUnsafe(`UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`, JSON.stringify(newCf), items[0].id);
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erreur optimize-description:', error);
    res.status(500).json({ message: error.message });
  }
});

// Générer des highlights (bullet points) pour un produit avec IA
app.post('/api/v1/enrichment/generate-highlights', async (req, res) => {
  try {
    const { itemId, platform, industry, forceRefresh, savePlatform } = req.body;

    if (!itemId) {
      return res.status(400).json({ message: 'itemId requis' });
    }

    const accountId = req.accountId || 'default-account';
    if (prismaReady && prisma) {
      const addonIA = await canUseFeature(prisma, accountId, 'addonIA');
      if (!addonIA.allowed) {
        return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
      }
    }

    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }

    const items = await prisma.$queryRawUnsafe(`
      SELECT id, title, "descriptionText", "descriptionHtml", "imageUrl", brand, sku, price, currency, gtin, mpn, condition, inventory, customfields
      FROM "FeedItem" WHERE id = $1::text LIMIT 1
    `, itemId);

    if (!items || items.length === 0) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    const item = items[0];
    let cf;
    try { cf = typeof item.customfields === 'string' ? JSON.parse(item.customfields || '{}') : (item.customfields || {}); } catch (e) { cf = {}; }
    const product = { ...item, customfields: cf };

    const plat = platform ? String(platform).toUpperCase() : 'GMC';
    const result = await generateHighlightsWithAI(prisma, product, { platform: plat, industry, forceRefresh: forceRefresh || false });

    // Sauvegarder si demandé
    if (savePlatform && result.highlights && result.highlights.length > 0) {
      const platKey = String(savePlatform).toLowerCase().replace('google', 'gmc');
      if (['gmc', 'meta', 'amazon', 'chatgpt'].includes(platKey)) {
        const newCf = mergeOptimizedContent(cf, platKey, { highlights: result.highlights });
        await prisma.$executeRawUnsafe(`UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`, JSON.stringify(newCf), item.id);
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Erreur generate-highlights:', error);
    res.status(500).json({ message: error.message });
  }
});

// Optimiser l'image d'un produit
app.post('/api/v1/enrichment/optimize-image', async (req, res) => {
  try {
    const { imageUrl, platform, quality, format } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: 'imageUrl requis' });
    }
    const accountId = req.accountId || 'default-account';
    if (prismaReady && prisma) {
      const addonIA = await canUseFeature(prisma, accountId, 'addonIA');
      if (!addonIA.allowed) {
        return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
      }
    }
    
    const result = await optimizeImage(imageUrl, { platform: platform || 'GMC', quality: quality || 85, format: format || 'webp' });
    res.json(result);
  } catch (error) {
    console.error('Erreur optimize-image:', error);
    res.status(500).json({ message: error.message });
  }
});

// Générer une image "mise en situation" (lifestyle) à partir de l'image produit (Fal Bria Product Shot ou Vertex)
// Accepte imageUrl, ou imageBase64 + imageMimeType. Si feedItemId fourni : l'image envoyée est sauvegardée en GCS
// et réutilisée automatiquement pour ce produit (plus besoin de ré-uploader).
app.post('/api/v1/enrichment/generate-lifestyle-image', async (req, res) => {
  try {
    const { imageUrl, imageBase64, imageMimeType, sceneDescription, scenePreset, feedItemId, productPageUrl, productTitle, productBrand, productDescription, provider: bodyProvider, model: bodyModel } = req.body;
    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ message: 'imageUrl ou imageBase64 requis' });
    }
    const accountId = req.accountId || 'default-account';
    if (prismaReady && prisma) {
      const addonIA = await canUseFeature(prisma, accountId, 'addonIA');
      if (!addonIA.allowed) {
        return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
      }
    }
    const description = sceneDescription || (scenePreset && PRESET_SCENES[scenePreset]) || PRESET_SCENES.living_room;
    const productContext = [productTitle, productBrand].filter(Boolean).join(' — ') || null;
    const productDescShort = productDescription && String(productDescription).trim().slice(0, 500) || null;

    let refererOrigin = null;
    if (productPageUrl && typeof productPageUrl === 'string') {
      try {
        refererOrigin = new URL(productPageUrl.trim()).origin;
      } catch (_) {}
    }

    let imageUrlToUse = imageUrl || null;
    let options = imageBase64 ? { imageBase64, imageMimeType: imageMimeType || 'image/jpeg' } : {};
    if (refererOrigin) options.refererOrigin = refererOrigin;
    if (productContext) options.productContext = productContext;
    if (productDescShort) options.productDescription = productDescShort;
    if (bodyProvider && ['vertex', 'fal'].includes(String(bodyProvider).toLowerCase())) options.provider = String(bodyProvider).toLowerCase();
    if (bodyModel && typeof bodyModel === 'string' && bodyModel.trim()) options.model = bodyModel.trim();

    let effectiveItemId = null;
    if (feedItemId && prismaReady && prisma) {
      effectiveItemId = (await resolveItemId(prisma, String(feedItemId))) || feedItemId;
    }
    if (effectiveItemId && prismaReady && prisma) {
      const hasAccess = await verifyItemAccess(effectiveItemId, accountId);
      if (hasAccess) {
        const catalogPrefix = `catalog/${accountId}/${effectiveItemId}`;
        const bucket = storage.bucket(bucketName);

        if (imageBase64) {
          const ext = (imageMimeType || 'image/jpeg').includes('png') ? 'png' : 'jpg';
          const path = `${catalogPrefix}/product.${ext}`;
          const file = bucket.file(path);
          const buffer = Buffer.from(imageBase64, 'base64');
          await file.save(buffer, {
            metadata: { contentType: imageMimeType || 'image/jpeg' },
            resumable: false,
          });
          imageUrlToUse = null;
          options = { imageBase64, imageMimeType: imageMimeType || 'image/jpeg' };
        } else {
          const [jpgExists] = await bucket.file(`${catalogPrefix}/product.jpg`).exists().catch(() => [false]);
          const [pngExists] = await bucket.file(`${catalogPrefix}/product.png`).exists().catch(() => [false]);
          if (jpgExists) {
            const file = bucket.file(`${catalogPrefix}/product.jpg`);
            const [buf] = await file.download();
            options = { imageBase64: buf.toString('base64'), imageMimeType: 'image/jpeg' };
            imageUrlToUse = null;
          } else if (pngExists) {
            const file = bucket.file(`${catalogPrefix}/product.png`);
            const [buf] = await file.download();
            options = { imageBase64: buf.toString('base64'), imageMimeType: 'image/png' };
            imageUrlToUse = null;
          }
          // si ni jpg ni png : imageUrlToUse reste l’URL produit (peut donner 403 si le marchand bloque)
        }
      }
      // Si hasAccess est false, on ignore feedItemId et on continue avec imageUrl/imageBase64 (pas de 403)
    }

    // Si on a encore une URL produit (pas de base64) : la résoudre avec plusieurs stratégies pour contourner 403 / CDN
    if (imageUrlToUse && !options.imageBase64) {
      let resolved = null;
      const productOrigin = refererOrigin || null;
      let imageOrigin = null;
      try {
        imageOrigin = new URL(imageUrlToUse).origin;
      } catch (_) {}
      const strategies = [];
      if (productOrigin) strategies.push({ refererOrigin: productOrigin });
      if (imageOrigin && imageOrigin !== productOrigin) strategies.push({ refererOrigin: imageOrigin });
      strategies.push({ refererOrigin: null });
      for (const s of strategies) {
        try {
          resolved = await downloadImageAsBase64(imageUrlToUse, s);
          break;
        } catch (err) {
          console.warn('Lifestyle: téléchargement image produit échoué (stratégie referer):', err.message);
        }
      }
      if (resolved) {
        options.imageBase64 = resolved.base64;
        options.imageMimeType = resolved.mimeType || 'image/jpeg';
        imageUrlToUse = null;
        if (effectiveItemId && prismaReady && prisma) {
          const hasAccess = await verifyItemAccess(effectiveItemId, accountId);
          if (hasAccess) {
            const catalogPrefix = `catalog/${accountId}/${effectiveItemId}`;
            const ext = (resolved.mimeType || '').includes('png') ? 'png' : 'jpg';
            const path = `${catalogPrefix}/product.${ext}`;
            try {
              await storage.bucket(bucketName).file(path).save(Buffer.from(resolved.base64, 'base64'), {
                metadata: { contentType: resolved.mimeType || 'image/jpeg' },
                resumable: false,
              });
            } catch (saveErr) {
              console.warn('Lifestyle: sauvegarde image catalogue ignorée:', saveErr.message);
            }
          }
        }
      } else {
        return res.status(403).json({
          message: 'Image produit inaccessible (blocage par le site marchand). Utilisez « Envoyer une image » pour téléverser l\'image produit, elle sera enregistrée pour ce produit.',
        });
      }
    }

    // Timeout 180s : la génération Vertex (image in → image out) peut être très lente
    const LIFESTYLE_TIMEOUT_MS = 180000;
    const result = await Promise.race([
      generateLifestyleImage(imageUrlToUse, description, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Génération trop longue (timeout). Réessayez.')), LIFESTYLE_TIMEOUT_MS)
      ),
    ]);
    // URL signée pour que le navigateur puisse afficher l'image (bucket souvent privé). Ne jamais renvoyer l'URL brute.
    let urlToReturn = result.url;
    if (result.url && result.url.startsWith(`https://storage.googleapis.com/${bucketName}/`)) {
      const path = result.url.replace(`https://storage.googleapis.com/${bucketName}/`, '');
      const file = storage.bucket(bucketName).file(path);
      try {
        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 2 * 60 * 60 * 1000, // 2 h
        });
        urlToReturn = signedUrl;
      } catch (signErr) {
        console.error('Signed URL lifestyle image:', signErr.message);
        return res.status(500).json({ message: 'Image générée mais impossible de créer l\'URL de prévisualisation. Vérifiez la config GCS (compte de service, permissions).' });
      }
    }
    res.json({ url: urlToReturn, contentType: result.contentType });
  } catch (error) {
    console.error('Erreur generate-lifestyle-image:', error);
    const status = error.status || error.statusCode;
    const isTimeout = error.message && String(error.message).includes('timeout');
    const msg = error.message || 'Génération impossible';
    const is422 = status === 422 || (typeof msg === 'string' && (msg.includes('Unprocessable') || msg.includes('422')));
    const is403 = status === 403 || (typeof msg === 'string' && (msg.includes('403') || msg.includes('Image inaccessible')));
    const userMessage = isTimeout
      ? 'La génération a pris trop de temps. Réessayez.'
      : is403
        ? "Image inaccessible (403). Envoyez une image une fois : elle sera enregistrée pour ce produit et réutilisée automatiquement."
        : is422
          ? "L'image produit n'a pas pu être utilisée. Vérifiez que l'URL est accessible ou envoyez une image."
          : msg;
    const httpStatus = isTimeout ? 504 : is403 ? 403 : (status && status >= 400 && status < 600 ? status : 500);
    res.status(httpStatus).json({ message: userMessage });
  }
});

// Obtenir une URL signée pour une image lifestyle (pour « Copier l'URL » : lien valide même si l'ancienne URL a expiré).
app.post('/api/v1/enrichment/sign-lifestyle-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'url requis' });
    }
    const base = `https://storage.googleapis.com/${bucketName}/`;
    const urlWithoutQuery = url.split('?')[0];
    if (!urlWithoutQuery.startsWith(base)) {
      return res.status(400).json({ message: 'URL non autorisée (bucket différent)' });
    }
    const path = urlWithoutQuery.replace(base, '').replace(/^\//, '');
    if (!path.startsWith('lifestyle/')) {
      return res.status(400).json({ message: 'Seules les images lifestyle sont autorisées' });
    }
    const file = storage.bucket(bucketName).file(path);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 2 * 60 * 60 * 1000, // 2 h
    });
    res.json({ url: signedUrl });
  } catch (e) {
    console.error('Erreur sign-lifestyle-url:', e.message);
    res.status(500).json({ message: 'Impossible de générer l\'URL. Vérifiez que le fichier existe.' });
  }
});

// Proxy image : récupère une image produit (avec Referer anti-403) et renvoie une URL signée GCS.
// Utilisable partout (front, flux, lifestyle) pour contourner les CDN qui bloquent les requêtes sans Referer.
app.post('/api/v1/enrichment/proxy-image', async (req, res) => {
  try {
    const { imageUrl, productPageUrl } = req.body;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ message: 'imageUrl requis' });
    }
    const accountId = req.accountId || 'default-account';
    let refererOrigin = null;
    if (productPageUrl && typeof productPageUrl === 'string') {
      try {
        refererOrigin = new URL(productPageUrl.trim()).origin;
      } catch (_) {}
    }
    const { base64, mimeType } = await downloadImageAsBase64(imageUrl, { refererOrigin });
    const ext = mimeType && mimeType.includes('png') ? 'png' : 'jpg';
    const hash = crypto.createHash('sha256').update(imageUrl + (refererOrigin || '')).digest('hex').slice(0, 16);
    const path = `proxy/${accountId}/${hash}.${ext}`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(path);
    const buffer = Buffer.from(base64, 'base64');
    await file.save(buffer, {
      metadata: { contentType: mimeType || 'image/jpeg' },
      resumable: false,
    });
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 h
    });
    res.json({ url: signedUrl, contentType: mimeType || 'image/jpeg' });
  } catch (error) {
    console.error('Erreur proxy-image:', error.message);
    const msg = error.message || 'Impossible de récupérer l\'image';
    const status = msg.includes('403') || msg.includes('Image inaccessible') ? 403 : 500;
    res.status(status).json({ message: msg });
  }
});

// Optimiser plusieurs produits en batch (support multi-plateforme : platforms = ['gmc','meta','amazon','chatgpt'])
// saveToCatalog: false = ne pas écrire en base (pour tests A/B : on ne garde que les résultats)
app.post('/api/v1/enrichment/batch', async (req, res) => {
  try {
    const { itemIds, optimizations, platform, platforms, saveToCatalog = true } = req.body;
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ message: 'itemIds requis (array)' });
    }
    
    if (itemIds.length > 1000) {
      return res.status(400).json({ message: 'Maximum 1000 produits par batch' });
    }
    
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const rawPlatform = platform ? String(platform) : 'GMC';
    const rawPlatforms = Array.isArray(platforms) && platforms.length > 0
      ? platforms
      : [rawPlatform];
    const normalizedPlatforms = rawPlatforms.map(p => {
      const s = String(p).toUpperCase().replace(/GOOGLE/, 'GMC');
      return s || 'GMC';
    });
    
    const placeholders = itemIds.map((_, i) => `$${i + 1}::text`).join(',');
    const acctParam = `$${itemIds.length + 1}::text`;
    const products = await prisma.$queryRawUnsafe(
      `SELECT i.* FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id WHERE i.id IN (${placeholders}) AND f.accountid = ${acctParam}`,
      ...itemIds, req.accountId
    );
    
    const results = { total: itemIds.length, found: products.length, titles: null, descriptions: null, images: null, totalCost: 0 };
    
    const platformResults = {};
    for (const plat of normalizedPlatforms) {
      platformResults[plat] = { titles: null, descriptions: null };
    }
    
    for (const plat of normalizedPlatforms) {
      if (optimizations?.titles) {
        const titleResults = await optimizeTitlesBatch(prisma, products, { platform: plat });
        platformResults[plat].titles = titleResults;
        results.totalCost += titleResults.totalCost;
      }
      if (optimizations?.descriptions) {
        const descResults = await optimizeDescriptionsBatch(prisma, products, { platform: plat });
        platformResults[plat].descriptions = descResults;
        results.totalCost += descResults.totalCost;
      }
    }
    
    if (optimizations?.images) {
      const imageProducts = products.filter(p => p.imageurl || p.imageUrl);
      const imageUrls = imageProducts.map(p => p.imageurl || p.imageUrl);
      if (imageUrls.length > 0) {
        const imageResults = await optimizeImagesBatch(imageUrls, { platform: normalizedPlatforms[0] || 'GMC' });
        imageResults.results.forEach((r, i) => {
          r.productId = imageProducts[i]?.id;
          r.optimizedImageUrl = r.optimized?.main?.url || r.optimized?.url;
        });
        results.images = imageResults;
      }
    }
    
    results.titles = platformResults[normalizedPlatforms[0]]?.titles || null;
    results.descriptions = platformResults[normalizedPlatforms[0]]?.descriptions || null;
    
    const savedCount = { titles: 0, descriptions: 0 };
    if (!saveToCatalog) {
      results.saved = savedCount;
      return res.json(results);
    }
    
    for (const product of products) {
      try {
        let currentCf = product.customfields;
        try {
          currentCf = typeof currentCf === 'string' ? JSON.parse(currentCf || '{}') : (currentCf || {});
        } catch (e) {
          currentCf = {};
        }
        
        const updates = {};
        let firstTitle = null;
        let firstDesc = null;
        
        for (const plat of normalizedPlatforms) {
          const platKey = (plat === 'GMC' ? 'gmc' : plat.toLowerCase());
          const platContent = {};
          
          if (optimizations?.titles && platformResults[plat]?.titles?.results) {
            const tr = platformResults[plat].titles.results.find(r => r.productId === product.id && r.success);
            if (tr?.optimizedTitle) {
              platContent.title = tr.optimizedTitle;
              if (!firstTitle) firstTitle = tr.optimizedTitle;
            }
          }
          if (optimizations?.descriptions && platformResults[plat]?.descriptions?.results) {
            const dr = platformResults[plat].descriptions.results.find(r => r.productId === product.id && r.success);
            if (dr?.optimizedDescription) {
              platContent.description = dr.optimizedDescription;
              if (!firstDesc) firstDesc = dr.optimizedDescription;
            }
          }
          if (Object.keys(platContent).length > 0) {
            platContent.updatedAt = new Date().toISOString();
            updates.optimized = updates.optimized || currentCf.optimized || {};
            updates.optimized = { ...updates.optimized, [platKey]: { ...(updates.optimized[platKey] || {}), ...platContent } };
          }
        }
        
        if (firstTitle) {
          updates.optimized_title = firstTitle;
          updates.title_optimized_at = new Date().toISOString();
          savedCount.titles++;
        }
        if (firstDesc) {
          updates.optimized_description = firstDesc;
          updates.description_optimized_at = new Date().toISOString();
          savedCount.descriptions++;
        }
        
        if (Object.keys(updates).length > 0) {
          const newCf = { ...currentCf, ...updates };
          await prisma.$executeRawUnsafe(
            `UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`,
            JSON.stringify(newCf),
            product.id
          );
        }
      } catch (saveErr) {
        console.warn(`Erreur sauvegarde enrichissement ${product.id}:`, saveErr.message);
      }
    }
    
    results.saved = savedCount;
    
    res.json(results);
  } catch (error) {
    console.error('Erreur batch:', error);
    res.status(500).json({ message: error.message });
  }
});

// === Calculer les scores en batch (pour la page /ia) ===
app.post('/api/v1/enrichment/scores', async (req, res) => {
  try {
    const { itemIds } = req.body;
    
    if (!itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({ message: 'itemIds requis (array)' });
    }
    
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const placeholders = itemIds.map((_, i) => `$${i + 1}::text`).join(',');
    const acctParam2 = `$${itemIds.length + 1}::text`;
    const products = await prisma.$queryRawUnsafe(
      `SELECT i.* FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id WHERE i.id IN (${placeholders}) AND f.accountid = ${acctParam2}`,
      ...itemIds, req.accountId
    );
    
    const scores = {};
    for (const product of products) {
      const titleScore = calculateTitleScore(product.title || '', product);
      const descText = product.descriptiontext || '';
      const descriptionScore = calculateDescriptionScore(descText, product);
      
      let imageScore = 0;
      if (product.imageurl) imageScore += 60;
      
      let technicalScore = 0;
      const cf = product.customfields && typeof product.customfields === 'object' ? product.customfields : {};
      if (product.gtin || cf.gtin) technicalScore += 30;
      if (product.mpn || cf.mpn) technicalScore += 20;
      if (cf.google_product_category) technicalScore += 30;
      if (product.brand) technicalScore += 20;
      
      const globalScore = Math.round(
        titleScore * 0.30 + descriptionScore * 0.25 + imageScore * 0.25 + technicalScore * 0.20
      );
      
      scores[product.id] = {
        global: globalScore,
        title: titleScore,
        description: descriptionScore,
        image: imageScore,
        technical: technicalScore,
        hasOptimizedTitle: !!cf.optimized_title,
        hasOptimizedDescription: !!cf.optimized_description
      };
    }
    
    res.json({ scores });
  } catch (error) {
    console.error('Erreur scores batch:', error);
    res.status(500).json({ message: error.message });
  }
});

// Calculer le score FeedPlug d'un produit
app.get('/api/v1/enrichment/score/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    if (!prismaReady || !prisma) {
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
    if (product.gtin || product.customfields?.gtin) technicalScore += 30;
    if (product.mpn || product.customfields?.mpn) technicalScore += 20;
    if (product.customfields?.google_product_category) technicalScore += 30;
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

// === Segments pour A/B test ===
app.get('/api/v1/enrichment/segments', async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const acct = req.accountId;
    
    // Marques (top 30) — filtré par account
    const brands = await prisma.$queryRawUnsafe(`
      SELECT i.brand, COUNT(*)::int as count 
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE i.brand IS NOT NULL AND i.brand != '' AND f.accountid = $1::text
      GROUP BY i.brand ORDER BY count DESC LIMIT 30
    `, acct);
    
    // Catégories produit (top 30)
    const categories = await prisma.$queryRawUnsafe(`
      SELECT i.customfields->>'product_type' as category, COUNT(*)::int as count
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE i.customfields->>'product_type' IS NOT NULL AND f.accountid = $1::text
      GROUP BY 1 ORDER BY count DESC LIMIT 30
    `, acct);
    
    // Tranches de prix
    const priceRanges = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(CASE WHEN i.price < 10 THEN 1 END)::int as "under10",
        COUNT(CASE WHEN i.price >= 10 AND i.price < 30 THEN 1 END)::int as "10to30",
        COUNT(CASE WHEN i.price >= 30 AND i.price < 50 THEN 1 END)::int as "30to50",
        COUNT(CASE WHEN i.price >= 50 AND i.price < 100 THEN 1 END)::int as "50to100",
        COUNT(CASE WHEN i.price >= 100 THEN 1 END)::int as "over100"
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE i.price IS NOT NULL AND f.accountid = $1::text
    `, acct);
    
    // Stock
    const stockInfo = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(CASE WHEN i.inventory > 0 THEN 1 END)::int as "inStock",
        COUNT(CASE WHEN i.inventory = 0 OR i.inventory IS NULL THEN 1 END)::int as "outOfStock"
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE f.accountid = $1::text
    `, acct);
    
    // Score (déjà optimisé vs pas)
    const enrichmentInfo = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(CASE WHEN i.customfields->>'optimized_title' IS NOT NULL THEN 1 END)::int as "hasOptTitle",
        COUNT(CASE WHEN i.customfields->>'optimized_title' IS NULL THEN 1 END)::int as "noOptTitle",
        COUNT(CASE WHEN i.customfields->>'optimized_description' IS NOT NULL THEN 1 END)::int as "hasOptDesc",
        COUNT(CASE WHEN i.customfields->>'optimized_description' IS NULL THEN 1 END)::int as "noOptDesc",
        COUNT(*)::int as total
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE f.accountid = $1::text
    `, acct);
    
    res.json({
      brands: brands || [],
      categories: categories || [],
      priceRanges: priceRanges?.[0] || {},
      stock: stockInfo?.[0] || {},
      enrichment: enrichmentInfo?.[0] || {},
      total: enrichmentInfo?.[0]?.total || 0
    });
  } catch (error) {
    console.error('Erreur segments:', error);
    res.status(500).json({ message: error.message });
  }
});

// Filtrer les items par segment
app.post('/api/v1/enrichment/filter-items', async (req, res) => {
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const { brands, categories, priceRange, stockFilter, enrichmentFilter, limit } = req.body;
    
    let conditions = [];
    let params = [];
    let paramIdx = 1;
    
    if (brands && brands.length > 0) {
      const placeholders = brands.map(() => `$${paramIdx++}::text`).join(',');
      conditions.push(`brand IN (${placeholders})`);
      params.push(...brands);
    }
    
    if (categories && categories.length > 0) {
      const placeholders = categories.map(() => `$${paramIdx++}::text`).join(',');
      conditions.push(`customfields->>'product_type' IN (${placeholders})`);
      params.push(...categories);
    }
    
    if (priceRange) {
      if (priceRange.min !== undefined) {
        conditions.push(`price >= $${paramIdx++}::numeric`);
        params.push(priceRange.min);
      }
      if (priceRange.max !== undefined) {
        conditions.push(`price <= $${paramIdx++}::numeric`);
        params.push(priceRange.max);
      }
    }
    
    if (stockFilter === 'in_stock') {
      conditions.push(`inventory > 0`);
    } else if (stockFilter === 'out_of_stock') {
      conditions.push(`(inventory = 0 OR inventory IS NULL)`);
    }
    
    if (enrichmentFilter === 'not_optimized') {
      conditions.push(`(customfields->>'optimized_title' IS NULL)`);
    } else if (enrichmentFilter === 'already_optimized') {
      conditions.push(`(customfields->>'optimized_title' IS NOT NULL)`);
    }
    
    // Ajouter filtre multi-tenant via JOIN Feed
    conditions.push(`f.accountid = $${paramIdx}::text`);
    params.push(req.accountId);
    paramIdx++;
    
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const maxLimit = Math.min(parseInt(limit) || 5000, 10000);
    
    const query = `SELECT i.id FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id ${where} LIMIT $${paramIdx}::int`;
    params.push(maxLimit);
    
    const items = await prisma.$queryRawUnsafe(query, ...params);
    
    // Compter le total (sans limit)
    const countQuery = `SELECT COUNT(*)::int as total FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id ${where}`;
    const countParams = params.slice(0, -1); // sans le limit
    const countResult = await prisma.$queryRawUnsafe(countQuery, ...countParams);
    
    res.json({
      itemIds: (items || []).map((i) => i.id),
      total: countResult?.[0]?.total || 0,
      limited: maxLimit
    });
  } catch (error) {
    console.error('Erreur filter-items:', error);
    res.status(500).json({ message: error.message });
  }
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
    prisma,
    authenticateToken,
    getAccountId: (req) => req.accountId
  });
} catch (e) {
  console.warn('Routes scoring canaux non chargées:', e.message);
}

// ====== PERFORMANCE PAR CANAL (historique + purge) ======
// GET /api/v1/performance/dashboard — agrégats par plateforme, top produits, par catégorie (ROAS, coût, revenus)
app.get('/api/v1/performance/dashboard', async (req, res) => {
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service indisponible' });
    const accountId = req.accountId || 'default-account';
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
    const accountId = req.accountId || 'default-account';
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
    const accountId = req.accountId || 'default-account';
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
        refreshToken = refreshToken || conns[0].refreshtoken;
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
    const accountId = req.accountId || 'default-account';
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
        accessToken = accessToken || conns[0].accesstoken;
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
    const accountId = req.accountId || 'default-account';
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
        const c = conns[0];
        profileId = profileId || c.merchantid;
        refreshToken = refreshToken || c.refreshtoken;
        const meta = (typeof c.metadata === 'string' ? JSON.parse(c.metadata || '{}') : c.metadata) || {};
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
app.get('/api/v1/platforms/gmc/auth-url', requireAuth, (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/content',         // Content API (produits)
    'https://www.googleapis.com/auth/userinfo.email'    // Email utilisateur
  ];
  
  const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',      // Pour obtenir un refresh_token
    prompt: 'consent',           // Forcer le consentement pour le refresh_token
    scope: scopes,
    state: JSON.stringify({ accountId: req.accountId }) // Passer l'accountId dans le state
  });
  
  res.json({ authUrl });
});

// 2. Callback OAuth2 — échangez le code contre des tokens
app.get('/api/v1/platforms/gmc/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    const appUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');
    const fluxRedirect = `${appUrl}/flux`;

    if (!code) {
      return res.redirect(`${fluxRedirect}?error=no_code`);
    }

    let accountId;
    try {
      const stateData = JSON.parse(state);
      accountId = stateData.accountId;
    } catch {
      return res.redirect(`${fluxRedirect}?error=invalid_state`);
    }

    if (!accountId) {
      return res.redirect(`${fluxRedirect}?error=no_account`);
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
    let merchantId = null;
    let merchantName = '';
    try {
      const accountsRes = await fetch('https://shoppingcontent.googleapis.com/content/v2.1/accounts/authinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        // Prendre le premier compte disponible
        if (accountsData.accountIdentifiers && accountsData.accountIdentifiers.length > 0) {
          merchantId = accountsData.accountIdentifiers[0].merchantId || accountsData.accountIdentifiers[0].aggregatorId;
        }
      }
    } catch (e) {
      console.warn('Erreur récupération comptes MC:', e.message);
    }
    
    // Sauvegarder la connexion en base
    if (prismaReady && prisma) {
      const connId = crypto.randomUUID();
      const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
      
      // Upsert : si une connexion GMC existe déjà pour ce compte, la mettre à jour
      await prisma.$executeRawUnsafe(`
        INSERT INTO "PlatformConnection" (id, accountid, platform, merchantid, accesstoken, refreshtoken, tokenexpiry, email, status, metadata, createdat, updatedat)
        VALUES ($1::text, $2::text, 'gmc', $3::text, $4::text, $5::text, $6::timestamptz, $7::text, 'active', $8::jsonb, NOW(), NOW())
        ON CONFLICT (accountid, platform) WHERE platform = 'gmc'
        DO UPDATE SET 
          merchantid = $3::text,
          accesstoken = $4::text,
          refreshtoken = COALESCE($5::text, "PlatformConnection".refreshtoken),
          tokenexpiry = $6::timestamptz,
          email = $7::text,
          status = 'active',
          metadata = $8::jsonb,
          updatedat = NOW()
      `, connId, accountId, merchantId, tokens.access_token, tokens.refresh_token || null, expiry, email,
         JSON.stringify({ merchantName, scope: tokens.scope }));
    }
    
    // Rediriger vers le frontend avec succès (APP_URL pour multi-env)
    res.redirect(`${fluxRedirect}?gmc=connected&merchant=${merchantId || ''}`);
  } catch (error) {
    console.error('GMC OAuth callback error:', error);
    const appUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');
    res.redirect(`${appUrl}/flux?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
  }
});

// 3. Statut de la connexion GMC
app.get('/api/v1/platforms/gmc/status', requireAuth, async (req, res) => {
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
    
    res.json({
      connected: conn.status === 'active',
      merchantId: conn.merchantid,
      email: conn.email,
      tokenExpired: isExpired,
      connectedAt: conn.createdat
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

// 4. Déconnecter GMC
app.delete('/api/v1/platforms/gmc/disconnect', requireAuth, async (req, res) => {
  try {
    if (prismaReady && prisma) {
      await prisma.$executeRawUnsafe(`
        DELETE FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'gmc'
      `, req.accountId);
    }
    res.json({ message: 'Google Merchant Center déconnecté' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== GOOGLE ADS — Connexion OAuth2 pour sync performance (shopping_performance_view) =====
app.get('/api/v1/platforms/google-ads/auth-url', requireAuth, (req, res) => {
  if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Connexion Google Ads non configurée (GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET).' });
  }
  const scopes = ['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/userinfo.email'];
  const oauth2Client = new OAuth2Client(GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REDIRECT_URI);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: JSON.stringify({ accountId: req.accountId, platform: 'google_ads' })
  });
  res.json({ authUrl });
});

app.get('/api/v1/platforms/google-ads/callback', async (req, res) => {
  const appUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');
  const performanceRedirect = `${appUrl}/performance`;
  try {
    const { code, state } = req.query;
    if (!code) return res.redirect(`${performanceRedirect}?error=no_code`);
    let accountId;
    try {
      const stateData = JSON.parse(state);
      accountId = stateData.accountId;
    } catch {
      return res.redirect(`${performanceRedirect}?error=invalid_state`);
    }
    if (!accountId || !GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET) {
      return res.redirect(`${performanceRedirect}?error=config`);
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
      const connId = crypto.randomUUID();
      const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "PlatformConnection" (id, accountid, platform, merchantid, accesstoken, refreshtoken, tokenexpiry, email, status, metadata, createdat, updatedat)
        VALUES ($1::text, $2::text, 'google_ads', $3::text, $4::text, $5::text, $6::timestamptz, $7::text, 'active', $8::jsonb, NOW(), NOW())
        ON CONFLICT (accountid, platform)
        DO UPDATE SET merchantid = $3::text, accesstoken = $4::text, refreshtoken = COALESCE($5::text, "PlatformConnection".refreshtoken), tokenexpiry = $6::timestamptz, email = $7::text, status = 'active', metadata = $8::jsonb, updatedat = NOW()
      `, connId, accountId, customerId || '', tokens.access_token, tokens.refresh_token || null, expiry, email, JSON.stringify({}));
    }
    res.redirect(`${performanceRedirect}?google_ads=connected&customer=${customerId || ''}`);
  } catch (error) {
    console.error('Google Ads OAuth callback error:', error);
    res.redirect(`${appUrl}/performance?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
  }
});

app.get('/api/v1/platforms/google-ads/status', requireAuth, async (req, res) => {
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

app.delete('/api/v1/platforms/google-ads/disconnect', requireAuth, async (req, res) => {
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
app.get('/api/v1/platforms/amazon/channels', requireAuth, async (req, res) => {
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
app.post('/api/v1/platforms/amazon/channels', requireAuth, async (req, res) => {
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
app.delete('/api/v1/platforms/amazon/channels/:channelKey', requireAuth, async (req, res) => {
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

// 5. Connexion Amazon — auth-url pour OAuth LWA
app.get('/api/v1/platforms/amazon/auth-url', requireAuth, (req, res) => {
  if (!AMAZON_APPLICATION_ID || !AMAZON_REDIRECT_URI || !AMAZON_LOGIN_URI) {
    return res.status(503).json({
      message: 'Connexion Amazon OAuth non configurée. Définissez AMAZON_APPLICATION_ID, AMAZON_REDIRECT_URI, AMAZON_LOGIN_URI.',
      configured: false
    });
  }
  const state = crypto.randomUUID();
  amazonOAuthStateStore.set(state, { accountId: req.accountId, createdAt: Date.now() });
  pruneAmazonStateStore();
  const authUrl = `${AMAZON_SELLER_CENTRAL_BASE}/apps/authorize/consent?application_id=${encodeURIComponent(AMAZON_APPLICATION_ID)}&state=${encodeURIComponent(state)}`;
  res.json({ authUrl, state, configured: true });
});

// 5b. Log-in URI — reçoit Amazon (amazon_callback_uri, amazon_state, selling_partner_id), redirige vers Amazon
app.get('/api/v1/platforms/amazon/login', (req, res) => {
  const { amazon_callback_uri, amazon_state, selling_partner_id } = req.query;
  if (!amazon_callback_uri || !amazon_state) {
    return res.status(400).send('Paramètres Amazon manquants (amazon_callback_uri, amazon_state)');
  }
  // Récupérer accountId depuis le cookie (défini par /connect)
  const accountId = req.cookies?.fp_amazon_connect_account;
  if (!accountId) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=no_session`);
  }
  res.clearCookie('fp_amazon_connect_account', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  const state = crypto.randomUUID();
  amazonOAuthStateStore.set(state, { accountId, sellingPartnerId: selling_partner_id, createdAt: Date.now() });
  pruneAmazonStateStore();
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
  const stored = amazonOAuthStateStore.get(state);
  if (!stored) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=invalid_state`);
  }
  amazonOAuthStateStore.delete(state);
  const { accountId } = stored;
  if (!AMAZON_LWA_CLIENT_ID || !AMAZON_LWA_CLIENT_SECRET || !AMAZON_REDIRECT_URI) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=config`);
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
    const tokens = await tokenRes.json();
    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('Amazon token exchange failed:', tokens);
      return res.redirect(`${APP_URL}/flux?amazon=error&reason=token_exchange`);
    }
    const expiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    if (prismaReady && prisma) {
      const existing = await prisma.$queryRawUnsafe(`
        SELECT id FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon' LIMIT 1
      `, accountId);
      const connId = crypto.randomUUID();
      const meta = JSON.stringify({ sellerId: selling_partner_id });
      if (existing && existing.length > 0) {
        await prisma.$executeRawUnsafe(`
          UPDATE "PlatformConnection" SET merchantid = $1::text, accesstoken = $2::text, refreshtoken = COALESCE($3::text, refreshtoken),
          tokenexpiry = $4::timestamptz, status = 'active', metadata = $5::jsonb, updatedat = NOW()
          WHERE accountid = $6::text AND platform = 'amazon'
        `, selling_partner_id || null, tokens.access_token, tokens.refresh_token, expiry, meta, accountId);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "PlatformConnection" (id, accountid, platform, merchantid, accesstoken, refreshtoken, tokenexpiry, status, metadata, createdat, updatedat)
          VALUES ($1::text, $2::text, 'amazon', $3::text, $4::text, $5::text, $6::timestamptz, 'active', $7::jsonb, NOW(), NOW())
        `, connId, accountId, selling_partner_id || null, tokens.access_token, tokens.refresh_token, expiry, meta);
      }
    }
    return res.redirect(`${APP_URL}/flux?amazon=connected&seller=${selling_partner_id || ''}`);
  } catch (e) {
    console.error('Amazon callback error:', e);
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=server`);
  }
});

// 5d. Init connexion — retourne l'URL à visiter pour lancer le flow OAuth
app.get('/api/v1/platforms/amazon/connect-init', requireAuth, (req, res) => {
  if (!AMAZON_APPLICATION_ID) {
    return res.status(503).json({ configured: false, message: 'Amazon OAuth non configuré' });
  }
  const code = crypto.randomUUID();
  amazonConnectCodeStore.set(code, { accountId: req.accountId, createdAt: Date.now() });
  pruneAmazonStateStore();
  const baseUrl = req.protocol + '://' + req.get('host');
  const connectUrl = `${baseUrl}/api/v1/platforms/amazon/connect?code=${code}`;
  res.json({ connectUrl, configured: true });
});

// 5e. Point d'entrée pour lancer la connexion — ?code=xxx, set cookie, redirige vers Seller Central
app.get('/api/v1/platforms/amazon/connect', (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=missing_code`);
  }
  const stored = amazonConnectCodeStore.get(code);
  if (!stored) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=invalid_code`);
  }
  amazonConnectCodeStore.delete(code);
  const accountId = stored.accountId;
  if (!AMAZON_APPLICATION_ID) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=not_configured`);
  }
  res.cookie('fp_amazon_connect_account', accountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60,
    path: '/'
  });
  const state = crypto.randomUUID();
  amazonOAuthStateStore.set(state, { accountId, createdAt: Date.now() });
  pruneAmazonStateStore();
  const authUrl = `${AMAZON_SELLER_CENTRAL_BASE}/apps/authorize/consent?application_id=${encodeURIComponent(AMAZON_APPLICATION_ID)}&state=${encodeURIComponent(state)}`;
  res.redirect(authUrl);
});

// 5f. Connexion manuelle (refresh_token) — pour tests ou app privée
app.post('/api/v1/platforms/amazon/connect', requireAuth, async (req, res) => {
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
      const meta = JSON.stringify({ sellerId: seller_id });
      if (existing && existing.length > 0) {
        await prisma.$executeRawUnsafe(`
          UPDATE "PlatformConnection" SET merchantid = COALESCE($1::text, merchantid), accesstoken = $2::text, refreshtoken = $3::text,
          tokenexpiry = $4::timestamptz, status = 'active', metadata = $5::jsonb, updatedat = NOW()
          WHERE accountid = $6::text AND platform = 'amazon'
        `, seller_id || null, tokens.access_token, refresh_token, expiry, meta, req.accountId);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "PlatformConnection" (id, accountid, platform, merchantid, accesstoken, refreshtoken, tokenexpiry, status, metadata, createdat, updatedat)
          VALUES ($1::text, $2::text, 'amazon', $3::text, $4::text, $5::text, $6::timestamptz, 'active', $7::jsonb, NOW(), NOW())
        `, connId, req.accountId, seller_id || null, tokens.access_token, refresh_token, expiry, meta);
      }
    }
    res.json({ message: 'Amazon connecté', connected: true });
  } catch (e) {
    console.error('Amazon connect error:', e);
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/v1/platforms/amazon/status', requireAuth, async (req, res) => {
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

app.delete('/api/v1/platforms/amazon/disconnect', requireAuth, async (req, res) => {
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
  oauth2Client.setCredentials({ refresh_token: connection.refreshtoken });
  
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
    `, credentials.access_token, expiry, connection.id);
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
      refresh_token: connection.refreshtoken,
      client_id: AMAZON_LWA_CLIENT_ID,
      client_secret: AMAZON_LWA_CLIENT_SECRET
    }).toString()
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    throw new Error(tokens.error_description || 'Erreur refresh token Amazon');
  }
  const expiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
  if (prismaReady && prisma) {
    await prisma.$executeRawUnsafe(`
      UPDATE "PlatformConnection" SET accesstoken = $1::text, tokenexpiry = $2::timestamptz, status = 'active', updatedat = NOW()
      WHERE id = $3::text
    `, tokens.access_token, expiry, connection.id);
  }
  return tokens.access_token;
}

// Push produits vers Amazon SP-API (Listings Items API)
app.post('/api/v1/platforms/amazon/push/:feedId', requireAuth, async (req, res) => {
  try {
    const { feedId } = req.params;
    const channel = (req.query.channel || req.body?.channel || 'amazon_fr').toLowerCase();
    const channelConfig = AMAZON_CHANNEL_CONFIG[channel];
    if (!channelConfig) {
      return res.status(400).json({ message: 'Canal invalide. Utilisez channel=amazon_fr|amazon_uk|amazon_de|amazon_it|amazon_es' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!await verifyFeedAccess(feedId, req.accountId)) {
      return res.status(403).json({ message: 'Accès refusé à ce flux' });
    }
    const connections = await prisma.$queryRawUnsafe(`
      SELECT * FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon' AND status = 'active'
    `, req.accountId);
    if (!connections || connections.length === 0) {
      return res.status(400).json({ message: 'Amazon non connecté. Connectez votre compte Seller Central d\'abord.' });
    }
    const conn = connections[0];
    let accessToken = conn.accesstoken;
    if (conn.tokenexpiry && new Date(conn.tokenexpiry) < new Date()) {
      try {
        accessToken = await refreshAmazonToken(conn);
      } catch (refreshErr) {
        return res.status(401).json({ message: 'Token Amazon expiré. Reconnectez votre compte.', reconnect: true });
      }
    }
    const meta = typeof conn.metadata === 'string' ? JSON.parse(conn.metadata || '{}') : (conn.metadata || {});
    const sellerId = conn.merchantid || meta.sellerId;
    if (!sellerId) {
      return res.status(400).json({ message: 'Seller ID manquant. Reconnectez Amazon.' });
    }
    const items = await prisma.$queryRawUnsafe(`
      SELECT id, "feedId", "originId", url, title, "descriptionHtml", "descriptionText", "imageUrl",
             brand, sku, price, currency, inventory, customfields, gtin, mpn
      FROM "FeedItem"
      WHERE "feedId" = $1::text
    `, feedId);
    if (!items || items.length === 0) {
      return res.json({ message: 'Aucun produit à pousser', total: 0, succeeded: 0, failed: 0 });
    }
    let succeeded = 0;
    let failed = 0;
    const errors = [];
    const marketplaceId = channelConfig.marketplaceId;
    const currency = channelConfig.currency;
    for (const item of items) {
      try {
        const cf = typeof item.customfields === 'string' ? JSON.parse(item.customfields || '{}') : (item.customfields || {});
        const n = normalizeForAmazon({ ...item, customfields: cf }, channelConfig);
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
          const errText = await putRes.text();
          failed++;
          errors.push({ sku, error: errText.substring(0, 200) });
        }
      } catch (e) {
        failed++;
        errors.push({ sku: item.sku || item.id, error: e.message });
      }
    }
    const logId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "ExportLog" (id, accountid, feedid, platform, status, totalproducts, succeeded, failed, errormessage, createdat)
      VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::int, $7::int, $8::int, $9::text, NOW())
    `, logId, req.accountId, feedId, channel, failed > 0 ? 'partial' : 'success', items.length, succeeded, failed, errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : null);
    res.json({
      message: `Push Amazon ${channelConfig.label} : ${succeeded} produits envoyés, ${failed} erreurs`,
      total: items.length,
      succeeded,
      failed,
      errors: errors.slice(0, 10),
      logId
    });
  } catch (error) {
    console.error('Amazon push error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Push produits vers Google Merchant Center
app.post('/api/v1/platforms/gmc/push/:feedId', requireAuth, async (req, res) => {
  try {
    const { feedId } = req.params;
    
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    // Vérifier accès au feed
    if (!await verifyFeedAccess(feedId, req.accountId)) {
      return res.status(403).json({ message: 'Accès refusé à ce flux' });
    }
    
    // Récupérer la connexion GMC
    const connections = await prisma.$queryRawUnsafe(`
      SELECT * FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'gmc' AND status = 'active'
    `, req.accountId);
    
    if (!connections || connections.length === 0) {
      return res.status(400).json({ message: 'Google Merchant Center non connecté. Connectez votre compte d\'abord.' });
    }
    
    const conn = connections[0];
    
    if (!conn.merchantid) {
      return res.status(400).json({ message: 'Aucun Merchant Center ID trouvé. Reconnectez votre compte.' });
    }
    
    // Rafraîchir le token si expiré
    let accessToken = conn.accesstoken;
    if (conn.tokenexpiry && new Date(conn.tokenexpiry) < new Date()) {
      try {
        accessToken = await refreshGMCToken(conn);
      } catch (refreshErr) {
        return res.status(401).json({ message: 'Token expiré et impossible de rafraîchir. Reconnectez Google Merchant Center.', reconnect: true });
      }
    }
    
    // Récupérer les produits du feed ; exclure ceux dont le canal Google est désactivé (casse FeedItem = migration 002)
    const items = await prisma.$queryRawUnsafe(`
      SELECT id, "feedId", "originId", url, title, "descriptionHtml", "descriptionText", "imageUrl",
             brand, sku, price, currency, inventory, customfields
      FROM "FeedItem"
      WHERE "feedId" = $1::text
      AND (customfields->'_channelOverrides'->>'google' IS NULL OR customfields->'_channelOverrides'->>'google' != 'false')
    `, feedId);
    
    if (!items || items.length === 0) {
      return res.json({ message: 'Aucun produit à pousser', total: 0, succeeded: 0, failed: 0 });
    }
    
    const merchantId = conn.merchantid;
    let succeeded = 0;
    let failed = 0;
    const errors = [];
    
    // Push par batch de 50
    const batchSize = 50;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Construire les entrées pour l'API Content API batch
      const DEFAULT_GMC_CATEGORY = 'Apparel & Accessories > Clothing';
      const entries = batch.map((item, idx) => {
        const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
        const { title: optTitle, description: optDesc } = getOptimizedContentForPlatform(item, 'gmc');
        const title = (optTitle || item.title || '').substring(0, 150);
        const description = (optDesc || '').replace(/<[^>]*>/g, '').substring(0, 5000);
        const price = item.price ? { value: String(Number(item.price).toFixed(2)), currency: item.currency || 'EUR' } : undefined;
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
            contentLanguage: 'fr',
            targetCountry: 'FR'
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
          // Si 401, marquer la connexion comme expirée
          if (batchRes.status === 401) {
            await prisma.$executeRawUnsafe(`UPDATE "PlatformConnection" SET status = 'expired', updatedat = NOW() WHERE id = $1::text`, conn.id);
            return res.status(401).json({ message: 'Token GMC expiré. Reconnectez votre compte.', reconnect: true });
          }
          failed += batch.length;
          errors.push({ batch: `${i}-${i + batch.length}`, error: errText.substring(0, 200) });
        }
      } catch (batchErr) {
        console.error('GMC batch fetch error:', batchErr);
        failed += batch.length;
        errors.push({ batch: `${i}-${i + batch.length}`, error: batchErr.message });
      }
    }
    
    // Log l'export
    const logId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "ExportLog" (id, accountid, feedid, platform, status, totalproducts, succeeded, failed, errormessage, createdat)
      VALUES ($1::text, $2::text, $3::text, 'gmc', $4::text, $5::int, $6::int, $7::int, $8::text, NOW())
    `, logId, req.accountId, feedId, failed > 0 ? 'partial' : 'success', items.length, succeeded, failed, errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null);
    
    // Envoyer email de résultat d'export
    try {
      const user = await findUserById(req.user.id);
      if (user?.email) {
        sendExportCompleteEmail(user.email, `Feed ${feedId.substring(0, 8)}`, { succeeded, failed, total: items.length })
          .catch(e => console.warn('Email export non envoyé:', e.message));
      }
    } catch {}
    
    res.json({
      message: `Push terminé : ${succeeded} produits envoyés, ${failed} erreurs`,
      total: items.length,
      succeeded,
      failed,
      errors: errors.slice(0, 10),
      logId
    });
    
  } catch (error) {
    console.error('GMC push error:', error);
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

    const acct = req.accountId || 'default-account';

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

// ====== FORGOT PASSWORD ======

app.post('/api/v1/auth/forgot-password', smartAuthLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }

    // Toujours retourner succès (même si email n'existe pas) pour ne pas révéler les comptes
    const user = await findUserByEmail(email);
    if (user && prismaReady && prisma) {
      // Générer un token de reset (expire dans 1h)
      const resetToken = crypto.randomUUID();
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await prisma.$executeRawUnsafe(`
        UPDATE "User" SET 
          resettoken = $1::text,
          resettokenexpiry = $2::timestamptz,
          updatedat = NOW()
        WHERE id = $3::text
      `, resetToken, expiry, user.id);

      // Envoyer l'email de reset
      sendPasswordResetEmail(email, resetToken).catch(e => console.warn('Email reset non envoyé:', e.message));
      console.log(`Password reset requested for ${email}`);
    }

    res.json({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Erreur' });
  }
});

app.post('/api/v1/auth/reset-password', smartAuthLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token et nouveau mot de passe requis' });
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre' });
    }

    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }

    const users = await prisma.$queryRawUnsafe(`
      SELECT * FROM "User" WHERE resettoken = $1::text AND resettokenexpiry > NOW()
    `, token);

    if (!users || users.length === 0) {
      return res.status(400).json({ message: 'Token invalide ou expiré' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$executeRawUnsafe(`
      UPDATE "User" SET 
        password = $1::text,
        resettoken = NULL,
        resettokenexpiry = NULL,
        updatedat = NOW()
      WHERE id = $2::text
    `, hashedPassword, users[0].id);

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Erreur' });
  }
});

// ====== ACCEPT INVITATION (définir mot de passe pour un utilisateur invité) ======

app.post('/api/v1/auth/accept-invitation', smartAuthLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token et mot de passe requis' });
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre' });
    }

    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }

    const users = await prisma.$queryRawUnsafe(`
      SELECT * FROM "User" WHERE resettoken = $1::text AND resettokenexpiry > NOW()
    `, token);

    if (!users || users.length === 0) {
      return res.status(400).json({ message: 'Lien d\'invitation invalide ou expiré' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = users[0].id;

    // Mettre à jour le mot de passe et activer le compte (status si la colonne existe)
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE "User" SET 
          password = $1::text,
          resettoken = NULL,
          resettokenexpiry = NULL,
          status = 'ACTIVE',
          updatedat = NOW()
        WHERE id = $2::text
      `, hashedPassword, userId);
    } catch (colErr) {
      if (colErr.message && colErr.message.includes('status')) {
        await prisma.$executeRawUnsafe(`
          UPDATE "User" SET 
            password = $1::text,
            resettoken = NULL,
            resettokenexpiry = NULL,
            updatedat = NOW()
          WHERE id = $2::text
        `, hashedPassword, userId);
      } else throw colErr;
    }

    res.json({ message: 'Compte activé avec succès' });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ message: 'Erreur' });
  }
});

// ====== SHOPIFY OAUTH CONNECTORS ======

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || 'read_products,read_inventory,read_locations';
const SHOPIFY_CALLBACK_URL = process.env.SHOPIFY_CALLBACK_URL || 'https://api.feedplug.com/api/v1/connectors/shopify/callback';
// APP_URL déjà déclaré plus haut dans run()

// Stockage temporaire des states OAuth (en prod, utiliser Redis ou la DB)
const pendingOAuthStates = new Map();

// Vérifier HMAC Shopify (requête d'installation)
function verifyShopifyHmac(query, secret) {
  const { hmac, ...rest } = query;
  if (!hmac || !secret) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('&');
  const crypto = require('crypto');
  const computed = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(computed, 'utf8'));
}

// GET /install : point d'entrée pour le lien d'installation généré par Partners (Custom distribution).
// Reçoit shop, timestamp, hmac ; vérifie HMAC puis redirige vers l'écran d'autorisation.
app.get('/api/v1/connectors/shopify/install', (req, res) => {
  try {
    const { shop, timestamp, hmac } = req.query;
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      return res.status(500).send('Clés Shopify non configurées');
    }
    if (!shop || !hmac) {
      return res.status(400).send('Paramètres shop et hmac requis');
    }
    const normalizedShop = String(shop).endsWith('.myshopify.com') ? String(shop) : `${String(shop)}.myshopify.com`;
    const query = { shop: normalizedShop, timestamp: timestamp || '', hmac: String(hmac) };
    if (!verifyShopifyHmac(query, SHOPIFY_API_SECRET)) {
      return res.status(400).send('Signature HMAC invalide');
    }
    const state = crypto.randomUUID();
    pendingOAuthStates.set(state, { shop: normalizedShop, guest: true, createdAt: Date.now() });
    setTimeout(() => pendingOAuthStates.delete(state), 15 * 60 * 1000);
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
    const { shop } = req.body;
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      return res.status(500).json({ message: 'Clés Shopify non configurées côté serveur' });
    }
    if (!shop) {
      return res.status(400).json({ message: 'Paramètre shop requis' });
    }
    const normalizedShop = shop.endsWith('.myshopify.com') ? shop : `${shop}.myshopify.com`;
    const state = crypto.randomUUID();
    
    // Stocker l'accountId pour l'associer au callback
    pendingOAuthStates.set(state, {
      accountId: req.user.accountId,
      userId: req.user.id,
      shop: normalizedShop,
      createdAt: Date.now()
    });
    // Nettoyage auto après 15 min
    setTimeout(() => pendingOAuthStates.delete(state), 15 * 60 * 1000);

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

// Callback OAuth: échange code -> access_token, stockage en base
app.get('/api/v1/connectors/shopify/callback', async (req, res) => {
  try {
    const { shop, code, state } = req.query;
    if (!shop || !code) {
      return res.status(400).send('Requête invalide (shop/code manquant)');
    }
    const normalizedShop = String(shop);

    // Vérifier le state CSRF et récupérer l'accountId
    const oauthContext = state ? pendingOAuthStates.get(String(state)) : null;
    if (state) pendingOAuthStates.delete(String(state));

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
        const secretData = JSON.stringify({
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
          // Flux Connect depuis FeedPlug : créer la source liée au compte
          const sourceId = crypto.randomUUID();
          const configData = JSON.stringify({ shop: normalizedShop });
          await prisma.$executeRawUnsafe(`
            INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, credentialid, accountid, createdat, updatedat)
            VALUES ($1::text, $2::text, 'SHOPIFY'::text, $3::jsonb, 'DAILY'::text, 'ACTIVE'::text, $4::text, $5::text, $6::timestamptz, $6::timestamptz)
          `, sourceId, `Shopify - ${normalizedShop}`, configData, credId, oauthContext.accountId, now);
          console.log(`✅ Shopify credential + source créés pour ${normalizedShop} (account: ${oauthContext.accountId})`);
        } else {
          // Flux install via lien Partners (guest) : credential seulement ; à lier via /claim depuis l'app
          console.log(`✅ Shopify credential créé pour ${normalizedShop} (en attente de liaison)`);
        }
      } catch (dbErr) {
        console.error('Erreur stockage credential Shopify:', dbErr.message);
      }
    } else if (!oauthContext && !isGuestInstall) {
      console.warn('⚠️ Token Shopify reçu mais pas pu stocker en DB (prisma non ready ou context manquant)');
    }

    const redirectUrl = `${APP_URL}/oauth/shopify/success?shop=${encodeURIComponent(normalizedShop)}&connected=1${isGuestInstall ? '&guest=1' : ''}`;
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
    const normalizedShop = String(shop).endsWith('.myshopify.com') ? String(shop) : `${String(shop)}.myshopify.com`;
    const accountId = req.user.accountId;
    const creds = await prisma.$queryRawUnsafe(`
      SELECT c.id FROM "Credential" c
      WHERE c.connector = 'SHOPIFY' AND c.secretjson->>'shop' = $1
      AND NOT EXISTS (SELECT 1 FROM "FeedSource" f WHERE f."credentialId" = c.id)
      LIMIT 1
    `, normalizedShop);
    if (!creds || creds.length === 0) {
      return res.status(404).json({ message: 'Aucune connexion Shopify en attente pour cette boutique' });
    }
    const credId = creds[0].id;
    const sourceId = crypto.randomUUID();
    const configData = JSON.stringify({ shop: normalizedShop });
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, credentialid, accountid, createdat, updatedat)
      VALUES ($1::text, $2::text, 'SHOPIFY'::text, $3::jsonb, 'DAILY'::text, 'ACTIVE'::text, $4::text, $5::text, $6::timestamptz, $6::timestamptz)
    `, sourceId, `Shopify - ${normalizedShop}`, configData, credId, accountId, now);
    console.log(`✅ Shopify source liée pour ${normalizedShop} (account: ${accountId})`);
    res.json({ ok: true, shop: normalizedShop });
  } catch (err) {
    console.error('Shopify claim error:', err);
    res.status(500).json({ message: 'Erreur lors de la liaison' });
  }
});

// Vérification d'accès Shopify (ping Admin API)
app.get('/api/v1/connectors/shopify/verify', authenticateToken, async (req, res) => {
  try {
    const { shop, access_token } = req.query;
    if (!shop || !access_token) {
      return res.status(400).json({ message: 'shop et access_token requis' });
    }
    const normalizedShop = String(shop);
    const resp = await fetch(`https://${normalizedShop}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': String(access_token),
      },
      body: JSON.stringify({ query: '{ shop { name } }' }),
    });
    const json = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json(json);
    }
    res.json({ ok: true, data: json });
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

console.log(`🚀 Backend attaché (port ${port})`);
console.log(`🌍 CORS configuré pour: ${allowedOrigins.join(', ')}`);
console.log(`📊 Stockage en mémoire activé (${inMemoryLeads.length} leads)`);

} // fin run()

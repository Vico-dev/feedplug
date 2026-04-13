function registerHealthRoutes(app, prisma, getPrismaReady, { getHealthSnapshot, chaos }) {
  const HEALTH_DB_TIMEOUT_MS = 5000;

  app.get('/api/v1/health', async (req, res) => {
    const health = await getHealthSnapshot();
    res.status(200).json(health);
  });

  app.get('/api/v1/ready', async (req, res) => {
    const health = await getHealthSnapshot();
    res.status(health.ready ? 200 : 503).json(health);
  });

  app.get('/api/v1/diagnostic', async (req, res) => {
    const { authenticateToken, requireStaffAccess } = require('../middleware/auth');
    authenticateToken(req, res, async () => {
      requireStaffAccess(req, res, async () => {
        const diagnostic = {
          timestamp: new Date().toISOString(),
          prismaReady: getPrismaReady(),
          hasPrismaClient: !!prisma,
          databaseUrl: process.env.DATABASE_URL ?
            process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@').substring(0, 100) + '...' :
            'NOT SET',
          tests: {}
        };

        if (prisma && getPrismaReady()) {
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
    });
  });

  app.get('/api/v1/inspect-table/:tableName', async (req, res) => {
    const { authenticateToken, requireStaffAccess } = require('../middleware/auth');
    authenticateToken(req, res, async () => {
      requireStaffAccess(req, res, async () => {
        if (!getPrismaReady() || !prisma) {
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
    });
  });

  app.post('/api/v1/cleanup-feed-table', async (req, res) => {
    const { authenticateToken, requireStaffAccess } = require('../middleware/auth');
    authenticateToken(req, res, async () => {
      requireStaffAccess(req, res, async () => {
        const { assertTableExists } = require('../lib/schema-guards');
        const requireSchemaRepairEnabled = (req, res, next) => {
          if (process.env.ENABLE_SCHEMA_REPAIR !== 'true') {
            return res.status(403).json({ message: 'Réparation schema désactivée' });
          }
          next();
        };
        requireSchemaRepairEnabled(req, res, async () => {
          res.status(200).json({ message: 'Nettoyage non implémenté dans cette version' });
        });
      });
    });
  });

  app.post('/api/v1/fix-schema', async (req, res) => {
    const { authenticateToken, requireStaffAccess } = require('../middleware/auth');
    authenticateToken(req, res, async () => {
      requireStaffAccess(req, res, async () => {
        res.status(200).json({ message: 'Fix schema non implémenté dans cette version' });
      });
    });
  });

  app.get('/api/v1/chaos/status', async (req, res) => {
    const { authenticateToken, requireStaffAccess } = require('../middleware/auth');
    authenticateToken(req, res, async () => {
      requireStaffAccess(req, res, () => {
        res.json({ chaosEnabled: chaos.isEnabled() });
      });
    });
  });

  app.post('/api/v1/chaos/trigger', async (req, res) => {
    const { authenticateToken, requireStaffAccess } = require('../middleware/auth');
    authenticateToken(req, res, async () => {
      requireStaffAccess(req, res, () => {
        const { type } = req.body || {};
        try {
          chaos.trigger(type);
          res.json({ message: 'Chaos triggered', type });
        } catch (err) {
          res.status(400).json({ message: err.message });
        }
      });
    });
  });
}

module.exports = { registerHealthRoutes };

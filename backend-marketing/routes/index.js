const { registerHealthRoutes } = require('./health');
const { registerAuthRoutes } = require('./auth');
const { registerAccountRoutes } = require('./accounts');
const { registerEnrichmentRoutes } = require('./enrichment');

function registerAllRoutes(app, prisma, getPrismaReady, deps) {
  registerHealthRoutes(app, prisma, getPrismaReady, deps);
  registerAuthRoutes(app, prisma, getPrismaReady, deps);
  registerAccountRoutes(app, prisma, getPrismaReady, deps);
  registerEnrichmentRoutes(app, prisma, getPrismaReady, deps);
}

module.exports = { registerAllRoutes };

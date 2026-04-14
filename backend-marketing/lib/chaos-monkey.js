/**
 * Chaos Monkey (staging / dev uniquement).
 * Permet d'injecter des pannes contrôlées pour valider la résilience et le monitoring.
 * NE JAMAIS activer en production (NODE_ENV=production).
 */

const CHAOS_ENABLED = process.env.CHAOS_MONKEY_ENABLED === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Scénarios possibles (un seul actif à la fois) */
const SCENARIOS = {
  db_fail: { next: 'db', count: 1 },      // Prochaine requête Prisma échoue
  latency: { next: 'latency', ms: 5000 },  // Prochaine requête retardée de 5s
  timeout: { next: 'timeout' },            // Simuler un timeout
  error500: { next: '500' },              // Répondre 500 sur la prochaine requête
};

let activeScenario = null;

function isAllowed() {
  return CHAOS_ENABLED && !IS_PRODUCTION;
}

/**
 * Enregistre un scénario à déclencher une seule fois sur le prochain usage.
 * @param {'db_fail'|'latency'|'timeout'|'error500'} name
 * @param {{ ms?: number }} opts
 */
function triggerOnce(name, opts = {}) {
  if (!isAllowed()) return;
  activeScenario = { name, ...SCENARIOS[name], ...opts };
}

function clearScenario() {
  activeScenario = null;
}

/**
 * À appeler avant une requête Prisma : si scénario db_fail, throw.
 */
function maybeFailDb() {
  if (!isAllowed() || !activeScenario || activeScenario.next !== 'db') return;
  const s = activeScenario;
  if (s.count > 0) {
    s.count--;
    clearScenario();
    throw new Error('[Chaos Monkey] Simulated DB failure');
  }
}

/**
 * À appeler en début de requête HTTP : si latency, attendre ; si 500, appeler next(err).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function chaosMiddleware(req, res, next) {
  if (!isAllowed() || !activeScenario) return next();

  const s = activeScenario;

  if (s.next === 'latency' && s.ms) {
    clearScenario();
    await new Promise((r) => setTimeout(r, s.ms));
    return next();
  }

  if (s.next === '500') {
    clearScenario();
    return res.status(500).json({ message: '[Chaos Monkey] Simulated 500' });
  }

  if (s.next === 'timeout') {
    clearScenario();
    await new Promise(() => {}); // Never resolve → request hangs until client timeout
    return;
  }

  next();
}

/**
 * Wrapper pour prisma.$queryRaw / $executeRaw : injecte une erreur si scénario db_fail.
 * À utiliser en un seul endroit central (ex. un proxy autour de prisma en mode chaos).
 */
function wrapPrismaForChaos(prisma) {
  if (!prisma || !isAllowed()) return prisma;
  const raw = prisma.$queryRawUnsafe || prisma.$queryRaw;
  const exec = prisma.$executeRawUnsafe || prisma.$executeRaw;
  if (!raw || !exec) return prisma;

  return {
    ...prisma,
    $queryRawUnsafe: async (...args) => {
      maybeFailDb();
      return prisma.$queryRawUnsafe(...args);
    },
    $queryRaw: async (...args) => {
      maybeFailDb();
      return prisma.$queryRaw(...args);
    },
    $executeRawUnsafe: async (...args) => {
      maybeFailDb();
      return prisma.$executeRawUnsafe(...args);
    },
    $executeRaw: async (...args) => {
      maybeFailDb();
      return prisma.$executeRaw(...args);
    },
  };
}

module.exports = {
  isAllowed,
  triggerOnce,
  clearScenario,
  chaosMiddleware,
  maybeFailDb,
  wrapPrismaForChaos,
  SCENARIOS: Object.keys(SCENARIOS),
};

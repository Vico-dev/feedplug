/**
 * Limites et fonctionnalités par plan (STARTER, PROFESSIONAL, ENTERPRISE + grille V2 TIER_*).
 * Grille V2 : tranches produits (TIER_100 … TIER_50000), max 5 canaux, add-on IA en option.
 */
const {
  isPendingGraceExpired,
} = require('../domains/billing/access-state');

const PLAN_IDS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
const TIER_IDS = ['TIER_100', 'TIER_500', 'TIER_1000', 'TIER_2500', 'TIER_10000', 'TIER_50000'];
/** Max canaux par défaut (configurateur 1–5). Au-delà = sur devis (max_channels NULL ou > 5 sur le compte). */
const MAX_CHANNELS_DEFAULT = 5;
const MAX_CHANNELS = MAX_CHANNELS_DEFAULT;

/** Limites numériques par plan. null = illimité */
const PLAN_LIMITS = {
  STARTER: {
    maxProducts: 1000,
    maxFeedSources: 3,
    maxFeeds: 3,
  },
  PROFESSIONAL: {
    maxProducts: 10000,
    maxFeedSources: null,
    maxFeeds: null,
  },
  ENTERPRISE: {
    maxProducts: null,
    maxFeedSources: null,
    maxFeeds: null,
  },
};

/** Grille V2 : maxProducts par tranche (TIER_*). */
const TIER_MAX_PRODUCTS = {
  TIER_100: 100,
  TIER_500: 500,
  TIER_1000: 1000,
  TIER_2500: 2500,
  TIER_10000: 10000,
  TIER_50000: 50000,
};

/** Fonctionnalités activées par plan (true = inclus) */
const PLAN_FEATURES = {
  STARTER: {
    exportGmc: true,
    aiEnrichment: false,
    qualityScore: false,
    supportLevel: 'email', // email | priority | dedicated
  },
  PROFESSIONAL: {
    exportGmc: true,
    aiEnrichment: true,
    qualityScore: true,
    supportLevel: 'priority',
  },
  ENTERPRISE: {
    exportGmc: true,
    aiEnrichment: true,
    qualityScore: true,
    supportLevel: 'dedicated',
  },
};

/**
 * Récupère le plan d'un compte (depuis la BDD).
 * @param {object} prisma - client Prisma
 * @param {string} accountId
 * @returns {Promise<string>} - 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'
 */
async function getAccountPlan(prisma, accountId) {
  if (!prisma || !accountId) return 'STARTER';
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT plan, billingstatus, paymentgraceuntil FROM "Account" WHERE id = $1::text LIMIT 1`,
      accountId
    );
    if (isPendingGraceExpired(rows?.[0])) return 'STARTER';
    const plan = rows?.[0]?.plan;
    if (PLAN_IDS.includes(plan) || TIER_IDS.includes(plan)) return plan;
    return 'STARTER';
  } catch (e) {
    if (e?.code === '42703' || /billingstatus|paymentgraceuntil/i.test(e?.message || '')) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT plan FROM "Account" WHERE id = $1::text LIMIT 1`,
          accountId
        );
        const plan = rows?.[0]?.plan;
        if (PLAN_IDS.includes(plan) || TIER_IDS.includes(plan)) return plan;
      } catch (fallbackError) {
        console.warn('getAccountPlan fallback error:', fallbackError?.message);
      }
    }
    console.warn('getAccountPlan error:', e?.message);
    return 'STARTER';
  }
}

/**
 * Récupère si le compte a souscrit l'add-on Pack IA (grille V2).
 * @param {object} prisma
 * @param {string} accountId
 * @returns {Promise<boolean>}
 */
async function getAccountAddonIA(prisma, accountId) {
  if (!prisma || !accountId) return false;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(addonia, false) AS addonia, billingstatus, paymentgraceuntil FROM "Account" WHERE id = $1::text LIMIT 1`,
      accountId
    );
    if (isPendingGraceExpired(rows?.[0])) return false;
    return rows?.[0]?.addonia === true;
  } catch (e) {
    if (e?.code === '42703') return false;
    if (/billingstatus|paymentgraceuntil/i.test(e?.message || '')) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT COALESCE(addonia, false) AS addonia FROM "Account" WHERE id = $1::text LIMIT 1`,
          accountId
        );
        return rows?.[0]?.addonia === true;
      } catch (fallbackError) {
        console.warn('getAccountAddonIA fallback error:', fallbackError?.message);
      }
    }
    console.warn('getAccountAddonIA error:', e?.message);
    return false;
  }
}

/**
 * Récupère le nombre max de canaux autorisés pour le compte (colonne max_channels).
 * 1–5 = configurateur ; NULL en BDD = illimité (sur devis).
 * @param {object} prisma
 * @param {string} accountId
 * @returns {Promise<number|null>} - nombre max ou null = illimité (sur devis)
 */
async function getAccountMaxChannels(prisma, accountId) {
  if (!prisma || !accountId) return MAX_CHANNELS_DEFAULT;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT max_channels, billingstatus, paymentgraceuntil FROM "Account" WHERE id = $1::text LIMIT 1`,
      accountId
    );
    if (isPendingGraceExpired(rows?.[0])) return MAX_CHANNELS_DEFAULT;
    const val = rows?.[0]?.max_channels;
    if (rows?.[0] === undefined) return MAX_CHANNELS_DEFAULT;
    if (val == null) return null; // NULL en BDD = illimité (sur devis)
    return Number(val);
  } catch (e) {
    if (e?.code === '42703') return MAX_CHANNELS_DEFAULT; // colonne pas encore migrée
    if (/billingstatus|paymentgraceuntil/i.test(e?.message || '')) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT max_channels FROM "Account" WHERE id = $1::text LIMIT 1`,
          accountId
        );
        const val = rows?.[0]?.max_channels;
        if (rows?.[0] === undefined) return MAX_CHANNELS_DEFAULT;
        if (val == null) return null;
        return Number(val);
      } catch (fallbackError) {
        console.warn('getAccountMaxChannels fallback error:', fallbackError?.message);
      }
    }
    console.warn('getAccountMaxChannels error:', e?.message);
    return MAX_CHANNELS_DEFAULT;
  }
}

/**
 * Compte le nombre de canaux d'export actifs du compte (toutes plateformes).
 * @param {object} prisma
 * @param {string} accountId
 * @returns {Promise<number>}
 */
async function countChannelsForAccount(prisma, accountId) {
  if (!prisma || !accountId) return 0;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "ExportChannel" WHERE accountid = $1::text AND isactive = true`,
      accountId
    );
    return rows?.[0]?.c ?? 0;
  } catch (e) {
    console.warn('countChannelsForAccount error:', e?.message);
    return 0;
  }
}

/**
 * Vérifie si le compte peut ajouter une ressource (sources, feeds, ou produits).
 * @param {object} prisma - client Prisma
 * @param {string} accountId
 * @param {'maxFeedSources'|'maxFeeds'|'maxProducts'} limitKey
 * @param {number} currentCount - nombre actuel
 * @returns {Promise<{ allowed: boolean, plan: string, limit: number|null, message?: string }>}
 */
function getMaxProductsForPlan(plan) {
  if (TIER_MAX_PRODUCTS[plan] != null) return TIER_MAX_PRODUCTS[plan];
  const L = PLAN_LIMITS[plan] || PLAN_LIMITS.STARTER;
  return L.maxProducts;
}

async function checkPlanLimit(prisma, accountId, limitKey, currentCount) {
  if (limitKey === 'maxChannels') {
    const limit = await getAccountMaxChannels(prisma, accountId);
    const allowed = limit === null || currentCount < limit;
    let message;
    if (!allowed) message = `Limite de votre plan (${limit} canaux). Contactez-nous pour un devis.`;
    const plan = await getAccountPlan(prisma, accountId);
    return { allowed, plan, limit: limit ?? MAX_CHANNELS_DEFAULT, message };
  }
  const plan = await getAccountPlan(prisma, accountId);
  const limits = PLAN_LIMITS[plan] || (TIER_MAX_PRODUCTS[plan] != null ? { maxFeedSources: null, maxFeeds: null, maxProducts: TIER_MAX_PRODUCTS[plan] } : PLAN_LIMITS.STARTER);
  const limit = limits[limitKey];

  if (limit == null) {
    return { allowed: true, plan, limit: null };
  }
  const allowed = currentCount < limit;
  let message;
  if (!allowed) {
    const labels = {
      maxFeedSources: 'sources de flux',
      maxFeeds: 'flux',
      maxProducts: 'produits',
    };
    message = `Limite de votre plan (${limit} ${labels[limitKey]}). Passez à un plan supérieur pour en ajouter.`;
  }
  return { allowed, plan, limit, message };
}

/**
 * Vérifie si une fonctionnalité est disponible pour le plan du compte.
 * @param {object} prisma - client Prisma
 * @param {string} accountId
 * @param {keyof PLAN_FEATURES.STARTER} featureKey - ex: 'aiEnrichment', 'qualityScore'
 * @returns {Promise<{ allowed: boolean, plan: string, message?: string }>}
 */
async function canUseFeature(prisma, accountId, featureKey) {
  if (featureKey === 'addonIA') {
    const allowed = await getAccountAddonIA(prisma, accountId);
    const plan = await getAccountPlan(prisma, accountId);
    return {
      allowed,
      plan,
      message: allowed ? undefined : 'Le pack IA (génération titres + images) est disponible en add-on (+49 € HT/mois).',
    };
  }
  const plan = await getAccountPlan(prisma, accountId);
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.STARTER;
  const allowed = features[featureKey] === true;
  let message;
  if (!allowed && (featureKey === 'aiEnrichment' || featureKey === 'qualityScore')) {
    message = 'Cette fonctionnalité est disponible à partir du plan Professional.';
  }
  return { allowed, plan, message };
}

/**
 * Vérifie la limite canaux (max_channels du compte, ou 5 par défaut). Pour création d'un nouveau canal.
 * max_channels NULL = illimité (sur devis).
 * @param {object} prisma
 * @param {string} accountId
 * @param {number} currentChannelCount - nombre actuel de canaux actifs
 * @returns {Promise<{ allowed: boolean, limit: number|null, message?: string }>}
 */
async function checkChannelLimit(prisma, accountId, currentChannelCount) {
  const limit = await getAccountMaxChannels(prisma, accountId);
  const allowed = limit === null || currentChannelCount < limit;
  const effectiveLimit = limit ?? MAX_CHANNELS_DEFAULT;
  const message = allowed ? undefined : `Limite de votre plan (${effectiveLimit} canaux). Contactez-nous pour un devis.`;
  return { allowed, limit: limit, message };
}

/**
 * Compte le nombre de FeedItem (produits) pour un compte (tous flux confondus).
 * @param {object} prisma
 * @param {string} accountId
 * @returns {Promise<number>}
 */
async function countProductsForAccount(prisma, accountId) {
  if (!prisma || !accountId) return 0;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "FeedItem" i JOIN "Feed" f ON f.id = i.feedid WHERE f.accountid = $1::text`,
      accountId
    );
    return rows?.[0]?.c ?? 0;
  } catch (e) {
    console.warn('countProductsForAccount error:', e?.message);
    return 0;
  }
}

/**
 * Retourne les limites et features du plan pour exposition API (frontend).
 * Inclut addonIA (grille V2) et maxChannels (du compte si fourni, sinon défaut 5).
 * @param {string} plan
 * @param {boolean} addonIA
 * @param {number|null} [maxChannelsFromAccount] - max_channels du compte ; null = défaut 5
 * @returns {object}
 */
function getPlanCapabilitiesForApi(plan, addonIA = false, maxChannelsFromAccount = undefined) {
  const p = PLAN_IDS.includes(plan) || TIER_IDS.includes(plan) ? plan : 'STARTER';
  const limits = PLAN_LIMITS[p] || (TIER_MAX_PRODUCTS[p] != null ? { maxProducts: TIER_MAX_PRODUCTS[p], maxFeedSources: null, maxFeeds: null } : PLAN_LIMITS.STARTER);
  const maxChannels = maxChannelsFromAccount === undefined ? MAX_CHANNELS_DEFAULT : maxChannelsFromAccount; // null = illimité (sur devis)
  const limitsWithChannels = { ...limits, maxChannels };
  const features = PLAN_FEATURES[p] || PLAN_FEATURES.STARTER;
  const featuresWithAddon = { ...features, addonIA: !!addonIA };
  return {
    plan: p,
    limits: limitsWithChannels,
    features: featuresWithAddon,
  };
}

module.exports = {
  PLAN_IDS,
  TIER_IDS,
  PLAN_LIMITS,
  PLAN_FEATURES,
  MAX_CHANNELS,
  MAX_CHANNELS_DEFAULT,
  getAccountPlan,
  getAccountAddonIA,
  getAccountMaxChannels,
  countChannelsForAccount,
  getMaxProductsForPlan,
  checkPlanLimit,
  checkChannelLimit,
  canUseFeature,
  countProductsForAccount,
  getPlanCapabilitiesForApi,
};

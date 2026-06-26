/**
 * A3 — Plafonds IA DURS par plan (bloquants).
 *
 * Contrairement au soft cap (lib/ai-quota.js, alertes seulement), ces plafonds
 * sont enforced AVANT chaque appel IA payant : au-delà du cap, aucune route /
 * scheduler n'appelle Gemini ni la génération d'images.
 *
 * Grille validée business (PLAN_REMEDIATION_BLOQUANTS.md, A3). Surchargeable par
 * variable d'environnement :
 *   AI_CAP_TEXT_<PLAN>   (ex. AI_CAP_TEXT_STARTER=3000)
 *   AI_CAP_IMAGE_<PLAN>  (ex. AI_CAP_IMAGE_TIER_1000=750)
 * où <PLAN> est l'identifiant exact ('STARTER', 'TIER_1000', …).
 *
 * Plan inconnu → repli prudent sur STARTER.
 */

const { getAccountPlan } = require('./plan-limits');
const { getAiUsageByKind, normalizeKind, currentPeriod } = require('./ai-quota');

/** Grille de référence { plan: { text, image } } (par mois). */
const AI_CAPS = {
  STARTER: { text: 2000, image: 100 },
  TIER_100: { text: 2000, image: 100 },
  TIER_500: { text: 5000, image: 250 },
  PROFESSIONAL: { text: 10000, image: 500 },
  TIER_1000: { text: 10000, image: 500 },
  TIER_2500: { text: 25000, image: 1000 },
  ENTERPRISE: { text: 100000, image: 3000 },
  TIER_10000: { text: 100000, image: 3000 },
  TIER_50000: { text: 300000, image: 8000 },
};

/** Plan de repli quand le plan est inconnu / non mappé. */
const DEFAULT_PLAN = 'STARTER';

/**
 * Cap (entier) pour un plan + kind, avec surcharge env prioritaire.
 * @param {string} plan
 * @param {'text'|'image'} kind
 * @returns {number}
 */
function getCap(plan, kind) {
  const k = normalizeKind(kind);
  const planKey = AI_CAPS[plan] ? plan : DEFAULT_PLAN;
  const envKey = `AI_CAP_${k.toUpperCase()}_${planKey}`;
  const envVal = process.env[envKey];
  if (envVal !== undefined && envVal !== '') {
    const parsed = Number(envVal);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
  }
  return AI_CAPS[planKey][k];
}

/**
 * Vérifie si un compte peut consommer `requestedCount` opérations IA d'un type
 * donné sans dépasser son plafond mensuel dur.
 *
 * À lire AVANT l'appel IA payant. Ne consomme rien (lecture seule) — le
 * comptage réel reste à recordAiUsage/trackAiUsage après l'opération.
 *
 * @param {object} prisma
 * @param {string} accountId
 * @param {'text'|'image'} kind
 * @param {number} [requestedCount=1] - nombre d'opérations qu'on s'apprête à faire
 * @returns {Promise<{ allowed: boolean, used: number, cap: number, remaining: number, plan: string, kind: string, requested: number, period: string }>}
 */
async function checkAiQuota(prisma, accountId, kind, requestedCount = 1) {
  const k = normalizeKind(kind);
  const period = currentPeriod();
  const requested = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : 1;

  const plan = await getAccountPlan(prisma, accountId);
  const cap = getCap(plan, k);
  const usage = await getAiUsageByKind(prisma, accountId, period);
  const used = usage[k] || 0;
  const remaining = Math.max(0, cap - used);
  const allowed = used + requested <= cap;

  return { allowed, used, cap, remaining, plan, kind: k, requested, period };
}

/**
 * Message d'erreur 429 standard pour un dépassement de quota.
 * @param {{ used:number, cap:number, remaining:number, requested:number, kind:string }} q
 * @returns {string}
 */
function quotaMessage(q) {
  const label = q.kind === 'image' ? "d'images" : 'de texte';
  if (q.requested > 1 && q.remaining > 0) {
    return `Quota IA ${label} insuffisant : ${q.requested} demandées, ${q.remaining} restantes ce mois-ci (${q.used}/${q.cap}). Réduisez la sélection ou passez à un plan supérieur.`;
  }
  return `Plafond IA ${label} mensuel atteint (${q.used}/${q.cap}). Il se réinitialise au début du mois prochain, ou passez à un plan supérieur.`;
}

module.exports = {
  AI_CAPS,
  DEFAULT_PLAN,
  getCap,
  checkAiQuota,
  quotaMessage,
};

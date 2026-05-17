/**
 * Suivi de la consommation IA — soft cap.
 *
 * On compte les optimisations IA par compte et par mois. On NE bloque PAS :
 * le but est de protéger la marge en donnant de la visibilité (compteur côté
 * client + alerte interne à 80 % et 100 % du plafond de référence).
 *
 * 1 optimisation = 1 titre, 1 description, 1 lot d'attributs ou 1 image pour
 * 1 produit.
 */

// Plafond mensuel de référence (par compte). Sert au calcul du % et des seuils
// d'alerte ; ce n'est PAS une limite dure.
const AI_SOFT_CAP_MONTHLY = 1000;

function currentPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Incrémente le compteur IA du compte pour le mois courant.
 * Renvoie { used, softCap, period, threshold } où threshold vaut 80 ou 100
 * uniquement la première fois que le seuil correspondant est franchi (sinon null).
 * Tolérant : en cas d'erreur DB, renvoie threshold null et ne lève pas.
 */
async function recordAiUsage(prisma, accountId, count = 1) {
  const period = currentPeriod();
  if (!prisma || !accountId || !Number.isFinite(count) || count <= 0) {
    return { used: 0, softCap: AI_SOFT_CAP_MONTHLY, period, threshold: null };
  }
  try {
    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO ai_usage (accountid, period, count, updatedat)
       VALUES ($1::text, $2::text, $3::int, NOW())
       ON CONFLICT (accountid, period) DO UPDATE SET
         count = ai_usage.count + EXCLUDED.count,
         updatedat = NOW()
       RETURNING count, alerted80, alerted100`,
      accountId, period, Math.floor(count)
    );
    const row = rows?.[0];
    if (!row) return { used: 0, softCap: AI_SOFT_CAP_MONTHLY, period, threshold: null };

    const used = Number(row.count) || 0;
    let threshold = null;
    if (used >= AI_SOFT_CAP_MONTHLY && row.alerted100 !== true) {
      threshold = 100;
      await prisma.$executeRawUnsafe(
        `UPDATE ai_usage SET alerted100 = true, alerted80 = true WHERE accountid = $1::text AND period = $2::text`,
        accountId, period
      );
    } else if (used >= AI_SOFT_CAP_MONTHLY * 0.8 && row.alerted80 !== true) {
      threshold = 80;
      await prisma.$executeRawUnsafe(
        `UPDATE ai_usage SET alerted80 = true WHERE accountid = $1::text AND period = $2::text`,
        accountId, period
      );
    }
    return { used, softCap: AI_SOFT_CAP_MONTHLY, period, threshold };
  } catch (e) {
    console.warn('recordAiUsage error:', e?.message);
    return { used: 0, softCap: AI_SOFT_CAP_MONTHLY, period, threshold: null };
  }
}

/**
 * Lit la consommation IA du compte pour le mois courant (compteur read-only).
 * Renvoie { used, softCap, period, percent }.
 */
async function getAiUsage(prisma, accountId) {
  const period = currentPeriod();
  const base = { used: 0, softCap: AI_SOFT_CAP_MONTHLY, period, percent: 0 };
  if (!prisma || !accountId) return base;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT count FROM ai_usage WHERE accountid = $1::text AND period = $2::text LIMIT 1`,
      accountId, period
    );
    const used = Number(rows?.[0]?.count) || 0;
    return { used, softCap: AI_SOFT_CAP_MONTHLY, period, percent: Math.round((used / AI_SOFT_CAP_MONTHLY) * 100) };
  } catch (e) {
    console.warn('getAiUsage error:', e?.message);
    return base;
  }
}

module.exports = { AI_SOFT_CAP_MONTHLY, currentPeriod, recordAiUsage, getAiUsage };

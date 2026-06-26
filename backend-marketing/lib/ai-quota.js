/**
 * Suivi de la consommation IA — compteurs séparés texte / images (A2).
 *
 * On compte les opérations IA par compte, par mois et par TYPE (`kind` :
 * 'text' ou 'image'). Le comptage alimente :
 *   - les alertes internes 80 % / 100 % du plafond de référence (soft cap) ;
 *   - le hard cap par plan (lib/ai-caps.js → checkAiQuota), lu AVANT chaque
 *     appel IA payant.
 *
 * 1 opération texte  = 1 titre, 1 description, 1 lot d'attributs ou 1 traduction.
 * 1 opération image  = 1 image générée (lifestyle).
 *
 * Note rétro-compat : `recordAiUsage`/`getAiUsage` gardent leur signature ;
 * `kind` est un paramètre optionnel (défaut 'text'). `getAiUsage` renvoie
 * désormais `{ text, image, period }` ; le total agrégé reste accessible via
 * `getAiUsageTotal`.
 */

// Plafond mensuel de référence (par compte) pour les alertes soft cap. Ce
// n'est PAS la limite dure (celle-ci dépend du plan, voir lib/ai-caps.js).
const AI_SOFT_CAP_MONTHLY = 1000;

const VALID_KINDS = ['text', 'image'];

function normalizeKind(kind) {
  const k = String(kind || 'text').toLowerCase();
  return VALID_KINDS.includes(k) ? k : 'text';
}

function currentPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Incrémente le compteur IA du compte pour le mois courant et le type donné.
 * Renvoie { used, softCap, period, kind, threshold } où threshold vaut 80 ou
 * 100 uniquement la première fois que le seuil correspondant est franchi (sinon
 * null). Tolérant : en cas d'erreur DB, renvoie threshold null et ne lève pas.
 *
 * @param {object} prisma
 * @param {string} accountId
 * @param {number} [count=1]
 * @param {'text'|'image'} [kind='text']
 */
async function recordAiUsage(prisma, accountId, count = 1, kind = 'text') {
  const period = currentPeriod();
  const k = normalizeKind(kind);
  if (!prisma || !accountId || !Number.isFinite(count) || count <= 0) {
    return { used: 0, softCap: AI_SOFT_CAP_MONTHLY, period, kind: k, threshold: null };
  }
  try {
    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO ai_usage (accountid, period, kind, count, updatedat)
       VALUES ($1::text, $2::text, $3::text, $4::int, NOW())
       ON CONFLICT (accountid, period, kind) DO UPDATE SET
         count = ai_usage.count + EXCLUDED.count,
         updatedat = NOW()
       RETURNING count, alerted80, alerted100`,
      accountId, period, k, Math.floor(count)
    );
    const row = rows?.[0];
    if (!row) return { used: 0, softCap: AI_SOFT_CAP_MONTHLY, period, kind: k, threshold: null };

    const used = Number(row.count) || 0;
    let threshold = null;
    if (used >= AI_SOFT_CAP_MONTHLY && row.alerted100 !== true) {
      threshold = 100;
      await prisma.$executeRawUnsafe(
        `UPDATE ai_usage SET alerted100 = true, alerted80 = true WHERE accountid = $1::text AND period = $2::text AND kind = $3::text`,
        accountId, period, k
      );
    } else if (used >= AI_SOFT_CAP_MONTHLY * 0.8 && row.alerted80 !== true) {
      threshold = 80;
      await prisma.$executeRawUnsafe(
        `UPDATE ai_usage SET alerted80 = true WHERE accountid = $1::text AND period = $2::text AND kind = $3::text`,
        accountId, period, k
      );
    }
    return { used, softCap: AI_SOFT_CAP_MONTHLY, period, kind: k, threshold };
  } catch (e) {
    console.warn('recordAiUsage error:', e?.message);
    return { used: 0, softCap: AI_SOFT_CAP_MONTHLY, period, kind: k, threshold: null };
  }
}

/**
 * Lit la consommation IA d'un compte pour le mois courant, ventilée par type.
 * Renvoie un objet { text, image } où chaque entrée vaut le nombre d'opérations.
 * Tolérant aux schémas pré-A2 (sans colonne `kind`) : tout est alors compté
 * comme 'text'.
 *
 * @returns {Promise<{ text: number, image: number, period: string }>}
 */
async function getAiUsageByKind(prisma, accountId, period = currentPeriod()) {
  const base = { text: 0, image: 0, period };
  if (!prisma || !accountId) return base;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT kind, count FROM ai_usage WHERE accountid = $1::text AND period = $2::text`,
      accountId, period
    );
    for (const row of rows || []) {
      const k = normalizeKind(row.kind);
      base[k] += Number(row.count) || 0;
    }
    return base;
  } catch (e) {
    // Schéma pré-A2 (pas de colonne kind) : on retombe sur un SELECT sans kind.
    if (e?.code === '42703' || /column .*kind|kind/i.test(e?.message || '')) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT count FROM ai_usage WHERE accountid = $1::text AND period = $2::text`,
          accountId, period
        );
        let total = 0;
        for (const row of rows || []) total += Number(row.count) || 0;
        return { text: total, image: 0, period };
      } catch (fallbackErr) {
        console.warn('getAiUsageByKind fallback error:', fallbackErr?.message);
        return base;
      }
    }
    console.warn('getAiUsageByKind error:', e?.message);
    return base;
  }
}

/**
 * Lit la consommation IA du compte pour le mois courant (compteurs séparés).
 * Renvoie { text:{used,cap}, image:{used,cap}, period }.
 * `cap` = plafond de référence soft (AI_SOFT_CAP_MONTHLY), pour l'affichage front.
 */
async function getAiUsage(prisma, accountId) {
  const period = currentPeriod();
  const byKind = await getAiUsageByKind(prisma, accountId, period);
  return {
    text: { used: byKind.text, cap: AI_SOFT_CAP_MONTHLY },
    image: { used: byKind.image, cap: AI_SOFT_CAP_MONTHLY },
    period,
  };
}

/**
 * Total agrégé (texte + images) pour le mois courant. Conservé pour les
 * appelants historiques qui raisonnaient sur un compteur unique.
 * @returns {Promise<{ used: number, softCap: number, period: string, percent: number }>}
 */
async function getAiUsageTotal(prisma, accountId) {
  const period = currentPeriod();
  const byKind = await getAiUsageByKind(prisma, accountId, period);
  const used = byKind.text + byKind.image;
  return {
    used,
    softCap: AI_SOFT_CAP_MONTHLY,
    period,
    percent: Math.round((used / AI_SOFT_CAP_MONTHLY) * 100),
  };
}

module.exports = {
  AI_SOFT_CAP_MONTHLY,
  VALID_KINDS,
  normalizeKind,
  currentPeriod,
  recordAiUsage,
  getAiUsage,
  getAiUsageByKind,
  getAiUsageTotal,
};

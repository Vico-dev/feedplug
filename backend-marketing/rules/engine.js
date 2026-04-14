/**
 * Moteur d'exécution des règles Optimiser : evaluateCondition + applyAction.
 * Réf. docs/OPTIMISEUR_REGLES_CHANNABLE_STYLE.md
 */
const { getFieldValue, setFieldValue } = require('./field-access');
const { executeAiFillTasks } = require('./ai-fill');

/**
 * Évalue une condition individuelle sur un item.
 */
function evaluateSingleCondition(item, cond) {
  const val = getFieldValue(item, cond.field);
  const compareVal = cond.value;
  const strVal = val != null ? String(val).toLowerCase() : '';
  const strCompare = compareVal != null ? String(compareVal).toLowerCase() : '';

  switch (cond.operator) {
    case 'is_empty':
      return val === undefined || val === null || val === '';
    case 'is_not_empty':
      return val !== undefined && val !== null && val !== '';
    case 'equals':
      return strVal === strCompare;
    case 'not_equals':
      return strVal !== strCompare;
    case 'contains':
      return strVal.includes(strCompare);
    case 'starts_with':
      return strVal.startsWith(strCompare);
    case 'ends_with':
      return strVal.endsWith(strCompare);
    case 'in': {
      const arr = Array.isArray(compareVal) ? compareVal : [compareVal];
      return arr.some(v => String(val).toLowerCase() === String(v).toLowerCase());
    }
    case 'not_in': {
      const arr = Array.isArray(compareVal) ? compareVal : [compareVal];
      return !arr.some(v => String(val).toLowerCase() === String(v).toLowerCase());
    }
    case 'lt':
      return typeof val === 'number' && typeof compareVal === 'number' && val < compareVal;
    case 'lte':
      return typeof val === 'number' && typeof compareVal === 'number' && val <= compareVal;
    case 'gt':
      return typeof val === 'number' && typeof compareVal === 'number' && val > compareVal;
    case 'gte':
      return typeof val === 'number' && typeof compareVal === 'number' && val >= compareVal;
    case 'regex': {
      try {
        const re = new RegExp(compareVal, 'i');
        return re.test(String(val || ''));
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/**
 * Évalue conditionJson (IF) sur un item.
 */
function evaluateCondition(conditionJson, item) {
  if (!conditionJson || !item) return false;
  const conditions = conditionJson.conditions || [];
  const op = (conditionJson.operator || 'AND').toUpperCase();
  if (conditions.length === 0) return false;

  if (op === 'AND') {
    return conditions.every(c => evaluateSingleCondition(item, c));
  }
  return conditions.some(c => evaluateSingleCondition(item, c));
}

/**
 * Applique une action (THEN) sur un item. Modifie l'objet en place.
 * @returns {{ excluded: boolean }} excluded=true si l'item doit être exclu du flux
 */
function applyAction(actionJson, item) {
  if (!actionJson || !item) return { excluded: false };
  const type = actionJson.type;
  const params = actionJson.params || {};

  if (type === 'exclude') {
    item._excluded = true;
    return { excluded: true };
  }

  const field = params.field;
  if (!field) return { excluded: false };

  switch (type) {
    case 'set_value': {
      setFieldValue(item, field, params.value);
      break;
    }
    case 'copy_field': {
      const src = getFieldValue(item, params.sourceField);
      setFieldValue(item, field, src);
      break;
    }
    case 'template': {
      let template = params.template || '';
      const matches = template.match(/\{([^}]+)\}/g) || [];
      for (const m of matches) {
        const key = m.slice(1, -1).trim();
        const v = getFieldValue(item, key);
        template = template.replace(m, v != null ? String(v) : '');
      }
      setFieldValue(item, field, template);
      break;
    }
    case 'search_replace': {
      const current = getFieldValue(item, field);
      if (current == null) break;
      const str = String(current);
      const pattern = params.pattern;
      const replacement = params.replacement ?? '';
      let result;
      try {
        const re = typeof pattern === 'string' ? new RegExp(pattern, 'g') : pattern;
        result = str.replace(re, replacement);
      } catch {
        result = str.replace(String(pattern), replacement);
      }
      setFieldValue(item, field, result);
      break;
    }
    case 'calculate': {
      const formula = params.formula;
      const current = getFieldValue(item, field);
      if (current == null || typeof current !== 'number') break;
      try {
        const expr = formula
          .replace(/\bprice\b/gi, String(current))
          .replace(/\bvalue\b/gi, String(current));
        const computed = Function('"use strict"; return (' + expr + ')')();
        if (typeof computed === 'number' && !Number.isNaN(computed)) {
          setFieldValue(item, field, Math.round(computed * 100) / 100);
        }
      } catch {
        // ignorer les formules invalides
      }
      break;
    }
    case 'concat': {
      const fields = params.fields || [];
      const sep = params.separator ?? ' ';
      const parts = fields.map(f => {
        const v = getFieldValue(item, f);
        return v != null ? String(v) : '';
      });
      setFieldValue(item, field, parts.join(sep));
      break;
    }
    case 'ai_fill':
      return { excluded: false, deferredAiFill: true };
  }
  return { excluded: false };
}

/**
 * Applique toutes les règles actives sur une liste d'items.
 * @param {Array} items - Items à traiter (seront modifiés en place)
 * @param {Array} rules - Règles triées par priorité (croissant), doivent inclure id
 * @param {string} feedId - feedId des items (pour filtrage feedIds)
 * @param {string} channelId - canal cible (pour filtrage channelIds)
 * @param {object} options - optionnel : { ruleAbAssignments: Map<ruleId, Map<itemId, 'CONTROL'|'VARIANT'>> }
 *   Si une règle a des assignments A/B : CONTROL = ne pas appliquer la règle, VARIANT = appliquer
 * @returns {{ applied: number, excluded: number }}
 */
function applyRules(items, rules, feedId, channelId, options = {}) {
  const ruleAbAssignments = options.ruleAbAssignments || null;
  const aiFillTasks = options.aiFillTasks || null;
  let applied = 0;
  let excluded = 0;
  let aiQueued = 0;
  for (const rule of rules) {
    const ruleFeedIds = rule.feedIds || [];
    const channelIds = rule.channelIds || [];
    const channelOk = channelIds.length === 0 || (channelId && channelIds.includes(channelId));
    if (!channelOk) continue;

    const conditionJson = typeof rule.conditionJson === 'string'
      ? JSON.parse(rule.conditionJson || '{}')
      : (rule.conditionJson || {});
    const actionJson = typeof rule.actionJson === 'string'
      ? JSON.parse(rule.actionJson || '{}')
      : (rule.actionJson || {});

    const abForRule = rule.id && ruleAbAssignments ? ruleAbAssignments.get(rule.id) : null;

    for (const item of items) {
      if (item._excluded) continue;
      const itemFeedId = item.feedId ?? item.feedid ?? feedId;
      const feedOk = ruleFeedIds.length === 0 || (itemFeedId && ruleFeedIds.includes(itemFeedId));
      if (!feedOk) continue;
      if (!evaluateCondition(conditionJson, item)) continue;

      if (abForRule) {
        const arm = abForRule.get(item.id);
        if (arm === 'CONTROL') continue; // témoin : on n'applique pas la règle
        if (arm !== 'VARIANT') continue; // item pas dans le test : on n'applique pas (ou appliquer selon produit : ici on exclut si pas assigné)
      }

      if (actionJson.type === 'ai_fill' && aiFillTasks) {
        aiFillTasks.push({ item, rule, actionJson, channelId });
        aiQueued++;
        continue;
      }

      const result = applyAction(actionJson, item);
      if (result.excluded) excluded++;
      else applied++;
    }
  }
  return { applied, excluded, aiQueued };
}

/**
 * Filtre et trie les règles actives pour un compte/scope donné.
 */
function getActiveRules(rules, options = {}) {
  const now = new Date();
  return (rules || [])
    .filter(r => r.isActive !== false)
    .filter(r => {
      if (r.startDate && new Date(r.startDate) > now) return false;
      if (r.endDate && new Date(r.endDate) < now) return false;
      return true;
    })
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

const FEED_ITEM_COLUMNS = ['title', 'descriptionhtml', 'descriptiontext', 'imageurl', 'brand', 'sku', 'price', 'currency', 'inventory', 'url', 'gtin', 'mpn', 'condition'];
const RULES_BATCH_SIZE = 80;

/**
 * Met à jour FeedItem par batch (réduit les requêtes SQL).
 */
async function batchUpdateFeedItems(prisma, items, now) {
  if (!items.length) return;
  for (let b = 0; b < items.length; b += RULES_BATCH_SIZE) {
    const batch = items.slice(b, b + RULES_BATCH_SIZE);
    const params = [];
    const valueRows = [];
    const cols = ['id', ...FEED_ITEM_COLUMNS, 'customfields', 'updatedat'];
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const cf = item.customfields || {};
      const rowParams = [item.id];
      for (const col of FEED_ITEM_COLUMNS) {
        const camel = col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const val = item[col] ?? item[camel];
        rowParams.push(val === null || val === undefined ? null : (typeof val === 'number' ? val : String(val)));
      }
      rowParams.push(JSON.stringify(cf), now);
      params.push(...rowParams);
      const base = params.length - rowParams.length;
      const placeholders = rowParams.map((_, j) => {
        const idx = base + j + 1;
        if (j === 0) return `$${idx}::text`;
        if (j === rowParams.length - 1) return `$${idx}::timestamptz`;
        if (j === rowParams.length - 2) return `$${idx}::jsonb`;
        return `$${idx}::text`;
      });
      valueRows.push(`(${placeholders.join(', ')})`);
    }
    const setList = FEED_ITEM_COLUMNS.map(c => `"${c}" = v."${c}"`).join(', ');
    const vCols = cols.map(c => c === 'customfields' ? 'customfields' : `"${c}"`).join(', ');
    const sql = `UPDATE "FeedItem" f SET ${setList}, customfields = v.customfields::jsonb, updatedat = v.updatedat FROM (VALUES ${valueRows.join(', ')}) AS v(${vCols}) WHERE f.id = v.id`;
    await prisma.$executeRawUnsafe(sql, ...params);
  }
}

/**
 * Applique les règles avec runOnIngestion=true après une ingestion.
 * À appeler depuis le pipeline ingestion, AVANT applyEnrichmentSources.
 * @param {object} prisma - Prisma client
 * @param {string} feedId - ID du flux ingéré
 * @param {string} accountId - ID du compte
 * @param {function} createRevision - fn(prisma, itemId, snapshot, source)
 * @returns {{ applied: number, excluded: number, rulesCount: number }}
 */
async function applyRulesOnIngestion(prisma, feedId, accountId, createRevision) {
  if (!prisma || !feedId || !accountId) return { applied: 0, excluded: 0, rulesCount: 0 };
  const rules = await prisma.$queryRawUnsafe(`
    SELECT id, name, conditionjson, actionjson, feedids, channelids, priority, isactive, startdate, enddate
    FROM "Rule"
    WHERE accountid = $1::text AND isactive = true AND runoningestion = true
    ORDER BY priority ASC
  `, accountId);
  const activeRules = getActiveRules(rules);
  if (activeRules.length === 0) return { applied: 0, excluded: 0, rulesCount: 0 };
  const items = await prisma.$queryRawUnsafe(`
    SELECT i.*, i.feedid
    FROM "FeedItem" i
    WHERE i.feedid = $1::text
  `, feedId);
  if (!items || items.length === 0) return { applied: 0, excluded: 0, rulesCount: activeRules.length };
  const itemsToProcess = items.map(it => {
    const customfields = typeof it.customfields === 'string' ? JSON.parse(it.customfields || '{}') : (it.customfields || {});
    return { ...it, customfields };
  });
  const aiFillTasks = [];
  const { applied, excluded, aiQueued } = applyRules(itemsToProcess, activeRules, feedId, null, { aiFillTasks });
  const aiResult = aiFillTasks.length > 0
    ? await executeAiFillTasks(prisma, aiFillTasks, { feedId })
    : { applied: 0, skipped: 0, failed: 0, totalCost: 0 };
  const now = new Date().toISOString();
  const toUpdate = itemsToProcess.filter(it => !it._excluded);
  await batchUpdateFeedItems(prisma, toUpdate, now);
  if (createRevision && toUpdate.length > 0 && toUpdate.length <= 500) {
    const { buildItemSnapshot } = require('../lib/revisions');
    for (const item of toUpdate) {
      try {
        const snap = buildItemSnapshot({ ...item, customfields: item.customfields || {} });
        await createRevision(prisma, item.id, snap, 'rule');
      } catch (revErr) {
        console.warn('Révision rule (ingestion) non créée:', revErr.message);
      }
    }
  }
  return {
    applied: applied + aiResult.applied,
    excluded,
    rulesCount: activeRules.length,
    aiQueued,
    aiApplied: aiResult.applied,
    aiSkipped: aiResult.skipped,
    aiFailed: aiResult.failed,
    aiCost: aiResult.totalCost,
  };
}

module.exports = {
  getFieldValue,
  setFieldValue,
  evaluateCondition,
  applyAction,
  applyRules,
  getActiveRules,
  applyRulesOnIngestion,
  batchUpdateFeedItems,
  FEED_ITEM_COLUMNS
};

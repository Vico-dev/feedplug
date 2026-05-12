/**
 * Schémas de validation pour conditionJson et actionJson des règles Optimiser.
 * Réf. docs/OPTIMISEUR_REGLES_CHANNABLE_STYLE.md
 */

const CONDITION_OPERATORS = [
  'contains', 'equals', 'not_equals', 'is_empty', 'is_not_empty',
  'starts_with', 'ends_with', 'in', 'not_in',
  'lt', 'lte', 'gt', 'gte',
  'regex'
];

const ACTION_TYPES = [
  'set_value', 'copy_field', 'template', 'search_replace',
  'calculate', 'concat', 'exclude', 'ai_fill'
];

/**
 * Valide une condition individuelle.
 */
function validateCondition(cond) {
  if (!cond || typeof cond !== 'object') {
    return { valid: false, error: 'Condition invalide: doit être un objet' };
  }
  if (!cond.field || typeof cond.field !== 'string') {
    return { valid: false, error: 'Champ "field" requis (string)' };
  }
  if (!cond.operator || !CONDITION_OPERATORS.includes(cond.operator)) {
    return { valid: false, error: `Opérateur invalide. Valeurs acceptées: ${CONDITION_OPERATORS.join(', ')}` };
  }
  // value peut être absent pour is_empty, is_not_empty
  if (!['is_empty', 'is_not_empty'].includes(cond.operator) && cond.value === undefined) {
    return { valid: false, error: 'Champ "value" requis pour cet opérateur' };
  }
  return { valid: true };
}

/**
 * Valide conditionJson complet (IF).
 * @param {object} conditionJson
 * @returns {{ valid: boolean, error?: string }}
 */
function validateConditionJson(conditionJson) {
  if (!conditionJson || typeof conditionJson !== 'object') {
    return { valid: false, error: 'conditionJson invalide: doit être un objet' };
  }
  const op = conditionJson.operator || 'AND';
  if (!['AND', 'OR'].includes(op)) {
    return { valid: false, error: 'operator doit être AND ou OR' };
  }
  const conditions = conditionJson.conditions;
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return { valid: false, error: 'conditions doit être un tableau non vide' };
  }
  for (let i = 0; i < conditions.length; i++) {
    const r = validateCondition(conditions[i]);
    if (!r.valid) return { valid: false, error: `Condition ${i + 1}: ${r.error}` };
  }
  return { valid: true };
}

/**
 * Valide les paramètres selon le type d'action.
 */
function validateActionParams(type, params) {
  if (!params || typeof params !== 'object') {
    return { valid: false, error: 'params requis' };
  }
  switch (type) {
    case 'set_value':
      if (params.field === undefined) return { valid: false, error: 'field requis' };
      return { valid: true };
    case 'copy_field':
      if (!params.field || !params.sourceField) {
        return { valid: false, error: 'field et sourceField requis' };
      }
      return { valid: true };
    case 'template':
      if (!params.field || !params.template) {
        return { valid: false, error: 'field et template requis' };
      }
      return { valid: true };
    case 'search_replace':
      if (!params.field || params.pattern === undefined) {
        return { valid: false, error: 'field et pattern requis' };
      }
      if (params.replacement === undefined) params.replacement = '';
      return { valid: true };
    case 'calculate':
      if (!params.field || !params.formula) {
        return { valid: false, error: 'field et formula requis' };
      }
      return { valid: true };
    case 'concat':
      if (!params.field || !Array.isArray(params.fields) || params.fields.length === 0) {
        return { valid: false, error: 'field et fields (array) requis' };
      }
      if (params.separator === undefined) params.separator = ' ';
      return { valid: true };
    case 'exclude':
      return { valid: true };
    case 'ai_fill':
      if (!params.field) return { valid: false, error: 'field requis' };
      return { valid: true };
    default:
      return { valid: false, error: `Type d'action inconnu: ${type}` };
  }
}

/**
 * Valide actionJson complet (THEN).
 * @param {object} actionJson
 * @returns {{ valid: boolean, error?: string }}
 */
function validateActionJson(actionJson) {
  if (!actionJson || typeof actionJson !== 'object') {
    return { valid: false, error: 'actionJson invalide: doit être un objet' };
  }
  const type = actionJson.type;
  if (!type || !ACTION_TYPES.includes(type)) {
    return { valid: false, error: `type invalide. Valeurs: ${ACTION_TYPES.join(', ')}` };
  }
  const r = validateActionParams(type, actionJson.params || {});
  if (!r.valid) return r;
  return { valid: true };
}

/**
 * Valide une règle complète (pour création/mise à jour).
 */
function validateRule(body) {
  const errors = [];
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push('name requis et non vide');
  }
  const cond = validateConditionJson(body.conditionJson);
  if (!cond.valid) errors.push(`conditionJson: ${cond.error}`);
  const act = validateActionJson(body.actionJson);
  if (!act.valid) errors.push(`actionJson: ${act.error}`);
  if (body.feedIds !== undefined && !Array.isArray(body.feedIds)) {
    errors.push('feedIds doit être un tableau');
  }
  if (body.channelIds !== undefined && !Array.isArray(body.channelIds)) {
    errors.push('channelIds doit être un tableau');
  }
  if (body.destinationIds !== undefined && !Array.isArray(body.destinationIds)) {
    errors.push('destinationIds doit être un tableau');
  }
  if (body.priority !== undefined && (typeof body.priority !== 'number' || body.priority < 0)) {
    errors.push('priority doit être un nombre >= 0');
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

module.exports = {
  CONDITION_OPERATORS,
  ACTION_TYPES,
  validateCondition,
  validateConditionJson,
  validateActionJson,
  validateRule
};

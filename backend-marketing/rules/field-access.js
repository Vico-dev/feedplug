const FIELD_ALIASES = {
  description: ['descriptionText', 'descriptiontext', 'descriptionHtml', 'descriptionhtml'],
  descriptionText: ['descriptionText', 'descriptiontext', 'descriptionHtml', 'descriptionhtml'],
  descriptionHtml: ['descriptionHtml', 'descriptionhtml', 'descriptionText', 'descriptiontext'],
  image_link: ['imageUrl', 'imageurl'],
  imageUrl: ['imageUrl', 'imageurl'],
  link: ['url'],
  google_product_category: ['google_product_category', 'googleProductCategory'],
  product_type: ['product_type', 'productType'],
  age_group: ['age_group', 'ageGroup'],
};

const CUSTOMFIELD_FALLBACK_FIELDS = new Set([
  'google_product_category',
  'googleProductCategory',
  'product_type',
  'productType',
  'color',
  'size',
  'material',
  'pattern',
  'gender',
  'age_group',
  'ageGroup',
  'shipping',
  'tax'
]);

function snake(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function aliasList(field) {
  if (!field) return [];
  const aliases = FIELD_ALIASES[field] || [field];
  const expanded = new Set();

  for (const alias of aliases) {
    expanded.add(alias);
    expanded.add(snake(alias));
  }

  return Array.from(expanded);
}

function ensureCustomFields(item) {
  if (!item.customfields || typeof item.customfields !== 'object') {
    item.customfields = {};
  }
  if (!item.customFields || typeof item.customFields !== 'object') {
    item.customFields = item.customfields;
  }
  return item.customfields;
}

function getFieldValue(item, field) {
  if (!item || !field) return undefined;

  if (field.startsWith('customfields.') || field.startsWith('customFields.')) {
    const key = field.replace(/^customfields\.|^customFields\./, '');
    const cf = item.customfields ?? item.customFields ?? item.custom_fields;
    if (!cf || typeof cf !== 'object') return undefined;
    return cf[key];
  }

  for (const alias of aliasList(field)) {
    if (item[alias] !== undefined) {
      return item[alias];
    }
  }

  if (CUSTOMFIELD_FALLBACK_FIELDS.has(field)) {
    const cf = item.customfields ?? item.customFields ?? item.custom_fields;
    if (cf && typeof cf === 'object') {
      for (const alias of aliasList(field)) {
        if (cf[alias] !== undefined) {
          return cf[alias];
        }
      }
    }
  }

  return undefined;
}

function setFieldValue(item, field, value) {
  if (!item || !field) return;

  if (field.startsWith('customfields.') || field.startsWith('customFields.')) {
    const key = field.replace(/^customfields\.|^customFields\./, '');
    const cf = ensureCustomFields(item);
    cf[key] = value;
    item.customFields[key] = value;
    return;
  }

  const aliases = aliasList(field);
  for (const alias of aliases) {
    item[alias] = value;
  }

  if (CUSTOMFIELD_FALLBACK_FIELDS.has(field)) {
    const cf = ensureCustomFields(item);
    for (const alias of aliases) {
      cf[alias] = value;
    }
  }
}

module.exports = {
  getFieldValue,
  setFieldValue,
  CUSTOMFIELD_FALLBACK_FIELDS,
  FIELD_ALIASES,
  aliasList,
  snake,
};

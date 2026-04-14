function normalizeColumnName(key) {
  if (typeof key !== 'string') return '';
  return key.replace(/^[\uFEFF\u200B\u200C\u200D\u2060\s]+/, '').replace(/[\s\u200B\u200C\u200D\u2060]+$/, '').trim().toLowerCase();
}

function buildNormalizedRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) {
    const normalizedKey = normalizeColumnName(key);
    if (!normalizedKey) continue;
    if (out[normalizedKey] === undefined || out[normalizedKey] === null || out[normalizedKey] === '') {
      out[normalizedKey] = value;
    }
  }
  return out;
}

function getFirstNonEmptyValue(rowNorm) {
  const preferred = ['id', 'sku', 'link', 'url', 'title', 'name', 'item_id', 'product_id', 'price', 'gtin'];
  for (const key of preferred) {
    const value = rowNorm?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  for (const value of Object.values(rowNorm || {})) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
}

function getRowValueCaseInsensitive(row, possibleKeys) {
  const rowKeysLower = {};
  for (const key of Object.keys(row || {})) {
    const normalizedKey = normalizeColumnName(key);
    if (normalizedKey) rowKeysLower[normalizedKey] = key;
  }
  for (const key of possibleKeys || []) {
    const normalizedKey = normalizeColumnName(key);
    if (row?.[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    const originalKey = rowKeysLower[normalizedKey];
    if (originalKey !== undefined && row?.[originalKey] !== undefined && row[originalKey] !== null && row[originalKey] !== '') {
      return row[originalKey];
    }
  }
  return undefined;
}

function mapRowToItem(row, mapping) {
  const out = {};
  const rowKeysLower = {};
  for (const key of Object.keys(row || {})) {
    const normalizedKey = normalizeColumnName(key);
    if (normalizedKey) rowKeysLower[normalizedKey] = key;
  }
  for (const [target, source] of Object.entries(mapping || {})) {
    if (!source) continue;
    const sourceNorm = normalizeColumnName(source);
    const value = row?.[source]
      ?? (sourceNorm ? row?.[sourceNorm] ?? (rowKeysLower[sourceNorm] != null ? row[rowKeysLower[sourceNorm]] : undefined) : undefined);
    out[target] = value !== undefined ? value : undefined;
  }
  return out;
}

module.exports = {
  buildNormalizedRow,
  getFirstNonEmptyValue,
  getRowValueCaseInsensitive,
  mapRowToItem,
  normalizeColumnName,
};

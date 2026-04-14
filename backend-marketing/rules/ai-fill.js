const { enrichFieldWithAI } = require('../enrichment/ai-enrichment');
const {
  deduceBrand,
  deduceGoogleProductCategory,
  deduceProductType,
} = require('../enrichment/auto-enrichment');
const {
  validateOrMapGoogleCategory,
  validateOrMapProductType,
} = require('../enrichment/auto-categorization');
const { optimizeTitleWithAI } = require('../optimization/title-optimizer');
const { optimizeDescriptionWithAI } = require('../optimization/description-optimizer');
const { getFieldValue, setFieldValue } = require('./field-access');

function hasValue(value) {
  return !(value === undefined || value === null || value === '');
}

function normalizePlatform(channelId) {
  const value = String(channelId || 'gmc').toLowerCase();
  if (value.includes('amazon')) return 'AMAZON';
  if (value.includes('meta')) return 'META';
  if (value.includes('chatgpt') || value.includes('llm')) return 'CHATGPT';
  return 'GMC';
}

function normalizeField(field) {
  if (!field) return null;
  if (field === 'description' || field === 'descriptionHtml' || field === 'descriptionhtml') {
    return 'descriptionText';
  }
  return field;
}

function cloneItemForOptimizers(item) {
  const customfields = item.customfields || item.customFields || {};
  return {
    ...item,
    customfields,
    customFields: customfields,
  };
}

async function generateAiValue(prisma, item, field, options = {}) {
  const platform = normalizePlatform(options.channelId || options.platform);
  const product = cloneItemForOptimizers(item);

  switch (field) {
    case 'title': {
      const result = await optimizeTitleWithAI(prisma, product, { platform, forceRefresh: false });
      return {
        value: result.optimizedTitle || null,
        cost: result.cost || 0,
        cached: result.cached || false,
        source: 'title_optimizer',
      };
    }
    case 'descriptionText': {
      const result = await optimizeDescriptionWithAI(prisma, product, { platform, forceRefresh: false });
      return {
        value: result.optimizedDescription || null,
        cost: result.cost || 0,
        cached: result.cached || false,
        source: 'description_optimizer',
      };
    }
    case 'google_product_category': {
      const current = getFieldValue(item, field);
      const categoryValidation = validateOrMapGoogleCategory(current, product);
      if (categoryValidation?.suggested) {
        return { value: categoryValidation.suggested, cost: 0, cached: false, source: 'category_mapping' };
      }

      const deduced = deduceGoogleProductCategory(product);
      if (deduced) {
        const normalized = validateOrMapGoogleCategory(deduced, product);
        return {
          value: normalized?.suggested || deduced,
          cost: 0,
          cached: false,
          source: 'category_deduction',
        };
      }

      const aiValue = await enrichFieldWithAI(prisma, product, 'google_product_category');
      if (!aiValue) return { value: null, cost: 0, cached: false, source: 'ai_enrichment' };
      const normalized = validateOrMapGoogleCategory(aiValue, product);
      return {
        value: normalized?.suggested || null,
        cost: 0,
        cached: false,
        source: 'ai_enrichment',
      };
    }
    case 'product_type': {
      const current = getFieldValue(item, field);
      const productTypeValidation = validateOrMapProductType(current, product);
      if (productTypeValidation?.suggested && !productTypeValidation.shouldEnrich) {
        return { value: productTypeValidation.suggested, cost: 0, cached: false, source: 'product_type_validation' };
      }

      const deduced = deduceProductType(product);
      if (deduced) {
        return { value: deduced, cost: 0, cached: false, source: 'product_type_deduction' };
      }

      const aiValue = await enrichFieldWithAI(prisma, product, 'product_type');
      const normalized = validateOrMapProductType(aiValue, product);
      return {
        value: normalized?.suggested || null,
        cost: 0,
        cached: false,
        source: 'ai_enrichment',
      };
    }
    case 'brand': {
      const deducedBrand = deduceBrand(product);
      if (deducedBrand) {
        return { value: deducedBrand, cost: 0, cached: false, source: 'brand_deduction' };
      }
      const aiValue = await enrichFieldWithAI(prisma, product, 'brand');
      return { value: aiValue || null, cost: 0, cached: false, source: 'ai_enrichment' };
    }
    case 'material':
    case 'pattern': {
      const aiValue = await enrichFieldWithAI(prisma, product, field);
      return { value: aiValue || null, cost: 0, cached: false, source: 'ai_enrichment' };
    }
    default: {
      const aiValue = await enrichFieldWithAI(prisma, product, field);
      return { value: aiValue || null, cost: 0, cached: false, source: 'ai_enrichment' };
    }
  }
}

async function executeAiFillTask(prisma, task, options = {}) {
  const actionJson = task.actionJson || {};
  const field = normalizeField(actionJson.params?.field);
  if (!field) {
    return { applied: false, skipped: true, reason: 'missing_field', cost: 0 };
  }

  const currentValue = getFieldValue(task.item, field);
  if (hasValue(currentValue)) {
    return { applied: false, skipped: true, reason: 'field_not_empty', cost: 0 };
  }

  const result = await generateAiValue(prisma, task.item, field, {
    ...options,
    channelId: task.channelId,
  });

  if (!hasValue(result.value)) {
    return { applied: false, skipped: true, reason: 'no_value_generated', cost: result.cost || 0, source: result.source };
  }

  setFieldValue(task.item, field, result.value);
  task.item._aiFilled = task.item._aiFilled || [];
  task.item._aiFilled.push({ field, source: result.source });
  return {
    applied: true,
    skipped: false,
    value: result.value,
    cost: result.cost || 0,
    cached: result.cached || false,
    source: result.source,
  };
}

async function executeAiFillTasks(prisma, tasks, options = {}) {
  let applied = 0;
  let skipped = 0;
  let failed = 0;
  let totalCost = 0;

  for (const task of tasks) {
    try {
      const result = await executeAiFillTask(prisma, task, options);
      totalCost += result.cost || 0;
      if (result.applied) applied++;
      else skipped++;
    } catch (error) {
      failed++;
      totalCost += 0;
    }
  }

  return { applied, skipped, failed, totalCost };
}

module.exports = {
  executeAiFillTask,
  executeAiFillTasks,
  normalizePlatform,
};

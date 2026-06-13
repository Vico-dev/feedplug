/**
 * Routes API pour le module Optimiser (règles IF-THEN).
 * Monté sous /api/v1/rules - requiert requireAuth (req.accountId).
 */

const { validateRule } = require('./schemas');
const { applyRules, getActiveRules, batchUpdateFeedItems } = require('./engine');
const { executeAiFillTasks } = require('./ai-fill');
const { createRevision, buildItemSnapshot } = require('../lib/revisions');
const { splitScopeIds, mergeScopeIds } = require('./scope');

function registerRulesRoutes(app, prisma, getPrismaReady) {
  if (!app || !prisma) return;

  async function buildRulePreview({ rule, accountId, limit = 5, feedId, channelId, destinationId }) {
    const previewLimit = Math.min(Number(limit) || 5, 20);
    const feedFilter = feedId ? `AND i.feedid = $3::text` : '';
    const params = feedId ? [accountId, previewLimit, feedId] : [accountId, previewLimit];
    const items = await prisma.$queryRawUnsafe(`
      SELECT i.*, f.id as feedid
      FROM "FeedItem" i
      JOIN "Feed" f ON i.feedid = f.id
      WHERE f.accountid = $1::text ${feedFilter}
      LIMIT $2::int
    `, ...params);

    if (!items || items.length === 0) {
      return { preview: [], affectedCount: 0, message: 'Aucun item trouvé' };
    }

    const { evaluateCondition, applyAction, getFieldValue } = require('./engine');
    const conditionJson = typeof rule.conditionjson === 'string' ? JSON.parse(rule.conditionjson || '{}') : (rule.conditionjson || rule.conditionJson || {});
    const actionJson = typeof rule.actionjson === 'string' ? JSON.parse(rule.actionjson || '{}') : (rule.actionjson || rule.actionJson || {});
    const actionField = actionJson?.params?.field || null;
    const storedScopeIds = rule.channelids || mergeScopeIds(rule.channelIds || [], rule.destinationIds || []);
    const { channelIds, destinationIds } = splitScopeIds(storedScopeIds);
    const channelScopeOk = channelIds.length === 0 || (channelId && channelIds.includes(channelId));
    const destinationScopeOk = destinationIds.length === 0 || (destinationId && destinationIds.includes(destinationId));
    const preview = [];
    let affectedCount = 0;

    if (!channelScopeOk || !destinationScopeOk) {
      return {
        preview: items.map((item) => ({
          itemId: item.id,
          originId: item.originid,
          title: item.title,
          matches: false,
          before: null,
          after: null,
        })),
        affectedCount: 0,
        message: destinationIds.length > 0
          ? 'Cette règle est rattachée à une destination précise. Sélectionnez la bonne destination pour la prévisualiser.'
          : 'Cette règle est limitée à un autre canal.',
      };
    }

    for (const it of items) {
      const customfields = typeof it.customfields === 'string' ? JSON.parse(it.customfields || '{}') : (it.customfields || {});
      const item = { ...it, customfields };
      const matches = evaluateCondition(conditionJson, item);

      if (!matches) {
        preview.push({
          itemId: item.id,
          originId: item.originid,
          title: item.title,
          matches: false,
          before: null,
          after: null
        });
        continue;
      }

      affectedCount++;
      const before = JSON.parse(JSON.stringify(item));
      applyAction(actionJson, item);

      let beforeValue = actionField ? getFieldValue(before, actionField) : before.title;
      let afterValue = actionField ? getFieldValue(item, actionField) : item.title;

      if (actionJson?.type === 'ai_fill') {
        afterValue = afterValue || '[IA] Valeur suggérée à l’exécution';
      }

      preview.push({
        itemId: item.id,
        originId: item.originid,
        title: item.title,
        matches: true,
        before: {
          field: actionField,
          value: beforeValue ?? null,
          title: before.title ?? null
        },
        after: {
          field: actionField,
          value: afterValue ?? null,
          title: item.title ?? null
        }
      });
    }

    return { preview, affectedCount };
  }

  // POST /api/v1/rules/apply - DOIT être avant /:id pour éviter que "apply" soit capturé comme id
  app.post('/api/v1/rules/apply', async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Base de données non disponible' });
      }
      const accountId = req.accountId;
      const { feedIds = [], channelIds = [], destinationIds = [], itemIds, channelId, destinationId } = req.body || {};
      const rules = await prisma.$queryRawUnsafe(`
        SELECT id, name, conditionjson, actionjson, feedids, channelids, priority, isactive, startdate, enddate
        FROM "Rule"
        WHERE accountid = $1::text AND isactive = true
        ORDER BY priority ASC
      `, accountId);
      const activeRules = getActiveRules(rules);
      let items;
      if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
        const placeholders = itemIds.map((_, i) => `$${i + 2}`).join(', ');
        items = await prisma.$queryRawUnsafe(`
          SELECT i.*, f.id as feedid
          FROM "FeedItem" i
          JOIN "Feed" f ON i.feedid = f.id
          WHERE i.id IN (${placeholders}) AND f.accountid = $1::text
        `, accountId, ...itemIds);
      } else {
        const feedFilter = Array.isArray(feedIds) && feedIds.length > 0
          ? `AND f.id IN (${feedIds.map((_, i) => `$${i + 3}`).join(', ')})`
          : '';
        const params = [accountId, 2000];
        if (Array.isArray(feedIds) && feedIds.length > 0) params.push(...feedIds);
        items = await prisma.$queryRawUnsafe(`
          SELECT i.*, f.id as feedid
          FROM "FeedItem" i
          JOIN "Feed" f ON i.feedid = f.id
          WHERE f.accountid = $1::text ${feedFilter}
          LIMIT $2::int
        `, ...params);
      }
      if (!items || items.length === 0) {
        return res.json({ message: 'Aucun item à traiter', applied: 0, excluded: 0 });
      }
      const targetChannelId = channelId || (Array.isArray(channelIds) && channelIds[0]) || null;
      const targetDestinationId = destinationId || (Array.isArray(destinationIds) && destinationIds[0]) || null;
      const itemsToProcess = items.map(it => {
        const customfields = typeof it.customfields === 'string' ? JSON.parse(it.customfields || '{}') : (it.customfields || {});
        return { ...it, customfields };
      });
      const aiFillTasks = [];
      const { applied, excluded, aiQueued } = applyRules(itemsToProcess, activeRules, null, targetChannelId, {
        aiFillTasks,
        destinationId: targetDestinationId,
      });
      const aiResult = aiFillTasks.length > 0
        ? await executeAiFillTasks(prisma, aiFillTasks, { channelId: targetChannelId })
        : { applied: 0, skipped: 0, failed: 0, totalCost: 0 };
      const now = new Date().toISOString();
      const toUpdate = itemsToProcess.filter(it => !it._excluded);
      await batchUpdateFeedItems(prisma, toUpdate, now);
      for (const item of toUpdate) {
        try {
          const cf = item.customfields || {};
          const snap = buildItemSnapshot({ ...item, customFields: cf });
          await createRevision(prisma, item.id, snap, 'rule');
        } catch (revErr) {
          console.warn('Révision rule non créée:', revErr.message);
        }
      }
      res.json({
        message: 'Règles appliquées',
        applied: applied + aiResult.applied,
        excluded,
        itemsProcessed: itemsToProcess.length,
        aiQueued,
        aiApplied: aiResult.applied,
        aiSkipped: aiResult.skipped,
        aiFailed: aiResult.failed,
        aiCost: aiResult.totalCost
      });
    } catch (e) {
      console.error('POST /rules/apply error:', e);
      res.status(500).json({ message: 'Erreur application règles', error: e.message });
    }
  });

  // GET /api/v1/rules - Liste des règles du compte
  app.get('/api/v1/rules', async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Base de données non disponible' });
      }
      const accountId = req.accountId;
      const { feedId, channelId, isActive } = req.query || {};
      const rules = await prisma.$queryRawUnsafe(`
        SELECT id, name, conditionjson, actionjson, feedids, channelids,
               startdate, enddate, runoningestion, priority, isactive, createdat, updatedat
        FROM "Rule"
        WHERE accountid = $1::text
        ORDER BY priority ASC, createdat DESC
      `, accountId);

      let filtered = (rules || []).map(r => ({
        id: r.id,
        name: r.name,
        conditionJson: r.conditionjson,
        actionJson: r.actionjson,
        feedIds: r.feedids || [],
        channelIds: splitScopeIds(r.channelids || []).channelIds,
        destinationIds: splitScopeIds(r.channelids || []).destinationIds,
        startDate: r.startdate,
        endDate: r.enddate,
        runOnIngestion: r.runoningestion,
        priority: r.priority ?? 0,
        isActive: r.isactive !== false,
        createdAt: r.createdat,
        updatedAt: r.updatedat
      }));

      if (feedId) {
        filtered = filtered.filter(r => r.feedIds.length === 0 || r.feedIds.includes(feedId));
      }
      if (channelId) {
        filtered = filtered.filter(r => r.channelIds.length === 0 || r.channelIds.includes(channelId));
      }
      if (req.query.destinationId) {
        const requestedDestinationId = String(req.query.destinationId);
        filtered = filtered.filter(r => (r.destinationIds || []).length === 0 || (r.destinationIds || []).includes(requestedDestinationId));
      }
      if (isActive !== undefined) {
        const active = isActive === 'true' || isActive === true;
        filtered = filtered.filter(r => r.isActive === active);
      }

      const ruleIds = filtered.map(r => r.id);
      let abTestsByRule = {};
      if (ruleIds.length > 0) {
        const abTests = await prisma.aBTest.findMany({
          where: { ruleId: { in: ruleIds } },
          select: { id: true, ruleId: true, status: true, name: true }
        });
        abTests.forEach(t => {
          if (t.ruleId) abTestsByRule[t.ruleId] = { id: t.id, status: t.status, name: t.name };
        });
      }
      const rulesWithAb = filtered.map(r => ({
        ...r,
        abTest: abTestsByRule[r.id] || null
      }));

      res.json({ rules: rulesWithAb });
    } catch (e) {
      console.error('GET /rules error:', e);
      const msg = (e && e.message) ? String(e.message) : '';
      // Table Rule absente, colonne manquante, erreur schéma → tableau vide (dégradation gracieuse)
      const isTableOrSchemaError = /does not exist|relation.*Rule|column|syntax|permission denied/i.test(msg);
      if (isTableOrSchemaError) {
        return res.json({ rules: [] });
      }
      res.status(500).json({ message: 'Erreur liste règles', error: msg });
    }
  });

  // POST /api/v1/rules - Créer une règle
  app.post('/api/v1/rules', async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Base de données non disponible' });
      }
      const accountId = req.accountId;
      const body = req.body || {};
      const validation = validateRule(body);
      if (!validation.valid) {
        return res.status(400).json({ message: 'Validation échouée', errors: validation.errors });
      }
      const crypto = require('crypto');
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const feedIds = JSON.stringify(body.feedIds || []);
      const channelIds = JSON.stringify(mergeScopeIds(body.channelIds || [], body.destinationIds || []));
      const conditionJson = JSON.stringify(body.conditionJson || {});
      const actionJson = JSON.stringify(body.actionJson || {});
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Rule" (id, accountid, name, conditionjson, actionjson, feedids, channelids,
          startdate, enddate, runoningestion, priority, isactive, createdat, updatedat)
        VALUES ($1::text, $2::text, $3::text, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb,
          $8::timestamptz, $9::timestamptz, $10::boolean, $11::int, true, $12::timestamptz, $12::timestamptz)
      `, id, accountId, body.name.trim(), conditionJson, actionJson, feedIds, channelIds,
        body.startDate || null, body.endDate || null, body.runOnIngestion !== false, body.priority ?? 0,
        now);
      const [created] = await prisma.$queryRawUnsafe(`SELECT * FROM "Rule" WHERE id = $1::text`, id);
      res.status(201).json({
        id: created.id,
        name: created.name,
        conditionJson: created.conditionjson,
        actionJson: created.actionjson,
        feedIds: created.feedids || [],
        channelIds: splitScopeIds(created.channelids || []).channelIds,
        destinationIds: splitScopeIds(created.channelids || []).destinationIds,
        startDate: created.startdate,
        endDate: created.enddate,
        runOnIngestion: created.runoningestion,
        priority: created.priority,
        isActive: created.isactive,
        createdAt: created.createdat,
        updatedAt: created.updatedat
      });
    } catch (e) {
      console.error('POST /rules error:', e);
      res.status(500).json({ message: 'Erreur création règle', error: e.message });
    }
  });

  // POST /api/v1/rules/preview - Prévisualiser une règle brouillon sans l'enregistrer
  app.post('/api/v1/rules/preview', async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Base de données non disponible' });
      }
      const accountId = req.accountId;
      const { draftRule, limit = 5, feedId, channelId, destinationId } = req.body || {};
      if (!draftRule || typeof draftRule !== 'object') {
        return res.status(400).json({ message: 'draftRule requis' });
      }

      const validation = validateRule({
        ...draftRule,
        name: draftRule.name || 'Prévisualisation'
      });
      if (!validation.valid) {
        return res.status(400).json({ message: 'Validation échouée', errors: validation.errors });
      }

      const previewResult = await buildRulePreview({
        rule: draftRule,
        accountId,
        limit,
        feedId,
        channelId,
        destinationId: destinationId || (Array.isArray(draftRule.destinationIds) ? draftRule.destinationIds[0] : null),
      });

      res.json({
        ruleName: draftRule.name || 'Prévisualisation',
        affectedCount: previewResult.affectedCount,
        preview: previewResult.preview,
        message: previewResult.message || null
      });
    } catch (e) {
      console.error('POST /rules/preview error:', e);
      res.status(500).json({ message: 'Erreur prévisualisation', error: e.message });
    }
  });

  // GET /api/v1/rules/:id
  app.get('/api/v1/rules/:id', async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Base de données non disponible' });
      }
      const accountId = req.accountId;
      const { id } = req.params;
      const [rule] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "Rule" WHERE id = $1::text AND accountid = $2::text
      `, id, accountId);
      if (!rule) return res.status(404).json({ message: 'Règle non trouvée' });
      res.json({
        id: rule.id,
        name: rule.name,
        conditionJson: rule.conditionjson,
        actionJson: rule.actionjson,
        feedIds: rule.feedids || [],
        channelIds: splitScopeIds(rule.channelids || []).channelIds,
        destinationIds: splitScopeIds(rule.channelids || []).destinationIds,
        startDate: rule.startdate,
        endDate: rule.enddate,
        runOnIngestion: rule.runoningestion,
        priority: rule.priority,
        isActive: rule.isactive,
        createdAt: rule.createdat,
        updatedAt: rule.updatedat
      });
    } catch (e) {
      console.error('GET /rules/:id error:', e);
      res.status(500).json({ message: 'Erreur', error: e.message });
    }
  });

  // PATCH /api/v1/rules/:id
  app.patch('/api/v1/rules/:id', async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Base de données non disponible' });
      }
      const accountId = req.accountId;
      const { id } = req.params;
      const body = req.body || {};
      const [existing] = await prisma.$queryRawUnsafe(`
        SELECT id FROM "Rule" WHERE id = $1::text AND accountid = $2::text
      `, id, accountId);
      if (!existing) return res.status(404).json({ message: 'Règle non trouvée' });
      if (body.conditionJson || body.actionJson) {
        const toValidate = { ...existing, ...body };
        const validation = validateRule(toValidate);
        if (!validation.valid) {
          return res.status(400).json({ message: 'Validation échouée', errors: validation.errors });
        }
      }
      const updates = [];
      const params = [];
      let idx = 1;
      if (body.name !== undefined) { updates.push(`name = $${idx++}`); params.push(body.name.trim()); }
      if (body.conditionJson !== undefined) { updates.push(`conditionjson = $${idx++}::jsonb`); params.push(JSON.stringify(body.conditionJson)); }
      if (body.actionJson !== undefined) { updates.push(`actionjson = $${idx++}::jsonb`); params.push(JSON.stringify(body.actionJson)); }
      if (body.feedIds !== undefined) { updates.push(`feedids = $${idx++}::jsonb`); params.push(JSON.stringify(body.feedIds)); }
      if (body.channelIds !== undefined || body.destinationIds !== undefined) {
        const existingScope = await prisma.$queryRawUnsafe(`SELECT channelids FROM "Rule" WHERE id = $1::text LIMIT 1`, id);
        const existingScopeIds = splitScopeIds(existingScope?.[0]?.channelids || []);
        const nextChannelIds = body.channelIds !== undefined ? body.channelIds : existingScopeIds.channelIds;
        const nextDestinationIds = body.destinationIds !== undefined ? body.destinationIds : existingScopeIds.destinationIds;
        updates.push(`channelids = $${idx++}::jsonb`);
        params.push(JSON.stringify(mergeScopeIds(nextChannelIds, nextDestinationIds)));
      }
      if (body.startDate !== undefined) { updates.push(`startdate = $${idx++}::timestamptz`); params.push(body.startDate || null); }
      if (body.endDate !== undefined) { updates.push(`enddate = $${idx++}::timestamptz`); params.push(body.endDate || null); }
      if (body.runOnIngestion !== undefined) { updates.push(`runoningestion = $${idx++}::boolean`); params.push(body.runOnIngestion); }
      if (body.priority !== undefined) { updates.push(`priority = $${idx++}::int`); params.push(body.priority); }
      if (body.isActive !== undefined) { updates.push(`isactive = $${idx++}::boolean`); params.push(body.isActive); }
      if (updates.length === 0) {
        const [r] = await prisma.$queryRawUnsafe(`SELECT * FROM "Rule" WHERE id = $1::text`, id);
        return res.json({
          id: r.id,
          name: r.name,
          conditionJson: r.conditionjson,
          actionJson: r.actionjson,
          feedIds: r.feedids || [],
          channelIds: splitScopeIds(r.channelids || []).channelIds,
          destinationIds: splitScopeIds(r.channelids || []).destinationIds,
          startDate: r.startdate,
          endDate: r.enddate,
          runOnIngestion: r.runoningestion,
          priority: r.priority,
          isActive: r.isactive,
          createdAt: r.createdat,
          updatedAt: r.updatedat,
        });
      }
      updates.push(`updatedat = NOW()`);
      params.push(id);
      await prisma.$executeRawUnsafe(
        `UPDATE "Rule" SET ${updates.join(', ')} WHERE id = $${idx}::text`,
        ...params
      );
      const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM "Rule" WHERE id = $1::text`, id);
      res.json({
        id: updated.id,
        name: updated.name,
        conditionJson: updated.conditionjson,
        actionJson: updated.actionjson,
        feedIds: updated.feedids || [],
        channelIds: splitScopeIds(updated.channelids || []).channelIds,
        destinationIds: splitScopeIds(updated.channelids || []).destinationIds,
        startDate: updated.startdate,
        endDate: updated.enddate,
        runOnIngestion: updated.runoningestion,
        priority: updated.priority,
        isActive: updated.isactive,
        createdAt: updated.createdat,
        updatedAt: updated.updatedat,
      });
    } catch (e) {
      console.error('PATCH /rules/:id error:', e);
      res.status(500).json({ message: 'Erreur mise à jour', error: e.message });
    }
  });

  // DELETE /api/v1/rules/:id
  app.delete('/api/v1/rules/:id', async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Base de données non disponible' });
      }
      const accountId = req.accountId;
      const { id } = req.params;
      const result = await prisma.$executeRawUnsafe(`
        DELETE FROM "Rule" WHERE id = $1::text AND accountid = $2::text
      `, id, accountId);
      if (result === 0) return res.status(404).json({ message: 'Règle non trouvée' });
      res.json({ message: 'Règle supprimée', id });
    } catch (e) {
      console.error('DELETE /rules/:id error:', e);
      res.status(500).json({ message: 'Erreur suppression', error: e.message });
    }
  });

  // POST /api/v1/rules/:id/preview - Simuler sur N items (avant GET :id pour éviter conflits)
  app.post('/api/v1/rules/:id/preview', async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Base de données non disponible' });
      }
      const accountId = req.accountId;
      const { id } = req.params;
      const { limit = 5, feedId, channelId, destinationId } = req.body || {};
      const [rule] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "Rule" WHERE id = $1::text AND accountid = $2::text
      `, id, accountId);
      if (!rule) return res.status(404).json({ message: 'Règle non trouvée' });
      const previewResult = await buildRulePreview({
        rule,
        accountId,
        limit,
        feedId,
        channelId,
        destinationId: destinationId || splitScopeIds(rule.channelids || []).destinationIds[0] || null,
      });
      res.json({ ruleId: id, ruleName: rule.name, preview: previewResult.preview, affectedCount: previewResult.affectedCount, message: previewResult.message || null });
    } catch (e) {
      console.error('POST /rules/:id/preview error:', e);
      res.status(500).json({ message: 'Erreur prévisualisation', error: e.message });
    }
  });
}

module.exports = { registerRulesRoutes };

/**
 * Routes API pour les tests A/B (témoin + variant).
 * Spécification : backend-marketing/docs/AB_TEST_TITRES_SPEC.md
 */

const { ABTestStatus, ABTestArm } = require('@prisma/client');

const MIN_PRODUCTS_PER_ARM = 100;
const DEFAULT_MIN_DURATION_DAYS = 14;

/**
 * Applique les transformations utilisateur à un texte (titre ou description).
 * Miroir backend de applyTransformations du frontend (optimiser/page.tsx) :
 * permet de calculer la vraie variante côté serveur depuis le contenu réel,
 * sans dépendre d'un placeholder envoyé par le client (cf. B6).
 */
function applyAbTransformations(text, transformations) {
  let result = String(text || '');
  for (const t of (Array.isArray(transformations) ? transformations : [])) {
    switch (t?.type) {
      case 'replace':
        if (t.searchValue) result = result.split(t.searchValue).join(t.replaceValue || '');
        break;
      case 'prepend':
        if (t.replaceValue) result = t.replaceValue + result;
        break;
      case 'append':
        if (t.replaceValue) result = result + ' ' + t.replaceValue;
        break;
      case 'remove':
        if (t.searchValue) result = result.split(t.searchValue).join('');
        break;
      default:
        break;
    }
  }
  return result;
}

function registerAbTestRoutes(app, deps) {
  const { prisma, authenticateToken, getAccountId } = deps;
  const accountId = (req) => getAccountId ? getAccountId(req) : req.accountId;

  // Liste des tests A/B du compte
  app.get('/api/v1/ab-tests', authenticateToken, async (req, res) => {
    try {
      const acct = accountId(req);
      const status = req.query.status; // optional filter
      const tests = await prisma.aBTest.findMany({
        where: { accountId: acct, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { assignments: true } },
          assignments: { select: { arm: true } }
        }
      });
      const withCounts = tests.map(t => {
        const controlCount = t.assignments.filter(a => a.arm === 'CONTROL').length;
        const variantCount = t.assignments.filter(a => a.arm === 'VARIANT').length;
        const { assignments, _count, ...rest } = t;
        return {
          ...rest,
          assignmentCount: _count.assignments,
          controlCount,
          variantCount
        };
      });
      res.json(withCounts);
    } catch (e) {
      console.error('ab-tests list:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // Détail d'un test + effectifs par bras
  app.get('/api/v1/ab-tests/:id', authenticateToken, async (req, res) => {
    try {
      const acct = accountId(req);
      const test = await prisma.aBTest.findFirst({
        where: { id: req.params.id, accountId: acct },
        include: {
          assignments: true
        }
      });
      if (!test) return res.status(404).json({ message: 'Test non trouvé' });
      const controlCount = test.assignments.filter(a => a.arm === 'CONTROL').length;
      const variantCount = test.assignments.filter(a => a.arm === 'VARIANT').length;
      res.json({
        ...test,
        controlCount,
        variantCount
      });
    } catch (e) {
      console.error('ab-tests get:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // Créer un brouillon de test (avec affectations control/variant)
  // Body (IA): { name, feedId?, platform, fieldUnderTest?, minDurationDays?, controlPercent?, variantPercent?, itemIds: string[], variantTitles? }
  // Body (règle): { ruleId, name?, platform, minDurationDays?, controlPercent?, variantPercent? } → items déduits de la règle (portée + condition)
  app.post('/api/v1/ab-tests', authenticateToken, async (req, res) => {
    try {
      const acct = accountId(req);
      const {
        name,
        feedId,
        platform,
        fieldUnderTest = 'title',
        minDurationDays = DEFAULT_MIN_DURATION_DAYS,
        controlPercent = 50,
        variantPercent = 50,
        itemIds: bodyItemIds,
        variantTitles,
        customTransformations,
        ruleId
      } = req.body;

      let itemIds = bodyItemIds;
      let testName = name;
      let testFeedId = feedId || null;
      let testRuleId = ruleId || null;

      if (ruleId) {
        // Création depuis une règle : récupérer les items qui matchent la règle
        const { evaluateCondition } = require('../rules/engine');
        const [rule] = await prisma.$queryRawUnsafe(`
          SELECT id, name, conditionjson, feedids, channelids FROM "Rule"
          WHERE id = $1::text AND accountid = $2::text
        `, ruleId, acct);
        if (!rule) return res.status(404).json({ message: 'Règle non trouvée' });
        const feedIds = rule.feedids && (Array.isArray(rule.feedids) ? rule.feedids : []) || [];
        const feedFilter = feedIds.length > 0
          ? `AND i.feedid IN (${feedIds.map((_, i) => `$${i + 3}`).join(', ')})`
          : '';
        const params = [acct, 10000];
        if (feedIds.length > 0) params.push(...feedIds);
        const items = await prisma.$queryRawUnsafe(`
          SELECT i.id, i.feedid, i.title, i.brand, i.price, i.sku, i.customfields
          FROM "FeedItem" i
          JOIN "Feed" f ON i.feedid = f.id
          WHERE f.accountid = $1::text ${feedFilter}
          LIMIT $2::int
        `, ...params);
        const conditionJson = typeof rule.conditionjson === 'string' ? JSON.parse(rule.conditionjson || '{}') : (rule.conditionjson || {});
        const matching = (items || []).filter(it => {
          const cf = typeof it.customfields === 'string' ? JSON.parse(it.customfields || '{}') : (it.customfields || {});
          return evaluateCondition(conditionJson, { ...it, customfields: cf });
        });
        itemIds = matching.map(i => i.id);
        if (itemIds.length === 0) return res.status(400).json({ message: 'Aucun produit ne correspond à la règle. Élargissez la portée ou les conditions.' });
        testName = testName || (rule.name + ' – A/B');
        testFeedId = feedIds.length === 1 ? feedIds[0] : null;
      }

      if (!platform || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ message: 'platform et itemIds (ou ruleId) requis avec au moins un produit' });
      }
      if (!testName) testName = 'Test A/B';

      const total = itemIds.length;
      const controlCount = Math.floor(total * (controlPercent / 100));
      const variantCount = total - controlCount;
      const prerequisitesMet = controlCount >= MIN_PRODUCTS_PER_ARM && variantCount >= MIN_PRODUCTS_PER_ARM;

      const shuffled = [...itemIds].sort((a, b) => {
        const h = (s) => s.split('').reduce((acc, c) => ((acc * 31) + c.charCodeAt(0)) | 0, 0);
        return (h(a + testName) - h(b + testName));
      });
      const controlIds = shuffled.slice(0, controlCount);
      const variantIds = shuffled.slice(controlCount, total);

      // B6 — calcul des vraies variantes côté serveur depuis le contenu réel des
      // produits (titre/description), via les transformations utilisateur. Évite
      // le placeholder envoyé par le client. Fallback sur variantTitles (legacy).
      const transforms = Array.isArray(customTransformations)
        ? customTransformations.filter((t) => (t?.field || 'title') === fieldUnderTest)
        : [];
      const variantValueByItem = {};
      if (transforms.length > 0 && variantIds.length > 0) {
        const sourceCol = fieldUnderTest === 'description' ? 'descriptiontext' : 'title';
        const titleRows = await prisma.$queryRawUnsafe(
          `SELECT i.id, i.${sourceCol} AS src
           FROM "FeedItem" i
           JOIN "Feed" f ON i.feedid = f.id
           WHERE f.accountid = $1::text AND i.id = ANY($2::text[])`,
          acct, variantIds
        );
        for (const r of (titleRows || [])) {
          variantValueByItem[r.id] = applyAbTransformations(r.src, transforms);
        }
      }
      const resolveVariantValue = (itemId) => {
        if (variantValueByItem[itemId] != null) return String(variantValueByItem[itemId]);
        if (variantTitles && variantTitles[itemId]) return String(variantTitles[itemId]);
        return null;
      };

      const test = await prisma.aBTest.create({
        data: {
          accountId: acct,
          ruleId: testRuleId,
          name: testName,
          feedId: testFeedId,
          platform: String(platform).toUpperCase(),
          fieldUnderTest: testRuleId ? 'rule' : fieldUnderTest,
          status: ABTestStatus.DRAFT,
          minDurationDays: minDurationDays || DEFAULT_MIN_DURATION_DAYS,
          controlPercent,
          variantPercent,
          prerequisitesMet
        }
      });

      const assignments = [
        ...controlIds.map(itemId => ({ testId: test.id, itemId, arm: ABTestArm.CONTROL, variantValue: null })),
        ...variantIds.map(itemId => ({
          testId: test.id,
          itemId,
          arm: ABTestArm.VARIANT,
          variantValue: resolveVariantValue(itemId)
        }))
      ];
      await prisma.aBTestAssignment.createMany({ data: assignments });

      const created = await prisma.aBTest.findUnique({
        where: { id: test.id },
        include: { _count: { select: { assignments: true } } }
      });
      res.status(201).json({
        ...created,
        controlCount,
        variantCount,
        assignmentCount: created._count.assignments,
        variantItemIds: variantIds
      });
    } catch (e) {
      console.error('ab-tests create:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // Démarrer un test (draft → running)
  app.post('/api/v1/ab-tests/:id/start', authenticateToken, async (req, res) => {
    try {
      const acct = accountId(req);
      const test = await prisma.aBTest.findFirst({
        where: { id: req.params.id, accountId: acct }
      });
      if (!test) return res.status(404).json({ message: 'Test non trouvé' });
      if (test.status !== ABTestStatus.DRAFT) {
        return res.status(400).json({ message: 'Seul un test en brouillon peut être démarré' });
      }
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + (test.minDurationDays || DEFAULT_MIN_DURATION_DAYS));
      await prisma.aBTest.update({
        where: { id: test.id },
        data: { status: ABTestStatus.RUNNING, startDate: now, endDate }
      });
      const updated = await prisma.aBTest.findUnique({ where: { id: test.id } });
      res.json(updated);
    } catch (e) {
      console.error('ab-tests start:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // Arrêter un test (running → completed)
  app.post('/api/v1/ab-tests/:id/stop', authenticateToken, async (req, res) => {
    try {
      const acct = accountId(req);
      const test = await prisma.aBTest.findFirst({
        where: { id: req.params.id, accountId: acct }
      });
      if (!test) return res.status(404).json({ message: 'Test non trouvé' });
      if (test.status !== ABTestStatus.RUNNING) {
        return res.status(400).json({ message: 'Seul un test en cours peut être arrêté' });
      }
      const now = new Date();
      await prisma.aBTest.update({
        where: { id: test.id },
        data: { status: ABTestStatus.COMPLETED, endDate: now }
      });
      const updated = await prisma.aBTest.findUnique({ where: { id: test.id } });
      res.json(updated);
    } catch (e) {
      console.error('ab-tests stop:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // Résultats (résumé + recommandation) — placeholder si pas de métriques
  app.get('/api/v1/ab-tests/:id/results', authenticateToken, async (req, res) => {
    try {
      const acct = accountId(req);
      const test = await prisma.aBTest.findFirst({
        where: { id: req.params.id, accountId: acct },
        include: { assignments: true }
      });
      if (!test) return res.status(404).json({ message: 'Test non trouvé' });
      const controlCount = test.assignments.filter(a => a.arm === 'CONTROL').length;
      const variantCount = test.assignments.filter(a => a.arm === 'VARIANT').length;
      const resultSummary = test.resultSummary && typeof test.resultSummary === 'object'
        ? test.resultSummary
        : null;
      res.json({
        test: {
          id: test.id,
          name: test.name,
          status: test.status,
          startDate: test.startDate,
          endDate: test.endDate,
          platform: test.platform,
          prerequisitesMet: test.prerequisitesMet
        },
        controlCount,
        variantCount,
        resultSummary,
        recommendation: resultSummary?.recommendation || 'Collecte des métriques en cours. Connectez GMC/Amazon pour voir les performances par bras.'
      });
    } catch (e) {
      console.error('ab-tests results:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // Mettre à jour les valeurs variant (titres, descriptions ou images IA)
  app.patch('/api/v1/ab-tests/:id/variant-values', authenticateToken, async (req, res) => {
    try {
      const acct = accountId(req);
      const test = await prisma.aBTest.findFirst({
        where: { id: req.params.id, accountId: acct }
      });
      if (!test) return res.status(404).json({ message: 'Test non trouvé' });
      if (test.status !== ABTestStatus.DRAFT) {
        return res.status(400).json({ message: 'Seuls les brouillons acceptent la mise à jour des variantes' });
      }
      const { variantTitles, variantDescriptions, variantImages } = req.body;
      const map = variantTitles || variantDescriptions || variantImages;
      if (!map || typeof map !== 'object') {
        return res.status(400).json({ message: 'variantTitles, variantDescriptions ou variantImages (object itemId -> string) requis' });
      }
      for (const [itemId, value] of Object.entries(map)) {
        if (value == null) continue;
        await prisma.aBTestAssignment.updateMany({
          where: { testId: test.id, itemId, arm: ABTestArm.VARIANT },
          data: { variantValue: String(value) }
        });
      }
      const updated = await prisma.aBTest.findUnique({
        where: { id: test.id },
        include: { assignments: true }
      });
      res.json(updated);
    } catch (e) {
      console.error('ab-tests variant-values:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // Prérequis pour un pool d'items (effectifs, durée min)
  app.post('/api/v1/ab-tests/preconditions', authenticateToken, async (req, res) => {
    try {
      const { itemIds, controlPercent = 50, variantPercent = 50, minDurationDays = DEFAULT_MIN_DURATION_DAYS } = req.body;
      if (!itemIds || !Array.isArray(itemIds)) {
        return res.status(400).json({ message: 'itemIds (array) requis' });
      }
      const total = itemIds.length;
      const controlCount = Math.floor(total * (controlPercent / 100));
      const variantCount = total - controlCount;
      const prerequisitesMet = controlCount >= MIN_PRODUCTS_PER_ARM && variantCount >= MIN_PRODUCTS_PER_ARM;
      res.json({
        total,
        controlCount,
        variantCount,
        minProductsPerArm: MIN_PRODUCTS_PER_ARM,
        minDurationDays,
        prerequisitesMet,
        message: prerequisitesMet
          ? `Effectifs suffisants (${controlCount} témoin, ${variantCount} variant). Durée minimale recommandée : ${minDurationDays} jours.`
          : `Pour un résultat significatif, visez au moins ${MIN_PRODUCTS_PER_ARM} produits par bras (actuellement ${controlCount} témoin, ${variantCount} variant).`
      });
    } catch (e) {
      console.error('ab-tests preconditions:', e);
      res.status(500).json({ message: e.message });
    }
  });
}

module.exports = { registerAbTestRoutes, applyAbTransformations };

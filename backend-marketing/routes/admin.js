/**
 * Routes du domaine "admin" (4 routes /api/v1/admin/* réservées staff FeedPlug) :
 * liste des comptes, mise à jour d'un compte, et 2 endpoints historiques de
 * migration runtime désactivés (réponse 410).
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handlers copiés À L'IDENTIQUE. Seul ajout en
 * tête des handlers utilisant Prisma :
 * `const prisma = getPrisma(); const prismaReady = getPrismaReady();`. Les middlewares
 * (authenticateToken, requireStaffAccess) restent définis dans server-minimal.js et
 * sont injectés via `deps`. AUCUN changement de comportement.
 *
 * NB : /api/v1/admin/performance/purge reste dans server-minimal.js avec le domaine
 * performance (voir routes/performance.js).
 */
function registerAdminRoutes(app, {
  getPrisma,
  getPrismaReady,
  authenticateToken,
  requireStaffAccess,
}) {
app.get('/api/v1/admin/accounts', authenticateToken, requireStaffAccess, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Base de données non disponible' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').toString().trim();

    let whereClause = '';
    const params = [];
    let paramIdx = 1;
    if (search) {
      whereClause = `WHERE a.name ILIKE $${paramIdx}::text OR a.email ILIKE $${paramIdx}::text`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    let accountsResult;
    let hasAddonIAColumn = false;
    try {
      const withAddonia = await prisma.$queryRawUnsafe(`
        SELECT 
          a.id, a.name, a.plan, a.email, a.trialendsat, a.addonia, a.createdat, a.updatedat,
          (SELECT COUNT(*)::int FROM "User" u WHERE u.accountid = a.id) as users_count,
          (SELECT COUNT(*)::int FROM "FeedSource" s WHERE s.accountid = a.id) as sources_count,
          (SELECT COUNT(*)::int FROM "Feed" f WHERE f.accountid = a.id) as feeds_count
        FROM "Account" a
        ${whereClause}
        ORDER BY a.createdat DESC
        LIMIT $${paramIdx}::int OFFSET $${paramIdx + 1}::int
      `, ...params, limit, skip);
      accountsResult = withAddonia;
      hasAddonIAColumn = true;
    } catch (err) {
      if (err?.message && /addonia|column.*does not exist/i.test(err.message)) {
        accountsResult = await prisma.$queryRawUnsafe(`
          SELECT 
            a.id, a.name, a.plan, a.email, a.trialendsat, a.createdat, a.updatedat,
            (SELECT COUNT(*)::int FROM "User" u WHERE u.accountid = a.id) as users_count,
            (SELECT COUNT(*)::int FROM "FeedSource" s WHERE s.accountid = a.id) as sources_count,
            (SELECT COUNT(*)::int FROM "Feed" f WHERE f.accountid = a.id) as feeds_count
          FROM "Account" a
          ${whereClause}
          ORDER BY a.createdat DESC
          LIMIT $${paramIdx}::int OFFSET $${paramIdx + 1}::int
        `, ...params, limit, skip);
      } else {
        throw err;
      }
    }

    const [totalResult] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count FROM "Account" a ${whereClause}
      `, ...params)
    ]);

    const total = totalResult[0]?.count || 0;
    const toIso = (d) => (d && (d.toISOString ? d.toISOString() : d)) || null;
    const accounts = (accountsResult || []).map(acc => ({
      id: acc.id,
      name: acc.name,
      plan: acc.plan || 'STARTER',
      email: acc.email,
      trialEndsAt: toIso(acc.trialendsat),
      addonIA: hasAddonIAColumn ? !!acc.addonia : false,
      createdAt: toIso(acc.createdat),
      updatedAt: toIso(acc.updatedat),
      usersCount: acc.users_count ?? 0,
      sourcesCount: acc.sources_count ?? 0,
      feedsCount: acc.feeds_count ?? 0,
    }));

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      accounts,
    });
  } catch (err) {
    console.error('Erreur GET /admin/accounts:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des comptes' });
  }
});

// Modifier le plan et/ou la date de fin d'essai d'un compte — RÉSERVÉ STAFF
const ALLOWED_PLANS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
app.patch('/api/v1/admin/accounts/:accountId', authenticateToken, requireStaffAccess, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Base de données non disponible' });
    }
    const { accountId } = req.params;
    const { plan, trialEndsAt, addonIA } = req.body || {};

    const setClauses = [];
    const params = [accountId];
    let paramIdx = 2;
    if (plan !== undefined) {
      if (!ALLOWED_PLANS.includes(plan)) {
        return res.status(400).json({ message: 'Plan invalide. Valeurs autorisées: STARTER, PROFESSIONAL, ENTERPRISE' });
      }
      setClauses.push(`plan = $${paramIdx}::text`);
      params.push(plan);
      paramIdx++;
    }
    if (trialEndsAt !== undefined) {
      setClauses.push(`trialendsat = $${paramIdx}::timestamptz`);
      params.push(trialEndsAt === null || trialEndsAt === '' ? null : new Date(trialEndsAt));
      paramIdx++;
    }
    let addonIASkipped = false;
    if (addonIA !== undefined) {
      setClauses.push(`addonia = $${paramIdx}::boolean`);
      params.push(!!addonIA);
      paramIdx++;
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ message: 'Indiquez au moins plan, trialEndsAt ou addonIA' });
    }
    setClauses.push('updatedat = NOW()');

    const check = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Account" WHERE id = $1::text LIMIT 1`,
      accountId
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ message: 'Compte non trouvé' });
    }

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Account" SET ${setClauses.join(', ')} WHERE id = $1::text`,
        ...params
      );
    } catch (updateErr) {
      if (addonIA !== undefined && updateErr?.message && /addonia|column.*does not exist|42703/i.test(updateErr.message)) {
        addonIASkipped = true;
        const retryClauses = [];
        const retryParams = [accountId];
        let ri = 2;
        if (plan !== undefined) {
          retryClauses.push(`plan = $${ri}::text`);
          retryParams.push(plan);
          ri++;
        }
        if (trialEndsAt !== undefined) {
          retryClauses.push(`trialendsat = $${ri}::timestamptz`);
          retryParams.push(trialEndsAt === null || trialEndsAt === '' ? null : new Date(trialEndsAt));
          ri++;
        }
        if (retryClauses.length === 0) {
          return res.status(400).json({ message: 'Indiquez au moins plan ou trialEndsAt pour enregistrer sans Pack IA' });
        }
        retryClauses.push('updatedat = NOW()');
        retryParams.push(accountId);
        await prisma.$executeRawUnsafe(
          `UPDATE "Account" SET ${retryClauses.join(', ')} WHERE id = $${ri}::text`,
          ...retryParams
        );
      } else {
        throw updateErr;
      }
    }

    let updated;
    try {
      [updated] = await prisma.$queryRawUnsafe(
        `SELECT id, plan, trialendsat, addonia, updatedat FROM "Account" WHERE id = $1::text LIMIT 1`,
        accountId
      );
    } catch (selErr) {
      if (selErr?.message && /addonia|42703/i.test(selErr.message)) {
        [updated] = await prisma.$queryRawUnsafe(
          `SELECT id, plan, trialendsat, updatedat FROM "Account" WHERE id = $1::text LIMIT 1`,
          accountId
        );
        updated.addonia = false;
      } else {
        throw selErr;
      }
    }
    const toIso = (d) => (d && (d.toISOString ? d.toISOString() : d)) || null;
    return res.json({
      message: addonIASkipped ? 'Compte mis à jour. Pack IA non enregistré : exécutez la migration 024 (colonne addonia) en base.' : 'Compte mis à jour',
      account: {
        id: updated.id,
        plan: updated.plan || 'STARTER',
        trialEndsAt: toIso(updated.trialendsat),
        addonIA: !!updated.addonia,
        updatedAt: toIso(updated.updatedat),
      },
    });
  } catch (err) {
    console.error('Erreur PATCH /admin/accounts/:accountId:', err);
    const msg = err?.message || 'Erreur lors de la mise à jour du compte';
    return res.status(500).json({ message: msg });
  }
});

// Endpoint historique désactivé : les migrations runtime ne sont plus autorisées
app.post('/api/v1/admin/apply-addon-ia-migration', authenticateToken, requireStaffAccess, async (req, res) => {
  return res.status(410).json({
    message: 'Les migrations runtime ont été supprimées. Appliquez 024_account_addon_ia.sql hors process.',
  });
});

// Endpoint historique désactivé : les migrations runtime ne sont plus autorisées
app.post('/api/v1/admin/apply-enrichment-migration', authenticateToken, requireStaffAccess, async (req, res) => {
  return res.status(410).json({
    message: 'Les migrations runtime ont été supprimées. Appliquez 008_enrichment_history.sql hors process.',
  });
});
}

module.exports = { registerAdminRoutes };

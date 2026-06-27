/**
 * Routes du centre de notifications in-app (4 routes /api/v1/notifications/*) :
 * liste + compteur non lus, marquage lu (un/tous), suppression.
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handlers copiés À L'IDENTIQUE. Seul ajout en
 * tête de chaque handler utilisant Prisma :
 * `const prisma = getPrisma(); const prismaReady = getPrismaReady();` pour
 * résoudre la valeur vivante du client Prisma (réassigné pendant l'init de
 * run()) sans réécrire les références. Le middleware d'authentification
 * `app.use('/api/v1/notifications', requireAuth)` est conservé en tête (même
 * ordre de matching). `requireAuth` reste défini dans server-minimal.js et est
 * injecté via `deps`. AUCUN changement de comportement.
 */
function registerNotificationsRoutes(app, {
  getPrisma,
  getPrismaReady,
  requireAuth,
}) {
// ===== Centre de notifications in-app =====
app.use('/api/v1/notifications', requireAuth);

app.get('/api/v1/notifications', async (req, res) => {
  const prisma = getPrisma(); const prismaReady = getPrismaReady();
  // Dégradation douce : si la table n'existe pas encore (migration 036 non
  // appliquée) ou erreur DB, on renvoie une liste vide plutôt qu'un 500.
  try {
    if (!prismaReady || !prisma) return res.json({ notifications: [], unreadCount: 0 });
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, type, priority, title, message, actionurl, read, createdat
       FROM notification WHERE accountid = $1::text
       ORDER BY createdat DESC LIMIT 50`,
      req.accountId
    );
    const unread = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM notification WHERE accountid = $1::text AND read = false`,
      req.accountId
    );
    res.json({
      notifications: (rows || []).map((n) => ({
        id: n.id,
        type: n.type,
        priority: n.priority,
        title: n.title,
        message: n.message,
        actionUrl: n.actionurl || null,
        read: n.read === true,
        timestamp: n.createdat,
      })),
      unreadCount: unread?.[0]?.c ?? 0,
    });
  } catch (e) {
    console.warn('GET notifications error (table absente?):', e?.message);
    res.json({ notifications: [], unreadCount: 0 });
  }
});

app.post('/api/v1/notifications/:id/read', async (req, res) => {
  const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    await prisma.$executeRawUnsafe(
      `UPDATE notification SET read = true WHERE id = $1::text AND accountid = $2::text`,
      req.params.id, req.accountId
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Mark notification read error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

app.post('/api/v1/notifications/read-all', async (req, res) => {
  const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    await prisma.$executeRawUnsafe(
      `UPDATE notification SET read = true WHERE accountid = $1::text AND read = false`,
      req.accountId
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Mark all notifications read error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

app.delete('/api/v1/notifications/:id', async (req, res) => {
  const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    await prisma.$executeRawUnsafe(
      `DELETE FROM notification WHERE id = $1::text AND accountid = $2::text`,
      req.params.id, req.accountId
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Delete notification error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});
}

module.exports = { registerNotificationsRoutes };

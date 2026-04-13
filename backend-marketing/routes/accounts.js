function registerAccountRoutes(app, prisma, getPrismaReady, { authenticateToken, findUserById, issueAuthTokens, buildAuthUser, hashAuthActionToken }) {
  app.get('/api/v1/accounts', authenticateToken, async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      const accountId = req.user.accountId || req.accountId;
      if (!accountId) {
        return res.status(403).json({ message: 'Compte non associé' });
      }
      let accounts;
      try {
        accounts = await prisma.$queryRawUnsafe(`
          SELECT id, name, plan, email, trialendsat, billingstatus, paymentgraceuntil
          FROM "Account" WHERE id = $1::text LIMIT 1
        `, accountId);
      } catch (err) {
        if (!err?.message || !/billingstatus|paymentgraceuntil|42703/i.test(err.message)) {
          throw err;
        }
        accounts = await prisma.$queryRawUnsafe(`
          SELECT id, name, plan, email, trialendsat
          FROM "Account" WHERE id = $1::text LIMIT 1
        `, accountId);
      }
      if (!accounts || accounts.length === 0) {
        return res.status(404).json({ message: 'Compte non trouvé' });
      }
      const account = accounts[0];
      const users = await prisma.$queryRawUnsafe(`
        SELECT id, email, firstname, lastname, role, createdat
        FROM "User" WHERE accountid = $1::text ORDER BY createdat DESC
      `, accountId);
      res.json({
        id: account.id,
        name: account.name,
        plan: account.plan || 'STARTER',
        email: account.email,
        trialEndsAt: account.trialendsat || null,
        billingStatus: account.billingstatus || null,
        paymentGraceUntil: account.paymentgraceuntil || null,
        users: (users || []).map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstname || '',
          lastName: u.lastname || '',
          role: u.role,
          status: u.status || 'ACTIVE',
          lastLoginAt: u.lastloginat || null,
          createdAt: u.createdat
        }))
      });
    } catch (error) {
      console.error('GET /accounts error:', error);
      res.status(500).json({ message: 'Erreur lors du chargement du compte' });
    }
  });

  app.put('/api/v1/accounts', authenticateToken, async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      const role = (req.user && req.user.role) || '';
      if (!['OWNER', 'MANAGER'].includes(role)) {
        return res.status(403).json({ message: 'Permissions insuffisantes' });
      }
      const accountId = req.user.accountId || req.accountId;
      const { name } = req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Le nom du compte est requis' });
      }
      await prisma.$executeRawUnsafe(`
        UPDATE "Account" SET name = $1::text, updatedat = NOW() WHERE id = $2::text
      `, name.trim(), accountId);
      res.json({ id: accountId, name: name.trim() });
    } catch (error) {
      console.error('PUT /accounts error:', error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour du compte' });
    }
  });

  app.put('/api/v1/accounts/users/me', authenticateToken, async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      const userId = req.user.id;
      const { firstName, lastName } = req.body || {};
      const updates = [];
      const args = [];
      let pos = 1;
      if (firstName !== undefined && typeof firstName === 'string') {
        updates.push(`firstname = $${pos}::text`);
        args.push(firstName.trim());
        pos++;
      }
      if (lastName !== undefined && typeof lastName === 'string') {
        updates.push(`lastname = $${pos}::text`);
        args.push(lastName.trim());
        pos++;
      }
      if (updates.length === 0) {
        return res.status(400).json({ message: 'Aucune donnée à mettre à jour (firstName, lastName)' });
      }
      updates.push('updatedat = NOW()');
      args.push(userId);
      const sql = `UPDATE "User" SET ${updates.join(', ')} WHERE id = $${pos}::text`;
      await prisma.$executeRawUnsafe(sql, ...args);
      const updated = await findUserById(userId);
      if (!updated) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }
      res.json({
        id: updated.id,
        email: updated.email,
        firstName: updated.firstname,
        lastName: updated.lastname,
        role: updated.role,
        accountId: updated.accountid
      });
    } catch (error) {
      console.error('PUT /accounts/users/me error:', error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour du profil' });
    }
  });

  app.get('/api/v1/accounts/users', authenticateToken, async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      const accountId = req.user.accountId || req.accountId;
      if (!accountId) {
        return res.status(403).json({ message: 'Compte non associé' });
      }
      const users = await prisma.$queryRawUnsafe(`
        SELECT id, email, firstname, lastname, role, createdat
        FROM "User" WHERE accountid = $1::text ORDER BY createdat DESC
      `, accountId);
      res.json((users || []).map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstname || '',
        lastName: u.lastname || '',
        role: u.role,
        status: u.status || 'ACTIVE',
        lastLoginAt: u.lastloginat || null,
        createdAt: u.createdat
      })));
    } catch (error) {
      console.error('GET /accounts/users error:', error);
      res.status(500).json({ message: 'Erreur lors du chargement des utilisateurs' });
    }
  });

  app.put('/api/v1/accounts/users/:userId/role', authenticateToken, async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      if (req.user.role !== 'OWNER') {
        return res.status(403).json({ message: 'Seuls les propriétaires peuvent modifier les rôles' });
      }
      const { userId } = req.params;
      const { role } = req.body || {};
      const accountId = req.user.accountId || req.accountId;
      if (!['OWNER', 'MANAGER', 'VIEWER', 'AGENCY'].includes(role)) {
        return res.status(400).json({ message: 'Rôle invalide' });
      }
      if (userId === req.user.id) {
        return res.status(403).json({ message: 'Vous ne pouvez pas modifier votre propre rôle' });
      }
      const target = await prisma.$queryRawUnsafe(`
        SELECT id FROM "User" WHERE id = $1::text AND accountid = $2::text LIMIT 1
      `, userId, accountId);
      if (!target || target.length === 0) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }
      await prisma.$executeRawUnsafe(`
        UPDATE "User" SET role = $1::text, updatedat = NOW() WHERE id = $2::text
      `, role, userId);
      res.json({ id: userId, role });
    } catch (error) {
      console.error('PUT /accounts/users/:userId/role error:', error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour du rôle' });
    }
  });

  app.delete('/api/v1/accounts/users/:userId', authenticateToken, async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      if (req.user.role !== 'OWNER') {
        return res.status(403).json({ message: 'Seuls les propriétaires peuvent retirer des membres' });
      }
      const { userId } = req.params;
      const accountId = req.user.accountId || req.accountId;
      if (userId === req.user.id) {
        return res.status(403).json({ message: 'Vous ne pouvez pas vous retirer vous-même' });
      }
      const target = await prisma.$queryRawUnsafe(`
        SELECT id FROM "User" WHERE id = $1::text AND accountid = $2::text LIMIT 1
      `, userId, accountId);
      if (!target || target.length === 0) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = $1::text`, userId);
      res.json({ message: 'Utilisateur retiré du compte' });
    } catch (error) {
      console.error('DELETE /accounts/users/:userId error:', error);
      res.status(500).json({ message: 'Erreur lors de la suppression' });
    }
  });

  app.post('/api/v1/accounts/users/invite', authenticateToken, async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      const role = (req.user && req.user.role) || '';
      if (!['OWNER', 'MANAGER'].includes(role)) {
        return res.status(403).json({ message: 'Permissions insuffisantes pour inviter' });
      }
      const accountId = req.user.accountId || req.accountId;
      const { email, firstName, lastName, role: inviteRole } = req.body || {};
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ message: 'Email requis' });
      }
      const validRoles = ['OWNER', 'MANAGER', 'VIEWER', 'AGENCY'];
      const finalRole = validRoles.includes(inviteRole) ? inviteRole : 'VIEWER';
      const existing = await prisma.$queryRawUnsafe(`
        SELECT id FROM "User" WHERE email = $1::text LIMIT 1
      `, email.trim().toLowerCase());
      if (existing && existing.length > 0) {
        return res.status(409).json({ message: 'Un utilisateur avec cet email existe déjà' });
      }
      const { sendInvitationEmail } = require('../email/email-service');
      const crypto = require('crypto');
      const id = crypto.randomUUID();
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const invitationTokenHash = hashAuthActionToken(invitationToken);
      const invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "User" (id, email, firstname, lastname, role, accountid, provider, password, resettoken, resettokenexpiry, status, createdat, updatedat)
          VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, 'local', '', $7::text, $8::timestamptz, 'INACTIVE', NOW(), NOW())
        `, id, email.trim().toLowerCase(), (firstName || '').trim(), (lastName || '').trim(), finalRole, accountId, invitationTokenHash, invitationExpiry);
      } catch (insertErr) {
        if (insertErr.message && insertErr.message.includes('status')) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "User" (id, email, firstname, lastname, role, accountid, provider, password, resettoken, resettokenexpiry, createdat, updatedat)
            VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, 'local', '', $7::text, $8::timestamptz, NOW(), NOW())
          `, id, email.trim().toLowerCase(), (firstName || '').trim(), (lastName || '').trim(), finalRole, accountId, invitationTokenHash, invitationExpiry);
        } else throw insertErr;
      }
      const inviterName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || null;
      const inviter = await findUserById(req.user.id);
      const inviterDisplayName = inviter ? [inviter.firstname, inviter.lastname].filter(Boolean).join(' ') : inviterName;
      sendInvitationEmail(email.trim(), (firstName || '').trim(), inviterDisplayName, invitationToken).catch(e => console.warn('Email invitation non envoyé:', e.message));
      res.status(201).json({
        id,
        email: email.trim().toLowerCase(),
        firstName: (firstName || '').trim(),
        lastName: (lastName || '').trim(),
        role: finalRole,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('POST /accounts/users/invite error:', error);
      res.status(500).json({ message: error.message || 'Erreur lors de l\'invitation' });
    }
  });

  app.put('/api/v1/auth/me/password', authenticateToken, async (req, res) => {
    try {
      if (!getPrismaReady() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Mot de passe actuel et nouveau requis' });
      }
      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre' });
      }
      const bcrypt = require('bcryptjs');
      const userId = req.user.id;
      const users = await prisma.$queryRawUnsafe(`
        SELECT id, password FROM "User" WHERE id = $1::text LIMIT 1
      `, userId);
      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }
      const user = users[0];
      if (!user.password) {
        return res.status(400).json({ message: 'Compte connecté via Google. Utilisez la déconnexion puis la réinitialisation si besoin.' });
      }
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
      }
      const hashed = await bcrypt.hash(newPassword, 12);
      await prisma.$executeRawUnsafe(`
        UPDATE "User" SET password = $1::text, updatedat = NOW() WHERE id = $2::text
      `, hashed, userId);
      res.json({ message: 'Mot de passe modifié avec succès' });
    } catch (error) {
      console.error('PUT /auth/me/password error:', error);
      res.status(500).json({ message: 'Erreur lors du changement de mot de passe' });
    }
  });
}

module.exports = { registerAccountRoutes };

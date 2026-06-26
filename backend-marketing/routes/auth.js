/**
 * Routes d'authentification : login, register, profil, refresh, logout,
 * changement de mot de passe, Google Sign-In, forgot/reset password,
 * acceptation d'invitation.
 *
 * Extrait de server-minimal.js (pattern routes/onboarding-billing.js) :
 * les corps de routes sont identiques, seules les dépendances du scope de
 * run() sont injectées via `deps`.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const {
  hashAuthActionToken,
  normalizeAuthActionToken,
  validatePasswordPolicy,
} = require('../domains/auth/security');

function registerAuthRoutes(app, {
  getPrisma,
  getPrismaReady,
  authenticateToken,
  smartAuthLimiter,
  registerLimiter,
  getClientIp,
  getLoginFailureStatus,
  recordLoginFailure,
  recordLoginSuccess,
  findUserByEmail,
  findUserById,
  issueAuthTokens,
  buildAuthUser,
  markMarketingLeadConverted,
  isStaffForUser,
  isStaffUser,
  verifyTurnstileToken,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  isTokenRevoked,
  jwtRefreshSecret,
  jwtVerifyOptions,
}) {
  const GOOGLE_AUTH_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

  app.post('/api/v1/auth/login', smartAuthLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      const clientIp = getClientIp(req);
      const failureStatus = await getLoginFailureStatus(clientIp);

      if (failureStatus.blocked) {
        return res.status(429).json({
          message: `Trop de tentatives de connexion échouées. Réessayez dans ${failureStatus.remainingTime} minute(s).`,
        });
      }

      const user = await findUserByEmail(email);

      if (!user) {
        await recordLoginFailure(clientIp);
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        await recordLoginFailure(clientIp);
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }

      await recordLoginSuccess(clientIp);
      await markMarketingLeadConverted(user.email).catch((conversionError) => {
        console.warn('Lead marketing non converti après connexion:', conversionError.message);
      });
      const { accessToken, refreshToken } = issueAuthTokens(user);

      res.json({
        accessToken,
        refreshToken,
        token: accessToken,
        user: buildAuthUser(user, req)
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Erreur lors de la connexion' });
    }
  });

  // Inscription
  app.post('/api/v1/auth/register', registerLimiter, async (req, res) => {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        company,
        accountName,
        captchaToken,
        companyWebsite,
        formStartedAt,
      } = req.body;
      const normalizedEmail = String(email || '').trim().toLowerCase();

      if (!normalizedEmail || !password) {
        return res.status(400).json({ message: 'Email et mot de passe requis' });
      }

      // Validation email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Format d\'email invalide' });
      }

      if (String(companyWebsite || '').trim().length > 0) {
        return res.status(400).json({ message: 'Inscription refusée' });
      }

      const startedAtMs = Number(formStartedAt);
      if (Number.isFinite(startedAtMs)) {
        const elapsedMs = Date.now() - startedAtMs;
        if (elapsedMs < 3000) {
          return res.status(400).json({ message: 'Inscription refusée' });
        }
        if (elapsedMs > 1000 * 60 * 60 * 6) {
          return res.status(400).json({ message: 'Session d’inscription expirée. Rechargez la page puis réessayez.' });
        }
      }

      // Les emails staff ne doivent jamais être promus via l'inscription locale,
      // car l'app ne vérifie pas encore la propriété de l'adresse email.
      if (isStaffForUser({ email: normalizedEmail })) {
        return res.status(403).json({
          message: 'Cette adresse email est réservée. Utilisez le compte interne existant ou contactez un administrateur FeedPlug.'
        });
      }

      const passwordValidation = validatePasswordPolicy(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      const captchaCheck = await verifyTurnstileToken({
        token: captchaToken,
        remoteIp: getClientIp(req),
      });
      if (!captchaCheck.ok) {
        return res.status(400).json({ message: captchaCheck.message || 'Captcha invalide' });
      }

      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }

      // Vérifier si l'email existe déjà
      const existing = await findUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({ message: 'Un compte avec cet email existe déjà' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const accountId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      const finalAccountName = accountName || company || `${firstName || ''} ${lastName || ''}`.trim() || 'Mon entreprise';
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      // Créer le compte avec essai gratuit 30 jours
      await prisma.$executeRaw`
        INSERT INTO "Account" (id, name, plan, email, trialendsat, createdat, updatedat)
        VALUES (${accountId}::text, ${finalAccountName}::text, 'STARTER', ${normalizedEmail}::text, ${trialEndsAt}, NOW(), NOW())
      `;

      // Créer l'utilisateur
      await prisma.$executeRaw`
        INSERT INTO "User" (id, email, password, firstname, lastname, role, accountid, provider, createdat, updatedat)
        VALUES (${userId}::text, ${normalizedEmail}::text, ${hashedPassword}::text, ${firstName || ''}::text, ${lastName || ''}::text, 'OWNER', ${accountId}::text, 'local', NOW(), NOW())
      `;

      const authUser = {
        id: userId,
        email: normalizedEmail,
        firstname: firstName || '',
        lastname: lastName || '',
        role: 'OWNER',
        accountid: accountId,
        accountname: finalAccountName,
        trialendsat: trialEndsAt.toISOString()
      };
      const convertedLead = await markMarketingLeadConverted(normalizedEmail).catch((conversionError) => {
        console.warn('Lead marketing non converti après inscription:', conversionError.message);
        return null;
      });
      const { accessToken, refreshToken } = issueAuthTokens(authUser);

      // Envoyer email de bienvenue (async, ne bloque pas la réponse)
      sendWelcomeEmail(normalizedEmail, firstName, convertedLead?.locale || 'fr').catch(e => console.warn('Email bienvenue non envoyé:', e.message));

      res.status(201).json({
        accessToken,
        refreshToken,
        token: accessToken, // rétro-compatibilité
        user: buildAuthUser(authUser, req)
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ message: 'Erreur lors de l\'inscription' });
    }
  });

  // Profil utilisateur courant
  app.get('/api/v1/auth/me', authenticateToken, async (req, res) => {
    try {
      const user = await findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstname,
        lastName: user.lastname,
        role: user.role,
        accountId: user.accountid,
        account: user.accountname ? { name: user.accountname, plan: user.accountplan || 'STARTER', slug: (user.accountname || '').toLowerCase().replace(/\s+/g, '-') } : undefined,
        accountName: user.accountname,
        plan: user.accountplan || 'STARTER',
        trialEndsAt: user.trialendsat || null,
        billingStatus: user.billingstatus || null,
        paymentGraceUntil: user.paymentgraceuntil || null,
        isStaff: isStaffUser(req)
      });
    } catch (error) {
      res.status(500).json({ message: 'Erreur' });
    }
  });

  app.post('/api/v1/auth/refresh', async (req, res) => {
    try {
      const refreshToken = req.body?.refreshToken;
      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token requis' });
      }

      let decoded;
      try {
        decoded = jwt.verify(refreshToken, jwtRefreshSecret, jwtVerifyOptions);
      } catch (_) {
        return res.status(401).json({ message: 'Refresh token invalide ou expiré' });
      }

      if (isTokenRevoked && (await isTokenRevoked(decoded))) {
        return res.status(401).json({ message: 'Refresh token révoqué' });
      }

      const user = await findUserById(decoded.id);
      if (!user) {
        return res.status(401).json({ message: 'Utilisateur non trouvé' });
      }

      const tokens = issueAuthTokens(user);
      res.json(tokens);
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({ message: 'Erreur lors du refresh du token' });
    }
  });

  app.post('/api/v1/auth/logout', async (req, res) => {
    // Révocation explicite du token courant (et du refresh fourni en body).
    // Idempotent : même si la DB est down ou si le token est invalide, on
    // répond 204 pour ne pas révéler l'état d'authentification au client.
    try {
      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) {
        return res.status(204).send();
      }

      const collect = [];
      const authHeader = req.headers['authorization'];
      const access = authHeader && authHeader.split(' ')[1];
      if (access) {
        const decoded = jwt.decode(access);
        if (decoded?.jti && typeof decoded.exp === 'number') {
          collect.push({ jti: decoded.jti, userId: decoded.id || null, exp: decoded.exp });
        }
      }
      const refresh = req.body?.refreshToken;
      if (refresh) {
        const decoded = jwt.decode(refresh);
        if (decoded?.jti && typeof decoded.exp === 'number') {
          collect.push({ jti: decoded.jti, userId: decoded.id || null, exp: decoded.exp });
        }
      }

      for (const { jti, userId, exp } of collect) {
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "RevokedJti" (jti, userid, expiresat, createdat)
             VALUES ($1::text, $2::text, to_timestamp($3), NOW())
             ON CONFLICT (jti) DO NOTHING`,
            jti, userId, exp
          );
        } catch (e) {
          console.warn('logout: insert RevokedJti failed', e?.message);
        }
      }
    } catch (e) {
      console.warn('logout: error', e?.message);
    }
    res.status(204).send();
  });

  app.put('/api/v1/auth/me/password', authenticateToken, async (req, res) => {
    try {
      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Mot de passe actuel et nouveau requis' });
      }
      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre' });
      }
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
        UPDATE "User" SET password = $1::text, passwordchangedat = NOW(), updatedat = NOW() WHERE id = $2::text
      `, hashed, userId);
      // Réémet des tokens : ceux que l'utilisateur tient actuellement viennent
      // d'être invalidés via passwordchangedat. Sans ça, la session courante
      // tombe immédiatement (mauvaise UX).
      const freshUser = await findUserById(userId);
      const tokens = freshUser ? issueAuthTokens(freshUser) : null;
      res.json({ message: 'Mot de passe modifié avec succès', ...(tokens || {}) });
    } catch (error) {
      console.error('PUT /auth/me/password error:', error);
      res.status(500).json({ message: 'Erreur lors du changement de mot de passe' });
    }
  });

  app.post('/api/v1/auth/google', smartAuthLimiter, async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ message: 'Token Google requis' });
      }
      if (!GOOGLE_AUTH_CLIENT_ID) {
        console.error('GOOGLE_CLIENT_ID non configuré pour auth Google');
        return res.status(500).json({ message: 'Authentification Google non configurée' });
      }
      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }

      const client = new OAuth2Client(GOOGLE_AUTH_CLIENT_ID);
      const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_AUTH_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(400).json({ message: 'Token Google invalide' });
      }

      const email = payload.email;
      const googleId = payload.sub;
      const givenName = payload.given_name || '';
      const familyName = payload.family_name || '';

      // Google ne renvoie un id_token qu'après vérification de l'email côté
      // Google. On le vérifie explicitement avant d'autoriser le lien de compte.
      if (payload.email_verified === false) {
        return res.status(400).json({ message: 'Email Google non vérifié.' });
      }

      let user = await findUserByEmail(email);
      const isNewGoogleUser = !user;
      let linkedNow = false;
      if (user) {
        // Lien automatique : si un compte existe avec ce même email (créé en
        // local, p.ex.), on stocke le googleId sur le user pour le retrouver
        // directement les fois suivantes. Le mot de passe reste utilisable en
        // parallèle — l'utilisateur peut désormais se connecter par les deux
        // chemins. Google ayant vérifié l'email, l'opération est légitime.
        if (user.providerid !== googleId) {
          await prisma.$executeRaw`
            UPDATE "User" SET providerid = ${googleId}::text, updatedat = NOW() WHERE id = ${user.id}::text
          `;
          user.providerid = googleId;
          linkedNow = user.provider !== 'google';
        }
      } else {
        const accountId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        const googleAccountName = payload.name || `${givenName} ${familyName}`.trim() || 'Mon entreprise';
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 30);

        await prisma.$executeRaw`
          INSERT INTO "Account" (id, name, plan, email, trialendsat, createdat, updatedat)
          VALUES (${accountId}::text, ${googleAccountName}::text, 'STARTER', ${email}::text, ${trialEndsAt}, NOW(), NOW())
        `;
        await prisma.$executeRaw`
          INSERT INTO "User" (id, email, password, firstname, lastname, role, accountid, provider, providerid, createdat, updatedat)
          VALUES (${userId}::text, ${email}::text, NULL, ${givenName}::text, ${familyName}::text, 'OWNER', ${accountId}::text, 'google', ${googleId}::text, NOW(), NOW())
        `;
        user = await findUserByEmail(email);
      }

      const convertedLead = await markMarketingLeadConverted(email).catch((conversionError) => {
        console.warn('Lead marketing non converti après auth Google:', conversionError.message);
        return null;
      });
      if (isNewGoogleUser) {
        sendWelcomeEmail(email, givenName, convertedLead?.locale || 'fr').catch(e => console.warn('Email bienvenue non envoyé:', e.message));
      }

      const { accessToken, refreshToken } = issueAuthTokens(user);

      res.json({
        accessToken,
        refreshToken,
        token: accessToken,
        linked: linkedNow,
        user: buildAuthUser(user, req)
      });
    } catch (error) {
      console.error('Google auth error:', error);
      res.status(500).json({ message: error.message || 'Erreur lors de la connexion Google' });
    }
  });

  app.post('/api/v1/auth/forgot-password', smartAuthLimiter, async (req, res) => {
    try {
      const normalizedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!normalizedEmail) {
        return res.status(400).json({ message: 'Email requis' });
      }

      // Toujours retourner succès (même si email n'existe pas) pour ne pas révéler les comptes
      const user = await findUserByEmail(normalizedEmail);
      const prisma = getPrisma?.();
      if (user && getPrismaReady?.() && prisma) {
        // Générer un token de reset (expire dans 1h)
        const resetToken = crypto.randomUUID();
        const resetTokenHash = hashAuthActionToken(resetToken);
        const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        await prisma.$executeRawUnsafe(`
          UPDATE "User" SET
            resettoken = $1::text,
            resettokenexpiry = $2::timestamptz,
            updatedat = NOW()
          WHERE id = $3::text
        `, resetTokenHash, expiry, user.id);

        // Envoyer l'email de reset
        sendPasswordResetEmail(normalizedEmail, resetToken).catch(e => console.warn('Email reset non envoyé:', e.message));
      }

      res.json({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  app.post('/api/v1/auth/reset-password', smartAuthLimiter, async (req, res) => {
    try {
      const normalizedToken = normalizeAuthActionToken(req.body?.token);
      const { password } = req.body || {};
      if (!normalizedToken || !password) {
        return res.status(400).json({ message: 'Token et nouveau mot de passe requis' });
      }

      const passwordValidation = validatePasswordPolicy(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }

      const hashedToken = hashAuthActionToken(normalizedToken);
      const users = await prisma.$queryRawUnsafe(`
        SELECT id
        FROM "User"
        WHERE resettoken = $1::text
          AND resettokenexpiry > NOW()
        LIMIT 1
      `, hashedToken);

      if (!users || users.length === 0) {
        return res.status(400).json({ message: 'Token invalide ou expiré' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      await prisma.$executeRawUnsafe(`
        UPDATE "User" SET
          password = $1::text,
          resettoken = NULL,
          resettokenexpiry = NULL,
          passwordchangedat = NOW(),
          updatedat = NOW()
        WHERE id = $2::text
      `, hashedPassword, users[0].id);

      res.json({ message: 'Mot de passe réinitialisé avec succès' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  app.post('/api/v1/auth/accept-invitation', smartAuthLimiter, async (req, res) => {
    try {
      const normalizedToken = normalizeAuthActionToken(req.body?.token);
      const { password } = req.body || {};
      if (!normalizedToken || !password) {
        return res.status(400).json({ message: 'Token et mot de passe requis' });
      }

      const passwordValidation = validatePasswordPolicy(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) {
        return res.status(503).json({ message: 'Service non disponible' });
      }

      const hashedToken = hashAuthActionToken(normalizedToken);
      const users = await prisma.$queryRawUnsafe(`
        SELECT id
        FROM "User"
        WHERE resettoken = $1::text
          AND resettokenexpiry > NOW()
        LIMIT 1
      `, hashedToken);

      if (!users || users.length === 0) {
        return res.status(400).json({ message: 'Lien d\'invitation invalide ou expiré' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const userId = users[0].id;

      // Mettre à jour le mot de passe et activer le compte (status si la colonne existe)
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE "User" SET
            password = $1::text,
            resettoken = NULL,
            resettokenexpiry = NULL,
            status = 'ACTIVE',
            passwordchangedat = NOW(),
            updatedat = NOW()
          WHERE id = $2::text
        `, hashedPassword, userId);
      } catch (colErr) {
        if (colErr.message && colErr.message.includes('status')) {
          await prisma.$executeRawUnsafe(`
            UPDATE "User" SET
              password = $1::text,
              resettoken = NULL,
              resettokenexpiry = NULL,
              passwordchangedat = NOW(),
              updatedat = NOW()
            WHERE id = $2::text
          `, hashedPassword, userId);
        } else throw colErr;
      }

      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      const { accessToken, refreshToken } = issueAuthTokens(user);
      res.json({
        message: 'Compte activé avec succès',
        accessToken,
        refreshToken,
        token: accessToken,
        user: buildAuthUser(user, req)
      });
    } catch (error) {
      console.error('Accept invitation error:', error);
      res.status(500).json({ message: 'Erreur' });
    }
  });
}

module.exports = { registerAuthRoutes };

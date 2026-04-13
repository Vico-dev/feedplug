function registerAuthRoutes(app, prisma, getPrismaReady, { EFFECTIVE_JWT_SECRET, EFFECTIVE_JWT_REFRESH_SECRET }) {
  const jwt = require('jsonwebtoken');
  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');

  async function getClientIp(req) {
    return req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      'unknown';
  }

  async function findUserByEmail(email) {
    if (!getPrismaReady() || !prisma) return null;
    const [users] = await prisma.$queryRawUnsafe(`
      SELECT u.*, a.name as accountname, a.plan as accountplan, a.trialendsat, a.billingstatus, a.paymentgraceuntil
      FROM "User" u
      LEFT JOIN "Account" a ON u.accountid = a.id
      WHERE LOWER(u.email) = LOWER($1::text) LIMIT 1
    `, String(email || '').trim().toLowerCase());
    return users || null;
  }

  async function findUserById(userId) {
    if (!getPrismaReady() || !prisma) return null;
    const [user] = await prisma.$queryRawUnsafe(`
      SELECT u.*, a.name as accountname, a.plan as accountplan, a.trialendsat, a.billingstatus, a.paymentgraceuntil
      FROM "User" u
      LEFT JOIN "Account" a ON u.accountid = a.id
      WHERE u.id = $1::text LIMIT 1
    `, userId);
    return user || null;
  }

  function issueAuthTokens(user) {
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, accountId: user.accountid },
      EFFECTIVE_JWT_SECRET,
      { expiresIn: '7d' }
    );
    const refreshToken = jwt.sign(
      { id: user.id },
      EFFECTIVE_JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );
    return { accessToken, refreshToken };
  }

  function buildAuthUser(user, req) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      role: user.role,
      accountId: user.accountid,
      account: user.accountname ? { name: user.accountname, plan: user.accountplan || 'STARTER' } : undefined,
      accountName: user.accountname,
      plan: user.accountplan || 'STARTER',
      trialEndsAt: user.trialendsat || null,
      billingStatus: user.billingstatus || null,
      paymentGraceUntil: user.paymentgraceuntil || null,
    };
  }

  const { validatePasswordPolicy } = require('../domains/auth/security');
  const { markMarketingLeadConverted } = require('../email/email-service');

  async function getLoginFailureStatus(clientIp) {
    if (!getPrismaReady() || !prisma) {
      return { blocked: false, remainingTime: 0 };
    }
    try {
      const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const failures = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as failures FROM "LoginFailure"
        WHERE "ipAddress" = $1::text AND "failedAt" > $2::timestamptz
      `, clientIp, windowStart);
      const count = failures?.[0]?.failures ?? 0;
      if (count >= 5) {
        const oldest = await prisma.$queryRawUnsafe(`
          SELECT "failedAt" FROM "LoginFailure"
          WHERE "ipAddress" = $1::text ORDER BY "failedAt" DESC LIMIT 1
        `, clientIp);
        const oldestTime = oldest?.[0]?.failedat ? new Date(oldest[0].failedat).getTime() : Date.now();
        const remainingMs = Math.max(0, (oldestTime + 15 * 60 * 1000) - Date.now());
        return { blocked: true, remainingTime: Math.ceil(remainingMs / 60000) };
      }
      return { blocked: false, remainingTime: 0 };
    } catch {
      return { blocked: false, remainingTime: 0 };
    }
  }

  async function recordLoginFailure(clientIp) {
    if (!getPrismaReady() || !prisma) return;
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "LoginFailure" (id, "ipAddress", "failedAt")
        VALUES ($1::text, $2::text, NOW())
      `, crypto.randomUUID(), clientIp);
      await prisma.$executeRawUnsafe(`
        DELETE FROM "LoginFailure" WHERE "failedAt" < NOW() - INTERVAL '1 hour'
      `);
    } catch { }
  }

  async function recordLoginSuccess(clientIp) {
    if (!getPrismaReady() || !prisma) return;
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "LoginFailure" WHERE "ipAddress" = $1::text`, clientIp);
    } catch { }
  }

  const { verifyTurnstileToken } = require('../lib/turnstile');

  const isStaffForUser = ({ email }) => {
    const staffEmails = (process.env.FEEDPLUG_STAFF_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    return staffEmails.includes(String(email || '').trim().toLowerCase());
  };

  app.post('/api/v1/auth/login', async (req, res) => {
    try {
      const { smartAuthLimiter } = require('../middleware/rate-limit');
      smartAuthLimiter(req, res, async () => {
        const { email, password } = req.body;
        const clientIp = await getClientIp(req);
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
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Erreur lors de la connexion' });
    }
  });

  app.post('/api/v1/auth/register', async (req, res) => {
    try {
      const { registerLimiter } = require('../middleware/rate-limit');
      registerLimiter(req, res, async () => {
        const {
          email,
          password,
          firstName,
          lastName,
          company,
          accountName,
          captchaToken,
          formStartedAt,
        } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        if (!normalizedEmail || !password) {
          return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
          return res.status(400).json({ message: 'Format d\'email invalide' });
        }

        const startedAtMs = Number(formStartedAt);
        if (Number.isFinite(startedAtMs)) {
          const elapsedMs = Date.now() - startedAtMs;
          if (elapsedMs < 3000) {
            return res.status(400).json({ message: 'Inscription refusée' });
          }
          if (elapsedMs > 1000 * 60 * 60 * 6) {
            return res.status(400).json({ message: 'Session d\'inscription expirée. Rechargez la page puis réessayez.' });
          }
        }

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
          remoteIp: await getClientIp(req),
        });
        if (!captchaCheck.ok) {
          return res.status(400).json({ message: captchaCheck.message || 'Captcha invalide' });
        }

        if (!getPrismaReady() || !prisma) {
          return res.status(503).json({ message: 'Service non disponible' });
        }

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

        await prisma.$executeRaw`
          INSERT INTO "Account" (id, name, plan, email, trialendsat, createdat, updatedat)
          VALUES (${accountId}::text, ${finalAccountName}::text, 'STARTER', ${normalizedEmail}::text, ${trialEndsAt}, NOW(), NOW())
        `;

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

        const { sendWelcomeEmail } = require('../email/email-service');
        sendWelcomeEmail(normalizedEmail, firstName, convertedLead?.locale || 'fr').catch(e => console.warn('Email bienvenue non envoyé:', e.message));

        res.status(201).json({
          accessToken,
          refreshToken,
          token: accessToken,
          user: buildAuthUser(authUser, req)
        });
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ message: 'Erreur lors de l\'inscription' });
    }
  });

  app.get('/api/v1/auth/me', async (req, res) => {
    const { authenticateToken } = require('../middleware/auth');
    authenticateToken(req, res, async () => {
      try {
        const user = await findUserById(req.user.id);
        if (!user) {
          return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        const { isStaffUser } = require('../middleware/auth');
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
  });

  app.post('/api/v1/auth/refresh', async (req, res) => {
    try {
      const refreshToken = req.body?.refreshToken;
      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token requis' });
      }

      let decoded;
      try {
        decoded = jwt.verify(refreshToken, EFFECTIVE_JWT_REFRESH_SECRET);
      } catch (_) {
        return res.status(401).json({ message: 'Refresh token invalide ou expiré' });
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
    res.status(204).send();
  });
}

module.exports = { registerAuthRoutes };

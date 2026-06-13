/**
 * Routes marketing : leads early-access, audits gratuits (+ PDF), tracking
 * clics/désinscription, nurture (cron + test), feature ideas, back-office
 * leads (staff).
 *
 * Extrait de server-minimal.js (pattern routes/auth.js) : corps de routes
 * identiques, dépendances du scope de run() injectées via `deps`.
 *
 * Restent dans server-minimal.js (couplés au domaine connecteurs/platforms) :
 * GET  /api/v1/marketing/audits/:shareToken/platforms/gmc/auth-url
 * POST /api/v1/marketing/audits/:shareToken/connectors/{shopify,prestashop,file}/connect
 */
const crypto = require('crypto');
const {
  sendMarketingAuditNurtureEmail,
  sendMarketingAuditEmail,
  notifyInternalMarketingFormSubmission,
  syncMarketingContact,
  verifyMarketingClickToken,
  verifyMarketingUnsubscribeToken,
  getEmailLocale,
} = require('../email/email-service');

function registerMarketingRoutes(app, {
  getPrisma,
  getPrismaReady,
  requirePrismaForRequest,
  getPrismaClientOrThrow,
  authenticateToken,
  requireStaffAccess,
  marketingEarlyAccessLimiter,
  marketingAuditLimiter,
  marketingFeatureIdeaLimiter,
  getClientIp,
  auditStepFromStage,
  buildAuditIssuesList,
  buildAuditReportHtml,
  buildLeadTrimmedInput,
  buildMarketingAuditPdfBuffer,
  ensureAuditBeforeAfter,
  formatAuditBlocage,
  markLeadMarketingProgress,
  maybeGenerateMarketingAuditReport,
  normalizeMarketingLeadSource,
  normalizeTargetChannels,
  recordMarketingClick,
  registerLeadInResend,
  renderAuditReportPdf,
  resolveMarketingOutboundStage,
  resolveMarketingRedirectHref,
  sendAuditNurtureForLead,
  sendLeadNurtureStage,
  serializeMarketingAudit,
  serializeMarketingLead,
  stringifyEncryptedJson,
  upsertMarketingLeadForAudit,
  validateMarketingSubmission,
  APP_URL,
  MARKETING_STAGE_DONE,
  MARKETING_STAGE_J0,
}) {
// Endpoint pour Early Access (marketing leads)
app.post('/api/v1/marketing/early-access', marketingEarlyAccessLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const trimmed = buildLeadTrimmedInput(req.body);
    const leadSource = normalizeMarketingLeadSource(req.body?.source);

    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Email invalide' });
    }

    const antiSpamCheck = await validateMarketingSubmission({
      req,
      email,
      trimmed,
      requireCaptcha: Boolean(trimmed.firstName || trimmed.lastName || trimmed.jobTitle || trimmed.company),
    });
    if (!antiSpamCheck.ok) {
      console.warn('Marketing early-access blocked:', {
        reason: antiSpamCheck.reason,
        source: leadSource,
        emailDomain: String(email).trim().toLowerCase().split('@')[1] || 'unknown',
      });
      return res.status(antiSpamCheck.status).json({ message: antiSpamCheck.message });
    }

    const prismaClient = await requirePrismaForRequest(res, 'Service marketing temporairement indisponible');
    if (!prismaClient) return;

    const emailNormalized = email.toLowerCase().trim();
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;
    const nowIso = new Date().toISOString();

    const existingRows = await prismaClient.$queryRawUnsafe(`
      SELECT * FROM marketing_leads WHERE email = $1::text LIMIT 1
    `, emailNormalized);
    const existingLead = existingRows?.[0] || null;

    if (existingLead) {
      if (existingLead.unsubscribedat) {
        await markLeadMarketingProgress(existingLead.id, {
          marketingOptIn: true,
          unsubscribedAt: null,
          nurtureStage: MARKETING_STAGE_J0,
          nextMarketingEmailAt: nowIso,
        });

        setImmediate(async () => {
          try {
            const resendContactId = await registerLeadInResend({
              ...existingLead,
              ...trimmed,
              email: emailNormalized,
              unsubscribedAt: null,
              marketingOptIn: true,
            });
            if (resendContactId) {
              await markLeadMarketingProgress(existingLead.id, { resendContactId });
            }
            await sendLeadNurtureStage({
              ...existingLead,
              ...trimmed,
              id: existingLead.id,
              email: emailNormalized,
              marketingOptIn: true,
              unsubscribedAt: null,
            }, 'j0');
          } catch (marketingError) {
            console.warn('Email marketing J0 non envoyé (lead réactivé):', marketingError.message);
          }
        });
      }

      setImmediate(async () => {
        try {
          await notifyInternalMarketingFormSubmission({
            kind: 'lead',
            source: leadSource,
            email: emailNormalized,
            firstName: trimmed.firstName || existingLead.firstName || existingLead.firstname || null,
            lastName: trimmed.lastName || existingLead.lastName || existingLead.lastname || null,
            jobTitle: trimmed.jobTitle || existingLead.jobTitle || existingLead.jobtitle || null,
            phone: trimmed.phone || existingLead.phone || null,
            company: trimmed.company || existingLead.company || null,
            locale: trimmed.locale || existingLead.locale || 'fr',
            createdAt: nowIso,
            alreadyRegistered: true,
          });
        } catch (alertError) {
          console.warn('Alerte interne lead non envoyee (soumission repetee):', alertError.message);
        }
      });

      return res.status(200).json({
        message: 'Vous êtes déjà inscrit !',
        alreadyRegistered: true,
      });
    }

    const leadId = crypto.randomUUID();
    await prismaClient.$executeRawUnsafe(`
      INSERT INTO marketing_leads (
        id, "firstName", "lastName", "jobTitle", phone, email, company,
        "ipAddress", "userAgent", locale, source, status,
        marketingoptin, nurturestage, nextmarketingemailat,
        "createdAt", "updatedAt"
      )
      VALUES (
        $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text,
        $8::text, $9::text, $10::text, $11::text, 'new',
        true, $12::text, $13::timestamptz,
        $13::timestamptz, $13::timestamptz
      )
    `,
      leadId,
      trimmed.firstName,
      trimmed.lastName,
      trimmed.jobTitle,
      trimmed.phone,
      emailNormalized,
      trimmed.company,
      ipAddress,
      userAgent,
      trimmed.locale,
      leadSource,
      MARKETING_STAGE_J0,
      nowIso
    );

    const saved = await prismaClient.$queryRawUnsafe(`
      SELECT * FROM marketing_leads WHERE id = $1::text LIMIT 1
    `, leadId);
    const newLead = saved?.[0] || null;

    // PII: ne pas logguer l'email en clair (Cloud Run logs → Sentry → indexés).
    // Le leadId suffit pour retrouver l'enregistrement complet en DB.
    console.log(`✅ Nouveau lead Early Access — leadId: ${leadId}`);

    setImmediate(async () => {
      if (!newLead) return;
      try {
        const resendContactId = await registerLeadInResend(newLead);
        if (resendContactId) {
          await markLeadMarketingProgress(newLead.id, { resendContactId });
        }
        await sendLeadNurtureStage(newLead, 'j0');
      } catch (marketingError) {
        console.warn('Email marketing J0 non envoyé:', marketingError.message);
      }

      try {
        await notifyInternalMarketingFormSubmission({
          kind: 'lead',
          source: leadSource,
          email: emailNormalized,
          firstName: trimmed.firstName,
          lastName: trimmed.lastName,
          jobTitle: trimmed.jobTitle,
          phone: trimmed.phone,
          company: trimmed.company,
          locale: trimmed.locale,
          createdAt: nowIso,
        });
      } catch (alertError) {
        console.warn('Alerte interne lead non envoyee:', alertError.message);
      }
    });

    res.status(201).json({
      message: 'Inscription réussie ! Nous vous avons envoyé la suite.',
      success: true,
    });
  } catch (error) {
    console.error('Early access error:', error);
    res.status(500).json({ message: "Erreur lors de l'inscription" });
  }
});

app.post('/api/v1/marketing/audits', marketingAuditLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    const trimmed = buildLeadTrimmedInput(req.body || {});
    const locale = typeof req.body?.locale === 'string' ? req.body.locale.trim() || 'fr' : 'fr';
    const connectorType = String(req.body?.connectorType || 'OTHER').trim().toUpperCase();
    const cmsUsed = typeof req.body?.cmsUsed === 'string' ? req.body.cmsUsed.trim() : '';
    const shopUrl = typeof req.body?.shopUrl === 'string' ? req.body.shopUrl.trim() : '';
    const merchantId = typeof req.body?.merchantId === 'string' ? req.body.merchantId.trim() : '';
    const targetChannels = normalizeTargetChannels(req.body?.targetChannels);
    const catalogSize = Math.max(1, Number(req.body?.catalogSize || 0) || 1);

    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email))) {
      return res.status(400).json({ message: 'Email invalide' });
    }
    if (!trimmed.company) {
      return res.status(400).json({ message: 'Entreprise requise pour generer l audit' });
    }
    if (!trimmed.firstName || !trimmed.lastName || !trimmed.jobTitle) {
      return res.status(400).json({ message: 'Prenom, nom et fonction sont requis' });
    }
    if (!cmsUsed) {
      return res.status(400).json({ message: 'Le CMS ou la source utilisee est requis' });
    }
    if (connectorType === 'GMC' && !merchantId) {
      return res.status(400).json({ message: 'Merchant ID requis pour un audit Google Merchant Center' });
    }
    if (connectorType !== 'GMC' && !shopUrl) {
      return res.status(400).json({ message: 'URL boutique ou flux requise pour lancer l audit' });
    }

    const antiSpamCheck = await validateMarketingSubmission({
      req,
      email,
      trimmed,
      requireCaptcha: true,
    });
    if (!antiSpamCheck.ok) {
      console.warn('Marketing audit blocked:', {
        reason: antiSpamCheck.reason,
        connectorType,
        emailDomain: String(email).trim().toLowerCase().split('@')[1] || 'unknown',
      });
      return res.status(antiSpamCheck.status).json({ message: antiSpamCheck.message });
    }

    const emailNormalized = String(email).trim().toLowerCase();
    const prisma = getPrisma?.();
    if (!getPrismaReady?.() || !prisma) {
      return res.status(503).json({ message: 'Service audit temporairement indisponible' });
    }
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;
    const lead = await upsertMarketingLeadForAudit({
      email: emailNormalized,
      trimmed,
      locale,
      ipAddress,
      userAgent,
    });

    const input = {
      connectorType,
      cmsUsed,
      shopUrl,
      merchantId,
      catalogSize,
      targetChannels,
      gmcDiagnostics: req.body?.gmcDiagnostics || {},
      goal: typeof req.body?.goal === 'string' ? req.body.goal.trim() : 'growth',
    };
    const shareToken = crypto.randomUUID();
    const auditId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const publicBaseUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');
    const shareUrl = `${publicBaseUrl}/${locale}/audit-flux/${shareToken}`;

    await prisma.$executeRawUnsafe(`
      INSERT INTO marketing_audits (
        id, leadid, sharetoken, email, company, locale, connectortype,
        shopurl, merchantid, catalogsize, targetchannels, inputjson, reportjson, status,
        "createdAt", "updatedAt"
      )
      VALUES (
        $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text,
        $8::text, $9::text, $10::int, $11::jsonb, $12::jsonb, $13::jsonb, 'pending_connection',
        $14::timestamptz, $14::timestamptz
      )
    `, auditId, lead?.id || null, shareToken, emailNormalized, trimmed.company, locale, connectorType, shopUrl || null, merchantId || null, catalogSize, JSON.stringify(targetChannels), stringifyEncryptedJson(input), JSON.stringify({}), nowIso);

    setImmediate(async () => {
      if (!lead) return;
      try {
        const resendContactId = await registerLeadInResend(lead);
        if (resendContactId) {
          await markLeadMarketingProgress(lead.id, { resendContactId });
        }
        await sendMarketingAuditEmail({
          email: emailNormalized,
          firstName: trimmed.firstName,
          company: trimmed.company,
          locale,
          shareUrl,
          connectorLabel: cmsUsed || connectorType,
          targetChannels,
        });
      } catch (marketingError) {
        console.warn('Email audit non envoye:', marketingError.message);
      }

      try {
        await notifyInternalMarketingFormSubmission({
          kind: 'audit',
          source: 'audit_flux_marketing',
          email: emailNormalized,
          firstName: trimmed.firstName,
          lastName: trimmed.lastName,
          jobTitle: trimmed.jobTitle,
          phone: trimmed.phone,
          company: trimmed.company,
          locale,
          connectorType,
          cmsUsed,
          shopUrl,
          merchantId,
          catalogSize,
          targetChannels,
          createdAt: nowIso,
        });
      } catch (alertError) {
        console.warn('Alerte interne audit non envoyee:', alertError.message);
      }
    });

    res.status(201).json({
      success: true,
      audit: {
        id: auditId,
        shareToken,
        shareUrl,
        email: emailNormalized,
        company: trimmed.company,
        locale,
        connectorType,
        cmsUsed,
        shopUrl,
        merchantId,
        catalogSize,
        targetChannels,
        report: null,
        status: 'pending_connection',
        createdAt: nowIso,
      },
    });
  } catch (error) {
    console.error('Marketing audit create error:', error);
    res.status(500).json({ message: 'Erreur lors de la creation de l audit' });
  }
});

app.get('/api/v1/marketing/audits/:shareToken', async (req, res) => {
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    if (!shareToken) {
      return res.status(400).json({ message: 'Token audit manquant' });
    }
    const prisma = getPrisma?.();
    if (!getPrismaReady?.() || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const rows = await prisma.$queryRawUnsafe(`
      SELECT *
      FROM marketing_audits
      WHERE sharetoken = $1::text
      LIMIT 1
    `, shareToken);
    let audit = rows?.[0];
    if (!audit) {
      return res.status(404).json({ message: 'Audit introuvable' });
    }
    audit = await maybeGenerateMarketingAuditReport(audit);
    res.json({ audit: serializeMarketingAudit(audit) });
  } catch (error) {
    console.error('Marketing audit get error:', error);
    res.status(500).json({ message: 'Erreur lors de la lecture de l audit' });
  }
});

app.get('/api/v1/marketing/audits/:shareToken/pdf', async (req, res) => {
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    if (!shareToken) {
      return res.status(400).json({ message: 'Token audit manquant' });
    }
    const prisma = getPrisma?.();
    if (!getPrismaReady?.() || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const rows = await prisma.$queryRawUnsafe(`
      SELECT *
      FROM marketing_audits
      WHERE sharetoken = $1::text
      LIMIT 1
    `, shareToken);
    let audit = rows?.[0];
    if (!audit) {
      return res.status(404).json({ message: 'Audit introuvable' });
    }
    audit = await maybeGenerateMarketingAuditReport(audit);
    audit = await ensureAuditBeforeAfter(audit);
    const serialized = serializeMarketingAudit(audit);

    // Audit prêt → PDF premium (HTML → Chromium). Sinon ou en cas d'échec
    // du rendu, on retombe sur le PDF texte pdfkit (jamais d'erreur 500).
    let buffer = null;
    if (serialized.status === 'ready' && serialized.report) {
      try {
        buffer = await renderAuditReportPdf(buildAuditReportHtml(serialized));
      } catch (renderError) {
        console.warn('Rendu PDF premium échoué, fallback pdfkit:', renderError && (renderError.stack || renderError.message || renderError));
      }
    }
    if (!buffer) {
      buffer = await buildMarketingAuditPdfBuffer(serialized);
    }

    const filenameBase = String(serialized.company || 'audit-feedplug')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'audit-feedplug';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="audit-feedplug-${filenameBase}.pdf"`);
    res.send(buffer);
  } catch (error) {
    console.error('Marketing audit pdf error:', error);
    res.status(500).json({ message: 'Erreur lors de la generation du PDF' });
  }
});

app.get('/api/v1/marketing/click', async (req, res) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const target = typeof req.query.target === 'string' ? req.query.target.trim().toLowerCase() : '';
    const href = typeof req.query.href === 'string' ? req.query.href.trim() : '';
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

    const redirectHref = resolveMarketingRedirectHref(href);
    if (!email || !target || !redirectHref || !token || !verifyMarketingClickToken(email, target, href, token)) {
      return res.status(400).send('Lien de suivi invalide.');
    }

    setImmediate(() => {
      recordMarketingClick(email, target).catch((error) => {
        console.warn('Marketing click tracking error:', error.message);
      });
    });

    return res.redirect(302, redirectHref);
  } catch (error) {
    console.error('Marketing click redirect error:', error);
    return res.status(500).send('Erreur lors de la redirection.');
  }
});

app.get('/api/v1/marketing/unsubscribe', async (req, res) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

    if (!email || !token || !verifyMarketingUnsubscribeToken(email, token)) {
      return res.status(400).send('Lien de désinscription invalide.');
    }

    const prismaClient = await getPrismaClientOrThrow('Base marketing indisponible pour la désinscription');
    const nowIso = new Date().toISOString();

    await prismaClient.$executeRawUnsafe(`
      UPDATE marketing_leads
      SET marketingoptin = FALSE,
          nurturestage = $2::text,
          nextmarketingemailat = NULL,
          unsubscribedat = $3::timestamptz,
          "updatedAt" = $3::timestamptz
      WHERE email = $1::text
    `, email, MARKETING_STAGE_DONE, nowIso);

    setImmediate(() => {
      syncMarketingContact({ email, unsubscribed: true }).catch((syncError) => {
        console.warn('Sync désinscription Resend échouée:', syncError.message);
      });
    });

    res
      .status(200)
      .type('html')
      .send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Désinscription confirmée</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;padding:48px 24px;"><main style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;"><h1 style="margin-top:0;font-size:28px;">Désinscription confirmée</h1><p>Vous ne recevrez plus les emails marketing FeedPlug liés à votre demande d’accès.</p><p style="color:#475569;">Si c’était une erreur, vous pouvez vous réinscrire depuis le site.</p></main></body></html>`);
  } catch (error) {
    console.error('Marketing unsubscribe error:', error);
    res.status(500).send('Erreur lors de la désinscription.');
  }
});

// Désinscription "one-click" RFC 8058 : la messagerie (Gmail/Yahoo) POSTe
// directement sur l'URL List-Unsubscribe. On traite et on répond 200.
app.post('/api/v1/marketing/unsubscribe', async (req, res) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

    if (!email || !token || !verifyMarketingUnsubscribeToken(email, token)) {
      return res.status(400).json({ message: 'Lien de désinscription invalide.' });
    }

    const prismaClient = await getPrismaClientOrThrow('Base marketing indisponible pour la désinscription');
    const nowIso = new Date().toISOString();
    await prismaClient.$executeRawUnsafe(`
      UPDATE marketing_leads
      SET marketingoptin = FALSE,
          nurturestage = $2::text,
          nextmarketingemailat = NULL,
          unsubscribedat = $3::timestamptz,
          "updatedAt" = $3::timestamptz
      WHERE email = $1::text
    `, email, MARKETING_STAGE_DONE, nowIso);

    setImmediate(() => {
      syncMarketingContact({ email, unsubscribed: true }).catch((syncError) => {
        console.warn('Sync désinscription Resend échouée:', syncError.message);
      });
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Marketing unsubscribe (one-click) error:', error);
    return res.status(500).json({ message: 'Erreur lors de la désinscription.' });
  }
});

app.post('/api/v1/marketing/nurture-runs', async (req, res) => {
  try {
    const schedulerSecret = typeof process.env.SCHEDULER_SECRET === 'string'
      ? process.env.SCHEDULER_SECRET.trim()
      : '';
    if (!schedulerSecret) {
      return res.status(503).json({ message: 'Scheduler non configuré' });
    }

    const authHeader = req.headers['x-scheduler-secret'] || req.headers['authorization'];
    const rawProvidedSecret = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const providedSecret = typeof rawProvidedSecret === 'string'
      ? rawProvidedSecret.replace('Bearer ', '').trim()
      : '';
    if (providedSecret !== schedulerSecret) {
      return res.status(401).json({ message: 'Non autorisé' });
    }

    const prisma = getPrisma?.();
    if (!getPrismaReady?.() || !prisma) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }

    const dueLeads = await prisma.$queryRawUnsafe(`
      SELECT *
      FROM marketing_leads
      WHERE marketingoptin = TRUE
        AND unsubscribedat IS NULL
        AND nextmarketingemailat IS NOT NULL
        AND nextmarketingemailat <= NOW()
        AND NOT EXISTS (
          SELECT 1
          FROM "User" u
          WHERE LOWER(u.email) = LOWER(marketing_leads.email)
        )
        AND nurturestage IS NOT NULL
        AND nurturestage <> $1::text
      ORDER BY nextmarketingemailat ASC
      LIMIT 100
    `, MARKETING_STAGE_DONE);

    const results = {
      checked: dueLeads.length,
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const lead of dueLeads) {
      try {
        const auditStep = auditStepFromStage(lead.nurturestage);
        if (auditStep) {
          // Lead issu d'un audit de flux → séquence post-audit (segment A/B).
          await sendAuditNurtureForLead(lead, auditStep);
        } else {
          // Lead générique (segment C) → séquence existante.
          const stage = resolveMarketingOutboundStage(lead.nurturestage);
          const resendContactId = await registerLeadInResend(lead);
          if (resendContactId) {
            await markLeadMarketingProgress(lead.id, { resendContactId });
          }
          await sendLeadNurtureStage(lead, stage);
        }
        results.sent += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push({
          leadId: lead.id,
          email: lead.email,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error) {
    console.error('Marketing nurture run error:', error);
    res.status(500).json({ message: 'Erreur lors de l’exécution du nurture marketing' });
  }
});

// Envoi de test des mails post-audit (revue interne avant lancement).
// Protégé par SCHEDULER_SECRET. Envoie A1, A2, B1→B4 avec des données d'exemple.
app.post('/api/v1/marketing/nurture-test', async (req, res) => {
  try {
    const schedulerSecret = typeof process.env.SCHEDULER_SECRET === 'string'
      ? process.env.SCHEDULER_SECRET.trim()
      : '';
    if (!schedulerSecret) {
      return res.status(503).json({ message: 'Scheduler non configuré' });
    }
    const authHeader = req.headers['x-scheduler-secret'] || req.headers['authorization'];
    const rawProvidedSecret = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const providedSecret = typeof rawProvidedSecret === 'string'
      ? rawProvidedSecret.replace('Bearer ', '').trim()
      : '';
    if (providedSecret !== schedulerSecret) {
      return res.status(401).json({ message: 'Non autorisé' });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ message: 'Email valide requis' });
    }
    const locale = getEmailLocale(typeof req.body?.locale === 'string' ? req.body.locale.trim() : 'fr');

    const sampleIssues = [
      { key: 'identifier', affectedProducts: 142, affectedRate: 34, severity: 'high' },
      { key: 'description', affectedProducts: 98, affectedRate: 23, severity: 'medium' },
      { key: 'image', affectedProducts: 61, affectedRate: 15, severity: 'medium' },
    ];
    const publicBaseUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');
    const context = {
      prenom: 'Victor',
      societe: 'Agence Inconnu',
      score: 58,
      scorePotentiel: 86,
      blocage1: formatAuditBlocage(sampleIssues[0], locale),
      blocage2: formatAuditBlocage(sampleIssues[1], locale),
      blocage3: formatAuditBlocage(sampleIssues[2], locale),
      issuesList: buildAuditIssuesList(sampleIssues, locale),
      produitsRecuperables: 120,
      gainVisibilite: 28,
      cms: 'Shopify',
      lienAudit: `${publicBaseUrl}/${locale}/audit-flux/exemple-token-demo`,
      lienAuditPdf: `${(process.env.API_URL || 'https://api.feedplug.com').replace(/\/$/, '')}/api/v1/marketing/audits/exemple-token-demo/pdf`,
      lienRdv: process.env.MARKETING_RDV_URL || 'https://calendly.com/victorsoldet/30min',
    };

    const plan = [
      { segment: 'A', step: 1 },
      { segment: 'A', step: 2 },
      { segment: 'B', step: 1 },
      { segment: 'B', step: 2 },
      { segment: 'B', step: 3 },
      { segment: 'B', step: 4 },
    ];
    const sent = [];
    const errors = [];
    for (const item of plan) {
      try {
        await sendMarketingAuditNurtureEmail({ email, locale, segment: item.segment, step: item.step, context });
        sent.push(`${item.segment}${item.step}`);
      } catch (sendError) {
        errors.push({ mail: `${item.segment}${item.step}`, error: sendError.message });
      }
    }

    res.json({ success: errors.length === 0, email, locale, sent, errors });
  } catch (error) {
    console.error('Marketing nurture test error:', error);
    res.status(500).json({ message: 'Erreur lors de l’envoi de test' });
  }
});

// Idées de fonctionnalités (page Roadmap)
app.post('/api/v1/marketing/feature-idea', marketingFeatureIdeaLimiter, async (req, res) => {
  try {
    const { email, name, idea } = req.body;

    if (!email || !idea || typeof idea !== 'string') {
      return res.status(400).json({
        message: 'Merci de renseigner votre email et votre idée.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ message: 'Email invalide.' });
    }

    const ideaTrimmed = idea.trim();
    if (ideaTrimmed.length < 10) {
      return res.status(400).json({
        message: 'Décrivez votre idée en au moins quelques mots (10 caractères minimum).',
      });
    }

    const prismaClient = await requirePrismaForRequest(res, 'Service roadmap temporairement indisponible');
    if (!prismaClient) return;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const emailNormalized = email.toLowerCase().trim();

    await prismaClient.$executeRawUnsafe(`
      INSERT INTO feature_ideas (id, email, name, idea, "createdAt")
      VALUES ($1::text, $2::text, $3::text, $4::text, $5::timestamptz)
    `, id, emailNormalized, (name && name.trim()) || null, ideaTrimmed, now);

    // PII: pas d'email en clair dans les logs ; l'id permet de retrouver l'auteur si besoin.
    console.log(`💡 Nouvelle idée feature — id: ${id} — ${ideaTrimmed.slice(0, 50)}…`);

    setImmediate(async () => {
      try {
        const [firstName, ...rest] = String(name || '').trim().split(/\s+/).filter(Boolean);
        await notifyInternalMarketingFormSubmission({
          kind: 'feature_idea',
          source: 'roadmap',
          email: emailNormalized,
          firstName: firstName || null,
          lastName: rest.length > 0 ? rest.join(' ') : null,
          idea: ideaTrimmed,
          createdAt: now,
        });
      } catch (alertError) {
        console.warn('Alerte interne idee produit non envoyee:', alertError.message);
      }
    });

    res.status(201).json({
      message: 'Merci ! Votre idée a bien été enregistrée.',
      success: true,
    });
  } catch (error) {
    console.error('Feature idea error:', error);
    res.status(500).json({ message: "Erreur lors de l'envoi. Réessayez plus tard." });
  }
});

// Récupérer les idées feature (protégé - OWNER uniquement, rôle depuis JWT)
app.get('/api/v1/marketing/feature-ideas', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    const prismaClient = await requirePrismaForRequest(res, 'Service roadmap temporairement indisponible');
    if (!prismaClient) return;

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    const [ideasResult, totalResult] = await Promise.all([
      prismaClient.$queryRawUnsafe(`
        SELECT * FROM feature_ideas
        ORDER BY "createdAt" DESC
        LIMIT $1::int OFFSET $2::int
      `, limit, skip),
      prismaClient.$queryRawUnsafe(`SELECT COUNT(*) as count FROM feature_ideas`)
    ]);

    const total = parseInt(totalResult[0].count);
    const ideas = ideasResult || [];

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      ideas: ideas.map((idea) => ({
        id: idea.id,
        email: idea.email,
        name: idea.name,
        idea: idea.idea,
        createdAt: idea.createdAt ? (idea.createdAt.toISOString ? idea.createdAt.toISOString() : idea.createdAt) : new Date().toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching feature ideas:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des idées' });
  }
});

// Endpoint pour récupérer les leads - RÉSERVÉ STAFF FEEDPLUG (données prospect internes)
app.get('/api/v1/marketing/leads', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    const prismaClient = await requirePrismaForRequest(res, 'Service marketing temporairement indisponible');
    if (!prismaClient) return;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [leadsResult, totalResult] = await Promise.all([
      prismaClient.$queryRawUnsafe(`
        SELECT * FROM marketing_leads
        ORDER BY "createdAt" DESC
        LIMIT $1::int OFFSET $2::int
      `, limit, skip),
      prismaClient.$queryRawUnsafe(`SELECT COUNT(*) as count FROM marketing_leads`)
    ]);

    const total = parseInt(totalResult[0].count);
    const leads = leadsResult || [];

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      leads: leads.map((lead) => serializeMarketingLead(lead)),
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des leads' });
  }
});

// Mise à jour d'un lead (statut, notes) — RÉSERVÉ STAFF FEEDPLUG
app.put('/api/v1/marketing/leads/:id', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    const prismaClient = await requirePrismaForRequest(res, 'Service marketing temporairement indisponible');
    if (!prismaClient) return;

    const { id } = req.params;
    const { status, notes } = req.body || {};
    const updates = {};
    if (status !== undefined) updates.status = String(status).trim();
    if (notes !== undefined) updates.notes = notes === null ? null : String(notes);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Données à mettre à jour requises (status et/ou notes)' });
    }

    const parts = [];
    const args = [id];
    let pos = 2;
    if (updates.status !== undefined) {
      parts.push(`"status" = $${pos}::text`);
      args.push(updates.status);
      pos++;
    }
    if (updates.notes !== undefined) {
      parts.push(`"notes" = $${pos}::text`);
      args.push(updates.notes);
      pos++;
    }
    parts.push(`"updatedAt" = $${pos}::timestamptz`);
    args.push(new Date().toISOString());
    const sql = `UPDATE marketing_leads SET ${parts.join(', ')} WHERE id = $1::text`;
    const result = await prismaClient.$executeRawUnsafe(sql, ...args);
    if (result === 0) {
      return res.status(404).json({ message: 'Lead introuvable' });
    }

    const refreshed = await prismaClient.$queryRawUnsafe(`
      SELECT * FROM marketing_leads WHERE id = $1::text LIMIT 1
    `, id);
    return res.json({ success: true, lead: refreshed?.[0] ? serializeMarketingLead(refreshed[0]) : null });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du lead' });
  }
});

app.post('/api/v1/marketing/leads/:id/send-nurture', authenticateToken, requireStaffAccess, async (req, res) => {
  try {
    const prismaClient = await requirePrismaForRequest(res, 'Service marketing temporairement indisponible');
    if (!prismaClient) return;

    const { id } = req.params;
    const requestedStage = typeof req.body?.stage === 'string' ? req.body.stage.trim().toLowerCase() : '';
    const allowedRequestedStages = new Set(['j0', 'j1', 'j3', 'j6', 'j10']);
    const requestedStageByStatus = allowedRequestedStages.has(requestedStage) ? requestedStage : 'j0';

    const rows = await prismaClient.$queryRawUnsafe(`
      SELECT * FROM marketing_leads WHERE id = $1::text LIMIT 1
    `, id);
    const lead = rows?.[0] || null;

    if (!lead) {
      return res.status(404).json({ message: 'Lead introuvable' });
    }

    const normalizedLead = serializeMarketingLead(lead);
    if (normalizedLead.marketingOptIn === false || normalizedLead.unsubscribedAt) {
      return res.status(409).json({ message: 'Ce lead est desinscrit des relances marketing.' });
    }

    const stage = requestedStage
      ? requestedStageByStatus
      : resolveMarketingOutboundStage(normalizedLead.nurtureStage);

    const resendContactId = await registerLeadInResend(normalizedLead);
    if (resendContactId) {
      await markLeadMarketingProgress(normalizedLead.id, { resendContactId });
    }

    await sendLeadNurtureStage(normalizedLead, stage);

    const refreshed = await prismaClient.$queryRawUnsafe(`
      SELECT * FROM marketing_leads WHERE id = $1::text LIMIT 1
    `, id);

    return res.json({
      success: true,
      message: `Email ${stage.toUpperCase()} envoye.`,
      lead: refreshed?.[0] ? serializeMarketingLead(refreshed[0]) : null,
    });
  } catch (error) {
    console.error('Error sending nurture email:', error);
    res.status(500).json({ message: 'Erreur lors de l’envoi de l’email marketing' });
  }
});
}

module.exports = { registerMarketingRoutes };

/**
 * Routes du domaine "account" singulier (3 routes /api/v1/account/*) :
 * capacités/limites du plan (affichage front), lecture et mise à jour des
 * informations société (raison sociale, téléphone E.164, email de facturation).
 *
 * NB : distinct de routes/accounts.js (pluriel, /api/v1/accounts/*). Ces 3 routes
 * singulières n'ont aucun doublon ailleurs.
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handlers copiés À L'IDENTIQUE. Seul ajout en
 * tête des handlers utilisant Prisma :
 * `const prisma = getPrisma(); const prismaReady = getPrismaReady();`. Les
 * dépendances du scope de run() sont injectées via `deps` ; leurs définitions
 * RESTENT dans server-minimal.js. AUCUN changement de comportement.
 */
function registerAccountSettingsRoutes(app, {
  getPrisma,
  getPrismaReady,
  authenticateToken,
  countChannelsForAccount,
  countProductsForAccount,
  ensureCompanyInfoSchema,
  getAccountAddonIA,
  getAccountMaxChannels,
  getAccountPlan,
  getPlanCapabilitiesForApi,
  requirePrismaForRequest,
}) {
app.get('/api/v1/account/capabilities', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) {
      return res.status(403).json({ message: 'Compte non associé' });
    }
    const [plan, addonIA, maxChannelsFromAccount, sourcesRows, feedsRows, productCount, channelsCount] = await Promise.all([
      getAccountPlan(prisma, accountId),
      getAccountAddonIA(prisma, accountId),
      getAccountMaxChannels(prisma, accountId),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "FeedSource" WHERE accountid = $1::text`, accountId),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Feed" WHERE accountid = $1::text`, accountId),
      countProductsForAccount(prisma, accountId),
      countChannelsForAccount(prisma, accountId),
    ]);
    const usage = {
      sourcesCount: sourcesRows?.[0]?.c ?? 0,
      feedsCount: feedsRows?.[0]?.c ?? 0,
      productsCount: productCount,
      channelsCount,
    };
    res.json({
      ...getPlanCapabilitiesForApi(plan, addonIA, maxChannelsFromAccount),
      usage,
    });
  } catch (e) {
    console.error('GET /account/capabilities error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

// Infos entreprise / facturation (prospection, obligatoire pour tous les comptes)
app.get('/api/v1/account/company-info', authenticateToken, async (req, res) => {
  const emptyCompanyInfo = {
    companyName: null,
    phoneE164: null,
    billingEmail: null,
    hasCompletedCompanyInfo: false,
    vatNumber: null,
    siren: null,
    billingAddress: null,
  };
  try {
    const prismaClient = await requirePrismaForRequest(res, 'Service non disponible');
    if (!prismaClient) return;
    await ensureCompanyInfoSchema();

    const accountId = req.user.accountId || req.accountId;
    if (!accountId) return res.status(403).json({ message: 'Compte non associé' });

    const rows = await prismaClient.$queryRawUnsafe(`
      SELECT companyname, phonee164, billingemail FROM "Account" WHERE id = $1::text LIMIT 1
    `, accountId);
    const accountRow = rows?.[0] || {};
    const companyName = accountRow.companyname ?? null;
    const phoneE164 = accountRow.phonee164 ?? null;
    const billingEmail = accountRow.billingemail ?? null;

    let data = {};
    try {
      const progressRows = await prismaClient.$queryRawUnsafe(`
        SELECT collecteddata FROM "OnboardingProgress" WHERE accountid = $1::text LIMIT 1
      `, accountId);
      const collected = progressRows?.[0]?.collecteddata;
      data = typeof collected === 'object' && collected !== null ? collected : (collected ? JSON.parse(collected) : {});
    } catch (_) {
      data = {};
    }

    const vatNum = data.vatNumber ?? null;
    const sirenVal = data.siren ?? null;
    const billingAddress =
      data.billingAddress && typeof data.billingAddress === 'object'
        ? data.billingAddress
        : null;
    const hasCompletedCompanyInfo = !!(companyName && phoneE164 && billingEmail && vatNum && sirenVal && String(sirenVal).length === 9);

    res.json({
      ...emptyCompanyInfo,
      companyName,
      phoneE164,
      billingEmail,
      hasCompletedCompanyInfo,
      vatNumber: vatNum,
      siren: sirenVal,
      billingAddress,
    });
  } catch (e) {
    console.error('GET /account/company-info error:', e);
    res.status(500).json({ message: e?.message || 'Erreur' });
  }
});

// Consentement comparateur CSS : le client choisit de diffuser (ou non) ses produits
// dans le comparateur public. Opt-in strict (défaut false) — rien sans accord.
app.get('/api/v1/account/comparator-optin', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) return res.status(403).json({ message: 'Compte non associé' });
    const rows = await prisma.$queryRawUnsafe(`SELECT comparatoroptin FROM "Account" WHERE id = $1::text LIMIT 1`, accountId);
    res.json({ optedIn: rows?.[0]?.comparatoroptin === true });
  } catch (e) {
    console.error('comparator-optin get error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

app.put('/api/v1/account/comparator-optin', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) return res.status(403).json({ message: 'Compte non associé' });
    const optedIn = (req.body && req.body.optedIn) === true;
    await prisma.$executeRawUnsafe(`UPDATE "Account" SET comparatoroptin = $1::boolean, updatedat = NOW() WHERE id = $2::text`, optedIn, accountId);
    res.json({ optedIn });
  } catch (e) {
    console.error('comparator-optin put error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});

app.put('/api/v1/account/company-info', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.status(503).json({ message: 'Service non disponible' });
    await ensureCompanyInfoSchema();
    const accountId = req.user.accountId || req.accountId;
    if (!accountId) return res.status(403).json({ message: 'Compte non associé' });
    const body = req.body || {};
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : null;
    if (!companyName) {
      return res.status(400).json({ message: 'Le nom de l\'entreprise est requis.' });
    }
    // Activation : seul le nom de l'entreprise est requis à l'onboarding.
    // Téléphone, TVA, SIREN et adresse sont optionnels ici — les informations
    // de facturation complètes sont collectées au moment du checkout.
    const phoneE164 = typeof body.phoneE164 === 'string' ? body.phoneE164.trim() || null : null;
    const billingEmail = typeof body.billingEmail === 'string' ? body.billingEmail.trim() || null : null;
    const vatNumber = typeof body.vatNumber === 'string' ? body.vatNumber.trim() || null : null;
    const siren = typeof body.siren === 'string' ? body.siren.trim().replace(/\s/g, '') || null : null;
    if (siren && siren.length !== 9) {
      return res.status(400).json({ message: 'Le SIREN doit comporter 9 chiffres.' });
    }
    const addressLine1 = typeof body.addressLine1 === 'string' ? body.addressLine1.trim() || null : null;
    const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() || null : null;
    const city = typeof body.city === 'string' ? body.city.trim() || null : null;
    const country = typeof body.country === 'string' ? body.country.trim() || 'FR' : 'FR';
    await prisma.$executeRawUnsafe(`
      UPDATE "Account" SET companyname = $1::text, phonee164 = $2::text, billingemail = $3::text, updatedat = NOW()
      WHERE id = $4::text
    `, companyName, phoneE164, billingEmail, accountId);
    const billingAddress = {
      addressLine1: addressLine1,
      addressLine2: typeof body.addressLine2 === 'string' ? body.addressLine2.trim() || null : null,
      postalCode,
      city,
      country,
    };
    const existingProgressRows = await prisma.$queryRawUnsafe(`
      SELECT currentstep, completedsteps, collecteddata
      FROM "OnboardingProgress"
      WHERE accountid = $1::text
      LIMIT 1
    `, accountId);
    const existingProgress = existingProgressRows?.[0] || null;
    let completedSteps = [];
    try {
      completedSteps = Array.isArray(existingProgress?.completedsteps)
        ? existingProgress.completedsteps
        : (existingProgress?.completedsteps ? JSON.parse(existingProgress.completedsteps) : []);
    } catch {
      completedSteps = [];
    }
    if (!completedSteps.includes('company_info')) completedSteps.push('company_info');
    let existingCollectedData = {};
    try {
      existingCollectedData =
        existingProgress?.collecteddata && typeof existingProgress.collecteddata === 'object'
          ? existingProgress.collecteddata
          : (existingProgress?.collecteddata ? JSON.parse(existingProgress.collecteddata) : {});
    } catch {
      existingCollectedData = {};
    }
    const extraData = {
      ...existingCollectedData,
      billingAddress,
      vatNumber,
      siren,
      companyInfoCompletedAt: new Date().toISOString(),
    };
    await prisma.$executeRawUnsafe(`
      INSERT INTO "OnboardingProgress" (id, accountid, currentstep, completedsteps, collecteddata, updatedat)
      VALUES (gen_random_uuid()::text, $1::text, 'welcome', '[]'::jsonb, $2::jsonb, NOW())
      ON CONFLICT (accountid) DO UPDATE SET
        currentstep = COALESCE("OnboardingProgress".currentstep, 'welcome'),
        completedsteps = $3::jsonb,
        collecteddata = COALESCE("OnboardingProgress".collecteddata, '{}'::jsonb) || EXCLUDED.collecteddata,
        updatedat = NOW()
    `, accountId, JSON.stringify(extraData), JSON.stringify(completedSteps));
    res.json({ companyName, phoneE164, billingEmail });
  } catch (e) {
    console.error('PUT /account/company-info error:', e);
    res.status(500).json({ message: 'Erreur' });
  }
});
}

module.exports = { registerAccountSettingsRoutes };

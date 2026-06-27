/**
 * Routes du domaine "billing Shopify" (4 routes /api/v1/billing/shopify/*) :
 * Managed Pricing — création de l'URL d'abonnement (subscribe), retour post-approbation
 * (return), lecture de l'abonnement courant (current) et annulation (cancel).
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handlers copiés À L'IDENTIQUE. Seul ajout en tête
 * des handlers utilisant Prisma : `const prisma = getPrisma(); const prismaReady = getPrismaReady();`.
 * Le helper partagé findShopifyCredentialForAccount et les modules shopifyBilling /
 * shopifyManagedPricing restent dans server-minimal.js et sont injectés via `deps`.
 * AUCUN changement de comportement.
 */
function registerShopifyBillingRoutes(app, {
  getPrisma,
  getPrismaReady,
  APP_URL,
  SHOPIFY_API_KEY,
  authenticateJwtOrShopifySession,
  findShopifyCredentialForAccount,
  shopifyBilling,
  shopifyManagedPricing,
}) {
app.post('/api/v1/billing/shopify/subscribe', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const accountId = req.user.accountId;
    // `plan` est OPTIONNEL : Managed Pricing redirige de toute façon vers la
    // page de sélection Shopify (pas de deep-link plan possible). On accepte
    //  - sans plan : on ouvre juste la page de sélection (choix + approbation
    //    en une seule fois côté Shopify) — pas de trace PENDING.
    //  - avec plan : on valide le handle et on trace l'intention en DB.
    const planHandleRaw = String(req.body?.plan || '').trim().toLowerCase();
    const plan = planHandleRaw ? shopifyManagedPricing.getPlan(planHandleRaw) : null;
    if (planHandleRaw && !plan) {
      return res.status(400).json({
        message: 'Plan inconnu. Valeurs valides : starter, pro, business, premium.',
      });
    }

    const credential = await findShopifyCredentialForAccount(accountId);
    if (!credential) {
      return res.status(409).json({
        message: 'Boutique Shopify non connectée.',
      });
    }

    const confirmationUrl = shopifyManagedPricing.buildManagedPricingUrl({
      shop: credential.shop,
      planHandle: plan ? plan.handle : undefined,
    });

    // Trace la tentative en DB (status PENDING) uniquement si un plan précis a
    // été cliqué. Le subscription_id réel est attribué par Shopify lors de
    // l'approbation et nous arrive via webhook app_subscriptions/update.
    if (plan) {
      await shopifyBilling.upsertShopifySubscription({
        prisma,
        row: {
          accountId,
          shopDomain: credential.shop,
          shopifySubscriptionId: `pending_${accountId}_${plan.handle}_${Date.now()}`,
          planKey: plan.handle.toUpperCase(),
          priceAmount: plan.priceEur,
          currency: 'EUR',
          interval: 'EVERY_30_DAYS',
          status: 'PENDING',
          trialDays: plan.trialDays || 0,
          confirmationUrl,
          returnUrl: null,
          testMode: process.env.NODE_ENV !== 'production',
        },
      });
    }

    return res.json({
      confirmationUrl,
      plan: plan ? plan.handle : null,
      priceEur: plan ? plan.priceEur : null,
    });
  } catch (err) {
    console.error('Shopify managed pricing subscribe error:', err);
    return res.status(500).json({ message: 'Erreur création abonnement Shopify', detail: err?.message });
  }
});

// GET /return — appelé par Shopify après que le merchant approuve l'abonnement
// Met à jour le status localement, puis redirige vers l'app embedded.
app.get('/api/v1/billing/shopify/return', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).send('Service indisponible');
    }
    const accountId = String(req.query.account || '').trim();
    if (!accountId) {
      return res.status(400).send('account manquant');
    }

    const subRow = await shopifyBilling.findActiveSubscriptionForAccount({ prisma, accountId });
    if (!subRow) {
      return res.status(404).send('Aucune subscription en attente');
    }

    const credential = await findShopifyCredentialForAccount(accountId);
    if (credential) {
      try {
        const fresh = await shopifyBilling.getAppSubscription({
          shop: credential.shop,
          accessToken: credential.accessToken,
          subscriptionId: subRow.shopify_subscription_id,
        });
        if (fresh?.status) {
          await shopifyBilling.markShopifySubscriptionStatus({
            prisma,
            shopifySubscriptionId: subRow.shopify_subscription_id,
            status: fresh.status,
            currentPeriodEnd: fresh.currentPeriodEnd,
          });
          if (fresh.status === 'ACTIVE') {
            await prisma.$executeRawUnsafe(
              `
                UPDATE "Account"
                SET plan = $2::text,
                    billing_provider = 'SHOPIFY'::text,
                    billingstatus = 'active'::text,
                    paymentgraceuntil = NULL,
                    updatedat = NOW()
                WHERE id = $1::text
              `,
              accountId,
              subRow.plan_key
            );
          }
        }
      } catch (verifyErr) {
        console.warn('Shopify billing return verify failed:', verifyErr?.message);
      }
    }

    const shopForRedirect = subRow.shop_domain;
    if (SHOPIFY_API_KEY && shopForRedirect) {
      return res.redirect(302, `https://${shopForRedirect}/admin/apps/${encodeURIComponent(SHOPIFY_API_KEY)}?billing=ok`);
    }
    return res.redirect(302, `${APP_URL}/fr/facturation?shopify=connected`);
  } catch (err) {
    console.error('Shopify billing return error:', err);
    return res.status(500).send('Erreur traitement retour Shopify Billing');
  }
});

// POST /cancel — annule la subscription Shopify active du compte
// GET /current — état de la subscription Shopify active du compte
app.get('/api/v1/billing/shopify/current', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const sub = await shopifyBilling.findActiveSubscriptionForAccount({
      prisma,
      accountId: req.user.accountId,
    });
    if (!sub) {
      return res.json({ active: false });
    }
    return res.json({
      active: sub.status === 'ACTIVE' || sub.status === 'PENDING',
      subscriptionId: sub.shopify_subscription_id,
      planKey: sub.plan_key,
      priceAmount: Number(sub.price_amount),
      currency: sub.currency,
      interval: sub.interval,
      status: sub.status,
      trialEndsAt: sub.trial_ends_at,
      currentPeriodEnd: sub.current_period_end,
      testMode: sub.test_mode === true,
    });
  } catch (err) {
    console.error('Shopify billing current error:', err);
    return res.status(500).json({ message: 'Erreur récupération abonnement', detail: err?.message });
  }
});

app.post('/api/v1/billing/shopify/cancel', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const accountId = req.user.accountId;
    const subRow = await shopifyBilling.findActiveSubscriptionForAccount({ prisma, accountId });
    if (!subRow) {
      return res.status(404).json({ message: 'Aucune subscription Shopify active' });
    }
    const credential = await findShopifyCredentialForAccount(accountId);
    const subId = subRow.shopify_subscription_id || '';
    const isPendingPlaceholder = subId.startsWith('pending_');

    // Cas 1 : sub PENDING (placeholder, jamais approuvée) ou pas de credential valide
    //         → on annule juste localement, pas de call Shopify (qui échouerait
    //         de toutes façons : pas de subscription Shopify à annuler).
    // Cas 2 : sub ACTIVE avec credential valide → on call Shopify pour annuler.
    if (!isPendingPlaceholder && credential) {
      try {
        await shopifyBilling.cancelAppSubscription({
          shop: credential.shop,
          accessToken: credential.accessToken,
          subscriptionId: subId,
          prorate: Boolean(req.body?.prorate),
        });
      } catch (cancelErr) {
        // Si le token est invalide (merchant a désinstallé puis revenu) ou la
        // sub n'existe plus côté Shopify, on tombe quand même en CANCELLED
        // localement plutôt que de bloquer le merchant.
        console.warn('Shopify cancel API failed, marking cancelled locally only:', cancelErr?.message || cancelErr);
      }
    }

    await shopifyBilling.markShopifySubscriptionStatus({
      prisma,
      shopifySubscriptionId: subId,
      status: 'CANCELLED',
      cancelled: true,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Shopify billing cancel error:', err);
    return res.status(500).json({ message: 'Erreur annulation', detail: err?.message });
  }
});
}

module.exports = { registerShopifyBillingRoutes };

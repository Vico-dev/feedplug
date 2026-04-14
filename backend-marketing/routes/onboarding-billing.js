/**
 * Routes Onboarding, Billing B2B et Stripe
 * Supporte : 3 plans fixes (legacy) OU configurateur (productTier × channelCount + addon IA).
 */
const express = require('express');
const Stripe = require('stripe');
const { getPriceFromConfigurator, getPlanIdFromTier, PRODUCT_TIERS, CHANNEL_OPTIONS, ADDON_IA_PRICE_EUR, PRICING_GRID_EUR } = require('../lib/pricing-grid');
const SEPA_GRACE_DAYS = 10;

const PLANS = {
  STARTER: {
    name: 'Starter',
    price: 49,
    priceId: process.env.STRIPE_PRICE_STARTER || '',
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: 149,
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL || '',
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 399,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
  },
};

function registerOnboardingBillingRoutes(app, { getPrisma, getPrismaReady, authenticateToken }) {
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.feedplug.com';

  // GET onboarding progress
  app.get('/api/v1/onboarding/progress', authenticateToken, async (req, res) => {
    try {
      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) return res.status(503).json({ message: 'Service non disponible' });
      const accountId = req.user.accountId;
      const progress = await prisma.$queryRawUnsafe(`
        SELECT * FROM "OnboardingProgress" WHERE accountid = $1 LIMIT 1
      `, accountId);
      if (!progress || progress.length === 0) {
        return res.json({
          currentStep: 'welcome',
          completedSteps: [],
          collectedData: {},
        });
      }
      const p = progress[0];
      return res.json({
        currentStep: p.currentstep || 'welcome',
        completedSteps: Array.isArray(p.completedsteps) ? p.completedsteps : (p.completedsteps ? JSON.parse(p.completedsteps) : []),
        collectedData: typeof p.collecteddata === 'object' ? p.collecteddata : (p.collecteddata ? JSON.parse(p.collecteddata) : {}),
      });
    } catch (e) {
      console.error('Onboarding progress error:', e);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // PUT onboarding progress
  app.put('/api/v1/onboarding/progress', authenticateToken, async (req, res) => {
    try {
      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) return res.status(503).json({ message: 'Service non disponible' });
      const accountId = req.user.accountId;
      const { currentStep, completedSteps, collectedData } = req.body;
      const dataStr = JSON.stringify(collectedData || {});
      const stepsStr = JSON.stringify(completedSteps || []);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "OnboardingProgress" (id, accountid, currentstep, completedsteps, collecteddata, updatedat)
        VALUES (gen_random_uuid()::text, $1, $2, $3::jsonb, $4::jsonb, NOW())
        ON CONFLICT (accountid) DO UPDATE SET
          currentstep = EXCLUDED.currentstep,
          completedsteps = EXCLUDED.completedsteps,
          collecteddata = COALESCE("OnboardingProgress".collecteddata, '{}'::jsonb) || EXCLUDED.collecteddata::jsonb,
          updatedat = NOW()
      `, accountId, currentStep || 'welcome', stepsStr, dataStr);
      res.json({ success: true });
    } catch (e) {
      console.error('Onboarding progress update error:', e);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // GET plans (liste des plans fixes — legacy)
  app.get('/api/v1/billing/plans', authenticateToken, (req, res) => {
    res.json(Object.entries(PLANS).map(([key, p]) => ({
      id: key,
      name: p.name,
      price: p.price,
      priceId: p.priceId ? 'configured' : null,
    })));
  });

  // GET configurateur (grille Produits × Canaux + addon IA — pour la page choose-plan)
  app.get('/api/v1/billing/configurator', authenticateToken, (req, res) => {
    res.json({
      productTiers: PRODUCT_TIERS,
      channelOptions: CHANNEL_OPTIONS,
      addonIAPriceEur: ADDON_IA_PRICE_EUR,
      pricingGridEur: PRICING_GRID_EUR,
    });
  });

  // GET billing (infos facturation)
  app.get('/api/v1/billing', authenticateToken, async (req, res) => {
    try {
      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) return res.status(503).json({ message: 'Service non disponible' });
      const accountId = req.user.accountId;
      const billing = await prisma.$queryRawUnsafe(`
        SELECT * FROM "Billing" WHERE accountid = $1 LIMIT 1
      `, accountId);
      if (!billing || billing.length === 0) return res.json(null);
      const b = billing[0];
      return res.json({
        companyName: b.companyname,
        siret: b.siret,
        siren: b.siren,
        vatNumber: b.vatnumber,
        addressLine1: b.addressline1,
        addressLine2: b.addressline2,
        postalCode: b.postalcode,
        city: b.city,
        country: b.country,
        billingEmail: b.billingemail,
      });
    } catch (e) {
      console.error('Billing get error:', e);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // GET billing summary (profil + abonnement + dernières factures Stripe)
  app.get('/api/v1/billing/summary', authenticateToken, async (req, res) => {
    try {
      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) return res.status(503).json({ message: 'Service non disponible' });

      function toIsoDate(dateValue) {
        if (!dateValue) return null;
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
      }

      function formatMoney(amountCents, currency) {
        if (amountCents == null) return 'montant inconnu';
        try {
          return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: String(currency || 'EUR').toUpperCase(),
          }).format(amountCents / 100);
        } catch {
          return `${amountCents / 100} ${String(currency || 'EUR').toUpperCase()}`;
        }
      }

      function formatDateLabel(dateValue) {
        if (!dateValue) return 'date inconnue';
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (Number.isNaN(date.getTime())) return 'date inconnue';
        return date.toLocaleDateString('fr-FR');
      }

      const accountId = req.user.accountId;
      const billingRows = await prisma.$queryRawUnsafe(`
        SELECT * FROM "Billing" WHERE accountid = $1 LIMIT 1
      `, accountId);
      const billing = billingRows?.[0] || null;
      let accountBillingState = {
        billingStatus: null,
        trialEndsAt: null,
        paymentGraceUntil: null,
      };

      try {
        const accountRows = await prisma.$queryRawUnsafe(
          `SELECT trialendsat, billingstatus, paymentgraceuntil FROM "Account" WHERE id = $1::text LIMIT 1`,
          accountId
        );
        const account = accountRows?.[0] || null;
        accountBillingState = {
          billingStatus: account?.billingstatus || null,
          trialEndsAt: toIsoDate(account?.trialendsat),
          paymentGraceUntil: toIsoDate(account?.paymentgraceuntil),
        };
      } catch (e) {
        if (!e?.message || !/billingstatus|paymentgraceuntil|42703/i.test(e.message)) {
          console.error('Billing summary account state error:', e);
        }
      }

      const baseSummary = {
        stripeConfigured: !!stripe,
        portalAvailable: !!(stripe && billing?.stripe_customer_id),
        accountBillingState,
        billing: billing ? {
          companyName: billing.companyname || null,
          siret: billing.siret || null,
          siren: billing.siren || null,
          vatNumber: billing.vatnumber || null,
          addressLine1: billing.addressline1 || null,
          addressLine2: billing.addressline2 || null,
          postalCode: billing.postalcode || null,
          city: billing.city || null,
          country: billing.country || null,
          billingEmail: billing.billingemail || null,
        } : null,
        subscription: null,
        invoices: [],
        upcomingInvoice: null,
        events: [],
      };

      if (!billing || !stripe || !billing.stripe_customer_id) {
        return res.json(baseSummary);
      }

      let subscription = null;
      if (billing.stripe_subscription_id) {
        try {
          subscription = await stripe.subscriptions.retrieve(
            billing.stripe_subscription_id,
            { expand: ['default_payment_method'] }
          );
        } catch (e) {
          console.error('Billing summary subscription retrieve error:', e);
        }
      }

      if (!subscription) {
        try {
          const subscriptions = await stripe.subscriptions.list({
            customer: billing.stripe_customer_id,
            status: 'all',
            limit: 5,
          });
          subscription =
            subscriptions.data.find((item) => !['canceled', 'cancelled', 'incomplete_expired'].includes(String(item.status || '').toLowerCase()))
            || subscriptions.data[0]
            || null;
        } catch (e) {
          console.error('Billing summary subscription list error:', e);
        }
      }

      let invoices = [];
      try {
        const invoiceList = await stripe.invoices.list({
          customer: billing.stripe_customer_id,
          limit: 6,
        });
        invoices = invoiceList.data.map((invoice) => ({
          id: invoice.id,
          number: invoice.number || null,
          status: invoice.status || null,
          currency: invoice.currency || null,
          amountDueCents: typeof invoice.amount_due === 'number' ? invoice.amount_due : null,
          amountPaidCents: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : null,
          createdAt: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
          paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
          hostedInvoiceUrl: invoice.hosted_invoice_url || null,
          invoicePdf: invoice.invoice_pdf || null,
        }));
      } catch (e) {
        console.error('Billing summary invoice list error:', e);
      }

      let upcomingInvoice = null;
      if (subscription?.id) {
        try {
          const stripeUpcomingInvoice = await stripe.invoices.retrieveUpcoming({
            customer: billing.stripe_customer_id,
            subscription: subscription.id,
          });
          upcomingInvoice = {
            currency: stripeUpcomingInvoice.currency || null,
            amountDueCents: typeof stripeUpcomingInvoice.amount_due === 'number' ? stripeUpcomingInvoice.amount_due : null,
            dueDate: toIsoDate(
              stripeUpcomingInvoice.due_date
                ? new Date(stripeUpcomingInvoice.due_date * 1000)
                : stripeUpcomingInvoice.period_end
                  ? new Date(stripeUpcomingInvoice.period_end * 1000)
                  : null
            ),
            periodStart: toIsoDate(stripeUpcomingInvoice.period_start ? new Date(stripeUpcomingInvoice.period_start * 1000) : null),
            periodEnd: toIsoDate(stripeUpcomingInvoice.period_end ? new Date(stripeUpcomingInvoice.period_end * 1000) : null),
          };
        } catch (e) {
          if (!e?.message || !/upcoming|invoice|none/i.test(e.message)) {
            console.error('Billing summary upcoming invoice error:', e);
          }
        }
      }

      const primaryItem = subscription?.items?.data?.[0] || null;
      const price = primaryItem?.price || null;
      const defaultPaymentMethod =
        subscription?.default_payment_method && typeof subscription.default_payment_method === 'object'
          ? subscription.default_payment_method
          : null;
      const latestInvoice = invoices[0] || null;
      const events = [
        subscription?.current_period_start ? {
          id: 'subscription-start',
          date: toIsoDate(new Date(subscription.current_period_start * 1000)),
          title: 'Abonnement en cours',
          description: `${String(subscription.status || 'inconnu')} depuis le ${formatDateLabel(subscription.current_period_start * 1000)}.`,
          tone: 'success',
        } : null,
        latestInvoice ? {
          id: `invoice-${latestInvoice.id}`,
          date: latestInvoice.paidAt || latestInvoice.createdAt,
          title: 'Derniere facture',
          description: `${String(latestInvoice.status || 'inconnu')} pour ${formatMoney(latestInvoice.amountPaidCents ?? latestInvoice.amountDueCents, latestInvoice.currency)}.`,
          tone: latestInvoice.status === 'paid' ? 'success' : latestInvoice.status === 'open' ? 'warning' : 'neutral',
        } : null,
        upcomingInvoice?.dueDate ? {
          id: 'upcoming-invoice',
          date: upcomingInvoice.dueDate,
          title: 'Prochaine echeance',
          description: `${formatMoney(upcomingInvoice.amountDueCents, upcomingInvoice.currency)} attendu le ${formatDateLabel(upcomingInvoice.dueDate)}.`,
          tone: 'neutral',
        } : null,
        accountBillingState.paymentGraceUntil && (accountBillingState.billingStatus === 'pending' || accountBillingState.billingStatus === 'payment_failed') ? {
          id: 'payment-window',
          date: accountBillingState.paymentGraceUntil,
          title: accountBillingState.billingStatus === 'payment_failed' ? 'Regularisation attendue' : 'Confirmation de paiement attendue',
          description: `Echeance fixee au ${formatDateLabel(accountBillingState.paymentGraceUntil)}.`,
          tone: accountBillingState.billingStatus === 'payment_failed' ? 'danger' : 'warning',
        } : null,
        subscription?.cancel_at_period_end && subscription.current_period_end ? {
          id: 'cancel-at-period-end',
          date: toIsoDate(new Date(subscription.current_period_end * 1000)),
          title: 'Fin d abonnement programmee',
          description: `L abonnement se termine le ${formatDateLabel(subscription.current_period_end * 1000)}.`,
          tone: 'warning',
        } : null,
        accountBillingState.trialEndsAt && !subscription ? {
          id: 'trial-end',
          date: accountBillingState.trialEndsAt,
          title: 'Fin d essai',
          description: `L essai actuel se termine le ${formatDateLabel(accountBillingState.trialEndsAt)}.`,
          tone: 'neutral',
        } : null,
      ]
        .filter(Boolean)
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      return res.json({
        ...baseSummary,
        subscription: subscription ? {
          id: subscription.id,
          status: subscription.status || null,
          cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
          currentPeriodStart: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          currency: price?.currency || null,
          amountCents: typeof price?.unit_amount === 'number' ? price.unit_amount : null,
          interval: price?.recurring?.interval || null,
          productName: price?.nickname || primaryItem?.plan?.nickname || null,
          defaultPaymentMethod: defaultPaymentMethod ? {
            type: defaultPaymentMethod.type || null,
            brand: defaultPaymentMethod.card?.brand || null,
            last4: defaultPaymentMethod.card?.last4 || defaultPaymentMethod.sepa_debit?.last4 || null,
          } : null,
        } : null,
        invoices,
        upcomingInvoice,
        events,
      });
    } catch (e) {
      console.error('Billing summary error:', e);
      res.status(500).json({ message: 'Erreur billing' });
    }
  });

  // POST billing (sauvegarder infos B2B)
  app.post('/api/v1/billing', authenticateToken, async (req, res) => {
    try {
      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) return res.status(503).json({ message: 'Service non disponible' });
      const accountId = req.user.accountId;
      const {
        companyName,
        siret,
        siren,
        vatNumber,
        addressLine1,
        addressLine2,
        postalCode,
        city,
        country,
        billingEmail,
      } = req.body;

      if (!companyName || !addressLine1 || !postalCode || !city || !country || !billingEmail) {
        return res.status(400).json({ message: 'Champs requis : raison sociale, adresse, code postal, ville, pays, email facturation' });
      }

      await prisma.$executeRawUnsafe(`
        INSERT INTO "Billing" (id, accountid, companyname, siret, siren, vatnumber, addressline1, addressline2, postalcode, city, country, billingemail, createdat, updatedat)
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (accountid) DO UPDATE SET
          companyname = EXCLUDED.companyname,
          siret = EXCLUDED.siret,
          siren = EXCLUDED.siren,
          vatnumber = EXCLUDED.vatnumber,
          addressline1 = EXCLUDED.addressline1,
          addressline2 = EXCLUDED.addressline2,
          postalcode = EXCLUDED.postalcode,
          city = EXCLUDED.city,
          country = EXCLUDED.country,
          billingemail = EXCLUDED.billingemail,
          updatedat = NOW()
      `, accountId, companyName, siret || null, siren || null, vatNumber || null, addressLine1, addressLine2 || null, postalCode, city, country || 'FR', billingEmail);

      res.json({ success: true });
    } catch (e) {
      console.error('Billing save error:', e);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // POST create Stripe Checkout session (plan fixe legacy OU configurateur productTier/channelCount/addonIA)
  app.post('/api/v1/billing/create-checkout-session', authenticateToken, async (req, res) => {
    try {
      if (!stripe) return res.status(503).json({ message: 'Stripe non configuré' });
      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) return res.status(503).json({ message: 'Service non disponible' });

      const accountId = req.user.accountId;
      const { plan, successUrl, cancelUrl, productTier, channelCount, addonIA } = req.body;

      const billingRows = await prisma.$queryRawUnsafe(`SELECT * FROM "Billing" WHERE accountid = $1 LIMIT 1`, accountId);
      const billing = billingRows?.[0];
      if (!billing) {
        return res.status(400).json({ message: 'Veuillez renseigner vos informations de facturation avant de payer' });
      }
      const user = await prisma.$queryRawUnsafe(`
        SELECT u.*, a.name as accountname FROM "User" u
        JOIN "Account" a ON u.accountid = a.id WHERE u.accountid = $1 LIMIT 1
      `, accountId);
      const userEmail = user?.[0]?.email || req.user.email;

      let customerId = billing?.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          name: billing?.companyname || user?.[0]?.accountname,
          address: billing ? {
            line1: billing.addressline1,
            line2: billing.addressline2,
            city: billing.city,
            postal_code: billing.postalcode,
            country: billing.country || 'FR',
          } : undefined,
          metadata: { accountId },
        });
        customerId = customer.id;
        await prisma.$executeRawUnsafe(`
          UPDATE "Billing" SET stripe_customer_id = $1, updatedat = NOW() WHERE accountid = $2
        `, customerId, accountId);
      }

      let lineItems;
      let subscriptionMetadata = { accountId };

      if (productTier != null && channelCount != null) {
        // Configurateur : montant dynamique depuis la grille
        const priceResult = getPriceFromConfigurator(Number(productTier), Number(channelCount), !!addonIA);
        if (!priceResult) {
          return res.status(400).json({ message: 'Configuration hors grille (produits 100–50000, 1–5 canaux)' });
        }
        const planId = getPlanIdFromTier(productTier);
        subscriptionMetadata.plan = planId;
        subscriptionMetadata.addonIA = addonIA ? 'true' : 'false';
        subscriptionMetadata.channelCount = String(channelCount); // pour webhook → Account.max_channels
        const label = `FeedPlug — Jusqu'à ${productTier} produits, ${channelCount} canal${channelCount > 1 ? 'aux' : ''}${addonIA ? ' + Pack IA' : ''}`;
        lineItems = [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: label,
              description: `Abonnement mensuel HT — ${priceResult.amountEur} €/mois`,
            },
            unit_amount: priceResult.amountCents,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }];
      } else {
        // Legacy : plan fixe (STARTER / PROFESSIONAL / ENTERPRISE)
        const planKey = plan || 'STARTER';
        const planConfig = PLANS[planKey] || PLANS.STARTER;
        if (!planConfig.priceId) {
          return res.status(400).json({ message: `Plan ${planKey} non configuré (STRIPE_PRICE_${planKey}). Utilisez le configurateur (productTier, channelCount, addonIA).` });
        }
        subscriptionMetadata.plan = planKey;
        lineItems = [{ price: planConfig.priceId, quantity: 1 }];
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card', 'sepa_debit'],
        line_items: lineItems,
        success_url: successUrl || `${APP_URL}/dashboard?checkout=success`,
        cancel_url: cancelUrl || `${APP_URL}/choose-plan?checkout=cancelled`,
        subscription_data: {
          metadata: subscriptionMetadata,
          trial_period_days: 0,
        },
        metadata: subscriptionMetadata,
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (e) {
      console.error('[BILLING] Stripe checkout error:', {
        message: e.message,
        type: e.type,
        code: e.code,
        param: e.param,
        detail: e.detail,
        stripeError: e.type ? {
          type: e.type,
          message: e.message,
          code: e.code,
          param: e.param,
          detail: e.detail,
          Decline_code: e.decline_code
        } : undefined
      });
      res.status(500).json({ message: e.message || 'Erreur Stripe', code: e.code });
    }
  });

  // POST create Stripe Billing Portal session
  app.post('/api/v1/billing/create-portal-session', authenticateToken, async (req, res) => {
    try {
      if (!stripe) return res.status(503).json({ message: 'Stripe non configuré' });
      const prisma = getPrisma?.();
      if (!getPrismaReady?.() || !prisma) return res.status(503).json({ message: 'Service non disponible' });

      const accountId = req.user.accountId;
      const { returnUrl } = req.body || {};
      const billingRows = await prisma.$queryRawUnsafe(
        `SELECT stripe_customer_id FROM "Billing" WHERE accountid = $1 LIMIT 1`,
        accountId
      );
      const customerId = billingRows?.[0]?.stripe_customer_id;

      if (!customerId) {
        return res.status(400).json({
          message: 'Aucun client Stripe trouvé pour ce compte. Finalisez d’abord une souscription.',
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: typeof returnUrl === 'string' && returnUrl.trim() ? returnUrl.trim() : `${APP_URL}/facturation`,
      });

      res.json({ url: session.url });
    } catch (e) {
      console.error('Stripe billing portal error:', e);
      res.status(500).json({ message: e.message || 'Erreur portail Stripe' });
    }
  });

  return { PLANS };
}

// Webhook Stripe - doit être enregistré AVANT express.json() avec express.raw pour le body
function registerStripeWebhook(app, { getPrisma, getPrismaReady }) {
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    console.warn('Stripe webhook non configuré (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)');
    return;
  }

  app.post('/api/v1/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const prisma = getPrisma?.();
    const prismaReady = getPrismaReady?.();

    function addDays(date, days) {
      const next = new Date(date);
      next.setDate(next.getDate() + days);
      return next;
    }

    async function updateBillingSubscription(accountId, subscriptionId) {
      if (!accountId || !prismaReady || !prisma) return;
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE "Billing" SET stripe_subscription_id = $1, updatedat = NOW() WHERE accountid = $2
        `, subscriptionId || null, accountId);
      } catch (e) {
        console.error('Webhook billing subscription update error:', e);
      }
    }

    async function getAccountBillingWindow(accountId) {
      if (!accountId || !prismaReady || !prisma) return null;
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT billingstatus, paymentgraceuntil FROM "Account" WHERE id = $1::text LIMIT 1`,
          accountId
        );
        return rows?.[0] || null;
      } catch (e) {
        if (e?.message && /billingstatus|paymentgraceuntil|42703/i.test(e.message)) {
          return null;
        }
        console.error('Webhook getAccountBillingWindow error:', e);
        return null;
      }
    }

    async function updateAccountBillingState(accountId, {
      plan,
      addonIA,
      maxChannels,
      trialEndsAt,
      billingStatus,
      paymentGraceUntil,
    }) {
      if (!accountId || !prismaReady || !prisma) return;
      const normalizedTrialEndsAt = trialEndsAt instanceof Date ? trialEndsAt : (trialEndsAt ? new Date(trialEndsAt) : null);
      const normalizedPaymentGraceUntil = paymentGraceUntil instanceof Date ? paymentGraceUntil : (paymentGraceUntil ? new Date(paymentGraceUntil) : null);

      try {
        if (maxChannels !== undefined && maxChannels != null && !Number.isNaN(maxChannels)) {
          await prisma.$executeRawUnsafe(`
            UPDATE "Account"
            SET plan = $1, addonia = $2, max_channels = $3, trialendsat = $4, billingstatus = $5, paymentgraceuntil = $6, updatedat = NOW()
            WHERE id = $7
          `, plan, addonIA, maxChannels, normalizedTrialEndsAt, billingStatus, normalizedPaymentGraceUntil, accountId);
        } else if (maxChannels === null) {
          await prisma.$executeRawUnsafe(`
            UPDATE "Account"
            SET plan = $1, addonia = $2, max_channels = NULL, trialendsat = $3, billingstatus = $4, paymentgraceuntil = $5, updatedat = NOW()
            WHERE id = $6
          `, plan, addonIA, normalizedTrialEndsAt, billingStatus, normalizedPaymentGraceUntil, accountId);
        } else {
          await prisma.$executeRawUnsafe(`
            UPDATE "Account"
            SET plan = $1, addonia = $2, trialendsat = $3, billingstatus = $4, paymentgraceuntil = $5, updatedat = NOW()
            WHERE id = $6
          `, plan, addonIA, normalizedTrialEndsAt, billingStatus, normalizedPaymentGraceUntil, accountId);
        }
      } catch (e) {
        if (!e?.message || !/billingstatus|paymentgraceuntil|42703/i.test(e.message)) {
          throw e;
        }

        if (maxChannels !== undefined && maxChannels != null && !Number.isNaN(maxChannels)) {
          await prisma.$executeRawUnsafe(`
            UPDATE "Account"
            SET plan = $1, addonia = $2, max_channels = $3, trialendsat = $4, updatedat = NOW()
            WHERE id = $5
          `, plan, addonIA, maxChannels, normalizedTrialEndsAt, accountId);
        } else if (maxChannels === null) {
          await prisma.$executeRawUnsafe(`
            UPDATE "Account"
            SET plan = $1, addonia = $2, max_channels = NULL, trialendsat = $3, updatedat = NOW()
            WHERE id = $4
          `, plan, addonIA, normalizedTrialEndsAt, accountId);
        } else {
          await prisma.$executeRawUnsafe(`
            UPDATE "Account"
            SET plan = $1, addonia = $2, trialendsat = $3, updatedat = NOW()
            WHERE id = $4
          `, plan, addonIA, normalizedTrialEndsAt, accountId);
        }
      }
    }

    async function retrieveSubscriptionFromEventObject(object) {
      if (!object) return null;
      if (object.object === 'subscription') return object;
      const subscriptionId = typeof object.subscription === 'string' ? object.subscription : object.subscription?.id;
      if (!subscriptionId) return null;
      try {
        return await stripe.subscriptions.retrieve(subscriptionId);
      } catch (e) {
        console.error('Webhook subscription retrieve error:', e);
        return null;
      }
    }

    async function applySubscriptionState(sub, options = {}) {
      const accountId = sub.metadata?.accountId;
      if (!accountId || !prismaReady || !prisma) return;

      const plan = sub.metadata?.plan || 'STARTER';
      const addonIA = sub.metadata?.addonIA === 'true';
      const channelCountRaw = sub.metadata?.channelCount;
      const maxChannels = channelCountRaw != null && channelCountRaw !== '' ? parseInt(channelCountRaw, 10) : undefined;
      const status = String(sub.status || '').toLowerCase();
      const inactiveStatuses = new Set(['canceled', 'cancelled', 'unpaid', 'past_due', 'paused', 'incomplete_expired']);
      const isInactive = options.forceInactive || inactiveStatuses.has(status);
      const graceUntil = options.graceUntil instanceof Date ? options.graceUntil : (options.graceUntil ? new Date(options.graceUntil) : null);
      const paymentConfirmed = options.paymentConfirmed === true;
      const paymentFailed = options.paymentFailed === true;

      try {
        if (isInactive) {
          await updateAccountBillingState(accountId, {
            plan: 'STARTER',
            addonIA: false,
            maxChannels: 5,
            trialEndsAt: new Date(),
            billingStatus: 'payment_failed',
            paymentGraceUntil: null,
          });
          await updateBillingSubscription(accountId, null);
          return;
        }

        if (paymentConfirmed) {
          await updateAccountBillingState(accountId, {
            plan,
            addonIA,
            maxChannels,
            trialEndsAt: null,
            billingStatus: 'active',
            paymentGraceUntil: null,
          });
          await updateBillingSubscription(accountId, sub.id);
          return;
        }

        if (graceUntil) {
          await updateAccountBillingState(accountId, {
            plan,
            addonIA,
            maxChannels,
            trialEndsAt: graceUntil,
            billingStatus: paymentFailed ? 'payment_failed' : 'pending',
            paymentGraceUntil: graceUntil,
          });
          await updateBillingSubscription(accountId, sub.id);
          return;
        }

        await updateBillingSubscription(accountId, sub.id);
      } catch (e) {
        console.error('Webhook update error:', e);
      }
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      await applySubscriptionState(event.data.object, {});
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const subscription = await retrieveSubscriptionFromEventObject(session);
      if (subscription) {
        if (session.payment_status === 'paid') {
          await applySubscriptionState(subscription, { paymentConfirmed: true });
        } else {
          await applySubscriptionState(subscription, { graceUntil: addDays(new Date(), SEPA_GRACE_DAYS) });
        }
      }
    }

    if (event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const subscription = await retrieveSubscriptionFromEventObject(session);
      if (subscription) {
        await applySubscriptionState(subscription, { paymentConfirmed: true });
      }
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object;
      const subscription = await retrieveSubscriptionFromEventObject(session);
      if (subscription) {
        const accountWindow = await getAccountBillingWindow(subscription.metadata?.accountId);
        const currentGraceUntil = accountWindow?.paymentgraceuntil ? new Date(accountWindow.paymentgraceuntil) : addDays(new Date(), SEPA_GRACE_DAYS);
        await applySubscriptionState(subscription, {
          graceUntil: currentGraceUntil,
          paymentFailed: true,
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      await applySubscriptionState(event.data.object, { forceInactive: true });
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        try {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          await applySubscriptionState(subscription, { paymentConfirmed: true });
        } catch (e) {
          console.error('Webhook invoice.paid retrieve error:', e);
        }
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        try {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const accountWindow = await getAccountBillingWindow(subscription.metadata?.accountId);
          const currentStatus = String(accountWindow?.billingstatus || '').toLowerCase();
          const currentGraceUntil = accountWindow?.paymentgraceuntil ? new Date(accountWindow.paymentgraceuntil) : null;
          const graceStillActive = currentGraceUntil && currentGraceUntil.getTime() > Date.now();
          if ((currentStatus === 'pending' || currentStatus === 'payment_failed') && graceStillActive) {
            await applySubscriptionState(subscription, {
              graceUntil: currentGraceUntil,
              paymentFailed: true,
            });
          } else {
            await applySubscriptionState(subscription, { forceInactive: true });
          }
        } catch (e) {
          console.error('Webhook invoice.payment_failed retrieve error:', e);
        }
      }
    }

    res.json({ received: true });
  });
}

// Note: le webhook a besoin de express.raw - on l'enregistrera séparément dans server-minimal
module.exports = { registerOnboardingBillingRoutes, registerStripeWebhook, PLANS };

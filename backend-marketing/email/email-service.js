/**
 * Service d'emails FeedPlug
 * Provider principal: Resend
 * Fallback: SMTP via Nodemailer, puis mock console si rien n'est configuré
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');

let transporter = null;
let resendClient = null;

const FROM = process.env.EMAIL_FROM || 'FeedPlug <noreply@feedplug.com>';
const APP_URL = process.env.APP_URL || 'https://app.feedplug.com';
const API_URL = process.env.API_URL || 'https://api.feedplug.com';
const SITE_URL = process.env.MARKETING_URL || 'https://feedplug.com';
const MARKETING_REPLY_TO = process.env.MARKETING_REPLY_TO || 'hello@feedplug.com';
const RESEND_AUDIENCE_ID = typeof process.env.RESEND_AUDIENCE_ID === 'string'
  ? process.env.RESEND_AUDIENCE_ID.trim()
  : '';
const MARKETING_UNSUBSCRIBE_SECRET = process.env.MARKETING_UNSUBSCRIBE_SECRET
  || process.env.JWT_SECRET
  || 'feedplug-marketing-secret';
const INTERNAL_ALERT_EMAILS = parseEmailList(
  process.env.MARKETING_ALERT_EMAILS
  || process.env.LEAD_ALERT_EMAILS
  || process.env.FEEDPLUG_STAFF_EMAILS
  || 'admin@feedplug.com'
);
const PUSHOVER_APP_TOKEN = typeof process.env.PUSHOVER_APP_TOKEN === 'string'
  ? process.env.PUSHOVER_APP_TOKEN.trim()
  : '';
const PUSHOVER_USER_KEY = typeof process.env.PUSHOVER_USER_KEY === 'string'
  ? process.env.PUSHOVER_USER_KEY.trim()
  : '';
const PUSHOVER_DEVICE = typeof process.env.PUSHOVER_DEVICE === 'string'
  ? process.env.PUSHOVER_DEVICE.trim()
  : '';

/** Langues supportées pour les emails (clé = locale). */
const SUPPORTED_EMAIL_LOCALES = ['fr', 'en', 'es'];
const DEFAULT_EMAIL_LOCALE = 'fr';

function parseEmailList(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

const EMAIL_TEMPLATES = {
  fr: {
    welcome: {
      subject: 'Votre espace FeedPlug est prêt',
      cta: 'Ouvrir mon onboarding',
    },
    syncComplete: {
      subject: (feedName, total) => `Sync terminée — ${feedName} (${total} produits)`,
      cta: 'Voir les flux',
    },
    exportComplete: {
      subject: (succeeded, total) => `Export GMC — ${succeeded}/${total} produits envoyés`,
      cta: 'Voir les exports',
      allAccepted: 'Tous les produits ont été acceptés !',
      seeErrors: 'Consultez les détails des erreurs dans le dashboard.',
    },
    error: {
      subject: (ctx) => `⚠️ Erreur FeedPlug — ${ctx}`,
      cta: 'Voir le dashboard',
    },
    passwordReset: {
      subject: 'Réinitialisation de votre mot de passe FeedPlug',
      cta: 'Réinitialiser mon mot de passe',
      expiry: 'Ce lien expire dans 1 heure. Si vous n\'avez pas fait cette demande, ignorez cet email.',
    },
    invitation: {
      subject: "Vous êtes invité à rejoindre l'équipe FeedPlug",
      cta: 'Définir mon mot de passe',
      expiry: 'Ce lien expire dans 7 jours. Si vous n\'êtes pas à l\'origine de cette demande, vous pouvez ignorer cet email.',
    },
    marketing: {
      unsubscribe: 'Se désinscrire',
      reason: 'Vous recevez cet email car vous avez demandé l\'accès ou des informations sur FeedPlug.',
      help: 'Si vous préférez, vous pouvez simplement répondre à cet email.',
    },
  },
  en: {
    welcome: {
      subject: 'Your FeedPlug workspace is ready',
      cta: 'Open my onboarding',
    },
    syncComplete: {
      subject: (feedName, total) => `Sync complete — ${feedName} (${total} products)`,
      cta: 'View feeds',
    },
    exportComplete: {
      subject: (succeeded, total) => `GMC export — ${succeeded}/${total} products sent`,
      cta: 'View exports',
      allAccepted: 'All products have been accepted!',
      seeErrors: 'Check the dashboard for error details.',
    },
    error: {
      subject: (ctx) => `⚠️ FeedPlug error — ${ctx}`,
      cta: 'View dashboard',
    },
    passwordReset: {
      subject: 'Reset your FeedPlug password',
      cta: 'Reset my password',
      expiry: 'This link expires in 1 hour. If you didn\'t request this, please ignore this email.',
    },
    invitation: {
      subject: "You're invited to join the FeedPlug team",
      cta: 'Set my password',
      expiry: 'This link expires in 7 days. If you didn\'t request this, you can ignore this email.',
    },
    marketing: {
      unsubscribe: 'Unsubscribe',
      reason: 'You are receiving this email because you asked for access to FeedPlug or more information.',
      help: 'If you prefer, you can simply reply to this email.',
    },
  },
};

const MARKETING_SEQUENCE = {
  fr: {
    j0: {
      target: 'account_creation',
      subject: 'Votre accès FeedPlug + la checklist avant première synchro',
      title: () => '3 points à vérifier avant de brancher le catalogue',
      intro: 'Même sans ouvrir FeedPlug, voici le check le plus utile avant une première synchro. S’il y a un trou sur un seul de ces points, la lecture du catalogue devient vite trompeuse.',
      bullets: [
        'Titres: sur les 70 premiers caractères, on doit comprendre le type de produit, la marque et le différenciant principal.',
        'Identifiants: GTIN, MPN ou marque ne doivent pas être vides, recyclés ou dispersés selon les sources.',
        'Catégories et attributs: un même produit ne doit pas changer de logique entre Shopify, ERP et exports.',
      ],
      note: 'Repère simple: si plus de 10% du catalogue tombe sur un seul de ces points, il y a déjà assez de matière pour un vrai diagnostic.',
      preview: 'Une checklist concrète à passer avant votre première synchro catalogue.',
      cta: 'Créer mon compte et lancer le check',
      href: `${APP_URL}/register`,
    },
    j1: {
      target: 'first_analysis',
      subject: 'Audit express: testez 20 fiches et regardez ces 3 signaux',
      title: () => 'Faites ce test sur 20 fiches',
      intro: 'Prenez 20 fiches au hasard. Si vous voyez ces signaux plus de 2 ou 3 fois, le problème est probablement structurel et pas isolé.',
      bullets: [
        'Le titre n’exprime ni le produit exact, ni l’attribut qui fait la différence pour l’achat.',
        'Le GTIN est absent, faux ou impossible à réconcilier avec la marque et la variante vendue.',
        'Des attributs décisifs manquent: taille, couleur, matière, compatibilité, composition, usage, etc.',
      ],
      note: 'Ce test prend 10 minutes et donne déjà une bonne idée du niveau réel du catalogue.',
      preview: 'Un audit express à faire sur 20 fiches pour repérer un problème structurel.',
      cta: 'Créer mon compte et voir les fiches concernées',
      href: `${APP_URL}/register`,
    },
    j3: {
      target: 'product_example',
      subject: 'Audit express: testez 20 fiches et regardez ces 3 signaux',
      title: () => 'Faites ce test sur 20 fiches',
      intro: 'Prenez 20 fiches au hasard. Si vous voyez ces signaux plus de 2 ou 3 fois, le problème est probablement structurel et pas isolé.',
      bullets: [
        'Le titre n’exprime ni le produit exact, ni l’attribut qui fait la différence pour l’achat.',
        'Le GTIN est absent, faux ou impossible à réconcilier avec la marque et la variante vendue.',
        'Des attributs décisifs manquent: taille, couleur, matière, compatibilité, composition, usage, etc.',
      ],
      note: 'Ce test prend 10 minutes et donne déjà une bonne idée du niveau réel du catalogue.',
      preview: 'Un audit express à faire sur 20 fiches pour repérer un problème structurel.',
      cta: 'Créer mon compte et voir les fiches concernées',
      href: `${APP_URL}/register`,
    },
    j6: {
      target: 'channel_use_case',
      subject: 'Mini scorecard: quel canal est vraiment prêt ?',
      title: () => 'Avant d’ouvrir un canal, vérifiez ça',
      intro: 'Le bon réflexe n’est pas “quel export activer ?” mais “quel canal est déjà assez propre pour convertir ?”. Voici la lecture la plus simple.',
      bullets: [
        'Google Shopping: GTIN, catégorie, disponibilité, prix et image principale doivent être cohérents.',
        'Amazon / marketplaces: marque, variations, attributs clés et visuels doivent être normalisés.',
        'Assistants IA: titres explicites, cas d’usage, compatibilités et liens produits doivent être lisibles sans contexte métier.',
      ],
      note: 'Si un canal n’est pas propre sur ces points, le sujet n’est pas l’export. Le sujet, c’est la qualité catalogue en amont.',
      preview: 'Une mini scorecard pour voir quel canal est prêt et lequel ne l’est pas.',
      cta: 'Créer mon compte et prioriser le bon canal',
      href: `${APP_URL}/register`,
    },
    j10: {
      target: 'account_creation_last_call',
      subject: 'Mini scorecard: quel canal est vraiment prêt ?',
      title: () => 'Avant d’ouvrir un canal, vérifiez ça',
      intro: 'Le bon réflexe n’est pas “quel export activer ?” mais “quel canal est déjà assez propre pour convertir ?”. Voici la lecture la plus simple.',
      bullets: [
        'Google Shopping: GTIN, catégorie, disponibilité, prix et image principale doivent être cohérents.',
        'Amazon / marketplaces: marque, variations, attributs clés et visuels doivent être normalisés.',
        'Assistants IA: titres explicites, cas d’usage, compatibilités et liens produits doivent être lisibles sans contexte métier.',
      ],
      note: 'Si un canal n’est pas propre sur ces points, le sujet n’est pas l’export. Le sujet, c’est la qualité catalogue en amont.',
      preview: 'Une mini scorecard pour voir quel canal est prêt et lequel ne l’est pas.',
      cta: 'Créer mon compte et prioriser le bon canal',
      href: `${APP_URL}/register`,
    },
  },
  en: {
    j0: {
      target: 'account_creation',
      subject: 'Your FeedPlug access + the checklist before the first sync',
      title: () => '3 checks before you plug in the catalog',
      intro: 'Even without opening FeedPlug, this is the most useful pre-sync check. If one of these areas is weak, catalog quality becomes misleading very quickly.',
      bullets: [
        'Titles: within the first 70 characters, the product type, brand, and main differentiator should already be clear.',
        'Identifiers: GTIN, MPN, or brand should not be empty, recycled, or inconsistent across sources.',
        'Categories and attributes: the same product should not change logic between Shopify, ERP, and export files.',
      ],
      note: 'Simple rule: if more than 10% of the catalog fails on just one of these points, you already have enough material for a real diagnostic.',
      preview: 'A practical checklist to run before your first catalog sync.',
      cta: 'Create my account and run the check',
      href: `${APP_URL}/register`,
    },
    j1: {
      target: 'first_analysis',
      subject: 'Quick audit: review 20 items and look for these 3 signals',
      title: () => 'Run this test on 20 items',
      intro: 'Take 20 random product pages. If you see these signals more than 2 or 3 times, the problem is probably structural rather than isolated.',
      bullets: [
        'The title does not clearly express the exact product or the attribute that drives the purchase decision.',
        'The GTIN is missing, wrong, or impossible to reconcile with the brand and sold variant.',
        'Critical attributes are missing: size, color, material, compatibility, composition, usage, and so on.',
      ],
      note: 'This test takes 10 minutes and already gives a solid read on the real catalog level.',
      preview: 'A quick 20-item audit to spot structural catalog issues.',
      cta: 'Create my account and see the affected items',
      href: `${APP_URL}/register`,
    },
    j3: {
      target: 'product_example',
      subject: 'Quick audit: review 20 items and look for these 3 signals',
      title: () => 'Run this test on 20 items',
      intro: 'Take 20 random product pages. If you see these signals more than 2 or 3 times, the problem is probably structural rather than isolated.',
      bullets: [
        'The title does not clearly express the exact product or the attribute that drives the purchase decision.',
        'The GTIN is missing, wrong, or impossible to reconcile with the brand and sold variant.',
        'Critical attributes are missing: size, color, material, compatibility, composition, usage, and so on.',
      ],
      note: 'This test takes 10 minutes and already gives a solid read on the real catalog level.',
      preview: 'A quick 20-item audit to spot structural catalog issues.',
      cta: 'Create my account and see the affected items',
      href: `${APP_URL}/register`,
    },
    j6: {
      target: 'channel_use_case',
      subject: 'Mini scorecard: which channel is actually ready?',
      title: () => 'Before opening a channel, check this first',
      intro: 'The right question is not “which export should we activate?” but “which channel is already clean enough to convert?”. Here is the simplest read.',
      bullets: [
        'Google Shopping: GTIN, category, availability, price, and primary image must be consistent.',
        'Amazon / marketplaces: brand, variations, key attributes, and visuals must be normalized.',
        'AI assistants: explicit titles, use cases, compatibilities, and product links must be readable without internal context.',
      ],
      note: 'If a channel is weak on these points, the issue is not the export. The issue is upstream catalog quality.',
      preview: 'A mini scorecard to see which channel is ready and which is not.',
      cta: 'Create my account and prioritize the right channel',
      href: `${APP_URL}/register`,
    },
    j10: {
      target: 'account_creation_last_call',
      subject: 'Mini scorecard: which channel is actually ready?',
      title: () => 'Before opening a channel, check this first',
      intro: 'The right question is not “which export should we activate?” but “which channel is already clean enough to convert?”. Here is the simplest read.',
      bullets: [
        'Google Shopping: GTIN, category, availability, price, and primary image must be consistent.',
        'Amazon / marketplaces: brand, variations, key attributes, and visuals must be normalized.',
        'AI assistants: explicit titles, use cases, compatibilities, and product links must be readable without internal context.',
      ],
      note: 'If a channel is weak on these points, the issue is not the export. The issue is upstream catalog quality.',
      preview: 'A mini scorecard to see which channel is ready and which is not.',
      cta: 'Create my account and prioritize the right channel',
      href: `${APP_URL}/register`,
    },
  },
};

function getEmailLocale(locale) {
  if (locale && SUPPORTED_EMAIL_LOCALES.includes(locale)) return locale;
  return DEFAULT_EMAIL_LOCALE;
}

function getTransporter() {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });
  } else {
    transporter = {
      sendMail: async (opts) => {
        console.log(`📧 [EMAIL MOCK] To: ${opts.to} | Subject: ${opts.subject}`);
        return { messageId: `mock-${Date.now()}` };
      },
    };
    console.warn('⚠️ SMTP non configuré — emails en mode mock (console uniquement)');
  }

  return transporter;
}

function getResendClient() {
  const apiKey = typeof process.env.RESEND_API_KEY === 'string'
    ? process.env.RESEND_API_KEY.trim()
    : '';
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function createMarketingUnsubscribeToken(email) {
  return crypto
    .createHmac('sha256', MARKETING_UNSUBSCRIBE_SECRET)
    .update(String(email || '').trim().toLowerCase())
    .digest('hex');
}

function createMarketingClickToken(email, target, href) {
  return crypto
    .createHmac('sha256', MARKETING_UNSUBSCRIBE_SECRET)
    .update([
      String(email || '').trim().toLowerCase(),
      String(target || '').trim().toLowerCase(),
      String(href || '').trim(),
    ].join('|'))
    .digest('hex');
}

function verifyMarketingUnsubscribeToken(email, token) {
  const expected = createMarketingUnsubscribeToken(email);
  const safeExpected = Buffer.from(expected);
  const safeToken = Buffer.from(String(token || ''));
  if (safeExpected.length !== safeToken.length) return false;
  return crypto.timingSafeEqual(safeExpected, safeToken);
}

function verifyMarketingClickToken(email, target, href, token) {
  const expected = createMarketingClickToken(email, target, href);
  const safeExpected = Buffer.from(expected);
  const safeToken = Buffer.from(String(token || ''));
  if (safeExpected.length !== safeToken.length) return false;
  return crypto.timingSafeEqual(safeExpected, safeToken);
}

function getMarketingUnsubscribeUrl(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const token = createMarketingUnsubscribeToken(normalized);
  return `${API_URL}/api/v1/marketing/unsubscribe?email=${encodeURIComponent(normalized)}&token=${token}`;
}

function getMarketingTrackedUrl(email, target, href) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedTarget = String(target || '').trim().toLowerCase();
  const token = createMarketingClickToken(normalizedEmail, normalizedTarget, href);
  return `${API_URL}/api/v1/marketing/click?email=${encodeURIComponent(normalizedEmail)}&target=${encodeURIComponent(normalizedTarget)}&href=${encodeURIComponent(href)}&token=${token}`;
}

function getMarketingCtaHref(email, stage, href) {
  const rawHref = String(href || '').trim();
  if (!rawHref) return rawHref;

  let finalHref = rawHref;
  if (rawHref.startsWith(`${APP_URL}/register`)) {
    try {
      const url = new URL(rawHref);
      url.searchParams.set('email', String(email || '').trim().toLowerCase());
      url.searchParams.set('utm_source', 'feedplug');
      url.searchParams.set('utm_medium', 'email');
      url.searchParams.set('utm_campaign', `marketing_${String(stage || 'j0').trim().toLowerCase()}`);
      finalHref = url.toString();
    } catch {
      finalHref = rawHref;
    }
  }

  return getMarketingTrackedUrl(email, stage, finalHref);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBullets(items = []) {
  return items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
}

function renderJourneySteps(steps = []) {
  return steps
    .map((step, index) => `
      <div class="step">
        <div class="step-index">${index + 1}</div>
        <div class="step-body">
          <div class="step-title">${escapeHtml(step.title)}</div>
          <div class="step-text">${escapeHtml(step.description)}</div>
        </div>
      </div>
    `)
    .join('');
}

function baseTemplate(content, options = {}) {
  const { marketingEmail, locale = DEFAULT_EMAIL_LOCALE, previewText = '' } = options;
  const loc = getEmailLocale(locale);
  const template = EMAIL_TEMPLATES[loc] || EMAIL_TEMPLATES[DEFAULT_EMAIL_LOCALE];
  const marketing = template.marketing || EMAIL_TEMPLATES[DEFAULT_EMAIL_LOCALE].marketing;

  const marketingFooter = marketingEmail
    ? `
      <div class="marketing-footer">
        <p class="muted-small">${escapeHtml(marketing.reason)}</p>
        <p class="muted-small">
          <a href="${escapeHtml(getMarketingUnsubscribeUrl(marketingEmail))}" style="color: #6b7280;">${escapeHtml(marketing.unsubscribe)}</a><br>
          ${escapeHtml(marketing.help)}
        </p>
      </div>
    `
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #eef2f7; color: #111827; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px 16px 40px; }
  .card { background: white; border-radius: 20px; border: 1px solid #dbe3ee; overflow: hidden; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); }
  .brand { padding: 28px 28px 0; }
  .logo { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #2563eb; background: #eff6ff; border-radius: 999px; padding: 8px 12px; }
  .content { padding: 20px 28px 28px; }
  h1 { font-size: 28px; line-height: 1.2; font-weight: 700; margin: 0 0 14px; color: #0f172a; }
  p { font-size: 15px; line-height: 1.65; color: #475569; margin: 0 0 16px; }
  ul { padding-left: 20px; margin: 0 0 18px; color: #334155; }
  li { margin-bottom: 10px; font-size: 15px; line-height: 1.6; }
  .btn { display: inline-block; padding: 13px 22px; background: #0f172a; color: white !important; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 700; }
  .metric { display: inline-block; padding: 8px 16px; background: #f0f9ff; border-radius: 8px; margin: 4px; font-size: 14px; }
  .metric b { color: #0ea5e9; }
  .journey { margin: 24px 0; }
  .step { display: table; width: 100%; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; }
  .step-index { display: table-cell; width: 48px; font-size: 18px; font-weight: 700; text-align: center; vertical-align: top; padding: 16px 8px; color: #2563eb; }
  .step-body { display: table-cell; padding: 16px 16px 16px 0; }
  .step-title { font-size: 14px; line-height: 1.4; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .step-text { font-size: 13px; line-height: 1.55; color: #475569; }
  .note { margin-top: 22px; padding: 14px 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.6; color: #475569; }
  .marketing-footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  .muted-small { font-size: 12px; color: #6b7280; }
  .footer { margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center; }
  .success { color: #16a34a; } .error { color: #dc2626; } .warn { color: #d97706; }
</style></head>
<body><div class="container">
  <div class="card">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>
    <div class="brand"><div class="logo">FeedPlug</div></div>
    <div class="content">
      ${content}
      ${marketingFooter}
    </div>
  </div>
  <div class="footer">
    <p>FeedPlug<br>
    <a href="${escapeHtml(APP_URL)}" style="color: #6b7280;">app.feedplug.com</a></p>
  </div>
</div></body></html>`;
}

async function dispatchEmail({ to, subject, html, replyTo, headers, tags, marketing = false }) {
  const resend = getResendClient();
  if (resend) {
    try {
      const payload = {
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      };
      if (replyTo) payload.replyTo = replyTo;
      if (headers) payload.headers = headers;
      if (tags) payload.tags = tags;

      const response = await resend.emails.send(payload);
      if (response && response.error) {
        throw new Error(response.error.message || 'Resend send error');
      }
      return response;
    } catch (error) {
      console.warn(`⚠️ Resend indisponible (${marketing ? 'marketing' : 'transactionnel'}) — fallback SMTP/mock:`, error.message);
    }
  }

  return getTransporter().sendMail({
    from: FROM,
    to,
    subject,
    html,
    replyTo,
    headers,
  });
}

async function syncMarketingContact(contact) {
  const resend = getResendClient();
  if (!resend || !contact?.email) return null;

  const payload = {
    email: String(contact.email).trim().toLowerCase(),
    firstName: contact.firstName || undefined,
    lastName: contact.lastName || undefined,
    unsubscribed: !!contact.unsubscribed,
  };
  if (RESEND_AUDIENCE_ID) {
    payload.audienceId = RESEND_AUDIENCE_ID;
  }

  try {
    const response = await resend.contacts.create(payload);
    if (response && response.error) {
      const message = response.error.message || 'Resend contact create error';
      if (/already exists|duplicate/i.test(message)) {
        return null;
      }
      throw new Error(message);
    }
    return response?.data || response || null;
  } catch (error) {
    if (/already exists|duplicate/i.test(error.message || '')) {
      return null;
    }
    console.warn('⚠️ Sync contact Resend échouée:', error.message);
    return null;
  }
}

async function sendWelcomeEmail(email, firstName, locale = DEFAULT_EMAIL_LOCALE) {
  const loc = getEmailLocale(locale);
  const isEn = loc === 'en';
  const safeFirstName = String(firstName || '').trim();
  const title = isEn
    ? `Welcome to FeedPlug${safeFirstName ? `, ${escapeHtml(safeFirstName)}` : ''}`
    : `Bienvenue sur FeedPlug${safeFirstName ? `, ${escapeHtml(safeFirstName)}` : ''}`;
  const intro = isEn
    ? 'Your account is active. The best next step is to open onboarding, connect a source, and let FeedPlug show the first catalog priorities.'
    : 'Votre compte est actif. La meilleure suite est d’ouvrir l’onboarding, connecter une source et laisser FeedPlug faire ressortir les premières priorités catalogue.';
  const steps = isEn
    ? [
      { title: 'Connect a source', description: 'Shopify or file import, depending on how your catalog is managed today.' },
      { title: 'Launch the first sync', description: 'FeedPlug consolidates your product data and prepares the first readable baseline.' },
      { title: 'Read the first priorities', description: 'See weak titles, missing GTINs, thin attributes, and the first channels ready to work.' },
    ]
    : [
      { title: 'Connecter une source', description: 'Shopify ou import fichier selon la manière dont votre catalogue est géré aujourd’hui.' },
      { title: 'Lancer la première synchro', description: 'FeedPlug consolide vos données produit et prépare une première base exploitable.' },
      { title: 'Lire les premières priorités', description: 'Repérez les titres faibles, GTIN manquants, attributs pauvres et premiers canaux déjà travaillables.' },
    ];
  const supportNote = isEn
    ? 'Need help preparing the first source or understanding the scoring? Reply to this email and our team will point you to the right next step.'
    : 'Besoin d’aide pour préparer la première source ou comprendre le scoring ? Répondez à cet email et l’équipe FeedPlug vous orientera vers la bonne prochaine étape.';
  const template = EMAIL_TEMPLATES[loc] || EMAIL_TEMPLATES[DEFAULT_EMAIL_LOCALE];

  const html = baseTemplate(`
    <h1>${title}</h1>
    <p>${intro}</p>
    <div class="journey">${renderJourneySteps(steps)}</div>
    <p style="margin-top: 24px;">
      <a href="${escapeHtml(`${APP_URL}/onboarding`)}" class="btn">${escapeHtml(template.welcome.cta)}</a>
    </p>
    <div class="note">${escapeHtml(supportNote)}</div>
  `, {
    locale: loc,
    previewText: isEn
      ? 'Your FeedPlug account is ready. Open onboarding and launch your first catalog sync.'
      : 'Votre compte FeedPlug est prêt. Ouvrez l’onboarding et lancez votre première synchro catalogue.',
  });

  return dispatchEmail({
    to: email,
    subject: template.welcome.subject,
    html,
    replyTo: MARKETING_REPLY_TO,
    tags: [{ name: 'category', value: 'welcome' }],
  });
}

async function sendSyncCompleteEmail(email, feedName, stats, locale = DEFAULT_EMAIL_LOCALE) {
  const loc = getEmailLocale(locale);
  const isEn = loc === 'en';
  const template = EMAIL_TEMPLATES[loc] || EMAIL_TEMPLATES[DEFAULT_EMAIL_LOCALE];
  const title = isEn ? 'Sync complete' : 'Synchronisation terminée';
  const body = isEn
    ? `Feed <strong>${escapeHtml(feedName)}</strong> has been synced successfully.`
    : `Le flux <strong>${escapeHtml(feedName)}</strong> a été synchronisé avec succès.`;

  const html = baseTemplate(`
    <h1>${title}</h1>
    <p>${body}</p>
    <p>
      <span class="metric"><b>${stats.totalFetched || 0}</b> ${isEn ? 'fetched' : 'récupérés'}</span>
      <span class="metric"><b>${stats.totalInserted || 0}</b> ${isEn ? 'inserted' : 'insérés'}</span>
      <span class="metric"><b>${stats.totalUpdated || 0}</b> ${isEn ? 'updated' : 'mis à jour'}</span>
    </p>
    <p style="margin-top: 24px;">
      <a href="${escapeHtml(`${APP_URL}/flux`)}" class="btn">${escapeHtml(template.syncComplete.cta)}</a>
    </p>
  `, {
    locale: loc,
    previewText: isEn
      ? `Feed ${feedName} is ready to review in FeedPlug.`
      : `Le flux ${feedName} est prêt à être revu dans FeedPlug.`,
  });

  return dispatchEmail({
    to: email,
    subject: template.syncComplete.subject(feedName, stats.totalFetched || 0),
    html,
    tags: [{ name: 'category', value: 'sync_complete' }],
  });
}

async function sendExportCompleteEmail(email, feedName, result, locale = DEFAULT_EMAIL_LOCALE) {
  const loc = getEmailLocale(locale);
  const isEn = loc === 'en';
  const template = EMAIL_TEMPLATES[loc] || EMAIL_TEMPLATES[DEFAULT_EMAIL_LOCALE];
  const title = isEn ? 'GMC export complete' : 'Export GMC terminé';
  const body = isEn
    ? `Feed <strong>${escapeHtml(feedName)}</strong> has been pushed to Google Merchant Center.`
    : `Le flux <strong>${escapeHtml(feedName)}</strong> a été poussé vers Google Merchant Center.`;
  const sentLabel = isEn ? 'sent' : 'envoyés';
  const errLabel = isEn ? 'errors' : 'erreurs';
  const statusClass = result.failed > 0 ? 'warn' : 'success';

  const html = baseTemplate(`
    <h1>${title}</h1>
    <p>${body}</p>
    <p>
      <span class="metric"><b class="${statusClass}">${result.succeeded || 0}</b> ${sentLabel}</span>
      ${result.failed > 0 ? `<span class="metric"><b class="error">${result.failed}</b> ${errLabel}</span>` : ''}
      <span class="metric"><b>${result.total || 0}</b> total</span>
    </p>
    ${result.failed > 0 ? `<p class="warn">${template.exportComplete.seeErrors}</p>` : `<p class="success">${template.exportComplete.allAccepted}</p>`}
    <p style="margin-top: 24px;">
      <a href="${escapeHtml(`${APP_URL}/flux`)}" class="btn">${escapeHtml(template.exportComplete.cta)}</a>
    </p>
  `, {
    locale: loc,
    previewText: isEn
      ? `Your GMC export finished with ${result.succeeded || 0} products sent.`
      : `Votre export GMC est terminé avec ${result.succeeded || 0} produits envoyés.`,
  });

  return dispatchEmail({
    to: email,
    subject: template.exportComplete.subject(result.succeeded || 0, result.total || 0),
    html,
    tags: [{ name: 'category', value: 'export_complete' }],
  });
}

async function sendErrorEmail(email, context, errorMessage, locale = DEFAULT_EMAIL_LOCALE) {
  const loc = getEmailLocale(locale);
  const isEn = loc === 'en';
  const template = EMAIL_TEMPLATES[loc] || EMAIL_TEMPLATES[DEFAULT_EMAIL_LOCALE];
  const title = isEn ? 'Error detected' : 'Erreur détectée';
  const intro = isEn ? 'An error occurred on your FeedPlug account:' : 'Une erreur est survenue sur votre compte FeedPlug :';
  const contextLabel = isEn ? 'Context:' : 'Contexte :';
  const contact = isEn ? 'Our team has been notified. If the issue persists, contact us.' : 'Notre équipe a été notifiée. Si le problème persiste, contactez-nous.';

  const html = baseTemplate(`
    <h1 class="error">${title}</h1>
    <p>${intro}</p>
    <p><strong>${contextLabel}</strong> ${escapeHtml(context)}</p>
    <p style="background: #fef2f2; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #991b1b;">
      ${escapeHtml((errorMessage || '').substring(0, 500))}
    </p>
    <p>${contact}</p>
    <p style="margin-top: 24px;">
      <a href="${escapeHtml(`${APP_URL}/dashboard`)}" class="btn">${escapeHtml(template.error.cta)}</a>
    </p>
  `, {
    locale: loc,
    previewText: isEn ? 'FeedPlug detected an issue on your account.' : 'FeedPlug a détecté un problème sur votre compte.',
  });

  return dispatchEmail({
    to: email,
    subject: template.error.subject(context),
    html,
    tags: [{ name: 'category', value: 'error' }],
  });
}

async function sendPasswordResetEmail(email, resetToken, locale = DEFAULT_EMAIL_LOCALE) {
  const loc = getEmailLocale(locale);
  const isEn = loc === 'en';
  const template = EMAIL_TEMPLATES[loc] || EMAIL_TEMPLATES[DEFAULT_EMAIL_LOCALE];
  const title = isEn ? 'Password reset' : 'Réinitialisation du mot de passe';
  const intro = isEn ? 'You requested a password reset. Click the button below:' : 'Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous :';
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  const html = baseTemplate(`
    <h1>${title}</h1>
    <p>${intro}</p>
    <p style="margin: 24px 0;">
      <a href="${escapeHtml(resetUrl)}" class="btn">${escapeHtml(template.passwordReset.cta)}</a>
    </p>
    <p style="font-size: 12px; color: #9ca3af;">${escapeHtml(template.passwordReset.expiry)}</p>
  `, {
    locale: loc,
    previewText: isEn ? 'Use this secure link to reset your password.' : 'Utilisez ce lien sécurisé pour réinitialiser votre mot de passe.',
  });

  return dispatchEmail({
    to: email,
    subject: template.passwordReset.subject,
    html,
    tags: [{ name: 'category', value: 'password_reset' }],
  });
}

async function sendInvitationEmail(email, firstName, inviterName, invitationToken, locale = DEFAULT_EMAIL_LOCALE) {
  const loc = getEmailLocale(locale);
  const isEn = loc === 'en';
  const template = EMAIL_TEMPLATES[loc] || EMAIL_TEMPLATES[DEFAULT_EMAIL_LOCALE];
  const invitationUrl = `${APP_URL}/invitation?token=${encodeURIComponent(invitationToken)}`;
  const inviterLine = inviterName
    ? (isEn ? `<p><strong>${escapeHtml(inviterName)}</strong> invited you to join their team on FeedPlug.</p>` : `<p><strong>${escapeHtml(inviterName)}</strong> vous invite à rejoindre son équipe sur FeedPlug.</p>`)
    : (isEn ? '<p>You have been invited to join a team on FeedPlug.</p>' : '<p>Vous avez été invité à rejoindre une équipe sur FeedPlug.</p>');
  const activate = isEn ? 'To activate your account and set your password, click the button below:' : 'Pour activer votre compte et définir votre mot de passe, cliquez sur le bouton ci-dessous :';
  const welcome = isEn ? `Welcome${firstName ? ` ${escapeHtml(firstName)}` : ''}!` : `Bienvenue${firstName ? ` ${escapeHtml(firstName)}` : ''} !`;

  const html = baseTemplate(`
    <h1>${welcome}</h1>
    ${inviterLine}
    <p>${activate}</p>
    <p style="margin: 24px 0;">
      <a href="${escapeHtml(invitationUrl)}" class="btn">${escapeHtml(template.invitation.cta)}</a>
    </p>
    <p style="font-size: 12px; color: #9ca3af;">${escapeHtml(template.invitation.expiry)}</p>
  `, {
    locale: loc,
    previewText: isEn ? 'You have been invited to join a FeedPlug workspace.' : 'Vous avez été invité à rejoindre un espace FeedPlug.',
  });

  return dispatchEmail({
    to: email,
    subject: template.invitation.subject,
    html,
    tags: [{ name: 'category', value: 'invitation' }],
  });
}

async function sendMarketingNurtureEmail(email, firstName, locale = DEFAULT_EMAIL_LOCALE, stage = 'j0') {
  const loc = getEmailLocale(locale);
  const copyBundle = MARKETING_SEQUENCE[loc] || MARKETING_SEQUENCE[DEFAULT_EMAIL_LOCALE];
  const copy = copyBundle[stage] || copyBundle.j0;
  const title = copy.title(firstName || '');
  const trackedHref = getMarketingCtaHref(email, copy.target || stage, copy.href);
  const noteHtml = copy.note ? `<div class="note">${escapeHtml(copy.note)}</div>` : '';
  const html = baseTemplate(`
    <h1>${title}</h1>
    <p>${escapeHtml(copy.intro)}</p>
    <ul>
      ${renderBullets(copy.bullets)}
    </ul>
    ${noteHtml}
    <p style="margin-top: 24px;">
      <a href="${escapeHtml(trackedHref)}" class="btn">${escapeHtml(copy.cta)}</a>
    </p>
  `, {
    locale: loc,
    marketingEmail: email,
    previewText: copy.preview || copy.subject,
  });

  return dispatchEmail({
    to: email,
    subject: copy.subject,
    html,
    replyTo: MARKETING_REPLY_TO,
    marketing: true,
    tags: [
      { name: 'category', value: 'marketing_nurture' },
      { name: 'stage', value: stage },
    ],
  });
}

async function sendMarketingAuditEmail({
  email,
  firstName,
  company,
  locale = DEFAULT_EMAIL_LOCALE,
  shareUrl,
  connectorLabel,
  targetChannels = [],
}) {
  const loc = getEmailLocale(locale);
  const isEn = loc === 'en';
  const isEs = loc === 'es';
  const channelLabel = Array.isArray(targetChannels) && targetChannels.length > 0
    ? targetChannels.map((channel) => String(channel || '').trim()).filter(Boolean).join(', ')
    : (isEn ? 'your target channels' : isEs ? 'tus canales objetivo' : 'vos canaux cibles');
  const safeCompany = company ? escapeHtml(company) : '';
  const safeFirstName = firstName ? escapeHtml(firstName) : '';
  const safeConnectorLabel = connectorLabel ? escapeHtml(connectorLabel) : '';
  const subject = isEn
    ? `Your FeedPlug audit request is confirmed${company ? ` for ${company}` : ''}`
    : isEs
      ? `Tu solicitud de auditoria FeedPlug esta confirmada${company ? ` para ${company}` : ''}`
      : `Votre demande d audit FeedPlug est confirmee${company ? ` pour ${company}` : ''}`;
  const title = isEn
    ? `Your product feed audit has started${firstName ? `, ${safeFirstName}` : ''}`
    : isEs
      ? `Tu auditoria de feed ha comenzado${firstName ? `, ${safeFirstName}` : ''}`
      : `Votre audit de flux produit a commence${firstName ? `, ${safeFirstName}` : ''}`;
  const intro = isEn
    ? `We registered your request for ${safeCompany || 'your catalog'}. The free audit will be based on your real feed data, not on declarative answers.`
    : isEs
      ? `Hemos registrado tu solicitud para ${safeCompany || 'tu catalogo'}. La auditoria gratuita se basara en datos reales del feed, no en respuestas declarativas.`
      : `Nous avons bien enregistre votre demande pour ${safeCompany || 'votre catalogue'}. L audit gratuit sera base sur les vraies donnees du flux, pas sur du declaratif.`;
  const cta = isEn ? 'Open my audit space' : isEs ? 'Abrir mi espace de auditoria' : 'Ouvrir mon espace audit';
  const footer = isEn
    ? `Next step: connect your ${safeConnectorLabel || 'catalog source'} so FeedPlug can analyze your actual catalog quality on ${escapeHtml(channelLabel)}.`
    : isEs
      ? `Siguiente paso: conecta tu ${safeConnectorLabel || 'fuente de catalogo'} para que FeedPlug pueda analizar la calidad real del catalogo en ${escapeHtml(channelLabel)}.`
      : `Prochaine etape: connectez votre ${safeConnectorLabel || 'source catalogue'} pour que FeedPlug puisse analyser la qualite reelle du catalogue sur ${escapeHtml(channelLabel)}.`;

  const html = baseTemplate(`
    <h1>${title}</h1>
    <p>${intro}</p>
    <p style="margin-top: 24px;">
      <a href="${escapeHtml(shareUrl)}" class="btn">${escapeHtml(cta)}</a>
    </p>
    <p>${footer}</p>
  `, {
    locale: loc,
    marketingEmail: email,
    previewText: subject,
  });

  return dispatchEmail({
    to: email,
    subject,
    html,
    replyTo: MARKETING_REPLY_TO,
    marketing: true,
    tags: [
      { name: 'category', value: 'marketing_audit' },
      { name: 'locale', value: loc },
    ],
  });
}

function formatAlertValue(value) {
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item || '').trim()).filter(Boolean).join(', ');
    return joined || '—';
  }
  if (value === null || value === undefined) return '—';
  const stringValue = String(value).trim();
  return stringValue || '—';
}

function buildInternalAlertRows(event) {
  const rows = [
    ['Type', event.typeLabel],
    ['Email', event.email],
    ['Nom', [event.firstName, event.lastName].filter(Boolean).join(' ')],
    ['Societe', event.company],
    ['Fonction', event.jobTitle],
    ['Telephone', event.phone],
    ['Source', event.source],
    ['Locale', event.locale],
    ['Etat', event.alreadyRegistered ? 'Soumission repetee' : 'Nouvelle soumission'],
    ['Connecteur', event.connectorType],
    ['CMS / source', event.cmsUsed],
    ['Boutique / flux', event.shopUrl],
    ['Merchant Center', event.merchantId],
    ['Taille catalogue', event.catalogSize],
    ['Canaux cibles', event.targetChannels],
    ['Date', event.createdAt || new Date().toISOString()],
  ];
  if (event.idea) rows.push(['Idee', event.idea]);
  return rows
    .filter(([, value]) => value !== null && value !== undefined && String(formatAlertValue(value)).trim() !== '—')
    .map(([label, value]) => `
      <tr>
        <td style="padding: 8px 10px; border-top: 1px solid #e5e7eb; width: 180px; color: #475569; font-size: 13px; vertical-align: top;">${escapeHtml(label)}</td>
        <td style="padding: 8px 10px; border-top: 1px solid #e5e7eb; color: #0f172a; font-size: 14px; vertical-align: top;">${escapeHtml(formatAlertValue(value))}</td>
      </tr>
    `)
    .join('');
}

function buildInternalAlertCopy(event) {
  const typeLabel = event.kind === 'audit'
    ? 'Nouvel audit marketing'
    : event.kind === 'feature_idea'
      ? 'Nouvelle idee roadmap'
      : 'Nouveau lead marketing';
  const subjectParts = ['FeedPlug', typeLabel];
  if (event.source) subjectParts.push(event.source);
  const displayName = [event.firstName, event.lastName].filter(Boolean).join(' ').trim();
  if (displayName) {
    subjectParts.push(displayName);
  } else if (event.email) {
    subjectParts.push(event.email);
  }

  const actionUrl = event.kind === 'feature_idea'
    ? `${APP_URL}/admin/feature-ideas`
    : `${APP_URL}/admin/leads`;
  const actionLabel = event.kind === 'feature_idea'
    ? 'Ouvrir les idees produit'
    : 'Ouvrir les leads';
  const summary = event.kind === 'feature_idea'
    ? 'Une nouvelle idee a ete soumise sur la roadmap FeedPlug.'
    : event.alreadyRegistered
      ? 'Une nouvelle soumission a ete acceptee pour un lead deja connu.'
      : 'Une nouvelle soumission marketing a ete acceptee.';
  const rowsHtml = buildInternalAlertRows({ ...event, typeLabel });
  const noteHtml = event.idea
    ? `<div class="note" style="margin-top: 18px;"><strong>Extrait :</strong><br>${escapeHtml(String(event.idea).slice(0, 700))}</div>`
    : '';
  const html = baseTemplate(`
    <h1>${escapeHtml(typeLabel)}</h1>
    <p>${escapeHtml(summary)}</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 18px; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    ${noteHtml}
    <p style="margin-top: 24px;">
      <a href="${escapeHtml(actionUrl)}" class="btn">${escapeHtml(actionLabel)}</a>
    </p>
  `, {
    locale: 'fr',
    previewText: `${typeLabel} — ${event.email || displayName || 'nouvelle soumission'}`,
  });

  const pushoverLines = [
    typeLabel,
    event.email ? `Email: ${event.email}` : '',
    displayName ? `Nom: ${displayName}` : '',
    event.company ? `Societe: ${event.company}` : '',
    event.source ? `Source: ${event.source}` : '',
    event.idea ? `Idee: ${String(event.idea).slice(0, 160)}` : '',
  ].filter(Boolean);

  return {
    actionLabel,
    actionUrl,
    html,
    message: pushoverLines.join('\n'),
    subject: subjectParts.join(' • '),
    typeLabel,
  };
}

async function sendPushoverAlert({ title, message, url, urlTitle }) {
  if (!PUSHOVER_APP_TOKEN || !PUSHOVER_USER_KEY) return null;

  const body = new URLSearchParams({
    token: PUSHOVER_APP_TOKEN,
    user: PUSHOVER_USER_KEY,
    title,
    message,
    url,
    url_title: urlTitle || 'Ouvrir FeedPlug',
  });
  if (PUSHOVER_DEVICE) {
    body.set('device', PUSHOVER_DEVICE);
  }

  const response = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Pushover ${response.status}: ${errorText || 'push failed'}`);
  }

  return response.json().catch(() => null);
}

async function notifyInternalMarketingFormSubmission(event = {}) {
  const alert = buildInternalAlertCopy(event);
  const tasks = [];

  if (INTERNAL_ALERT_EMAILS.length > 0) {
    tasks.push(
      dispatchEmail({
        to: INTERNAL_ALERT_EMAILS,
        subject: alert.subject,
        html: alert.html,
        replyTo: event.email || MARKETING_REPLY_TO,
        tags: [{ name: 'category', value: 'internal_marketing_alert' }],
      })
    );
  }

  if (PUSHOVER_APP_TOKEN && PUSHOVER_USER_KEY) {
    tasks.push(
      sendPushoverAlert({
        title: 'FeedPlug',
        message: alert.message,
        url: alert.actionUrl,
        urlTitle: alert.actionLabel,
      })
    );
  }

  if (tasks.length === 0) {
    return { attempted: false };
  }

  const results = await Promise.allSettled(tasks);
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length === results.length) {
    throw failures[0].reason || new Error('Internal marketing alert failed');
  }

  return {
    attempted: true,
    failedChannels: failures.length,
    sentChannels: results.length - failures.length,
  };
}

module.exports = {
  sendWelcomeEmail,
  sendSyncCompleteEmail,
  sendExportCompleteEmail,
  sendErrorEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
  sendMarketingNurtureEmail,
  sendMarketingAuditEmail,
  syncMarketingContact,
  createMarketingClickToken,
  verifyMarketingClickToken,
  getMarketingTrackedUrl,
  createMarketingUnsubscribeToken,
  verifyMarketingUnsubscribeToken,
  notifyInternalMarketingFormSubmission,
  SUPPORTED_EMAIL_LOCALES,
  getEmailLocale,
};

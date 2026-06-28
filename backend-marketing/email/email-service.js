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
const MARKETING_RDV_URL = process.env.MARKETING_RDV_URL || 'https://calendly.com/victorsoldet/30min';
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
      <tr><td style="padding: 6px 32px 30px;">
        <div style="border-top: 1px solid #e8edf4; padding-top: 18px;">
          <p style="margin: 0 0 8px; font-size: 12px; line-height: 1.6; color: #9aa6b6;">${escapeHtml(marketing.reason)}</p>
          <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #9aa6b6;">
            <a href="${escapeHtml(getMarketingUnsubscribeUrl(marketingEmail))}" style="color: #64748b; text-decoration: underline;">${escapeHtml(marketing.unsubscribe)}</a>
            &nbsp;&middot;&nbsp; ${escapeHtml(marketing.help)}
          </p>
        </div>
      </td></tr>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="${loc}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #eceff4; color: #0b1120; -webkit-font-smoothing: antialiased; }
  a { color: #2563eb; }
  h1 { font-size: 23px; line-height: 1.3; font-weight: 800; margin: 0 0 14px; color: #0b1120; letter-spacing: -0.01em; }
  p { font-size: 15px; line-height: 1.7; color: #46546b; margin: 0 0 15px; }
  ul { padding-left: 20px; margin: 0 0 18px; color: #334155; }
  li { margin-bottom: 10px; font-size: 15px; line-height: 1.6; }
  strong { color: #0b1120; }
  .btn { display: inline-block; padding: 14px 26px; background: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 700; }
  .metric { display: inline-block; padding: 8px 16px; background: #eff4ff; border-radius: 8px; margin: 4px; font-size: 14px; }
  .metric b { color: #2563eb; }
  .journey { margin: 24px 0; }
  .step { display: table; width: 100%; margin-bottom: 12px; border: 1px solid #e7ecf3; border-radius: 14px; background: #f8fafc; }
  .step-index { display: table-cell; width: 48px; font-size: 18px; font-weight: 700; text-align: center; vertical-align: top; padding: 16px 8px; color: #2563eb; }
  .step-body { display: table-cell; padding: 16px 16px 16px 0; }
  .step-title { font-size: 14px; line-height: 1.4; font-weight: 700; color: #0b1120; margin-bottom: 4px; }
  .step-text { font-size: 13px; line-height: 1.55; color: #46546b; }
  .note { margin-top: 22px; padding: 14px 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e7ecf3; font-size: 13px; line-height: 1.6; color: #46546b; }
  .muted-small { font-size: 12px; color: #9aa6b6; }
  .success { color: #16a34a; } .error { color: #dc2626; } .warn { color: #d97706; }
</style></head>
<body style="margin:0;padding:0;background:#eceff4;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eceff4;">
    <tr><td align="center" style="padding: 30px 12px 38px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e8f0;">
        <tr><td style="background:#ffffff;padding:24px 32px 18px;border-bottom:1px solid #eef1f5;">
          <span style="font-size:20px;font-weight:600;color:#0a0a0a;letter-spacing:-0.02em;">FeedPlug</span>
        </td></tr>
        <tr><td style="padding:28px 32px 10px;">
          ${content}
        </td></tr>
        ${marketingFooter}
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding:18px 8px 0;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#9aa6b6;">© FeedPlug &middot; <a href="${escapeHtml(APP_URL)}" style="color:#7e8a9c;text-decoration:none;">app.feedplug.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function dispatchEmail({ to, subject, html, text, replyTo, headers, tags, marketing = false }) {
  const resend = getResendClient();
  if (resend) {
    try {
      const payload = {
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      };
      if (text) payload.text = text;
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
    text,
    replyTo,
    headers,
  });
}

/**
 * En-têtes de désinscription one-click (Gmail/Yahoo bulk sender requirements).
 * Améliore nettement la délivrabilité des emails marketing.
 */
function buildMarketingHeaders(email) {
  const unsubscribeUrl = getMarketingUnsubscribeUrl(email);
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
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

// Magic-link de connexion au COMPARATEUR conso (servi sur feedplug.com → SITE_URL).
async function sendComparatorMagicLinkEmail(email, token, locale = DEFAULT_EMAIL_LOCALE) {
  const loc = getEmailLocale(locale);
  const isEn = loc === 'en';
  const prefix = loc === 'fr' ? '' : `/${loc}`;
  const url = `${SITE_URL}${prefix}/compte/verifier?token=${encodeURIComponent(token)}`;
  const title = isEn ? 'Your sign-in link' : 'Votre lien de connexion';
  const intro = isEn
    ? 'Click below to sign in to the price comparator. This link expires in 15 minutes and can be used once.'
    : 'Cliquez ci-dessous pour vous connecter au comparateur. Ce lien expire dans 15 minutes et ne fonctionne qu’une seule fois.';
  const cta = isEn ? 'Sign in' : 'Me connecter';
  const ignore = isEn
    ? 'If you did not request this, you can safely ignore this email.'
    : 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.';

  const html = baseTemplate(`
    <h1>${title}</h1>
    <p>${intro}</p>
    <p style="margin: 24px 0;">
      <a href="${escapeHtml(url)}" class="btn">${escapeHtml(cta)}</a>
    </p>
    <p style="font-size: 12px; color: #9ca3af;">${escapeHtml(ignore)}</p>
  `, {
    locale: loc,
    previewText: isEn ? 'Your secure sign-in link.' : 'Votre lien de connexion sécurisé.',
  });

  return dispatchEmail({
    to: email,
    subject: title,
    html,
    tags: [{ name: 'category', value: 'comparator_magic_link' }],
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
    headers: buildMarketingHeaders(email),
    marketing: true,
    tags: [
      { name: 'category', value: 'marketing_nurture' },
      { name: 'stage', value: stage },
    ],
  });
}

/**
 * Séquence de nurture post-audit de flux.
 * - Segment A (`a`) : audit non terminé (source jamais connectée) — 2 mails.
 * - Segment B (`b`) : audit vu, score généré, pas de compte — 4 mails.
 * Les leads sans audit gardent MARKETING_SEQUENCE (segment C).
 * Variables interpolées : {{prenom}} {{societe}} {{score}} {{scorePotentiel}}
 * {{blocage1..3}} {{produitsRecuperables}} {{gainVisibilite}} {{cms}}
 * {{lienAudit}} {{lienRdv}}.
 */
const AUDIT_NURTURE_SEQUENCE = {
  fr: {
    a: [
      {
        subject: "Votre audit {{societe}} n'attend qu'une connexion",
        preview: 'Il manque une étape de 30 secondes pour votre score.',
        blocks: [
          { t: 'h1', text: "Votre audit n'attend qu'une connexion" },
          { t: 'p', text: "{{prenom}}, vous avez lancé un audit de flux, mais la source n'a pas encore été connectée — donc pas encore de score." },
          { t: 'p', text: 'La connexion {{cms}} prend 30 secondes, en lecture seule. Vous obtenez aussitôt votre score réel et vos blocages prioritaires.' },
          { t: 'cta', text: 'Terminer mon audit', kind: 'audit' },
        ],
      },
      {
        subject: 'Votre score de flux, en 30 secondes',
        preview: 'Votre audit est toujours en attente de connexion.',
        blocks: [
          { t: 'h1', text: 'Votre score de flux, en 30 secondes' },
          { t: 'p', text: 'Petit rappel : votre audit {{societe}} est prêt, il attend juste la connexion de votre catalogue pour générer le diagnostic.' },
          { t: 'p', text: 'Lecture seule, 30 secondes, aucune carte bancaire.' },
          { t: 'cta', text: 'Connecter et voir mon score', kind: 'audit' },
        ],
      },
    ],
    b: [
      {
        subject: '{{score}}/100 : les 3 blocages qui plafonnent votre flux',
        preview: 'Votre audit {{societe}} est prêt — et voici quoi en faire.',
        blocks: [
          { t: 'h1', text: 'Vous avez le diagnostic, voici le plan de travail' },
          { t: 'p', text: '{{prenom}}, votre flux produit a obtenu **{{score}}/100**. À catalogue constant, le potentiel atteignable est de **{{scorePotentiel}}/100**.' },
          { t: 'score' },
          { t: 'p', text: "L'écart se concentre sur 3 blocages :" },
          { t: 'issuecards' },
          { t: 'p', text: 'Un score, seul, ne fait rien avancer. Ce que FeedPlug ajoute : la **liste exacte des fiches à corriger**, classées par impact, avec le correctif proposé sur chacune. Vous ne cherchez plus où est le problème — vous avez un plan de travail priorisé, prêt à exécuter.' },
          { t: 'cta', text: 'Voir mes fiches à corriger', kind: 'register' },
          { t: 'doclink', label: '📄 Télécharger l’audit complet en PDF', kind: 'pdf' },
          { t: 'linkline', label: 'Votre audit reste accessible ici :', kind: 'audit' },
        ],
      },
      {
        subject: "{{produitsRecuperables}} produits que vous n'exploitez pas",
        preview: "Le diagnostic, c'est bien. Le récupérer, c'est mieux.",
        blocks: [
          { t: 'h1', text: 'Le gain est réel, et atteignable sans le chantier manuel' },
          { t: 'p', text: 'Votre audit estime **{{produitsRecuperables}} produits** remettables en diffusion et un gain de visibilité potentiel de **+{{gainVisibilite}}%**.' },
          { t: 'stats' },
          { t: 'p', text: "La façon habituelle d'aller chercher ce gain : reprendre les fiches une par une, ou confier ça à une agence. Lent, coûteux — et à refaire à chaque mise à jour du catalogue." },
          { t: 'p', text: "FeedPlug fait ce travail autrement : des **règles d'enrichissement + de l'IA corrigent tout le catalogue d'un coup**, puis le flux corrigé est poussé et **maintenu à jour automatiquement** sur chacun de vos canaux. Le gain devient atteignable sans y passer vos semaines." },
          { t: 'cta', text: 'Récupérer ces produits', kind: 'register' },
        ],
      },
      {
        subject: "De {{score}} à {{scorePotentiel}}/100 : comment FeedPlug s'y prend",
        preview: 'Le mécanisme, étape par étape — sur votre blocage n°1.',
        blocks: [
          { t: 'h1', text: 'Voici, concrètement, ce que fait FeedPlug' },
          { t: 'p', text: 'Reprenons votre blocage principal — {{blocage1}}. Voici comment FeedPlug le traite, et le reste du catalogue avec :' },
          { t: 'score' },
          { t: 'ol', items: [
            '**Vous connectez votre source une fois** (Shopify, CSV, PrestaShop…).',
            '**FeedPlug optimise tout le catalogue** — titres, descriptions, attributs — *adaptés à chaque canal*, via règles + IA.',
            "**Vous validez** les changements : l'avant/après est visible fiche par fiche.",
            '**Le flux part vers Google, Amazon, Meta, marketplaces…** et reste synchronisé à chaque mise à jour produit.',
          ] },
          { t: 'p', text: "Le résultat n'est pas un fichier corrigé une fois. C'est un catalogue diffusable partout, qui **ne se redégrade pas** à la prochaine update." },
          { t: 'cta', text: 'Voir FeedPlug sur mon catalogue', kind: 'register' },
        ],
      },
      {
        subject: 'On regarde votre flux {{societe}} ensemble ?',
        preview: 'Dernière relance — et une proposition.',
        blocks: [
          { t: 'h1', text: 'On regarde votre flux ensemble ?' },
          { t: 'p', text: '{{prenom}}, votre audit a chiffré le potentiel : **{{scorePotentiel}}/100 atteignable**. FeedPlug existe précisément pour fermer cet écart — sans y passer vos semaines, et sans que le flux se redégrade ensuite.' },
          { t: 'score' },
          { t: 'p', text: "Si vous voulez, on prend 20 minutes : on regarde votre flux ensemble et on définit l'ordre des corrections à plus fort impact. Sans engagement." },
          { t: 'p', text: 'Et si vous préférez avancer seul, votre compte se crée en 2 minutes.' },
          { t: 'cta2', primary: { text: 'Réserver 20 minutes', kind: 'rdv' }, secondary: { text: 'Créer mon compte', kind: 'register' } },
        ],
      },
    ],
  },
  en: {
    a: [
      {
        subject: 'Your {{societe}} audit just needs a connection',
        preview: 'One 30-second step is missing for your score.',
        blocks: [
          { t: 'h1', text: 'Your audit just needs a connection' },
          { t: 'p', text: "{{prenom}}, you started a feed audit, but the source hasn't been connected yet — so there's no score yet." },
          { t: 'p', text: 'Connecting {{cms}} takes 30 seconds, read-only. You get your real score and priority issues right away.' },
          { t: 'cta', text: 'Finish my audit', kind: 'audit' },
        ],
      },
      {
        subject: 'Your feed score, in 30 seconds',
        preview: 'Your audit is still waiting on a connection.',
        blocks: [
          { t: 'h1', text: 'Your feed score, in 30 seconds' },
          { t: 'p', text: 'Quick reminder: your {{societe}} audit is ready — it just needs your catalog connected to generate the diagnostic.' },
          { t: 'p', text: 'Read-only, 30 seconds, no credit card.' },
          { t: 'cta', text: 'Connect and see my score', kind: 'audit' },
        ],
      },
    ],
    b: [
      {
        subject: '{{score}}/100: the 3 issues holding your feed back',
        preview: "Your {{societe}} audit is ready — and here's what to do with it.",
        blocks: [
          { t: 'h1', text: "You have the diagnosis, here's the worklist" },
          { t: 'p', text: '{{prenom}}, your product feed scored **{{score}}/100**. With the same catalog, the reachable potential is **{{scorePotentiel}}/100**.' },
          { t: 'score' },
          { t: 'p', text: 'The gap comes down to 3 blockers:' },
          { t: 'issuecards' },
          { t: 'p', text: 'A score on its own moves nothing. What FeedPlug adds: the **exact list of products to fix**, ranked by impact, with the proposed fix on each. You stop hunting for the problem — you get a prioritized worklist, ready to run.' },
          { t: 'cta', text: 'See my products to fix', kind: 'register' },
          { t: 'doclink', label: '📄 Download the full audit as a PDF', kind: 'pdf' },
          { t: 'linkline', label: 'Your audit stays available here:', kind: 'audit' },
        ],
      },
      {
        subject: "{{produitsRecuperables}} products you're leaving on the table",
        preview: 'The diagnostic is one thing. Capturing it is better.',
        blocks: [
          { t: 'h1', text: 'The gain is real, and reachable without the manual grind' },
          { t: 'p', text: 'Your audit estimates **{{produitsRecuperables}} products** that could be put back into circulation and a potential visibility gain of **+{{gainVisibilite}}%**.' },
          { t: 'stats' },
          { t: 'p', text: 'The usual way to chase that gain: rework products one by one, or hand it to an agency. Slow, costly — and to redo on every catalog update.' },
          { t: 'p', text: 'FeedPlug does this work differently: **enrichment rules + AI fix the whole catalog at once**, then the corrected feed is pushed and **kept in sync automatically** across every channel. The gain becomes reachable without burning weeks on it.' },
          { t: 'cta', text: 'Recover these products', kind: 'register' },
        ],
      },
      {
        subject: 'From {{score}} to {{scorePotentiel}}/100: how FeedPlug does it',
        preview: 'The mechanism, step by step — on your top issue.',
        blocks: [
          { t: 'h1', text: 'Here, concretely, is what FeedPlug does' },
          { t: 'p', text: "Let's take your main issue — {{blocage1}}. Here's how FeedPlug handles it, and the rest of the catalog with it:" },
          { t: 'score' },
          { t: 'ol', items: [
            '**You connect your source once** (Shopify, CSV, PrestaShop…).',
            '**FeedPlug optimizes the whole catalog** — titles, descriptions, attributes — *tailored to each channel*, via rules + AI.',
            '**You review** the changes: the before/after is visible product by product.',
            '**The feed goes out to Google, Amazon, Meta, marketplaces…** and stays in sync on every product update.',
          ] },
          { t: 'p', text: "The result isn't a file fixed once. It's a catalog that's distributable everywhere and **doesn't degrade again** on the next update." },
          { t: 'cta', text: 'See FeedPlug on my catalog', kind: 'register' },
        ],
      },
      {
        subject: 'Want to look at your {{societe}} feed together?',
        preview: 'Last follow-up — and an offer.',
        blocks: [
          { t: 'h1', text: 'Want to look at your feed together?' },
          { t: 'p', text: '{{prenom}}, your audit put a number on the potential: **{{scorePotentiel}}/100 reachable**. FeedPlug exists precisely to close that gap — without burning weeks, and without the feed degrading afterward.' },
          { t: 'score' },
          { t: 'p', text: "If you'd like, let's take 20 minutes: we look at your feed together and set the order of the highest-impact fixes. No commitment." },
          { t: 'p', text: "And if you'd rather move on your own, your account takes 2 minutes to create." },
          { t: 'cta2', primary: { text: 'Book 20 minutes', kind: 'rdv' }, secondary: { text: 'Create my account', kind: 'register' } },
        ],
      },
    ],
  },
  es: {
    a: [
      {
        subject: 'Tu auditoría {{societe}} solo necesita una conexión',
        preview: 'Falta un paso de 30 segundos para tu puntuación.',
        blocks: [
          { t: 'h1', text: 'Tu auditoría solo necesita una conexión' },
          { t: 'p', text: '{{prenom}}, iniciaste una auditoría de feed, pero la fuente aún no se ha conectado — así que todavía no hay puntuación.' },
          { t: 'p', text: 'Conectar {{cms}} toma 30 segundos, en modo solo lectura. Obtienes tu puntuación real y tus bloqueos prioritarios al instante.' },
          { t: 'cta', text: 'Terminar mi auditoría', kind: 'audit' },
        ],
      },
      {
        subject: 'Tu puntuación de feed, en 30 segundos',
        preview: 'Tu auditoría sigue esperando una conexión.',
        blocks: [
          { t: 'h1', text: 'Tu puntuación de feed, en 30 segundos' },
          { t: 'p', text: 'Recordatorio rápido: tu auditoría {{societe}} está lista — solo necesita que conectes tu catálogo para generar el diagnóstico.' },
          { t: 'p', text: 'Solo lectura, 30 segundos, sin tarjeta de crédito.' },
          { t: 'cta', text: 'Conectar y ver mi puntuación', kind: 'audit' },
        ],
      },
    ],
    b: [
      {
        subject: '{{score}}/100: los 3 bloqueos que limitan tu feed',
        preview: 'Tu auditoría {{societe}} está lista — y esto es qué hacer con ella.',
        blocks: [
          { t: 'h1', text: 'Tienes el diagnóstico, aquí está el plan de trabajo' },
          { t: 'p', text: '{{prenom}}, tu feed de productos obtuvo **{{score}}/100**. Con el mismo catálogo, el potencial alcanzable es de **{{scorePotentiel}}/100**.' },
          { t: 'score' },
          { t: 'p', text: 'La diferencia se concentra en 3 bloqueos:' },
          { t: 'issuecards' },
          { t: 'p', text: 'Una puntuación, por sí sola, no hace avanzar nada. Lo que FeedPlug añade: la **lista exacta de fichas a corregir**, ordenadas por impacto, con la corrección propuesta en cada una. Dejas de buscar dónde está el problema — tienes un plan de trabajo priorizado, listo para ejecutar.' },
          { t: 'cta', text: 'Ver mis fichas a corregir', kind: 'register' },
          { t: 'doclink', label: '📄 Descargar la auditoría completa en PDF', kind: 'pdf' },
          { t: 'linkline', label: 'Tu auditoría sigue disponible aquí:', kind: 'audit' },
        ],
      },
      {
        subject: '{{produitsRecuperables}} productos que no estás aprovechando',
        preview: 'El diagnóstico está bien. Recuperarlo es mejor.',
        blocks: [
          { t: 'h1', text: 'La ganancia es real, y alcanzable sin el trabajo manual' },
          { t: 'p', text: 'Tu auditoría estima **{{produitsRecuperables}} productos** que podrían volver a difundirse y una ganancia de visibilidad potencial del **+{{gainVisibilite}}%**.' },
          { t: 'stats' },
          { t: 'p', text: 'La forma habitual de ir a buscar esa ganancia: rehacer las fichas una por una, o encargárselo a una agencia. Lento, costoso — y a repetir en cada actualización del catálogo.' },
          { t: 'p', text: 'FeedPlug hace este trabajo de otra manera: **reglas de enriquecimiento + IA corrigen todo el catálogo de una vez**, y luego el feed corregido se publica y se **mantiene actualizado automáticamente** en cada uno de tus canales. La ganancia se vuelve alcanzable sin dedicarle semanas.' },
          { t: 'cta', text: 'Recuperar estos productos', kind: 'register' },
        ],
      },
      {
        subject: 'De {{score}} a {{scorePotentiel}}/100: cómo lo hace FeedPlug',
        preview: 'El mecanismo, paso a paso — sobre tu bloqueo principal.',
        blocks: [
          { t: 'h1', text: 'Esto es, concretamente, lo que hace FeedPlug' },
          { t: 'p', text: 'Tomemos tu bloqueo principal — {{blocage1}}. Así es como FeedPlug lo trata, y el resto del catálogo con él:' },
          { t: 'score' },
          { t: 'ol', items: [
            '**Conectas tu fuente una vez** (Shopify, CSV, PrestaShop…).',
            '**FeedPlug optimiza todo el catálogo** — títulos, descripciones, atributos — *adaptados a cada canal*, mediante reglas + IA.',
            '**Tú validas** los cambios: el antes/después es visible ficha por ficha.',
            '**El feed sale hacia Google, Amazon, Meta, marketplaces…** y se mantiene sincronizado en cada actualización de producto.',
          ] },
          { t: 'p', text: 'El resultado no es un archivo corregido una sola vez. Es un catálogo difundible en todas partes, que **no vuelve a degradarse** en la próxima actualización.' },
          { t: 'cta', text: 'Ver FeedPlug sobre mi catálogo', kind: 'register' },
        ],
      },
      {
        subject: '¿Revisamos juntos tu feed {{societe}}?',
        preview: 'Último recordatorio — y una propuesta.',
        blocks: [
          { t: 'h1', text: '¿Revisamos juntos tu feed?' },
          { t: 'p', text: '{{prenom}}, tu auditoría puso una cifra al potencial: **{{scorePotentiel}}/100 alcanzable**. FeedPlug existe precisamente para cerrar esa diferencia — sin dedicarle semanas, y sin que el feed se degrade después.' },
          { t: 'score' },
          { t: 'p', text: 'Si quieres, dedicamos 20 minutos: revisamos tu feed juntos y definimos el orden de las correcciones de mayor impacto. Sin compromiso.' },
          { t: 'p', text: 'Y si prefieres avanzar por tu cuenta, tu cuenta se crea en 2 minutos.' },
          { t: 'cta2', primary: { text: 'Reservar 20 minutos', kind: 'rdv' }, secondary: { text: 'Crear mi cuenta', kind: 'register' } },
        ],
      },
    ],
  },
};

const AUDIT_NURTURE_UI_LABELS = {
  fr: {
    scoreNow: 'Score actuel de votre flux',
    scorePotential: 'Potentiel',
    statRecoverable: 'produits récupérables',
    statVisibility: 'de visibilité en plus',
  },
  en: {
    scoreNow: 'Current feed score',
    scorePotential: 'Potential',
    statRecoverable: 'recoverable products',
    statVisibility: 'extra visibility',
  },
  es: {
    scoreNow: 'Puntuación actual de tu feed',
    scorePotential: 'Potencial',
    statRecoverable: 'productos recuperables',
    statVisibility: 'de visibilidad extra',
  },
};

function auditScoreColor(score) {
  if (score < 50) return '#dc2626';
  if (score < 70) return '#d97706';
  return '#16a34a';
}

// Carte score visuelle : score actuel, potentiel et barre de progression.
function renderAuditScoreCard(ctx, loc) {
  const score = Math.max(0, Math.min(100, Math.round(Number(ctx.score) || 0)));
  const potential = Math.max(0, Math.min(100, Math.round(Number(ctx.scorePotentiel) || 0)));
  const labels = AUDIT_NURTURE_UI_LABELS[loc] || AUDIT_NURTURE_UI_LABELS.fr;
  const color = auditScoreColor(score);
  const fill = Math.max(4, Math.min(100, score));
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 10px 0 22px;">
    <tr><td style="background:#f7f9fc;border:1px solid #e7ecf3;border-radius:14px;padding:20px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(labels.scoreNow)}</div>
          <div style="font-size:40px;font-weight:800;line-height:1.05;color:${color};margin-top:3px;">${score}<span style="font-size:17px;color:#cbd5e1;font-weight:700;">/100</span></div>
        </td>
        <td align="right" style="vertical-align:middle;">
          <div style="display:inline-block;background:#eef4ff;border:1px solid #d6e4ff;border-radius:999px;padding:8px 15px;font-size:13px;font-weight:700;color:#2563eb;">${escapeHtml(labels.scorePotential)}&nbsp;: ${potential}/100</div>
        </td>
      </tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
        <tr><td style="background:#e7ecf3;border-radius:999px;font-size:0;line-height:0;">
          <table role="presentation" width="${fill}%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="background:#2563eb;height:9px;border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

// Cartes "blocage" : une carte par point faible, bordée selon la sévérité.
function renderAuditIssueCards(ctx) {
  const issues = Array.isArray(ctx.issuesList) ? ctx.issuesList : [];
  if (issues.length === 0) return '';
  const sevColor = { high: '#dc2626', medium: '#d97706', low: '#64748b' };
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 4px 0 20px;">${issues
    .map((it, idx) => `
    <tr><td style="padding-bottom:${idx === issues.length - 1 ? '0' : '10px'};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:#ffffff;border:1px solid #e7ecf3;border-left:3px solid ${sevColor[it.severity] || sevColor.low};border-radius:10px;padding:13px 16px;">
          <div style="font-size:14px;font-weight:700;color:#0b1120;">${escapeHtml(it.label || '')}</div>
          ${it.detail ? `<div style="font-size:13px;line-height:1.5;color:#64748b;margin-top:3px;">${escapeHtml(it.detail)}</div>` : ''}
        </td>
      </tr></table>
    </td></tr>`)
    .join('')}</table>`;
}

// Deux tuiles chiffrées : produits récupérables + gain de visibilité.
function renderAuditStats(ctx, loc) {
  const labels = AUDIT_NURTURE_UI_LABELS[loc] || AUDIT_NURTURE_UI_LABELS.fr;
  const tile = (value, label) => `
    <td width="50%" style="padding:0 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:#f7f9fc;border:1px solid #e7ecf3;border-radius:12px;padding:18px 16px;text-align:center;">
          <div style="font-size:30px;font-weight:800;line-height:1.1;color:#2563eb;">${escapeHtml(value)}</div>
          <div style="font-size:12px;line-height:1.45;color:#64748b;margin-top:4px;">${escapeHtml(label)}</div>
        </td>
      </tr></table>
    </td>`;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 8px -6px 20px;"><tr>
    ${tile(String(ctx.produitsRecuperables ?? '—'), labels.statRecoverable)}
    ${tile(`+${ctx.gainVisibilite ?? 0}%`, labels.statVisibility)}
  </tr></table>`;
}

function renderAuditNurtureBlocks(blocks, ctx, email, trackTarget, loc) {
  const interp = (s) => String(s || '').replace(/\{\{(\w+)\}\}/g, (m, k) => escapeHtml(ctx[k] ?? ''));
  const md = (s) => interp(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  const ctaHref = (kind) => {
    if (kind === 'rdv') return String(ctx.lienRdv || MARKETING_RDV_URL);
    if (kind === 'audit') return String(ctx.lienAudit || `${APP_URL}/register`);
    if (kind === 'pdf') return String(ctx.lienAuditPdf || ctx.lienAudit || `${APP_URL}/register`);
    return getMarketingCtaHref(email, trackTarget, `${APP_URL}/register`);
  };
  // Bouton robuste (table-based) pour passer correctement sous Outlook.
  const button = (href, label) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 4px 0;"><tr>
      <td style="background:#2563eb;border-radius:10px;">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(label)}</a>
      </td>
    </tr></table>`;
  return (blocks || []).map((b) => {
    if (b.t === 'h1') return `<h1>${md(b.text)}</h1>`;
    if (b.t === 'p') return `<p>${md(b.text)}</p>`;
    if (b.t === 'score') return renderAuditScoreCard(ctx, loc);
    if (b.t === 'issuecards') return renderAuditIssueCards(ctx);
    if (b.t === 'stats') return renderAuditStats(ctx, loc);
    if (b.t === 'ul') return `<ul>${b.items.map((i) => `<li>${md(i)}</li>`).join('')}</ul>`;
    if (b.t === 'ol') {
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 4px 0 18px;">${b.items
        .map((i, idx) => `
        <tr><td style="padding-bottom:${idx === b.items.length - 1 ? '0' : '10px'};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="34" style="vertical-align:top;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="26" height="26" align="center" style="background:#eef4ff;border-radius:999px;color:#2563eb;font-size:13px;font-weight:800;">${idx + 1}</td>
              </tr></table>
            </td>
            <td style="vertical-align:top;font-size:15px;line-height:1.6;color:#334155;padding-top:2px;">${md(i)}</td>
          </tr></table>
        </td></tr>`)
        .join('')}</table>`;
    }
    if (b.t === 'cta') {
      return `<div style="margin-top:24px;">${button(ctaHref(b.kind), interp(b.text))}</div>`;
    }
    if (b.t === 'cta2') {
      return `<div style="margin-top:24px;">${button(ctaHref(b.primary.kind), interp(b.primary.text))}</div>`
        + `<p style="margin-top:12px;"><a href="${escapeHtml(ctaHref(b.secondary.kind))}" style="color:#2563eb;font-weight:600;font-size:14px;">${escapeHtml(interp(b.secondary.text))}</a></p>`;
    }
    if (b.t === 'linkline') {
      const href = ctaHref(b.kind);
      return `<p class="muted-small" style="margin-top:18px;">${escapeHtml(interp(b.label))} <a href="${escapeHtml(href)}" style="color:#2563eb;">${escapeHtml(href)}</a></p>`;
    }
    if (b.t === 'doclink') {
      return `<p style="margin-top:18px;"><a href="${escapeHtml(ctaHref(b.kind))}" style="color:#2563eb;font-weight:600;font-size:14px;text-decoration:none;">${escapeHtml(interp(b.label))}</a></p>`;
    }
    return '';
  }).join('\n');
}

// Version texte brut (améliore la délivrabilité : ratio HTML/texte).
function renderAuditNurtureText(blocks, ctx, loc) {
  const labels = AUDIT_NURTURE_UI_LABELS[loc] || AUDIT_NURTURE_UI_LABELS.fr;
  const interp = (s) => String(s || '')
    .replace(/\{\{(\w+)\}\}/g, (m, k) => String(ctx[k] ?? ''))
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1');
  const ctaHref = (kind) => {
    if (kind === 'rdv') return String(ctx.lienRdv || MARKETING_RDV_URL);
    if (kind === 'audit') return String(ctx.lienAudit || `${APP_URL}/register`);
    return `${APP_URL}/register`;
  };
  const lines = [];
  for (const b of blocks || []) {
    if (b.t === 'h1' || b.t === 'p') lines.push(interp(b.text));
    else if (b.t === 'score') lines.push(`${labels.scoreNow}: ${ctx.score}/100  —  ${labels.scorePotential}: ${ctx.scorePotentiel}/100`);
    else if (b.t === 'issuecards') (ctx.issuesList || []).forEach((it) => lines.push(`- ${it.label}${it.detail ? ` (${it.detail})` : ''}`));
    else if (b.t === 'stats') lines.push(`${ctx.produitsRecuperables} ${labels.statRecoverable}  —  +${ctx.gainVisibilite}% ${labels.statVisibility}`);
    else if (b.t === 'ul') (b.items || []).forEach((i) => lines.push(`- ${interp(i)}`));
    else if (b.t === 'ol') (b.items || []).forEach((i, idx) => lines.push(`${idx + 1}. ${interp(i)}`));
    else if (b.t === 'cta' || b.t === 'doclink') lines.push(`${interp(b.text || b.label)} : ${ctaHref(b.kind)}`);
    else if (b.t === 'cta2') {
      lines.push(`${interp(b.primary.text)} : ${ctaHref(b.primary.kind)}`);
      lines.push(`${interp(b.secondary.text)} : ${ctaHref(b.secondary.kind)}`);
    } else if (b.t === 'linkline') lines.push(`${interp(b.label)} ${ctaHref(b.kind)}`);
  }
  lines.push('');
  lines.push('— FeedPlug · app.feedplug.com');
  return lines.join('\n\n');
}

/**
 * Envoie un mail de nurture post-audit personnalisé.
 * @param {object} args
 * @param {string} args.segment 'A' (audit non terminé) ou 'B' (audit vu).
 * @param {number} args.step 1-based, position dans le segment.
 * @param {object} args.context variables {{...}} déjà résolues.
 */
async function sendMarketingAuditNurtureEmail({ email, locale = DEFAULT_EMAIL_LOCALE, segment, step, context = {} }) {
  const loc = getEmailLocale(locale);
  const bundle = AUDIT_NURTURE_SEQUENCE[loc] || AUDIT_NURTURE_SEQUENCE[DEFAULT_EMAIL_LOCALE];
  const seg = String(segment || 'B').toUpperCase() === 'A' ? 'a' : 'b';
  const list = bundle[seg] || [];
  const idx = Math.max(0, Math.min(list.length - 1, Number(step || 1) - 1));
  const copy = list[idx];
  if (!copy) throw new Error(`Audit nurture copy introuvable: ${loc}/${seg}/${step}`);

  const trackTarget = `audit_${seg}${idx + 1}`;
  const interpPlain = (s) => String(s || '').replace(/\{\{(\w+)\}\}/g, (m, k) => String(context[k] ?? ''));
  const subject = interpPlain(copy.subject);
  const previewText = interpPlain(copy.preview);
  const content = renderAuditNurtureBlocks(copy.blocks, context, email, trackTarget, loc);
  const html = baseTemplate(content, { locale: loc, marketingEmail: email, previewText });
  const text = renderAuditNurtureText(copy.blocks, context, loc);

  return dispatchEmail({
    to: email,
    subject,
    html,
    text,
    replyTo: MARKETING_REPLY_TO,
    headers: buildMarketingHeaders(email),
    marketing: true,
    tags: [
      { name: 'category', value: 'marketing_audit_nurture' },
      { name: 'segment', value: `audit_${seg}` },
      { name: 'step', value: String(idx + 1) },
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
    headers: buildMarketingHeaders(email),
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

/**
 * Notification interne simple (texte brut) — utilisée par les webhooks
 * compliance Shopify et autres alertes opérationnelles qui n'ont pas besoin
 * du template marketing.
 */
async function notifyInternalAlert({ subject, body }) {
  if (INTERNAL_ALERT_EMAILS.length === 0) {
    return null;
  }
  const safeBody = String(body || '');
  const html = `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${escapeHtml(safeBody)}</pre>`;
  return dispatchEmail({
    to: INTERNAL_ALERT_EMAILS,
    subject: String(subject || 'FeedPlug — alerte interne'),
    html,
    text: safeBody,
    tags: [{ name: 'category', value: 'internal_ops_alert' }],
  });
}

module.exports = {
  sendWelcomeEmail,
  sendSyncCompleteEmail,
  sendExportCompleteEmail,
  sendErrorEmail,
  sendPasswordResetEmail,
  sendComparatorMagicLinkEmail,
  sendInvitationEmail,
  sendMarketingNurtureEmail,
  sendMarketingAuditNurtureEmail,
  sendMarketingAuditEmail,
  syncMarketingContact,
  createMarketingClickToken,
  verifyMarketingClickToken,
  getMarketingTrackedUrl,
  createMarketingUnsubscribeToken,
  verifyMarketingUnsubscribeToken,
  notifyInternalMarketingFormSubmission,
  notifyInternalAlert,
  SUPPORTED_EMAIL_LOCALES,
  getEmailLocale,
};

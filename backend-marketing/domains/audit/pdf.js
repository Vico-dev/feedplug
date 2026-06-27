'use strict';

/**
 * domains/audit/pdf.js — Generation du PDF d'audit marketing (bloc 4).
 *
 * EXTRACTION STRANGLER A COMPORTEMENT STRICTEMENT PRESERVE.
 * Sorti A L'IDENTIQUE de la fonction geante run() de server-minimal.js
 * (memes options Puppeteer --no-sandbox / networkidle0 / timeout 20s, meme
 * singleton Chromium auditPdfBrowserPromise, meme resolution du binaire Chromium,
 * meme HTML print A4, meme fallback pdfkit buildMarketingAuditPdfBuffer).
 * AUCUN changement fonctionnel.
 *
 * Ces fonctions n'ont AUCUNE dependance a l'etat serveur (pas de prisma, pas de
 * closure de run()) : elles require paresseusement leurs modules (puppeteer-core,
 * pdfkit, fs) et n'operent que sur leurs arguments. Elles sont donc exportees
 * DIRECTEMENT (pas de factory DI necessaire).
 *
 * Les ROUTES qui declenchent la generation PDF RESTENT dans server-minimal.js /
 * routes/marketing.js ; elles recoivent buildAuditReportHtml, renderAuditReportPdf
 * et buildMarketingAuditPdfBuffer via injection (registerMarketingRoutes). Les
 * symboles internes (auditPdfEscape, AUDIT_PDF_SEVERITY, buildAuditRadarSvg,
 * resolveChromiumPath, getAuditPdfBrowser, le singleton auditPdfBrowserPromise)
 * restent prives au module.
 */

// ── PDF d'audit premium (HTML → PDF via Chromium) ────────────────────────────

const AUDIT_PDF_FIELD_LABELS_FR = {
  description: 'Description', identifier: 'Identifiant (GTIN/MPN)',
  brand: 'Marque', category: 'Catégorie', title: 'Titre',
};

function auditPdfEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Style d'un blocage selon la sévérité — calqué sur getIssueStyle() du front.
const AUDIT_PDF_SEVERITY = {
  high: { border: '#FECACA', bg: '#FEF1F1', text: '#B42318', label: 'Priorité haute' },
  medium: { border: '#FDE68A', bg: '#FEF6E7', text: '#B45309', label: 'Priorité moyenne' },
  low: { border: '#CFCFCF', bg: '#F2F2F2', text: '#2A2A2A', label: 'Priorité basse' },
};

// Radar / "araignée" SVG des piliers du flux — lecture instantanée des points faibles.
function buildAuditRadarSvg(pillars) {
  const list = (Array.isArray(pillars) ? pillars : []).slice(0, 6);
  const n = list.length;
  if (n < 3) return '';
  const cx = 230;
  const cy = 152;
  const R = 84;
  const angle = (i) => (-90 + i * (360 / n)) * Math.PI / 180;
  const point = (i, radius) => {
    const a = angle(i);
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  };
  const clampScore = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const polyPoints = (radiusFor) => list
    .map((_, i) => point(i, radiusFor(i)).map((v) => v.toFixed(1)).join(','))
    .join(' ');

  const rings = [0.25, 0.5, 0.75, 1]
    .map((lvl) => `<polygon points="${polyPoints(() => R * lvl)}" fill="none" stroke="#E5E5E5" stroke-width="1"/>`)
    .join('');
  const axes = list
    .map((_, i) => {
      const [x, y] = point(i, R);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#E5E5E5" stroke-width="1"/>`;
    })
    .join('');
  const dataPoints = polyPoints((i) => (R * clampScore(list[i].score)) / 100);
  const dots = list
    .map((_, i) => {
      const [x, y] = point(i, (R * clampScore(list[i].score)) / 100);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="#2A6FE8"/>`;
    })
    .join('');
  const labels = list
    .map((p, i) => {
      const [lx, ly] = point(i, R + 15);
      const anchor = lx > cx + 6 ? 'start' : lx < cx - 6 ? 'end' : 'middle';
      const dy = ly < cy - 6 ? -3 : ly > cy + 6 ? 11 : 4;
      const v = Math.round(clampScore(p.score));
      return `<text x="${lx.toFixed(1)}" y="${(ly + dy).toFixed(1)}" text-anchor="${anchor}" font-size="9.5" font-weight="600" fill="#2A2A2A">${auditPdfEscape(p.label)}</text>`
        + `<text x="${lx.toFixed(1)}" y="${(ly + dy + 12).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="#2A6FE8">${v}/100</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 460 312" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="'Hanken Grotesk',sans-serif">
    ${rings}${axes}
    <polygon points="${dataPoints}" fill="rgba(42,111,232,0.14)" stroke="#2A6FE8" stroke-width="2" stroke-linejoin="round"/>
    ${dots}${labels}
  </svg>`;
}

// Construit le document HTML (print A4) du rapport d'audit.
// Aligné sur le design system FeedPlug ("Tesla mineral") : surface off-white,
// encre near-black, accent bleu acier #2A6FE8, typo Bricolage / Hanken Grotesk.
function buildAuditReportHtml(audit) {
  const esc = auditPdfEscape;
  const report = audit.report || {};
  const score = Math.max(0, Math.min(100, Math.round(Number(report.score) || 0)));
  const potential = Math.max(0, Math.min(100, Math.round(Number(report.potentialScore) || 0)));
  const band = report.scoreBand || {};
  const pillars = Array.isArray(report.auditPillars) ? report.auditPillars : [];
  const issues = Array.isArray(report.topIssues) ? report.topIssues : [];
  const samples = Array.isArray(report.sampleProducts) ? report.sampleProducts : [];
  const createdAt = audit.createdAt ? new Date(audit.createdAt) : new Date();
  const dateStr = createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const radarSvg = buildAuditRadarSvg(pillars);
  const pillarsHtml = pillars.map((p) => {
    const v = Math.max(0, Math.min(100, Math.round(Number(p.score) || 0)));
    return `
    <div style="margin-bottom:14px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:12.5px;font-weight:600;color:#0A0A0A;">${esc(p.label)}</td>
        <td style="text-align:right;font-size:12.5px;font-weight:700;color:#2A6FE8;">${v}/100</td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr>
        <td style="background:#E5E5E5;border-radius:999px;font-size:0;">
          <table width="${Math.max(4, v)}%" cellpadding="0" cellspacing="0"><tr>
            <td style="background:#2A6FE8;height:7px;border-radius:999px;font-size:0;">&nbsp;</td>
          </tr></table>
        </td>
      </tr></table>
    </div>`;
  }).join('');

  const issuesHtml = issues.slice(0, 5).map((it, idx) => {
    const sev = AUDIT_PDF_SEVERITY[it.severity] || AUDIT_PDF_SEVERITY.low;
    return `
    <div class="issue" style="background:${sev.bg};border:1px solid ${sev.border};">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${sev.text};">${esc(sev.label)}</div>
          <div style="font-size:15px;font-weight:700;color:#0A0A0A;margin-top:6px;">${idx + 1}. ${esc(it.label)}</div>
        </td>
        <td style="vertical-align:top;text-align:right;width:60px;">
          <span style="display:inline-block;background:#fff;border:1px solid ${sev.border};color:${sev.text};font-size:12px;font-weight:700;border-radius:999px;padding:4px 9px;">${esc(it.affectedRate || 0)}%</span>
        </td>
      </tr></table>
      <div style="font-size:12.5px;line-height:1.65;color:#2A2A2A;margin-top:10px;">${esc(it.affectedProducts || 0)} produits concernés. ${esc(it.impact || '')}</div>
      ${it.recommendation ? `<div style="font-size:12.5px;line-height:1.65;color:#2A2A2A;margin-top:5px;"><strong style="color:#0A0A0A;">Action recommandée :</strong> ${esc(it.recommendation)}</div>` : ''}
    </div>`;
  }).join('');

  const samplesHtml = samples.map((s, idx) => {
    const before = s.before || {};
    const after = s.after || null;
    const beforeIssues = Array.isArray(before.issues)
      ? before.issues.map((k) => AUDIT_PDF_FIELD_LABELS_FR[k] || k)
      : [];
    const afterAttrs = after && Array.isArray(after.attributes) ? after.attributes : [];
    // Images affichées uniquement si on a l'après (sample hero only),
    // sinon on garde une mise en page symétrique full-texte.
    const showImages = !!(before.imageUrl && after && after.imageUrl);
    const imgStyle = 'display:block;width:100%;height:130px;object-fit:contain;background:#FFFFFF;border-radius:14px;margin-bottom:10px;';
    return `
    <div class="ba-block">
      <div class="eyebrow" style="margin-bottom:9px;">Fiche produit ${idx + 1}</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>
        <td style="width:50%;vertical-align:top;padding-right:8px;">
          <div class="ba-card" style="background:#FEF1F1;border:1px solid #FECACA;">
            ${showImages ? `<img src="${esc(before.imageUrl)}" style="${imgStyle}" alt="Avant">` : ''}
            <div class="ba-tag" style="color:#B42318;">Avant</div>
            <div class="ba-title">${esc(before.title) || '<span style="color:#B0B0B0;">(titre vide)</span>'}</div>
            <div class="ba-desc">${esc(before.description) || '<span style="color:#B0B0B0;">(description vide)</span>'}</div>
            ${beforeIssues.length ? `<div style="margin-top:10px;">${beforeIssues.map((i) => `<span class="chip" style="background:#fff;border:1px solid #FECACA;color:#B42318;">✕ ${esc(i)}</span>`).join('')}</div>` : ''}
          </div>
        </td>
        <td style="width:50%;vertical-align:top;padding-left:8px;">
          <div class="ba-card" style="background:#ECFDF3;border:1px solid #BBF7D0;">
            ${showImages ? `<img src="${esc(after.imageUrl)}" style="${imgStyle}" alt="Après">` : ''}
            <div class="ba-tag" style="color:#15803D;">Après — corrigé par FeedPlug</div>
            ${after ? `
            <div class="ba-title">${esc(after.title)}</div>
            <div class="ba-desc">${esc(after.description)}</div>
            ${afterAttrs.length ? `<div style="margin-top:10px;">${afterAttrs.map((a) => `<div style="font-size:11.5px;color:#0A0A0A;margin-bottom:3px;"><strong style="color:#15803D;">${esc(a.label)} :</strong> ${esc(a.value)}</div>`).join('')}</div>` : ''}
            ` : '<div class="ba-desc" style="color:#6F6F6F;">Version optimisée générée dans votre espace FeedPlug.</div>'}
          </div>
        </td>
      </tr></table>
    </div>`;
  }).join('');

  const planSteps = issues.slice(0, 4).map((it) => it.recommendation || `Corriger : ${it.label}`);
  planSteps.push('Brancher FeedPlug pour appliquer et maintenir ces corrections automatiquement sur tous les canaux.');
  const planHtml = planSteps.map((step, idx) => `
    <tr>
      <td style="width:32px;vertical-align:top;padding:7px 0;">
        <div style="width:26px;height:26px;line-height:26px;text-align:center;background:#E8EFFB;border-radius:999px;color:#2A6FE8;font-size:12px;font-weight:700;">${idx + 1}</div>
      </td>
      <td style="padding:7px 0 7px 12px;font-size:13.5px;line-height:1.6;color:#2A2A2A;">${esc(step)}</td>
    </tr>`).join('');

  const statCell = (value, label, color) => `
    <div class="stat">
      <div class="stat-v" style="color:${color};">${esc(value)}</div>
      <div class="stat-l">${esc(label)}</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin:0; background:#FAFAFA; color:#0A0A0A;
    font-family:'Hanken Grotesk',ui-sans-serif,system-ui,-apple-system,sans-serif;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .display { font-family:'Bricolage Grotesque','Hanken Grotesk',sans-serif; }
  .cover { padding:46px 56px 30px; border-bottom:1px solid #E5E5E5; }
  .wrap { padding:36px 56px 48px; }
  .eyebrow { font-size:11px; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; color:#2A6FE8; }
  /* Empêcher un titre h2 d'être laissé seul en bas de page sans son contenu.
     break-after:avoid est la prop moderne, page-break-after:avoid le fallback
     historique encore lu par Chromium / Skia PDF. */
  h2 { font-family:'Bricolage Grotesque',sans-serif; font-size:19px; font-weight:700; color:#0A0A0A; margin:0 0 14px; letter-spacing:-0.01em; page-break-after:avoid; break-after:avoid; }
  .section { margin-bottom:28px; }
  .card { background:#FFFFFF; border:1px solid #E5E5E5; border-radius:20px; padding:22px; page-break-inside:avoid; }
  .issue { border-radius:20px; padding:18px 20px; margin-bottom:12px; page-break-inside:avoid; }
  .ba-block { margin-bottom:16px; page-break-inside:avoid; }
  .ba-card { border-radius:20px; padding:16px 17px; min-height:148px; }
  .ba-tag { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:9px; }
  .ba-title { font-size:13px; font-weight:700; color:#0A0A0A; line-height:1.42; margin-bottom:7px; }
  .ba-desc { font-size:11.5px; color:#2A2A2A; line-height:1.6; }
  .chip { display:inline-block; font-size:10px; font-weight:600; border-radius:6px; padding:3px 8px; margin:0 5px 5px 0; }
  .stat { background:#FFFFFF; border:1px solid #E5E5E5; border-radius:20px; padding:20px 18px; }
  .stat-v { font-family:'Bricolage Grotesque',sans-serif; font-size:32px; font-weight:700; line-height:1; letter-spacing:-0.04em; }
  .stat-l { font-size:12.5px; color:#6F6F6F; margin-top:9px; line-height:1.45; }
</style></head>
<body>
  <div class="cover">
    <div class="display" style="font-size:18px;font-weight:700;color:#0A0A0A;letter-spacing:-0.02em;">FeedPlug</div>
    <div class="eyebrow" style="margin-top:34px;">Rapport d'audit · ${esc(dateStr)}</div>
    <div class="display" style="font-size:34px;font-weight:700;color:#0A0A0A;letter-spacing:-0.02em;margin-top:10px;">Audit de flux produit</div>
    <div style="font-size:14px;color:#6F6F6F;margin-top:10px;">
      ${esc(audit.company || 'Votre catalogue')} &nbsp;·&nbsp; ${esc(audit.cmsUsed || audit.connectorType || 'Source')} &nbsp;·&nbsp; ${esc((report.summary && report.summary.totalProducts) || audit.catalogSize || 0)} produits
    </div>
  </div>
  <div class="wrap">

    <div class="section">
      <h2>Synthèse</h2>
      <div class="card">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            <div style="font-size:12.5px;font-weight:600;color:#6F6F6F;">Score actuel du flux</div>
            <div class="display" style="font-size:52px;font-weight:700;line-height:1;letter-spacing:-0.04em;color:#2A6FE8;margin-top:6px;">${score}<span style="font-size:20px;color:#B0B0B0;">/100</span></div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:#E8EFFB;border-radius:999px;padding:9px 16px;font-size:13px;font-weight:700;color:#1F58C0;">Potentiel atteignable&nbsp;: ${potential}/100</span>
          </td>
        </tr></table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>
          <td style="background:#E5E5E5;border-radius:999px;font-size:0;">
            <table width="${Math.max(4, score)}%" cellpadding="0" cellspacing="0"><tr><td style="background:#2A6FE8;height:10px;border-radius:999px;font-size:0;">&nbsp;</td></tr></table>
          </td>
        </tr></table>
        ${band.label ? `<div style="margin-top:16px;padding-top:15px;border-top:1px solid #E5E5E5;font-size:13px;line-height:1.65;color:#2A2A2A;"><strong class="display" style="color:#0A0A0A;">Niveau ${esc(band.label)}.</strong> ${esc(band.description || '')}</div>` : ''}
      </div>
    </div>

    <div class="section">
      <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>
        <td style="width:33.33%;padding-right:7px;vertical-align:top;">${statCell(report.estimatedAdditionalApprovedProducts || 0, 'produits récupérables', '#15803D')}</td>
        <td style="width:33.33%;padding:0 7px;vertical-align:top;">${statCell(`+${report.estimatedVisibilityLiftPct || 0}%`, 'de visibilité estimée', '#2A6FE8')}</td>
        <td style="width:33.33%;padding-left:7px;vertical-align:top;">${statCell(`${(report.summary && report.summary.approvalReadyRate) || 0}%`, 'produits déjà prêts', '#2A6FE8')}</td>
      </tr></table>
    </div>

    ${pillars.length ? `<div class="section">
      <h2>Le profil de votre flux</h2>
      <div class="card">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:54%;vertical-align:middle;padding-right:18px;">${radarSvg}</td>
          <td style="width:46%;vertical-align:middle;padding-left:20px;border-left:1px solid #E5E5E5;">${pillarsHtml}</td>
        </tr></table>
      </div>
    </div>` : ''}

    <div class="section">
      <h2>Les blocages prioritaires</h2>
      ${issuesHtml || '<div class="card">Aucun blocage majeur détecté.</div>'}
    </div>

    ${samples.length ? `<div class="section">
      <h2>Avant / Après sur votre catalogue</h2>
      <p style="font-size:13px;color:#6F6F6F;margin:0 0 16px;line-height:1.6;">Un échantillon de vos fiches, corrigées par FeedPlug — titres, descriptions et attributs.</p>
      ${samplesHtml}
    </div>` : ''}

    <div class="section">
      <h2>Plan d'action</h2>
      <div class="card"><table width="100%" cellpadding="0" cellspacing="0">${planHtml}</table></div>
    </div>

    <div style="border-top:1px solid #E5E5E5;padding-top:18px;">
      ${report.methodology ? `<div style="font-size:10.5px;color:#B0B0B0;line-height:1.65;">${esc(report.methodology.scoring || '')} ${esc(report.methodology.estimation || '')}</div>` : ''}
      <div style="margin-top:13px;font-size:12px;color:#6F6F6F;">Audit complet et version optimisée du catalogue&nbsp;: <strong style="color:#2A6FE8;">${esc(audit.shareUrl || 'feedplug.com')}</strong></div>
    </div>

  </div>
</body></html>`;
}

let auditPdfBrowserPromise = null;

// Résout le chemin du binaire Chromium parmi les emplacements connus.
function resolveChromiumPath() {
  const fs = require('fs');
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch { /* ignore */ }
  }
  return candidates[0] || '/usr/bin/chromium';
}

// Lance (ou réutilise) un Chromium headless adapté à Cloud Run.
async function getAuditPdfBrowser() {
  const puppeteer = require('puppeteer-core');
  if (auditPdfBrowserPromise) {
    try {
      const existing = await auditPdfBrowserPromise;
      if (existing && existing.connected !== false && existing.isConnected && existing.isConnected()) {
        return existing;
      }
    } catch {
      auditPdfBrowserPromise = null;
    }
  }
  const executablePath = resolveChromiumPath();
  console.log(`🖨️  Lancement Chromium pour PDF audit: ${executablePath}`);
  auditPdfBrowserPromise = puppeteer.launch({
    executablePath,
    headless: true,
    dumpio: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-crash-reporter',
      '--disable-breakpad',
      '--disable-software-rasterizer',
    ],
  });
  return auditPdfBrowserPromise;
}

// Rend un document HTML en PDF (buffer) via Chromium headless.
async function renderAuditReportPdf(html) {
  const browser = await getAuditPdfBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    const pdfData = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    // Puppeteer v23 renvoie un Uint8Array : on le convertit en Buffer Node
    // pour qu'Express l'envoie en binaire (sinon sérialisé en JSON).
    return Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);
  } finally {
    await page.close().catch(() => {});
  }
}

function buildMarketingAuditPdfBuffer(auditPayload) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const audit = auditPayload || {};
    const report = audit.report || {};
    const summary = report.summary || {};
    const issues = Array.isArray(report.topIssues) ? report.topIssues : [];
    const isReady = audit.status === 'ready' && report && Object.keys(report).length > 0;

    doc.fontSize(24).fillColor('#0f172a').text('FeedPlug - Audit de flux produit');
    doc.moveDown(0.4);
    doc.fontSize(12).fillColor('#475569').text(`${audit.company || 'Entreprise'} · ${audit.cmsUsed || audit.connectorType || 'SOURCE'} · ${summary.totalProducts || audit.catalogSize || 0} produits`);
    doc.text(`Lien partageable: ${audit.shareUrl || ''}`);
    doc.moveDown();

    if (!isReady) {
      doc.fontSize(16).fillColor('#0f172a').text('Statut');
      doc.moveDown(0.4);
      doc.fontSize(12).fillColor('#111827').text('Audit technique gratuit en preparation.');
      doc.text('Le score n est pas encore affiche, car FeedPlug attend une connexion reelle a la source pour analyser les donnees du flux.');
      doc.moveDown(0.6);
      doc.text(`Statut actuel: ${audit.status || 'pending_connection'}`);
      doc.moveDown();
      doc.fontSize(16).fillColor('#0f172a').text('Prochaine etape');
      doc.moveDown(0.4);
      doc.fontSize(12).fillColor('#111827').text('Connectez la source catalogue pour lancer l analyse technique reelle.');
      doc.end();
      return;
    }

    doc.fontSize(16).fillColor('#0f172a').text('Synthese');
    doc.moveDown(0.4);
    doc.fontSize(12).fillColor('#111827');
    doc.text(`Score actuel: ${report.score || 0}/100`);
    doc.text(`Potentiel estime: ${report.potentialScore || 0}/100`);
    doc.text(`Produits recuperables: ${report.estimatedAdditionalApprovedProducts || 0}`);
    doc.text(`Gain de visibilite estime: ${report.estimatedVisibilityLiftPct || 0}%`);
    doc.moveDown();

    doc.fontSize(16).fillColor('#0f172a').text('Breakdown');
    doc.moveDown(0.4);
    doc.fontSize(12).fillColor('#111827');
    const breakdown = report.scoreBreakdown || {};
    doc.text(`Couverture des donnees: ${breakdown.dataCoverage || 0}/100`);
    doc.text(`Qualite produit moyenne: ${breakdown.productQuality || 0}/100`);
    doc.text(`Readiness canal: ${breakdown.channelReadiness || 0}/100`);
    doc.text(`Produits deja prets: ${summary.approvalReadyRate || 0}%`);
    doc.moveDown();

    doc.fontSize(16).fillColor('#0f172a').text('Priorites');
    doc.moveDown(0.4);
    issues.slice(0, 5).forEach((issue, index) => {
      doc.fontSize(12).fillColor('#111827').text(`${index + 1}. ${issue.label} - ${issue.affectedRate || 0}% du catalogue`, { continued: false });
      doc.fontSize(11).fillColor('#475569').text(`Impact: ${issue.impact || ''}`);
      doc.text(`Action: ${issue.recommendation || ''}`);
      doc.moveDown(0.5);
    });

    if (report.methodology) {
      doc.moveDown();
      doc.fontSize(16).fillColor('#0f172a').text('Methodologie');
      doc.moveDown(0.4);
      doc.fontSize(11).fillColor('#475569').text(report.methodology.scoring || '');
      doc.moveDown(0.3);
      doc.text(report.methodology.estimation || '');
    }

    doc.end();
  });
}

module.exports = {
  buildAuditReportHtml,
  renderAuditReportPdf,
  buildMarketingAuditPdfBuffer,
};

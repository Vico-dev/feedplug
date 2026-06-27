'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAuditReportHtml,
  renderAuditReportPdf,
  buildMarketingAuditPdfBuffer,
} = require('../../domains/audit/pdf');

// ---------------------------------------------------------------------------
// Surface du module
// ---------------------------------------------------------------------------
test('module exposes the three injected functions', () => {
  assert.equal(typeof buildAuditReportHtml, 'function');
  assert.equal(typeof renderAuditReportPdf, 'function');
  assert.equal(typeof buildMarketingAuditPdfBuffer, 'function');
});

// ---------------------------------------------------------------------------
// buildAuditReportHtml — pur, déterministe, A4 print HTML
// ---------------------------------------------------------------------------
const SAMPLE_AUDIT = {
  company: 'Acme & Co',
  cmsUsed: 'Shopify',
  shareUrl: 'feedplug.com/a/xyz',
  createdAt: '2026-06-01T10:00:00.000Z',
  status: 'ready',
  report: {
    score: 62,
    potentialScore: 91,
    scoreBand: { label: 'Correct', description: 'Quelques optimisations possibles.' },
    summary: { totalProducts: 1200, approvalReadyRate: 48 },
    estimatedAdditionalApprovedProducts: 340,
    estimatedVisibilityLiftPct: 27,
    auditPillars: [
      { label: 'Données', score: 70 },
      { label: 'Qualité', score: 55 },
      { label: 'Canal', score: 60 },
      { label: 'Images', score: 80 },
    ],
    topIssues: [
      { severity: 'high', label: 'GTIN manquants', affectedRate: 40, affectedProducts: 480, impact: 'Rejets GMC', recommendation: 'Ajouter les GTIN' },
      { severity: 'medium', label: 'Titres courts', affectedRate: 22, affectedProducts: 264, impact: 'Moins de clics' },
    ],
    sampleProducts: [
      {
        before: { title: 'T-shirt', description: 'desc', imageUrl: 'https://x/i.jpg', issues: ['description', 'identifier'] },
        after: { title: 'T-shirt coton bio', description: 'desc opt', imageUrl: 'https://x/o.jpg', attributes: [{ label: 'GTIN', value: '123' }] },
      },
    ],
    methodology: { scoring: 'Scoring sur 100.', estimation: 'Estimation prudente.' },
  },
};

test('buildAuditReportHtml returns a full A4 print HTML document', () => {
  const html = buildAuditReportHtml(SAMPLE_AUDIT);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /@page \{ size: A4/);
  assert.match(html, /62<span/);          // score
  assert.match(html, /Potentiel atteignable&nbsp;: 91\/100/);
  assert.match(html, /Niveau Correct/);
  assert.match(html, /GTIN manquants/);   // top issue label
  assert.match(html, /<svg viewBox="0 0 460 312"/); // radar (4 pillars >= 3)
});

test('buildAuditReportHtml escapes HTML-unsafe values', () => {
  const html = buildAuditReportHtml(SAMPLE_AUDIT);
  assert.match(html, /Acme &amp; Co/);
  assert.doesNotMatch(html, /Acme & Co/);
});

test('buildAuditReportHtml omits radar when fewer than 3 pillars', () => {
  const audit = { ...SAMPLE_AUDIT, report: { ...SAMPLE_AUDIT.report, auditPillars: [{ label: 'A', score: 50 }, { label: 'B', score: 60 }] } };
  const html = buildAuditReportHtml(audit);
  assert.doesNotMatch(html, /<svg viewBox="0 0 460 312"/);
});

test('buildAuditReportHtml clamps scores into [0,100]', () => {
  const audit = { ...SAMPLE_AUDIT, report: { ...SAMPLE_AUDIT.report, score: 250, potentialScore: -10, auditPillars: [] } };
  const html = buildAuditReportHtml(audit);
  assert.match(html, /100<span/);  // clamped high
  assert.match(html, /0\/100/);    // clamped low somewhere
});

// ---------------------------------------------------------------------------
// buildMarketingAuditPdfBuffer — fallback pdfkit (pas de Chromium requis)
// ---------------------------------------------------------------------------
test('buildMarketingAuditPdfBuffer produces a valid PDF buffer (ready audit)', async () => {
  const buf = await buildMarketingAuditPdfBuffer(SAMPLE_AUDIT);
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 0);
  assert.equal(buf.subarray(0, 5).toString('latin1'), '%PDF-');
});

test('buildMarketingAuditPdfBuffer handles a not-ready audit', async () => {
  const buf = await buildMarketingAuditPdfBuffer({ status: 'pending_connection', report: {} });
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.subarray(0, 5).toString('latin1'), '%PDF-');
});

// NB : renderAuditReportPdf nécessite un binaire Chromium (puppeteer-core) et un
// vrai rendu réseau ; non testé unitairement ici (dépendance environnement).
// Sa signature/présence est couverte par le test de surface ci-dessus.

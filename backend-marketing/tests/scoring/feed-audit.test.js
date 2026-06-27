'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildFeedAuditIssues,
  calculateFeedAuditSummary,
  buildAuditSummaryFromItems,
} = require('../../scoring/feed-audit');

// ---------------------------------------------------------------------------
// buildAuditSummaryFromItems — couverture des champs
// ---------------------------------------------------------------------------
test('buildAuditSummaryFromItems counts missing fields and ready/blocking', () => {
  const items = [
    {
      title: 'Produit A', descriptionText: 'desc', imageUrl: 'http://x/a.jpg',
      brand: 'Acme', category: 'Cat', gtin: '123', price: 10, url: 'http://x/a',
      availability: 'in stock', inventory: 5,
    },
    {
      // tout manquant sauf un peu : titre vide → blocking
      title: '', descriptionHtml: null, imageUrl: '', brand: '', price: null,
      sku: '', url: '', inventory: null,
    },
  ];
  const s = buildAuditSummaryFromItems(items);
  assert.equal(s.total, 2);
  assert.equal(s.missing_title, 1);
  assert.equal(s.missing_image, 1);
  assert.equal(s.missing_price, 1);
  assert.equal(s.missing_identifier, 1);
  assert.equal(s.ready_for_channels, 1);
  assert.equal(s.blocking_core, 1);
});

test('buildAuditSummaryFromItems handles empty input', () => {
  const s = buildAuditSummaryFromItems([]);
  assert.equal(s.total, 0);
  assert.equal(s.ready_for_channels, 0);
  assert.equal(s.blocking_core, 0);
});

test('buildAuditSummaryFromItems treats inventory presence as availability', () => {
  const s = buildAuditSummaryFromItems([
    { title: 'T', imageUrl: 'i', price: 1, gtin: 'g', category: 'c', url: 'u', inventory: 0 },
  ]);
  // inventory=0 is defined → availability present
  assert.equal(s.missing_availability, 0);
});

// ---------------------------------------------------------------------------
// buildFeedAuditIssues — severity thresholds, sort, top-5
// ---------------------------------------------------------------------------
test('buildFeedAuditIssues assigns severity by affected rate and sorts desc', () => {
  const issues = buildFeedAuditIssues({
    total: 100,
    missing_title: 40,        // 40% → high
    missing_description: 15,  // 15% → medium
    missing_image: 5,         // 5% → low
    missing_brand: 0,         // filtered out
  });
  assert.equal(issues[0].key, 'title');
  assert.equal(issues[0].severity, 'high');
  assert.equal(issues[0].affectedRate, 40);
  const desc = issues.find((i) => i.key === 'description');
  assert.equal(desc.severity, 'medium');
  const img = issues.find((i) => i.key === 'image');
  assert.equal(img.severity, 'low');
  // brand has 0 missing → excluded
  assert.equal(issues.some((i) => i.key === 'brand'), false);
  // sorted by affectedRate desc
  for (let i = 1; i < issues.length; i++) {
    assert.ok(issues[i - 1].affectedRate >= issues[i].affectedRate);
  }
});

test('buildFeedAuditIssues caps at 5 issues', () => {
  const issues = buildFeedAuditIssues({
    total: 100,
    missing_title: 90, missing_description: 80, missing_image: 70,
    missing_brand: 60, missing_category: 50, missing_identifier: 40, missing_link: 30,
  });
  assert.equal(issues.length, 5);
});

// ---------------------------------------------------------------------------
// calculateFeedAuditSummary — agrégation feed-level
// ---------------------------------------------------------------------------
test('calculateFeedAuditSummary returns zeroed report for empty feed', () => {
  const r = calculateFeedAuditSummary({ total: 0 }, []);
  assert.equal(r.score, 0);
  assert.equal(r.potentialScore, 0);
  assert.equal(r.scoreBand.label, 'Aucun signal');
  assert.deepEqual(r.auditPillars, []);
});

test('calculateFeedAuditSummary aggregates coverage + product scores', () => {
  const summary = {
    total: 10,
    missing_title: 0, missing_description: 2, missing_image: 1, missing_brand: 3,
    missing_category: 2, missing_identifier: 1, missing_price: 0, missing_link: 0,
    missing_availability: 1, ready_for_channels: 6, blocking_core: 1,
  };
  const scoredItems = [
    { qualityScore: 80, dimensions: { compliance: 75, dataQuality: 82, seo: 70, conversion: 78 } },
    { qualityScore: 60, dimensions: { compliance: 55, dataQuality: 62, seo: 58, conversion: 60 } },
  ];
  const r = calculateFeedAuditSummary(summary, scoredItems);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.ok(r.potentialScore >= r.score);
  assert.equal(r.metrics.totalProducts, 10);
  assert.equal(r.metrics.sampleSize, 2);
  assert.equal(r.metrics.averageProductScore, 70); // (80+60)/2
  assert.equal(r.auditPillars.length, 4);
  assert.ok(['Avance', 'Exploitable', 'Fragile', 'Critique'].includes(r.scoreBand.label));
  assert.ok(Array.isArray(r.topIssues));
  assert.equal(r.scoreBreakdown.productQuality, 70);
});

test('calculateFeedAuditSummary is deterministic for the same input', () => {
  const summary = { total: 5, missing_title: 1, ready_for_channels: 3, blocking_core: 1 };
  const a = calculateFeedAuditSummary(summary, [{ qualityScore: 50, dimensions: {} }]);
  const b = calculateFeedAuditSummary(summary, [{ qualityScore: 50, dimensions: {} }]);
  assert.deepEqual(a, b);
});

'use strict';

/**
 * scoring/feed-audit.js — Scoring d'audit de flux produit (bloc 5).
 *
 * EXTRACTION STRANGLER A COMPORTEMENT STRICTEMENT PRESERVE.
 * Sorti A L'IDENTIQUE de la fonction geante run() de server-minimal.js.
 * AUCUN changement fonctionnel : memes ponderations, memes seuils de severite,
 * memes piliers/score bands, memes formules de potentiel/visibilite.
 *
 * Trois helpers PURS d'agregation (aucune dependance a l'etat serveur : pas de
 * prisma, pas de fetch, pas de closure de run()) :
 *
 *  - buildAuditSummaryFromItems(items)        ← couverture des champs (missing_*,
 *                                                ready_for_channels, blocking_core)
 *                                                depuis les items bruts normalises.
 *  - buildFeedAuditIssues(summary)            ← top blocages tries par taux d'impact.
 *  - calculateFeedAuditSummary(summary, items)← agrege un echantillon de scores
 *                                                produit (calculateAdvancedQualityScore)
 *                                                + la couverture en un rapport feed-level
 *                                                (score, potentiel, piliers, band, issues).
 *
 * Ces fonctions sont appelees par le pipeline d'audit post-ingestion
 * (maybeGenerateMarketingAuditReport) et l'endpoint d'audit de flux. Les ROUTES
 * restent dans server-minimal.js ; elles importent ces helpers via des const
 * locales de signatures inchangees. Complete le cablage du dossier scoring/
 * (quality.js / quality-advanced.js deja extraits).
 */

function buildFeedAuditIssues(summary = {}) {
  const total = Math.max(Number(summary.total || 0), 1);
  const issueCandidates = [
    {
      key: 'title',
      label: 'Titres produits',
      missingCount: Number(summary.missing_title || 0),
      impact: 'Les produits perdent en couverture et en pertinence sur les canaux de diffusion.',
      recommendation: 'Retravailler les titres avec structure marque + type + attributs distinctifs.',
    },
    {
      key: 'description',
      label: 'Descriptions',
      missingCount: Number(summary.missing_description || 0),
      impact: 'Le flux manque de contexte semantique pour le matching et la conversion.',
      recommendation: 'Completer les descriptions avec benefices, caracteristiques et usages.',
    },
    {
      key: 'image',
      label: 'Images principales',
      missingCount: Number(summary.missing_image || 0),
      impact: 'Les produits deviennent difficilement diffusables et moins cliques.',
      recommendation: 'Ajouter une image principale exploitable pour chaque SKU actif.',
    },
    {
      key: 'brand',
      label: 'Marque',
      missingCount: Number(summary.missing_brand || 0),
      impact: 'Le ciblage catalogue et les diagnostics Merchant Center perdent en qualite.',
      recommendation: 'Renseigner la marque ou la collection pour tous les produits eligibles.',
    },
    {
      key: 'category',
      label: 'Categorisation',
      missingCount: Number(summary.missing_category || 0),
      impact: 'Le flux se diffuse moins bien et les encheres automatiques sont moins precises.',
      recommendation: 'Ajouter google_product_category, product_type ou une categorie interne fiable.',
    },
    {
      key: 'identifier',
      label: 'Identifiants produits',
      missingCount: Number(summary.missing_identifier || 0),
      impact: 'Les produits ont plus de risque de rejet ou de diffusion limitee.',
      recommendation: 'Completer GTIN, MPN ou SKU normalise selon le catalogue.',
    },
    {
      key: 'link',
      label: 'URLs produit',
      missingCount: Number(summary.missing_link || 0),
      impact: 'La diffusion transactionnelle et le suivi des visites sont degrades.',
      recommendation: 'Corriger les URLs vides, invalides ou non envoyees par la source.',
    },
  ];

  return issueCandidates
    .map((issue) => {
      const affectedProducts = issue.missingCount;
      const affectedRate = Math.round((affectedProducts / total) * 100);
      let severity = 'low';
      if (affectedRate >= 30) severity = 'high';
      else if (affectedRate >= 12) severity = 'medium';
      return {
        key: issue.key,
        label: issue.label,
        severity,
        affectedProducts,
        affectedRate,
        impact: issue.impact,
        recommendation: issue.recommendation,
      };
    })
    .filter((issue) => issue.affectedProducts > 0)
    .sort((a, b) => b.affectedRate - a.affectedRate)
    .slice(0, 5);
}

function calculateFeedAuditSummary(summary = {}, scoredItems = []) {
  const total = Number(summary.total || 0);
  if (total <= 0) {
    return {
      score: 0,
      potentialScore: 0,
      estimatedAdditionalApprovedProducts: 0,
      estimatedVisibilityLiftPct: 0,
      metrics: {
        totalProducts: 0,
        sampleSize: 0,
        averageProductScore: 0,
        coverageRate: 0,
        approvalReadyRate: 0,
      },
      scoreBreakdown: {
        dataCoverage: 0,
        productQuality: 0,
        channelReadiness: 0,
      },
      auditPillars: [],
      scoreBand: {
        label: 'Aucun signal',
        description: 'Impossible d evaluer le flux sans produits exploitables.',
      },
      topIssues: [],
      methodology: {
        scoring: 'Score calcule a partir de la couverture de donnees, d un echantillon de scores produit et de la readiness canal.',
        estimation: 'Le potentiel estime correspond a une hypothese conservative de produits additionnels diffusable apres correction des priorites.',
      },
    };
  }

  const pct = (value) => Math.round((Number(value || 0) / total) * 100);
  const completionRates = {
    title: 100 - pct(summary.missing_title),
    description: 100 - pct(summary.missing_description),
    image: 100 - pct(summary.missing_image),
    brand: 100 - pct(summary.missing_brand),
    category: 100 - pct(summary.missing_category),
    identifier: 100 - pct(summary.missing_identifier),
    price: 100 - pct(summary.missing_price),
    link: 100 - pct(summary.missing_link),
    availability: 100 - pct(summary.missing_availability),
  };

  const dataCoverage = Math.round(
    (completionRates.title * 0.16) +
    (completionRates.description * 0.12) +
    (completionRates.image * 0.16) +
    (completionRates.brand * 0.10) +
    (completionRates.category * 0.10) +
    (completionRates.identifier * 0.12) +
    (completionRates.price * 0.10) +
    (completionRates.link * 0.08) +
    (completionRates.availability * 0.06)
  );

  const scoredAverage = scoredItems.length
    ? Math.round(scoredItems.reduce((sum, item) => sum + Number(item.qualityScore || 0), 0) / scoredItems.length)
    : 0;
  const dimensionAverage = (key) => scoredItems.length
    ? Math.round(scoredItems.reduce((sum, item) => sum + Number(item.dimensions?.[key] || 0), 0) / scoredItems.length)
    : 0;
  const complianceAverage = dimensionAverage('compliance');
  const dataQualityAverage = dimensionAverage('dataQuality');
  const seoAverage = dimensionAverage('seo');
  const conversionAverage = dimensionAverage('conversion');
  const approvalReadyRate = pct(summary.ready_for_channels);
  const channelReadiness = Math.round(
    (approvalReadyRate * 0.7) +
    ((100 - pct(summary.blocking_core)) * 0.3)
  );

  const complianceHealth = Math.round(
    (complianceAverage * 0.55) +
    (completionRates.identifier * 0.2) +
    (completionRates.price * 0.1) +
    (completionRates.availability * 0.05) +
    ((100 - pct(summary.blocking_core)) * 0.1)
  );
  const catalogCompleteness = Math.round(
    (dataCoverage * 0.55) +
    (dataQualityAverage * 0.45)
  );
  const discoverability = Math.round(
    (seoAverage * 0.55) +
    (completionRates.title * 0.2) +
    (completionRates.category * 0.15) +
    (completionRates.image * 0.1)
  );
  const conversionReadiness = Math.round(
    (conversionAverage * 0.55) +
    (completionRates.image * 0.15) +
    (completionRates.description * 0.15) +
    (completionRates.brand * 0.05) +
    (completionRates.link * 0.1)
  );

  const score = Math.max(
    0,
    Math.min(100, Math.round(
      (complianceHealth * 0.3) +
      (catalogCompleteness * 0.3) +
      (discoverability * 0.2) +
      (conversionReadiness * 0.2)
    ))
  );

  const topIssues = buildFeedAuditIssues(summary);
  const improvementCapacity = Math.max(
    0,
    Math.round(
      topIssues.reduce((sum, issue) => {
        const factor = issue.severity === 'high' ? 0.45 : issue.severity === 'medium' ? 0.26 : 0.12;
        return sum + (issue.affectedRate * factor);
      }, 0)
    )
  );
  const weakestPillarGap = Math.max(
    0,
    75 - Math.min(complianceHealth, catalogCompleteness, discoverability, conversionReadiness)
  );
  const potentialScore = Math.min(100, score + Math.max(10, Math.min(38, improvementCapacity + Math.round(weakestPillarGap * 0.25))));
  const estimatedAdditionalApprovedProducts = Math.max(
    0,
    Math.min(
      total,
      Math.round((Number(summary.blocking_core || 0) * 0.65) + (Number(summary.missing_identifier || 0) * 0.35))
    )
  );
  const estimatedVisibilityLiftPct = Math.max(0, Math.min(55, Math.round(((potentialScore - score) * 0.95) + (approvalReadyRate < 60 ? 6 : 0))));
  const auditPillars = [
    {
      key: 'compliance',
      label: 'Conformite diffusion',
      score: complianceHealth,
      detail: 'Mesure la capacite du flux a etre accepte et exploitable sur les canaux transactionnels.',
    },
    {
      key: 'catalog',
      label: 'Completude catalogue',
      score: catalogCompleteness,
      detail: 'Mesure la richesse et la fiabilite des attributs essentiels du catalogue.',
    },
    {
      key: 'discovery',
      label: 'Decouvrabilite',
      score: discoverability,
      detail: 'Mesure la capacite du flux a bien matcher les requetes et la taxonomie des canaux.',
    },
    {
      key: 'conversion',
      label: 'Readiness conversion',
      score: conversionReadiness,
      detail: 'Mesure la capacite du flux a generer du clic qualifie puis de la conversion.',
    },
  ];
  const scoreBand = score >= 85
    ? { label: 'Avance', description: 'Le flux est solide mais peut encore debloquer du volume et de la precision multicanal.' }
    : score >= 70
      ? { label: 'Exploitable', description: 'Le flux est diffusable mais laisse encore trop de valeur sur la table.' }
      : score >= 50
        ? { label: 'Fragile', description: 'Le catalogue diffuse partiellement, avec des angles morts importants a corriger.' }
        : { label: 'Critique', description: 'Le flux perd beaucoup de valeur avant meme la phase de diffusion.' };

  return {
    score,
    potentialScore,
    estimatedAdditionalApprovedProducts,
    estimatedVisibilityLiftPct,
    metrics: {
      totalProducts: total,
      sampleSize: scoredItems.length,
      averageProductScore: scoredAverage,
      coverageRate: dataCoverage,
      approvalReadyRate,
    },
    scoreBreakdown: {
      dataCoverage,
      productQuality: scoredAverage,
      channelReadiness,
    },
    auditPillars,
    scoreBand,
    topIssues,
    methodology: {
      scoring: 'Le score combine quatre piliers: conformite diffusion, completude catalogue, decouvrabilite et readiness conversion, alimentes par la couverture des champs et un echantillon de scores produit.',
      estimation: 'Le potentiel estime valorise les points de friction les plus diffusants, la part de produits bloquants et l ecart entre les piliers faibles et un niveau exploitable.',
    },
  };
}

function buildAuditSummaryFromItems(items = []) {
  const total = items.length;
  const normalizedItems = Array.isArray(items) ? items : [];
  const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';
  const hasIdentifier = (item) => hasValue(item.gtin) || hasValue(item.mpn) || hasValue(item.sku);
  const hasCategory = (item) => hasValue(item.category) || hasValue(item.googleProductCategory) || hasValue(item.productType);
  const hasAvailability = (item) => hasValue(item.availability) || item.inventory !== null && item.inventory !== undefined;
  const isReady = (item) => hasValue(item.title) && hasValue(item.imageUrl) && hasValue(item.price) && hasValue(item.url) && hasIdentifier(item) && hasCategory(item) && hasAvailability(item);
  const isBlocking = (item) => !hasValue(item.title) || !hasValue(item.imageUrl) || !hasValue(item.price) || !hasIdentifier(item);

  return {
    total,
    missing_title: normalizedItems.filter((item) => !hasValue(item.title)).length,
    missing_description: normalizedItems.filter((item) => !hasValue(item.descriptionText) && !hasValue(item.descriptionHtml)).length,
    missing_image: normalizedItems.filter((item) => !hasValue(item.imageUrl)).length,
    missing_brand: normalizedItems.filter((item) => !hasValue(item.brand)).length,
    missing_category: normalizedItems.filter((item) => !hasCategory(item)).length,
    missing_identifier: normalizedItems.filter((item) => !hasIdentifier(item)).length,
    missing_price: normalizedItems.filter((item) => !hasValue(item.price)).length,
    missing_link: normalizedItems.filter((item) => !hasValue(item.url)).length,
    missing_availability: normalizedItems.filter((item) => !hasAvailability(item)).length,
    ready_for_channels: normalizedItems.filter((item) => isReady(item)).length,
    blocking_core: normalizedItems.filter((item) => isBlocking(item)).length,
  };
}

module.exports = {
  buildFeedAuditIssues,
  calculateFeedAuditSummary,
  buildAuditSummaryFromItems,
};

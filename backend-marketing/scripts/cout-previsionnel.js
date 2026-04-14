#!/usr/bin/env node
/**
 * Coût prévisionnel FeedPlug (GCP) — estimation mensuelle en €.
 *
 * Utilise les tarifs publics GCP (europe-west1) pour Cloud Run et Cloud SQL.
 * Les montants sont des ordres de grandeur (tarifs 2024, convertis en EUR ~1.05).
 *
 * Usage:
 *   node scripts/cout-previsionnel.js
 *   node scripts/cout-previsionnel.js --clients 20 --produits 5000
 *   node scripts/cout-previsionnel.js --scenario light|medium|heavy
 *
 * Options:
 *   --clients N       Nombre de comptes clients (défaut: lu en base ou 10)
 *   --produits N       Produits totaux (tous comptes) ou moyen par client si utilisé avec --par-client
 *   --par-client       Interpréter --produits comme moyenne par client
 *   --requetes N       Requêtes API / jour / compte (défaut: estimé à partir des produits)
 *   --scenario light|medium|heavy|reel  light=5c 10k prod, medium=20c 100k, heavy=50c 500k, reel=SQL prod ~120€
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Tarifs GCP europe-west1 (ordres de grandeur, €/mois ou €/unité)
// Cloud Run: https://cloud.google.com/run/pricing — On-demand ~0.000024 USD/vCPU-s, ~0.0000025 USD/GiB-s → ×1.05 EUR
const EUR_PER_VCPU_SECOND = 0.000025;
const EUR_PER_GIB_SECOND = 0.0000026;
// Cloud SQL: instance type → €/mois (approximatif, europe-west1)
const CLOUD_SQL_MONTHLY_EUR = {
  'db-f1-micro': 8,
  'db-g1-small': 35,
  'db-custom-1-3840': 55,
  'db-custom-2-7680': 110,
  'db-custom-2-7680-prod': 120, // ordre de grandeur prod (2 vCPU, 8 Go)
};
// Stockage GCS / Artifact Registry: négligeable pour petit volume
const DEFAULT_SQL_TIER = 'db-g1-small';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { clients: null, produits: null, parClient: false, requetesPerDayPerAccount: null, scenario: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--clients' && args[i + 1]) out.clients = parseInt(args[i + 1], 10);
    if (args[i] === '--produits' && args[i + 1]) out.produits = parseInt(args[i + 1], 10);
    if (args[i] === '--par-client') out.parClient = true;
    if (args[i] === '--requetes' && args[i + 1]) out.requetesPerDayPerAccount = parseInt(args[i + 1], 10);
    if (args[i] === '--scenario' && args[i + 1]) out.scenario = args[i + 1];
  }
  return out;
}

async function getActualTotals() {
  try {
    const [accounts, products] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Account"`),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c FROM "FeedItem" i JOIN "Feed" f ON f.id = i.feedid`
      ),
    ]);
    return { clients: accounts?.[0]?.c ?? 0, produits: products?.[0]?.c ?? 0 };
  } catch (e) {
    return { clients: 0, produits: 0 };
  }
}

function estimateRequestsPerDayPerAccount(produitsTotal, clients) {
  if (clients === 0) return 200;
  const produitsPerAccount = produitsTotal / clients;
  // Ordre de grandeur: dashboard, catalogue, exports, règles... ~5–20 requêtes/jour par 1000 produits
  return Math.round(50 + (produitsPerAccount / 1000) * 15);
}

function computePrevisionnel(opts) {
  const {
    clients = 10,
    produitsTotal = 20000,
    requetesPerDayPerAccount = null,
    sqlTier = DEFAULT_SQL_TIER,
  } = opts;
  const sqlTierKey = sqlTier;

  const reqPerDay = requetesPerDayPerAccount ?? estimateRequestsPerDayPerAccount(produitsTotal, clients);
  const totalRequestsPerDay = clients * reqPerDay;
  const totalRequestsPerMonth = totalRequestsPerDay * 30;

  // Cloud Run: 1 vCPU, 2 GiB backend; 1 vCPU, 1 GiB frontend. Durée moyenne ~0.5 s par requête (backend) et ~0.2 s (front).
  // Simplification: tout en backend équivalent (0.4 s à 1 vCPU + 2 GiB par requête)
  const vCpuSecondsPerMonth = totalRequestsPerMonth * 0.4;
  const gibSecondsPerMonth = totalRequestsPerMonth * 0.4 * 2;
  const cloudRunEur =
    vCpuSecondsPerMonth * EUR_PER_VCPU_SECOND + gibSecondsPerMonth * EUR_PER_GIB_SECOND;

  // Cloud SQL: fixe par instance + un peu de requêtes (déjà inclus dans l’instance pour une petite app)
  const cloudSqlEur = CLOUD_SQL_MONTHLY_EUR[sqlTierKey] ?? CLOUD_SQL_MONTHLY_EUR['db-g1-small'];

  // Vertex AI / Gemini: optionnel, ~0.001 € par requête d’enrichissement; on met 0 en base, tu peux ajouter
  const vertexEur = 0;

  const totalEur = cloudRunEur + cloudSqlEur + vertexEur;

  return {
    clients,
    produitsTotal,
    requetesPerDayPerAccount: reqPerDay,
    totalRequestsPerMonth,
    cloudRunEur: Math.round(cloudRunEur * 100) / 100,
    cloudSqlEur,
    vertexEur,
    totalEur: Math.round(totalEur * 100) / 100,
    sqlTier: sqlTierKey,
  };
}

async function run() {
  const args = parseArgs();

  let clients = args.clients;
  let produitsTotal = args.produits;
  let scenarioSqlTier = null;

  if (args.scenario) {
    const scenarios = {
      light: { clients: 5, produits: 10000, sqlTier: 'db-g1-small' },
      medium: { clients: 20, produits: 100000, sqlTier: 'db-g1-small' },
      heavy: { clients: 50, produits: 500000, sqlTier: 'db-custom-2-7680' },
      reel: { clients: 0, produits: 0, sqlTier: 'db-custom-2-7680-prod' }, // coût fixe actuel (0 client = plateforme à vide)
    };
    const s = scenarios[args.scenario] || scenarios.medium;
    clients = s.clients;
    produitsTotal = args.parClient ? s.produits * s.clients : s.produits;
    if (args.scenario === 'reel') {
      clients = 1;
      produitsTotal = 50000;
    }
    scenarioSqlTier = s.sqlTier;
  }

  if (clients == null || produitsTotal == null) {
    const actual = await getActualTotals();
    if (clients == null) clients = actual.clients || 10;
    if (produitsTotal == null) produitsTotal = actual.produits || 20000;
    if (args.parClient && clients > 0) produitsTotal = Math.round(produitsTotal / clients) * clients;
  }

  const result = computePrevisionnel({
    clients,
    produitsTotal,
    requetesPerDayPerAccount: args.requetesPerDayPerAccount,
    sqlTier: scenarioSqlTier || DEFAULT_SQL_TIER,
  });

  console.log('\n--- Coût prévisionnel FeedPlug (GCP, europe-west1) ---\n');
  console.log('Hypothèses:');
  console.log(`  Comptes clients:     ${result.clients}`);
  console.log(`  Produits (total):    ${result.produitsTotal}`);
  console.log(`  Requêtes/jour/compte: ~${result.requetesPerDayPerAccount} (estimé)`);
  console.log(`  Requêtes totales/mois: ${result.totalRequestsPerMonth.toLocaleString()}`);
  console.log(`  Cloud SQL:           ${result.sqlTier || DEFAULT_SQL_TIER}`);
  console.log('');
  console.log('Estimation mensuelle (€):');
  console.log(`  Cloud Run (backend + frontend):  ${result.cloudRunEur.toFixed(2)} €`);
  console.log(`  Cloud SQL:                        ${result.cloudSqlEur.toFixed(2)} €`);
  console.log(`  Vertex AI / Gemini:               ${result.vertexEur.toFixed(2)} €`);
  console.log('  ─────────────────────────────────────');
  console.log(`  Total prévisionnel:               ${result.totalEur.toFixed(2)} €/mois`);
  console.log('');
  console.log('(Tarifs indicatifs 2024, EUR. Le coût réel peut être bien plus élevé :');
  console.log('  - Cloud SQL en prod est souvent 2 vCPU / 8 Go → ~100–130 €/mois');
  console.log('  - La facture GCP inclut TOUS les projets du compte (pas seulement FeedPlug)');
  console.log('  - Voir docs/POURQUOI_ON_PAIE_CE_MONTANT.md pour le détail.)');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

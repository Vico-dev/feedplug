#!/usr/bin/env node
/**
 * Estimation du coût de revient par client (compte).
 *
 * Utilise les métriques en base (produits, flux, sources) pour répartir un coût
 * total GCP mensuel de façon pondérée. Sans export GCP par compte, c’est une
 * approximation (les vrais coûts sont par projet GCP, pas par compte app).
 *
 * Usage:
 *   cd backend-marketing && node scripts/cost-per-client.js
 *   COST_TOTAL_EUR=150 node scripts/cost-per-client.js
 *
 * Variables d’environnement:
 *   DATABASE_URL  - requis (Prisma)
 *   COST_TOTAL_EUR - coût total GCP du mois en € (ex: 150). Si absent, affiche seulement les métriques.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const COST_TOTAL_EUR = process.env.COST_TOTAL_EUR ? parseFloat(process.env.COST_TOTAL_EUR) : null;

async function getUsagePerAccount() {
  const accounts = await prisma.$queryRawUnsafe(`
    SELECT id, name, plan, companyname
    FROM "Account"
    ORDER BY name
  `);

  const result = [];
  for (const acc of accounts || []) {
    const [products, feeds, sources] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c FROM "FeedItem" i JOIN "Feed" f ON f.id = i.feedid WHERE f.accountid = $1::text`,
        acc.id
      ),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "Feed" WHERE accountid = $1::text`, acc.id),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "FeedSource" WHERE accountid = $1::text`, acc.id),
    ]);
    const productsCount = products?.[0]?.c ?? 0;
    const feedsCount = feeds?.[0]?.c ?? 0;
    const sourcesCount = sources?.[0]?.c ?? 0;

    // Poids pour répartition : les produits pèsent le plus (requêtes SQL, stockage), puis flux/sources
    const weight = productsCount * 1 + feedsCount * 50 + sourcesCount * 20;

    result.push({
      id: acc.id,
      name: acc.name || acc.companyname || acc.id,
      plan: acc.plan,
      productsCount,
      feedsCount,
      sourcesCount,
      weight: Math.max(weight, 1),
    });
  }
  return result;
}

async function run() {
  console.log('Récupération des métriques par compte...\n');

  const usage = await getUsagePerAccount();
  const totalWeight = usage.reduce((s, u) => s + u.weight, 0);

  if (usage.length === 0) {
    console.log('Aucun compte trouvé.');
    return;
  }

  console.log('Métriques par compte (poids = produits×1 + flux×50 + sources×20):');
  console.log('─'.repeat(100));
  console.log(
    [
      'Compte',
      'Plan',
      'Produits',
      'Flux',
      'Sources',
      'Poids',
      COST_TOTAL_EUR != null ? 'Part %' : '',
      COST_TOTAL_EUR != null ? 'Coût estimé (€)' : '',
    ]
      .filter(Boolean)
      .join('\t')
  );
  console.log('─'.repeat(100));

  for (const u of usage) {
    const pct = totalWeight > 0 ? ((u.weight / totalWeight) * 100).toFixed(1) : '0';
    const costEur =
      COST_TOTAL_EUR != null && totalWeight > 0
        ? ((COST_TOTAL_EUR * u.weight) / totalWeight).toFixed(2)
        : '—';
    console.log(
      [
        (u.name || u.id).slice(0, 30),
        u.plan,
        u.productsCount,
        u.feedsCount,
        u.sourcesCount,
        u.weight,
        COST_TOTAL_EUR != null ? pct + '%' : '',
        COST_TOTAL_EUR != null ? costEur : '',
      ]
        .filter((x) => x !== '')
        .join('\t')
    );
  }

  console.log('─'.repeat(100));
  console.log(`Total comptes: ${usage.length}  |  Total poids: ${totalWeight}`);

  if (COST_TOTAL_EUR != null) {
    console.log(`\nCoût total GCP saisi: ${COST_TOTAL_EUR} €/mois`);
    console.log('Coût par client = répartition pondérée selon le poids (usage relatif).');
  } else {
    console.log('\nPour afficher un coût estimé par client, définis COST_TOTAL_EUR (ex: 150):');
    console.log('  COST_TOTAL_EUR=150 node scripts/cost-per-client.js');
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
